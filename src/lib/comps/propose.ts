import { z } from "zod";
import { median } from "../properties/deal";
import { CompRulesSchema, type CompRules } from "./rules";

// Rút đề xuất quy tắc từ các ví dụ người dùng đã làm. Chỉ là ĐỀ XUẤT — chỉ thành quy tắc chính thức khi được duyệt.

export const ExampleCompSchema = z.object({
  address: z.string(),
  selected: z.boolean(),
  reason: z.string().default(""),
  soldPrice: z.number().nullable().default(null),
  sqft: z.number().nullable().default(null),
  distanceMiles: z.number().nullable().default(null),
  monthsSinceSale: z.number().nullable().default(null),
  adjustments: z.array(z.object({ label: z.string(), amount: z.number(), unitDiff: z.number().nullable().default(null) })).default([]),
});
export const ExampleSubjectSchema = z.object({
  address: z.string(),
  sqft: z.number().nullable().default(null),
  beds: z.number().nullable().default(null),
  baths: z.number().nullable().default(null),
  yearBuilt: z.number().nullable().default(null),
});
export type ExampleComp = z.infer<typeof ExampleCompSchema>;

export type Proposal = { rules: CompRules; rationale: string[]; caveats: string[] };

export function proposeFromExamples(examples: { subject: unknown; comps: unknown; finalLow: number | null; finalHigh: number | null }[]): Proposal {
  const rationale: string[] = [];
  const caveats: string[] = [];
  const comps = examples.flatMap((e) => z.array(ExampleCompSchema).catch([]).parse(e.comps));
  const sel = comps.filter((c) => c.selected);
  const rej = comps.filter((c) => !c.selected);
  const rules = CompRulesSchema.parse({});
  if (examples.length < 3) caveats.push(`Chỉ có ${examples.length} ví dụ — đề xuất có độ tin cậy thấp.`);

  const dists = sel.map((c) => c.distanceMiles).filter((x): x is number => x !== null);
  if (dists.length) {
    rules.selection.maxDistanceMiles = Math.ceil(Math.max(...dists) * 4) / 4;
    rationale.push(`Comp được chọn xa nhất ${Math.max(...dists)} mi → đề xuất tối đa ${rules.selection.maxDistanceMiles} mi.`);
  }
  const months = sel.map((c) => c.monthsSinceSale).filter((x): x is number => x !== null);
  if (months.length) {
    rules.selection.soldWithinMonths = Math.ceil(Math.max(...months));
    rationale.push(`Comp được chọn cũ nhất ${Math.max(...months)} tháng → đề xuất trong ${rules.selection.soldWithinMonths} tháng.`);
  }
  // Hệ số điều chỉnh suy ra: amount / unitDiff theo nhãn.
  const byLabel = new Map<string, number[]>();
  for (const c of sel) for (const a of c.adjustments) if (a.unitDiff) byLabel.set(a.label.toLowerCase(), [...(byLabel.get(a.label.toLowerCase()) ?? []), a.amount / a.unitDiff]);
  const map: [RegExp, keyof CompRules["adjustments"]][] = [
    [/sqft|size|diện tích/, "perSqft"], [/bed|phòng ngủ/, "perBed"], [/bath|tắm/, "perBath"], [/garage/, "perGarageSpace"], [/pool|hồ bơi/, "pool"], [/lot/, "perLotSqft"], [/age|year|tuổi|năm/, "perYearAge"], [/remodel/, "remodel"],
  ];
  for (const [label, rates] of byLabel) {
    const hit = map.find(([re]) => re.test(label));
    const m = median(rates);
    if (hit && m !== null) {
      (rules.adjustments as Record<string, unknown>)[hit[1]] = Math.round(m);
      rationale.push(`"${label}": ${rates.length} lần, trung vị $${Math.round(m).toLocaleString()}/đơn vị.`);
    } else caveats.push(`Không ánh xạ được khoản "${label}" — cần bạn cấu hình tay.`);
  }
  for (const r of rej.slice(0, 8)) if (r.reason) rationale.push(`Đã loại ${r.address}: ${r.reason}`);
  if (examples.some((e) => e.finalLow && e.finalHigh)) caveats.push("Cách bạn chốt khoảng giá cần chọn trong mục 'Khoảng giá' — không tự suy ra.");
  return { rules, rationale, caveats };
}
