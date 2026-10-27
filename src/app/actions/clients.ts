"use server";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { ClientNeedsSchema } from "@/lib/clients/needs";
import { applyProposal, proposeFromNote, rejectProposal } from "@/lib/clients/proposals";
import { crmMode, syncInteractionsFromFub, syncPeopleFromFub } from "@/lib/crm";

export async function updateNeedsAction(clientId: string, needs: unknown) {
  return run(async () => {
    const parsed = ClientNeedsSchema.parse(needs);
    await db.client.update({ where: { id: clientId }, data: { needs: parsed as Prisma.InputJsonValue } });
    await logAction({ action: "client.needs_update", entityType: "Client", entityId: clientId });
    revalidatePath(`/clients/${clientId}`);
  }, "Đã lưu nhu cầu (trong app)");
}

export async function setOptOutAction(clientId: string, channel: "sms" | "email", value: boolean, note?: string) {
  return run(async () => {
    await db.client.update({ where: { id: clientId }, data: channel === "sms" ? { smsOptOut: value, optOutNote: note ?? null } : { emailOptOut: value, optOutNote: note ?? null } });
    await logAction({ action: "client.opt_out", entityType: "Client", entityId: clientId, details: { channel, value } });
    revalidatePath(`/clients/${clientId}`);
  }, value ? "Đã chặn gửi kênh này cho khách" : "Đã bỏ chặn");
}

export async function analyzeNoteAction(clientId: string, note: string) {
  return run(async () => {
    const text = z.string().min(5, "Ghi chú quá ngắn").max(10000).parse(note);
    const r = await proposeFromNote(clientId, text);
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/");
    return { warnings: r.analysis.warnings, count: r.proposals.length };
  }, "Đã tạo đề xuất — xem và duyệt từng mục");
}

export async function applyProposalAction(id: string, payload?: Record<string, unknown>) {
  return run(async () => {
    const r = await applyProposal(id, payload);
    revalidatePath("/");
    revalidatePath("/clients");
    return r;
  });
}

export async function rejectProposalAction(id: string) {
  return run(async () => {
    await rejectProposal(id);
    revalidatePath("/");
  }, "Đã bỏ đề xuất");
}

export async function syncFubAction() {
  return run(async () => {
    if (crmMode() !== "fub") throw new Error("Đang ở chế độ demo hoặc chưa có FUB_API_KEY.");
    const r = await syncPeopleFromFub();
    revalidatePath("/clients");
    return r;
  });
}

export async function syncClientAction(clientId: string) {
  return run(async () => {
    if (crmMode() !== "fub") throw new Error("Đang ở chế độ demo hoặc chưa có FUB_API_KEY.");
    const r = await syncInteractionsFromFub(clientId);
    revalidatePath(`/clients/${clientId}`);
    return r;
  });
}
