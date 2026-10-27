"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncClientAction, syncFubAction } from "@/app/actions/clients";

export function SyncFubButton({ clientId }: { clientId?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = clientId ? await syncClientAction(clientId) : await syncFubAction();
          if (!r.ok) return void toast.error(r.error);
          const d = r.data as Record<string, unknown>;
          toast.success(clientId ? `Đã đọc ${d.total} tương tác (${d.created} mới)${(d.errors as string[]).length ? " — một số loại lỗi, xem chi tiết" : ""}` : `Đồng bộ xong: ${d.created} mới, ${d.updated} cập nhật, ${d.skipped} bỏ qua`);
          if (clientId && (d.errors as string[]).length) for (const e of d.errors as string[]) toast.warning(e);
        })
      }
    >
      {pending ? "Đang đọc từ FUB…" : clientId ? "Đọc lịch sử từ FUB" : "Đồng bộ khách từ FUB (chỉ đọc)"}
    </Button>
  );
}
