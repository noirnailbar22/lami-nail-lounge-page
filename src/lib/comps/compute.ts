import type { Property } from "@prisma/client";
import { median } from "../properties/deal";
import type { CompRules } from "./rules";

// Mọi phép tính comps đều bằng code, có thể kiểm tra lại. AI không tạo số.

export type CompInput = {
  property: Property;
  included: boolean;
  excludeReason?: string | null;
  /** Ghi đè từng khoản điều chỉnh (key → số tiền) và khoản tùy chỉnh. */
  overrides?: Record<string, number>;
  custom?: { label: string; amount: number }[];
};

export type AdjLine = { key: string; label: string; amount: number | null; note: string; overridden?: boolean };

export type CompRow = {
  id: string;
  address: string;
  status: string | null;
  priceType: "sold" | "pending" | "list" | "none";
  price: number | null;
  soldDate: string | null;
  monthsSinceSale: number | null;
  distanceMiles: number | null;
  sqft: number | null;
  ppsf: number | null;
  included: boolean;
  usableAsPriceBasis: boolean;
  excludeReason: string | null;
  ruleFlags: string[];
  adjustments: AdjLine[];
  netAdjustment: number | null;
  grossAdjustmentPct: number | null;
  adjustedPrice: number | null;
  source: string;
};

export type CompResult = {
  rows: CompRow[];
  stats: {
    soldCount: number;
    soldPriceMin: number | null;
    soldPriceMax: number | null;
    soldPriceMedian: number | null;
    ppsfMedian: number | null;
    ppsfMin: number | null;
    ppsfMax: number | null;
    pendingCount: number;
    activeCount: number;
    activeListMedian: number | null;
  };
  range: { low: number; high: number; method: string; basis: string } | null;
  rangeBlockedReason: string | null;
  limitations: string[];
  ruleVersion: number | null;
};

export function haversineMiles(a: { lat: number | null; lng: number | null }, b: { lat: number | null; lng: number | null }) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 3958.8;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const monthsBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / (30.4375 * 86_400_000);
const round = (x: number, to: number) => Math.round(x / to) * to;

function ruleFlags(s: Property, c: Property, r: CompRules, dist: number | null, months: number | null): string[] {
  const f: string[] = [];
  const sel = r.selection;
  if (sel.maxDistanceMiles !== null && dist !== null && dist > sel.maxDistanceMiles) f.push(`Xa ${dist.toFixed(2)} mi > ${sel.maxDistanceMiles} mi`);
  if (sel.maxDistanceMiles !== null && dist === null) f.push("Không có tọa độ để kiểm tra khoảng cách");
  if (sel.sameZipOnly && s.zip && c.zip !== s.zip) f.push(`Khác ZIP (${c.zip ?? "?"})`);
  if (sel.sameSubdivisionPreferred && s.subdivision && c.subdivision !== s.subdivision) f.push("Khác subdivision (ưu tiên cùng subdivision)");
  if (sel.soldWithinMonths !== null && months !== null && months > sel.soldWithinMonths) f.push(`Bán cách đây ${months.toFixed(1)} tháng > ${sel.soldWithinMonths}`);
  if (sel.samePropertyType && s.propertyType && c.propertyType && s.propertyType !== c.propertyType) f.push(`Khác loại nhà (${c.propertyType})`);
  if (sel.sqftTolerancePct !== null && s.sqft && c.sqft) {
    const d = (Math.abs(c.sqft - s.sqft) / s.sqft) * 100;
    if (d > sel.sqftTolerancePct) f.push(`Diện tích lệch ${d.toFixed(0)}% > ${sel.sqftTolerancePct}%`);
  }
  if (sel.yearBuiltTolerance !== null && s.yearBuilt && c.yearBuilt && Math.abs(c.yearBuilt - s.yearBuilt) > sel.yearBuiltTolerance) f.push(`Năm xây lệch ${Math.abs(c.yearBuilt - s.yearBuilt)} năm`);
  if (sel.bedsTolerance !== null && s.beds != null && c.beds != null && Math.abs(c.beds - s.beds) > sel.bedsTolerance) f.push(`Phòng ngủ lệch ${Math.abs(c.beds - s.beds)}`);
  if (c.condition && sel.excludeConditions.includes(c.condition)) f.push(`Tình trạng "${c.condition}" nằm trong danh sách loại`);
  return f;
}

