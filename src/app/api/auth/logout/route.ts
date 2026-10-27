import { redirectTo } from "@/lib/redirect";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = redirectTo("/login");
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
