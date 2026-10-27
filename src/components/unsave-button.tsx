"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unsaveAction } from "@/app/actions/properties";

export function UnsaveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
      const r = await unsaveAction(id);
      if (r.ok) toast.success(r.message); else toast.error(r.error);
    })}>Bỏ lưu</Button>
  );
}
