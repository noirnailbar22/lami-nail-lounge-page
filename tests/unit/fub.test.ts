import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { FubClient, FubError } from "@/lib/crm/fub-client";
import { decideUpsert } from "@/lib/crm/sync-plan";
import { mapPerson } from "@/lib/crm/fub-map";
import { verifyFubSignature } from "@/lib/crm/webhook";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

describe("decideUpsert — không trùng, không ghi đè bằng bản cũ", () => {
  const t = (s: string) => new Date(s);
  it("tạo mới khi chưa có", () => expect(decideUpsert(null, { remoteUpdated: t("2026-01-02") })).toBe("create"));
  it("cập nhật khi bản đến mới hơn", () => expect(decideUpsert({ remoteUpdated: t("2026-01-01") }, { remoteUpdated: t("2026-01-02") })).toBe("update"));
  it("bỏ qua bản cũ hơn", () => expect(decideUpsert({ remoteUpdated: t("2026-01-03") }, { remoteUpdated: t("2026-01-02") })).toBe("skip_stale"));
  it("bỏ qua bản không đổi", () => expect(decideUpsert({ remoteUpdated: t("2026-01-02") }, { remoteUpdated: t("2026-01-02") })).toBe("skip_unchanged"));
  it("không có mốc thời gian ở bản đến → không ghi đè bản đã có mốc", () => expect(decideUpsert({ remoteUpdated: t("2026-01-02") }, {})).toBe("skip_stale"));
});

describe("FubClient", () => {
  const opts = { apiKey: "k", systemName: "Test", sleep: async () => {} };

  it("đi hết các trang bằng _metadata.next", async () => {
    const calls: string[] = [];
    const client = new FubClient({
      ...opts,
      fetchImpl: async (url) => {
        calls.push(url);
        const next = new URL(url).searchParams.get("next");
        if (!next) return json({ people: [{ id: 1 }, { id: 2 }], _metadata: { next: "abc" } });
        if (next === "abc") return json({ people: [{ id: 3 }], _metadata: { next: null } });
        throw new Error("unexpected");
      },
    });
    const ids: number[] = [];
    for await (const p of client.paginate<{ id: number }>("/people", "people")) ids.push(p.id);
    expect(ids).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("limit=100");
  });

  it("429: chờ Retry-After rồi gửi lại", async () => {
    const waits: number[] = [];
    let n = 0;
    const client = new FubClient({
      ...opts,
      sleep: async (ms) => void waits.push(ms),
      fetchImpl: async () => (++n === 1 ? json({}, 429, { "Retry-After": "3" }) : json({ ok: 1 })),
    });
    await expect(client.request("POST", "/notes", { body: {} })).resolves.toEqual({ ok: 1 });
    expect(waits).toEqual([3000]);
  });

  it("POST lỗi 5xx: KHÔNG tự gửi lại và báo kết quả không xác định", async () => {
    let n = 0;
    const client = new FubClient({ ...opts, fetchImpl: async () => (n++, json({}, 502)) });
    const err = (await client.request("POST", "/notes", { body: {} }).catch((e) => e)) as FubError;
    expect(err).toBeInstanceOf(FubError);
    expect(err.outcomeUnknown).toBe(true);
    expect(n).toBe(1);
  });

  it("GET lỗi 5xx: thử lại", async () => {
    let n = 0;
    const client = new FubClient({ ...opts, fetchImpl: async () => (++n < 3 ? json({}, 503) : json({ people: [] })) });
    await expect(client.request("GET", "/people")).resolves.toEqual({ people: [] });
    expect(n).toBe(3);
  });

  it("chặn URL ngoài API FUB (nextLink giả mạo)", async () => {
    const client = new FubClient({ ...opts, fetchImpl: async () => json({}) });
    await expect(client.request("GET", "https://evil.example.com/v1/people")).rejects.toThrow(/bị chặn/);
  });

  it("gửi Basic auth và X-System", async () => {
    let headers: Record<string, string> = {};
    const client = new FubClient({ ...opts, systemKey: "sk", fetchImpl: async (_u, i) => ((headers = i.headers as Record<string, string>), json({})) });
    await client.request("GET", "/me");
    expect(headers.Authorization).toBe("Basic " + Buffer.from("k:").toString("base64"));
    expect(headers["X-System"]).toBe("Test");
    expect(headers["X-System-Key"]).toBe("sk");
  });
});

describe("mapPerson", () => {
  it("lấy trường cần thiết", () => {
    const p = mapPerson({ id: 7, firstName: "A", lastName: "B", stage: "Lead", assignedUserId: 3, updated: "2026-01-02T00:00:00Z", phones: [{ value: "512", status: "Valid" }], tags: ["x", 1] });
    expect(p).toMatchObject({ fubId: 7, name: "A B", stage: "Lead", assignedUserId: 3, tags: ["x"] });
    expect(p.remoteUpdated?.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("chữ ký webhook FUB", () => {
  it("HMAC-SHA256 trên body base64", () => {
    const body = JSON.stringify({ eventId: "e1", event: "peopleUpdated" });
    const sig = crypto.createHmac("sha256", "key").update(Buffer.from(body).toString("base64")).digest("hex");
    expect(verifyFubSignature(body, sig, "key")).toBe(true);
    expect(verifyFubSignature(body, sig, "other")).toBe(false);
    expect(verifyFubSignature(body + " ", sig, "key")).toBe(false);
    expect(verifyFubSignature(body, null, "key")).toBe(false);
  });
});
