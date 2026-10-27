import { z } from "zod";

export const StyleProfileSchema = z.object({
  greetingEn: z.string().default("Hi {firstName},"),
  greetingVi: z.string().default("Chào {firstName},"),
  smsLength: z.enum(["very_short", "short", "medium"]).default("short"),
  emailLength: z.enum(["short", "medium", "long"]).default("short"),
  formality: z.number().int().min(1).max(5).default(2), // 1 = rất thân mật, 5 = rất trang trọng
  emoji: z.enum(["none", "rare", "often"]).default("rare"),
  questionStyle: z.string().default("Một câu hỏi mở, nhẹ nhàng ở cuối tin."),
  closingStyle: z.string().default("Kết bằng lời mời không áp lực."),
  signOffEn: z.string().default("Thanks,\n{signature}"),
  signOffVi: z.string().default("Cảm ơn anh/chị,\n{signature}"),
  smsSignOff: z.string().default("- {name}"),
  preferWords: z.array(z.string()).default([]),
  avoidWords: z.array(z.string()).default([]),
  notes: z.string().default(""),
});
export type StyleProfileData = z.infer<typeof StyleProfileSchema>;

export const parseStyle = (v: unknown): StyleProfileData => {
  const r = StyleProfileSchema.safeParse(v ?? {});
  return r.success ? r.data : StyleProfileSchema.parse({});
};

export const LENGTH_LABELS: Record<string, string> = {
  very_short: "Rất ngắn (1–2 câu)",
  short: "Ngắn",
  medium: "Vừa",
  long: "Dài",
};
