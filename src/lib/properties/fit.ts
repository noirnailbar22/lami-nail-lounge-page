import type { Property } from "@prisma/client";
import { FEATURE_LABELS, type FeatureKey, type SearchFilters } from "./filters";

// Mức độ phù hợp với KHÁCH — chỉ so tiêu chí khách đưa ra với dữ liệu căn nhà.
export type Check = { label: string; result: "match" | "miss" | "unknown"; detail?: string };
export type Fit = { score: number | null; label: string; mustFail: boolean; checks: Check[] };

const currentPrice = (p: Property) => (p.status === "sold" ? null : p.listPrice ?? p.pendingPrice ?? null);

function feature(p: Property, k: FeatureKey): boolean | null {
  switch (k) {
    case "pool": return p.pool;
    case "garage": return p.garageSpaces === null ? null : p.garageSpaces > 0;
    case "single_story": return p.stories === null ? null : p.stories === 1;
    case "no_hoa": return p.hoaMonthly === null ? null : p.hoaMonthly === 0;
    case "remodeled": return p.remodeled;
    case "large_lot": return p.lotSqft === null ? null : p.lotSqft >= 10_890;
    case "new_construction": return p.yearBuilt === null ? null : p.yearBuilt >= new Date().getFullYear() - 5;
  }
}

export function computeFit(p: Property, f: SearchFilters): Fit {
  const checks: Check[] = [];
  let mustFail = false;
  const add = (label: string, ok: boolean | null, detail?: string, must = true) => {
    checks.push({ label, result: ok === null ? "unknown" : ok ? "match" : "miss", detail });
    if (must && ok === false) mustFail = true;
  };
  const price = currentPrice(p);
  if (f.budgetMax !== null) add(`Giá ≤ $${f.budgetMax.toLocaleString()}`, price === null ? null : price <= f.budgetMax, price ? `$${price.toLocaleString()}` : "không có giá chào bán");
  if (f.budgetMin !== null) add(`Giá ≥ $${f.budgetMin.toLocaleString()}`, price === null ? null : price >= f.budgetMin, undefined);
  if (f.areas.length) add(`Khu vực: ${f.areas.join(", ")}`, p.city ? f.areas.some((a) => a.toLowerCase() === p.city!.toLowerCase() || a.toLowerCase() === (p.subdivision ?? "").toLowerCase()) : null, p.city ?? undefined);
  if (f.zips.length) add(`ZIP: ${f.zips.join(", ")}`, p.zip ? f.zips.includes(p.zip) : null, p.zip ?? undefined);
  if (f.propertyTypes.length) add(`Loại nhà: ${f.propertyTypes.join(", ")}`, p.propertyType ? (f.propertyTypes as string[]).includes(p.propertyType) : null, p.propertyType ?? undefined);
  if (f.bedsMin !== null) add(`≥ ${f.bedsMin} phòng ngủ`, p.beds === null ? null : p.beds >= f.bedsMin, p.beds?.toString());
  if (f.bathsMin !== null) add(`≥ ${f.bathsMin} phòng tắm`, p.baths === null ? null : p.baths >= f.bathsMin, p.baths?.toString());
  if (f.sqftMin !== null) add(`≥ ${f.sqftMin} sqft`, p.sqft === null ? null : p.sqft >= f.sqftMin, p.sqft?.toString());
  if (f.sqftMax !== null) add(`≤ ${f.sqftMax} sqft`, p.sqft === null ? null : p.sqft <= f.sqftMax, p.sqft?.toString());
  for (const k of f.mustHave) add(`Bắt buộc: ${FEATURE_LABELS[k]}`, feature(p, k));
  for (const k of f.niceToHave) add(`Ưu tiên: ${FEATURE_LABELS[k]}`, feature(p, k), undefined, false);

  // Điểm = số tiêu chí khớp / tổng tiêu chí; tiêu chí chưa rõ KHÔNG được tính là khớp.
  const matched = checks.filter((c) => c.result === "match").length;
  const unknown = checks.filter((c) => c.result === "unknown").length;
  const score = checks.length ? Math.round((matched / checks.length) * 100) : null;
  const label = mustFail
    ? "Không đạt tiêu chí bắt buộc"
    : !checks.length
      ? "Chưa có tiêu chí để so"
      : `${matched}/${checks.length} tiêu chí khớp${unknown ? ` · ${unknown} chưa rõ (thiếu dữ liệu)` : ""}`;
  return { score, label, mustFail, checks };
}
