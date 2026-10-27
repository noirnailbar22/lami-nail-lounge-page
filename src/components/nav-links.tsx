"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Tổng quan" },
  { href: "/clients", label: "Khách hàng" },
  { href: "/drafts", label: "Bản nháp & gửi" },
  { href: "/style", label: "Giọng văn của tôi" },
  { href: "/properties", label: "Tìm nhà" },
  { href: "/properties/import", label: "Nhập dữ liệu nhà" },
  { href: "/comps", label: "Comps" },
  { href: "/comps/rules", label: "Quy tắc run comps" },
  { href: "/settings", label: "Kết nối & cài đặt" },
  { href: "/settings/log", label: "Nhật ký hành động" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="px-2 flex md:flex-col gap-1 overflow-x-auto">
      {ITEMS.map((i) => {
        const active = i.href === "/" ? path === "/" : path === i.href || (path.startsWith(i.href + "/") && !ITEMS.some((x) => x.href !== i.href && x.href.startsWith(i.href) && path.startsWith(x.href)));
        return (
          <Link key={i.href} href={i.href} className={cn("rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-muted", active && "bg-muted font-medium")}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
