// Khôi phục từ file backup JSON vào database TRỐNG (đã chạy migrate).
// Dùng: npm run restore -- backups/backup-....json
// Từ chối chạy nếu database đã có dữ liệu, để không ghi đè âm thầm.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { TABLES } from "./backup";

const DATE_KEYS = /(At|Date|Updated|expiresAt|at)$/;

function revive(row: Record<string, unknown>) {
  for (const [k, v] of Object.entries(row)) if (typeof v === "string" && DATE_KEYS.test(k) && /^\d{4}-\d{2}-\d{2}T/.test(v)) row[k] = new Date(v);
  return row;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Cần đường dẫn file backup.");
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as { tables: Record<string, Record<string, unknown>[]> };
  const db = new PrismaClient();
  const existing = (await db.client.count()) + (await db.draft.count()) + (await db.property.count());
  if (existing > 0) throw new Error("Database đích đã có dữ liệu — chỉ khôi phục vào database trống.");
  for (const t of TABLES) {
    const rows = (data.tables[t] ?? []).map(revive);
    if (rows.length) await (db[t] as unknown as { createMany: (a: { data: unknown[] }) => Promise<unknown> }).createMany({ data: rows });
    console.log(`${t}: ${rows.length}`);
  }
  await db.$disconnect();
  console.log("Khôi phục xong.");
}

main().catch((e) => (console.error(e.message), process.exit(1)));
