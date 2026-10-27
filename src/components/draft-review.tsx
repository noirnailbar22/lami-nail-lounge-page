"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveDraftAction, confirmManualSentAction, rejectDraftAction, resolveUnknownAction, saveAsExampleAction, sendDraftAction, updateDraftAction,
} from "@/app/actions/drafts";

type D = {
  id: string;
  channel: "sms" | "email";
  status: string;
  recipientName: string | null;
  recipientAddress: string | null;
  subject: string | null;
  body: string;
  approvedAt: string | null;
  stillApproved: boolean;
  sendError: string | null;
  isDemo: boolean;
};

export function DraftReview({ draft, contactOptions, optOut }: { draft: D; contactOptions: { value: string }[]; optOut: { blocked: boolean; reasons: string[] } }) {
  const router = useRouter();
  const [body, setBody] = useState(draft.body);
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [recipient, setRecipient] = useState(draft.recipientAddress ?? "");
  const [pending, start] = useTransition();
  const [crossChannelPrompt, setCrossChannelPrompt] = useState<string | null>(null);
  const dirty = body !== draft.body || subject !== (draft.subject ?? "") || recipient !== (draft.recipientAddress ?? "");
  const editable = ["draft", "approved", "failed"].includes(draft.status);
  const done = () => router.refresh();

  const save = async () => {
    const r = await updateDraftAction(draft.id, { body, subject: draft.channel === "email" ? subject : null, recipientAddress: recipient || null });
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    if (draft.status === "approved" && r.data?.status === "draft") toast.warning("Nội dung đã đổi — duyệt cũ bị hủy, cần duyệt lại.");
    else toast.success(r.message);
    return true;
  };

  const send = async (allowCross = false) => {
    const r = await sendDraftAction(draft.id, allowCross);
    if (!r.ok) {
      if (r.error.includes("trong 7 ngày")) setCrossChannelPrompt(r.error);
      else toast.error(r.error);
      return;
    }
    setCrossChannelPrompt(null);
    const res = r.data!;
    if (res.status === "sent") toast.success(res.message);
    else if (res.status === "needs_manual_send" || res.status === "sent_demo") toast.info(res.message);
    else toast.error(res.message);
    done();
  };

  /** SMS: "Duyệt và gửi qua FUB" = duyệt đúng nội dung + người nhận này, rồi chuẩn bị gửi. */
  const approveAndSendSms = () =>
    start(async () => {
      if (dirty && !(await save())) return;
      if (draft.status !== "approved" || dirty) {
        const a = await approveDraftAction(draft.id);
        if (!a.ok) return void toast.error(a.error);
      }
      await send();
    });

  const copy = async () => {
    await navigator.clipboard.writeText(body);
    toast.success("Đã sao chép nội dung");
  };

  return (
    <Card>
      <CardHeader><CardTitle>Xem trước trước khi gửi</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Người nhận</Label>
            <div className="font-medium">{draft.recipientName ?? "—"}</div>
          </div>
          <div>
            <Label htmlFor="rcpt">{draft.channel === "sms" ? "Số điện thoại" : "Email"}</Label>
            <select id="rcpt" disabled={!editable} className="w-full rounded-md border bg-background px-3 py-2" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="">— Chọn —</option>
              {contactOptions.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
          </div>
        </div>
        {draft.channel === "email" && (
          <div><Label htmlFor="subj">Tiêu đề</Label><Input id="subj" disabled={!editable} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        )}
        <div>
          <Label htmlFor="body">Nội dung</Label>
          <Textarea id="body" disabled={!editable} rows={draft.channel === "sms" ? 5 : 12} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="text-xs text-muted-foreground mt-1">{body.length} ký tự{draft.channel === "sms" && body.length > 160 ? ` · khoảng ${Math.ceil(body.length / 153)} phần SMS` : ""}</div>
        </div>

        {optOut.blocked && <div className="rounded border border-red-300 bg-red-50 p-2 text-red-800">Bị chặn gửi: {optOut.reasons.join(" ")}</div>}
        {draft.status === "approved" && draft.stillApproved && !dirty && <div className="rounded bg-blue-50 p-2 text-blue-900">Đã duyệt lúc {new Date(draft.approvedAt!).toLocaleString("vi-VN")} cho đúng nội dung và người nhận đang hiển thị.</div>}
        {dirty && draft.status === "approved" && <div className="rounded bg-amber-50 p-2 text-amber-900">Bạn đang sửa — lưu lại sẽ hủy duyệt.</div>}
        {draft.sendError && <div className="rounded bg-red-50 p-2 text-red-800">Lỗi lần trước: {draft.sendError}</div>}

        {draft.status === "needs_manual_send" && (
          <div className="rounded border-2 border-orange-400 bg-orange-50 p-3 space-y-2">
            <div className="font-semibold text-orange-900">Cần gửi trong FUB</div>
            <p>Follow Up Boss không cung cấp API gửi SMS cho tích hợp này. Hệ thống <strong>chưa gửi</strong> tin nhắn. Sao chép nội dung, mở hồ sơ khách trong FUB và gửi tới <strong>{draft.recipientAddress}</strong>.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy}>Sao chép nội dung</Button>
              <Button variant="outline" disabled={pending} onClick={() => start(async () => {
                const r = await confirmManualSentAction(draft.id);
                if (r.ok) { toast.success(r.message); done(); } else toast.error(r.error);
              })}>Tôi đã gửi trong FUB</Button>
            </div>
          </div>
        )}

        {draft.status === "unknown" && (
          <div className="rounded border-2 border-red-500 bg-red-50 p-3 space-y-2">
            <div className="font-semibold text-red-900">Chưa xác định kết quả lần gửi trước</div>
            <p>Hệ thống không tự gửi lại. Kiểm tra hộp thư đã gửi trước.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await resolveUnknownAction(draft.id); if (r.ok) toast.info(r.data!.message); else toast.error(r.error); done(); })}>Kiểm tra trong Gmail</Button>
              <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await resolveUnknownAction(draft.id, "sent"); if (r.ok) toast.success(r.data!.message); done(); })}>Đã gửi rồi</Button>
              <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await resolveUnknownAction(draft.id, "not_sent"); if (r.ok) toast.success(r.data!.message); done(); })}>Chắc chắn chưa gửi</Button>
            </div>
          </div>
        )}

        {crossChannelPrompt && (
          <div className="rounded border border-amber-400 bg-amber-50 p-3 space-y-2">
            <p className="text-amber-900">{crossChannelPrompt}</p>
            <Button variant="outline" disabled={pending} onClick={() => start(() => send(true))}>Tôi muốn gửi cả hai kênh</Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {editable && <Button variant="outline" disabled={pending || !dirty} onClick={() => start(async () => { if (await save()) done(); })}>Lưu bản sửa</Button>}
          {draft.channel === "sms" && editable && (
            <Button disabled={pending || optOut.blocked || !recipient} onClick={approveAndSendSms}>Duyệt và gửi qua FUB</Button>
          )}
          {draft.channel === "email" && ["draft", "failed"].includes(draft.status) && (
            <Button disabled={pending || dirty || optOut.blocked} onClick={() => start(async () => {
              const r = await approveDraftAction(draft.id);
              if (r.ok) { toast.success(r.message); done(); } else toast.error(r.error);
            })}>Duyệt email này</Button>
          )}
          {draft.channel === "email" && draft.status === "approved" && (
            <Button disabled={pending || dirty || !draft.stillApproved || optOut.blocked} onClick={() => start(() => send())}>
              {draft.isDemo ? "Gửi (DEMO — không gửi thật)" : "Gửi email đã duyệt"}
            </Button>
          )}
          {editable && <Button variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await rejectDraftAction(draft.id); if (r.ok) { toast.success(r.message); done(); } else toast.error(r.error); })}>Từ chối</Button>}
          <Button variant="ghost" onClick={copy}>Sao chép</Button>
          <Button variant="ghost" disabled={pending || dirty} onClick={() => start(async () => { const r = await saveAsExampleAction(draft.id); if (r.ok) toast.success(r.message); else toast.error(r.error); })}>Dùng bản sửa này làm ví dụ phong cách</Button>
        </div>
        {draft.channel === "sms" && <p className="text-xs text-muted-foreground">SMS: mỗi tin duyệt riêng. Không tự gửi, không tự gửi lại. Đổi nội dung hoặc số nhận → phải duyệt lại.</p>}
      </CardContent>
    </Card>
  );
}
