import { Badge } from "@/components/ui/badge";
import { DRAFT_STATUS } from "@/lib/drafts/state";
import { cn } from "@/lib/utils";

export function DemoTag({ show = true, label = "DEMO" }: { show?: boolean; label?: string }) {
  if (!show) return null;
  return <span className="inline-flex items-center rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-950">{label}</span>;
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
    <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status] ?? "bg-muted")}>
      {DRAFT_STATUS[status as keyof typeof DRAFT_STATUS] ?? status}
    </span>
  );
}

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {desc && <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{desc}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
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
