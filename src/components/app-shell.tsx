import Link from "next/link";
import { headers } from "next/headers";
import { Home } from "lucide-react";
import { env, aiEnabled, fubEnabled } from "@/lib/env";
import { NavLinks } from "./nav-links";

function StatusDot({ on, label, value }: { on: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-sidebar-foreground/60">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-sidebar-foreground">
        <span className={`size-1.5 rounded-full ${on ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" : "bg-amber-400"}`} />
        {value}
      </span>
    </div>
  );
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "";
  if (path.startsWith("/login") || path.includes("/print")) return <>{children}</>;
  const demo = env.demoMode;
  return (
    <div className="min-h-screen md:flex">
      <aside className="print:hidden bg-sidebar text-sidebar-foreground md:w-64 md:min-h-screen md:sticky md:top-0 md:h-screen flex flex-col">
        <div className="px-5 pt-5 pb-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-teal-500 text-emerald-950 shadow-lg shadow-emerald-900/40">
              <Home className="size-5" strokeWidth={2.4} />
            </span>
            <span>
              <span className="block font-semibold text-white leading-tight">Trợ lý Realtor</span>
              <span className="block text-[11px] text-sidebar-foreground/60">{[env.signature.name, env.signature.company].filter(Boolean).join(" · ")}</span>
            </span>
          </Link>
        </div>
        <NavLinks />
        <div className="hidden md:block mt-auto m-3 rounded-xl bg-sidebar-accent/70 p-3 space-y-2 ring-1 ring-white/5">
          <StatusDot on={aiEnabled()} label="AI" value={aiEnabled() ? "Claude" : "Demo"} />
          <StatusDot on={fubEnabled()} label="CRM" value={fubEnabled() ? "Follow Up Boss" : "Demo"} />
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        {demo && (
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-950 border-b border-amber-200 px-6 py-2 text-sm print:hidden" role="status">
            <strong>CHẾ ĐỘ DEMO</strong> — dữ liệu hư cấu; không gửi tin thật, không ghi vào Follow Up Boss.
          </div>
        )}
        <main className="px-4 py-6 md:px-10 md:py-8 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
