// Dữ liệu DEMO hư cấu. Mọi khách/nhà ở đây đều không có thật; email dùng @example.com, số 555.
// Chạy: npm run db:seed   (thêm --reset để xóa toàn bộ dữ liệu demo cũ trước)
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { importPropertyCsv } from "../src/lib/properties/import";
import { StyleProfileSchema } from "../src/lib/style/schema";

const db = new PrismaClient();
const json = (v: unknown) => v as Prisma.InputJsonValue;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

const CLIENTS = [
  {
    key: "linh",
    name: "Linh Tran (DEMO)", firstName: "Linh", lastName: "Tran", stage: "Active Client", sourceLabel: "Zillow (demo)",
    emails: [{ value: "linh.tran.demo@example.com", type: "home", status: "Valid", isPrimary: true }],
    phones: [{ value: "(512) 555-0101", type: "mobile", status: "Valid", isPrimary: true }],
    tags: ["Buyer", "Demo"], lastActivity: 4, price: 450000,
    needs: { budgetMin: 380000, budgetMax: 460000, areas: ["Pflugerville", "Round Rock"], bedsMin: 3, bathsMin: 2, propertyTypes: ["single_family"], mustHave: ["garage"], niceToHave: ["large_lot"], purpose: "first_home", timeline: "2–3 tháng", preApproved: true },
    interactions: [
      { kind: "text", direction: "in", d: 4, body: "Thanks! The second one looks nice. Does it have a big backyard?" },
      { kind: "showing", direction: "out", d: 6, subject: "Showing", body: "Toured 114 Mockingbird Trace and 233 Demo Oak Ln with Linh and her husband. Liked the kitchen at Mockingbird; worried about road noise at Demo Oak." },
      { kind: "email", direction: "out", d: 8, subject: "3 bed homes in Pflugerville", body: "Sent 3 homes in budget." },
    ],
  },
  {
    key: "marcus",
    name: "Marcus Lee (DEMO)", firstName: "Marcus", lastName: "Lee", stage: "Lead", sourceLabel: "Website (demo)",
    emails: [{ value: "marcus.lee.demo@example.com", status: "Valid", isPrimary: true }],
    phones: [{ value: "(512) 555-0102", status: "Valid", isPrimary: true }],
    tags: ["Investor", "Demo"], lastActivity: 24,
    needs: { budgetMax: 500000, propertyTypes: ["multi_family"], purpose: "investment", areas: ["Round Rock"] },
    interactions: [
      { kind: "event", direction: "in", d: 25, subject: "Property Inquiry", body: "Asked about duplexes under $500k in Round Rock." },
      { kind: "text", direction: "out", d: 24, body: "Hi Marcus, this is Hiep. Got your inquiry about duplexes — happy to help. What area works best?" },
    ],
  },
  {
    key: "sofia",
    name: "Sofia Martinez (DEMO)", firstName: "Sofia", lastName: "Martinez", stage: "Lead", sourceLabel: "Facebook (demo)",
    emails: [{ value: "sofia.m.demo@example.com", status: "Valid", isPrimary: true }],
    phones: [{ value: "(512) 555-0103", status: "Valid", isPrimary: true }],
    tags: ["Buyer", "Demo"], lastActivity: 0,
    needs: {},
    interactions: [{ kind: "event", direction: "in", d: 0, subject: "New lead", body: "Facebook lead form: 'Looking to buy in the next 6 months'." }],
  },
  {
    key: "an",
    name: "An Nguyen (DEMO)", firstName: "An", lastName: "Nguyen", stage: "Past Client", sourceLabel: "Referral (demo)",
    emails: [{ value: "an.nguyen.demo@example.com", status: "Valid", isPrimary: true }],
    phones: [{ value: "(512) 555-0104", status: "Valid", isPrimary: true }],
    tags: ["Past Client", "Demo", "Vietnamese"], lastActivity: 95,
    needs: { notes: "Mua nhà ở Leander năm 2024 (demo)." },
    interactions: [{ kind: "call", direction: "out", d: 95, body: "Hỏi thăm sau 1 năm mua nhà. Gia đình khỏe." }],
  },
  {
    key: "daniel",
    name: "Daniel Brooks (DEMO)", firstName: "Daniel", lastName: "Brooks", stage: "Hot Prospect", sourceLabel: "Open house (demo)",
    emails: [{ value: "daniel.b.demo@example.com", status: "Valid", isPrimary: true }],
    phones: [{ value: "(512) 555-0105", status: "Valid", isPrimary: true }],
    tags: ["Buyer", "Demo", "Do Not Text"], lastActivity: 3,
    needs: { budgetMax: 600000, areas: ["Leander"], bedsMin: 4, mustHave: ["pool"], preApproved: null },
    interactions: [{ kind: "call", direction: "out", d: 3, body: "Daniel ready to write an offer on a Leander home if inspection terms work. Prefers email — asked not to be texted." }],
  },
  {
    key: "priya",
    name: "Priya Shah (DEMO)", firstName: "Priya", lastName: "Shah", stage: "Nurture", sourceLabel: "Realtor.com (demo)",
    emails: [{ value: "priya.s.demo@example.com", status: "Valid", isPrimary: true }],
    phones: [{ value: "(512) 555-0106", status: "Valid", isPrimary: true }],
    tags: ["Buyer", "Demo"], lastActivity: 30,
    needs: { budgetMax: 420000, areas: ["Pflugerville"], bedsMin: 3 },
    interactions: [{ kind: "email", direction: "out", d: 30, subject: "Market update", body: "Sent October market update." }],
  },
];

