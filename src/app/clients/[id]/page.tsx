import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { crmMode } from "@/lib/crm";
import { emailProviderFor } from "@/lib/email";
import { parseNeeds } from "@/lib/clients/needs";
import { checkOptOut, points, primaryEmail, primaryPhone, tagsOf } from "@/lib/clients/contact";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoTag, DraftStatusBadge, Empty, PageHeader, fmtDate } from "@/components/bits";
import { NeedsEditor } from "@/components/needs-editor";
import { DraftGenerator } from "@/components/draft-generator";
import { OptOutToggles } from "@/components/opt-out-toggles";
import { CallNoteForm } from "@/components/call-note-form";
import { SyncFubButton } from "@/components/sync-fub-button";
import { UnsaveButton } from "@/components/unsave-button";
import { SCENARIOS } from "@/lib/drafts/state";
import type { EmailThread } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.client.findUnique({
    where: { id },
    include: {
      interactions: { orderBy: { occurredAt: "desc" }, take: 40 },
      tasks: { orderBy: { dueAt: "asc" } },
      saved: { include: { property: true }, orderBy: { createdAt: "desc" } },
      drafts: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
  if (!c) notFound();
  const settings = await getSettings();
  const needs = parseNeeds(c.needs);
  const sms = checkOptOut(c, "sms", primaryPhone(c), settings);
  const mail = checkOptOut(c, "email", primaryEmail(c), settings);

  let threads: EmailThread[] = [];
  let threadNote = "";
  const email = primaryEmail(c);
  const provider = await emailProviderFor(c.isDemo);
  if (!provider) threadNote = "Chưa kết nối Gmail — không xem được thread.";
  else if (email) {
    try {
      threads = await provider.listThreads(email);
    } catch (e) {
      threadNote = `Không đọc được Gmail: ${(e as Error).message}`;
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={c.name} desc={`${c.stage ?? "Chưa có stage"} · Phụ trách: ${c.assignedTo ?? "—"} · Nguồn: ${c.sourceLabel ?? "—"}${c.fubId ? ` · FUB ID ${c.fubId}` : ""}`}>
        <DemoTag show={c.isDemo} label="KHÁCH DEMO" />
        {!c.isDemo && c.fubId && crmMode() === "fub" && <SyncFubButton clientId={c.id} />}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Liên hệ</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {points(c.phones).map((p) => <div key={p.value}>📱 {p.value} <span className="text-muted-foreground">{p.type} {p.status}</span></div>)}
            {points(c.emails).map((p) => <div key={p.value}>✉️ {p.value} <span className="text-muted-foreground">{p.status}</span></div>)}
            <div className="flex flex-wrap gap-1">{tagsOf(c).map((t) => <span key={t} className="rounded bg-muted px-1.5 text-xs">{t}</span>)}</div>
            <OptOutToggles clientId={c.id} sms={c.smsOptOut} email={c.emailOptOut} />
            {sms.blocked && <p className="text-xs text-red-700">SMS bị chặn: {sms.reasons.join(" ")}</p>}
            {mail.blocked && <p className="text-xs text-red-700">Email bị chặn: {mail.reasons.join(" ")}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Nhu cầu (lưu trong app)</CardTitle></CardHeader>
          <CardContent><NeedsEditor clientId={c.id} initial={needs} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Soạn follow up</CardTitle></CardHeader>
        <CardContent>
          <DraftGenerator
            clientId={c.id}
            defaultLanguage={settings.defaultLanguage}
            saved={c.saved.map((s) => ({ id: s.property.id, label: `${s.property.address} ${s.property.listPrice ? "· $" + s.property.listPrice.toLocaleString() : ""}` }))}
            threads={threads.map((t) => ({ id: t.id, label: `${t.subject} (${t.lastDate})` }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Lịch sử tương tác</CardTitle></CardHeader>
          <CardContent>
            {c.interactions.length === 0 ? <Empty>Chưa có tương tác nào được đọc.</Empty> : (
              <ul className="space-y-2 text-sm max-h-[28rem] overflow-auto">
                {c.interactions.map((i) => (
                  <li key={i.id} className="border-l-2 pl-3">
                    <div className="text-xs text-muted-foreground">{fmtDate(i.occurredAt)} · {i.kind}{i.direction ? (i.direction === "in" ? " · khách gửi" : " · mình gửi") : ""} · {i.source}{i.isDemo ? " · DEMO" : ""}</div>
                    {i.subject && <div className="font-medium">{i.subject}</div>}
                    {i.body && <div className="whitespace-pre-wrap">{i.body}</div>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Thread email liên quan</CardTitle></CardHeader>
          <CardContent>
            {threadNote && <p className="text-sm text-muted-foreground">{threadNote}</p>}
            {provider?.isDemo && <p className="text-xs text-amber-800 mb-2">Thread DEMO hư cấu.</p>}
            {threads.length === 0 && !threadNote ? <Empty>Không có thread.</Empty> : (
              <ul className="space-y-3 text-sm">
                {threads.map((t) => (
                  <li key={t.id} className="rounded border p-2">
                    <div className="font-medium">{t.subject}</div>
                    {t.messages.map((m) => <div key={m.id} className="mt-1"><span className="text-xs text-muted-foreground">{m.date} · {m.from}</span><div>{m.snippet}</div></div>)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Nhà đã lưu cho khách</CardTitle></CardHeader>
          <CardContent>
            {c.saved.length === 0 ? <Empty>Chưa lưu nhà nào. <Link href={`/properties?client=${c.id}`} className="underline">Tìm nhà cho khách →</Link></Empty> : (
              <ul className="divide-y text-sm">
                {c.saved.map((s) => (
                  <li key={s.id} className="py-2 flex justify-between gap-2">
                    <span><DemoTag show={s.property.isDemo} /> {s.property.address}, {s.property.city} · {s.property.status} {s.property.listPrice ? `· $${s.property.listPrice.toLocaleString()}` : ""}{s.fit ? <span className="block text-xs text-muted-foreground">Phù hợp: {(s.fit as { label: string }).label}</span> : null}</span>
                    <UnsaveButton id={s.id} />
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/properties?client=${c.id}`} className="text-sm underline">Tìm thêm nhà →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Việc cần làm & bản nháp</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {c.tasks.length === 0 ? <Empty>Không có việc.</Empty> : c.tasks.map((t) => <div key={t.id}>{t.isCompleted ? "✅" : "⬜"} {t.name} · {fmtDate(t.dueAt)} <span className="text-muted-foreground">({t.source}{t.isDemo ? " demo" : ""})</span></div>)}
            <div className="border-t pt-2 space-y-1">
              {c.drafts.map((d) => <div key={d.id} className="flex justify-between gap-2"><Link className="hover:underline" href={`/drafts/${d.id}`}>{d.channel.toUpperCase()} · {SCENARIOS[d.scenario as keyof typeof SCENARIOS]} · {fmtDate(d.createdAt)}</Link><DraftStatusBadge status={d.status} /></div>)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Ghi chú sau cuộc gọi / showing</CardTitle></CardHeader>
        <CardContent><CallNoteForm clients={[]} fixedClientId={c.id} /><p className="text-xs text-muted-foreground mt-2">Đề xuất hiện ở trang Tổng quan để duyệt.</p></CardContent>
      </Card>
    </div>
  );
}