function adjustmentsFor(s: Property, c: Property, r: CompRules, months: number | null, overrides: Record<string, number>): AdjLine[] {
  const a = r.adjustments;
  const lines: AdjLine[] = [];
  const push = (key: string, label: string, rate: number | null, sv: number | null | undefined, cv: number | null | undefined, unit: string) => {
    if (key in overrides) return lines.push({ key, label, amount: overrides[key], note: "Bạn sửa tay", overridden: true });
    if (rate === null) return lines.push({ key, label, amount: null, note: "Chưa cấu hình hệ số" });
    if (sv == null || cv == null) return lines.push({ key, label, amount: null, note: "Thiếu dữ liệu — không điều chỉnh" });
    const diff = sv - cv;
    lines.push({ key, label, amount: Math.round(diff * rate), note: diff === 0 ? "Như nhau" : `${diff > 0 ? "+" : ""}${diff}${unit} × $${rate.toLocaleString()}` });
  };
  const b = (v: boolean | null) => (v === null ? null : v ? 1 : 0);
  push("perSqft", "Diện tích", a.perSqft, s.sqft, c.sqft, " sqft");
  push("perBed", "Phòng ngủ", a.perBed, s.beds, c.beds, " PN");
  push("perBath", "Phòng tắm", a.perBath, s.baths, c.baths, " WC");
  push("perGarageSpace", "Garage", a.perGarageSpace, s.garageSpaces, c.garageSpaces, " chỗ");
  push("pool", "Hồ bơi", a.pool, b(s.pool), b(c.pool), "");
  push("perLotSqft", "Lot", a.perLotSqft, s.lotSqft, c.lotSqft, " sqft");
  push("perYearAge", "Năm xây", a.perYearAge, s.yearBuilt, c.yearBuilt, " năm");
  push("remodel", "Remodel", a.remodel, b(s.remodeled), b(c.remodeled), "");
  // Tình trạng: giá trị theo thang người dùng đặt.
  if ("condition" in overrides) lines.push({ key: "condition", label: "Tình trạng", amount: overrides.condition, note: "Bạn sửa tay", overridden: true });
  else {
    const sv = s.condition ? a.condition[s.condition as keyof typeof a.condition] : null;
    const cv = c.condition ? a.condition[c.condition as keyof typeof a.condition] : null;
    if (Object.values(a.condition).every((x) => x === null)) lines.push({ key: "condition", label: "Tình trạng", amount: null, note: "Chưa cấu hình thang tình trạng" });
    else if (sv == null || cv == null) lines.push({ key: "condition", label: "Tình trạng", amount: null, note: "Thiếu dữ liệu tình trạng" });
    else lines.push({ key: "condition", label: "Tình trạng", amount: Math.round(sv - cv), note: `${s.condition} vs ${c.condition}` });
  }
  if ("time" in overrides) lines.push({ key: "time", label: "Thời gian", amount: overrides.time, note: "Bạn sửa tay", overridden: true });
  else if (a.timePctPerMonth === null) lines.push({ key: "time", label: "Thời gian", amount: null, note: "Chưa cấu hình" });
  else if (months === null || !c.soldPrice) lines.push({ key: "time", label: "Thời gian", amount: null, note: "Thiếu ngày bán" });
  else lines.push({ key: "time", label: "Thời gian", amount: Math.round(c.soldPrice * (a.timePctPerMonth / 100) * months), note: `${months.toFixed(1)} tháng × ${a.timePctPerMonth}%` });
  return lines;
}

/**
 * Tính bảng comps.
 * `rules` = null → chỉ số liệu khách quan, KHÔNG tạo khoảng giá (chưa có phương pháp của người dùng).
 */
