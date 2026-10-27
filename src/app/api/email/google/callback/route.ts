import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { exchangeGoogleCode } from "@/lib/email/gmail";
import { logAction } from "@/lib/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expected = (await cookies()).get("g_oauth_state")?.value;
  if (!code || !state || state !== expected) return redirectTo("/settings?gmail=error");
  try {
    const email = await exchangeGoogleCode(code);
    await logAction({ action: "gmail.connect", details: { email } });
    return redirectTo("/settings?gmail=ok");
  } catch (e) {
    await logAction({ action: "gmail.connect", result: "error", details: { error: (e as Error).message } });
    return redirectTo("/settings?gmail=error");
  }
}
