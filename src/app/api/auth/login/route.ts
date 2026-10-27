import { NextResponse } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { SESSION_COOKIE, createSession } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { logAction } from "@/lib/audit";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const nextRaw = String(form.get("next") ?? "/");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected || (process.env.SESSION_SECRET ?? "").length < 32 || !safeEqual(password, expected)) {
    await logAction({ action: "auth.login", result: "blocked" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));
    return redirectTo(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  const res = redirectTo(next);
  res.cookies.set(SESSION_COOKIE, await createSession(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 14 * 86400 });
  await logAction({ action: "auth.login" }).catch(() => {});
  return res;
}
