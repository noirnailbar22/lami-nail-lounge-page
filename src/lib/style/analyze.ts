import { z } from "zod";
import type { StyleProfileData } from "./schema";

// Phân tích mẫu bằng code (không cần AI): độ dài, câu hỏi, emoji, lời chào, kết thúc.
export type SampleInput = { text: string; channel: string; label: string; language: string };

export const StyleStatsSchema = z.object({
  sampleCount: z.number(),
  avgWordsSms: z.number().nullable(),
  avgWordsEmail: z.number().nullable(),
  questionRate: z.number(),
  exclamationRate: z.number(),
  emojiRate: z.number(),
  commonGreetings: z.array(z.string()),
  commonClosings: z.array(z.string()),
  frequentWords: z.array(z.string()),
});
export type StyleStats = z.infer<typeof StyleStatsSchema>;

const EMOJI = /\p{Extended_Pictographic}/u;
const STOP = new Set(
  "the a an and or to of in on for is it you your i me my we our be at this that with are was will can just so if have has do let know me hi hey thanks thank there here what when how not but from all about".split(
    " ",
  ),
);

function top(items: string[], n: number) {
  const m = new Map<string, number>();
  for (const i of items) if (i) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

export function analyzeSamples(samples: SampleInput[]): StyleStats {
  const good = samples.filter((s) => s.label === "good");
  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const lines = good.map((s) => s.text.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean));
  const rate = (re: RegExp) => (good.length ? good.filter((s) => re.test(s.text)).length / good.length : 0);
  const tokens = good.flatMap((s) =>
    s.text
      .toLowerCase()
      .split(/[^\p{L}']+/u)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
  return {
    sampleCount: good.length,
    avgWordsSms: avg(good.filter((s) => s.channel === "sms").map((s) => words(s.text))),
    avgWordsEmail: avg(good.filter((s) => s.channel === "email").map((s) => words(s.text))),
    questionRate: rate(/\?/),
    exclamationRate: rate(/!/),
    emojiRate: rate(EMOJI),
    commonGreetings: top(lines.map((l) => (l[0] ?? "").split(/[,!.]/)[0].split(" ").slice(0, 2).join(" ")), 3),
    commonClosings: top(lines.map((l) => (l.length > 1 ? l[l.length - 1] : "")), 3),
    frequentWords: top(tokens, 12),
  };
}

/** Gợi ý chỉnh hồ sơ từ số liệu — người dùng xem và quyết định lưu. */
export function suggestFromStats(stats: StyleStats, current: StyleProfileData): Partial<StyleProfileData> {
  const s: Partial<StyleProfileData> = {};
  if (stats.avgWordsSms !== null) s.smsLength = stats.avgWordsSms <= 25 ? "very_short" : stats.avgWordsSms <= 50 ? "short" : "medium";
  if (stats.avgWordsEmail !== null) s.emailLength = stats.avgWordsEmail <= 90 ? "short" : stats.avgWordsEmail <= 180 ? "medium" : "long";
  s.emoji = stats.emojiRate === 0 ? "none" : stats.emojiRate < 0.35 ? "rare" : "often";
  const g = stats.commonGreetings[0];
  if (g && /^[A-Z]/.test(g) && !/^(chào|xin)/i.test(g)) s.greetingEn = `${g} {firstName},`;
  if (current.preferWords.length === 0 && stats.frequentWords.length) s.preferWords = stats.frequentWords.slice(0, 6);
  return s;
}
