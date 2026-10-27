import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { aiEnabled, env } from "../env";
import { logAction } from "../audit";
import { getSettings } from "../settings";
import { checkOptOut, primaryEmail, primaryPhone } from "../clients/contact";
import { getActiveStyle, styleExamples } from "../style/service";
import { aiDraft } from "../ai/drafts";
import { emailProviderFor } from "../email";
import { DefiniteSendError } from "../email/types";
import { buildFacts, missingFor } from "./context";
import { templateDraft } from "./templates";
import { assertTransition, canEdit, type DraftStatus, type Scenario } from "./state";
import { contentHash, idempotencyKey } from "./hash";

const json = (v: unknown) => v as Prisma.InputJsonValue;

export class DraftError extends Error {}

export async function generateDraft(input: {
  clientId: string;
  scenario: Scenario;
  channel: "sms" | "email";
  language: "en" | "vi";
  propertyIds?: string[];
  threadId?: string | null;
  instructions?: string;
}) {
  const client = await db.client.findUniqueOrThrow({ where: { id: input.clientId } });
  const interactions = await db.interaction.findMany({ where: { clientId: client.id }, orderBy: { occurredAt: "desc" }, take: 30 });
  const properties = input.propertyIds?.length ? await db.property.findMany({ where: { id: { in: input.propertyIds } } }) : [];
  const facts = buildFacts(client, interactions, properties);
  const style = await getActiveStyle();
  const sig = env.signature;
  const signature = { name: sig.name, company: sig.company, phone: sig.phone, email: sig.email };
  const codeMissing = missingFor(input.scenario, facts, client, input.channel);

  let out;
  let generator: "ai" | "demo_template";
  let extraMissing: string[] = [];
  if (aiEnabled()) {
    const r = await aiDraft({
      ...input,
      facts,
      style: style.data,
      examples: await styleExamples(),
      signature,
    });
    out = r;
    extraMissing = r.missingInfo;
    generator = "ai";
  } else {
    out = templateDraft(input.scenario, input.channel, input.language, facts, style.data, signature);
    generator = "demo_template";
  }

  const recipientAddress = input.channel === "sms" ? primaryPhone(client) : primaryEmail(client);
  const draft = await db.draft.create({
    data: {
      clientId: client.id,
      scenario: input.scenario,
      channel: input.channel,
      language: input.language,
      recipientName: client.name,
      recipientAddress: recipientAddress ?? null,
      subject: out.subject,
      body: out.body,
      originalBody: out.body,
      generator,
      isDemo: client.isDemo || generator === "demo_template",
      missingInfo: json([...new Set([...codeMissing, ...extraMissing])]),
      factsUsed: json(out.factsUsed),
      warnings: json(out.warnings),
      styleVersion: style.version,
      threadId: input.threadId ?? null,
      propertyIds: json(input.propertyIds ?? []),
    },
  });
  await logAction({ action: "draft.generate", entityType: "Draft", entityId: draft.id, actor: generator === "ai" ? "ai" : "system", details: { scenario: input.scenario, channel: input.channel, generator } });
  return draft;
}

/** Sửa bản nháp. Mọi thay đổi sau khi duyệt sẽ hủy duyệt — phải duyệt lại. */
export async function updateDraft(id: string, patch: { body?: string; subject?: string | null; recipientAddress?: string | null }) {
  const d = await db.draft.findUniqueOrThrow({ where: { id } });
  if (!canEdit(d.status)) throw new DraftError(`Không thể sửa bản ở trạng thái "${d.status}".`);
  const next = { ...d, ...patch };
  const changed = contentHash(next) !== contentHash(d);
  const revoke = changed && d.status === "approved";
  const updated = await db.draft.update({
    where: { id },
    data: {
      ...patch,
      ...(revoke || (changed && d.status === "failed") ? { status: "draft", approvedHash: null, approvedAt: null } : {}),
    },
  });
  if (revoke) await logAction({ action: "draft.approval_revoked", entityType: "Draft", entityId: id, details: { reason: "nội dung/người nhận thay đổi" } });
  return updated;
}

export async function approveDraft(id: string) {
  const d = await db.draft.findUniqueOrThrow({ where: { id }, include: { client: true } });
  const err = assertTransition(d.status, "approved");
  if (err) throw new DraftError(err);
  if (!d.recipientAddress) throw new DraftError("Chưa có người nhận.");
  if (!d.body.trim()) throw new DraftError("Nội dung trống.");
  if (d.channel === "email" && !d.subject?.trim()) throw new DraftError("Email cần có tiêu đề.");
  const settings = await getSettings();
  const opt = checkOptOut(d.client, d.channel as "sms" | "email", d.recipientAddress, settings);
  if (opt.blocked) {
    await logAction({ action: "draft.approve", entityType: "Draft", entityId: id, result: "blocked", details: { reasons: opt.reasons } });
    throw new DraftError("Không thể duyệt: " + opt.reasons.join(" "));
  }
  const hash = contentHash(d);
  const r = await db.draft.update({ where: { id }, data: { status: "approved", approvedHash: hash, approvedAt: new Date(), sendError: null } });
  await logAction({ action: "draft.approve", entityType: "Draft", entityId: id, details: { channel: d.channel, recipient: d.recipientAddress, hash } });
  return r;
}

