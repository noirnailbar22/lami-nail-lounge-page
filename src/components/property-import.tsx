"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addManualPropertyAction, importCsvAction } from "@/app/actions/properties";

type ImportResult = { created: number; merged: number; errors: { line: number; message: string }[]; unknownColumns: string[]; conflicts: { address: string; fields: string[] }[]; warnings: { line: number; warnings: string[] }[] };

export function CsvImport() {
  const router = useRouter();
  const [res, setRes] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Input type="file" accept=".csv,text/csv" disabled={pending} onChange={(e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        start(async () => {
          const r = await importCsvAction(await f.text(), f.name);
          if (!r.ok) return void toast.error(r.error);
          setRes(r.data!);
          toast.success(`Nhập xong: ${r.data!.created} mới, ${r.data!.merged} gộp`);
          router.refresh();
        });
      }} />
      {res && (
        <div className="text-xs space-y-1">
          {res.unknownColumns.length > 0 && <div className="text-amber-800">Cột bị bỏ qua: {res.unknownColumns.join(", ")}</div>}
          {res.errors.map((e) => <div key={e.line} className="text-red-700">Dòng {e.line}: {e.message}</div>)}
          {res.warnings.map((w) => <div key={w.line} className="text-amber-800">Dòng {w.line}: {w.warnings.join(" ")}</div>)}
          {res.conflicts.map((c) => <div key={c.address} className="text-red-700">Xung đột nguồn tại {c.address}: {c.fields.join(", ")} — giữ giá trị cũ, đã ghi lại để bạn xem.</div>)}
        </div>
      )}
    </div>
  );
}

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[$,]/g, "")));

export function ManualProperty() {
  const router = useRouter();
  const [f, setF] = useState({ address: "", city: "", zip: "", status: "active", listPrice: "", soldPrice: "", soldDate: "", beds: "", baths: "", sqft: "", yearBuilt: "", sourceUrl: "", note: "" });
  const [pending, start] = useTransition();
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <div><Label>{label}</Label><Input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2 text-sm">
      {field("address", "Địa chỉ *")}
      {field("city", "Thành phố")}
      {field("zip", "ZIP")}
      <div>
        <Label>Trạng thái</Label>
        <select className="w-full rounded-md border bg-background px-3 py-2" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="active">Active</option><option value="pending">Pending</option><option value="sold">Sold</option><option value="off_market">Off market</option><option value="unknown">Không rõ</option>
        </select>
      </div>
      {field("listPrice", "Giá chào bán")}
      {field("soldPrice", "Giá sold đã xác minh")}
      {field("soldDate", "Ngày bán", "date")}
      {field("beds", "Phòng ngủ")}
      {field("baths", "Phòng tắm")}
      {field("sqft", "Diện tích (sqft)")}
      {field("yearBuilt", "Năm xây")}
      {field("sourceUrl", "Link listing (Zillow/Redfin/MLS) — chỉ tham chiếu", "url")}
      <div className="sm:col-span-2">{field("note", "Ghi chú")}</div>
      <div className="sm:col-span-2">
        <Button disabled={pending || f.address.length < 3} onClick={() => start(async () => {
          const r = await addManualPropertyAction({
            address: f.address, city: f.city || null, zip: f.zip || null, status: f.status as "active", listPrice: num(f.listPrice), soldPrice: num(f.soldPrice),
            soldDate: f.soldDate || null, beds: num(f.beds), baths: num(f.baths), sqft: num(f.sqft), yearBuilt: num(f.yearBuilt), sourceUrl: f.sourceUrl || null,
            sourceLabel: f.sourceUrl ? "link" : "manual", note: f.note || null,
          });
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        })}>Lưu nhà</Button>
        <p className="text-xs text-muted-foreground mt-1">Link chỉ được lưu làm nguồn tham chiếu; app không tự đọc nội dung trang.</p>
      </div>
    </div>
  );
}
