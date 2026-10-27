import type { Prisma } from "@prisma/client";
import { db } from "./db";

export type AppSettings = {
  /** Công tắc dừng mọi tự động hóa (đồng bộ nền, soạn tự động). Không ảnh hưởng thao tác thủ công. */
  automationPaused: boolean;
  /** Số ngày tối đa không liên lạc trước khi cần follow up, theo stage. */
  cadenceDays: Record<string, number>;
  /** Tag trong FUB được coi là opt-out SMS / email. */
  smsOptOutTags: string[];
  emailOptOutTags: string[];
  defaultLanguage: "en" | "vi";
  /** Stage không cần follow up (đối tác, agent, lender...). */
  excludedStages: string[];
};

export const DEFAULT_SETTINGS: AppSettings = {
  automationPaused: true,
  cadenceDays: {
    Lead: 2, "A - Hot 1-3 Months": 2, "Active Client": 3, "B - Warm 3-6 Months": 7, "C - Cold 6+ Months": 21,
    "Renter - future buyer": 30, Contact: 30, "Past Clients/Closed": 60, default: 14,
  },
  smsOptOutTags: ["Do Not Text", "DNT", "SMS Opt Out", "Opted Out", "STOP"],
  emailOptOutTags: ["Do Not Email", "Unsubscribed", "Email Opt Out", "Bounced"],
  defaultLanguage: "en",
  excludedStages: ["Trash", "Collaborator/ agent/lender/title....", "Referral Out To Others"],
};

export async function getSettings(): Promise<AppSettings> {
  const row = await db.setting.findUnique({ where: { key: "app" } });
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<AppSettings>) ?? {}) };
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const next = { ...(await getSettings()), ...patch };
  await db.setting.upsert({
    where: { key: "app" },
    create: { key: "app", value: next as unknown as Prisma.InputJsonValue },
    update: { value: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}
