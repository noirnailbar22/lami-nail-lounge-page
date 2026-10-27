import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authMisconfigured, authRequired, verifySession } from "@/lib/auth";

const PUBLIC = ["/login", "/api/auth/login", "/api/health", "/api/webhooks/fub"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  const pass = () => NextResponse.next({ request: { headers } });

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return pass();
  if (authMisconfigured()) {
    return new NextResponse("Thiếu APP_PASSWORD hoặc SESSION_SECRET (>= 32 ký tự) — app không chạy online khi chưa có đăng nhập.", { status: 503 });
  }
  if (!authRequired()) return pass();
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return pass();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
