import { db } from "./db";
import { env, aiEnabled, fubEnabled, gmailConfigured } from "./env";
import { LISTING_SOURCES } from "./properties/sources";

export type ConnState = "active" | "demo" | "blocked" | "manual" | "error" | "not_configured";
export type Conn = { id: string; name: string; state: ConnState; detail: string; needs: string[] };

export async function connectionStatus(): Promise<Conn[]> {
  const lastFub = await db.syncRun.findFirst({ where: { provider: "fub" }, orderBy: { startedAt: "desc" } });
  const gmailCred = await db.oAuthCredential.findFirst({ where: { provider: "google" } });
  const list: Conn[] = [
    {
      id: "anthropic",
      name: "Anthropic (AI soạn thảo, phân tích)",
      state: aiEnabled() ? "active" : "demo",
      detail: aiEnabled() ? `Model ${env.anthropicModel}` : env.anthropicKey ? "Có key nhưng DEMO_MODE đang bật" : "Chưa có ANTHROPIC_API_KEY — dùng mẫu cố định",
      needs: aiEnabled() ? [] : ["ANTHROPIC_API_KEY trong .env", "DEMO_MODE=false"],
    },
    {
      id: "fub",
      name: "Follow Up Boss — đọc khách, tương tác, task; ghi note/task sau duyệt",
      state: fubEnabled() ? (lastFub?.status === "error" ? "error" : "active") : "demo",
      detail: fubEnabled()
        ? lastFub
          ? `Đồng bộ gần nhất: ${lastFub.startedAt.toLocaleString("vi-VN")} — ${lastFub.status}${lastFub.error ? `: ${lastFub.error}` : ""}`
          : "Có key, chưa đồng bộ lần nào"
        : env.fubKey ? "Có key nhưng DEMO_MODE đang bật" : "Chưa có FUB_API_KEY",
      needs: fubEnabled() ? (env.fubSystemKey ? [] : ["(Khuyến nghị) Đăng ký hệ thống với FUB để có X-System-Key — giới hạn tốc độ cao hơn, cần cho webhook và /textMessages"]) : ["FUB_API_KEY (Admin → API trong FUB)", "DEMO_MODE=false"],
    },
    {
      id: "fub_sms",
      name: "Gửi SMS qua Follow Up Boss",
      state: "manual",
      detail: "FUB API không có endpoint gửi SMS (POST /textMessages chỉ ghi nhận log). App soạn + duyệt, bạn sao chép và gửi trong FUB.",
      needs: ["Chỉ bật gửi tự động nếu FUB xác nhận bằng văn bản có API gửi SMS cho tích hợp của bạn"],
    },
    {
      id: "gmail",
      name: "Gmail / Google Workspace",
      state: gmailCred && gmailConfigured() ? "active" : gmailConfigured() ? "not_configured" : "demo",
      detail: gmailCred ? `Đã kết nối: ${gmailCred.accountEmail}` : gmailConfigured() ? "Đã có OAuth client — bấm Kết nối Gmail" : "Chưa có GOOGLE_CLIENT_ID/SECRET — dùng email demo",
      needs: gmailCred ? [] : ["Tạo OAuth client (Web) trong Google Cloud Console, bật Gmail API", "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI", "ENCRYPTION_KEY để mã hóa token"],
    },
    ...LISTING_SOURCES.map((s) => ({ id: s.id, name: s.name, state: s.status as ConnState, detail: s.note, needs: s.needs })),
  ];
  return list;
}
