import type { Property } from "@prisma/client";

// Nhận định tiềm năng DEAL — tách riêng khỏi mức phù hợp, chỉ dựa trên dữ liệu đã có.
export type DealInsight = {
  verdict: "insufficient_data" | "observations";
  observations: string[];
  basis: string | null;
  limitations: string[];
};

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** `soldPool`: các căn có giá SOLD đã xác minh (không phải ước tính/giá chào). */
export function dealInsight(p: Property, soldPool: Property[], now = new Date()): DealInsight {
  const limitations: string[] = [];
  const observations: string[] = [];
  const price = p.listPrice;
  if (p.status === "sold") return { verdict: "insufficient_data", observations: [], basis: null, limitations: ["Căn này đã bán — không đánh giá deal."] };
  if (!price) limitations.push("Không có giá chào bán.");
  if (!p.sqft) limitations.push("Không có diện tích.");
  const cutoff = now.getTime() - 180 * 86_400_000;
  const comps = soldPool.filter(
    (s) => s.id !== p.id && s.status === "sold" && s.soldPrice && s.sqft && s.soldDate && s.soldDate.getTime() >= cutoff && s.zip && s.zip === p.zip && (!p.propertyType || s.propertyType === p.propertyType),
  );
  if (comps.length < 3) limitations.push(`Chỉ có ${comps.length} căn đã bán cùng ZIP/loại nhà trong 180 ngày (cần ≥ 3).`);
  let basis: string | null = null;
  if (price && p.sqft && comps.length >= 3) {
    const med = median(comps.map((c) => c.soldPrice! / c.sqft!))!;
    const ppsf = price / p.sqft;
    const diff = ((ppsf - med) / med) * 100;
    basis = `${comps.length} căn sold cùng ZIP ${p.zip} trong 180 ngày, trung vị $${med.toFixed(0)}/sqft`;
    observations.push(`Giá chào bán $${ppsf.toFixed(0)}/sqft, ${diff >= 0 ? "cao hơn" : "thấp hơn"} trung vị sold ${Math.abs(diff).toFixed(1)}%.`);
    limitations.push("So sánh $/sqft thô — chưa điều chỉnh tình trạng, lot, remodel, vị trí cụ thể.");
  }
  if (p.daysOnMarket !== null) observations.push(`${p.daysOnMarket} ngày trên thị trường.`);
  if (p.priceReduced) observations.push("Đã giảm giá.");
  if (p.estimatePrice && price) {
    observations.push(`Ước tính tự động${p.estimateSource ? ` (${p.estimateSource})` : ""}: $${p.estimatePrice.toLocaleString()} — chỉ tham khảo, không phải giá sold.`);
  }
  const verdict = basis ? "observations" : "insufficient_data";
  return { verdict, observations, basis, limitations };
}
