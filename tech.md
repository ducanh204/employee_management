# SPEC HỆ THỐNG QUẢN LÝ CÔNG VIỆC (TASK MANAGEMENT SYSTEM)

> Tài liệu này được suy ra trực tiếp từ Prisma schema hiện tại + các quyết định nghiệp vụ đã chốt (permission model, workflow duyệt task...). Dùng làm base để viết tsoa controllers/services.

---

## 1. Tổng quan

- **Loại hệ thống**: Backend API (Node/Express qua tsoa) quản lý công việc nội bộ theo phòng ban/dự án.
- **Stack**: tsoa + Express + Prisma (MySQL) + zod (validate) + JWT (access + refresh) + swagger-ui-express.
- **Đối tượng dùng**: 3 role — `ADMIN`, `MANAGER`, `EMPLOYEE`.
- **Đơn vị tổ chức**: Department → Project → Task. User thuộc 1 Department, có thể tham gia nhiều Project qua `ProjectMember`.

---

## 2. Vai trò & phân quyền

| Hành động | ADMIN | MANAGER | EMPLOYEE |
|---|---|---|---|
| CRUD User (toàn hệ thống) | ✅ | ❌ | ❌ |
| Create/Get/Delete User trong phòng ban mình | — | ✅ (không Update) | ❌ |
| Update chính mình (field giới hạn) | ✅ | ✅ | ✅ |
| Get thông tin bản thân (`/users/me`) | ✅ | ✅ | ✅ |
| Tạo/sửa Task (difficulty, priority, effort, process) | ✅ | tùy quy định | ❌ |
| Duyệt/từ chối Task (approvalStatus) | — | ✅ (leader duyệt task admin tạo) | ❌ |
| Assign Task cho member | ✅ | ✅ (trong team/project quản lý) | ❌ |
| Report progress / report stuck | ✅ | ✅ | ✅ (task được giao) |
| Quản lý Department | ✅ | ❌ | ❌ |
| Quản lý Project (CRUD) | ✅ | ✅ (project mình quản lý) | ❌ |

> Lưu ý: MANAGER chỉ thao tác trong phạm vi `departmentId` của chính mình — mọi service method liên quan tới MANAGER phải filter theo `departmentId`.

---

## 3. Mô hình dữ liệu

### 3.1 Department
- Đơn vị tổ chức gốc. 1 Department có nhiều User và Project.
- Không có phân cấp (không có `parentId`) — cấu trúc phẳng.

### 3.2 User / RefreshToken
- `role`: ADMIN | MANAGER | EMPLOYEE, mặc định EMPLOYEE.
- `departmentId` nullable → cho phép user chưa gán phòng ban (onboarding).
- `RefreshToken`: chỉ lưu `tokenHash` (SHA-256), không lưu token gốc. `revokedAt = null` nghĩa là còn hiệu lực.
  - Dùng để implement **rotation**: mỗi lần refresh → revoke token cũ, issue token mới.
  - Dùng để implement **reuse detection**: nếu 1 token đã bị revoke nhưng vẫn được gửi lên → coi là bị đánh cắp, revoke toàn bộ token của user đó.

### 3.3 Project / ProjectMember
- Project thuộc 1 Department, có 1 `manager` (User).
- `status`: PLANNING → ACTIVE → (ON_HOLD) → COMPLETED | CANCELLED.
- `ProjectMember` là bảng join nhiều-nhiều User↔Project (unique theo cặp projectId+userId).

### 3.4 Task / TaskDependency
- Task **có thể** không thuộc Project nào (`projectId` nullable) — hỗ trợ task lẻ, không nhất thiết gắn dự án.
- 3 thuộc tính do người tạo set: `difficulty`, `priority`, `effort` (số giờ ước tính, bắt buộc), `process` (mô tả quy trình/free text).
- `actualHours`: số giờ thực tế, cập nhật dần hoặc khi hoàn thành.
- Hai state độc lập:
  - `approvalStatus`: PENDING → APPROVED | REJECTED — MANAGER (leader) duyệt task do ADMIN tạo trước khi task được active.
  - `progressStatus`: NOT_STARTED → IN_PROGRESS → STUCK | DONE — EMPLOYEE tự cập nhật.
