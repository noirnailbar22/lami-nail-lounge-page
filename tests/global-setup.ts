import { execSync } from "node:child_process";
import net from "node:net";

function reachable(url: string) {
  const u = new URL(url);
  return new Promise<boolean>((resolve) => {
    const s = net.connect({ host: u.hostname, port: Number(u.port || 5432) }, () => (s.end(), resolve(true)));
    s.on("error", () => resolve(false));
    s.setTimeout(1500, () => (s.destroy(), resolve(false)));
  });
}

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/realtor_test";
  if (await reachable(url)) {
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
    process.env.TEST_DB_READY = "1";
  } else {
    console.warn("⚠ Không kết nối được database test — bỏ qua integration test. Chạy `npm run db:start` trước.");
  }
}
