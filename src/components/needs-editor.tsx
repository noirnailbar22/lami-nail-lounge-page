"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FiltersEditor } from "./filters-editor";
import { updateNeedsAction } from "@/app/actions/clients";
import type { ClientNeeds } from "@/lib/clients/needs";

export function NeedsEditor({ clientId, initial }: { clientId: string; initial: ClientNeeds }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <FiltersEditor value={v} onChange={setV} />
      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div><Label>Thời gian dự kiến</Label><Input value={v.timeline ?? ""} onChange={(e) => setV({ ...v, timeline: e.target.value || null })} /></div>
        <div>
          <Label>Pre-approval</Label>
          <select className="w-full rounded-md border bg-background px-3 py-2" value={v.preApproved === null ? "" : String(v.preApproved)} onChange={(e) => setV({ ...v, preApproved: e.target.value === "" ? null : e.target.value === "true" })}>
            <option value="">Chưa biết</option><option value="true">Đã có</option><option value="false">Chưa có</option>
          </select>
        </div>
        <div><Label>Ghi chú</Label><Input value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value || null })} /></div>
      </div>
      <Button disabled={pending} onClick={() => start(async () => {
        const r = await updateNeedsAction(clientId, v);
        if (r.ok) toast.success(r.message); else toast.error(r.error);
      })}>Lưu nhu cầu</Button>
    </div>
  );
}
