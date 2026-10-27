import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { checkOptOut } from "@/lib/clients/contact";
import { emailProviderFor } from "@/lib/email";
import { SCENARIOS } from "@/lib/drafts/state";
import { contentHash } from "@/lib/drafts/hash";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoTag, DraftStatusBadge, PageHeader, fmtDateTime } from "@/components/bits";
import { DraftReview } from "@/components/draft-review";
import type { EmailThread } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await db.draft.findUnique({ where: { id }, include: { client: true, attempts: { orderBy: { createdAt: "desc" } } } });
  if (!d) notFound();
  const settings = await getSettings();
  const opt = checkOptOut(d.client, d.channel as "sms" | "email", d.recipientAddress, settings);
  let thread: EmailThread | null = null;
  if (d.threadId) {
    const p = await emailProviderFor(d.client.isDemo);
    thread = p ? await p.getThread(d.threadId).catch(() => null) : null;
  }
  const stillApproved = d.status === "approved" && d.approvedHash === contentHash(d);
  return (
    <div className="space-y-4">
      <PageHeader title={`${d.channel === "sms" ? "SMS" : "Email"} · ${SCENARIOS[d.scenario as keyof typeof SCENARIOS]}`} desc={`Khách: ${d.client.name} · Soạn bởi ${d.generator === "ai" ? "AI (Claude)" : "mẫu DEMO cố định"} · Phong cách v${d.styleVersion ?? "—"}`}>
        <DemoTag show={d.isDemo} />
        <DraftStatusBadge status={d.status} />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <DraftReview
            draft={{ id: d.id, channel: d.channel as "sms" | "email", status: d.status, recipientName: d.recipientName, recipientAddress: d.recipientAddress, subject: d.subject, body: d.body, approvedAt: d.approvedAt?.toISOString() ?? null, stillApproved, sendError: d.sendError, isDemo: d.isDemo }}
            contactOptions={(d.channel === "sms" ? d.client.phones : d.client.emails) as { value: string }[]}
            optOut={opt}
          />
          {thread && (
            <Card>
              <CardHeader><CardTitle>Thread đang trả lời</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="font-medium">{thread.subject}</div>
                {thread.messages.map((m) => <div key={m.id}><span className="text-xs text-muted-foreground">{m.date} · {m.from}</span><div>{m.snippet}</div></div>)}
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Thông tin còn thiếu</CardTitle></CardHeader>
            <CardContent>
              {(d.missingInfo as string[]).length === 0 ? <p className="text-sm text-muted-foreground">Không phát hiện thiếu.</p> : (
                <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">{(d.missingInfo as string[]).map((m) => <li key={m}>{m}</li>)}</ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Dữ kiện đã dùng</CardTitle></CardHeader>
            <CardContent><ul className="list-disc pl-5 text-sm space-y-1">{(d.factsUsed as string[]).map((m) => <li key={m}>{m}</li>)}</ul></CardContent>
          </Card>
          {(d.warnings as string[]).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Cảnh báo</CardTitle></CardHeader>
              <CardContent><ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">{(d.warnings as string[]).map((m) => <li key={m}>{m}</li>)}</ul></CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Nhật ký gửi</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-2">
              {d.attempts.length === 0 ? <p className="text-muted-foreground">Chưa có lần gửi.</p> : d.attempts.map((a) => (
                <div key={a.id} className="rounded border p-2">
                  <div>{fmtDateTime(a.createdAt)} · {a.provider} · <strong>{a.status}</strong></div>
                  <div>Tới: {a.recipient}</div>
                  {a.providerMessageId && <div>ID: {a.providerMessageId}</div>}
                  {a.error && <div className="text-red-700">{a.error}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
          <Link href={`/clients/${d.clientId}`} className="text-sm underline">← Về hồ sơ khách</Link>
        </div>
      </div>
    </div>
  );
}
