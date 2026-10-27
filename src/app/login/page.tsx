export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form method="post" action="/api/auth/login" className="w-full max-w-sm space-y-3 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Trợ lý Realtor — Đăng nhập</h1>
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm">Mật khẩu
          <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        {error && <p className="text-sm text-red-700">Sai mật khẩu.</p>}
        <button className="w-full rounded-md bg-primary text-primary-foreground py-2">Đăng nhập</button>
      </form>
    </div>
  );
}
