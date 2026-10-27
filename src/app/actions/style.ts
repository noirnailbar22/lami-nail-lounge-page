"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { aiEnabled } from "@/lib/env";
import { aiJson, dataBlock } from "@/lib/ai/client";
import { analyzeSamples, suggestFromStats } from "@/lib/style/analyze";
import { StyleProfileSchema } from "@/lib/style/schema";
import { getActiveStyle, restoreStyleVersion, saveStyleVersion } from "@/lib/style/service";

const SampleSchema = z.object({
  channel: z.enum(["sms", "email"]),
  language: z.enum(["en", "vi"]),
  label: z.enum(["good", "bad"]),
  text: z.string().min(5).max(10000),
});

export async function addSampleAction(input: z.input<typeof SampleSchema>) {
  return run(async () => {
    const s = await db.styleSample.create({ data: { ...SampleSchema.parse(input), origin: "pasted" } });
    await logAction({ action: "style.sample_add", entityType: "StyleSample", entityId: s.id });
    revalidatePath("/style");
  }, "Đã thêm mẫu");
}

export async function deleteSampleAction(id: string) {
  return run(async () => {
    await db.styleSample.delete({ where: { id } });
    await logAction({ action: "style.sample_delete", entityType: "StyleSample", entityId: id });
    revalidatePath("/style");
  }, "Đã xóa mẫu");
}

const AiStyleSchema = StyleProfileSchema.extend({ observations: z.array(z.string()) });

/** Phân tích mẫu đã chọn → gợi ý hồ sơ. Không tự lưu. */
export async function analyzeStyleAction() {
  return run(async () => {
    const samples = await db.styleSample.findMany({ orderBy: { createdAt: "desc" }, take: 60 });
    const stats = analyzeSamples(samples);
    const current = (await getActiveStyle()).data;
    if (!aiEnabled()) {
      return { stats, suggestion: { ...current, ...suggestFromStats(stats, current) }, observations: ["DEMO: gợi ý tính bằng thống kê đơn giản, không phải AI."], generator: "demo_rules" as const };
    }
    const r = await aiJson({
      schema: AiStyleSchema,
      effort: "medium",
      system: `Phân tích giọng văn của một realtor từ các mẫu họ tự chọn.
Rút ra: cách xưng hô/chào (greetingEn/greetingVi, dùng {firstName}), độ dài, mức trang trọng 1–5, emoji, cách đặt câu hỏi, cách chốt, chữ ký ({signature}, {name}), từ nên dùng, từ nên tránh.
Mẫu "bad" là thứ cần tránh. "observations": 3–6 nhận xét ngắn bằng tiếng Việt, dẫn chứng từ mẫu.`,
      user: [dataBlock("current_profile", current), dataBlock("samples", samples.map((s) => ({ channel: s.channel, label: s.label, language: s.language, text: s.text }))), dataBlock("stats", stats)].join("\n\n"),
    });
    const { observations, ...suggestion } = r;
    return { stats, suggestion, observations, generator: "ai" as const };
  });
}

export async function saveStyleAction(data: unknown, note?: string) {
  return run(async () => {
    const row = await saveStyleVersion(StyleProfileSchema.parse(data), note);
    revalidatePath("/style");
    return { version: row.version };
  }, "Đã lưu phiên bản phong cách mới");
}

export async function restoreStyleAction(version: number) {
  return run(async () => {
    const row = await restoreStyleVersion(version);
    revalidatePath("/style");
    return { version: row.version };
  }, "Đã khôi phục (tạo phiên bản mới)");
}
