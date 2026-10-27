import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    // Đảm bảo migration đã chạy (bảng tồn tại), không trả về dữ liệu.
    await db.setting.count();
    return NextResponse.json({ ok: true, schema: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
