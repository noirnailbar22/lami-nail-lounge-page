import { db } from "../db";
import { decrypt, encrypt } from "../crypto";
import { env } from "../env";
import { DefiniteSendError, type EmailProvider, type EmailThread } from "./types";

// Gmail / Google Workspace qua OAuth 2.0. Quyền tối thiểu:
//  - gmail.readonly: đọc thread liên quan đến khách (chỉ khi người dùng mở hồ sơ khách)
//  - gmail.send: gửi thư sau khi duyệt
//  - openid email: biết hộp thư nào đã kết nối
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export function googleAuthUrl(state: string) {
  const g = env.google;
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: g.clientId,
    redirect_uri: g.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return u.toString();
}

async function tokenRequest(params: Record<string, string>) {
  const g = env.google;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, ...params }),
  });
  if (!res.ok) throw new Error(`Google OAuth lỗi ${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope: string; id_token?: string };
}

export async function exchangeGoogleCode(code: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: env.google.redirectUri });
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } });
  const { email } = (await info.json()) as { email: string };
  await db.oAuthCredential.upsert({
    where: { provider_accountEmail: { provider: "google", accountEmail: email } },
    create: {
      provider: "google",
      accountEmail: email,
      scopes: t.scope,
      accessTokenEnc: encrypt(t.access_token),
      refreshTokenEnc: t.refresh_token ? encrypt(t.refresh_token) : null,
      expiresAt: new Date(Date.now() + t.expires_in * 1000),
    },
    update: {
      scopes: t.scope,
      accessTokenEnc: encrypt(t.access_token),
      ...(t.refresh_token ? { refreshTokenEnc: encrypt(t.refresh_token) } : {}),
      expiresAt: new Date(Date.now() + t.expires_in * 1000),
    },
  });
  return email;
}

async function accessToken(): Promise<{ token: string; email: string }> {
  const cred = await db.oAuthCredential.findFirst({ where: { provider: "google" }, orderBy: { updatedAt: "desc" } });
  if (!cred) throw new Error("Chưa kết nối Gmail.");
  if (cred.expiresAt && cred.expiresAt.getTime() > Date.now() + 60_000) return { token: decrypt(cred.accessTokenEnc), email: cred.accountEmail };
  if (!cred.refreshTokenEnc) throw new Error("Token Gmail hết hạn — kết nối lại.");
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(cred.refreshTokenEnc) });
  await db.oAuthCredential.update({
    where: { id: cred.id },
    data: { accessTokenEnc: encrypt(t.access_token), expiresAt: new Date(Date.now() + t.expires_in * 1000) },
  });
  return { token: t.access_token, email: cred.accountEmail };
}

async function gmail<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = await accessToken();
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status >= 400 && res.status < 500) throw new DefiniteSendError(`Gmail từ chối (${res.status})`);
  if (!res.ok) throw new Error(`Gmail lỗi ${res.status}`);
  return (await res.json()) as T;
}

type GmailMsg = { id: string; threadId: string; snippet: string; internalDate: string; payload: { headers: { name: string; value: string }[] } };
const header = (m: GmailMsg, n: string) => m.payload.headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

function toThread(t: { id: string; messages: GmailMsg[] }): EmailThread {
  const msgs = t.messages.map((m) => ({
    id: m.id,
    from: header(m, "From"),
    to: header(m, "To"),
    date: new Date(Number(m.internalDate)).toISOString().slice(0, 10),
    subject: header(m, "Subject"),
    snippet: m.snippet,
  }));
  return { id: t.id, subject: msgs[0]?.subject ?? "", lastDate: msgs.at(-1)?.date ?? "", messages: msgs };
}

function encodeMime(lines: string[]) {
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);

export const gmailProvider: EmailProvider = {
  id: "gmail",
  label: "Gmail / Google Workspace",
  isDemo: false,
  async listThreads(contactEmail) {
    const q = encodeURIComponent(`from:${contactEmail} OR to:${contactEmail}`);
    const list = await gmail<{ threads?: { id: string }[] }>(`/threads?maxResults=5&q=${q}`);
    const out: EmailThread[] = [];
    for (const t of list.threads ?? []) {
      out.push(toThread(await gmail(`/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`)));
    }
    return out;
  },
  async getThread(id) {
    return toThread(await gmail(`/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Message-ID`));
  },
  async send(input) {
    const { email } = await accessToken();
    let inReplyTo: string | undefined;
    if (input.threadId) {
      const t = await gmail<{ messages: GmailMsg[] }>(`/threads/${input.threadId}?format=metadata&metadataHeaders=Message-ID`);
      const last = t.messages.at(-1);
      inReplyTo = last ? header(last, "Message-ID") : undefined;
    }
    const raw = encodeMime([
      `From: ${email}`,
      `To: ${input.to}`,
      `Subject: ${encodeHeader(input.subject)}`,
      `Message-ID: ${input.messageIdHeader}`,
      ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : []),
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      input.body,
    ]);
    const r = await gmail<{ id: string; threadId: string }>("/messages/send", {
      method: "POST",
      body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }),
    });
    return { providerMessageId: r.id, threadId: r.threadId };
  },
  async findSent(messageIdHeader) {
    const q = encodeURIComponent(`in:sent rfc822msgid:${messageIdHeader}`);
    const r = await gmail<{ messages?: { id: string }[] }>(`/messages?q=${q}`);
    return r.messages?.[0]?.id ?? null;
  },
};