const SAMPLES = [
  { channel: "sms", label: "good", text: "Hi Linh! Just sent over 3 homes that fit what you told me. Take a look when you get a sec — any you want to see this weekend? - Hiep" },
  { channel: "sms", label: "good", text: "Hey Marcus, quick check-in. Still looking at duplexes in Round Rock? No rush, just let me know. - Hiep" },
  { channel: "email", label: "good", text: "Hi Priya,\n\nHope your week is going well! I pulled a few new listings in Pflugerville that match your budget. Nothing urgent — just wanted you to have them.\n\nWant me to set up a tour for any of these?\n\nThanks,\nHiep" },
  { channel: "sms", label: "bad", text: "ACT NOW!!! This AMAZING home won't last!!! Call me TODAY to make an offer before it's GONE!!!" },
];

async function reset() {
  await db.client.deleteMany({ where: { isDemo: true } }); // cascade: interactions, drafts, saved, tasks, proposals
  await db.property.deleteMany({ where: { isDemo: true } });
  await db.compReport.deleteMany({ where: { isDemo: true } });
  await db.compExample.deleteMany({ where: { title: { contains: "DEMO" } } });
  await db.styleSample.deleteMany({ where: { origin: "demo_seed" } });
}

async function main() {
  if (process.argv.includes("--reset")) await reset();

  // Hồ sơ phong cách v1 (mặc định) nếu chưa có
  if (!(await db.styleProfile.findFirst())) {
    await db.styleProfile.create({
      data: {
        version: 1,
        isActive: true,
        note: "Hồ sơ khởi tạo — thân thiện, ngắn, không bán hàng (chỉnh trong 'Giọng văn của tôi')",
        data: json(StyleProfileSchema.parse({ avoidWords: ["act now", "won't last", "amazing deal", "hurry"], preferWords: ["no rush", "happy to help", "just let me know"] })),
      },
    });
  }
  if ((await db.styleSample.count({ where: { origin: "demo_seed" } })) === 0) {
    for (const s of SAMPLES) await db.styleSample.create({ data: { ...s, language: "en", origin: "demo_seed" } });
  }

  // Khách demo — không có fubId để không bao giờ trùng với khách thật từ FUB.
  for (const c of CLIENTS) {
    if (await db.client.findFirst({ where: { isDemo: true, name: c.name } })) continue;
    const row = await db.client.create({
      data: {
        source: "demo", isDemo: true, name: c.name, firstName: c.firstName, lastName: c.lastName, stage: c.stage, sourceLabel: c.sourceLabel,
        emails: json(c.emails), phones: json(c.phones), tags: json(c.tags), price: c.price ?? null, needs: json(c.needs),
        lastActivityAt: daysAgo(c.lastActivity), assignedTo: "Hiep (demo)",
      },
    });
    for (const i of c.interactions) {
      await db.interaction.create({
        data: { clientId: row.id, source: "demo", externalId: `${c.key}-${i.kind}-${i.d}`, kind: i.kind, direction: i.direction, occurredAt: daysAgo(i.d), subject: "subject" in i ? i.subject : null, body: i.body, isDemo: true },
      });
    }
    if (c.key === "linh") await db.crmTask.create({ data: { clientId: row.id, source: "demo", name: "Gửi thêm nhà có sân rộng cho Linh", type: "Follow Up", dueAt: daysAhead(0), isDemo: true } });
    if (c.key === "daniel") await db.crmTask.create({ data: { clientId: row.id, source: "demo", name: "Xác nhận pre-approval của Daniel", type: "Call", dueAt: daysAgo(1), isDemo: true } });
    if (c.key === "priya") await db.crmTask.create({ data: { clientId: row.id, source: "demo", name: "Market update tháng 11", type: "Email", dueAt: daysAhead(5), isDemo: true } });
  }

  // Nhà demo từ CSV mẫu (dùng chính bộ nhập CSV của app)
  if ((await db.property.count({ where: { isDemo: true } })) === 0) {
    const csv = fs.readFileSync(path.join(process.cwd(), "samples/properties-sample.csv"), "utf8");
    const r = await importPropertyCsv(csv, "properties-sample.csv (DEMO)", { isDemo: true });
    console.log(`Nhà demo: ${r.created} tạo mới, ${r.errors.length} dòng lỗi`);
    const linh = await db.client.findFirst({ where: { isDemo: true, firstName: "Linh" } });
    const homes = await db.property.findMany({ where: { isDemo: true, status: "active", city: "Pflugerville" }, take: 2 });
    if (linh) for (const h of homes) await db.savedProperty.create({ data: { clientId: linh.id, propertyId: h.id, note: "Đã gửi cho Linh (demo)" } });
  }

  // Ví dụ comps hư cấu để thử "đề xuất quy tắc từ ví dụ"
  if (!(await db.compExample.findFirst({ where: { title: { contains: "DEMO" } } }))) {
    await db.compExample.create({
      data: {
        title: "DEMO — Ví dụ comps Pflugerville (hư cấu)",
        subject: json({ address: "500 Example Bend, Pflugerville (DEMO)", sqft: 2100, beds: 4, baths: 2.5, yearBuilt: 2012 }),
        comps: json([
          { address: "Comp A (DEMO)", selected: true, reason: "Cùng subdivision, bán 2 tháng trước", soldPrice: 432000, sqft: 2050, distanceMiles: 0.4, monthsSinceSale: 2, adjustments: [{ label: "sqft", amount: 5000, unitDiff: 50 }] },
          { address: "Comp B (DEMO)", selected: true, reason: "Cùng khu, layout tương tự", soldPrice: 445000, sqft: 2200, distanceMiles: 0.8, monthsSinceSale: 4, adjustments: [{ label: "sqft", amount: -10000, unitDiff: -100 }, { label: "pool", amount: -20000, unitDiff: -1 }] },
          { address: "Comp C (DEMO)", selected: false, reason: "Bán quá 8 tháng và bên kia đường lớn", soldPrice: 410000, sqft: 2100, distanceMiles: 1.6, monthsSinceSale: 8, adjustments: [] },
        ]),
        finalLow: 430000,
        finalHigh: 445000,
        notes: "Ví dụ hư cấu để minh họa luồng — hãy thay bằng ví dụ thật của bạn.",
      },
    });
  }
  console.log("Seed demo xong.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
