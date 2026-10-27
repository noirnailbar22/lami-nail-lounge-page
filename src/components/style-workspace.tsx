"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addSampleAction, analyzeStyleAction, deleteSampleAction, restoreStyleAction, saveStyleAction } from "@/app/actions/style";
import { LENGTH_LABELS, type StyleProfileData } from "@/lib/style/schema";
import type { StyleStats } from "@/lib/style/analyze";

type Sample = { id: string; channel: string; language: string; label: string; text: string; origin: string };
type Version = { version: number; isActive: boolean; note: string | null; createdAt: string };

const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

function ProfileForm({ value, onChange }: { value: StyleProfileData; onChange: (v: StyleProfileData) => void }) {
  const set = (p: Partial<StyleProfileData>) => onChange({ ...value, ...p });
  return (
    <div className="grid gap-3 sm:grid-cols-2 text-sm">
      <div><Label>Lời chào (English)</Label><Input value={value.greetingEn} onChange={(e) => set({ greetingEn: e.target.value })} /></div>
      <div><Label>Lời chào (Tiếng Việt)</Label><Input value={value.greetingVi} onChange={(e) => set({ greetingVi: e.target.value })} /></div>
      <div>
        <Label>Độ dài SMS</Label>
        <select className="w-full rounded-md border bg-background px-3 py-2" value={value.smsLength} onChange={(e) => set({ smsLength: e.target.value as StyleProfileData["smsLength"] })}>
          {["very_short", "short", "medium"].map((k) => <option key={k} value={k}>{LENGTH_LABELS[k]}</option>)}
        </select>
      </div>
      <div>
        <Label>Độ dài email</Label>
        <select className="w-full rounded-md border bg-background px-3 py-2" value={value.emailLength} onChange={(e) => set({ emailLength: e.target.value as StyleProfileData["emailLength"] })}>
          {["short", "medium", "long"].map((k) => <option key={k} value={k}>{LENGTH_LABELS[k]}</option>)}
        </select>
      </div>
      <div>
        <Label>Mức độ thân mật (1 = rất thân mật, 5 = rất trang trọng): {value.formality}</Label>
        <input type="range" min={1} max={5} value={value.formality} onChange={(e) => set({ formality: Number(e.target.value) })} className="w-full" />
      </div>
      <div>
        <Label>Emoji</Label>
        <select className="w-full rounded-md border bg-background px-3 py-2" value={value.emoji} onChange={(e) => set({ emoji: e.target.value as StyleProfileData["emoji"] })}>
          <option value="none">Không dùng</option><option value="rare">Thỉnh thoảng</option><option value="often">Thường dùng</option>
        </select>
      </div>
      <div><Label>Cách hỏi</Label><Input value={value.questionStyle} onChange={(e) => set({ questionStyle: e.target.value })} /></div>
      <div><Label>Cách chốt</Label><Input value={value.closingStyle} onChange={(e) => set({ closingStyle: e.target.value })} /></div>
      <div><Label>Ký tên email (EN) — {"{signature}"}</Label><Textarea rows={2} value={value.signOffEn} onChange={(e) => set({ signOffEn: e.target.value })} /></div>
      <div><Label>Ký tên email (VI)</Label><Textarea rows={2} value={value.signOffVi} onChange={(e) => set({ signOffVi: e.target.value })} /></div>
      <div><Label>Ký tên SMS — {"{name}"}</Label><Input value={value.smsSignOff} onChange={(e) => set({ smsSignOff: e.target.value })} /></div>
      <div><Label>Từ nên dùng (phẩy)</Label><Input value={value.preferWords.join(", ")} onChange={(e) => set({ preferWords: list(e.target.value) })} /></div>
      <div><Label>Từ cần tránh (phẩy)</Label><Input value={value.avoidWords.join(", ")} onChange={(e) => set({ avoidWords: list(e.target.value) })} /></div>
      <div className="sm:col-span-2"><Label>Ghi chú phong cách khác</Label><Textarea rows={2} value={value.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
    </div>
  );
}

export function StyleWorkspace({ active, samples, versions }: { active: { version: number | null; data: StyleProfileData }; samples: Sample[]; versions: Version[] }) {
  const router = useRouter();
  const [profile, setProfile] = useState(active.data);
  const [note, setNote] = useState("");
  const [sample, setSample] = useState({ channel: "sms" as "sms" | "email", language: "en" as "en" | "vi", label: "good" as "good" | "bad", text: "" });
  const [analysis, setAnalysis] = useState<{ stats: StyleStats; observations: string[]; generator: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Thêm mẫu tin nhắn / email</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <select className="rounded-md border bg-background px-2 py-1" value={sample.channel} onChange={(e) => setSample({ ...sample, channel: e.target.value as "sms" | "email" })}><option value="sms">SMS</option><option value="email">Email</option></select>
              <select className="rounded-md border bg-background px-2 py-1" value={sample.language} onChange={(e) => setSample({ ...sample, language: e.target.value as "en" | "vi" })}><option value="en">English</option><option value="vi">Tiếng Việt</option></select>
              <select className="rounded-md border bg-background px-2 py-1" value={sample.label} onChange={(e) => setSample({ ...sample, label: e.target.value as "good" | "bad" })}><option value="good">Ví dụ tốt (nên giống)</option><option value="bad">Ví dụ xấu (tránh)</option></select>
            </div>
            <Textarea rows={5} value={sample.text} onChange={(e) => setSample({ ...sample, text: e.target.value })} placeholder="Dán một tin nhắn hoặc email bạn đã viết và muốn assistant học theo." />
            <Button disabled={pending || sample.text.trim().length < 5} onClick={() => start(async () => {
              const r = await addSampleAction(sample);
              if (r.ok) { toast.success(r.message); setSample({ ...sample, text: "" }); router.refresh(); } else toast.error(r.error);
            })}>Thêm mẫu</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Mẫu đã chọn ({samples.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[32rem] overflow-auto">
            {samples.map((s) => (
              <div key={s.id} className={`rounded border p-2 text-sm ${s.label === "bad" ? "border-red-200 bg-red-50/50" : ""}`}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{s.channel.toUpperCase()} · {s.language} · {s.label === "good" ? "tốt" : "xấu"} · {s.origin === "edited_draft" ? "từ bản nháp đã sửa" : s.origin === "demo_seed" ? "DEMO" : "dán tay"}</span>
                  <button className="underline" onClick={() => start(async () => { const r = await deleteSampleAction(s.id); if (r.ok) router.refresh(); })}>Xóa</button>
                </div>
                <div className="whitespace-pre-wrap">{s.text}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Phân tích phong cách</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button variant="outline" disabled={pending || samples.length === 0} onClick={() => start(async () => {
              const r = await analyzeStyleAction();
              if (!r.ok) return void toast.error(r.error);
              setAnalysis({ stats: r.data!.stats, observations: r.data!.observations, generator: r.data!.generator });
              setProfile(r.data!.suggestion as StyleProfileData);
              toast.info("Đã điền gợi ý vào hồ sơ bên dưới — xem lại trước khi lưu.");
            })}>Phân tích các mẫu</Button>
            {analysis && (
              <div className="rounded bg-muted p-2 space-y-1">
                <div>Mẫu tốt: {analysis.stats.sampleCount} · TB từ/SMS: {analysis.stats.avgWordsSms ?? "—"} · TB từ/email: {analysis.stats.avgWordsEmail ?? "—"}</div>
                <div>Có câu hỏi: {Math.round(analysis.stats.questionRate * 100)}% · Dấu “!”: {Math.round(analysis.stats.exclamationRate * 100)}% · Emoji: {Math.round(analysis.stats.emojiRate * 100)}%</div>
                <div>Lời chào hay dùng: {analysis.stats.commonGreetings.join(" | ") || "—"}</div>
                <div>Câu kết hay dùng: {analysis.stats.commonClosings.join(" | ") || "—"}</div>
                <ul className="list-disc pl-5">{analysis.observations.map((o) => <li key={o}>{o}</li>)}</ul>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Hồ sơ phong cách {active.version ? `(đang dùng v${active.version})` : ""}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ProfileForm value={profile} onChange={setProfile} />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú cho phiên bản này (tùy chọn)" />
            <Button disabled={pending} onClick={() => start(async () => {
              const r = await saveStyleAction(profile, note || undefined);
              if (r.ok) { toast.success(`${r.message} (v${r.data!.version})`); setNote(""); router.refresh(); } else toast.error(r.error);
            })}>Lưu thành phiên bản mới</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Các phiên bản</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {versions.map((v) => (
              <div key={v.version} className="flex items-center justify-between gap-2">
                <span>v{v.version} {v.isActive && <strong>(đang dùng)</strong>} · {new Date(v.createdAt).toLocaleString("vi-VN")} {v.note && <span className="text-muted-foreground">— {v.note}</span>}</span>
                {!v.isActive && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await restoreStyleAction(v.version); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })}>Khôi phục</Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
