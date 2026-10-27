// Quyết định đồng bộ thuần (không đụng DB) — dễ kiểm thử.

export type UpsertDecision = "create" | "update" | "skip_stale" | "skip_unchanged";

/**
 * - Chưa có bản ghi với fubId này → create (fubId unique nên không thể tạo trùng).
 * - Bản đến cũ hơn bản đã lưu → skip_stale (không ghi đè bằng dữ liệu cũ).
 * - Cùng thời điểm cập nhật → skip_unchanged.
 * - Không có mốc thời gian ở bản đến → chỉ cập nhật nếu bản lưu cũng không có mốc.
 */
export function decideUpsert(
  existing: { remoteUpdated: Date | null } | null,
  incoming: { remoteUpdated?: Date | null },
): UpsertDecision {
  if (!existing) return "create";
  const a = existing.remoteUpdated?.getTime();
  const b = incoming.remoteUpdated?.getTime();
  if (b === undefined) return a === undefined ? "update" : "skip_stale";
  if (a === undefined) return "update";
  if (b < a) return "skip_stale";
  if (b === a) return "skip_unchanged";
  return "update";
}
