"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addExampleAction, approveRuleSetAction, proposeRulesAction, saveRuleSetAction } from "@/app/actions/comps";
import { ADJ_LABELS, type CompRules } from "@/lib/comps/rules";

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

function NumField({ label, value, onChange, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; hint?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input inputMode="decimal" value={value ?? ""} placeholder="chưa cấu hình" onChange={(e) => onChange(numOrNull(e.target.value))} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function RulesEditor({ initial, initialName }: { initial: CompRules; initialName: string }) {
  const router = useRouter();
  const [r, setR] = useState(initial);
  const [name, setName] = useState(initialName);
  const [pending, start] = useTransition();
  const sel = (p: Partial<CompRules["selection"]>) => setR({ ...r, selection: { ...r.selection, ...p } });
  const adj = (p: Partial<CompRules["adjustments"]>) => setR({ ...r, adjustments: { ...r.adjustments, ...p } });
  const save = (activate: boolean) => start(async () => {
    const res = await saveRuleSetAction(name, r, activate);
    if (res.ok) { toast.success(`${res.message} (v${res.data!.version})`); router.refresh(); } else toast.error(res.error);
  });
  return (
    <div className="space-y-5 text-sm">
      <div className="max-w-sm"><Label>Tên bộ quy tắc</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>

      <section>
        <h3 className="font-semibold mb-2">1. Điều kiện chọn / loại comp</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumField label="Khoảng cách tối đa (mi)" value={r.selection.maxDistanceMiles} onChange={(v) => sel({ maxDistanceMiles: v })} />
          <NumField label="Bán trong vòng (tháng)" value={r.selection.soldWithinMonths} onChange={(v) => sel({ soldWithinMonths: v })} />
          <NumField label="Diện tích lệch tối đa (%)" value={r.selection.sqftTolerancePct} onChange={(v) => sel({ sqftTolerancePct: v })} />
          <NumField label="Năm xây lệch tối đa (năm)" value={r.selection.yearBuiltTolerance} onChange={(v) => sel({ yearBuiltTolerance: v })} />
          <NumField label="Phòng ngủ lệch tối đa" value={r.selection.bedsTolerance} onChange={(v) => sel({ bedsTolerance: v })} />
          <NumField label="Số comp tối thiểu" value={r.selection.minComps} onChange={(v) => sel({ minComps: v ?? 3 })} />
          <NumField label="Số comp tối đa" value={r.selection.maxComps} onChange={(v) => sel({ maxComps: v ?? 6 })} />
          <div><Label className="text-xs">Loại nếu tình trạng là (phẩy)</Label><Input value={r.selection.excludeConditions.join(", ")} onChange={(e) => sel({ excludeConditions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="poor" /></div>
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          <label className="flex items-center gap-1"><input type="checkbox" checked={r.selection.samePropertyType} onChange={(e) => sel({ samePropertyType: e.target.checked })} />Cùng loại nhà</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={r.selection.sameZipOnly} onChange={(e) => sel({ sameZipOnly: e.target.checked })} />Chỉ cùng ZIP</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={r.selection.sameSubdivisionPreferred} onChange={(e) => sel({ sameSubdivisionPreferred: e.target.checked })} />Ưu tiên cùng subdivision</label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 mt-2">
          <div><Label className="text-xs">Ranh giới khu vực (vd. không băng qua đường lớn, school zone...)</Label><Textarea rows={2} value={r.selection.boundaryNotes} onChange={(e) => sel({ boundaryNotes: e.target.value })} /></div>
          <div><Label className="text-xs">Ghi chú chọn comp khác</Label><Textarea rows={2} value={r.selection.notes} onChange={(e) => sel({ notes: e.target.value })} /></div>
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">2. Nguồn dữ liệu</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label className="text-xs">Thứ tự ưu tiên nguồn (phẩy)</Label><Input value={r.sourcePriority.join(", ")} onChange={(e) => setR({ ...r, sourcePriority: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
          <label className="flex items-center gap-1"><input type="checkbox" checked={r.includePendingAsSupport} onChange={(e) => setR({ ...r, includePendingAsSupport: e.target.checked })} />Hiện pending để tham khảo</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={r.includeActiveAsSupport} onChange={(e) => setR({ ...r, includeActiveAsSupport: e.target.checked })} />Hiện active để tham khảo</label>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Giá chào, pending và ước tính tự động không bao giờ được dùng thay giá sold.</p>
      </section>

      <section>
        <h3 className="font-semibold mb-2">3. Phương pháp điều chỉnh giá (số tiền cộng/trừ vào giá comp)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumField label={ADJ_LABELS.perSqft} value={r.adjustments.perSqft} onChange={(v) => adj({ perSqft: v })} hint="$ cho mỗi sqft chênh" />
          <NumField label={ADJ_LABELS.perBed} value={r.adjustments.perBed} onChange={(v) => adj({ perBed: v })} />
          <NumField label={ADJ_LABELS.perBath} value={r.adjustments.perBath} onChange={(v) => adj({ perBath: v })} />
          <NumField label={ADJ_LABELS.perGarageSpace} value={r.adjustments.perGarageSpace} onChange={(v) => adj({ perGarageSpace: v })} />
          <NumField label={ADJ_LABELS.pool} value={r.adjustments.pool} onChange={(v) => adj({ pool: v })} />
          <NumField label={ADJ_LABELS.perLotSqft} value={r.adjustments.perLotSqft} onChange={(v) => adj({ perLotSqft: v })} />
          <NumField label={ADJ_LABELS.perYearAge} value={r.adjustments.perYearAge} onChange={(v) => adj({ perYearAge: v })} hint="Nhà subject mới hơn → cộng" />
          <NumField label={ADJ_LABELS.remodel} value={r.adjustments.remodel} onChange={(v) => adj({ remodel: v })} />
          <NumField label={ADJ_LABELS.timePctPerMonth} value={r.adjustments.timePctPerMonth} onChange={(v) => adj({ timePctPerMonth: v })} hint="% giá sold mỗi tháng kể từ ngày bán (âm nếu thị trường giảm)" />
        </div>
        <div className="mt-2">
          <Label className="text-xs">Thang tình trạng ($ giá trị tương đối mỗi mức)</Label>
          <div className="grid gap-2 grid-cols-5">
            {(["poor", "fair", "average", "good", "excellent"] as const).map((k) => (
              <Input key={k} inputMode="numeric" placeholder={k} value={r.adjustments.condition[k] ?? ""} onChange={(e) => adj({ condition: { ...r.adjustments.condition, [k]: numOrNull(e.target.value) } })} aria-label={k} />
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 mt-2">
          <NumField label="Cảnh báo nếu điều chỉnh gộp > (%)" value={r.maxGrossAdjustmentPct} onChange={(v) => setR({ ...r, maxGrossAdjustmentPct: v })} />
          <NumField label="Cảnh báo nếu điều chỉnh ròng > (%)" value={r.maxNetAdjustmentPct} onChange={(v) => setR({ ...r, maxNetAdjustmentPct: v })} />
          <div><Label className="text-xs">Ghi chú điều chỉnh (remodel, đặc điểm khác)</Label><Input value={r.adjustments.notes} onChange={(e) => adj({ notes: e.target.value })} /></div>
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">4. Đề xuất khoảng giá & trình bày</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Cách tính khoảng giá</Label>
            <select className="w-full rounded-md border bg-background px-3 py-2" value={r.range.method ?? ""} onChange={(e) => setR({ ...r, range: { ...r.range, method: (e.target.value || null) as CompRules["range"]["method"] } })}>
              <option value="">— Chưa chọn (không đưa khoảng giá) —</option>
              <option value="min_max_adjusted">Thấp nhất – cao nhất sau điều chỉnh</option>
              <option value="median_pct">Trung vị sau điều chỉnh ± %</option>
              <option value="middle_two_thirds">Khoảng giữa (bỏ 1/6 mỗi đầu)</option>
            </select>
          </div>
          <NumField label="% cho 'trung vị ± %'" value={r.range.pct} onChange={(v) => setR({ ...r, range: { ...r.range, pct: v } })} />
          <NumField label="Làm tròn tới ($)" value={r.range.roundTo} onChange={(v) => setR({ ...r, range: { ...r.range, roundTo: v ?? 1000 } })} />
        </div>
        <div className="mt-2"><Label className="text-xs">Cách trình bày kết quả</Label><Textarea rows={2} value={r.presentationNotes} onChange={(e) => setR({ ...r, presentationNotes: e.target.value })} /></div>
      </section>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button disabled={pending} onClick={() => save(true)}>Lưu & áp dụng làm quy tắc chính thức</Button>
        <Button variant="outline" disabled={pending} onClick={() => save(false)}>Lưu dưới dạng đề xuất</Button>
      </div>
    </div>
  );
}

export function ProposedRuleSets({ sets }: { sets: { id: string; version: number; name: string; rationale: string | null; rules: CompRules; createdAt: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 text-sm">
      {sets.map((s) => (
        <div key={s.id} className="rounded border p-3 space-y-2">
          <div className="font-medium">v{s.version} — {s.name}</div>
          {s.rationale && <pre className="whitespace-pre-wrap text-xs bg-muted rounded p-2">{s.rationale}</pre>}
          <details><summary className="cursor-pointer text-xs">Xem quy tắc</summary><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(s.rules, null, 1)}</pre></details>
          <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await approveRuleSetAction(s.id); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })}>Duyệt làm quy tắc chính thức</Button>
        </div>
      ))}
    </div>
  );
}

export function ProposeButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={disabled || pending} onClick={() => start(async () => {
      const r = await proposeRulesAction();
      if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
    })}>Đề xuất quy tắc từ các ví dụ</Button>
  );
}

type ExComp = { address: string; selected: boolean; reason: string; soldPrice: string; sqft: string; distanceMiles: string; monthsSinceSale: string; adjText: string };
const blankComp = (): ExComp => ({ address: "", selected: true, reason: "", soldPrice: "", sqft: "", distanceMiles: "", monthsSinceSale: "", adjText: "" });

/** adjText: mỗi dòng "nhãn; số tiền; chênh lệch đơn vị" — vd. "sqft; 5000; 50" */
function parseAdj(t: string) {
  return t.split("\n").map((l) => l.split(";").map((x) => x.trim())).filter((p) => p[0] && p[1]).map(([label, amount, unit]) => ({ label, amount: Number(amount), unitDiff: unit ? Number(unit) : null }));
}

export function ExampleForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState({ address: "", sqft: "", beds: "", baths: "", yearBuilt: "" });
  const [comps, setComps] = useState<ExComp[]>([blankComp()]);
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const n = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[$,]/g, "")));
  return (
    <div className="space-y-3 text-sm">
      <div><Label>Tên ví dụ</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="grid gap-2 sm:grid-cols-5">
        <Input className="sm:col-span-2" placeholder="Subject: địa chỉ" value={subject.address} onChange={(e) => setSubject({ ...subject, address: e.target.value })} />
        <Input placeholder="sqft" value={subject.sqft} onChange={(e) => setSubject({ ...subject, sqft: e.target.value })} />
        <Input placeholder="bd" value={subject.beds} onChange={(e) => setSubject({ ...subject, beds: e.target.value })} />
        <Input placeholder="năm xây" value={subject.yearBuilt} onChange={(e) => setSubject({ ...subject, yearBuilt: e.target.value })} />
      </div>
      {comps.map((c, i) => (
        <div key={i} className="rounded border p-2 space-y-1">
          <div className="grid gap-2 sm:grid-cols-6">
            <Input className="sm:col-span-2" placeholder="Comp: địa chỉ" value={c.address} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} />
            <Input placeholder="giá sold" value={c.soldPrice} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, soldPrice: e.target.value } : x)))} />
            <Input placeholder="sqft" value={c.sqft} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, sqft: e.target.value } : x)))} />
            <Input placeholder="cách (mi)" value={c.distanceMiles} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, distanceMiles: e.target.value } : x)))} />
            <Input placeholder="tháng từ khi bán" value={c.monthsSinceSale} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, monthsSinceSale: e.target.value } : x)))} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-md border bg-background px-2 py-1" value={c.selected ? "1" : "0"} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, selected: e.target.value === "1" } : x)))}><option value="1">Chọn</option><option value="0">Loại</option></select>
            <Input className="flex-1" placeholder="Lý do chọn/loại" value={c.reason} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} />
          </div>
          <Textarea rows={2} placeholder={"Khoản điều chỉnh, mỗi dòng: nhãn; số tiền; chênh lệch đơn vị\nvd. sqft; 5000; 50"} value={c.adjText} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, adjText: e.target.value } : x)))} />
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => setComps([...comps, blankComp()])}>+ Thêm comp</Button>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Khoảng giá cuối — thấp" value={low} onChange={(e) => setLow(e.target.value)} />
        <Input placeholder="Khoảng giá cuối — cao" value={high} onChange={(e) => setHigh(e.target.value)} />
      </div>
      <Textarea rows={2} placeholder="Ghi chú: vì sao chốt khoảng giá này" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button disabled={pending || !title || !subject.address || !comps[0].address} onClick={() => start(async () => {
        const r = await addExampleAction({
          title,
          subject: { address: subject.address, sqft: n(subject.sqft), beds: n(subject.beds), baths: n(subject.baths), yearBuilt: n(subject.yearBuilt) },
          comps: comps.filter((c) => c.address).map((c) => ({ address: c.address, selected: c.selected, reason: c.reason, soldPrice: n(c.soldPrice), sqft: n(c.sqft), distanceMiles: n(c.distanceMiles), monthsSinceSale: n(c.monthsSinceSale), adjustments: parseAdj(c.adjText) })),
          finalLow: n(low), finalHigh: n(high), notes: notes || null,
        });
        if (r.ok) { toast.success(r.message); router.refresh(); setTitle(""); setComps([blankComp()]); } else toast.error(r.error);
      })}>Lưu ví dụ</Button>
    </div>
  );
}
