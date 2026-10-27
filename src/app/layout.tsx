import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";

const font = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-vn", display: "swap" });

export const metadata: Metadata = {
  title: "Trợ lý Realtor",
  description: "Assistant cho công việc realtor: tìm nhà, follow up, run comps",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="antialiased app-bg text-foreground min-h-screen">
        <AppShell>{children}</AppShell>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
