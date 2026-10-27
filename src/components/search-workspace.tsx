"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FiltersEditor } from "./filters-editor";
import { DemoTag } from "./bits";
import { emptyFilters, type SearchFilters } from "@/lib/properties/filters";
import { parseQueryAction, saveToClientAction, searchAction } from "@/app/actions/properties";
import { generateDraftAction } from "@/app/actions/drafts";
import type { Fit } from "@/lib/properties/fit";
import type { DealInsight } from "@/lib/properties/deal";

type Result = {
  id: string; address: string; city: string | null; zip: string | null; status: string | null; listPrice: number | null; soldPrice: number | null;
  estimatePrice: number | null; estimateSource: string | null; beds: number | null; baths: number | null; sqft: number | null; yearBuilt: number | null;
  sourceUrl: string | null; source: string; fetchedAt: string; isDemo: boolean; missing: string[]; conflicts: string[]; fit: Fit; deal: DealInsight;
};

const $ = (n: number | null) => (n === null ? "—" : "$" + n.toLocaleString("en-US"));

export function SearchWorkspace({ clients, initialClientId, initialFilters }: { clients: { id: string; name: string }[]; initialClientId: string; initialFilters: SearchFilters | null }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(initialFilters ?? emptyFilters());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parser, setParser] = useState<string | null>(null);
  const [clientId, setClientId] = useState(initialClientId);
  const [includeSold, setIncludeSold] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const search = (f = filters) =>
    start(async () => {
      const r = await searchAction(f, { includeSold });
      if (!r.ok) return void toast.error(r.error);
      setResults(r.data!.results as Result[]);
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>1. Mô tả yêu cầu bằng lời</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="vd. 4 bed in Round Rock or Pflugerville under $480k, must have garage, pool would be nice, first-time buyer" />
          <Button variant="outline" disabled={pending || text.trim().length < 3} onClick={() => start(async () => {
            const r = await parseQueryAction(text, clientId || null);
            if (!r.ok) return void toast.error(r.error);
            setFilters(r.data!.filters);
            setWarnings(r.data!.warnings);
            setParser(r.data!.parser);
          })}>Chuyển thành bộ lọc</Button>
          {parser && <p className="text-xs text-muted-foreground">Phân tích bởi: {parser === "ai" ? "AI" : "quy tắc DEMO (không phải AI)"} — kiểm tra và sửa bộ lọc bên dưới.</p>}
          {warnings.length > 0 && <ul className="text-xs text-red-800 list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Bộ lọc (sửa được)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FiltersEditor value={filters} onChange={setFilters} />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" checked={includeSold} onChange={(e) => setIncludeSold(e.target.checked)} />Gồm cả nhà đã bán</label>
            <Button disabled={pending} onClick={() => search()}>{pending ? "Đang tìm…" : "Tìm"}</Button>
            <Button variant="ghost" onClick={() => setFilters(emptyFilters())}>Xóa bộ lọc</Button>
          </div>
          <p className="text-xs text-muted-foreground">Chỉ lọc theo đặc điểm khách quan của căn nhà (Fair Housing).</p>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader><CardTitle>3. Kết quả ({results.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm sticky top-0 bg-card py-2 z-10 border-b">
              <select className="rounded-md border bg-background px-2 py-1" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Khách hàng">
                <option value="">— Chọn khách để lưu —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span>Đã chọn {picked.length}</span>
              <Button size="sm" disabled={pending || !clientId || picked.length === 0} onClick={() => start(async () => {
                for (const id of picked) {
                  const r = await saveToClientAction(clientId, id, filters);
                  if (!r.ok) return void toast.error(r.error);
                }
                toast.success(`Đã lưu ${picked.length} căn vào khách`);
              })}>Lưu vào khách</Button>
              {(["email", "sms"] as const).map((ch) => (
                <Button key={ch} size="sm" variant="outline" disabled={pending || !clientId || picked.length === 0} onClick={() => start(async () => {
                  for (const id of picked) await saveToClientAction(clientId, id, filters);
                  const r = await generateDraftAction({ clientId, scenario: "send_homes", channel: ch, language: "en", propertyIds: picked });
                  if (!r.ok) return void toast.error(r.error);
                  router.push(`/drafts/${r.data!.id}`);
                })}>Soạn {ch === "email" ? "email" : "SMS"} giới thiệu</Button>
              ))}
            </div>
            {results.length === 0 && <p className="text-sm text-muted-foreground">Không có căn nào khớp. Nhập thêm dữ liệu ở “Nhập dữ liệu nhà”.</p>}
            {results.map((r) => (
              <div key={r.id} className="rounded-md border p-3 text-sm grid gap-3 md:grid-cols-[auto_1fr_1fr_1fr]">
                <input type="checkbox" className="mt-1" aria-label={`Chọn ${r.address}`} checked={picked.includes(r.id)} onChange={() => setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : [...picked, r.id])} />
                <div>
                  <div className="font-medium">{r.address}, {r.city} {r.zip} <DemoTag show={r.isDemo} /></div>
                  <div>{r.status ?? "?"} · {r.status === "sold" ? `Sold ${$(r.soldPrice)}` : `Giá chào ${$(r.listPrice)}`} · {r.beds ?? "?"} PN / {r.baths ?? "?"} WC · {r.sqft ?? "?"} sqft · {r.yearBuilt ?? "?"}</div>
                  {r.estimatePrice && <div className="text-xs text-muted-foreground">Ước tính tự động ({r.estimateSource ?? "không rõ nguồn"}): {$(r.estimatePrice)} — không phải giá sold</div>}
                  <div className="text-xs text-muted-foreground">Nguồn: {r.source} · lấy lúc {new Date(r.fetchedAt).toLocaleString("vi-VN")}{r.sourceUrl && <> · <a className="underline" href={r.sourceUrl} target="_blank" rel="noreferrer">link</a></>}</div>
                  {r.missing.length > 0 && <div className="text-xs text-amber-800">Thiếu: {r.missing.join(", ")}</div>}
                  {r.conflicts.length > 0 && <div className="text-xs text-red-700">Nguồn xung đột ở: {r.conflicts.join(", ")}</div>}
                </div>
                <div>
                  <div className="font-medium">Phù hợp với khách</div>
                  <div className={r.fit.mustFail ? "text-red-700" : ""}>{r.fit.label}</div>
                  <ul className="text-xs mt-1 space-y-0.5">
                    {r.fit.checks.map((c) => <li key={c.label}>{c.result === "match" ? "✓" : c.result === "miss" ? "✗" : "?"} {c.label}{c.detail ? ` (${c.detail})` : ""}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">Nhận định deal (theo dữ liệu)</div>
                  {r.deal.verdict === "insufficient_data" ? <div className="text-muted-foreground">Chưa đủ dữ liệu để đánh giá deal.</div> : <div className="text-xs">Cơ sở: {r.deal.basis}</div>}
                  <ul className="text-xs mt-1 list-disc pl-4">{r.deal.observations.map((o) => <li key={o}>{o}</li>)}</ul>
                  <ul className="text-xs mt-1 text-muted-foreground list-disc pl-4">{r.deal.limitations.map((o) => <li key={o}>{o}</li>)}</ul>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
