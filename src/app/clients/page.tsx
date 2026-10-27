import Link from "next/link";
import { db } from "@/lib/db";
import { crmMode } from "@/lib/crm";
import { parseNeeds, needsSummary } from "@/lib/clients/needs";
import { overdueDays } from "@/lib/clients/followup";
import { getSettings } from "@/lib/settings";
import { DemoTag, PageHeader, StagePill, TableCard, fmtDate } from "@/components/bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SyncFubButton } from "@/components/sync-fub-button";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string }> }) {
  const { q = "", stage = "" } = await searchParams;
  const settings = await getSettings();
  const clients = await db.client.findMany({
    where: {
      AND: [
        q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(/^\d+$/.test(q) ? [{ fubId: Number(q) }] : [])] } : {},
        stage ? { stage } : {},
      ],
    },
    orderBy: [{ lastActivityAt: { sort: "desc", nulls: "last" } }],
    take: 200,
  });
  const stages = (await db.client.findMany({ distinct: ["stage"], select: { stage: true } })).map((s) => s.stage).filter(Boolean) as string[];
  const mode = crmMode();
  return (
    <div>
      <PageHeader title="Khách hàng" desc={mode === "fub" ? "Bản sao tối thiểu từ Follow Up Boss (đọc). Hồ sơ gốc vẫn nằm trong FUB." : "Đang dùng khách DEMO hư cấu. Thêm FUB_API_KEY và DEMO_MODE=false để đọc từ Follow Up Boss."}>
        {mode === "fub" && <SyncFubButton />}
      </PageHeader>
      <form className="flex flex-wrap gap-2 mb-5">
        <Input name="q" defaultValue={q} placeholder="Tìm theo tên hoặc FUB ID" className="max-w-xs" />
        <select name="stage" defaultValue={stage} className="rounded-lg border bg-card px-3 text-sm" aria-label="Stage">
          <option value="">Mọi stage</option>
          {stages.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Lọc</button>
      </form>
      <TableCard>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Tên</TableHead><TableHead>Stage</TableHead><TableHead>Phụ trách</TableHead><TableHead>Nhu cầu</TableHead><TableHead>Liên lạc gần nhất</TableHead><TableHead>Follow up</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => {
            const od = overdueDays(c, settings);
            return (
              <TableRow key={c.id}>
                <TableCell><Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link> <DemoTag show={c.isDemo} /></TableCell>
                <TableCell><StagePill stage={c.stage} /></TableCell>
                <TableCell>{c.assignedTo ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{needsSummary(parseNeeds(c.needs))}</TableCell>
                <TableCell>{fmtDate(c.lastActivityAt)}</TableCell>
                <TableCell>{od === null ? <span className="text-amber-700">chưa rõ</span> : od > 0 ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">quá {od} ngày</span> : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </TableCard>
      {clients.length === 0 && <p className="text-sm text-muted-foreground mt-4">Không có khách khớp bộ lọc.</p>}
    </div>
  );
}
