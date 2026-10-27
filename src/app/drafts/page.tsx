import Link from "next/link";
import { db } from "@/lib/db";
import { DRAFT_STATUS, SCENARIOS } from "@/lib/drafts/state";
import { DemoTag, DraftStatusBadge, PageHeader, fmtDateTime, TableCard } from "@/components/bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DraftsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "" } = await searchParams;
  const drafts = await db.draft.findMany({
    where: status ? { status } : {},
    include: { client: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return (
    <div>
      <PageHeader title="Bản nháp & gửi" desc="Mỗi tin phải được duyệt riêng. Sửa nội dung hoặc người nhận sau khi duyệt sẽ hủy duyệt. Tạo bản nháp mới từ trang khách hàng." />
      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <Link href="/drafts" className={`rounded border px-2 py-1 ${!status ? "bg-muted" : ""}`}>Tất cả</Link>
        {Object.entries(DRAFT_STATUS).map(([k, v]) => <Link key={k} href={`/drafts?status=${k}`} className={`rounded border px-2 py-1 ${status === k ? "bg-muted" : ""}`}>{v}</Link>)}
      </div>
      <TableCard>
      <Table>
        <TableHeader><TableRow><TableHead>Khách</TableHead><TableHead>Kênh</TableHead><TableHead>Tình huống</TableHead><TableHead>Trạng thái</TableHead><TableHead>Nguồn soạn</TableHead><TableHead>Cập nhật</TableHead></TableRow></TableHeader>
        <TableBody>
          {drafts.map((d) => (
            <TableRow key={d.id}>
              <TableCell><Link className="hover:underline font-medium" href={`/drafts/${d.id}`}>{d.client.name}</Link> <DemoTag show={d.isDemo} /></TableCell>
              <TableCell>{d.channel.toUpperCase()}</TableCell>
              <TableCell>{SCENARIOS[d.scenario as keyof typeof SCENARIOS]}</TableCell>
              <TableCell><DraftStatusBadge status={d.status} /></TableCell>
              <TableCell>{d.generator === "ai" ? "AI" : "Mẫu DEMO"}</TableCell>
              <TableCell>{fmtDateTime(d.updatedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </TableCard>
      {drafts.length === 0 && <p className="text-sm text-muted-foreground mt-3">Chưa có bản nháp.</p>}
    </div>
  );
}
