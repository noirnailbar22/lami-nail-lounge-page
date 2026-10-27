import { z } from "zod";

// Bộ lọc tìm nhà — chỉ tiêu chí khách quan về căn nhà (xem fairhousing.ts).
export const PROPERTY_TYPES = ["single_family", "condo", "townhome", "multi_family", "land"] as const;
export const PURPOSES = ["primary", "first_home", "investment", "relocation", "downsizing", "vacation", "other"] as const;

export const FEATURE_KEYS = ["pool", "garage", "single_story", "no_hoa", "remodeled", "large_lot", "new_construction"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  pool: "Hồ bơi",
  garage: "Garage",
  single_story: "Nhà 1 tầng",
  no_hoa: "Không HOA",
  remodeled: "Đã remodel",
  large_lot: "Lot lớn (≥ 0.25 acre)",
  new_construction: "Nhà mới (≤ 5 năm)",
};

export const SearchFiltersSchema = z.object({
  budgetMin: z.number().int().nonnegative().nullable().default(null),
  budgetMax: z.number().int().nonnegative().nullable().default(null),
  areas: z.array(z.string()).default([]),
  zips: z.array(z.string()).default([]),
  propertyTypes: z.array(z.enum(PROPERTY_TYPES)).default([]),
  bedsMin: z.number().nonnegative().nullable().default(null),
  bathsMin: z.number().nonnegative().nullable().default(null),
  sqftMin: z.number().int().nonnegative().nullable().default(null),
  sqftMax: z.number().int().nonnegative().nullable().default(null),
  purpose: z.enum(PURPOSES).nullable().default(null),
  mustHave: z.array(z.enum(FEATURE_KEYS)).default([]),
  niceToHave: z.array(z.enum(FEATURE_KEYS)).default([]),
  /** Yêu cầu không ánh xạ được thành bộ lọc khách quan — giữ lại dạng chữ để người dùng xem. */
  otherNotes: z.array(z.string()).default([]),
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

export const emptyFilters = (): SearchFilters => SearchFiltersSchema.parse({});
