import Link from "next/link";
import { db } from "@/lib/db";
import { activeRuleSet } from "@/lib/comps/service";
import { DemoTag, PageHeader, fmtDateTime } from "@/components/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewCompReport } from "@/components/comps-new";

export const dynamic = "force-dynamic";

export default async function CompsPage() {
  const reports = await db.compReport.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });
  const props = await db.property.findMany({
    select: { id: true, address: true, city: true, zip: true, status: true, soldPrice: true, soldDate: true, listPrice: true, sqft: true, lat: true, lng: true, propertyType: true, isDemo: true },
    orderBy: { address: "asc" },
    take: 2000,
  });
  const rs = await activeRuleSet();
  return (
    <div className="space-y-4">
      <PageHeader title="Comps" desc={rs ? `Bộ quy tắc đang dùng: v${rs.version} — ${rs.name}` : "Chưa có bộ quy tắc được duyệt: báo cáo chỉ hiển thị số liệu khách quan, không đưa khoảng giá."}>
        <Link href="/comps/rules" className="rounded-md border px-3 py-2 text-sm">Quy tắc run comps</Link>
      </PageHeader>
      <Card>
        <CardHeader><CardTitle>Tạo báo cáo mới</CardTitle></CardHeader>
        <CardContent>
          <NewCompReport props={props.map((p) => ({ ...p, soldDate: p.soldDate?.toISOString() ?? null }))} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Báo cáo</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {reports.map((r) => (
              <li key={r.id} className="py-2 flex justify-between gap-2">
                <Link href={`/comps/${r.id}`} className="hover:underline"><DemoTag show={r.isDemo} /> {r.title}</Link>
                <span className="text-xs text-muted-foreground">{r.ruleVersion ? `Quy tắc v${r.ruleVersion}` : "Khách quan"} · {fmtDateTime(r.updatedAt)}</span>
              </li>
            ))}
          </ul>
          {reports.length === 0 && <p className="text-sm text-muted-foreground">Chưa có báo cáo.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
