import { describe, expect, it } from "vitest";
import { computeComps } from "@/lib/comps/compute";
import { CompRulesSchema } from "@/lib/comps/rules";
import { proposeFromExamples } from "@/lib/comps/propose";
import { prop } from "./fixtures";

const now = new Date("2026-10-26T00:00:00Z");
const subject = prop({ id: "s", sqft: 2000, beds: 4, baths: 2.5, garageSpaces: 2, pool: false, yearBuilt: 2012, lat: 30.44, lng: -97.62, status: "active" });
const sold = (id: string, p: Partial<Parameters<typeof prop>[0]>) => prop({ id, status: "sold", soldDate: new Date("2026-08-26T00:00:00Z"), lat: 30.441, lng: -97.621, ...p });

const comps = [
  sold("a", { soldPrice: 400000, sqft: 1900, beds: 4, baths: 2.5, garageSpaces: 2, pool: false, yearBuilt: 2010 }),
  sold("b", { soldPrice: 430000, sqft: 2100, beds: 4, baths: 3, garageSpaces: 2, pool: true, yearBuilt: 2012 }),
  sold("c", { soldPrice: 415000, sqft: 2000, beds: 3, baths: 2.5, garageSpaces: 1, pool: false, yearBuilt: 2015 }),
  prop({ id: "p", status: "pending", listPrice: 450000, pendingPrice: null }),
  prop({ id: "l", status: "active", listPrice: 470000, estimatePrice: 455000 }),
];
const inputs = comps.map((property) => ({ property, included: true }));

describe("computeComps — chưa có phương pháp", () => {
  const r = computeComps(subject, inputs, null, null, now);
  it("không tạo khoảng giá", () => {
    expect(r.range).toBeNull();
    expect(r.rangeBlockedReason).toMatch(/Chưa có bộ quy tắc/);
  });
  it("số liệu khách quan chỉ từ giá sold", () => {
    expect(r.stats.soldCount).toBe(3);
    expect(r.stats.soldPriceMedian).toBe(415000);
    expect(r.stats.soldPriceMax).toBe(430000);
    expect(r.stats.pendingCount).toBe(1);
    expect(r.stats.activeCount).toBe(1);
  });
  it("pending / giá chào / ước tính không bao giờ là cơ sở giá", () => {
    expect(r.rows.find((x) => x.id === "p")!.usableAsPriceBasis).toBe(false);
    expect(r.rows.find((x) => x.id === "l")!.usableAsPriceBasis).toBe(false);
    expect(r.rows.find((x) => x.id === "l")!.priceType).toBe("list");
  });
  it("không có điều chỉnh khi chưa có quy tắc", () => expect(r.rows.every((x) => x.adjustments.length === 0)).toBe(true));
});

