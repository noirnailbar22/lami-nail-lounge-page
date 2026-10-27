export type EmailMessage = { id: string; from: string; to: string; date: string; subject: string; snippet: string; body?: string };
export type EmailThread = { id: string; subject: string; lastDate: string; messages: EmailMessage[] };

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  /** Message-ID tự đặt, dùng để đối soát khi không rõ kết quả gửi. */
  messageIdHeader: string;
};

export interface EmailProvider {
  id: "gmail" | "demo";
  label: string;
  isDemo: boolean;
  listThreads(contactEmail: string): Promise<EmailThread[]>;
  getThread(threadId: string): Promise<EmailThread | null>;
  send(input: SendEmailInput): Promise<{ providerMessageId: string; threadId?: string }>;
  /** Tìm thư đã gửi theo Message-ID — dùng để xác định kết quả khi lần gửi trước không rõ. */
  findSent(messageIdHeader: string): Promise<string | null>;
}

/** Lỗi gửi đã xác định chắc chắn là KHÔNG gửi (vd. 400). */
export class DefiniteSendError extends Error {}
