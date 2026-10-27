import { db } from "../db";
import { computeComps, type CompInput } from "./compute";
import { parseRules } from "./rules";

export async function activeRuleSet() {
  return db.compRuleSet.findFirst({ where: { status: "active" }, orderBy: { version: "desc" } });
}

type Sel = { propertyId: string; included: boolean; excludeReason?: string | null; overrides?: Record<string, number>; custom?: { label: string; amount: number }[] };

/** Tính lại báo cáo theo đúng phiên bản quy tắc đã ghi trên báo cáo. */
export async function computeReport(reportId: string) {
  const r = await db.compReport.findUniqueOrThrow({ where: { id: reportId } });
  const subject = await db.property.findUniqueOrThrow({ where: { id: r.subjectId } });
  const sels = (r.selections as Sel[]) ?? [];
  const props = await db.property.findMany({ where: { id: { in: sels.map((s) => s.propertyId) } } });
  const byId = new Map(props.map((p) => [p.id, p]));
  const inputs: CompInput[] = sels.filter((s) => byId.has(s.propertyId)).map((s) => ({ ...s, property: byId.get(s.propertyId)! }));
  const rs = r.ruleSetId ? await db.compRuleSet.findUnique({ where: { id: r.ruleSetId } }) : null;
  return computeComps(subject, inputs, rs ? parseRules(rs.rules) : null, rs?.version ?? null);
}
