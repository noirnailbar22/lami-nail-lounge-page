import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { upsertRemotePerson } from "@/lib/crm";
import { approveDraft, generateDraft, sendDraft, updateDraft, resolveUnknown, confirmManualSent } from "@/lib/drafts/service";
import { demoEmailProvider } from "@/lib/email/demo";
import { importPropertyCsv } from "@/lib/properties/import";
import { applyProposal, proposeFromNote } from "@/lib/clients/proposals";

const ready = process.env.TEST_DB_READY === "1" || !!process.env.TEST_DATABASE_URL;

async function wipe() {
  await db.sendAttempt.deleteMany();
  await db.draft.deleteMany();
  await db.crmProposal.deleteMany();
  await db.crmTask.deleteMany();
  await db.interaction.deleteMany();
  await db.savedProperty.deleteMany();
  await db.client.deleteMany();
  await db.property.deleteMany();
  await db.actionLog.deleteMany();
  await db.styleProfile.deleteMany();
  for (const t of ["compReport", "compExample", "compRuleSet", "searchRequest", "styleSample", "setting", "syncRun", "webhookEvent", "oAuthCredential"] as const) {
    await (db[t] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();
  }
}

async function demoClient(extra: Record<string, unknown> = {}) {
  return db.client.create({
    data: {
      source: "demo", isDemo: true, name: "Test Client", firstName: "Test",
      emails: [{ value: "test.demo@example.com", status: "Valid" }], phones: [{ value: "(512) 555-0199", status: "Valid" }],
      lastActivityAt: new Date(), ...extra,
    },
  });
}

describe.skipIf(!ready)("integration (database test)", () => {
  beforeEach(wipe);
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });

  it("đồng bộ FUB: cùng fubId không tạo trùng, bản cũ không ghi đè", async () => {
    const base = { fubId: 101, name: "Ana", emails: [], phones: [], tags: [], stage: "Lead" };
    await upsertRemotePerson({ ...base, remoteUpdated: new Date("2026-10-02") });
    await upsertRemotePerson({ ...base, stage: "Hot Prospect", remoteUpdated: new Date("2026-10-03") });
    const stale = await upsertRemotePerson({ ...base, stage: "Trash", remoteUpdated: new Date("2026-10-01") });
    expect(stale.decision).toBe("skip_stale");
    const rows = await db.client.findMany({ where: { fubId: 101 } });
    expect(rows).toHaveLength(1);
    expect(rows[0].stage).toBe("Hot Prospect");
  });

  it("đồng bộ không xóa dữ liệu riêng của app (nhu cầu, opt-out)", async () => {
    await upsertRemotePerson({ fubId: 102, name: "Bo", emails: [], phones: [], tags: [], remoteUpdated: new Date("2026-10-01") });
    await db.client.update({ where: { fubId: 102 }, data: { smsOptOut: true, needs: { budgetMax: 500000 } } });
    await upsertRemotePerson({ fubId: 102, name: "Bo B", emails: [], phones: [], tags: [], remoteUpdated: new Date("2026-10-05") });
    const c = await db.client.findUniqueOrThrow({ where: { fubId: 102 } });
    expect(c.name).toBe("Bo B");
    expect(c.smsOptOut).toBe(true);
    expect(c.needs).toEqual({ budgetMax: 500000 });
  });

  it("demo chạy khi không có API key: bản nháp soạn bằng mẫu, đánh dấu demo", async () => {
    const c = await demoClient();
    const d = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "sms", language: "en" });
    expect(d.generator).toBe("demo_template");
    expect(d.isDemo).toBe(true);
    expect(d.status).toBe("draft");
  });

  it("email: duyệt → gửi một lần; gửi lại không tạo lần gửi thứ hai", async () => {
    const c = await demoClient();
    const d = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "email", language: "en" });
    await expect(sendDraft(d.id)).rejects.toThrow(/chưa được duyệt/);
    await approveDraft(d.id);
    const spy = vi.spyOn(demoEmailProvider, "send");
    const r1 = await sendDraft(d.id);
    expect(r1.status).toBe("sent_demo");
    const r2 = await sendDraft(d.id).catch((e) => e);
    expect(r2).toBeInstanceOf(Error);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await db.sendAttempt.count({ where: { draftId: d.id } })).toBe(1);
    spy.mockRestore();
  });

  it("hai yêu cầu gửi song song → chỉ một lần gửi", async () => {
    const c = await demoClient();
    const d = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "email", language: "en" });
    await approveDraft(d.id);
    const spy = vi.spyOn(demoEmailProvider, "send");
    await Promise.allSettled([sendDraft(d.id), sendDraft(d.id), sendDraft(d.id)]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await db.sendAttempt.count({ where: { draftId: d.id } })).toBe(1);
    spy.mockRestore();
  });

  it("sửa sau khi duyệt → hủy duyệt, không gửi được", async () => {
    const c = await demoClient();
    const d = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "email", language: "en" });
    await approveDraft(d.id);
    const u = await updateDraft(d.id, { body: d.body + " P.S." });
    expect(u.status).toBe("draft");
    await expect(sendDraft(d.id)).rejects.toThrow(/chưa được duyệt/);
  });

  it("kết quả gửi không xác định → không tự gửi lại; chỉ gửi lại sau khi xác nhận và duyệt lại", async () => {
    const c = await demoClient();
    const d = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "email", language: "en" });
    await approveDraft(d.id);
    const spy = vi.spyOn(demoEmailProvider, "send").mockRejectedValueOnce(new Error("timeout"));
    const r = await sendDraft(d.id);
    expect(r.status).toBe("unknown");
    await expect(sendDraft(d.id)).rejects.toThrow(/chưa xác định/);
    await resolveUnknown(d.id, "not_sent");
    await approveDraft(d.id);
    const r2 = await sendDraft(d.id);
    expect(r2.status).toBe("sent_demo");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(await db.sendAttempt.count({ where: { draftId: d.id } })).toBe(2);
    spy.mockRestore();
  });

  it("opt-out chặn duyệt và gửi", async () => {
    const c = await demoClient({ smsOptOut: true });
    const d = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "sms", language: "en" });
    await expect(approveDraft(d.id)).rejects.toThrow(/không nhận SMS/);
    const c2 = await demoClient({ tags: ["Do Not Text"] });
    const d2 = await generateDraft({ clientId: c2.id, scenario: "no_reply", channel: "sms", language: "en" });
    await expect(approveDraft(d2.id)).rejects.toThrow(/opt-out/);
  });

  it("opt-out bật SAU khi duyệt vẫn chặn lúc gửi", async () => {
    const c = await demoClient();
    const d = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "sms", language: "en" });
    await approveDraft(d.id);
    await db.client.update({ where: { id: c.id }, data: { smsOptOut: true } });
    await expect(sendDraft(d.id)).rejects.toThrow(/Bị chặn/);
    expect(await db.sendAttempt.count()).toBe(0);
  });

  it("SMS: 'Cần gửi trong FUB', không báo đã gửi; người dùng xác nhận thủ công", async () => {
    const c = await demoClient();
    const d = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "sms", language: "en" });
    await approveDraft(d.id);
    const r = await sendDraft(d.id);
    expect(r.status).toBe("needs_manual_send");
    const after = await db.draft.findUniqueOrThrow({ where: { id: d.id } });
    expect(after.status).toBe("needs_manual_send");
    expect(after.sentAt).toBeNull();
    await confirmManualSent(d.id);
    expect((await db.draft.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("manual_confirmed");
  });

  it("không gửi cùng tình huống qua hai kênh ngoài ý muốn", async () => {
    const c = await demoClient();
    const sms = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "sms", language: "en" });
    await approveDraft(sms.id);
    await sendDraft(sms.id);
    const mail = await generateDraft({ clientId: c.id, scenario: "no_reply", channel: "email", language: "en" });
    await approveDraft(mail.id);
    await expect(sendDraft(mail.id)).rejects.toThrow(/trong 7 ngày/);
    const ok = await sendDraft(mail.id, { allowCrossChannel: true });
    expect(ok.status).toBe("sent_demo");
  });

  it("nhập CSV hai lần: không tạo trùng, xung đột được ghi lại", async () => {
    const a = "address,city,zip,status,list_price,sqft\n10 Demo Ln,Pflugerville,78660,Active,400000,2000";
    const b = "address,city,zip,status,list_price,sqft\n10 Demo Lane,Pflugerville,78660,Active,400000,2100";
    await importPropertyCsv(a, "a.csv");
    const r = await importPropertyCsv(b, "b.csv");
    expect(r.created).toBe(0);
    expect(r.merged).toBe(1);
    const p = await db.property.findFirstOrThrow();
    expect(p.sqft).toBe(2000);
    expect((p.conflicts as { field: string }[]).map((x) => x.field)).toEqual(["sqft"]);
  });

  it("ghi chú sau cuộc gọi → đề xuất; không ghi gì cho tới khi duyệt", async () => {
    const c = await demoClient();
    const r = await proposeFromNote(c.id, "Called Test. Budget now under $480k, wants 4 bed in Round Rock, must have garage.");
    expect(r.proposals.length).toBeGreaterThanOrEqual(2);
    expect(await db.interaction.count({ where: { clientId: c.id, kind: "note" } })).toBe(0);
    const note = r.proposals.find((p) => p.kind === "note")!;
    await applyProposal(note.id);
    expect(await db.interaction.count({ where: { clientId: c.id, kind: "note" } })).toBe(1);
    await expect(applyProposal(note.id)).rejects.toThrow(/đã được xử lý/);
    const needs = r.proposals.find((p) => p.kind === "needs_update")!;
    await applyProposal(needs.id);
    const updated = await db.client.findUniqueOrThrow({ where: { id: c.id } });
    expect(updated.needs).toMatchObject({ budgetMax: 480000, bedsMin: 4, areas: ["Round Rock"] });
  });
});
