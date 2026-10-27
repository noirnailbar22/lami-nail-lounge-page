# Follow Up Boss API — những gì đã xác minh

Nguồn: tài liệu chính thức https://docs.followupboss.com/reference (đọc ngày 26/10/2026). Chưa thử trên tài khoản thật của bạn.

## Chức năng được hỗ trợ (và app có dùng không)

| Chức năng | Endpoint | App dùng | Ghi chú |
|---|---|---|---|
| Tìm/đọc khách | `GET /people`, `GET /people/:id` | Có (chỉ đọc) | Lọc theo `stage`, `assignedUserId`, `lastActivityAfter`, `tags`… Lấy custom field qua `fields=allFields`. |
| Đọc cuộc gọi | `GET /calls?personId=` | Có | |
| Đọc tin nhắn đã ghi nhận | `GET /textMessages?personId=` | Có | |
| Đọc sự kiện (website/IDX, inquiry) | `GET /events?personId=` | Có | Giới hạn riêng: 20 req/10s (đã đăng ký) / 10 (chưa đăng ký). |
| Đọc lịch hẹn | `GET /appointments` | Có | Chỉ lịch tạo trong FUB, không gồm lịch đồng bộ từ calendar ngoài. |
| Đọc việc cần làm | `GET /tasks?personId=` | Có | |
| Tạo ghi chú | `POST /notes` | Có — **chỉ sau khi bạn duyệt** | `personId` bắt buộc; `subject`, `body`, `isHtml`. |
| Tạo việc | `POST /tasks` | Có — **chỉ sau khi bạn duyệt** | Cần `personId` và `assignedUserId` (hoặc `assignedTo`). `type`: Follow Up, Call, Text, Email, Appointment, Showing, Closing, Open House, Thank You. |
| Cập nhật khách | `PUT /people/:id` | Chưa dùng | Giới hạn 25 req/10s. Nhu cầu chi tiết được lưu trong app vì FUB không có trường chuẩn tương ứng. |
| Ghi nhận SMS đã gửi ở nơi khác | `POST /textMessages` | **Không** | Tài liệu nói rõ chỉ tạo log, *"No actual text messages are sent"*. Cần hệ thống đã đăng ký. |
| Webhook | `POST /webhooks` | Có route nhận, chưa đăng ký | Chỉ account owner tạo được; cần `X-System`; URL phải HTTPS. |

## Quyền / điều kiện

- API key của người dùng FUB (Admin → API). Basic auth: key làm username, mật khẩu rỗng.
- Header `X-System` (tên hệ thống) và `X-System-Key` (khóa hệ thống): tài liệu yêu cầu đăng ký hệ thống khi cung cấp dịch vụ cho khách hàng FUB. Không có `X-System-Key` thì giới hạn tốc độ thấp hơn, và không dùng được webhook hay `/textMessages`.
- Webhook: chỉ account owner tạo/sửa/xóa. Tối đa 2 webhook cho mỗi sự kiện mỗi hệ thống.

## Giới hạn

- Rate limit theo cửa sổ trượt 10 giây. Đã đăng ký: tổng 250, `/events` GET 20, `PUT /people` 25, `/notes` 10. Chưa đăng ký: tổng 125, `/events` GET 10.
- 429 kèm `Retry-After` (giây): request **chưa được xử lý** nên gửi lại an toàn. App chờ đúng thời gian rồi thử lại, tối đa 4 lần.
- Phân trang: `limit` tối đa 100; ưu tiên cursor `_metadata.next` / `nextLink` thay vì `offset`.
- Webhook chỉ gửi ID và URI; nhận xong phải GET lại bản ghi. FUB thử lại khi lỗi, tự tắt webhook nếu hơn 50% lỗi trong 48 giờ. Sự kiện bị lỡ chỉ lấy lại được trong 3 ngày.

## Chưa xác minh / cần thử trên tài khoản thật

- **Gửi SMS:** không có endpoint gửi SMS. App hiển thị "Cần gửi trong FUB" và không tự chuyển sang dịch vụ SMS khác.
- **Opt-out:** tài liệu `/people` không có trường opt-out/do-not-text chuẩn. `phones[].status` và `emails[].status` có vẻ chỉ là trạng thái hợp lệ. App kết hợp cờ trong app + tag FUB cấu hình được + status. Cần xác nhận cách đội bạn đánh dấu opt-out trong FUB.
- **Danh sách ghi chú theo khách** (`GET /notes?personId=`): tài liệu chỉ liệt kê thêm/đọc/sửa/xóa theo id. App thử gọi và ghi lỗi nếu không được.
- **Email trong FUB:** có webhook `emailsCreated`, nhưng không thấy endpoint đọc nội dung email trong danh sách tài liệu. App đọc email qua Gmail.
- **Chữ ký webhook:** tài liệu ghi "SHA256", còn mã mẫu dùng HMAC-SHA256 trên body base64 với khóa `X-System-Key`. App làm theo mã mẫu; cần kiểm tra với webhook thật.
- `sort=-updated` cho `/people`: chưa xác nhận tên trường sort.