- `TaskDependency`: task A `dependsOnTask` B → A không được chuyển sang IN_PROGRESS cho tới khi B ở DONE. Cascade delete khi 1 trong 2 task bị xoá.

### 3.5 Tag / TaskTag
- Gắn nhãn tự do cho Task (nhiều-nhiều), có màu để hiển thị UI.

### 3.6 ProgressReport
- Lịch sử báo cáo tiến độ — mỗi lần EMPLOYEE cập nhật progress tạo 1 record (không ghi đè), giữ `percent` + `note` + `status` tại thời điểm báo cáo.
- Đây là **audit trail của tiến độ**, khác với `Task.progressStatus` (chỉ là trạng thái hiện tại).

### 3.7 Comment / Attachment
- Thảo luận và file đính kèm theo Task. Không có edit-history riêng, chỉ có `updatedAt` cho Comment.

### 3.8 Notification
- `relatedEntityType` + `relatedEntityId`: generic polymorphic reference (vd `"Task"` + `taskId`) để FE biết điều hướng khi click.
- Loại: TASK_ASSIGNED, TASK_APPROVED, TASK_REJECTED, TASK_DUE_SOON, COMMENT_ADDED, GENERAL.

### 3.9 AuditLog
- Ghi log hành động thay đổi dữ liệu quan trọng (ai, làm gì, trên entity nào, metadata JSON tuỳ ý).
- `userId` nullable — cho phép log hành động hệ thống (cron job, migration...).

---

## 4. Luồng nghiệp vụ chính

### 4.1 Authentication
1. Login → verify password (bcrypt) → issue access token (JWT_ACCESS_SECRET, short TTL) + refresh token (JWT_REFRESH_SECRET, long TTL) → lưu hash refresh token vào `RefreshToken`.
2. Refresh → verify refresh token hợp lệ & chưa revoke → revoke token cũ → issue cặp token mới (rotation).
3. Logout → revoke refresh token hiện tại (set `revokedAt`).
4. Phát hiện reuse token đã revoke → revoke toàn bộ refresh token của user (giả định bị lộ token).

### 4.2 Vòng đời Task
```
ADMIN tạo Task (approvalStatus=PENDING, progressStatus=NOT_STARTED)
        │
        ▼
MANAGER duyệt ──► APPROVED ──► ADMIN/MANAGER assign assignedToId
        │
        └──► REJECTED (kết thúc, có thể sửa lại và resubmit — cần quyết định thêm)
        
EMPLOYEE được assign:
        NOT_STARTED ──► IN_PROGRESS (chỉ khi mọi TaskDependency đã DONE)
                              │
                              ├──► STUCK (kèm ProgressReport ghi lý do)
                              └──► DONE ──► set completedAt, tính actualHours
```

### 4.3 Progress Reporting
- Mỗi lần EMPLOYEE gọi API report progress → tạo `ProgressReport` mới + đồng bộ `Task.progressStatus`.
- Nếu status = STUCK → nên tự động tạo Notification cho `createdBy`/`assignedTo` liên quan (không có sẵn NotificationType riêng cho "stuck", có thể dùng GENERAL hoặc bổ sung enum).

### 4.4 Due date & nhắc hạn
- Cron/job định kỳ quét `Task.dueDate` sắp tới (dùng index `[dueDate]` đã có) → tạo Notification loại TASK_DUE_SOON cho `assignedTo`.

### 4.5 Comment
- Tạo Comment → tạo Notification COMMENT_ADDED cho các bên liên quan (createdBy, assignedTo, trừ chính author).

---

## 5. Danh sách API endpoints đề xuất

