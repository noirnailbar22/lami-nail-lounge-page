import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { logAction } from "../audit";
import { crmMode, writeNote, writeTask } from "../crm";
import { analyzeCallNote } from "../ai/notes";
import { parseNeeds, needsSummary } from "./needs";

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Từ ghi chú sau cuộc gọi → các đề xuất (note, task, cập nhật nhu cầu). Chưa ghi gì vào CRM. */
export async function proposeFromNote(clientId: string, note: string) {
  const c = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const a = await analyzeCallNote(note, { name: c.name, stage: c.stage, needs: needsSummary(parseNeeds(c.needs)) });
  const target = c.isDemo || !c.fubId || crmMode() === "demo" ? "demo" : "fub";
  const created = [];
  created.push(
    await db.crmProposal.create({
      data: { clientId, kind: "note", target, payload: json({ subject: "Ghi chú sau cuộc gọi/showing", body: `${a.summary}\n\n---\nGhi chú gốc:\n${note}` }), rationale: a.generator === "ai" ? "AI tóm tắt" : "DEMO tóm tắt bằng quy tắc" },
    }),
  );
  const n = a.needsChanges;
  const changes = Object.fromEntries(Object.entries(n).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)));
  if (Object.keys(changes).length) {
    created.push(await db.crmProposal.create({ data: { clientId, kind: "needs_update", target: "demo", payload: json(changes), rationale: "Thay đổi nhu cầu rút từ ghi chú — lưu trong app (FUB không có trường chuẩn tương ứng)." } }));
  }
  for (const t of a.nextTasks) {
    const due = new Date(Date.now() + t.dueInDays * 86_400_000).toISOString().slice(0, 10);
    created.push(await db.crmProposal.create({ data: { clientId, kind: "task", target, payload: json({ name: t.name, type: t.type, dueDate: due }) } }));
  }
  await logAction({ action: "note.analyze", entityType: "Client", entityId: clientId, actor: a.generator === "ai" ? "ai" : "system", details: { proposals: created.length } });
  return { analysis: a, proposals: created };
}

/** Áp dụng một đề xuất SAU KHI người dùng duyệt. Payload có thể đã được người dùng sửa. */
export async function applyProposal(id: string, editedPayload?: Record<string, unknown>) {
  const p = await db.crmProposal.findUniqueOrThrow({ where: { id } });
  if (p.status !== "proposed" && p.status !== "failed") throw new Error("Đề xuất này đã được xử lý.");
  const payload = (editedPayload ?? p.payload) as Record<string, unknown>;
  await db.crmProposal.update({ where: { id }, data: { status: "approved", decidedAt: new Date(), payload: json(payload) } });
  try {
    let result: unknown;
    if (p.kind === "note") result = await writeNote(p.clientId, String(payload.subject ?? "Ghi chú"), String(payload.body ?? ""));
    else if (p.kind === "task") result = await writeTask(p.clientId, { name: String(payload.name), type: payload.type as string | undefined, dueDate: payload.dueDate as string | undefined });
    else if (p.kind === "needs_update") {
      const c = await db.client.findUniqueOrThrow({ where: { id: p.clientId } });
      const merged = parseNeeds({ ...parseNeeds(c.needs), ...payload });
      await db.client.update({ where: { id: p.clientId }, data: { needs: json(merged) } });
      result = { target: "app", note: "Đã cập nhật nhu cầu trong app." };
    }
    await db.crmProposal.update({ where: { id }, data: { status: "applied", appliedAt: new Date(), result: json(result) } });
    await logAction({ action: `proposal.apply.${p.kind}`, entityType: "CrmProposal", entityId: id, details: { target: p.target } });
    return result;
  } catch (e) {
    await db.crmProposal.update({ where: { id }, data: { status: "failed", error: (e as Error).message } });
    await logAction({ action: `proposal.apply.${p.kind}`, entityType: "CrmProposal", entityId: id, result: "error", details: { error: (e as Error).message } });
    throw e;
  }
}

export async function rejectProposal(id: string) {
  await logAction({ action: "proposal.reject", entityType: "CrmProposal", entityId: id });
  return db.crmProposal.update({ where: { id }, data: { status: "rejected", decidedAt: new Date() } });
}
