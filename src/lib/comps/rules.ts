import { z } from "zod";

// "Quy tắc run comps" — do người dùng cấu hình. Mọi hệ số mặc định là null (= chưa cấu hình, không áp dụng).
const n = z.number().nullable().default(null);

export const ConditionScale = z.object({ poor: n, fair: n, average: n, good: n, excellent: n });

export const CompRulesSchema = z.object({
  selection: z.object({
    maxDistanceMiles: n,
    sameSubdivisionPreferred: z.boolean().default(false),
    sameZipOnly: z.boolean().default(false),
    boundaryNotes: z.string().default(""),
    soldWithinMonths: n,
    samePropertyType: z.boolean().default(true),
    sqftTolerancePct: n,
    yearBuiltTolerance: n,
    bedsTolerance: n,
    excludeConditions: z.array(z.string()).default([]),
    minComps: z.number().int().min(1).default(3),
    maxComps: z.number().int().min(1).default(6),
    notes: z.string().default(""),
  }).prefault({}),
  sourcePriority: z.array(z.string()).default(["mls", "csv", "manual", "link", "demo"]),
  includePendingAsSupport: z.boolean().default(true),
  includeActiveAsSupport: z.boolean().default(true),
  adjustments: z.object({
    perSqft: n,
    perBed: n,
    perBath: n,
    perGarageSpace: n,
    pool: n,
    perLotSqft: n,
    perYearAge: n,
    remodel: n,
    condition: ConditionScale.prefault({}),
    timePctPerMonth: n,
    notes: z.string().default(""),
  }).prefault({}),
  maxGrossAdjustmentPct: n,
  maxNetAdjustmentPct: n,
  range: z.object({
    method: z.enum(["min_max_adjusted", "median_pct", "middle_two_thirds"]).nullable().default(null),
    pct: n,
    roundTo: z.number().int().positive().default(1000),
  }).prefault({}),
  presentationNotes: z.string().default(""),
});
export type CompRules = z.infer<typeof CompRulesSchema>;

export const parseRules = (v: unknown): CompRules => CompRulesSchema.parse(v ?? {});

export const ADJ_LABELS: Record<string, string> = {
  perSqft: "Chênh diện tích ($/sqft)",
  perBed: "Mỗi phòng ngủ",
  perBath: "Mỗi phòng tắm",
  perGarageSpace: "Mỗi chỗ garage",
  pool: "Hồ bơi",
  perLotSqft: "Chênh lot ($/sqft lot)",
  perYearAge: "Mỗi năm tuổi nhà",
  remodel: "Remodel",
  condition: "Tình trạng",
  timePctPerMonth: "Thời gian (%/tháng)",
};
