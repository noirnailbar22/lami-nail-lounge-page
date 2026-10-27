// Fair Housing: lọc nhà chỉ bằng tiêu chí khách quan về căn nhà.
// Các cụm từ dưới đây là đặc điểm nhóm được bảo vệ hoặc proxy thường gặp — không bao giờ chuyển thành bộ lọc.
const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(white|black|asian|hispanic|latino|vietnamese|chinese|indian|mexican)\s+(neighbo|area|community|people|famil)/i, label: "chủng tộc/nguồn gốc" },
  { re: /\b(christian|muslim|jewish|catholic|hindu|buddhist)\b/i, label: "tôn giáo" },
  { re: /\b(no|without)\s+(kids|children)\b|\badults? only\b|\bfamily[- ]friendly\b|\bgood for families\b/i, label: "tình trạng gia đình" },
  { re: /\bsafe (area|neighbo)|\bsafest\b|\blow crime\b|\bgood neighbo|\bbad (area|neighbo)|\bgood demographics?\b|\bdemographic/i, label: "proxy 'khu an toàn/khu tốt'" },
  { re: /\b(disab|wheelchair users|handicapped people)\b/i, label: "khuyết tật" },
  { re: /\b(người (da|gốc)|dân tộc|tôn giáo|khu (an toàn|tốt)|không có trẻ em|toàn người)\b/i, label: "đặc điểm nhóm (tiếng Việt)" },
];

export function fairHousingFlags(text: string): string[] {
  const out: string[] = [];
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (m) out.push(`"${m[0]}" (${p.label}) — không dùng làm tiêu chí lọc. Hãy dùng tiêu chí khách quan (giá, diện tích, vị trí cụ thể, thời gian đi lại...).`);
  }
  return out;
}
