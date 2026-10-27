import { db } from "@/lib/db";
import { PageHeader, DemoTag, ConnBadge, fmtDate } from "@/components/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CsvImport, ManualProperty } from "@/components/property-import";
import { LISTING_SOURCES } from "@/lib/properties/sources";
import { CSV_COLUMNS } from "@/lib/properties/csv";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const props = await db.property.findMany({ orderBy: { updatedAt: "desc" }, take: 300 });
  return (
    <div className="space-y-4">
      <PageHeader title="Nhập dữ liệu nhà" desc="Chỉ nhập dữ liệu bạn được phép sử dụng. App không scrape Zillow/Redfin và không vượt đăng nhập hay CAPTCHA." />
      <Card>
        <CardHeader><CardTitle>Nguồn dữ liệu</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {LISTING_SOURCES.map((s) => (
            <div key={s.id}>
              <div className="flex items-center gap-2"><ConnBadge state={s.status} /><strong>{s.name}</strong></div>
              <p className="text-muted-foreground">{s.note}</p>
              {s.needs.length > 0 && <ul className="list-disc pl-5 text-xs">{s.needs.map((n) => <li key={n}>{n}</li>)}</ul>}
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Nhập CSV</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Cột hỗ trợ: <code className="text-xs">{CSV_COLUMNS.join(", ")}</code></p>
            <p><a className="underline" href="/samples/properties-template.csv" download>Tải file mẫu trống</a> · <a className="underline" href="/samples/properties-sample.csv" download>Tải CSV demo hư cấu</a></p>
            <CsvImport />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Nhập tay / lưu link tham chiếu</CardTitle></CardHeader>
          <CardContent><ManualProperty /></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Dữ liệu đã có ({props.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Địa chỉ</TableHead><TableHead>Trạng thái</TableHead><TableHead>Giá chào</TableHead><TableHead>Giá sold</TableHead><TableHead>Ước tính (bên thứ ba)</TableHead><TableHead>Nguồn</TableHead><TableHead>Xung đột</TableHead></TableRow></TableHeader>
            <TableBody>
              {props.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.address}, {p.city} <DemoTag show={p.isDemo} /></TableCell>
                  <TableCell>{p.status ?? "?"}</TableCell>
                  <TableCell>{p.listPrice ? "$" + p.listPrice.toLocaleString() : "—"}</TableCell>
                  <TableCell>{p.soldPrice ? `$${p.soldPrice.toLocaleString()} (${fmtDate(p.soldDate)})` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.estimatePrice ? "$" + p.estimatePrice.toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-xs">{p.source} · {fmtDate(p.fetchedAt)}</TableCell>
                  <TableCell className="text-xs text-red-700">{((p.conflicts as { field: string; existing: unknown; incoming: unknown }[]) ?? []).map((c) => `${c.field}: ${String(c.existing)} ≠ ${String(c.incoming)}`).join("; ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
