"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SCENARIOS } from "@/lib/drafts/state";
import { generateDraftAction } from "@/app/actions/drafts";

type Opt = { id: string; label: string };

export function DraftGenerator({ clientId, saved, threads, defaultLanguage }: { clientId: string; saved: Opt[]; threads: Opt[]; defaultLanguage: "en" | "vi" }) {
  const router = useRouter();
  const [scenario, setScenario] = useState<keyof typeof SCENARIOS>("no_reply");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [language, setLanguage] = useState(defaultLanguage);
  const [props, setProps] = useState<string[]>([]);
  const [threadId, setThreadId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [pending, start] = useTransition();
  const needsProps = scenario === "send_homes" || scenario === "pre_offer";
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Tình huống</Label>
          <select className="w-full rounded-md border bg-background px-3 py-2" value={scenario} onChange={(e) => setScenario(e.target.value as keyof typeof SCENARIOS)}>
            {Object.entries(SCENARIOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <Label>Kênh</Label>
          <select className="w-full rounded-md border bg-background px-3 py-2" value={channel} onChange={(e) => setChannel(e.target.value as "sms" | "email")}>
            <option value="sms">SMS</option><option value="email">Email</option>
          </select>
        </div>
        <div>
          <Label>Ngôn ngữ nội dung</Label>
          <select className="w-full rounded-md border bg-background px-3 py-2" value={language} onChange={(e) => setLanguage(e.target.value as "en" | "vi")}>
            <option value="en">English</option><option value="vi">Tiếng Việt</option>
          </select>
        </div>
      </div>
      {needsProps && (
        <div>
          <Label>Căn nhà dùng trong tin (từ nhà đã lưu)</Label>
          {saved.length === 0 ? <p className="text-muted-foreground">Chưa lưu nhà nào cho khách.</p> : (
            <div className="space-y-1 pt-1">
              {saved.map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={props.includes(s.id)} onChange={() => setProps(props.includes(s.id) ? props.filter((x) => x !== s.id) : [...props, s.id])} />{s.label}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {channel === "email" && threads.length > 0 && (
        <div>
          <Label>Trả lời trong thread</Label>
          <select className="w-full rounded-md border bg-background px-3 py-2" value={threadId} onChange={(e) => setThreadId(e.target.value)}>
            <option value="">— Email mới —</option>
            {threads.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      )}
      <div><Label>Lưu ý thêm cho bản nháp (tùy chọn)</Label><Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="vd. nhắc khách mang theo pre-approval letter" /></div>
      <Button disabled={pending} onClick={() => start(async () => {
        const r = await generateDraftAction({ clientId, scenario, channel, language, propertyIds: needsProps ? props : [], threadId: threadId || null, instructions: instructions || undefined });
        if (!r.ok) return void toast.error(r.error);
        router.push(`/drafts/${r.data!.id}`);
      })}>{pending ? "Đang soạn…" : "Soạn bản nháp"}</Button>
    </div>
  );
}
