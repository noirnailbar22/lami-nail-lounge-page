import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: string; direction: string | null; occurredAt: Date; body: string | null; subject: string | null };

const dayLabel = (d: Date) => d.toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "numeric", year: "numeric" });
const time = (d: Date) => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

/** Hội thoại SMS. FUB ẩn nội dung SMS qua API — khi đó chỉ hiện tóm tắt hoạt động, không hiện bong bóng rỗng. */
export function SmsThread({ messages, clientName, fubId }: { messages: Msg[]; clientName: string; fubId: number | null }) {
  const sorted = [...messages].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const visible = sorted.filter((m) => m.body);
  const hidden = sorted.filter((m) => !m.body && m.subject === "FUB_HIDDEN");
  const last = sorted.at(-1);
  const lastIn = [...sorted].reverse().find((m) => m.direction === "in");
  const lastOut = [...sorted].reverse().find((m) => m.direction === "out");
  let lastDay = "";
  return (
    <div className="space-y-3">
      {hidden.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
          <div className="flex items-center gap-2 font-semibold text-amber-900"><EyeOff className="size-4" /> FUB không cho đọc nội dung tin nhắn qua API</div>
          <p className="mt-1 text-amber-900/80">Follow Up Boss chỉ hiện nội dung SMS bên trong app FUB. Ở đây chỉ có thời gian và chiều gửi.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-white/70 p-2"><div className="text-[11px] text-muted-foreground">Tổng tin</div><div className="font-semibold">{hidden.length}</div></div>
            <div className="rounded-lg bg-white/70 p-2"><div className="text-[11px] text-muted-foreground">Khách gửi</div><div className="font-semibold">{hidden.filter((m) => m.direction === "in").length}</div></div>
            <div className="rounded-lg bg-white/70 p-2"><div className="text-[11px] text-muted-foreground">Khách nhắn gần nhất</div><div className="font-semibold">{lastIn ? lastIn.occurredAt.toLocaleDateString("vi-VN") : "—"}</div></div>
            <div className="rounded-lg bg-white/70 p-2"><div className="text-[11px] text-muted-foreground">Mình nhắn gần nhất</div><div className="font-semibold">{lastOut ? lastOut.occurredAt.toLocaleDateString("vi-VN") : "—"}</div></div>
          </div>
          {last && <p className="mt-2 text-xs text-amber-900/70">Tin gần nhất: {last.direction === "in" ? `${clientName} gửi` : "mình gửi"} lúc {last.occurredAt.toLocaleString("vi-VN")}{last.direction === "in" ? " — có thể khách đang chờ trả lời." : "."}</p>}
          {fubId && (
            <a href={`https://app.followupboss.com/2/people/view/${fubId}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950">
              Mở hội thoại trong FUB ↗
            </a>
          )}
        </div>
      )}
      {visible.length > 0 && (
        <div className="flex max-h-[34rem] flex-col-reverse overflow-y-auto rounded-xl bg-muted/50 p-4">
          <div className="space-y-1.5">
            {visible.map((m) => {
              const d = dayLabel(m.occurredAt);
              const showDay = d !== lastDay;
              lastDay = d;
              const out = m.direction === "out";
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-card px-3 py-0.5 text-[11px] text-muted-foreground ring-1 ring-black/5">{d}</span>
                    </div>
                  )}
                  <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm", out ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card text-foreground ring-1 ring-black/5")}>
                      {m.body}
                      <div className={cn("mt-1 text-[10px]", out ? "text-primary-foreground/70 text-right" : "text-muted-foreground")}>
                        {out ? (m.subject ? `${m.subject} · ` : "") : `${clientName} · `}
                        {time(m.occurredAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
