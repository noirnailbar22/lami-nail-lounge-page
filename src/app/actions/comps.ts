"use server";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { CompRulesSchema } from "@/lib/comps/rules";
import { proposeFromExamples, ExampleCompSchema, ExampleSubjectSchema } from "@/lib/comps/propose";
import { activeRuleSet, computeReport } from "@/lib/comps/service";

const json = (v: unknown) => v as Prisma.InputJsonValue;

export async function createReportAction(subjectId: string, compIds: string[], title?: string) {
  return run(async () => {
    const subject = await db.property.findUniqueOrThrow({ where: { id: subjectId } });
    const rs = await activeRuleSet();
    const r = await db.compReport.create({
      data: {
        title: title || `Comps — ${subject.address}`,
        subjectId,
        selections: json(compIds.filter((id) => id !== subjectId).map((propertyId) => ({ propertyId, included: true }))),
        ruleSetId: rs?.id ?? null,
        ruleVersion: rs?.version ?? null,
        isDemo: subject.isDemo,
      },
    });
    await logAction({ action: "comps.create", entityType: "CompReport", entityId: r.id, details: { ruleVersion: rs?.version ?? null } });
    return { id: r.id };
  });
}

const SelSchema = z.array(
  z.object({
    propertyId: z.string(),
    included: z.boolean(),
    excludeReason: z.string().max(500).nullable().optional(),
    overrides: z.record(z.string(), z.number()).optional(),
    custom: z.array(z.object({ label: z.string().max(100), amount: z.number() })).optional(),
  }),
);

export async function saveSelectionsAction(reportId: string, selections: unknown, notes?: string) {
  return run(async () => {
    const sel = SelSchema.parse(selections);
    await db.compReport.update({ where: { id: reportId }, data: { selections: json(sel), notes: notes ?? undefined } });
    const result = await computeReport(reportId);
    await db.compReport.update({ where: { id: reportId }, data: { result: json(result) } });
    await logAction({ action: "comps.update", entityType: "CompReport", entityId: reportId });
    revalidatePath(`/comps/${reportId}`);
    return result;
  }, "Đã lưu và tính lại");
}

export async function applyActiveRulesAction(reportId: string) {
  return run(async () => {
    const rs = await activeRuleSet();
    await db.compReport.update({ where: { id: reportId }, data: { ruleSetId: rs?.id ?? null, ruleVersion: rs?.version ?? null } });
    const result = await computeReport(reportId);
    await db.compReport.update({ where: { id: reportId }, data: { result: json(result) } });
    revalidatePath(`/comps/${reportId}`);
  }, "Đã áp dụng bộ quy tắc hiện hành");
}

export async function saveRuleSetAction(name: string, rules: unknown, activate: boolean, rationale?: string, origin: "manual" | "from_examples" = "manual") {
  return run(async () => {
    const parsed = CompRulesSchema.parse(rules);
    const row = await db.$transaction(async (tx) => {
      const last = await tx.compRuleSet.findFirst({ orderBy: { version: "desc" } });
      if (activate) await tx.compRuleSet.updateMany({ where: { status: "active" }, data: { status: "archived" } });
      return tx.compRuleSet.create({
        data: { version: (last?.version ?? 0) + 1, name: z.string().min(1).max(120).parse(name), rules: json(parsed), status: activate ? "active" : "proposed", rationale, origin, approvedAt: activate ? new Date() : null },
      });
    });
    await logAction({ action: activate ? "comps.rules_activate" : "comps.rules_propose", entityType: "CompRuleSet", entityId: row.id, details: { version: row.version } });
    revalidatePath("/comps/rules");
    return { version: row.version };
  }, activate ? "Đã lưu và kích hoạt bộ quy tắc" : "Đã lưu dưới dạng đề xuất (chưa áp dụng)");
}

export async function approveRuleSetAction(id: string) {
  return run(async () => {
    await db.$transaction(async (tx) => {
      await tx.compRuleSet.updateMany({ where: { status: "active" }, data: { status: "archived" } });
      await tx.compRuleSet.update({ where: { id }, data: { status: "active", approvedAt: new Date() } });
    });
    await logAction({ action: "comps.rules_approve", entityType: "CompRuleSet", entityId: id });
    revalidatePath("/comps/rules");
  }, "Đã duyệt — đây là bộ quy tắc chính thức");
}

const ExampleSchema = z.object({
  title: z.string().min(1).max(200),
  subject: ExampleSubjectSchema,
  comps: z.array(ExampleCompSchema).min(1),
  finalLow: z.number().int().nullable(),
  finalHigh: z.number().int().nullable(),
  notes: z.string().max(5000).nullable(),
});

export async function addExampleAction(input: z.input<typeof ExampleSchema>) {
  return run(async () => {
    const e = ExampleSchema.parse(input);
    const row = await db.compExample.create({ data: { ...e, subject: json(e.subject), comps: json(e.comps) } });
    await logAction({ action: "comps.example_add", entityType: "CompExample", entityId: row.id });
    revalidatePath("/comps/rules");
  }, "Đã lưu ví dụ");
}

export async function proposeRulesAction() {
  return run(async () => {
    const ex = await db.compExample.findMany();
    if (!ex.length) throw new Error("Chưa có ví dụ nào.");
    const p = proposeFromExamples(ex);
    const r = await saveRuleSetAction(`Đề xuất từ ${ex.length} ví dụ`, p.rules, false, [...p.rationale, ...p.caveats.map((c) => "⚠ " + c)].join("\n"), "from_examples");
    if (!r.ok) throw new Error(r.error);
    return p;
  }, "Đã tạo đề xuất — xem lại và duyệt nếu đúng");
}
