import { z } from "zod";
import { aiEnabled } from "../env";
import { aiJson, dataBlock } from "./client";
import { parseQueryRules } from "../properties/search";
import { FEATURE_KEYS, PROPERTY_TYPES } from "../properties/filters";
import { fairHousingFlags } from "../properties/fairhousing";

export const NoteAnalysisSchema = z.object({
  summary: z.string(),
  needsChanges: z.object({
    budgetMin: z.number().int().nullable(),
    budgetMax: z.number().int().nullable(),
    areas: z.array(z.string()),
    propertyTypes: z.array(z.enum(PROPERTY_TYPES)),
    bedsMin: z.number().nullable(),
    bathsMin: z.number().nullable(),
    mustHave: z.array(z.enum(FEATURE_KEYS)),
    timeline: z.string().nullable(),
    preApproved: z.boolean().nullable(),
  }),
  nextTasks: z.array(z.object({ name: z.string(), type: z.enum(["Follow Up", "Call", "Text", "Email", "Showing", "Appointment"]), dueInDays: z.number().int().min(0).max(90) })),
  warnings: z.array(z.string()),
});
export type NoteAnalysis = z.infer<typeof NoteAnalysisSchema> & { generator: "ai" | "demo_rules" };

export async function analyzeCallNote(note: string, clientContext: unknown): Promise<NoteAnalysis> {
  const fh = fairHousingFlags(note);
  if (!aiEnabled()) {
    const f = parseQueryRules(note);
    const tl = note.match(/(?:in|within|trong)\s+(\d+\s*(?:months?|weeks?|tháng|tuần))/i);
    return {
      generator: "demo_rules",
      summary: note.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 300),
      needsChanges: {
        budgetMin: f.budgetMin, budgetMax: f.budgetMax, areas: f.areas, propertyTypes: f.propertyTypes, bedsMin: f.bedsMin, bathsMin: f.bathsMin,
        mustHave: f.mustHave, timeline: tl ? tl[1] : null, preApproved: /pre-?approv/i.test(note) ? !/not pre-?approv|chưa/i.test(note) : null,
      },
      nextTasks: [{ name: "Follow up sau cuộc gọi", type: "Follow Up", dueInDays: 2 }],
      warnings: ["DEMO: phân tích bằng quy tắc, không phải AI — kiểm tra kỹ.", ...fh],
    };
  }
  const r = await aiJson({
    schema: NoteAnalysisSchema,
    effort: "low",
    maxTokens: 4000,
    system: `Tóm tắt ghi chú sau cuộc gọi/showing của realtor và đề xuất:
- summary: 1–3 câu, chỉ điều có trong ghi chú.
- needsChanges: chỉ điền khi ghi chú nói rõ; còn lại null/mảng rỗng.
- nextTasks: việc tiếp theo cụ thể được nhắc hoặc hiển nhiên từ ghi chú.
- Không dùng đặc điểm nhóm được bảo vệ hay proxy làm nhu cầu; nếu ghi chú có, ghi vào warnings.`,
    user: [dataBlock("client_context", clientContext), dataBlock("call_note", note)].join("\n\n"),
  });
  return { ...r, warnings: [...r.warnings, ...fh], generator: "ai" };
}
