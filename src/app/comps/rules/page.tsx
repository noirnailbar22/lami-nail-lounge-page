import { db } from "@/lib/db";
import { parseRules } from "@/lib/comps/rules";
import { PageHeader, DemoTag, fmtDateTime } from "@/components/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RulesEditor, ProposedRuleSets, ExampleForm, ProposeButton } from "@/components/comps-rules";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const sets = await db.compRuleSet.findMany({ orderBy: { version: "desc" } });
  const active = sets.find((s) => s.status === "active");
  const proposed = sets.filter((s) => s.status === "proposed");
  const examples = await db.compExample.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-4">
      <PageHeader title="Quy tắc run comps" desc="Phương pháp của bạn. App không áp một công thức CMA chung: hệ số nào chưa cấu hình thì không được áp dụng. Mọi báo cáo ghi lại phiên bản quy tắc đã dùng." />
      <Card>
        <CardHeader><CardTitle>{active ? `Bộ quy tắc đang dùng: v${active.version} — ${active.name}` : "Chưa có bộ quy tắc chính thức"}</CardTitle></CardHeader>
        <CardContent>
          <RulesEditor key={active?.id ?? "new"} initial={parseRules(active?.rules)} initialName={active?.name ?? "Phương pháp của tôi"} />
        </CardContent>
      </Card>
      {proposed.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Đề xuất chờ duyệt</CardTitle></CardHeader>
          <CardContent>
            <ProposedRuleSets sets={proposed.map((s) => ({ id: s.id, version: s.version, name: s.name, rationale: s.rationale, rules: parseRules(s.rules), createdAt: s.createdAt.toISOString() }))} />
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ví dụ bạn đã làm ({examples.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ProposeButton disabled={examples.length === 0} />
            {examples.map((e) => {
              const comps = (e.comps as { address: string; selected: boolean; reason: string }[]) ?? [];
              return (
                <div key={e.id} className="rounded border p-2">
                  <div className="font-medium">{e.title} <DemoTag show={e.title.includes("DEMO")} /></div>
                  <div className="text-xs text-muted-foreground">{fmtDateTime(e.createdAt)} · khoảng giá cuối: {e.finalLow ? `$${e.finalLow.toLocaleString()} – $${e.finalHigh?.toLocaleString()}` : "—"}</div>
                  <ul className="text-xs list-disc pl-5">{comps.map((c) => <li key={c.address}>{c.selected ? "Chọn" : "Loại"}: {c.address} — {c.reason}</li>)}</ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Thêm ví dụ</CardTitle></CardHeader>
          <CardContent><ExampleForm /></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Lịch sử phiên bản</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          {sets.map((s) => <div key={s.id}>v{s.version} · {s.status} · {s.name} · {fmtDateTime(s.createdAt)}{s.approvedAt ? ` · duyệt ${fmtDateTime(s.approvedAt)}` : ""}</div>)}
          {sets.length === 0 && <p className="text-muted-foreground">Chưa có phiên bản nào.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
