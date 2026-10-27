"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action";
import { logAction } from "@/lib/audit";
import { saveSettings } from "@/lib/settings";

export async function setAutomationPausedAction(paused: boolean) {
  return run(async () => {
    await saveSettings({ automationPaused: paused });
    await logAction({ action: paused ? "automation.pause" : "automation.resume" });
    revalidatePath("/settings");
    revalidatePath("/");
  }, paused ? "Đã DỪNG mọi tự động hóa" : "Đã bật lại tự động hóa");
}

const Schema = z.object({
  cadenceDays: z.record(z.string(), z.number().int().min(1).max(365)),
  smsOptOutTags: z.array(z.string().min(1)).max(50),
  emailOptOutTags: z.array(z.string().min(1)).max(50),
  defaultLanguage: z.enum(["en", "vi"]),
  excludedStages: z.array(z.string().min(1)).max(50).optional(),
});

export async function saveSettingsAction(input: z.input<typeof Schema>) {
  return run(async () => {
    await saveSettings(Schema.parse(input));
    await logAction({ action: "settings.save" });
    revalidatePath("/settings");
  }, "Đã lưu cài đặt");
}
