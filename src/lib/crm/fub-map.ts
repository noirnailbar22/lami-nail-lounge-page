import type { ContactPoint, RemoteInteraction, RemotePerson, RemoteTask } from "./types";

// Ánh xạ JSON của FUB sang dạng nội bộ. Chỉ giữ các trường assistant cần.
type J = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const date = (v: unknown) => {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

function points(v: unknown): ContactPoint[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p: J) => ({
      value: str(p.value) ?? "",
      type: str(p.type),
      status: str(p.status),
      isPrimary: p.isPrimary === true || p.isPrimary === 1,
    }))
    .filter((p) => p.value);
}

export function mapPerson(p: J): RemotePerson {
  const first = str(p.firstName);
  const last = str(p.lastName);
  return {
    fubId: Number(p.id),
    name: str(p.name) ?? ([first, last].filter(Boolean).join(" ") || `FUB #${p.id}`),
    firstName: first,
    lastName: last,
    emails: points(p.emails),
    phones: points(p.phones),
    stage: str(p.stage),
    sourceLabel: str(p.source),
    assignedTo: str(p.assignedTo),
    assignedUserId: num(p.assignedUserId),
    price: num(p.price),
    tags: Array.isArray(p.tags) ? (p.tags as unknown[]).filter((t): t is string => typeof t === "string") : [],
    lastActivityAt: date(p.lastActivity),
    remoteUpdated: date(p.updated),
  };
}

export function mapCall(c: J): RemoteInteraction {
  return {
    externalId: `call:${c.id}`,
    kind: "call",
    direction: c.isIncoming ? "in" : "out",
    occurredAt: date(c.created) ?? new Date(0),
    body: [str(c.note), num(c.duration) ? `(${c.duration}s)` : undefined].filter(Boolean).join(" ") || undefined,
  };
}

/** FUB ẩn nội dung SMS qua API ("Body is hidden for privacy reasons"). */
export const isHiddenBody = (v: unknown) => typeof v === "string" && /hidden for privacy/i.test(v);

export function mapText(t: J): RemoteInteraction {
  const hidden = isHiddenBody(t.message) || isHiddenBody(t.body);
  return {
    externalId: `text:${t.id}`,
    kind: "text",
    direction: t.isIncoming ? "in" : "out",
    occurredAt: date(t.sent) ?? date(t.created) ?? new Date(0),
    subject: hidden ? "FUB_HIDDEN" : t.isIncoming ? undefined : str(t.userName),
    // Không lưu chuỗi giữ chỗ — để AI không coi đó là nội dung.
    body: hidden ? undefined : str(t.message),
  };
}

export function mapEvent(e: J): RemoteInteraction {
  const prop = (e.property ?? {}) as J;
  return {
    externalId: `event:${e.id}`,
    kind: "event",
    direction: "in",
    occurredAt: date(e.occurredAt) ?? date(e.created) ?? new Date(0),
    subject: str(e.type),
    body: [str(e.message), str(e.description), str(prop.street), str(prop.city)].filter(Boolean).join(" · ") || undefined,
  };
}

export function mapNote(n: J): RemoteInteraction {
  return {
    externalId: `note:${n.id}`,
    kind: "note",
    occurredAt: date(n.created) ?? new Date(0),
    subject: str(n.subject),
    body: str(n.body),
  };
}

export function mapAppointment(a: J): RemoteInteraction {
  return {
    externalId: `appointment:${a.id}`,
    kind: "appointment",
    occurredAt: date(a.start) ?? date(a.created) ?? new Date(0),
    subject: str(a.title),
    body: [str(a.description), str(a.location)].filter(Boolean).join(" · ") || undefined,
  };
}

export function mapTask(t: J): RemoteTask {
  return {
    fubId: Number(t.id),
    personFubId: num(t.personId),
    name: str(t.name) ?? "(không tên)",
    type: str(t.type),
    dueAt: date(t.dueDateTime) ?? date(t.dueDate),
    isCompleted: t.isCompleted === true || t.isCompleted === 1,
  };
}