export function computeComps(subject: Property, inputs: CompInput[], rules: CompRules | null, ruleVersion: number | null, now = new Date()): CompResult {
  const limitations: string[] = [];
  const rows: CompRow[] = inputs.map(({ property: c, included, excludeReason, overrides = {}, custom = [] }) => {
    const dist = haversineMiles(subject, c);
    const months = c.soldDate ? monthsBetween(c.soldDate, now) : null;
    const isSold = c.status === "sold" && !!c.soldPrice;
    const priceType: CompRow["priceType"] = isSold ? "sold" : c.status === "pending" && (c.pendingPrice || c.listPrice) ? "pending" : c.listPrice ? "list" : "none";
    const price = isSold ? c.soldPrice : priceType === "pending" ? c.pendingPrice ?? c.listPrice : c.listPrice;
    const usable = isSold && !!c.soldDate;
    let adjustments: AdjLine[] = [];
    let net: number | null = null;
    let gross: number | null = null;
    let adjusted: number | null = null;
    if (rules && usable) {
      adjustments = [...adjustmentsFor(subject, c, rules, months, overrides), ...custom.map((x, i) => ({ key: `custom${i}`, label: x.label, amount: x.amount, note: "Khoản tùy chỉnh" }))];
      const amounts = adjustments.map((l) => l.amount ?? 0);
      net = amounts.reduce((s, x) => s + x, 0);
      gross = (amounts.reduce((s, x) => s + Math.abs(x), 0) / c.soldPrice!) * 100;
      adjusted = c.soldPrice! + net;
    }
    const flags = rules ? ruleFlags(subject, c, rules, dist, months) : [];
    if (rules?.maxGrossAdjustmentPct != null && gross !== null && gross > rules.maxGrossAdjustmentPct) flags.push(`Tổng điều chỉnh gộp ${gross.toFixed(1)}% > ${rules.maxGrossAdjustmentPct}%`);
    if (rules?.maxNetAdjustmentPct != null && net !== null && c.soldPrice && Math.abs(net / c.soldPrice) * 100 > rules.maxNetAdjustmentPct) flags.push(`Điều chỉnh ròng vượt ${rules.maxNetAdjustmentPct}%`);
    if (!isSold && c.estimatePrice) flags.push("Chỉ có giá ước tính tự động — không dùng làm giá sold");
    return {
      id: c.id,
      address: c.address,
      status: c.status,
      priceType,
      price: price ?? null,
      soldDate: c.soldDate ? c.soldDate.toISOString().slice(0, 10) : null,
      monthsSinceSale: months === null ? null : Math.round(months * 10) / 10,
      distanceMiles: dist === null ? null : Math.round(dist * 100) / 100,
      sqft: c.sqft,
      ppsf: price && c.sqft ? Math.round(price / c.sqft) : null,
      included,
      usableAsPriceBasis: usable,
      excludeReason: excludeReason ?? null,
      ruleFlags: flags,
      adjustments,
      netAdjustment: net,
      grossAdjustmentPct: gross === null ? null : Math.round(gross * 10) / 10,
      adjustedPrice: adjusted,
      source: `${c.isDemo ? "DEMO · " : ""}${c.source}${c.sourceRef ? ` (${c.sourceRef})` : ""}`,
    };
  });

  const soldIncl = rows.filter((r) => r.included && r.usableAsPriceBasis);
  const soldPrices = soldIncl.map((r) => r.price!);
  const ppsfs = soldIncl.filter((r) => r.ppsf).map((r) => r.ppsf!);
  const active = rows.filter((r) => r.included && r.priceType === "list" && r.status === "active");
  const stats = {
    soldCount: soldIncl.length,
    soldPriceMin: soldPrices.length ? Math.min(...soldPrices) : null,
    soldPriceMax: soldPrices.length ? Math.max(...soldPrices) : null,
    soldPriceMedian: median(soldPrices),
    ppsfMedian: median(ppsfs),
    ppsfMin: ppsfs.length ? Math.min(...ppsfs) : null,
    ppsfMax: ppsfs.length ? Math.max(...ppsfs) : null,
    pendingCount: rows.filter((r) => r.included && r.priceType === "pending").length,
    activeCount: active.length,
    activeListMedian: median(active.map((r) => r.price!)),
  };

  if (rows.some((r) => r.included && !r.usableAsPriceBasis)) limitations.push("Căn pending/active/thiếu giá sold chỉ dùng tham khảo, không vào khoảng giá.");
  if (!subject.sqft) limitations.push("Subject thiếu diện tích.");
  if (rows.some((r) => r.distanceMiles === null)) limitations.push("Một số căn thiếu tọa độ — không tính được khoảng cách.");

  let range: CompResult["range"] = null;
  let rangeBlockedReason: string | null = null;
  if (!rules) rangeBlockedReason = "Chưa có bộ quy tắc comps đã duyệt — chỉ hiển thị số liệu khách quan, không đưa ra khoảng giá.";
  else if (!rules.range.method) rangeBlockedReason = "Quy tắc chưa chọn cách tính khoảng giá.";
  else if (soldIncl.length < rules.selection.minComps) rangeBlockedReason = `Cần ít nhất ${rules.selection.minComps} comp sold được chọn (hiện có ${soldIncl.length}).`;
  else {
    const adj = soldIncl.map((r) => r.adjustedPrice!).sort((a, b) => a - b);
    const notConfigured = soldIncl.some((r) => r.adjustments.some((l) => l.amount === null));
    if (notConfigured) limitations.push("Một số khoản điều chỉnh chưa cấu hình hoặc thiếu dữ liệu — tính là $0.");
    const to = rules.range.roundTo;
    if (rules.range.method === "min_max_adjusted") range = { low: round(adj[0], to), high: round(adj[adj.length - 1], to), method: "Thấp nhất – cao nhất sau điều chỉnh", basis: `${adj.length} comp sold` };
    else if (rules.range.method === "median_pct") {
      if (rules.range.pct === null) rangeBlockedReason = "Cách 'trung vị ± %' cần nhập %.";
      else {
        const m = median(adj)!;
        range = { low: round(m * (1 - rules.range.pct / 100), to), high: round(m * (1 + rules.range.pct / 100), to), method: `Trung vị sau điều chỉnh ± ${rules.range.pct}%`, basis: `trung vị $${Math.round(m).toLocaleString()}` };
      }
    } else {
      const cut = Math.floor(adj.length / 6);
      const mid = adj.slice(cut, adj.length - cut);
      range = { low: round(mid[0], to), high: round(mid[mid.length - 1], to), method: "Khoảng giữa (bỏ 1/6 mỗi đầu)", basis: `${mid.length}/${adj.length} comp` };
    }
  }
  return { rows, stats, range, rangeBlockedReason, limitations, ruleVersion };
}
