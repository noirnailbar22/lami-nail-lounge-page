"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FEATURE_KEYS, FEATURE_LABELS, PROPERTY_TYPES, PURPOSES, type SearchFilters } from "@/lib/properties/filters";

const TYPE_LABELS: Record<string, string> = { single_family: "Nhà riêng", condo: "Condo", townhome: "Townhome", multi_family: "Multi-family", land: "Đất" };
const PURPOSE_LABELS: Record<string, string> = { primary: "Ở chính", first_home: "Mua lần đầu", investment: "Đầu tư", relocation: "Chuyển nơi ở", downsizing: "Thu nhỏ", vacation: "Nghỉ dưỡng", other: "Khác" };

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

export function FiltersEditor<T extends SearchFilters>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  const set = (patch: Partial<SearchFilters>) => onChange({ ...value, ...patch });
  const toggle = (key: "mustHave" | "niceToHave", k: (typeof FEATURE_KEYS)[number]) => {
    const cur = value[key];
    const other = key === "mustHave" ? "niceToHave" : "mustHave";
    set({ [key]: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k], [other]: value[other].filter((x) => x !== k) } as Partial<SearchFilters>);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
      <div><Label>Ngân sách từ ($)</Label><Input inputMode="numeric" value={value.budgetMin ?? ""} onChange={(e) => set({ budgetMin: numOrNull(e.target.value) })} /></div>
      <div><Label>Ngân sách đến ($)</Label><Input inputMode="numeric" value={value.budgetMax ?? ""} onChange={(e) => set({ budgetMax: numOrNull(e.target.value) })} /></div>
      <div><Label>Khu vực (thành phố/subdivision, phẩy)</Label><Input value={value.areas.join(", ")} onChange={(e) => set({ areas: list(e.target.value) })} /></div>
      <div><Label>ZIP (phẩy)</Label><Input value={value.zips.join(", ")} onChange={(e) => set({ zips: list(e.target.value) })} /></div>
      <div><Label>Phòng ngủ tối thiểu</Label><Input inputMode="decimal" value={value.bedsMin ?? ""} onChange={(e) => set({ bedsMin: numOrNull(e.target.value) })} /></div>
      <div><Label>Phòng tắm tối thiểu</Label><Input inputMode="decimal" value={value.bathsMin ?? ""} onChange={(e) => set({ bathsMin: numOrNull(e.target.value) })} /></div>
      <div><Label>Diện tích từ (sqft)</Label><Input inputMode="numeric" value={value.sqftMin ?? ""} onChange={(e) => set({ sqftMin: numOrNull(e.target.value) })} /></div>
      <div><Label>Diện tích đến (sqft)</Label><Input inputMode="numeric" value={value.sqftMax ?? ""} onChange={(e) => set({ sqftMax: numOrNull(e.target.value) })} /></div>
      <div>
        <Label>Mục đích mua</Label>
        <select className="w-full rounded-md border bg-background px-3 py-2" value={value.purpose ?? ""} onChange={(e) => set({ purpose: (e.target.value || null) as SearchFilters["purpose"] })}>
          <option value="">—</option>
          {PURPOSES.map((p) => <option key={p} value={p}>{PURPOSE_LABELS[p]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-1 lg:col-span-3">
        <Label>Loại nhà</Label>
        <div className="flex flex-wrap gap-3 pt-2">
          {PROPERTY_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1">
              <input type="checkbox" checked={value.propertyTypes.includes(t)} onChange={() => set({ propertyTypes: value.propertyTypes.includes(t) ? value.propertyTypes.filter((x) => x !== t) : [...value.propertyTypes, t] })} />
              {TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Label>Đặc điểm — bấm 1 lần: bắt buộc, cột phải: ưu tiên</Label>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
          {FEATURE_KEYS.map((k) => (
            <div key={k} className="flex items-center gap-2 rounded border px-2 py-1">
              <span className="flex-1">{FEATURE_LABELS[k]}</span>
              <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={value.mustHave.includes(k)} onChange={() => toggle("mustHave", k)} />Bắt buộc</label>
              <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={value.niceToHave.includes(k)} onChange={() => toggle("niceToHave", k)} />Ưu tiên</label>
            </div>
          ))}
        </div>
      </div>
      {value.otherNotes.length > 0 && (
        <div className="sm:col-span-2 lg:col-span-4 text-xs text-muted-foreground">Không chuyển thành bộ lọc: {value.otherNotes.join(" · ")}</div>
      )}
    </div>
  );
}
