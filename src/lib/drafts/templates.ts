import type { StyleProfileData } from "../style/schema";
import type { DraftFacts } from "./context";
import type { Scenario } from "./state";

// Bộ soạn mẫu cho chế độ demo / khi chưa có AI. Chỉ dùng dữ kiện có trong DraftFacts.

export type Signature = { name: string; company: string; phone: string; email: string };
export type DraftOutput = { subject: string | null; body: string; factsUsed: string[]; warnings: string[] };

function fill(t: string, f: DraftFacts, sig: Signature) {
  const sigBlock = [sig.name, sig.company, sig.phone, sig.email].filter(Boolean).join("\n");
  return t
    .replaceAll("{firstName}", f.client.firstName ?? "there")
    .replaceAll("{signature}", sigBlock)
    .replaceAll("{name}", sig.name);
}

const EN: Record<Scenario, (f: DraftFacts) => { subject: string; lines: string[] }> = {
  new_lead: (f) => ({
    subject: "Following up on your home search",
    lines: [
      `Thanks for reaching out! This is ${"{name}"}.`,
      f.client.needs !== "Chưa có thông tin nhu cầu" ? `I saw you're looking at: ${f.client.needs}.` : "",
      "What would be most helpful for you right now?",
    ],
  }),
  no_reply: (f) => ({
    subject: "Quick check-in",
    lines: [
      f.lastOutbound ? `Just following up on my note from ${f.lastOutbound}.` : "Just checking in.",
      "No rush at all. Are you still thinking about a move?",
    ],
  }),
  post_showing: (f) => ({
    subject: "Thoughts on the showing?",
    lines: [
      f.showings[0] ? `Thanks for touring with me (${f.showings[0].when}).` : "Thanks for touring with me.",
      "What did you like, and what didn't feel right?",
    ],
  }),
  send_homes: (f) => ({
    subject: "A few homes that match what you described",
    lines: [
      "Here are a few homes that fit what you told me:",
      ...f.properties.map((p) => {
        const x = p.facts;
        const price = x.listPrice ?? x.soldPrice;
        return `- ${p.address}${price ? ` · ${price}` : ""}${x.beds ? ` · ${x.beds} bd` : ""}${x.baths ? ` / ${x.baths} ba` : ""}${x.sqft ? ` · ${x.sqft} sqft` : ""}${x.link ? ` · ${x.link}` : ""}`;
      }),
      "Want to see any of them in person?",
    ],
  }),
  pre_offer: (f) => ({
    subject: "Before we write the offer",
    lines: [
      f.properties[0] ? `Before we put together an offer on ${f.properties[0].address}, I want to confirm a few things with you:` : "Before we put together an offer, I want to confirm a few things with you:",
      "- Your offer price and how much room you want to leave",
      "- Earnest money and option period",
      "- Your ideal closing date",
      "When is a good time for a quick call?",
    ],
  }),
  past_client: () => ({
    subject: "Checking in",
    lines: ["Hope you and the family are doing well! Just checking in.", "Is there anything I can help with around the house or the market?"],
  }),
};

const VI: Record<Scenario, (f: DraftFacts) => { subject: string; lines: string[] }> = {
  new_lead: (f) => ({
    subject: "Về nhu cầu tìm nhà của anh/chị",
    lines: [
      "Cảm ơn anh/chị đã liên hệ, em là {name}.",
      f.client.needs !== "Chưa có thông tin nhu cầu" ? `Em thấy anh/chị đang tìm: ${f.client.needs}.` : "",
      "Hiện anh/chị cần em hỗ trợ gì trước ạ?",
    ],
  }),
  no_reply: (f) => ({
    subject: "Hỏi thăm anh/chị",
    lines: [f.lastOutbound ? `Em nhắn lại tin hôm ${f.lastOutbound}.` : "Em hỏi thăm anh/chị chút.", "Không gấp đâu ạ, anh/chị còn đang tính chuyện mua nhà không?"],
  }),
  post_showing: (f) => ({
    subject: "Cảm nhận sau buổi xem nhà",
    lines: [f.showings[0] ? `Cảm ơn anh/chị đã đi xem nhà với em (${f.showings[0].when}).` : "Cảm ơn anh/chị đã đi xem nhà với em.", "Anh/chị thích điểm nào và chưa ưng điểm nào ạ?"],
  }),
  send_homes: (f) => ({
    subject: "Vài căn phù hợp với nhu cầu của anh/chị",
    lines: [
      "Em gửi anh/chị vài căn khớp với tiêu chí mình đã trao đổi:",
      ...f.properties.map((p) => `- ${p.address}${p.facts.listPrice ? ` · ${p.facts.listPrice}` : ""}${p.facts.beds ? ` · ${p.facts.beds} PN` : ""}${p.facts.link ? ` · ${p.facts.link}` : ""}`),
      "Anh/chị muốn đi xem căn nào không ạ?",
    ],
  }),
  pre_offer: (f) => ({
    subject: "Trước khi viết offer",
    lines: [
      f.properties[0] ? `Trước khi làm offer cho căn ${f.properties[0].address}, em cần xác nhận với anh/chị vài điều:` : "Trước khi làm offer, em cần xác nhận với anh/chị vài điều:",
      "- Giá offer và mức anh/chị muốn chừa lại để thương lượng",
      "- Earnest money và option period",
      "- Ngày closing mong muốn",
      "Khi nào anh/chị tiện gọi nhanh với em ạ?",
    ],
  }),
  past_client: () => ({ subject: "Hỏi thăm anh/chị", lines: ["Lâu rồi em hỏi thăm anh/chị và gia đình.", "Nhà cửa có gì cần em hỗ trợ không ạ?"] }),
};

export function templateDraft(
  scenario: Scenario,
  channel: "sms" | "email",
  language: "en" | "vi",
  facts: DraftFacts,
  style: StyleProfileData,
  sig: Signature,
): DraftOutput {
  const t = (language === "vi" ? VI : EN)[scenario](facts);
  const greeting = language === "vi" ? style.greetingVi : style.greetingEn;
  const lines = t.lines.filter(Boolean);
  let body: string;
  if (channel === "sms") {
    body = [greeting, ...lines].join(" ") + " " + style.smsSignOff;
  } else {
    body = [greeting, "", ...lines, "", language === "vi" ? style.signOffVi : style.signOffEn].join("\n");
  }
  const factsUsed = ["Tên khách", "Nhu cầu đã lưu"];
  if (facts.lastOutbound) factsUsed.push(`Lần liên hệ gần nhất: ${facts.lastOutbound}`);
  if (facts.showings[0]) factsUsed.push(`Showing: ${facts.showings[0].when}`);
  for (const p of facts.properties) factsUsed.push(`Nhà: ${p.address} (${p.sourceNote})`);
  return {
    subject: channel === "email" ? t.subject : null,
    body: fill(body, facts, sig),
    factsUsed,
    warnings: ["Bản nháp DEMO soạn bằng mẫu cố định, không phải AI."],
  };
}
