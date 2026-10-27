import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { gmailConfigured } from "@/lib/env";
import { googleAuthUrl } from "@/lib/email/gmail";

export async function GET() {
  if (!gmailConfigured()) return redirectTo("/settings?gmail=error");
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set("g_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return res;
}
