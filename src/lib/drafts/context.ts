import type { Client, Interaction, Property } from "@prisma/client";
import { parseNeeds, needsSummary, fmtMoney } from "../clients/needs";
import { primaryEmail, primaryPhone, tagsOf } from "../clients/contact";
import type { Scenario } from "./state";

// Tập hợp dữ kiện thật về khách cho bản nháp, và danh sách thông tin còn thiếu (tính bằng code).

export type DraftFacts = {
  client: {
    firstName: string | null;
    fullName: string;
    stage: string | null;
    source: string | null;
    needs: string;
    timeline: string | null;
    preApproved: boolean | null;
    tags: string[];
  };
  recent: { when: string; kind: string; direction: string | null; text: string }[];
  lastOutbound: string | null;
  lastInbound: string | null;
  showings: { when: string; text: string }[];
  properties: PropertyFact[];
};

export type PropertyFact = {
  id: string;
  address: string;
  facts: Record<string, string>;
  sourceNote: string;
  missing: string[];
};

export function propertyFact(p: Property): PropertyFact {
  const facts: Record<string, string> = {};
  const missing: string[] = [];
  const put = (k: string, v: unknown, label: string) => {
    if (v === null || v === undefined || v === "") missing.push(label);
    else facts[k] = String(v);
  };
  put("status", p.status, "trạng thái");
  if (p.status === "sold") put("soldPrice", p.soldPrice ? fmtMoney(p.soldPrice) : null, "giá sold");
  else put("listPrice", p.listPrice ? fmtMoney(p.listPrice) : null, "giá chào bán");
  put("beds", p.beds, "số phòng ngủ");
  put("baths", p.baths, "số phòng tắm");
  put("sqft", p.sqft, "diện tích");
  put("city", p.city, "thành phố");
  if (p.yearBuilt) facts.yearBuilt = String(p.yearBuilt);
  if (p.pool !== null) facts.pool = p.pool ? "yes" : "no";
  if (p.garageSpaces !== null) facts.garageSpaces = String(p.garageSpaces);
  if (p.sourceUrl) facts.link = p.sourceUrl;
  return {
    id: p.id,
    address: [p.address, p.city, p.zip].filter(Boolean).join(", "),
    facts,
    missing,
    sourceNote: `${p.isDemo ? "DEMO · " : ""}nguồn ${p.source}${p.sourceRef ? " (" + p.sourceRef + ")" : ""}, lấy lúc ${p.fetchedAt.toISOString().slice(0, 10)}`,
  };
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export function buildFacts(c: Client, interactions: Interaction[], properties: Property[]): DraftFacts {
  const needs = parseNeeds(c.needs);
  const sorted = [...interactions].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const outbound = sorted.find((i) => i.direction === "out");
  const inbound = sorted.find((i) => i.direction === "in");
  const showings = sorted.filter(
    (i) => i.kind === "showing" || (i.kind === "appointment" && /show/i.test(`${i.subject} ${i.body}`)),
  );
  return {
    client: {
      firstName: c.firstName,
      fullName: c.name,
      stage: c.stage,
      source: c.sourceLabel,
      needs: needsSummary(needs),
      timeline: needs.timeline,
      preApproved: needs.preApproved,
      tags: tagsOf(c),
    },
    recent: sorted.filter((i) => i.body || (i.subject && i.subject !== "FUB_HIDDEN")).slice(0, 8).map((i) => ({
      when: day(i.occurredAt),
      kind: i.kind,
      direction: i.direction,
      text: [i.subject, i.body].filter(Boolean).join(" — ").slice(0, 500),
    })),
    lastOutbound: outbound ? day(outbound.occurredAt) : null,
    lastInbound: inbound ? day(inbound.occurredAt) : null,
    showings: showings.slice(0, 3).map((s) => ({ when: day(s.occurredAt), text: [s.subject, s.body].filter(Boolean).join(" — ") })),
    properties: properties.map(propertyFact),
  };
}

/** Những thông tin quan trọng còn thiếu cho từng tình huống — hiển thị cho người dùng, không được bịa. */
export function missingFor(scenario: Scenario, f: DraftFacts, c: Client, channel: "sms" | "email"): string[] {
  const m: string[] = [];
  if (!f.client.firstName) m.push("Chưa có tên (first name) của khách.");
  if (channel === "sms" && !primaryPhone(c)) m.push("Khách chưa có số điện thoại hợp lệ.");
  if (channel === "email" && !primaryEmail(c)) m.push("Khách chưa có email hợp lệ.");
  switch (scenario) {
    case "new_lead":
      if (f.recent.length === 0 && f.client.needs === "Chưa có thông tin nhu cầu")
        m.push("Không có thông tin khách hỏi gì (căn nhà, khu vực, ngân sách) — bản nháp chỉ chào hỏi chung.");
      break;
    case "no_reply":
      if (!f.lastOutbound) m.push("Không thấy tin/cuộc gọi mình đã gửi trước đó — không xác nhận được khách 'chưa trả lời'.");
      break;
    case "post_showing":
      if (f.showings.length === 0) m.push("Không có lịch/ghi chú showing nào — cần biết căn nào và ngày nào.");
      break;
    case "send_homes":
      if (f.properties.length === 0) m.push("Chưa chọn căn nhà nào để gửi.");
      for (const p of f.properties) if (p.missing.length) m.push(`${p.address}: thiếu ${p.missing.join(", ")}.`);
      break;
    case "pre_offer":
      if (f.properties.length === 0) m.push("Chưa chọn căn nhà định offer.");
      if (f.client.preApproved === null) m.push("Chưa biết khách đã có pre-approval chưa.");
      m.push("Giá offer, earnest money, option period, ngày closing: chưa có — bản nháp không được tự điền.");
      break;
    case "past_client":
      if (!/past|closed|sphere/i.test(`${f.client.stage} ${f.client.tags.join(" ")}`))
        m.push("Stage hiện tại không phải khách cũ — kiểm tra lại tình huống.");
      break;
  }
  return m;
}
