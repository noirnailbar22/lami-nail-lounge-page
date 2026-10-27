import Link from "next/link";
import { headers } from "next/headers";
import { env, aiEnabled, fubEnabled } from "@/lib/env";
import { NavLinks } from "./nav-links";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "";
  if (path.startsWith("/login") || path.includes("/print")) return <>{children}</>;
  const demo = env.demoMode;
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b md:border-b-0 md:border-r md:w-60 md:min-h-screen bg-muted/30 print:hidden">
        <div className="px-4 py-4">
          <Link href="/" className="font-semibold text-lg">Trợ lý Realtor</Link>
          <p className="text-xs text-muted-foreground">Follow Up Boss là CRM chính</p>
        </div>
        <NavLinks />
        <div className="px-4 py-4 text-xs text-muted-foreground space-y-1">
          <div>AI: {aiEnabled() ? "Claude (thật)" : "DEMO (mẫu cố định)"}</div>
          <div>CRM: {fubEnabled() ? "Follow Up Boss" : "DEMO"}</div>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        {demo && (
          <div className="bg-amber-100 text-amber-950 border-b border-amber-300 px-4 py-2 text-sm print:hidden" role="status">
            <strong>CHẾ ĐỘ DEMO</strong> — dữ liệu khách và nhà là hư cấu; không gửi tin thật, không ghi vào Follow Up Boss. Tắt bằng DEMO_MODE=false trong .env.
          </div>
        )}
        <main className="p-4 md:p-6 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
