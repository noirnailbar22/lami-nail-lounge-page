import { db } from "../db";
import { gmailConfigured } from "../env";
import { demoEmailProvider } from "./demo";
import { gmailProvider } from "./gmail";
import type { EmailProvider } from "./types";

/** Khách demo luôn dùng provider demo; khách thật dùng Gmail nếu đã kết nối. */
export async function emailProviderFor(isDemoClient: boolean): Promise<EmailProvider | null> {
  if (isDemoClient) return demoEmailProvider;
  if (!gmailConfigured()) return null;
  const cred = await db.oAuthCredential.findFirst({ where: { provider: "google" } });
  return cred ? gmailProvider : null;
}
