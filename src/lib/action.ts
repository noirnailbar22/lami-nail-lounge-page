import { ZodError } from "zod";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: "Dữ liệu không hợp lệ: " + e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") };
    console.error("[action]", (e as Error).message);
    return { ok: false, error: (e as Error).message || "Lỗi không xác định" };
  }
}
