# Trợ lý Realtor

Web app trợ lý cho công việc realtor: xem khách từ Follow Up Boss, soạn follow up theo giọng văn của bạn (duyệt từng tin), tìm nhà theo nhu cầu, và workspace run comps theo quy tắc bạn tự cấu hình.

- **Follow Up Boss vẫn là CRM chính.** App chỉ giữ bản sao tối thiểu (khóa theo FUB ID) và dữ liệu riêng của assistant: nhu cầu, bản nháp, giọng văn, nhà, comps.
- Giao diện tiếng Việt; nội dung gửi khách bằng English hoặc tiếng Việt.
- Stack: Next.js 15 (App Router, TypeScript), Tailwind 4 + shadcn/ui, PostgreSQL + Prisma 6, Anthropic API (Claude), triển khai trên Railway.

## Chạy local

Yêu cầu Node.js ≥ 22. Trên máy này Node đã được cài vào `~/.local/node` (không cần sudo). Mở terminal mới và thêm vào PATH:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

Lần đầu:

```bash
cd "/Applications/Real estate/realtor-assistant"
npm install
cp .env.example .env        # đã có sẵn .env ở chế độ demo
```

Mỗi lần chạy (2 terminal):

```bash
npm run db:start            # terminal 1: PostgreSQL local cổng 5433, dữ liệu trong ./.pgdata
```

```bash
npm run db:deploy && npm run db:seed && npm run dev    # terminal 2: http://localhost:3000
```

`db:seed` chạy lại nhiều lần vẫn an toàn (không tạo trùng). `npm run db:reset-demo` xóa dữ liệu demo rồi tạo lại.

## Chế độ demo

`DEMO_MODE="true"` (mặc định), hoặc khi thiếu key:

- Khách, nhà, thread email đều **hư cấu**: email `@example.com`, số `555`, địa chỉ "Demo/Sample/Fictional", MLS# `DEMO…`.
- Mọi trang có banner vàng **CHẾ ĐỘ DEMO**; từng bản ghi có nhãn `DEMO`.
- Bản nháp do **mẫu cố định** soạn (không phải AI) và được ghi rõ điều đó. Tìm kiếm bằng lời dùng bộ phân tích quy tắc.
- Gửi email demo trả về trạng thái "DEMO — giả lập gửi, không gửi thật". Ghi CRM demo chỉ ghi cục bộ.

Bật dữ liệu thật: điền key trong `.env` và đặt `DEMO_MODE="false"`.

## Kiểm tra

```bash
npm run typecheck && npm run lint && npm test
```

```bash
npm run smoke               # khi dev server đang chạy
```

`npm test` gồm 68 test: unit (logic thuần) và integration (chạy trên database riêng `realtor_test`, cần `npm run db:start`). Các test bao phủ:

- Đồng bộ không tạo trùng khách và không ghi đè bằng bản cũ hơn; đồng bộ không xóa nhu cầu/opt-out lưu trong app.
- Phân biệt draft / approved / "Cần gửi trong FUB" / sent; sửa sau khi duyệt sẽ hủy duyệt.
- Không gửi trùng: gửi lại, gửi song song 3 request, timeout ("chưa xác định") → không tự gửi lại.
- Opt-out chặn cả lúc duyệt lẫn lúc gửi (cờ trong app, tag FUB, status số điện thoại).
- Chặn gửi cùng tình huống qua hai kênh trừ khi bạn xác nhận.
- Thiếu dữ liệu được báo rõ; CSV có nguồn xung đột thì ghi lại, không ghi đè.
- Comps: không có quy tắc thì không có khoảng giá; điều chỉnh đúng hệ số và hướng; hệ số chưa cấu hình không được áp dụng; pending/giá chào/ước tính không bao giờ là cơ sở giá.
- FUB client: phân trang, 429 + Retry-After, không thử lại POST lỗi 5xx, chặn URL lạ, chữ ký webhook.
- Fair Housing: các cụm "safe neighborhood", "family-friendly"… không thành bộ lọc.
- Demo chạy khi không có API key.