### Auth
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Users
- `GET /users/me`
- `PUT /users/me` (self update, field giới hạn)
- `GET /users` (ADMIN: all; MANAGER: trong department)
- `GET /users/{id}`
- `POST /users` (tạo user — ADMIN, hoặc MANAGER tạo employee trong phòng ban mình)
- `DELETE /users/{id}` (ADMIN toàn hệ thống; MANAGER chỉ employee trong phòng ban mình)

### Departments
- `GET /departments`
- `POST /departments` (ADMIN)
- `PUT /departments/{id}` (ADMIN)
- `DELETE /departments/{id}` (ADMIN)

### Projects
- `GET /projects`
- `GET /projects/{id}`
- `POST /projects` (ADMIN/MANAGER)
- `PUT /projects/{id}` (manager của project hoặc ADMIN)
- `DELETE /projects/{id}`
- `POST /projects/{id}/members` (add member)
- `DELETE /projects/{id}/members/{userId}` (remove member)

### Tasks
- `GET /tasks` (filter theo project, assignedTo, approvalStatus, progressStatus)
- `GET /tasks/{id}`
- `POST /tasks` (ADMIN)
- `PUT /tasks/{id}` (ADMIN, hoặc assignedTo cho các field giới hạn như progressStatus)
- `DELETE /tasks/{id}`
- `POST /tasks/{id}/approve` (MANAGER)
- `POST /tasks/{id}/reject` (MANAGER)
- `POST /tasks/{id}/assign` (gán assignedToId)
- `POST /tasks/{id}/dependencies` (thêm TaskDependency)
- `DELETE /tasks/{id}/dependencies/{dependsOnTaskId}`

### Progress Reports
- `POST /tasks/{id}/progress-reports` (EMPLOYEE báo cáo)
- `GET /tasks/{id}/progress-reports` (lịch sử)

### Comments & Attachments
- `GET /tasks/{id}/comments`
- `POST /tasks/{id}/comments`
- `PUT /comments/{id}` (author only)
- `DELETE /comments/{id}`
- `POST /tasks/{id}/attachments`
- `DELETE /attachments/{id}`

### Tags
- `GET /tags`
- `POST /tags` (ADMIN)
- `POST /tasks/{id}/tags/{tagId}`
- `DELETE /tasks/{id}/tags/{tagId}`

### Notifications
- `GET /notifications/me`
- `PUT /notifications/{id}/read`
- `PUT /notifications/read-all`

### Audit Logs
- `GET /audit-logs` (ADMIN only, filter theo entityType/entityId)

---

## 6. Quy tắc nghiệp vụ cần enforce ở service layer

1. **Task.effort** phải > 0 (validate ở zod schema, không có constraint DB).
2. Task chỉ chuyển `IN_PROGRESS` khi **tất cả** `dependsOn` đang ở `DONE`.
3. `assignedToId` chỉ được set sau khi `approvalStatus = APPROVED`.
4. MANAGER chỉ approve/reject task thuộc project trong department của mình.
5. MANAGER chỉ CRUD User có `role = EMPLOYEE` và cùng `departmentId`.
6. EMPLOYEE chỉ được sửa `progressStatus`/tạo `ProgressReport` cho task mà `assignedToId = mình`.
7. Refresh token: luôn hash trước khi lưu, không bao giờ query bằng token gốc trong log/audit.
8. Xoá User không nên cascade xoá Task đã tạo/được assign (giữ lịch sử) — cân nhắc `onDelete: Restrict` hoặc soft-delete (`isActive=false`) thay vì xoá cứng cho User.

---

## 7. Ngoài phạm vi schema hiện tại (cần quyết định thêm)

- Task bị REJECTED có cho phép sửa & resubmit không, hay phải tạo task mới?
- Cấu trúc "team" (leader/member) được nhắc tới trong nghiệp vụ nhưng chưa có model riêng — hiện đang dùng Department + Project để mô phỏng, cần chốt có tách bảng `Team` riêng hay không.
- NotificationType chưa có loại riêng cho "task stuck" — nếu cần phân biệt UI, nên thêm `TASK_STUCK` vào enum.