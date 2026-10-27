// Dạng dữ liệu chung giữa FUB và demo provider.

export type ContactPoint = { value: string; type?: string; status?: string; isPrimary?: boolean };

export type RemotePerson = {
  fubId: number;
  name: string;
  firstName?: string;
  lastName?: string;
  emails: ContactPoint[];
  phones: ContactPoint[];
  stage?: string;
  sourceLabel?: string;
  assignedTo?: string;
  assignedUserId?: number;
  price?: number;
  tags: string[];
  lastActivityAt?: Date;
  remoteUpdated?: Date;
};

export type RemoteInteraction = {
  externalId: string;
  kind: "note" | "call" | "text" | "email" | "event" | "appointment";
  direction?: "in" | "out";
  occurredAt: Date;
  subject?: string;
  body?: string;
};

export type RemoteTask = {
  fubId: number;
  personFubId?: number;
  name: string;
  type?: string;
  dueAt?: Date;
  isCompleted: boolean;
};
