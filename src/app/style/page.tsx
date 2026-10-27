import { db } from "@/lib/db";
import { getActiveStyle } from "@/lib/style/service";
import { PageHeader } from "@/components/bits";
import { StyleWorkspace } from "@/components/style-workspace";

export const dynamic = "force-dynamic";

export default async function StylePage() {
  const active = await getActiveStyle();
  const samples = await db.styleSample.findMany({ orderBy: { createdAt: "desc" } });
  const versions = await db.styleProfile.findMany({ orderBy: { version: "desc" }, take: 30 });
  return (
    <div>
      <PageHeader title="Giọng văn của tôi" desc="Chỉ học từ những mẫu bạn tự chọn và dán vào đây — app không tự đọc hộp thư. Mỗi lần lưu tạo một phiên bản mới, có thể khôi phục." />
      <StyleWorkspace key={active.version ?? 0}
        active={active}
        samples={samples.map((s) => ({ id: s.id, channel: s.channel, language: s.language, label: s.label, text: s.text, origin: s.origin }))}
        versions={versions.map((v) => ({ version: v.version, isActive: v.isActive, note: v.note, createdAt: v.createdAt.toISOString() }))}
      />
    </div>
  );
}
