import { SignJWT, jwtVerify } from "jose";

// Phiên đăng nhập: cookie ký HS256. Dùng được cả ở middleware (edge) lẫn server.
export const SESSION_COOKIE = "ra_session";

function secret() {
  const s = process.env.SESSION_SECRET ?? "";
  return new TextEncoder().encode(s);
}

export function authRequired() {
  return (process.env.APP_PASSWORD ?? "").length > 0 || process.env.NODE_ENV === "production";
}

export function authMisconfigured() {
  return process.env.NODE_ENV === "production" && (!(process.env.APP_PASSWORD ?? "") || (process.env.SESSION_SECRET ?? "").length < 32);
}

export async function createSession() {
  return new SignJWT({ sub: "owner" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("14d").sign(secret());
}

export async function verifySession(token: string | undefined) {
  if (!token || (process.env.SESSION_SECRET ?? "").length < 32) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