## Cấu trúc

```
src/app/                 Trang (server components) + server actions + API routes
src/components/          UI (client components)
src/lib/crm/             FUB client (rate limit/retry/phân trang), mapping, đồng bộ, webhook
src/lib/drafts/          Soạn nháp, trạng thái, duyệt, gửi (idempotent), dữ kiện & phần thiếu
src/lib/email/           Provider interface: demo + Gmail (OAuth)
src/lib/style/           Hồ sơ giọng văn, phân tích mẫu, phiên bản
src/lib/properties/      CSV, gộp/xung đột, bộ lọc, phù hợp, nhận định deal, Fair Housing, nguồn
src/lib/comps/           Quy tắc (schema), tính toán, đề xuất từ ví dụ
src/lib/ai/              Claude: JSON qua zod schema, ranh giới dữ liệu/chỉ dẫn
prisma/                  Schema, migrations, seed demo
samples/                 CSV mẫu hư cấu (cũng có ở /samples/*.csv trong app)
tests/                   Vitest unit + integration
docs/fub-api.md          Bảng tóm tắt Follow Up Boss API đã xác minh
```

## Trạng thái kết nối

| Kết nối | Trạng thái | Ghi chú |
|---|---|---|
| App, database, demo | ✅ Hoạt động | |
| Giọng văn, bản nháp, duyệt | ✅ Hoạt động | Soạn bằng mẫu khi chưa có AI key |
| Nhập CSV / nhập tay / lưu link | ✅ Hoạt động | |
| Tìm nhà, lưu nhà vào khách, soạn tin giới thiệu | ✅ Hoạt động | Trên dữ liệu đã nhập |
| Workspace comps, quy tắc, ví dụ, bản in/PDF | ✅ Hoạt động | Khoảng giá chỉ có sau khi bạn duyệt bộ quy tắc |
| Đăng nhập, mã hóa token, nhật ký, công tắc dừng | ✅ Hoạt động | |
| Anthropic (Claude) | 🟡 Demo — đã viết code, chờ key | Model `claude-opus-5-5`, có fallback khi bị từ chối |
| Follow Up Boss — đọc khách, tương tác, task | 🟡 Đã viết code, chưa chạy với tài khoản thật | Đã có `~/.config/fub/api_key` trên máy nhưng app chưa dùng |
| Follow Up Boss — ghi note/task sau duyệt | 🟡 Đã viết code, chưa chạy thật | |
| FUB webhook | 🟡 Route sẵn sàng, chưa đăng ký | Cần đăng ký hệ thống + URL HTTPS |
| Gmail / Google Workspace | 🟡 Đã viết code OAuth, chờ OAuth client | Quyền: `gmail.readonly`, `gmail.send` |
| Gửi SMS qua FUB | ⛔ Bị chặn — FUB không có API gửi | Bạn sao chép và gửi trong FUB; app không báo đã gửi |
| ABOR / Unlock MLS | ⛔ Chưa có quyền truy cập | Cần data license + RESO Web API |
| Zillow / Redfin | ⛔ Không có API công khai phù hợp | Chỉ lưu link + nhập tay |

## Thông tin cần bạn cung cấp để bật từng kết nối

