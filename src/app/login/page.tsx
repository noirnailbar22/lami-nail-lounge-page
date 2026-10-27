import { Home, Lock } from "lucide-react";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-sidebar p-12 text-white">
        <div className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-orange-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-teal-500 text-emerald-950 shadow-lg">
            <Home className="size-5" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-semibold">Trợ lý Realtor</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">
            Follow up đúng lúc.
            <br />
            <span className="bg-gradient-to-r from-emerald-300 to-amber-200 bg-clip-text text-transparent">Đúng giọng của bạn.</span>
          </h2>
          <p className="mt-4 text-white/70">Khách từ Follow Up Boss, bản nháp chờ bạn duyệt, tìm nhà và run comps — trong một nơi.</p>
        </div>
        <p className="relative text-xs text-white/40">Mọi tin nhắn và thay đổi CRM đều cần bạn duyệt.</p>
      </div>

      <div className="flex items-center justify-center p-6 app-bg">
        <form method="post" action="/api/auth/login" className="w-full max-w-sm space-y-5 rounded-3xl bg-card p-8 shadow-[0_24px_64px_-24px_rgba(16,40,40,0.35)] ring-1 ring-black/5">
          <div className="space-y-1">
            <span className="grid size-11 place-items-center rounded-xl bg-secondary text-secondary-foreground">
              <Lock className="size-5" />
            </span>
            <h1 className="pt-3 text-2xl font-bold">Đăng nhập</h1>
            <p className="text-sm text-muted-foreground">Nhập mật khẩu để vào trợ lý.</p>
          </div>
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm font-medium">
            Mật khẩu
            <input
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </label>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Sai mật khẩu, thử lại.</p>}
          <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110">
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
}
