import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activeRuleSet, computeReport } from "@/lib/comps/service";
import { DemoTag, PageHeader } from "@/components/bits";
import { CompsWorkspace } from "@/components/comps-workspace";

export const dynamic = "force-dynamic";

export default async function CompReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await db.compReport.findUnique({ where: { id } });
  if (!r) notFound();
  const subject = await db.property.findUniqueOrThrow({ where: { id: r.subjectId } });
  const result = await computeReport(id);
  const active = await activeRuleSet();
  return (
    <div className="space-y-4">
      <PageHeader title={r.title} desc={r.ruleVersion ? `Tính theo quy tắc v${r.ruleVersion} (phiên bản được ghi trên báo cáo)` : "Chưa áp dụng quy tắc — chỉ số liệu khách quan"}>
        <DemoTag show={r.isDemo} />
        <Link href={`/comps/${id}/print`} target="_blank" className="rounded-md border px-3 py-2 text-sm">Bản in / PDF</Link>
      </PageHeader>
      <CompsWorkspace
        reportId={id}
        subject={{ address: subject.address, city: subject.city, zip: subject.zip, beds: subject.beds, baths: subject.baths, sqft: subject.sqft, yearBuilt: subject.yearBuilt, lotSqft: subject.lotSqft, garageSpaces: subject.garageSpaces, pool: subject.pool, condition: subject.condition, status: subject.status, listPrice: subject.listPrice }}
        selections={r.selections as never}
        result={result}
        notes={r.notes ?? ""}
        reportRuleVersion={r.ruleVersion}
        activeRuleVersion={active?.version ?? null}
      />
    </div>
  );
}
