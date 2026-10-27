// Nguồn dữ liệu nhà và trạng thái truy cập. Provider interface cho phép thay nguồn mà không viết lại app.
export type SourceStatus = "active" | "demo" | "blocked" | "manual";

export type ListingSource = {
  id: string;
  name: string;
  status: SourceStatus;
  note: string;
  needs: string[];
};

export const LISTING_SOURCES: ListingSource[] = [
  {
    id: "csv",
    name: "Nhập CSV / nhập tay",
    status: "active",
    note: "Dữ liệu bạn được phép sử dụng (vd. export từ MLS theo quyền thành viên). Hoạt động ngay.",
    needs: [],
  },
  {
    id: "link",
    name: "Lưu link listing làm tham chiếu",
    status: "manual",
    note: "Lưu link Zillow/Redfin/MLS để tham chiếu. App KHÔNG tự đọc nội dung trang (không scrape, không vượt đăng nhập/CAPTCHA). Bạn tự nhập các trường cần thiết.",
    needs: [],
  },
  {
    id: "mls",
    name: "ABOR / Unlock MLS (RESO Web API)",
    status: "blocked",
    note: "Tài khoản xem listing không đồng nghĩa có quyền API. Cần thỏa thuận cấp dữ liệu (data license) với MLS và thông tin truy cập RESO Web API.",
    needs: [
      "Xác nhận với Unlock MLS/ABOR loại license phù hợp (vd. IDX/VOW/back-office) cho mục đích dùng nội bộ",
      "Client ID / secret hoặc token RESO Web API do MLS hoặc vendor được cấp phép (vd. Bridge, Trestle, Spark) cung cấp",
      "Điều kiện hiển thị/lưu trữ dữ liệu theo quy định MLS",
    ],
  },
  {
    id: "zillow",
    name: "Zillow",
    status: "blocked",
    note: "Zillow không có public API tìm listing cho mục đích này; các API của Zillow Group (Bridge) cần được duyệt riêng. Chỉ hỗ trợ lưu link tham chiếu và nhập tay.",
    needs: ["Được Zillow Group/Bridge Interactive cấp quyền dữ liệu (nếu có chương trình phù hợp)"],
  },
  {
    id: "redfin",
    name: "Redfin",
    status: "blocked",
    note: "Redfin không có public API listing. Chỉ hỗ trợ lưu link tham chiếu và nhập tay/CSV bạn được phép tải.",
    needs: ["Không có kết nối được phép hiện tại"],
  },
];
