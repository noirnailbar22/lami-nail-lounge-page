"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, MessageSquareText, PenLine, Search, Upload, Calculator, Ruler, Plug, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS = [
  { label: "Hằng ngày", items: [
    { href: "/", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/clients", label: "Khách hàng", icon: Users },
    { href: "/drafts", label: "Bản nháp & gửi", icon: MessageSquareText },
    { href: "/style", label: "Giọng văn của tôi", icon: PenLine },
  ] },
  { label: "Nhà & giá", items: [
    { href: "/properties", label: "Tìm nhà", icon: Search },
    { href: "/properties/import", label: "Nhập dữ liệu nhà", icon: Upload },
    { href: "/comps", label: "Comps", icon: Calculator },
    { href: "/comps/rules", label: "Quy tắc run comps", icon: Ruler },
  ] },
  { label: "Hệ thống", items: [
    { href: "/settings", label: "Kết nối & cài đặt", icon: Plug },
    { href: "/settings/log", label: "Nhật ký", icon: ScrollText },
  ] },
];
const ALL = GROUPS.flatMap((g) => g.items);

export function NavLinks() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : (path === href || path.startsWith(href + "/")) && !ALL.some((x) => x.href !== href && x.href.startsWith(href) && path.startsWith(x.href));
  return (
    <nav className="px-3 pb-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
      {GROUPS.map((g) => (
        <div key={g.label} className="contents md:block md:mb-3">
          <div className="hidden md:block px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">{g.label}</div>
          {g.items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-md shadow-black/20" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "" : "text-sidebar-foreground/50 group-hover:text-sidebar-primary")} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