1. **AI:** `ANTHROPIC_API_KEY` (console.anthropic.com).
2. **FUB đọc/ghi:** `FUB_API_KEY`. Có thể dùng key đã lưu ở `~/.config/fub/api_key` (bạn tự chép giá trị vào `.env`; app không tự đọc file đó).
3. **FUB webhook và giới hạn cao hơn:** đăng ký hệ thống tại FUB → `FUB_SYSTEM_NAME`, `FUB_SYSTEM_KEY`. Đặt `FUB_WEBHOOK_TOKEN` (chuỗi ngẫu nhiên). Đăng ký webhook cần quyền account owner.
4. **Opt-out trong FUB:** đội bạn đánh dấu "không nhắn tin" bằng cách nào (tag nào, trường nào). Danh sách tag mặc định có thể sửa ở Cài đặt.
5. **Gmail:** tạo OAuth client (loại Web) trong Google Cloud Console, bật Gmail API, thêm redirect URI. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` và `ENCRYPTION_KEY` (`openssl rand -base64 32`). Nếu là Google Workspace, có thể đặt OAuth consent là "Internal".
6. **MLS:** xác nhận với Unlock MLS/ABOR loại license được phép dùng cho công cụ nội bộ, và thông tin RESO Web API (trực tiếp hoặc qua vendor được cấp phép).
7. **Phương pháp comps:** nhập vào trang "Quy tắc run comps" hoặc thêm ví dụ thật. Hiện chưa có hệ số nào được cấu hình.

## Triển khai Railway

Đã deploy: project `realtor-assistant` (workspace noirnailbar22), service `web` + `Postgres`, địa chỉ https://web-production-4ab1.up.railway.app. Cập nhật: `railway up --service web` (hoặc nối repo GitHub `noirnailbar22/realtor-assistant` trong Railway để tự deploy khi push).


1. Tạo project trên Railway, thêm **PostgreSQL**, thêm service từ repo này.
2. Variables của service: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `APP_PASSWORD`, `SESSION_SECRET` (≥ 32 ký tự: `openssl rand -base64 48`), `ENCRYPTION_KEY`, `DEMO_MODE`, cùng các key ở trên. `GOOGLE_REDIRECT_URI=https://<domain>/api/email/google/callback`.
3. `npm run start` tự chạy `prisma migrate deploy` trước khi khởi động, nên database luôn đúng schema. Lưu ý: Railway hiện bỏ qua `railway.json` (định dạng cũ) cho lệnh pre-deploy. Healthcheck `/api/health` kiểm tra cả kết nối lẫn schema.
4. Khi chạy production mà thiếu `APP_PASSWORD` hoặc `SESSION_SECRET`, app trả 503 và không phục vụ trang nào.
5. Seed demo trên Railway là tùy chọn: `railway run npm run db:seed`.

## Backup & khôi phục

- `npm run backup` → `backups/backup-<thời gian>.json` (mọi bảng; token OAuth vẫn ở dạng đã mã hóa).
- `npm run restore -- backups/<file>.json` → chỉ khôi phục vào database **trống** đã migrate; từ chối nếu đã có dữ liệu.
- Railway: bật backup của dịch vụ Postgres và/hoặc chạy `pg_dump "$DATABASE_URL" > backup.sql` theo lịch. Khôi phục: `psql "$DATABASE_URL" < backup.sql` vào database mới, sau đó đổi `DATABASE_URL`.
- Giữ `ENCRYPTION_KEY` cùng bản backup ở nơi an toàn. Mất khóa này thì token Gmail không giải mã được và phải kết nối lại Gmail.

## Bảo mật & nguyên tắc

- Secret chỉ nằm trong biến môi trường phía server; `.env` nằm trong `.gitignore`. Nhật ký tự ẩn các trường có tên chứa token/secret/password/key.
- Mọi input của server action và output của AI đều được kiểm tra bằng zod schema.
- Nội dung email, listing, CSV, ghi chú được bọc trong thẻ `<data>` khi gửi cho AI và chỉ được coi là dữ liệu. AI không có công cụ nào để gửi tin hay ghi CRM.
- Gửi tin và ghi CRM luôn cần bạn bấm duyệt. Mỗi lần duyệt chỉ gắn với đúng một nội dung và một người nhận.
- Công tắc **dừng tự động hóa** ở Cài đặt (mặc định: DỪNG). Hiện app chưa có tác vụ tự động nào; công tắc này dành cho giai đoạn 4.
- Tìm nhà chỉ dùng tiêu chí khách quan của căn nhà.
