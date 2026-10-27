"use client";
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyActiveRulesAction, saveSelectionsAction } from "@/app/actions/comps";
import type { CompResult } from "@/lib/comps/compute";

type Sel = { propertyId: string; included: boolean; excludeReason?: string | null; overrides?: Record<string, number>; custom?: { label: string; amount: number }[] };
type Subject = Record<string, string | number | boolean | null>;

const $ = (n: number | null | undefined) => (n === null || n === undefined ? "—" : (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US"));
const PRICE_TYPE: Record<string, string> = { sold: "Giá sold (đã đóng)", pending: "Pending (tham khảo)", list: "Giá chào bán (tham khảo)", none: "Không có giá" };

export function CompsWorkspace({ reportId, subject, selections, result, notes: initialNotes, reportRuleVersion, activeRuleVersion }: {
  reportId: string; subject: Subject; selections: Sel[]; result: CompResult; notes: string; reportRuleVersion: number | null; activeRuleVersion: number | null;
}) {
  const router = useRouter();
  const [sels, setSels] = useState<Sel[]>(selections);
  const [notes, setNotes] = useState(initialNotes);
  const [pending, start] = useTransition();
  const upd = (id: string, patch: Partial<Sel>) => setSels(sels.map((s) => (s.propertyId === id ? { ...s, ...patch } : s)));
  const sel = (id: string) => sels.find((s) => s.propertyId === id)!;
  const save = () => start(async () => {
    const r = await saveSelectionsAction(reportId, sels, notes);
    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Subject property</CardTitle></CardHeader>
        <CardContent className="text-sm grid gap-1 sm:grid-cols-3">
          {Object.entries(subject).map(([k, v]) => <div key={k}><span className="text-muted-foreground">{k}:</span> {v === null ? <span className="text-amber-700">thiếu</span> : String(v)}</div>)}
        </CardContent>
      </Card>

      {activeRuleVersion !== reportRuleVersion && (
        <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm flex flex-wrap items-center gap-3">
          {activeRuleVersion ? `Đang có bộ quy tắc v${activeRuleVersion} (báo cáo này: ${reportRuleVersion ? "v" + reportRuleVersion : "chưa áp dụng"}).` : "Không còn bộ quy tắc hiện hành."}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await applyActiveRulesAction(reportId); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })}>Áp dụng bộ quy tắc hiện hành</Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Bảng so sánh</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="p-1">Dùng</th><th className="p-1">Địa chỉ</th><th className="p-1">Loại giá</th><th className="p-1">Giá</th><th className="p-1">Ngày bán</th><th className="p-1">Cách</th><th className="p-1">Sqft</th><th className="p-1">$/sqft</th><th className="p-1">Điều chỉnh ròng</th><th className="p-1">Sau điều chỉnh</th></tr>
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const s = sel(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr className={`border-t ${s?.included ? "" : "opacity-50"}`}>
                      <td className="p-1"><input type="checkbox" aria-label="Dùng comp này" checked={s?.included ?? false} onChange={(e) => upd(r.id, { included: e.target.checked })} /></td>
                      <td className="p-1">{r.address}<div className="text-xs text-muted-foreground">{r.source}</div></td>
                      <td className="p-1 text-xs">{PRICE_TYPE[r.priceType]}</td>
                      <td className="p-1">{$(r.price)}</td>
                      <td className="p-1">{r.soldDate ?? "—"}{r.monthsSinceSale !== null && <div className="text-xs text-muted-foreground">{r.monthsSinceSale} tháng</div>}</td>
                      <td className="p-1">{r.distanceMiles === null ? "—" : `${r.distanceMiles} mi`}</td>
                      <td className="p-1">{r.sqft ?? "—"}</td>
                      <td className="p-1">{r.ppsf ? "$" + r.ppsf : "—"}</td>
                      <td className="p-1">{r.netAdjustment === null ? "—" : $(r.netAdjustment)}{r.grossAdjustmentPct !== null && <div className="text-xs text-muted-foreground">gộp {r.grossAdjustmentPct}%</div>}</td>
                      <td className="p-1 font-medium">{$(r.adjustedPrice)}</td>
                    </tr>
                    <tr>
                      <td />
                      <td colSpan={9} className="pb-3 text-xs space-y-1">
                        {r.ruleFlags.length > 0 && <div className="text-amber-800">Theo quy tắc: {r.ruleFlags.join(" · ")}</div>}
                        {!s?.included && <Input className="h-7 text-xs max-w-md" placeholder="Lý do loại comp này" value={s?.excludeReason ?? ""} onChange={(e) => upd(r.id, { excludeReason: e.target.value })} />}
                        {r.adjustments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {r.adjustments.filter((a) => !a.key.startsWith("custom")).map((a) => (
                              <label key={a.key} className="flex items-center gap-1 rounded border px-1" title={a.note}>
                                {a.label}:
                                <input
                                  className="w-24 bg-transparent"
                                  inputMode="numeric"
                                  value={s?.overrides?.[a.key] ?? a.amount ?? ""}
                                  placeholder={a.note}
                                  onChange={(e) => {
                                    const o = { ...(s?.overrides ?? {}) };
                                    if (e.target.value.trim() === "") delete o[a.key];
                                    else o[a.key] = Number(e.target.value);
                                    upd(r.id, { overrides: o });
                                  }}
                                />
                                <span className="text-muted-foreground">{a.overridden ? "(sửa tay)" : a.amount === null ? `(${a.note})` : ""}</span>
                              </label>
                            ))}
                            {(s?.custom ?? []).map((c, i) => (
                              <span key={i} className="flex items-center gap-1 rounded border px-1">
                                <input className="w-24 bg-transparent" value={c.label} onChange={(e) => upd(r.id, { custom: s!.custom!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                                <input className="w-20 bg-transparent" inputMode="numeric" value={c.amount} onChange={(e) => upd(r.id, { custom: s!.custom!.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)) })} />
                                <button onClick={() => upd(r.id, { custom: s!.custom!.filter((_, j) => j !== i) })}>×</button>
                              </span>
                            ))}
                            <button className="underline" onClick={() => upd(r.id, { custom: [...(s?.custom ?? []), { label: "Khác", amount: 0 }] })}>+ khoản khác</button>
                          </div>
                        )}
                        {!r.usableAsPriceBasis && <div className="text-muted-foreground">Không dùng làm cơ sở giá (không phải giao dịch sold đã xác minh).</div>}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-2 pt-3">
            <Button disabled={pending} onClick={save}>Lưu & tính lại</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Số liệu khách quan (chỉ comp sold đã chọn)</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Số comp sold: {result.stats.soldCount}</div>
            <div>Giá sold: {$(result.stats.soldPriceMin)} – {$(result.stats.soldPriceMax)} · trung vị {$(result.stats.soldPriceMedian)}</div>
            <div>$/sqft sold: {$(result.stats.ppsfMin)} – {$(result.stats.ppsfMax)} · trung vị {$(result.stats.ppsfMedian)}</div>
            <div className="text-muted-foreground">Tham khảo (không vào khoảng giá): {result.stats.pendingCount} pending · {result.stats.activeCount} active (trung vị giá chào {$(result.stats.activeListMedian)})</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Khoảng giá đề xuất</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {result.range ? (
              <>
                <div className="text-2xl font-semibold">{$(result.range.low)} – {$(result.range.high)}</div>
                <div>{result.range.method} · {result.range.basis} · Quy tắc v{result.ruleVersion}</div>
              </>
            ) : <div className="text-amber-900">{result.rangeBlockedReason}</div>}
            {result.limitations.length > 0 && <ul className="list-disc pl-5 text-xs text-muted-foreground">{result.limitations.map((l) => <li key={l}>{l}</li>)}</ul>}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Ghi chú trình bày</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú của bạn sẽ xuất hiện trong bản in." />
          <Button variant="outline" disabled={pending} onClick={save}>Lưu</Button>
        </CardContent>
      </Card>
    </div>
  );
}
