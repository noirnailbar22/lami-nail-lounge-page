"use server";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { importPropertyCsv } from "@/lib/properties/import";
import { parseQuery } from "@/lib/properties/search";
import { computeFit } from "@/lib/properties/fit";
import { SearchFiltersSchema } from "@/lib/properties/filters";

export async function parseQueryAction(text: string, clientId?: string | null) {
  return run(async () => {
    const t = z.string().min(3).max(2000).parse(text);
    const r = await parseQuery(t);
    await db.searchRequest.create({ data: { rawText: t, filters: r.filters as Prisma.InputJsonValue, parser: r.parser, warnings: r.warnings as Prisma.InputJsonValue, clientId: clientId || null } });
    return r;
  });
}

export async function importCsvAction(text: string, fileName: string) {
  return run(async () => {
    if (text.length > 5_000_000) throw new Error("File quá lớn (tối đa 5MB).");
    const r = await importPropertyCsv(text, z.string().max(200).parse(fileName));
    revalidatePath("/properties");
    return r;
  });
}

const ManualSchema = z.object({
  address: z.string().min(3),
  city: z.string().nullable(),
  zip: z.string().nullable(),
  status: z.enum(["active", "pending", "sold", "off_market", "unknown"]),
  listPrice: z.number().int().positive().nullable(),
  soldPrice: z.number().int().positive().nullable(),
  soldDate: z.string().nullable(),
  beds: z.number().nullable(),
  baths: z.number().nullable(),
  sqft: z.number().int().positive().nullable(),
  yearBuilt: z.number().int().nullable(),
  sourceUrl: z.string().url().nullable(),
  sourceLabel: z.enum(["manual", "link"]),
  note: z.string().nullable(),
});

export async function addManualPropertyAction(input: z.input<typeof ManualSchema>) {
  return run(async () => {
    const p = ManualSchema.parse(input);
    if (p.status === "sold" && !p.soldPrice) throw new Error("Nhà sold cần giá sold đã xác minh (hoặc chọn trạng thái khác).");
    const row = await db.property.create({
      data: {
        source: p.sourceLabel, sourceUrl: p.sourceUrl, sourceRef: p.sourceLabel === "link" ? "Link tham chiếu — dữ liệu nhập tay" : "Nhập tay",
        address: p.address, city: p.city, zip: p.zip, status: p.status, listPrice: p.listPrice, soldPrice: p.soldPrice,
        soldDate: p.soldDate ? new Date(p.soldDate) : null, beds: p.beds, baths: p.baths, sqft: p.sqft, yearBuilt: p.yearBuilt, description: p.note,
      },
    });
    await logAction({ action: "property.add_manual", entityType: "Property", entityId: row.id });
    revalidatePath("/properties");
    return { id: row.id };
  }, "Đã thêm nhà");
}

export async function saveToClientAction(clientId: string, propertyId: string, filters: unknown, note?: string) {
  return run(async () => {
    const p = await db.property.findUniqueOrThrow({ where: { id: propertyId } });
    const fit = computeFit(p, SearchFiltersSchema.parse(filters ?? {}));
    await db.savedProperty.upsert({
      where: { clientId_propertyId: { clientId, propertyId } },
      create: { clientId, propertyId, note: note ?? null, fit: fit as unknown as Prisma.InputJsonValue },
      update: { note: note ?? undefined, fit: fit as unknown as Prisma.InputJsonValue },
    });
    await logAction({ action: "property.save_to_client", entityType: "Client", entityId: clientId, details: { propertyId } });
    revalidatePath(`/clients/${clientId}`);
  }, "Đã lưu nhà vào khách");
}

export async function unsaveAction(savedId: string) {
  return run(async () => {
    const s = await db.savedProperty.delete({ where: { id: savedId } });
    revalidatePath(`/clients/${s.clientId}`);
  }, "Đã bỏ lưu");
}

export async function searchAction(filters: unknown, opts: { includeSold?: boolean } = {}) {
  return run(async () => {
    const { filtersToWhere, missingFields } = await import("@/lib/properties/search");
    const { dealInsight } = await import("@/lib/properties/deal");
    const f = SearchFiltersSchema.parse(filters ?? {});
    const rows = await db.property.findMany({ where: filtersToWhere(f, opts.includeSold), take: 300, orderBy: { updatedAt: "desc" } });
    const zips = [...new Set(rows.map((r) => r.zip).filter(Boolean))] as string[];
    const soldPool = await db.property.findMany({ where: { status: "sold", soldPrice: { not: null }, zip: { in: zips } } });
    const results = rows
      .map((p) => ({ p, fit: computeFit(p, f) }))
      .filter((x) => !x.fit.mustFail)
      .sort((a, b) => (b.fit.score ?? -1) - (a.fit.score ?? -1))
      .slice(0, 50)
      .map(({ p, fit }) => ({
        id: p.id,
        address: p.address,
        city: p.city,
        zip: p.zip,
        status: p.status,
        listPrice: p.listPrice,
        soldPrice: p.soldPrice,
        estimatePrice: p.estimatePrice,
        estimateSource: p.estimateSource,
        beds: p.beds,
        baths: p.baths,
        sqft: p.sqft,
        yearBuilt: p.yearBuilt,
        sourceUrl: p.sourceUrl,
        source: `${p.source}${p.sourceRef ? ` · ${p.sourceRef}` : ""}`,
        fetchedAt: p.fetchedAt.toISOString(),
        isDemo: p.isDemo,
        missing: missingFields(p),
        conflicts: ((p.conflicts as { field: string }[]) ?? []).map((c) => c.field),
        fit,
        deal: dealInsight(p, soldPool),
      }));
    return { results, total: rows.length };
  });
}
