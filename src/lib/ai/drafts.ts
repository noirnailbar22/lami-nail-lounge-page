import { z } from "zod";
import { aiJson, dataBlock } from "./client";
import type { DraftFacts } from "../drafts/context";
import type { Scenario } from "../drafts/state";
import { SCENARIOS } from "../drafts/state";
import type { StyleProfileData } from "../style/schema";
import type { Signature, DraftOutput } from "../drafts/templates";

export const AiDraftSchema = z.object({
  subject: z.string().nullable(),
  body: z.string().min(1),
  factsUsed: z.array(z.string()),
  missingInfo: z.array(z.string()),
  warnings: z.array(z.string()),
});

export async function aiDraft(opts: {
  scenario: Scenario;
  channel: "sms" | "email";
  language: "en" | "vi";
  facts: DraftFacts;
  style: StyleProfileData;
  examples: { channel: string; label: string; text: string }[];
  signature: Signature;
  instructions?: string;
}): Promise<DraftOutput & { missingInfo: string[] }> {
  const system = `Bạn soạn tin follow-up cho một realtor ở Austin, TX theo đúng giọng văn của họ.
Quy tắc bắt buộc:
- Chỉ dùng dữ kiện có trong <data>. Không bịa thông tin căn nhà, giá, lịch hẹn, lời hứa, số liệu thị trường.
- Nếu thiếu dữ kiện quan trọng, viết tin tổng quát hơn và liệt kê phần thiếu trong "missingInfo".
- "factsUsed": liệt kê đúng các dữ kiện đã dùng.
- Không nhắc đến hoặc suy diễn đặc điểm thuộc nhóm được bảo vệ (chủng tộc, tôn giáo, quốc tịch, gia đình, khuyết tật, giới tính...) hay "khu an toàn/khu tốt cho gia đình".
- Kênh SMS: ngắn, không có subject (subject = null), không dùng markdown.
- Kênh email: có subject ngắn, văn bản thuần.
- Ngôn ngữ đầu ra: ${opts.language === "vi" ? "tiếng Việt" : "English"}.
- Ký tên theo hồ sơ phong cách; chữ ký: ${JSON.stringify(opts.signature)}.`;

  const user = [
    `Tình huống: ${SCENARIOS[opts.scenario]} (${opts.scenario}). Kênh: ${opts.channel}.`,
    "Hồ sơ phong cách (do người dùng cấu hình):",
    JSON.stringify(opts.style, null, 1),
    "Ví dụ phong cách (good = nên giống, bad = tránh):",
    dataBlock("style_examples", opts.examples.slice(0, 12)),
    "Dữ kiện về khách:",
    dataBlock("client_facts", opts.facts),
    opts.instructions ? `Yêu cầu thêm của người dùng: ${opts.instructions}` : "",
  ].join("\n\n");

  const r = await aiJson({ schema: AiDraftSchema, system, user, effort: "medium", maxTokens: 6000 });
  return { subject: opts.channel === "sms" ? null : r.subject, body: r.body.trim(), factsUsed: r.factsUsed, warnings: r.warnings, missingInfo: r.missingInfo };
}
