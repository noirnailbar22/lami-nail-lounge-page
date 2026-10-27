import type { Prisma, Property } from "@prisma/client";
import { z } from "zod";
import { aiEnabled } from "../env";
import { aiJson, dataBlock } from "../ai/client";
import { fairHousingFlags } from "./fairhousing";
import { emptyFilters, FEATURE_KEYS, PROPERTY_TYPES, PURPOSES, SearchFiltersSchema, type SearchFilters } from "./filters";

const KNOWN_AREAS = ["Austin", "Round Rock", "Pflugerville", "Cedar Park", "Leander", "Georgetown", "Hutto", "Manor", "Kyle", "Buda", "Lakeway", "Bee Cave", "Dripping Springs", "Liberty Hill", "Del Valle", "Elgin", "Taylor", "San Marcos"];

function money(s: string): number {
  const m = s.toLowerCase().replace(/[$,\s]/g, "");
  const n = parseFloat(m);
  if (m.endsWith("m")) return Math.round(n * 1_000_000);
  if (m.endsWith("k")) return Math.round(n * 1000);
  return Math.round(n);
}

/** Bộ phân tích theo quy tắc (dùng khi chưa có AI). */
export function parseQueryRules(text: string): SearchFilters {
  const f = emptyFilters();
  const t = text.toLowerCase();
  const range = t.match(/\$?\s?(\d[\d,.]*\s?[km]?)\s?(?:-|–|to|đến)\s?\$?\s?(\d[\d,.]*\s?[km]?)/);
  if (range) {
    f.budgetMin = money(range[1]);
    f.budgetMax = money(range[2]);
  } else {
    const max = t.match(/(?:under|below|max|up to|dưới|tối đa|<)\s?\$?\s?(\d[\d,.]*\s?[km]?)/);
    if (max) f.budgetMax = money(max[1]);
    const min = t.match(/(?:over|above|at least|min|trên|ít nhất)\s?\$?\s?(\d[\d,.]*\s?[km]?)/);
    if (min && !/sqft|sf|ft/.test(t.slice(t.indexOf(min[0]), t.indexOf(min[0]) + min[0].length + 6))) f.budgetMin = money(min[1]);
  }
  const beds = t.match(/(\d+(?:\.\d)?)\s*\+?\s*(?:bed|bd|br|pn|phòng ngủ)/);
  if (beds) f.bedsMin = Number(beds[1]);
  const baths = t.match(/(\d+(?:\.\d)?)\s*\+?\s*(?:bath|ba|wc|phòng tắm)/);
  if (baths) f.bathsMin = Number(baths[1]);
  const sqft = t.match(/(\d[\d,]*)\s*\+?\s*(?:sqft|sq ?ft|sf|square feet)/);
  if (sqft) f.sqftMin = Number(sqft[1].replace(/,/g, ""));
  f.areas = KNOWN_AREAS.filter((a) => t.includes(a.toLowerCase()));
  f.zips = [...new Set(t.match(/\b78\d{3}\b/g) ?? [])];
  if (/condo/.test(t)) f.propertyTypes.push("condo");
  if (/town ?(home|house)/.test(t)) f.propertyTypes.push("townhome");
  if (/single[- ]family|house\b|nhà riêng/.test(t)) f.propertyTypes.push("single_family");
  if (/duplex|multi[- ]family|fourplex|triplex/.test(t)) f.propertyTypes.push("multi_family");
  if (/invest|rental|cho thuê|đầu tư/.test(t)) f.purpose = "investment";
  else if (/first[- ]time|first home|lần đầu/.test(t)) f.purpose = "first_home";
  else if (/relocat/.test(t)) f.purpose = "relocation";
  else if (/downsiz/.test(t)) f.purpose = "downsizing";
  const want = (k: (typeof FEATURE_KEYS)[number], re: RegExp) => {
    const m = t.match(re);
    if (!m) return;
    // Chỉ xét trong cùng mệnh đề (tách bởi dấu phẩy/chấm) để "must" của ý trước không lan sang.
    const start = Math.max(t.lastIndexOf(",", m.index), t.lastIndexOf(".", m.index), t.lastIndexOf(";", m.index), 0);
    const clause = t.slice(start, (m.index ?? 0) + m[0].length + 30).split(/[,.;]/).slice(0, 2).join(" ");
    (/(must|need|required|bắt buộc|phải có)/.test(clause) ? f.mustHave : f.niceToHave).push(k);
  };
  want("pool", /pool|hồ bơi/);
  want("garage", /garage/);
  want("single_story", /single[- ]story|one[- ]story|1[- ]story|một tầng|1 tầng/);
  want("no_hoa", /no hoa|without hoa|không hoa/);
  want("remodeled", /remodel|updated|renovated/);
  want("large_lot", /big (yard|lot|backyard)|large (yard|lot)|sân rộng/);
  want("new_construction", /new construction|new build|nhà mới xây/);
  return SearchFiltersSchema.parse(f);
}

