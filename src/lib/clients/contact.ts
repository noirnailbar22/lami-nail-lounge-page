import type { Client } from "@prisma/client";
import type { ContactPoint } from "../crm/types";
import type { AppSettings } from "../settings";

export const points = (v: unknown): ContactPoint[] => (Array.isArray(v) ? (v as ContactPoint[]) : []);
export const tagsOf = (c: Pick<Client, "tags">): string[] => (Array.isArray(c.tags) ? (c.tags as string[]) : []);

function primary(list: ContactPoint[]) {
  const usable = list.filter((p) => !/invalid|bad|not ?valid/i.test(p.status ?? ""));
  return usable.find((p) => p.isPrimary) ?? usable[0];
}
export const primaryPhone = (c: Pick<Client, "phones">) => primary(points(c.phones))?.value;
export const primaryEmail = (c: Pick<Client, "emails">) => primary(points(c.emails))?.value;

export type OptOutCheck = { blocked: boolean; reasons: string[] };

/**
 * Kiểm tra opt-out trước khi gửi. FUB API không công bố trường opt-out chuẩn, nên kết hợp:
 *  - cờ opt-out đặt trong app,
 *  - tag trong FUB khớp danh sách cấu hình,
 *  - trạng thái số/email bị đánh dấu không hợp lệ hoặc opt-out.
 */
export function checkOptOut(
  c: Pick<Client, "smsOptOut" | "emailOptOut" | "tags" | "phones" | "emails">,
  channel: "sms" | "email",
  recipient: string | null | undefined,
  settings: Pick<AppSettings, "smsOptOutTags" | "emailOptOutTags">,
): OptOutCheck {
  const reasons: string[] = [];
  const flag = channel === "sms" ? c.smsOptOut : c.emailOptOut;
  if (flag) reasons.push(`Khách đã được đánh dấu không nhận ${channel === "sms" ? "SMS" : "email"} trong app.`);
  const blockTags = (channel === "sms" ? settings.smsOptOutTags : settings.emailOptOutTags).map((t) => t.toLowerCase());
  for (const t of tagsOf(c)) if (blockTags.includes(t.toLowerCase())) reasons.push(`Tag FUB "${t}" là opt-out.`);
  const list = points(channel === "sms" ? c.phones : c.emails);
  const match = list.find((p) => normalize(p.value, channel) === normalize(recipient ?? "", channel));
  if (!recipient) reasons.push("Chưa có người nhận.");
  else if (!match) reasons.push("Người nhận không khớp số/email trong hồ sơ khách.");
  else if (/opt|unsub|stop|do ?not/i.test(match.status ?? "")) reasons.push(`Trạng thái liên hệ trong FUB: ${match.status}.`);
  return { blocked: reasons.length > 0, reasons };
}

export function normalize(v: string, channel: "sms" | "email") {
  if (channel === "email") return v.trim().toLowerCase();
  const d = v.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}
