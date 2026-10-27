import { sha256 } from "../crypto";

// Chỉ dùng phía server.
export type Approvable = {
  channel: string;
  recipientAddress: string | null;
  subject: string | null;
  body: string;
};

/** Dấu vân tay nội dung được duyệt: đổi người nhận/kênh/tiêu đề/nội dung → phải duyệt lại. */
export function contentHash(d: Approvable) {
  return sha256(JSON.stringify([d.channel, (d.recipientAddress ?? "").trim().toLowerCase(), (d.subject ?? "").trim(), d.body.trim()]));
}

export function idempotencyKey(draftId: string, approvedHash: string, approvedAt: Date) {
  return sha256(`${draftId}|${approvedHash}|${approvedAt.toISOString()}`);
}
