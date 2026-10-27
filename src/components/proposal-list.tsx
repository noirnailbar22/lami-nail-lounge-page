"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { applyProposalAction, rejectProposalAction } from "@/app/actions/clients";

type P = { id: string; kind: string; target: string; status: string; payload: Record<string, unknown>; rationale: string | null; error: string | null; clientName: string };

const KIND: Record<string, string> = { note: "Ghi chú", task: "Việc cần làm", needs_update: "Cập nhật nhu cầu" };

function Item({ p }: { p: P }) {
  const [payload, setPayload] = useState(p.payload);
  const [pending, start] = useTransition();
  const target = p.kind === "needs_update" ? "Lưu trong app" : p.target === "fub" ? "Ghi vào Follow Up Boss" : "Ghi vào dữ liệu DEMO (không lên FUB)";
  return (
    <li className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span><strong>{KIND[p.kind] ?? p.kind}</strong> · {p.clientName}</span>
        <span className="text-xs rounded bg-muted px-2 py-0.5">Đích: {target}</span>
      </div>
      {p.kind === "note" && (
        <Textarea rows={4} value={String(payload.body ?? "")} onChange={(e) => setPayload({ ...payload, body: e.target.value })} aria-label="Nội dung ghi chú" />
      )}
      {p.kind === "task" && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Input value={String(payload.name ?? "")} onChange={(e) => setPayload({ ...payload, name: e.target.value })} aria-label="Tên việc" />
          <Input value={String(payload.type ?? "")} onChange={(e) => setPayload({ ...payload, type: e.target.value })} aria-label="Loại" />
          <Input type="date" value={String(payload.dueDate ?? "")} onChange={(e) => setPayload({ ...payload, dueDate: e.target.value })} aria-label="Hạn" />
        </div>
      )}
      {p.kind === "needs_update" && <pre className="text-xs bg-muted rounded p-2 whitespace-pre-wrap">{JSON.stringify(payload, null, 1)}</pre>}
      {p.rationale && <p className="text-xs text-muted-foreground">{p.rationale}</p>}
      {p.error && <p className="text-xs text-red-700">Lần trước lỗi: {p.error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => start(async () => {
          const r = await applyProposalAction(p.id, payload);
          if (r.ok) toast.success("Đã áp dụng"); else toast.error(r.error);
        })}>Duyệt & ghi</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
          const r = await rejectProposalAction(p.id);
          if (r.ok) toast.success(r.message); else toast.error(r.error);
        })}>Bỏ</Button>
      </div>
    </li>
  );
}

export function ProposalList({ proposals }: { proposals: P[] }) {
  return <ul className="space-y-3">{proposals.map((p) => <Item key={p.id} p={p} />)}</ul>;
}
