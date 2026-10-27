import { NextResponse } from "next/server";

/** Chuyển hướng bằng đường dẫn tương đối — đúng cả khi chạy sau proxy (Railway) lẫn local. */
export function redirectTo(path: string, status: 303 | 307 = 303) {
  const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return new NextResponse(null, { status, headers: { Location: safe } });
}
