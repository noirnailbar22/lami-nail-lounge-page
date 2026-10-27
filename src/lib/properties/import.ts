import type { Prisma, Property } from "@prisma/client";
import { db } from "../db";
import { logAction } from "../audit";
import { normalizeAddress, parsePropertyCsv, type CsvRow } from "./csv";

type Conflict = { field: string; existing: unknown; incoming: unknown; incomingSource: string; at: string };

function rowToData(r: CsvRow) {
  return {
    address: r.address, city: r.city, state: r.state, zip: r.zip, subdivision: r.subdivision, lat: r.lat, lng: r.lng,
    propertyType: r.property_type, status: r.status, listPrice: r.list_price, listDate: r.list_date, pendingPrice: r.pending_price,
    soldPrice: r.sold_price, soldDate: r.sold_date, estimatePrice: r.estimate_price, estimateSource: r.estimate_source,
    beds: r.beds, baths: r.baths, sqft: r.sqft, lotSqft: r.lot_sqft, yearBuilt: r.year_built, garageSpaces: r.garage_spaces,
    pool: r.pool, stories: r.stories, condition: r.condition, remodeled: r.remodeled, remodelYear: r.remodel_year,
    hoaMonthly: r.hoa_monthly, daysOnMarket: r.days_on_market, priceReduced: r.price_reduced, sourceUrl: r.url, description: r.description,
  };
}

/**
 * Gộp bản ghi mới vào bản đã có: chỉ điền trường đang trống; trường khác giá trị được ghi
 * vào `conflicts` để người dùng xem — không ghi đè âm thầm.
 */
export function mergeProperty(existing: Property, incoming: ReturnType<typeof rowToData>, source: string) {
  const patch: Record<string, unknown> = {};
  const conflicts: Conflict[] = [];
  for (const [k, v] of Object.entries(incoming)) {
    if (v === null || v === undefined) continue;
    const cur = (existing as Record<string, unknown>)[k];
    if (cur === null || cur === undefined) patch[k] = v;
    else {
      const same = cur instanceof Date && v instanceof Date ? cur.getTime() === v.getTime() : String(cur) === String(v);
      if (!same && k !== "address") conflicts.push({ field: k, existing: cur, incoming: v, incomingSource: source, at: new Date().toISOString() });
    }
  }
  return { patch, conflicts };
}

export async function importPropertyCsv(text: string, fileName: string, opts: { isDemo?: boolean } = {}) {
  const parsed = parsePropertyCsv(text);
  let created = 0, merged = 0;
  const conflictsFound: { address: string; fields: string[] }[] = [];
  for (const { row, warnings } of parsed.rows) {
    const data = rowToData(row);
    const candidates = await db.property.findMany({ where: { zip: row.zip ?? undefined }, take: 500 });
    const existing = candidates.find((p) => normalizeAddress(p.address) === normalizeAddress(row.address));
    if (!existing) {
      await db.property.create({
        data: {
          ...data, source: "csv", sourceRef: row.mls_number ? `${fileName} · MLS# ${row.mls_number}` : fileName, isDemo: !!opts.isDemo,
          raw: { warnings } as Prisma.InputJsonValue,
        },
      });
      created++;
    } else {
      const { patch, conflicts } = mergeProperty(existing, data, fileName);
      const all = [...((existing.conflicts as Conflict[]) ?? []), ...conflicts];
      await db.property.update({ where: { id: existing.id }, data: { ...patch, conflicts: all as unknown as Prisma.InputJsonValue } });
      merged++;
      if (conflicts.length) conflictsFound.push({ address: existing.address, fields: conflicts.map((c) => c.field) });
    }
  }
  await logAction({ action: "property.import_csv", details: { fileName, created, merged, errors: parsed.errors.length, conflicts: conflictsFound.length } });
  return { created, merged, errors: parsed.errors, unknownColumns: parsed.unknownColumns, conflicts: conflictsFound, warnings: parsed.rows.filter((r) => r.warnings.length).map((r) => ({ line: r.line, warnings: r.warnings })) };
}
