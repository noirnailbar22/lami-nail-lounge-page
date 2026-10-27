"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncClientAction } from "@/app/actions/clients";

/** Tự đọc lịch sử từ FUB (chỉ đọc) khi mở hồ sơ, nếu lần đọc trước đã quá `maxAgeMin` phút. */
export function AutoSync({ clientId, lastSyncedAt, maxAgeMin = 10 }: { clientId: string; lastSyncedAt: string | null; maxAgeMin?: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const started = useRef(false);

  const run = async () => {
    setState("loading");
    const r = await syncClientAction(clientId);
    if (!r.ok) {
      setState("error");
      setError(r.error);
      return;
    }
    setState("idle");
    router.refresh();
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > maxAgeMin * 60_000;
    if (stale) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {state === "loading" ? (
        <span className="flex items-center gap-1.5"><RefreshCw className="size-3.5 animate-spin" /> Đang đọc tin nhắn từ FUB…</span>
      ) : state === "error" ? (
        <span className="text-rose-700">Không đọc được từ FUB: {error}</span>
      ) : (
        <span>Cập nhật từ FUB: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("vi-VN") : "chưa"}</span>
      )}
      <button onClick={() => void run()} disabled={state === "loading"} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-black/10 hover:bg-muted disabled:opacity-50">
        <RefreshCw className="size-3" /> Tải lại
      </button>
    </div>
  );
}
