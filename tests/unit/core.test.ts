import type { Client } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { contentHash, idempotencyKey } from "@/lib/drafts/hash";
import { assertTransition, SENT_LIKE } from "@/lib/drafts/state";
import { checkOptOut } from "@/lib/clients/contact";
import { buildFacts, missingFor } from "@/lib/drafts/context";
import { templateDraft } from "@/lib/drafts/templates";
import { StyleProfileSchema } from "@/lib/style/schema";
import { analyzeSamples } from "@/lib/style/analyze";
import { fairHousingFlags } from "@/lib/properties/fairhousing";
import { parseQueryRules } from "@/lib/properties/search";
import { parsePropertyCsv } from "@/lib/properties/csv";
import { mergeProperty } from "@/lib/properties/import";
import { computeFit } from "@/lib/properties/fit";
import { dealInsight } from "@/lib/properties/deal";
import { SearchFiltersSchema } from "@/lib/properties/filters";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { prop } from "./fixtures";

const client = (p: Partial<Client> = {}): Client =>
  ({
    id: "c1", source: "demo", fubId: null, isDemo: true, name: "Linh Tran", firstName: "Linh", lastName: "Tran",
    emails: [{ value: "linh@example.com", status: "Valid" }], phones: [{ value: "(512) 555-0101", status: "Valid" }],
    stage: "Lead", sourceLabel: null, assignedTo: null, assignedUserId: null, price: null, tags: [], needs: {},
    lastActivityAt: null, remoteUpdated: null, syncedAt: null, smsOptOut: false, emailOptOut: false, optOutNote: null,
    createdAt: new Date(), updatedAt: new Date(), ...p,
  }) as Client;

describe("duyệt & gửi: hash nội dung", () => {
  const d = { channel: "sms", recipientAddress: "(512) 555-0101", subject: null, body: "Hi Linh" };
  it("đổi nội dung → hash khác (phải duyệt lại)", () => expect(contentHash({ ...d, body: "Hi Linh!" })).not.toBe(contentHash(d)));
  it("đổi người nhận → hash khác", () => expect(contentHash({ ...d, recipientAddress: "(512) 555-0199" })).not.toBe(contentHash(d)));
  it("đổi kênh → hash khác", () => expect(contentHash({ ...d, channel: "email" })).not.toBe(contentHash(d)));
  it("khoảng trắng đầu/cuối không đổi hash", () => expect(contentHash({ ...d, body: " Hi Linh \n" })).toBe(contentHash(d)));
  it("mỗi lần duyệt có idempotency key riêng; cùng lần duyệt → cùng key", () => {
    const t = new Date("2026-10-01T00:00:00Z");
    expect(idempotencyKey("x", "h", t)).toBe(idempotencyKey("x", "h", t));
    expect(idempotencyKey("x", "h", t)).not.toBe(idempotencyKey("x", "h", new Date(t.getTime() + 1)));
  });
});

describe("phân biệt draft và sent", () => {
  it("draft không thể nhảy thẳng sang sent", () => expect(assertTransition("draft", "sent")).not.toBeNull());
  it("SMS chờ gửi thủ công không phải 'sent'", () => expect(SENT_LIKE).not.toContain("needs_manual_send"));
  it("unknown không thể quay về approved/sending (không tự gửi lại)", () => {
    expect(assertTransition("unknown", "sending")).not.toBeNull();
    expect(assertTransition("unknown", "approved")).not.toBeNull();
  });
});

describe("opt-out chặn gửi", () => {
  const s = DEFAULT_SETTINGS;
  it("cho phép khi không có opt-out", () => expect(checkOptOut(client(), "sms", "512-555-0101", s).blocked).toBe(false));
  it("cờ opt-out trong app", () => expect(checkOptOut(client({ smsOptOut: true }), "sms", "(512) 555-0101", s).blocked).toBe(true));
  it("tag FUB 'Do Not Text'", () => expect(checkOptOut(client({ tags: ["do not text"] }), "sms", "(512) 555-0101", s).blocked).toBe(true));
  it("tag opt-out SMS không chặn email", () => expect(checkOptOut(client({ tags: ["Do Not Text"] }), "email", "linh@example.com", s).blocked).toBe(false));
  it("số không có trong hồ sơ", () => expect(checkOptOut(client(), "sms", "(512) 555-9999", s).blocked).toBe(true));
  it("trạng thái opt-out trên số", () => expect(checkOptOut(client({ phones: [{ value: "5125550101", status: "Opted Out" }] }), "sms", "5125550101", s).blocked).toBe(true));
});

describe("thiếu dữ liệu & không bịa", () => {
  it("send_homes không có nhà → báo thiếu, bản nháp không chứa địa chỉ nào", () => {
    const c = client();
    const f = buildFacts(c, [], []);
    expect(missingFor("send_homes", f, c, "sms")).toContain("Chưa chọn căn nhà nào để gửi.");
    const out = templateDraft("send_homes", "sms", "en", f, StyleProfileSchema.parse({}), { name: "Hiep", company: "", phone: "", email: "" });
    expect(out.body).not.toMatch(/\d+ \w+ (St|Dr|Ln)/);
  });
  it("post_showing không có showing → báo thiếu", () => {
    const c = client();
    expect(missingFor("post_showing", buildFacts(c, [], []), c, "sms").join(" ")).toMatch(/showing/);
  });
  it("pre_offer luôn nhắc rằng điều khoản offer chưa có", () => {
    const c = client();
    expect(missingFor("pre_offer", buildFacts(c, [], [prop()]), c, "email").join(" ")).toMatch(/không được tự điền/);
  });
  it("nhà thiếu giá → báo thiếu khi gửi nhà", () => {
    const c = client();
    expect(missingFor("send_homes", buildFacts(c, [], [prop({ listPrice: null })]), c, "sms").join(" ")).toMatch(/giá chào bán/);
  });
});

