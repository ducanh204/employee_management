# Slave Management — Auth + User module

## Setup

```bash
npm install
cp .env.example .env   # rồi sửa DATABASE_URL, JWT secrets

npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed      # tạo sẵn 3 user: admin/manager/employee@example.com, password Password123

npm run tsoa:gen         # sinh routes từ @Route decorator trong controllers
npm run dev
```

## Logic auth flow (đọc trước khi code tiếp)

**Access token (JWT, 15 phút):** ký bằng `JWT_ACCESS_SECRET`, chứa `{ sub, email, role }`.
Không lưu ở DB — server verify bằng cách check signature, không cần query.

**Refresh token (random string, 7 ngày):** KHÔNG phải JWT. Client giữ bản gốc,
server chỉ lưu bản hash (sha256) trong bảng `refresh_tokens`. Lý do: nếu DB bị lộ,
kẻ tấn công có hash cũng không tự tạo được token hợp lệ (giống cách không bao giờ
lưu password dạng plaintext).

**Rotation (trong `refreshAccessToken`):** mỗi lần refresh, token cũ bị revoke NGAY,
token mới được tạo — cả 2 thao tác nằm trong 1 `$transaction`. Nếu ai đó dùng lại
1 refresh token đã bị revoke (dấu hiệu token bị đánh cắp), toàn bộ token của user
đó bị thu hồi, buộc đăng nhập lại trên mọi thiết bị.

**Vì sao tách `authenticate` và `authorize`:** `authenticate` (đăng nhập chưa) và
`authorize` (có quyền role gì không) là 2 câu hỏi độc lập. Route "xem profile của
mình" chỉ cần `authenticate`; route "xem báo cáo toàn công ty" cần cả 2. Tách ra để
compose theo từng route thay vì viết middleware riêng cho từng trường hợp.

**Vì sao dùng `@Security` của tsoa thay vì Express middleware thường:** dự án dùng
tsoa để tự sinh route từ decorator — muốn áp middleware theo từng route (thay vì
toàn cục), cách idiomatic của tsoa là khai báo `@Security("jwt", ["ADMIN"])` trên
từng method, tsoa sẽ tự gọi `expressAuthentication` (trong
`tsoaAuthentication.ts`) trước khi vào controller.

## Cần làm tiếp (gợi ý thứ tự)

1. Chạy thử `POST /auth/register`, `/auth/login`, `/auth/refresh` bằng Postman/curl
   để chắc chắn flow chạy đúng trước khi build module Task/Project.
2. Viết test cho `auth.service.ts` — đặc biệt case reuse refresh token đã revoke.
3. Khi build Task/Project, tái sử dụng đúng pattern: `validators/` → `middleware/validate`
   → `controllers/` (chỉ gọi service) → `services/` (business logic + transaction nếu cần).
4. `getUserWorkloadReport()` trong `user.service.ts` là ví dụ raw SQL JOIN — dùng nó
   làm mẫu khi cần viết query JOIN phức tạp hơn cho Task (VD: task theo project kèm
   tên người assign, đếm comment mỗi task).
