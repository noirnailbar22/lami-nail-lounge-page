import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { overdueDays } from "@/lib/clients/followup";
import { connectionStatus } from "@/lib/connections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnBadge, DemoTag, DraftStatusBadge, Empty, PageHeader, fmtDate } from "@/components/bits";
import { CallNoteForm } from "@/components/call-note-form";
import { ProposalList } from "@/components/proposal-list";
import { SCENARIOS } from "@/lib/drafts/state";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const settings = await getSettings();
  const now = new Date();
  const clients = await db.client.findMany({ select: { id: true, name: true, stage: true, lastActivityAt: true, isDemo: true }, take: 2000 });
  const followUps = clients
    .map((c) => ({ ...c, overdue: overdueDays(c, settings, now) }))
    .filter((c) => c.overdue === null || c.overdue > 0)
    .sort((a, b) => (b.overdue ?? 999) - (a.overdue ?? 999))
    .slice(0, 10);
  const pendingDrafts = await db.draft.findMany({
    where: { status: { in: ["draft", "approved", "needs_manual_send", "failed", "unknown"] } },
    include: { client: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  const tasks = await db.crmTask.findMany({
    where: { isCompleted: false, dueAt: { lte: new Date(now.getTime() + 2 * 86_400_000) } },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { dueAt: "asc" },
    take: 10,
  });
  const saved = await db.savedProperty.findMany({ include: { client: { select: { id: true, name: true } }, property: true }, orderBy: { createdAt: "desc" }, take: 6 });
  const reports = await db.compReport.findMany({ orderBy: { updatedAt: "desc" }, take: 5 });
  const proposals = await db.crmProposal.findMany({ where: { status: { in: ["proposed", "failed"] } }, include: { client: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 });
  const conns = await connectionStatus();
  const syncErrors = await db.syncRun.findMany({ where: { status: "error" }, orderBy: { startedAt: "desc" }, take: 3 });
  const webhookErrors = await db.webhookEvent.count({ where: { error: { not: null } } });
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan" desc="Việc cần làm hôm nay. Mọi tin nhắn và thay đổi CRM đều chờ bạn duyệt.">
        {settings.automationPaused && <span className="rounded bg-slate-800 text-white text-xs px-2 py-1">Tự động hóa: ĐANG DỪNG</span>}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Khách cần follow up</CardTitle></CardHeader>
          <CardContent>
            {followUps.length === 0 ? <Empty>Không có khách quá hạn.</Empty> : (
              <ul className="divide-y text-sm">
                {followUps.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><DemoTag show={c.isDemo} /><Link className="underline-offset-2 hover:underline" href={`/clients/${c.id}`}>{c.name}</Link><span className="text-muted-foreground">{c.stage}</span></span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{c.overdue === null ? "chưa có mốc liên lạc" : `quá hạn ${c.overdue} ngày`}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tin nhắn / email chờ xử lý</CardTitle></CardHeader>
          <CardContent>
            {pendingDrafts.length === 0 ? <Empty>Không có bản nháp đang chờ.</Empty> : (
              <ul className="divide-y text-sm">
                {pendingDrafts.map((d) => (
                  <li key={d.id} className="py-2 flex items-center justify-between gap-2">
                    <Link href={`/drafts/${d.id}`} className="hover:underline flex items-center gap-2">
                      <DemoTag show={d.isDemo} />
                      {d.channel.toUpperCase()} · {d.client.name} · {SCENARIOS[d.scenario as keyof typeof SCENARIOS]}
                    </Link>
                    <DraftStatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Việc đến hạn (≤ 2 ngày)</CardTitle></CardHeader>
          <CardContent>
            {tasks.length === 0 ? <Empty>Không có việc đến hạn.</Empty> : (
              <ul className="divide-y text-sm">
                {tasks.map((t) => (
                  <li key={t.id} className="py-2 flex justify-between gap-2">
                    <span><DemoTag show={t.isDemo} /> {t.name}{t.client && <> — <Link href={`/clients/${t.client.id}`} className="hover:underline">{t.client.name}</Link></>}</span>
                    <span className={`text-xs whitespace-nowrap ${t.dueAt && t.dueAt < now ? "text-red-700 font-medium" : "text-muted-foreground"}`}>{fmtDate(t.dueAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ghi chú sau cuộc gọi / showing</CardTitle></CardHeader>
          <CardContent>
            <CallNoteForm clients={clientOptions} />
          </CardContent>
        </Card>
      </div>

      {proposals.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Đề xuất chờ duyệt trước khi ghi vào CRM</CardTitle></CardHeader>
          <CardContent><ProposalList proposals={proposals.map((p) => ({ id: p.id, kind: p.kind, target: p.target, status: p.status, payload: p.payload as Record<string, unknown>, rationale: p.rationale, error: p.error, clientName: p.client.name }))} /></CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Nhà đã lưu gần đây</CardTitle></CardHeader>
          <CardContent>
            {saved.length === 0 ? <Empty>Chưa lưu nhà nào.</Empty> : (
              <ul className="divide-y text-sm">
                {saved.map((s) => (
                  <li key={s.id} className="py-2"><DemoTag show={s.property.isDemo} /> {s.property.address} → <Link href={`/clients/${s.client.id}`} className="hover:underline">{s.client.name}</Link></li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Báo cáo comps gần đây</CardTitle></CardHeader>
          <CardContent>
            {reports.length === 0 ? <Empty>Chưa có báo cáo.</Empty> : (
              <ul className="divide-y text-sm">
                {reports.map((r) => (
                  <li key={r.id} className="py-2 flex justify-between"><Link href={`/comps/${r.id}`} className="hover:underline"><DemoTag show={r.isDemo} /> {r.title}</Link><span className="text-xs text-muted-foreground">{r.ruleVersion ? `Quy tắc v${r.ruleVersion}` : "Chỉ số liệu khách quan"}</span></li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Trạng thái kết nối & lỗi cần xử lý</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {conns.slice(0, 4).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2"><ConnBadge state={c.state} /> <span className="font-medium">{c.name}</span> <span className="text-muted-foreground">{c.detail}</span></div>
          ))}
          {syncErrors.map((e) => <div key={e.id} className="text-red-700">Lỗi đồng bộ {e.kind} lúc {e.startedAt.toLocaleString("vi-VN")}: {e.error}</div>)}
          {webhookErrors > 0 && <div className="text-red-700">{webhookErrors} webhook FUB xử lý lỗi — xem Nhật ký.</div>}
          <Link href="/settings" className="text-sm underline">Xem tất cả kết nối →</Link>
        </CardContent>
      </Card>
    </div>
  );
}
