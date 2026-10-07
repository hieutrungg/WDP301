# F-Cinema AI Agent Rules

## Trước khi sửa code

1. Đọc `AGENTS.md`.
2. Đọc `docs/PROJECT_CONVENTIONS.md`.
3. Đọc `docs/REQUIREMENTS_STATUS.md`.
4. Đọc section SRS liên quan.
5. Đọc section liên quan trong `docs/SCREEN_FLOW.md` và `docs/screen-flow.drawio` khi luồng UI bị ảnh hưởng.
6. Đọc màn hình liên quan trong Stitch project `12758682447811659045` nếu task có UI.
7. Đọc task, contract và decision liên quan trong `F-Cinema — Team Development Plan`.
8. Inspect module hiện tại, dependency, test và `git status` trước khi sửa.

## Mandatory rules

- Không invent business requirement hoặc ngầm coi đề xuất là quyết định đã duyệt.
- Không tự đổi API contract, shared enum, error code, ID hoặc database relationship.
- Không implement requirement có status `BLOCKED_BY_DECISION`.
- Không bypass backend RBAC. Frontend guard chỉ hỗ trợ UX/navigation.
- Không duplicate business logic đã có primary owner. Online booking và counter booking phải reuse cùng Booking rule.
- Không sửa unrelated working module hoặc overwrite uncommitted team work.
- Không sửa SRS nếu task không yêu cầu rõ ràng.
- Không sửa governance file chỉ để code hiện tại trở nên “compliant”. Conflict phải được ghi nhận và review.
- Không thêm dependency lớn nếu không có justification và owner approval.
- Không report test pass nếu chưa chạy test tương ứng.
- Không lưu trạng thái booked toàn cục trên physical `Seat`; availability luôn thuộc `Showtime + Seat`.
- Protected backend route phải default-deny và dùng `requireAuth`/`requirePermission` phù hợp.
- Không tạo ticket/QR trước confirmed successful booking/payment flow.
- Không tự xóa `directPermissionIds`; policy này đang chờ owner review.

## Khi requirement chưa rõ

```text
Dừng phần implementation bị ảnh hưởng.
Ghi blocker vào docs/REQUIREMENTS_STATUS.md hoặc task board.
Tiếp tục các phần độc lập đã APPROVED_READY.
```

## Shared files cần review chéo

- `server/src/app.js`
- frontend router và role layouts
- `package.json` / lockfiles
- shared constants, enums và error middleware
- DB validators, indexes và seed
- `docs/PROJECT_CONVENTIONS.md`
- `docs/REQUIREMENTS_STATUS.md`

## Report bắt buộc sau mỗi task

- changed files;
- implemented behavior;
- API changes;
- DB changes;
- tests run và kết quả thật;
- blockers;
- integration notes.

Nếu task thay đổi shared contract, phải nêu rõ owner, consumer, migration impact và approval status trước khi merge.
