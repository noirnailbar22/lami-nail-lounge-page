// Sao lưu toàn bộ dữ liệu app ra JSON (không cần pg_dump). Token OAuth vẫn ở dạng đã mã hóa.
// Dùng: npm run backup            → backups/backup-<thời gian>.json
// Trên Railway nên bật thêm backup Postgres của Railway hoặc dùng pg_dump (xem README).
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export const TABLES = [
  "setting", "styleProfile", "styleSample", "client", "interaction", "crmTask", "crmProposal", "property", "savedProperty",
  "searchRequest", "draft", "sendAttempt", "compRuleSet", "compExample", "compReport", "oAuthCredential", "webhookEvent", "syncRun", "actionLog",
] as const;

async function main() {
  const db = new PrismaClient();
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await (db[t] as unknown as { findMany: () => Promise<unknown[]> }).findMany();
  const dir = path.join(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables: out }, null, 1));
  console.log(`Đã sao lưu ${Object.values(out).reduce((n, r) => n + r.length, 0)} bản ghi → ${file}`);
  await db.$disconnect();
}

if (process.argv[1]?.endsWith("backup.ts")) main().catch((e) => (console.error(e), process.exit(1)));
