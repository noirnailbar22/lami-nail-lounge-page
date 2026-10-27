import Papa from "papaparse";
import { z } from "zod";

// Nhập listing/comps từ CSV mà người dùng được phép sử dụng (vd. export từ MLS theo quyền của họ).
export const CSV_COLUMNS = [
  "address", "city", "state", "zip", "subdivision", "lat", "lng", "property_type", "status",
  "list_price", "list_date", "pending_price", "sold_price", "sold_date", "estimate_price", "estimate_source",
  "beds", "baths", "sqft", "lot_sqft", "year_built", "garage_spaces", "pool", "stories", "condition",
  "remodeled", "remodel_year", "hoa_monthly", "days_on_market", "price_reduced", "url", "mls_number", "description",
] as const;

const money = z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(/[$,\s]/g, ""))), z.number().int().nonnegative().nullable());
const numOpt = z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(/,/g, ""))), z.number().nullable());
const intOpt = z.preprocess((v) => (v === "" || v == null ? null : Math.round(Number(String(v).replace(/,/g, "")))), z.number().int().nullable());
const boolOpt = z.preprocess((v) => {
  if (v === "" || v == null) return null;
  const s = String(v).trim().toLowerCase();
  return ["y", "yes", "true", "1", "x"].includes(s) ? true : ["n", "no", "false", "0"].includes(s) ? false : null;
}, z.boolean().nullable());
const dateOpt = z.preprocess((v) => {
  if (v === "" || v == null) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}, z.date().nullable());
const strOpt = z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().nullable());

const TYPE_MAP: Record<string, string> = {
  "single family": "single_family", sfr: "single_family", single_family: "single_family", house: "single_family", residential: "single_family",
  condo: "condo", condominium: "condo", townhome: "townhome", townhouse: "townhome", duplex: "multi_family", "multi family": "multi_family", multi_family: "multi_family", land: "land", lot: "land",
};
const STATUS_MAP: Record<string, string> = {
  active: "active", "for sale": "active", "coming soon": "active", pending: "pending", "under contract": "pending", "active under contract": "pending",
  sold: "sold", closed: "sold", withdrawn: "off_market", expired: "off_market", "off market": "off_market",
};

export const CsvRowSchema = z.object({
  address: z.string().trim().min(3, "thiếu địa chỉ"),
  city: strOpt, state: strOpt, zip: strOpt, subdivision: strOpt, lat: numOpt, lng: numOpt,
  property_type: z.preprocess((v) => (v ? TYPE_MAP[String(v).trim().toLowerCase()] ?? null : null), z.string().nullable()),
  status: z.preprocess((v) => (v ? STATUS_MAP[String(v).trim().toLowerCase()] ?? "unknown" : null), z.string().nullable()),
  list_price: money, list_date: dateOpt, pending_price: money, sold_price: money, sold_date: dateOpt,
  estimate_price: money, estimate_source: strOpt,
  beds: numOpt, baths: numOpt, sqft: intOpt, lot_sqft: intOpt, year_built: intOpt, garage_spaces: intOpt,
  pool: boolOpt, stories: intOpt,
  condition: z.preprocess((v) => (v ? String(v).trim().toLowerCase() : null), z.enum(["poor", "fair", "average", "good", "excellent"]).nullable().catch(null)),
  remodeled: boolOpt, remodel_year: intOpt, hoa_monthly: money, days_on_market: intOpt, price_reduced: boolOpt,
  url: z.preprocess((v) => (v ? String(v).trim() : null), z.string().url().nullable().catch(null)),
  mls_number: strOpt, description: strOpt,
});
export type CsvRow = z.infer<typeof CsvRowSchema>;

export type ParsedCsv = { rows: { line: number; row: CsvRow; warnings: string[] }[]; errors: { line: number; message: string }[]; unknownColumns: string[] };

export function parsePropertyCsv(text: string): ParsedCsv {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_") });
  const known = new Set<string>(CSV_COLUMNS);
  const unknownColumns = (res.meta.fields ?? []).filter((f) => !known.has(f));
  const out: ParsedCsv = { rows: [], errors: [], unknownColumns };
  res.data.forEach((raw, i) => {
    const line = i + 2;
    const p = CsvRowSchema.safeParse(raw);
    if (!p.success) {
      out.errors.push({ line, message: p.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
      return;
    }
    const r = p.data;
    const warnings: string[] = [];
    if (r.status === "sold" && !r.sold_price) warnings.push("Trạng thái sold nhưng không có giá sold — không dùng làm comp có giá.");
    if (r.status === "sold" && !r.sold_date) warnings.push("Sold nhưng thiếu ngày bán.");
    if (r.sold_price && r.status && r.status !== "sold") warnings.push(`Có giá sold nhưng trạng thái là "${r.status}" — nguồn xung đột.`);
    if (r.estimate_price && !r.estimate_source) warnings.push("Có giá ước tính nhưng thiếu nguồn ước tính.");
    out.rows.push({ line, row: r, warnings });
  });
  return out;
}

export const normalizeAddress = (a: string) =>
  a.toLowerCase().replace(/[.,#]/g, " ").replace(/\b(street)\b/g, "st").replace(/\b(drive)\b/g, "dr").replace(/\b(avenue)\b/g, "ave").replace(/\b(lane)\b/g, "ln").replace(/\b(road)\b/g, "rd").replace(/\s+/g, " ").trim();