export async function rejectDraft(id: string) {
  const d = await db.draft.findUniqueOrThrow({ where: { id } });
  const err = assertTransition(d.status, "rejected");
  if (err) throw new DraftError(err);
  await logAction({ action: "draft.reject", entityType: "Draft", entityId: id });
  return db.draft.update({ where: { id }, data: { status: "rejected", approvedHash: null, approvedAt: null } });
}

const normBody = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export type SendResult = { status: DraftStatus; message: string; providerMessageId?: string | null };

/**
 * Gửi đúng nội dung đã duyệt tới đúng người nhận đã duyệt.
 *  - Nội dung/người nhận đổi sau khi duyệt → chặn.
 *  - Opt-out → chặn.
 *  - Cùng nội dung đã gửi/duyệt qua kênh khác trong 7 ngày → chặn trừ khi người dùng xác nhận.
 *  - Mỗi lần duyệt chỉ tạo tối đa một lần gửi (idempotency key unique).
 *  - SMS: FUB API không gửi SMS → "Cần gửi trong FUB".
 */
export async function sendDraft(id: string, opts: { allowCrossChannel?: boolean } = {}): Promise<SendResult> {
  const d = await db.draft.findUniqueOrThrow({ where: { id }, include: { client: true } });
  if (d.status === "unknown") throw new DraftError("Lần gửi trước chưa xác định kết quả. Kiểm tra hộp thư đã gửi trước khi thử lại.");
  if (d.status !== "approved" || !d.approvedHash || !d.approvedAt) throw new DraftError("Bản này chưa được duyệt.");
  if (contentHash(d) !== d.approvedHash) throw new DraftError("Nội dung hoặc người nhận đã thay đổi sau khi duyệt — cần duyệt lại.");

  const settings = await getSettings();
  const opt = checkOptOut(d.client, d.channel as "sms" | "email", d.recipientAddress, settings);
  if (opt.blocked) {
    await logAction({ action: "draft.send", entityType: "Draft", entityId: id, result: "blocked", details: { reasons: opt.reasons } });
    throw new DraftError("Bị chặn: " + opt.reasons.join(" "));
  }

  if (!opts.allowCrossChannel) {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const others = await db.draft.findMany({
      where: { clientId: d.clientId, id: { not: d.id }, channel: { not: d.channel }, updatedAt: { gte: since }, status: { in: ["approved", "needs_manual_send", "manual_confirmed", "sending", "sent", "sent_demo", "unknown"] } },
      select: { id: true, channel: true, body: true, scenario: true },
    });
    const dup = others.find((o) => normBody(o.body) === normBody(d.body) || o.scenario === d.scenario);
    if (dup) {
      await logAction({ action: "draft.send", entityType: "Draft", entityId: id, result: "blocked", details: { reason: "cross_channel", other: dup.id } });
      throw new DraftError(`Khách đã có tin cùng tình huống qua ${dup.channel.toUpperCase()} trong 7 ngày. Xác nhận nếu bạn thật sự muốn gửi cả hai kênh.`);
    }
  }

  const key = idempotencyKey(d.id, d.approvedHash, d.approvedAt);
  const prior = await db.sendAttempt.findUnique({ where: { idempotencyKey: key } });
  if (prior) {
    return { status: d.status as DraftStatus, message: "Nội dung đã duyệt này đã được xử lý trước đó — không gửi lại.", providerMessageId: prior.providerMessageId };
  }

  const base = { draftId: d.id, idempotencyKey: key, channel: d.channel, recipient: d.recipientAddress!, subject: d.subject, body: d.body };

  if (d.channel === "sms") {
    // Không có API gửi SMS của FUB cho tích hợp này (POST /textMessages chỉ ghi nhận log).
    try {
      await db.sendAttempt.create({ data: { ...base, provider: "fub_manual", status: "manual_required" } });
    } catch {
      return { status: "needs_manual_send", message: "Đã xử lý trước đó." };
    }
    await db.draft.update({ where: { id }, data: { status: "needs_manual_send" } });
    await logAction({ action: "sms.manual_required", entityType: "Draft", entityId: id, details: { recipient: d.recipientAddress } });
    return { status: "needs_manual_send", message: "Cần gửi trong FUB: sao chép nội dung và gửi từ hồ sơ khách trong Follow Up Boss." };
  }

  const provider = await emailProviderFor(d.client.isDemo);
  if (!provider) throw new DraftError("Chưa kết nối Gmail. Vào Cài đặt → Kết nối để kết nối, hoặc sao chép nội dung để gửi thủ công.");

  let attempt;
  try {
    // Tạo bản ghi trước khi gửi: unique key chặn hai request song song cùng gửi.
    attempt = await db.sendAttempt.create({ data: { ...base, provider: provider.id === "demo" ? "demo_email" : "gmail", status: "pending" } });
  } catch {
    return { status: "sending", message: "Đang có một lần gửi khác cho nội dung này." };
  }
  await db.draft.update({ where: { id }, data: { status: "sending" } });
  const messageIdHeader = `<${key.slice(0, 32)}@realtor-assistant>`;
  try {
    const r = await provider.send({ to: d.recipientAddress!, subject: d.subject!, body: d.body, threadId: d.threadId, messageIdHeader });
    const status: DraftStatus = provider.isDemo ? "sent_demo" : "sent";
    await db.sendAttempt.update({ where: { id: attempt.id }, data: { status: "sent", providerMessageId: r.providerMessageId } });
    await db.draft.update({ where: { id }, data: { status, sentAt: new Date(), providerMessageId: r.providerMessageId, sendError: null } });
    await db.interaction.create({
      data: { clientId: d.clientId, source: "app", kind: "email", direction: "out", occurredAt: new Date(), subject: d.subject, body: d.body, isDemo: provider.isDemo },
    });
    await logAction({ action: "email.send", entityType: "Draft", entityId: id, details: { provider: provider.id, providerMessageId: r.providerMessageId } });
    return { status, message: provider.isDemo ? "DEMO: giả lập gửi — không có email thật nào được gửi." : "Đã gửi qua Gmail.", providerMessageId: r.providerMessageId };
  } catch (e) {
    const definite = e instanceof DefiniteSendError;
    const status: DraftStatus = definite ? "failed" : "unknown";
    await db.sendAttempt.update({ where: { id: attempt.id }, data: { status: definite ? "failed" : "unknown", error: (e as Error).message } });
    await db.draft.update({ where: { id }, data: { status, sendError: (e as Error).message } });
    await logAction({ action: "email.send", entityType: "Draft", entityId: id, result: "error", details: { error: (e as Error).message, definite } });
    return {
      status,
      message: definite ? `Gửi thất bại: ${(e as Error).message}. Sửa và duyệt lại để thử lại.` : "Không xác định được kết quả gửi. Kiểm tra hộp thư đã gửi trước khi thử lại.",
    };
  }
}