describe("computeComps — theo quy tắc cấu hình", () => {
  const rules = CompRulesSchema.parse({
    selection: { maxDistanceMiles: 1, soldWithinMonths: 6, minComps: 3 },
    adjustments: { perSqft: 50, perBath: 5000, perGarageSpace: 8000, pool: 15000, perYearAge: 1000, timePctPerMonth: 0.5 },
    range: { method: "min_max_adjusted", roundTo: 1000 },
  });
  const r = computeComps(subject, inputs, rules, 7, now);
  const row = (id: string) => r.rows.find((x) => x.id === id)!;
  const amt = (id: string, key: string) => row(id).adjustments.find((a) => a.key === key)!.amount;

  it("điều chỉnh đúng hệ số và hướng (comp → subject)", () => {
    expect(amt("a", "perSqft")).toBe(5000); // +100 sqft × 50
    expect(amt("a", "perYearAge")).toBe(2000); // subject mới hơn 2 năm
    expect(amt("b", "perSqft")).toBe(-5000);
    expect(amt("b", "perBath")).toBe(-2500); // 2.5 vs 3
    expect(amt("b", "pool")).toBe(-15000); // comp có hồ bơi, subject không
    expect(amt("c", "perGarageSpace")).toBe(8000);
  });
  it("hệ số chưa cấu hình → không áp dụng (null), không tự bịa", () => {
    expect(amt("c", "perBed")).toBeNull();
    expect(row("c").adjustments.find((a) => a.key === "perBed")!.note).toMatch(/Chưa cấu hình/);
  });
  it("điều chỉnh thời gian theo % / tháng", () => {
    const months = row("a").monthsSinceSale!;
    expect(amt("a", "time")).toBe(Math.round(400000 * 0.005 * ((now.getTime() - new Date("2026-08-26T00:00:00Z").getTime()) / (30.4375 * 86400000))));
    expect(months).toBeCloseTo(2, 0);
  });
  it("giá sau điều chỉnh = sold + tổng điều chỉnh, khoảng giá theo cách đã chọn và ghi phiên bản quy tắc", () => {
    for (const id of ["a", "b", "c"]) expect(row(id).adjustedPrice).toBe(comps.find((c) => c.id === id)!.soldPrice! + row(id).netAdjustment!);
    const adj = ["a", "b", "c"].map((id) => row(id).adjustedPrice!);
    expect(r.range).toMatchObject({ low: Math.round(Math.min(...adj) / 1000) * 1000, high: Math.round(Math.max(...adj) / 1000) * 1000 });
    expect(r.ruleVersion).toBe(7);
  });
  it("ghi đè tay được tôn trọng", () => {
    const r2 = computeComps(subject, inputs.map((i) => (i.property.id === "a" ? { ...i, overrides: { perSqft: 1234 } } : i)), rules, 7, now);
    expect(r2.rows.find((x) => x.id === "a")!.adjustments.find((a) => a.key === "perSqft")).toMatchObject({ amount: 1234, overridden: true });
  });
  it("loại comp → không tính vào khoảng giá; không đủ comp → không đưa khoảng giá", () => {
    const r3 = computeComps(subject, inputs.map((i) => (i.property.id === "a" ? { ...i, included: false } : i)), rules, 7, now);
    expect(r3.range).toBeNull();
    expect(r3.rangeBlockedReason).toMatch(/ít nhất 3/);
  });
  it("gắn cờ comp vi phạm điều kiện chọn", () => {
    const far = sold("far", { soldPrice: 420000, sqft: 2000, lat: 30.6, lng: -97.9 });
    const r4 = computeComps(subject, [{ property: far, included: true }], rules, 7, now);
    expect(r4.rows[0].ruleFlags.join(" ")).toMatch(/> 1 mi/);
  });
  it("median_pct cần % — thiếu thì không tạo khoảng", () => {
    const r5 = computeComps(subject, inputs, { ...rules, range: { method: "median_pct", pct: null, roundTo: 1000 } }, 7, now);
    expect(r5.range).toBeNull();
  });
});

describe("đề xuất quy tắc từ ví dụ", () => {
  it("rút khoảng cách, thời gian, hệ số — kèm cảnh báo khi ít ví dụ", () => {
    const p = proposeFromExamples([
      { subject: {}, finalLow: 1, finalHigh: 2, comps: [
        { address: "A", selected: true, distanceMiles: 0.4, monthsSinceSale: 2, adjustments: [{ label: "sqft", amount: 5000, unitDiff: 50 }] },
        { address: "B", selected: true, distanceMiles: 0.8, monthsSinceSale: 4, adjustments: [{ label: "sqft", amount: -10000, unitDiff: -100 }] },
        { address: "C", selected: false, reason: "quá xa", distanceMiles: 1.6 },
      ] },
    ]);
    expect(p.rules.selection.maxDistanceMiles).toBe(1);
    expect(p.rules.selection.soldWithinMonths).toBe(4);
    expect(p.rules.adjustments.perSqft).toBe(100);
    expect(p.rules.range.method).toBeNull();
    expect(p.caveats.join(" ")).toMatch(/độ tin cậy thấp/);
  });
});
