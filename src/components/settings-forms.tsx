"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveSettingsAction, setAutomationPausedAction } from "@/app/actions/settings";
import type { AppSettings } from "@/lib/settings";

export function AutomationSwitch({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 text-sm">
      <Switch checked={!paused} disabled={pending} onCheckedChange={(on) => start(async () => { const r = await setAutomationPausedAction(!on); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })} aria-label="Tự động hóa" />
      <span>{paused ? "Đang DỪNG — không có tác vụ tự động nào chạy." : "Đang BẬT — chỉ các tác vụ đã cấu hình (đồng bộ đọc). Không bao giờ tự gửi tin."}</span>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [cad, setCad] = useState(Object.entries(initial.cadenceDays).map(([k, v]) => `${k}=${v}`).join("\n"));
  const [sms, setSms] = useState(initial.smsOptOutTags.join(", "));
  const [mail, setMail] = useState(initial.emailOptOutTags.join(", "));
  const [lang, setLang] = useState(initial.defaultLanguage);
  const [excl, setExcl] = useState(initial.excludedStages.join("\n"));
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-3 sm:grid-cols-2 text-sm">
      <div>
        <Label>Số ngày tối đa giữa hai lần liên lạc, theo stage (stage=ngày)</Label>
        <textarea className="w-full rounded-md border bg-background p-2 font-mono text-xs" rows={8} value={cad} onChange={(e) => setCad(e.target.value)} />
      </div>
      <div className="space-y-3">
        <div><Label>Stage không cần follow up (mỗi dòng một stage)</Label><textarea className="w-full rounded-md border bg-background p-2 text-xs" rows={3} value={excl} onChange={(e) => setExcl(e.target.value)} /></div>
        <div><Label>Tag FUB coi là opt-out SMS</Label><Input value={sms} onChange={(e) => setSms(e.target.value)} /></div>
        <div><Label>Tag FUB coi là opt-out email</Label><Input value={mail} onChange={(e) => setMail(e.target.value)} /></div>
        <div>
          <Label>Ngôn ngữ mặc định cho tin gửi khách</Label>
          <select className="w-full rounded-md border bg-background px-3 py-2" value={lang} onChange={(e) => setLang(e.target.value as "en" | "vi")}><option value="en">English</option><option value="vi">Tiếng Việt</option></select>
        </div>
        <Button disabled={pending} onClick={() => start(async () => {
          const cadenceDays = Object.fromEntries(cad.split("\n").map((l) => l.split("=").map((x) => x.trim())).filter((p) => p[0] && p[1]).map(([k, v]) => [k, Number(v)]));
          const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
          const r = await saveSettingsAction({ cadenceDays, smsOptOutTags: split(sms), emailOptOutTags: split(mail), defaultLanguage: lang, excludedStages: excl.split("\n").map((x) => x.trim()).filter(Boolean) });
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        })}>Lưu cài đặt</Button>
      </div>
    </div>
  );
}
