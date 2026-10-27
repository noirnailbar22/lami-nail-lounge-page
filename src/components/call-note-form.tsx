"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeNoteAction } from "@/app/actions/clients";

export function CallNoteForm({ clients, fixedClientId }: { clients: { id: string; name: string }[]; fixedClientId?: string }) {
  const [clientId, setClientId] = useState(fixedClientId ?? "");
  const [note, setNote] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await analyzeNoteAction(clientId, note);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          setWarnings(r.data?.warnings ?? []);
          setNote("");
        });
      }}
    >
      {!fixedClientId && (
        <select required className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Khách hàng">
          <option value="">— Chọn khách —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <Textarea required rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd. Gọi Linh: tăng ngân sách lên $480k, muốn 4 phòng ngủ, cần garage. Hẹn xem nhà thứ 7." />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !clientId}>{pending ? "Đang phân tích…" : "Tóm tắt & đề xuất việc tiếp theo"}</Button>
        <span className="text-xs text-muted-foreground">Chưa ghi gì vào FUB — bạn duyệt từng đề xuất.</span>
      </div>
      {warnings.length > 0 && <ul className="text-xs text-amber-800 list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
    </form>
  );
}