/** SMS: người dùng xác nhận đã tự gửi trong FUB. */
export async function confirmManualSent(id: string) {
  const d = await db.draft.findUniqueOrThrow({ where: { id } });
  const err = assertTransition(d.status, "manual_confirmed");
  if (err) throw new DraftError(err);
  await logAction({ action: "sms.manual_confirmed", entityType: "Draft", entityId: id });
  return db.draft.update({ where: { id }, data: { status: "manual_confirmed", sentAt: new Date() } });
}

/** Xử lý trạng thái "chưa xác định": kiểm tra Gmail theo Message-ID, hoặc người dùng tự xác nhận. */
export async function resolveUnknown(id: string, userSays?: "sent" | "not_sent") {
  const d = await db.draft.findUniqueOrThrow({ where: { id }, include: { client: true, attempts: true } });
  if (d.status !== "unknown") throw new DraftError("Bản này không ở trạng thái chưa xác định.");
  const att = d.attempts.find((a) => a.status === "unknown");
  if (!userSays && att) {
    const provider = await emailProviderFor(d.client.isDemo);
    const found = provider ? await provider.findSent(`<${att.idempotencyKey.slice(0, 32)}@realtor-assistant>`) : null;
    if (found) userSays = "sent";
    else return { resolved: false, message: "Không tìm thấy trong hộp thư đã gửi. Nếu chắc chắn chưa gửi, chọn 'Chưa gửi'." };
  }
  if (userSays === "sent") {
    await db.draft.update({ where: { id }, data: { status: "sent", sentAt: new Date() } });
    if (att) await db.sendAttempt.update({ where: { id: att.id }, data: { status: "sent" } });
  } else {
    await db.draft.update({ where: { id }, data: { status: "draft", approvedHash: null, approvedAt: null } });
    if (att) await db.sendAttempt.update({ where: { id: att.id }, data: { status: "failed", error: "Người dùng xác nhận chưa gửi" } });
  }
  await logAction({ action: "draft.resolve_unknown", entityType: "Draft", entityId: id, details: { userSays } });
  return { resolved: true, message: userSays === "sent" ? "Đã đánh dấu là đã gửi." : "Đã đưa về bản nháp — cần duyệt lại để gửi." };
}

/** "Dùng bản sửa này làm ví dụ phong cách". */
export async function saveDraftAsExample(id: string) {
  const d = await db.draft.findUniqueOrThrow({ where: { id } });
  const s = await db.styleSample.create({
    data: { channel: d.channel, language: d.language, label: "good", text: d.body, origin: "edited_draft", draftId: d.id },
  });
  await logAction({ action: "style.sample_from_draft", entityType: "StyleSample", entityId: s.id, details: { draftId: id } });
  return s;
}
