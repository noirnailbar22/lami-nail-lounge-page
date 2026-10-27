import type { AppSettings } from "../settings";

export function cadenceFor(stage: string | null | undefined, s: Pick<AppSettings, "cadenceDays">) {
  return s.cadenceDays[stage ?? ""] ?? s.cadenceDays.default ?? 7;
}

/** Số ngày quá hạn follow-up (<= 0 là chưa đến hạn). null = không có mốc liên lạc. */
export function overdueDays(
  c: { stage: string | null; lastActivityAt: Date | null },
  s: Pick<AppSettings, "cadenceDays"> & Partial<Pick<AppSettings, "excludedStages">>,
  now = new Date(),
): number | null {
  if ((s.excludedStages ?? []).includes(c.stage ?? "") || /trash|archive/i.test(c.stage ?? "")) return -Infinity;
  if (!c.lastActivityAt) return null;
  const days = (now.getTime() - c.lastActivityAt.getTime()) / 86_400_000;
  return Math.floor(days - cadenceFor(c.stage, s));
}
