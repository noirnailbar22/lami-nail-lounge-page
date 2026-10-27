import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { computeReport } from "@/lib/comps/service";
import { env } from "@/lib/env";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
const $ = (n: number | null | undefined) => (n == null ? "—" : (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US"));

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await db.compReport.findUnique({ where: { id } });
  if (!r) notFound();
  const s = await db.property.findUniqueOrThrow({ where: { id: r.subjectId } });
  const res = await computeReport(id);
  const rs = r.ruleSetId ? await db.compRuleSet.findUnique({ where: { id: r.ruleSetId } }) : null;
  const sig = env.signature;
  const included = res.rows.filter((x) => x.included);
  const excluded = res.rows.filter((x) => !x.included);
  return (
    <div className="mx-auto max-w-4xl p-8 text-sm text-black bg-white">
      <div className="print:hidden mb-4 flex gap-2"><PrintButton /></div>
      {r.isDemo && <div className="border-2 border-amber-500 p-2 mb-3 font-bold">DEMO — dữ liệu hư cấu, không dùng cho mục đích thật.</div>}
      <h1 className="text-2xl font-semibold">{r.title}</h1>
      <p>{[s.address, s.city, s.state, s.zip].filter(Boolean).join(", ")} · {s.beds ?? "?"} bd / {s.baths ?? "?"} ba · {s.sqft ?? "?"} sqft · built {s.yearBuilt ?? "?"}</p>
      <p className="text-xs">Ngày lập: {new Date().toLocaleDateString("vi-VN")} · {rs ? `Quy tắc comps v${rs.version} — ${rs.name}` : "Không áp dụng quy tắc — số liệu khách quan"} · {sig.name}{sig.company ? `, ${sig.company}` : ""}</p>

      <h2 className="mt-5 font-semibold">Comps được sử dụng</h2>
      <table className="w-full border-collapse mt-1 text-xs">
        <thead><tr className="border-b text-left"><th>Địa chỉ</th><th>Loại giá</th><th>Giá</th><th>Ngày</th><th>Cách</th><th>Sqft</th><th>$/sqft</th><th>Điều chỉnh</th><th>Sau điều chỉnh</th></tr></thead>
        <tbody>
          {included.map((x) => (
            <tr key={x.id} className="border-b align-top">
              <td>{x.address}<div className="text-[10px]">{x.source}</div></td>
              <td>{x.priceType === "sold" ? "Sold" : x.priceType === "pending" ? "Pending (tham khảo)" : "Giá chào (tham khảo)"}</td>
              <td>{$(x.price)}</td><td>{x.soldDate ?? "—"}</td><td>{x.distanceMiles ?? "—"} mi</td><td>{x.sqft ?? "—"}</td><td>{x.ppsf ? "$" + x.ppsf : "—"}</td>
              <td>{x.adjustments.filter((a) => a.amount).map((a) => <div key={a.key}>{a.label}: {$(a.amount)}</div>)}</td>
              <td>{$(x.adjustedPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {excluded.length > 0 && (
        <>
          <h2 className="mt-4 font-semibold">Comps đã loại</h2>
          <ul className="text-xs list-disc pl-5">{excluded.map((x) => <li key={x.id}>{x.address} — {x.excludeReason || "không ghi lý do"}</li>)}</ul>
        </>
      )}
      <h2 className="mt-4 font-semibold">Số liệu</h2>
      <p>Giá sold: {$(res.stats.soldPriceMin)} – {$(res.stats.soldPriceMax)} (trung vị {$(res.stats.soldPriceMedian)}) · $/sqft trung vị {$(res.stats.ppsfMedian)} · {res.stats.soldCount} comp sold</p>
      <h2 className="mt-4 font-semibold">Khoảng giá</h2>
      {res.range ? <p className="text-lg font-semibold">{$(res.range.low)} – {$(res.range.high)} <span className="text-xs font-normal">({res.range.method}; {res.range.basis})</span></p> : <p>{res.rangeBlockedReason}</p>}
      {r.notes && (<><h2 className="mt-4 font-semibold">Ghi chú</h2><p className="whitespace-pre-wrap">{r.notes}</p></>)}
      <h2 className="mt-4 font-semibold">Nguồn & hạn chế</h2>
      <ul className="text-xs list-disc pl-5">
        {res.limitations.map((l) => <li key={l}>{l}</li>)}
        <li>Chỉ giá giao dịch đã đóng (sold) được dùng làm cơ sở giá. Giá chào bán, pending và ước tính tự động của bên thứ ba chỉ để tham khảo.</li>
        <li>Đây không phải thẩm định giá (appraisal).</li>
      </ul>
    </div>
  );
}
