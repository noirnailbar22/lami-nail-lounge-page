import { z } from "zod";
import { SearchFiltersSchema } from "../properties/filters";

// Nhu cầu của khách lưu cục bộ (FUB không có trường chuẩn cho hầu hết các mục này).
export const ClientNeedsSchema = SearchFiltersSchema.extend({
  timeline: z.string().nullable().default(null),
  preApproved: z.boolean().nullable().default(null),
  lender: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type ClientNeeds = z.infer<typeof ClientNeedsSchema>;

export function parseNeeds(v: unknown): ClientNeeds {
  const r = ClientNeedsSchema.safeParse(v ?? {});
  return r.success ? r.data : ClientNeedsSchema.parse({});
}

export function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return "$" + n.toLocaleString("en-US");
}

export function needsSummary(n: ClientNeeds): string {
  const parts: string[] = [];
  if (n.budgetMin || n.budgetMax) parts.push(`${fmtMoney(n.budgetMin)} – ${fmtMoney(n.budgetMax)}`);
  if (n.areas.length) parts.push(n.areas.join(", "));
  if (n.zips.length) parts.push("ZIP " + n.zips.join(", "));
  if (n.bedsMin) parts.push(`${n.bedsMin}+ PN`);
  if (n.bathsMin) parts.push(`${n.bathsMin}+ WC`);
  if (n.sqftMin) parts.push(`≥ ${n.sqftMin} sqft`);
  if (n.timeline) parts.push(n.timeline);
  return parts.join(" · ") || "Chưa có thông tin nhu cầu";
}
