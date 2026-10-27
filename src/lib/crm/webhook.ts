import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { fubClient, upsertRemotePerson } from "./index";
import { mapPerson } from "./fub-map";

// Chỉ xử lý các sự kiện có trong tài liệu webhook chính thức của FUB.
export const HANDLED_EVENTS = ["peopleCreated", "peopleUpdated", "peopleStageUpdated", "peopleTagsCreated"] as const;
export const LOGGED_ONLY_EVENTS = ["peopleDeleted", "notesCreated", "textMessagesCreated", "callsCreated", "tasksCreated", "tasksUpdated"];

/**
 * FUB-Signature: tài liệu viết "SHA256", mã mẫu dùng HMAC-SHA256 trên body base64, khóa = X-System-Key.
 * Cần kiểm tra lại với webhook thật trước khi bật.
 */
export function verifyFubSignature(rawBody: string, signature: string | null, systemKey: string): boolean {
  if (!signature || !systemKey) return false;
  const expected = crypto.createHmac("sha256", systemKey).update(Buffer.from(rawBody).toString("base64")).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type FubWebhookPayload = { eventId: string; event: string; resourceIds?: number[]; uri?: string | null };

/** Lưu nhanh rồi xử lý; eventId unique nên sự kiện gửi lại không bị xử lý hai lần. */
export async function receiveWebhook(p: FubWebhookPayload) {
  const existing = await db.webhookEvent.findUnique({ where: { eventId: p.eventId } });
  if (existing) return { duplicate: true };
  const row = await db.webhookEvent.create({
    data: { eventId: p.eventId, event: p.event, uri: p.uri ?? null, resourceIds: (p.resourceIds ?? []) as Prisma.InputJsonValue },
  });
  try {
    if ((HANDLED_EVENTS as readonly string[]).includes(p.event) && env.fubKey) {
      const fub = fubClient();
      for (const id of p.resourceIds ?? []) {
        const person = await fub.request<Record<string, unknown>>("GET", `/people/${id}`, { query: { fields: "allFields" } });
        await upsertRemotePerson(mapPerson(person));
      }
    }
    await db.webhookEvent.update({ where: { id: row.id }, data: { processedAt: new Date() } });
  } catch (e) {
    await db.webhookEvent.update({ where: { id: row.id }, data: { error: (e as Error).message } });
  }
  return { duplicate: false };
}
