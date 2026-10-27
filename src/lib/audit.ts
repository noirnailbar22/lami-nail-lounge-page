import type { Prisma } from "@prisma/client";
import { db } from "./db";

const SECRET_KEYS = /token|secret|password|authorization|api[_-]?key/i;

function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SECRET_KEYS.test(k) ? "[ẩn]" : scrub(x)]),
    );
  }
  return v;
}

export async function logAction(input: {
  action: string;
  entityType?: string;
  entityId?: string;
  result?: "ok" | "blocked" | "error";
  actor?: "user" | "system" | "ai";
  details?: Record<string, unknown>;
}) {
  await db.actionLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      result: input.result ?? "ok",
      actor: input.actor ?? "user",
      details: (input.details ? scrub(input.details) : undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
