"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action";
import {
  approveDraft, confirmManualSent, generateDraft, rejectDraft, resolveUnknown, saveDraftAsExample, sendDraft, updateDraft,
} from "@/lib/drafts/service";
import { SCENARIOS } from "@/lib/drafts/state";

const GenSchema = z.object({
  clientId: z.string().min(1),
  scenario: z.enum(Object.keys(SCENARIOS) as [keyof typeof SCENARIOS, ...(keyof typeof SCENARIOS)[]]),
  channel: z.enum(["sms", "email"]),
  language: z.enum(["en", "vi"]),
  propertyIds: z.array(z.string()).max(10).default([]),
  threadId: z.string().nullable().optional(),
  instructions: z.string().max(1000).optional(),
});

export async function generateDraftAction(input: z.input<typeof GenSchema>) {
  return run(async () => {
    const d = await generateDraft(GenSchema.parse(input));
    revalidatePath("/drafts");
    return { id: d.id };
  });
}

const EditSchema = z.object({ body: z.string().min(1).max(20000), subject: z.string().max(300).nullable(), recipientAddress: z.string().max(200).nullable() });
export async function updateDraftAction(id: string, patch: z.input<typeof EditSchema>) {
  return run(async () => {
    const d = await updateDraft(id, EditSchema.parse(patch));
    revalidatePath(`/drafts/${id}`);
    return { status: d.status };
  }, "Đã lưu bản sửa");
}

export async function approveDraftAction(id: string) {
  return run(async () => {
    await approveDraft(id);
    revalidatePath(`/drafts/${id}`);
  }, "Đã duyệt nội dung và người nhận này");
}

export async function rejectDraftAction(id: string) {
  return run(async () => {
    await rejectDraft(id);
    revalidatePath(`/drafts/${id}`);
  }, "Đã từ chối bản nháp");
}

export async function sendDraftAction(id: string, allowCrossChannel = false) {
  return run(async () => {
    const r = await sendDraft(id, { allowCrossChannel });
    revalidatePath(`/drafts/${id}`);
    revalidatePath("/drafts");
    return r;
  });
}

export async function confirmManualSentAction(id: string) {
  return run(async () => {
    await confirmManualSent(id);
    revalidatePath(`/drafts/${id}`);
  }, "Đã ghi nhận bạn gửi thủ công trong FUB");
}

export async function resolveUnknownAction(id: string, userSays?: "sent" | "not_sent") {
  return run(async () => {
    const r = await resolveUnknown(id, userSays);
    revalidatePath(`/drafts/${id}`);
    return r;
  });
}

export async function saveAsExampleAction(id: string) {
  return run(async () => {
    await saveDraftAsExample(id);
  }, "Đã thêm vào ví dụ phong cách");
}
