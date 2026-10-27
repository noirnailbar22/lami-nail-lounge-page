import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { logAction } from "../audit";
import { parseStyle, StyleProfileSchema, type StyleProfileData } from "./schema";

export async function getActiveStyle() {
  const row = await db.styleProfile.findFirst({ where: { isActive: true }, orderBy: { version: "desc" } });
  return { version: row?.version ?? null, data: parseStyle(row?.data) };
}

/** Lưu thành phiên bản mới (không sửa đè phiên bản cũ) và kích hoạt nó. */
export async function saveStyleVersion(data: StyleProfileData, note?: string) {
  const parsed = StyleProfileSchema.parse(data);
  return db.$transaction(async (tx) => {
    const last = await tx.styleProfile.findFirst({ orderBy: { version: "desc" } });
    await tx.styleProfile.updateMany({ data: { isActive: false } });
    const row = await tx.styleProfile.create({
      data: { version: (last?.version ?? 0) + 1, isActive: true, data: parsed as Prisma.InputJsonValue, note },
    });
    await logAction({ action: "style.save", entityType: "StyleProfile", entityId: row.id, details: { version: row.version, note } });
    return row;
  });
}

/** Khôi phục = tạo phiên bản mới với nội dung của phiên bản cũ. */
export async function restoreStyleVersion(version: number) {
  const old = await db.styleProfile.findUniqueOrThrow({ where: { version } });
  return saveStyleVersion(parseStyle(old.data), `Khôi phục từ phiên bản ${version}`);
}

export async function styleExamples(channel?: string) {
  return db.styleSample.findMany({
    where: channel ? { channel } : {},
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { channel: true, label: true, text: true, language: true },
  });
}
