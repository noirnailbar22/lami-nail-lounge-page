import { Badge } from "@/components/ui/badge";
import { DRAFT_STATUS } from "@/lib/drafts/state";
import { cn } from "@/lib/utils";

export function DemoTag({ show = true, label = "DEMO" }: { show?: boolean; label?: string }) {
  if (!show) return null;
  return <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-800 ring-1 ring-amber-300/60">{label}</span>;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  approved: "bg-blue-100 text-blue-900",
  rejected: "bg-slate-200 text-slate-600 line-through",
  needs_manual_send: "bg-orange-100 text-orange-900",
  manual_confirmed: "bg-emerald-100 text-emerald-900",
  sending: "bg-blue-100 text-blue-900",
  sent: "bg-emerald-600 text-white",
  sent_demo: "bg-amber-200 text-amber-950",
  failed: "bg-red-100 text-red-900",
  unknown: "bg-red-600 text-white",
};

export function DraftStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[status] ?? "bg-muted")}>
      {DRAFT_STATUS[status as keyof typeof DRAFT_STATUS] ?? status}
    </span>
  );
}

export function PageHeader({ title, desc, children, eyebrow }: { title: string; desc?: string; children?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</div>}
        <h1 className="text-[28px] md:text-[32px] font-bold leading-tight">{title}</h1>
        {desc && <p className="text-sm text-muted-foreground mt-1.5 max-w-3xl">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint, tone, icon }: { label: string; value: number | string; hint?: string; tone: "emerald" | "coral" | "violet" | "gold"; icon: React.ReactNode }) {
  const tones = {
    emerald: { bg: "from-emerald-500/15 to-teal-500/5", fg: "text-emerald-700" },
    coral: { bg: "from-orange-500/15 to-rose-500/5", fg: "text-orange-700" },
    violet: { bg: "from-violet-500/15 to-indigo-500/5", fg: "text-violet-700" },
    gold: { bg: "from-amber-400/20 to-yellow-500/5", fg: "text-amber-700" },
  } as const;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(16,40,40,0.04),0_12px_32px_-16px_rgba(16,40,40,0.18)]">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", tones[tone].bg)} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={cn("grid size-10 place-items-center rounded-xl bg-white/80 shadow-sm", tones[tone].fg)}>{icon}</div>
      </div>
    </div>
  );
}

export function CardIconTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-7 place-items-center rounded-lg bg-secondary text-secondary-foreground [&>svg]:size-4">{icon}</span>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-3">{children}</p>;
}

export function ConnBadge({ state }: { state: "active" | "demo" | "blocked" | "manual" | "error" | "not_configured" }) {
  const map = {
    active: ["Đang hoạt động", "bg-emerald-100 text-emerald-900"],
    demo: ["Demo", "bg-amber-200 text-amber-950"],
    blocked: ["Bị chặn bởi quyền truy cập", "bg-slate-200 text-slate-700"],
    manual: ["Thủ công", "bg-blue-100 text-blue-900"],
    error: ["Lỗi", "bg-red-100 text-red-900"],
    not_configured: ["Chưa cấu hình", "bg-slate-100 text-slate-700"],
  } as const;
  const [label, cls] = map[state];
  return <Badge variant="outline" className={cn("border-0", cls)}>{label}</Badge>;
}

export const fmtDate = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString("vi-VN") : "—");
export const fmtDateTime = (d: Date | null | undefined) => (d ? new Date(d).toLocaleString("vi-VN") : "—");

export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(16,40,40,0.04),0_12px_32px_-16px_rgba(16,40,40,0.18)] [&_th]:bg-muted/60 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_td]:py-3 [&_tr:hover_td]:bg-secondary/40">
      {children}
    </div>
  );
}

export function StagePill({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-muted-foreground">—</span>;
  const s = stage.toLowerCase();
  const cls = /hot|^a /.test(s)
    ? "bg-rose-50 text-rose-700 ring-rose-200"
    : /warm|^b /.test(s)
      ? "bg-orange-50 text-orange-700 ring-orange-200"
      : /cold|^c /.test(s)
        ? "bg-sky-50 text-sky-700 ring-sky-200"
        : /active|pending/.test(s)
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : /past|closed/.test(s)
            ? "bg-violet-50 text-violet-700 ring-violet-200"
            : /lead/.test(s)
              ? "bg-amber-50 text-amber-800 ring-amber-200"
              : "bg-muted text-muted-foreground ring-black/5";
  return <span className={cn("inline-flex max-w-[16rem] truncate rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", cls)}>{stage}</span>;
}
