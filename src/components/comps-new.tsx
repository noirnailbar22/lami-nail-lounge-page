"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReportAction } from "@/app/actions/comps";
import { haversineMiles } from "@/lib/comps/compute";

type P = { id: string; address: string; city: string | null; zip: string | null; status: string | null; soldPrice: number | null; soldDate: string | null; listPrice: number | null; sqft: number | null; lat: number | null; lng: number | null; propertyType: string | null; isDemo: boolean };

export function NewCompReport({ props }: { props: P[] }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const subject = props.find((p) => p.id === subjectId);
  const candidates = useMemo(() => {
    if (!subject) return [];
    return props
      .filter((p) => p.id !== subject.id && (showAll || p.zip === subject.zip))
      .map((p) => ({ ...p, dist: haversineMiles(subject, p) }))
      .sort((a, b) => (a.dist ?? 99) - (b.dist ?? 99));
  }, [subject, props, showAll]);
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Subject property</Label>
          <select className="w-full rounded-md border bg-background px-3 py-2" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPicked([]); }}>
            <option value="">— Chọn căn cần định giá —</option>
            {props.map((p) => <option key={p.id} value={p.id}>{p.isDemo ? "[DEMO] " : ""}{p.address}, {p.city} {p.zip}</option>)}
          </select>
          <p className="text-xs text-muted-foreground mt-1">Chưa có trong danh sách? Thêm ở “Nhập dữ liệu nhà”.</p>
        </div>
        <div><Label>Tên báo cáo (tùy chọn)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      </div>
      {subject && (
        <>
          <div className="flex items-center gap-3">
            <strong>Chọn comps ứng viên</strong>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Hiện ngoài ZIP {subject.zip}</label>
          </div>
          <div className="max-h-80 overflow-auto rounded border divide-y">
            {candidates.map((c) => (
              <label key={c.id} className="flex items-center gap-2 px-2 py-1">
                <input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked(picked.includes(c.id) ? picked.filter((x) => x !== c.id) : [...picked, c.id])} />
                <span className="flex-1">{c.address} · {c.status ?? "?"} · {c.status === "sold" ? `sold $${c.soldPrice?.toLocaleString() ?? "?"} (${c.soldDate?.slice(0, 10) ?? "?"})` : `giá chào $${c.listPrice?.toLocaleString() ?? "?"}`} · {c.sqft ?? "?"} sqft</span>
                <span className="text-xs text-muted-foreground">{c.dist === null ? "không có tọa độ" : `${c.dist.toFixed(2)} mi`}</span>
              </label>
            ))}
          </div>
          <Button disabled={pending || picked.length === 0} onClick={() => start(async () => {
            const r = await createReportAction(subjectId, picked, title || undefined);
            if (!r.ok) return void toast.error(r.error);
            router.push(`/comps/${r.data!.id}`);
          })}>Tạo báo cáo với {picked.length} comps</Button>
        </>
      )}
    </div>
  );
}
