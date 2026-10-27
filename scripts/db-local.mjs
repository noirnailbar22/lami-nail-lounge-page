// Khởi động PostgreSQL thật (embedded-postgres) cho chạy local — không cài gì vào hệ thống.
// Dữ liệu nằm trong ./.pgdata. Dừng bằng Ctrl+C.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../.pgdata", import.meta.url));
const port = Number(process.env.LOCAL_PG_PORT || 5433);
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  onLog: () => {},
});

const fresh = !fs.existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
for (const name of ["realtor", "realtor_test"]) {
  try {
    await pg.createDatabase(name);
  } catch {
    /* đã tồn tại */
  }
}
console.log(`PostgreSQL local đang chạy ở cổng ${port} (dữ liệu: .pgdata). Ctrl+C để dừng.`);
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
