import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { env, fubEnabled } from "../env";
import { logAction } from "../audit";
import { FubClient, FubError } from "./fub-client";
import { mapAppointment, mapCall, mapEvent, mapNote, mapPerson, mapTask, mapText } from "./fub-map";
import { decideUpsert } from "./sync-plan";
import type { RemoteInteraction, RemotePerson } from "./types";

export type CrmMode = "fub" | "demo";
export const crmMode = (): CrmMode => (fubEnabled() ? "fub" : "demo");

export function fubClient() {
  if (!env.fubKey) throw new Error("Chưa cấu hình FUB_API_KEY");
  return new FubClient({ apiKey: env.fubKey, systemName: env.fubSystemName, systemKey: env.fubSystemKey || undefined });
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Lưu một người từ FUB, không tạo trùng (fubId unique) và không ghi đè bằng bản cũ. */
export async function upsertRemotePerson(p: RemotePerson) {
  const existing = await db.client.findUnique({ where: { fubId: p.fubId }, select: { id: true, remoteUpdated: true } });
  const decision = decideUpsert(existing, p);
  const mirror = {
    name: p.name,
    firstName: p.firstName ?? null,
    lastName: p.lastName ?? null,
    emails: json(p.emails),
    phones: json(p.phones),
    stage: p.stage ?? null,
    sourceLabel: p.sourceLabel ?? null,
    assignedTo: p.assignedTo ?? null,
    assignedUserId: p.assignedUserId ?? null,
    price: p.price ?? null,
    tags: json(p.tags),
    lastActivityAt: p.lastActivityAt ?? null,
    remoteUpdated: p.remoteUpdated ?? null,
    syncedAt: new Date(),
  };
  if (decision === "create") {
    const c = await db.client.create({ data: { source: "fub", fubId: p.fubId, ...mirror } });
    return { decision, id: c.id };
  }
  if (decision === "update") {
    // Chỉ cập nhật trường phản chiếu; giữ nguyên dữ liệu riêng của app (needs, opt-out cục bộ).
    await db.client.update({ where: { fubId: p.fubId }, data: mirror });
  }
  return { decision, id: existing!.id };
}

export async function syncPeopleFromFub(opts: { maxPeople?: number } = {}) {
  const run = await db.syncRun.create({ data: { provider: "fub", kind: "people" } });
  const counts = { created: 0, updated: 0, skipped: 0 };
  try {
    const fub = fubClient();
    let n = 0;
    for await (const raw of fub.paginate<Record<string, unknown>>("/people", "people", { sort: "-updated", fields: "allFields" })) {
      const r = await upsertRemotePerson(mapPerson(raw));
      if (r.decision === "create") counts.created++;
      else if (r.decision === "update") counts.updated++;
      else counts.skipped++;
      if (opts.maxPeople && ++n >= opts.maxPeople) break;
    }
    await db.syncRun.update({ where: { id: run.id }, data: { ...counts, status: "ok", finishedAt: new Date() } });
    await logAction({ action: "fub.sync.people", actor: "system", details: counts });
    return counts;
  } catch (e) {
    await db.syncRun.update({
      where: { id: run.id },
      data: { ...counts, status: "error", error: (e as Error).message, finishedAt: new Date() },
    });
    throw e;
  }
}

async function saveInteractions(clientId: string, source: string, items: RemoteInteraction[]) {
  const before = await db.interaction.count({ where: { clientId } });
  for (const it of items) {
    await db.interaction.upsert({
      where: { source_externalId: { source, externalId: it.externalId } },
      create: { clientId, source, ...it },
      update: { subject: it.subject ?? null, body: it.body ?? null, occurredAt: it.occurredAt },
    });
  }
  return (await db.interaction.count({ where: { clientId } })) - before;
}

/** Đọc lịch sử tương tác của một khách trong phạm vi API cho phép. Lỗi từng loại được ghi nhận, không chặn loại khác. */
export async function syncInteractionsFromFub(clientId: string) {
  const c = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  if (!c.fubId) return { errors: ["Khách không có FUB ID"] };
  const fub = fubClient();
  const errors: string[] = [];
  const all: RemoteInteraction[] = [];
  const sources: [string, string, (j: Record<string, unknown>) => RemoteInteraction][] = [
    ["/calls", "calls", mapCall],
    ["/textMessages", "textmessages", mapText],
    ["/events", "events", mapEvent],
    ["/notes", "notes", mapNote], // danh sách notes theo personId: chưa xác minh trong tài liệu
    ["/appointments", "appointments", mapAppointment],
  ];
  for (const [path, key, map] of sources) {
    // Tin nhắn: đọc toàn bộ để xem lại hội thoại; loại khác: 50 bản gần nhất.
    const cap = path === "/textMessages" ? 2000 : 50;
    try {
      let i = 0;
      for await (const raw of fub.paginate<Record<string, unknown>>(path, key, { personId: c.fubId, sort: "-created" })) {
        all.push(map(raw));
        if (++i >= cap) break;
      }
    } catch (e) {
      errors.push(`${path}: ${(e as FubError).message}`);
    }
  }
  const created = await saveInteractions(clientId, "fub", all);
  try {
    for await (const raw of fub.paginate<Record<string, unknown>>("/tasks", "tasks", { personId: c.fubId })) {
      const t = mapTask(raw);
      await db.crmTask.upsert({
        where: { fubId: t.fubId },
        create: { source: "fub", fubId: t.fubId, clientId, name: t.name, type: t.type, dueAt: t.dueAt, isCompleted: t.isCompleted },
        update: { name: t.name, type: t.type, dueAt: t.dueAt, isCompleted: t.isCompleted },
      });
    }
  } catch (e) {
    errors.push(`/tasks: ${(e as Error).message}`);
  }
  await db.client.update({ where: { id: clientId }, data: { interactionsSyncedAt: new Date() } });
  return { created, total: all.length, errors };
}

// ---------- Ghi vào CRM (chỉ được gọi sau khi người dùng duyệt) ----------

export type CrmWriteResult = { target: "fub" | "demo"; remoteId?: number; note?: string };

export async function writeNote(clientId: string, subject: string, body: string): Promise<CrmWriteResult> {
  const c = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  if (c.isDemo || !c.fubId || crmMode() === "demo") {
    await db.interaction.create({
      data: { clientId, source: "app", kind: "note", occurredAt: new Date(), subject, body, isDemo: c.isDemo },
    });
    return { target: "demo", note: "Ghi vào dữ liệu demo cục bộ — không gửi lên FUB." };
  }
  const r = await fubClient().request<{ id: number }>("POST", "/notes", {
    body: { personId: c.fubId, subject, body, isHtml: false },
  });
  await db.interaction.create({
    data: { clientId, source: "fub", externalId: `note:${r.id}`, kind: "note", occurredAt: new Date(), subject, body },
  });
  return { target: "fub", remoteId: r.id };
}

export async function writeTask(
  clientId: string,
  t: { name: string; type?: string; dueDate?: string },
): Promise<CrmWriteResult> {
  const c = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const dueAt = t.dueDate ? new Date(t.dueDate + "T09:00:00") : undefined;
  if (c.isDemo || !c.fubId || crmMode() === "demo") {
    await db.crmTask.create({ data: { clientId, source: "app", name: t.name, type: t.type, dueAt, isDemo: c.isDemo } });
    return { target: "demo", note: "Tạo việc trong dữ liệu demo cục bộ — không gửi lên FUB." };
  }
  if (!c.assignedUserId && !c.assignedTo) throw new Error("Khách chưa có người phụ trách trong FUB — FUB yêu cầu assignedUserId khi tạo task.");
  const r = await fubClient().request<Record<string, unknown>>("POST", "/tasks", {
    body: {
      personId: c.fubId,
      name: t.name,
      type: t.type,
      dueDate: t.dueDate,
      ...(c.assignedUserId ? { assignedUserId: c.assignedUserId } : { assignedTo: c.assignedTo }),
    },
  });
  const mt = mapTask(r);
  await db.crmTask.create({ data: { clientId, source: "fub", fubId: mt.fubId, name: mt.name, type: mt.type, dueAt: mt.dueAt } });
  return { target: "fub", remoteId: mt.fubId };
}
