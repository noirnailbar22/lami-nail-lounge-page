export const SCENARIOS = {
  new_lead: "Lead mới",
  no_reply: "Khách chưa trả lời",
  post_showing: "Sau showing",
  send_homes: "Gửi nhà phù hợp",
  pre_offer: "Trước khi offer",
  past_client: "Chăm sóc khách cũ",
} as const;
export type Scenario = keyof typeof SCENARIOS;

export const DRAFT_STATUS = {
  draft: "Bản nháp",
  approved: "Đã duyệt — chờ gửi",
  rejected: "Đã từ chối",
  needs_manual_send: "Cần gửi trong FUB",
  manual_confirmed: "Bạn xác nhận đã gửi thủ công",
  sending: "Đang gửi",
  sent: "Đã gửi (hệ thống)",
  sent_demo: "DEMO — giả lập gửi, không gửi thật",
  failed: "Gửi lỗi",
  unknown: "Chưa xác định kết quả — kiểm tra trước khi thử lại",
} as const;
export type DraftStatus = keyof typeof DRAFT_STATUS;

/** Trạng thái được coi là "đã ra khỏi tay mình" — không còn là bản nháp. */
export const SENT_LIKE: DraftStatus[] = ["sent", "manual_confirmed", "sent_demo"];
export const EDITABLE: DraftStatus[] = ["draft", "approved", "failed"];

export function canEdit(status: string) {
  return (EDITABLE as string[]).includes(status);
}

/** Chuyển trạng thái hợp lệ. Trả về lỗi tiếng Việt nếu không hợp lệ. */
export function assertTransition(from: string, to: DraftStatus): string | null {
  const allowed: Record<string, DraftStatus[]> = {
    draft: ["approved", "rejected"],
    approved: ["draft", "rejected", "sending", "needs_manual_send", "sent_demo"],
    failed: ["draft", "approved", "rejected"],
    needs_manual_send: ["manual_confirmed", "draft", "rejected"],
    sending: ["sent", "failed", "unknown"],
    unknown: ["sent", "draft"],
    rejected: ["draft"],
  };
  return (allowed[from] ?? []).includes(to) ? null : `Không thể chuyển từ "${from}" sang "${to}".`;
}
