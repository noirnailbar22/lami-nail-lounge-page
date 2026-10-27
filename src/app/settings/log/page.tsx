import { db } from "@/lib/db";
import { PageHeader, fmtDateTime } from "@/components/bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const logs = await db.actionLog.findMany({ orderBy: { at: "desc" }, take: 300 });
  return (
    <div>
      <PageHeader title="Nhật ký hành động" desc="Mọi thao tác duyệt, gửi, ghi CRM, đồng bộ và thay đổi cấu hình. Secret được ẩn." />
      <Table>
        <TableHeader><TableRow><TableHead>Thời gian</TableHead><TableHead>Ai</TableHead><TableHead>Hành động</TableHead><TableHead>Kết quả</TableHead><TableHead>Đối tượng</TableHead><TableHead>Chi tiết</TableHead></TableRow></TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(l.at)}</TableCell>
              <TableCell>{l.actor}</TableCell>
              <TableCell>{l.action}</TableCell>
              <TableCell className={l.result === "ok" ? "" : l.result === "blocked" ? "text-amber-700" : "text-red-700"}>{l.result}</TableCell>
              <TableCell className="text-xs">{l.entityType} {l.entityId?.slice(-6)}</TableCell>
              <TableCell className="text-xs max-w-md truncate" title={JSON.stringify(l.details)}>{l.details ? JSON.stringify(l.details) : ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
