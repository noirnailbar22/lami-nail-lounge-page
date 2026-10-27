"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { setOptOutAction } from "@/app/actions/clients";

export function OptOutToggles({ clientId, sms, email }: { clientId: string; sms: boolean; email: boolean }) {
  const [pending, start] = useTransition();
  const t = (channel: "sms" | "email", value: boolean) =>
    start(async () => {
      const r = await setOptOutAction(clientId, channel, value);
      if (r.ok) toast.success(r.message); else toast.error(r.error);
    });
  return (
    <div className="flex flex-wrap gap-4 pt-2 text-xs">
      <label className="flex items-center gap-1"><input type="checkbox" disabled={pending} checked={sms} onChange={(e) => t("sms", e.target.checked)} /> Không nhận SMS</label>
      <label className="flex items-center gap-1"><input type="checkbox" disabled={pending} checked={email} onChange={(e) => t("email", e.target.checked)} /> Không nhận email</label>
    </div>
  );
}
