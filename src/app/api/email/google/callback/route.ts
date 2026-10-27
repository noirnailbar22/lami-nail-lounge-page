import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/email/gmail";
import { logAction } from "@/lib/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expected = (await cookies()).get("g_oauth_state")?.value;
  if (!code || !state || state !== expected) return NextResponse.redirect(new URL("/settings?gmail=error", req.url));
  try {
    const email = await exchangeGoogleCode(code);
    await logAction({ action: "gmail.connect", details: { email } });
    return NextResponse.redirect(new URL("/settings?gmail=ok", req.url));
  } catch (e) {
    await logAction({ action: "gmail.connect", result: "error", details: { error: (e as Error).message } });
    return NextResponse.redirect(new URL("/settings?gmail=error", req.url));
  }
}
