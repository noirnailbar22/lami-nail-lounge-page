// Đọc cấu hình phía server. Không bao giờ log giá trị secret.
function val(name: string): string {
  return (process.env[name] ?? "").trim();
}

export const env = {
  get demoMode() {
    return val("DEMO_MODE") !== "false";
  },
  get anthropicKey() {
    return val("ANTHROPIC_API_KEY");
  },
  get anthropicModel() {
    return val("ANTHROPIC_MODEL") || "claude-opus-5-5";
  },
  get fubKey() {
    return val("FUB_API_KEY");
  },
  get fubSystemName() {
    return val("FUB_SYSTEM_NAME") || "RealtorAssistant";
  },
  get fubSystemKey() {
    return val("FUB_SYSTEM_KEY");
  },
  get fubWebhookToken() {
    return val("FUB_WEBHOOK_TOKEN");
  },
  get appPassword() {
    return val("APP_PASSWORD");
  },
  get sessionSecret() {
    return val("SESSION_SECRET");
  },
  get encryptionKey() {
    return val("ENCRYPTION_KEY");
  },
  get google() {
    return {
      clientId: val("GOOGLE_CLIENT_ID"),
      clientSecret: val("GOOGLE_CLIENT_SECRET"),
      redirectUri: val("GOOGLE_REDIRECT_URI"),
    };
  },
  get signature() {
    return {
      name: val("SIGNATURE_NAME") || "Hiep",
      company: val("SIGNATURE_COMPANY"),
      phone: val("SIGNATURE_PHONE"),
      email: val("SIGNATURE_EMAIL"),
    };
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

/** AI thật chỉ chạy khi có key và không ở chế độ demo. */
export function aiEnabled() {
  return !env.demoMode && env.anthropicKey.length > 0;
}

/** CRM thật (FUB) chỉ dùng khi có key và không ở chế độ demo. */
export function fubEnabled() {
  return !env.demoMode && env.fubKey.length > 0;
}

export function gmailConfigured() {
  const g = env.google;
  return !env.demoMode && !!(g.clientId && g.clientSecret && g.redirectUri);
}
