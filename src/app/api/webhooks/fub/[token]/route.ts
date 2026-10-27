import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { receiveWebhook, verifyFubSignature } from "@/lib/crm/webhook";

const Payload = z.object({ eventId: z.string().min(1), event: z.string().min(1), resourceIds: z.array(z.number()).optional(), uri: z.string().nullable().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!env.fubWebhookToken || !safeEqual(token, env.fubWebhookToken)) return new NextResponse(null, { status: 404 });
  const raw = await req.text();
  if (!env.fubSystemKey || !verifyFubSignature(raw, req.headers.get("FUB-Signature"), env.fubSystemKey)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let body;
  try {
    body = Payload.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  const r = await receiveWebhook(body);
  return NextResponse.json({ ok: true, duplicate: r.duplicate });
}
