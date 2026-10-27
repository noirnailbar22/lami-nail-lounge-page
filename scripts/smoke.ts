// Smoke test các trang chính trên server đang chạy (mặc định http://localhost:3000).
// Dùng: npm run smoke  [-- http://host:port]
const base = process.argv[2] ?? "http://localhost:3000";
const PAGES = ["/", "/clients", "/drafts", "/style", "/properties", "/properties/import", "/comps", "/comps/rules", "/settings", "/settings/log", "/api/health"];

async function main() {
  let fail = 0;
  for (const p of PAGES) {
    const res = await fetch(base + p, { redirect: "manual" });
    const ok = res.status === 200 || (res.status === 307 && (res.headers.get("location") ?? "").includes("/login"));
    if (!ok) fail++;
    console.log(`${ok ? "OK  " : "FAIL"} ${res.status} ${p}`);
  }
  const demo = await fetch(base + "/").then((r) => r.text());
  console.log(demo.includes("CHẾ ĐỘ DEMO") ? "Banner DEMO hiển thị" : "Không thấy banner DEMO (chế độ dữ liệu thật?)");
  if (fail) process.exit(1);
}
main();
