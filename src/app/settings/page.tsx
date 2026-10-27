import { db } from "@/lib/db";
import { connectionStatus } from "@/lib/connections";
import { getSettings } from "@/lib/settings";
import { env, gmailConfigured } from "@/lib/env";
import { ConnBadge, PageHeader, fmtDateTime } from "@/components/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomationSwitch, SettingsForm } from "@/components/settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const { gmail } = await searchParams;
  const conns = await connectionStatus();
  const settings = await getSettings();
  const runs = await db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 });
  const hooks = await db.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 10 });
  return (
    <div className="space-y-4">
      <PageHeader title="Kết nối & cài đặt" desc="Secret chỉ đặt trong biến môi trường phía server (.env hoặc Railway Variables) — không nhập trong trình duyệt." />
      {gmail === "ok" && <div className="rounded bg-emerald-50 p-2 text-sm text-emerald-900">Đã kết nối Gmail.</div>}
      {gmail === "error" && <div className="rounded bg-red-50 p-2 text-sm text-red-900">Kết nối Gmail thất bại — xem nhật ký.</div>}
      <Card>
        <CardHeader><CardTitle>Công tắc dừng tự động hóa</CardTitle></CardHeader>
        <CardContent><AutomationSwitch paused={settings.automationPaused} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Kết nối</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {conns.map((c) => (
            <div key={c.id} className="border-b pb-3 last:border-0">
              <div className="flex flex-wrap items-center gap-2"><ConnBadge state={c.state} /><strong>{c.name}</strong></div>
              <p className="text-muted-foreground">{c.detail}</p>
              {c.needs.length > 0 && <div className="text-xs">Cần để bật: <ul className="list-disc pl-5">{c.needs.map((n) => <li key={n}>{n}</li>)}</ul></div>}
              {c.id === "gmail" && gmailConfigured() && <a className="inline-block mt-1 rounded border px-3 py-1" href="/api/email/google/start">Kết nối Gmail (OAuth)</a>}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Webhook FUB (khi đã đăng ký hệ thống): POST {"<APP_URL>"}/api/webhooks/fub/{env.fubWebhookToken ? "<FUB_WEBHOOK_TOKEN>" : "(đặt FUB_WEBHOOK_TOKEN)"} — sự kiện peopleCreated, peopleUpdated, peopleStageUpdated, peopleTagsCreated.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Nhịp follow up & opt-out</CardTitle></CardHeader>
        <CardContent><SettingsForm initial={settings} /></CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Lần đồng bộ gần đây</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {runs.length === 0 ? "Chưa có." : runs.map((r) => <div key={r.id}>{fmtDateTime(r.startedAt)} · {r.provider}/{r.kind} · {r.status} · +{r.created} ~{r.updated} ={r.skipped}{r.error ? ` · ${r.error}` : ""}</div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Webhook đã nhận</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {hooks.length === 0 ? "Chưa có." : hooks.map((h) => <div key={h.id}>{fmtDateTime(h.receivedAt)} · {h.event} · {h.processedAt ? "đã xử lý" : h.error ? `lỗi: ${h.error}` : "chờ"}</div>)}
          </CardContent>
        </Card>
      </div>
      <form action="/api/auth/logout" method="post"><button className="text-sm underline">Đăng xuất</button></form>
    </div>
  );
}