const AiFiltersSchema = z.object({
  budgetMin: z.number().int().nullable(),
  budgetMax: z.number().int().nullable(),
  areas: z.array(z.string()),
  zips: z.array(z.string()),
  propertyTypes: z.array(z.enum(PROPERTY_TYPES)),
  bedsMin: z.number().nullable(),
  bathsMin: z.number().nullable(),
  sqftMin: z.number().int().nullable(),
  sqftMax: z.number().int().nullable(),
  purpose: z.enum(PURPOSES).nullable(),
  mustHave: z.array(z.enum(FEATURE_KEYS)),
  niceToHave: z.array(z.enum(FEATURE_KEYS)),
  otherNotes: z.array(z.string()),
});

export async function parseQuery(text: string): Promise<{ filters: SearchFilters; parser: "ai" | "demo_rules"; warnings: string[] }> {
  const warnings = fairHousingFlags(text);
  if (!aiEnabled()) return { filters: parseQueryRules(text), parser: "demo_rules", warnings };
  const r = await aiJson({
    schema: AiFiltersSchema,
    effort: "low",
    maxTokens: 3000,
    system: `Chuyển yêu cầu tìm nhà thành bộ lọc khách quan cho thị trường Austin, TX.
- Chỉ điền những gì người dùng nói rõ; không đoán ngân sách hay số phòng.
- KHÔNG BAO GIỜ chuyển đặc điểm nhóm được bảo vệ hoặc proxy (chủng tộc, tôn giáo, gia đình có trẻ em, "khu an toàn", "khu tốt", nhân khẩu học...) thành bộ lọc; ghi lý do vào otherNotes.
- Yêu cầu không ánh xạ được (vd. "gần chỗ làm ở Domain") ghi vào otherNotes.`,
    user: dataBlock("search_request", text),
  });
  return { filters: SearchFiltersSchema.parse(r), parser: "ai", warnings };
}

/** Lọc thô trong DB theo tiêu chí bắt buộc rõ ràng; phần còn lại xếp hạng bằng computeFit. */
export function filtersToWhere(f: SearchFilters, includeSold = false): Prisma.PropertyWhereInput {
  const and: Prisma.PropertyWhereInput[] = [];
  if (!includeSold) and.push({ OR: [{ status: { in: ["active", "pending", "unknown"] } }, { status: null }] });
  if (f.budgetMax !== null) and.push({ OR: [{ listPrice: { lte: f.budgetMax } }, { listPrice: null }] });
  if (f.budgetMin !== null) and.push({ OR: [{ listPrice: { gte: f.budgetMin } }, { listPrice: null }] });
  if (f.areas.length) and.push({ OR: [{ city: { in: f.areas, mode: "insensitive" } }, { subdivision: { in: f.areas, mode: "insensitive" } }, ...(f.zips.length ? [{ zip: { in: f.zips } }] : [])] });
  else if (f.zips.length) and.push({ zip: { in: f.zips } });
  if (f.bedsMin !== null) and.push({ OR: [{ beds: { gte: f.bedsMin } }, { beds: null }] });
  return { AND: and };
}

export function missingFields(p: Property): string[] {
  const m: string[] = [];
  if (!p.listPrice && p.status !== "sold") m.push("giá chào bán");
  if (p.status === "sold" && !p.soldPrice) m.push("giá sold");
  if (p.beds === null) m.push("phòng ngủ");
  if (p.baths === null) m.push("phòng tắm");
  if (!p.sqft) m.push("diện tích");
  if (!p.yearBuilt) m.push("năm xây");
  if (!p.status) m.push("trạng thái");
  return m;
}