describe("Fair Housing", () => {
  it("gắn cờ proxy và đặc điểm nhóm được bảo vệ", () => {
    expect(fairHousingFlags("3 bed in a safe neighborhood")).toHaveLength(1);
    expect(fairHousingFlags("family-friendly area near a church")).toHaveLength(1);
    expect(fairHousingFlags("4 bed under 500k with a pool")).toHaveLength(0);
  });
  it("bộ phân tích quy tắc không tạo bộ lọc từ các cụm này", () => {
    const f = parseQueryRules("safe neighborhood, 3 bed in Round Rock under $450k");
    expect(f).toMatchObject({ bedsMin: 3, budgetMax: 450000, areas: ["Round Rock"] });
    expect(JSON.stringify(f)).not.toMatch(/safe/);
  });
});

describe("parseQueryRules", () => {
  it("khoảng giá, số phòng, bắt buộc/ưu tiên", () => {
    const f = parseQueryRules("4 bed 2.5 bath in Pflugerville or Hutto $400k-$480k, must have garage, pool would be nice, investment");
    expect(f).toMatchObject({ bedsMin: 4, bathsMin: 2.5, budgetMin: 400000, budgetMax: 480000, purpose: "investment" });
    expect(f.areas).toEqual(["Pflugerville", "Hutto"]);
    expect(f.mustHave).toContain("garage");
    expect(f.niceToHave).toContain("pool");
  });
});

describe("CSV & nguồn xung đột", () => {
  it("cảnh báo sold không có giá và giá sold với trạng thái active", () => {
    const r = parsePropertyCsv("address,status,sold_price\n1 A St,Sold,\n2 B St,Active,400000\n,Active,1");
    expect(r.errors).toHaveLength(1);
    expect(r.rows[0].warnings.join(" ")).toMatch(/không có giá sold/);
    expect(r.rows[1].warnings.join(" ")).toMatch(/xung đột/);
  });
  it("gộp: chỉ điền trường trống, giá trị khác được ghi xung đột (không ghi đè)", () => {
    const existing = prop({ sqft: 2000, yearBuilt: null });
    const { patch, conflicts } = mergeProperty(existing, { sqft: 2120, yearBuilt: 2012 } as never, "b.csv");
    expect(patch).toEqual({ yearBuilt: 2012 });
    expect(conflicts.map((c) => c.field)).toEqual(["sqft"]);
  });
});

describe("Phù hợp vs deal là hai đánh giá riêng", () => {
  it("fit: tiêu chí bắt buộc không đạt", () => {
    const f = SearchFiltersSchema.parse({ budgetMax: 350000, mustHave: ["pool"] });
    const fit = computeFit(prop({ listPrice: 400000, pool: false }), f);
    expect(fit.mustFail).toBe(true);
  });
  it("fit: dữ liệu thiếu → unknown, không coi là khớp", () => {
    const fit = computeFit(prop({ pool: null }), SearchFiltersSchema.parse({ mustHave: ["pool"] }));
    expect(fit.checks[0].result).toBe("unknown");
    expect(fit.score).toBe(0);
    expect(fit.label).toMatch(/chưa rõ/);
  });
  it("deal: không đủ comp sold → không kết luận", () => {
    const d = dealInsight(prop(), [prop({ status: "sold", soldPrice: 390000, soldDate: new Date() })]);
    expect(d.verdict).toBe("insufficient_data");
  });
  it("deal: ước tính tự động không được dùng làm cơ sở", () => {
    const pool = [1, 2, 3].map(() => prop({ status: "active", listPrice: null, estimatePrice: 500000 }));
    expect(dealInsight(prop(), pool).verdict).toBe("insufficient_data");
  });
  it("deal: đủ 3 comp sold → quan sát có cơ sở", () => {
    const now = new Date("2026-10-26");
    const sold = [400, 410, 420].map((k) => prop({ status: "sold", soldPrice: k * 1000, sqft: 2000, soldDate: new Date("2026-08-01") }));
    const d = dealInsight(prop({ listPrice: 380000, sqft: 2000 }), sold, now);
    expect(d.verdict).toBe("observations");
    expect(d.observations[0]).toMatch(/thấp hơn trung vị sold 7.3%/);
  });
});

describe("phân tích mẫu giọng văn", () => {
  it("chỉ tính mẫu 'good'", () => {
    const s = analyzeSamples([
      { text: "Hi Linh! Want to see it Saturday?", channel: "sms", label: "good", language: "en" },
      { text: "ACT NOW!!!", channel: "sms", label: "bad", language: "en" },
    ]);
    expect(s.sampleCount).toBe(1);
    expect(s.questionRate).toBe(1);
  });
});
