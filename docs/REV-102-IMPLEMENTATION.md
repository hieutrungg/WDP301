# REV-102 — Post review

## Kết quả và approval

Ngày triển khai: 2026-10-27. Hiếu đã duyệt chính sách bằng “mình đồng ý vs cách của bạn”, sau đó duyệt bổ sung kỹ thuật và yêu cầu “oke triển khai đi bạn ơi, cần phải thay đổi cả atlas cơ à”. Code UI/API và script index đã triển khai; **chưa apply index lên Atlas phát triển**. Contract proposal/approval history: `REV-102-CONTRACT-REVIEW.md`.

Phạm vi: Customer đăng nhập, có Booking CONFIRMED thuộc mình cho đúng Movie, Payment PAID đúng Booking/owner, Showtime PUBLISHED đã đạt stored endAt (bao gồm cleanup). Booking hoặc Payment hoàn tiền không dùng để đủ điều kiện. Một lần/Customer/Movie; không cần Ticket/check-in. Rating nguyên 1–5, content tùy chọn tối đa 2.000 ký tự; công khai sau insert thành công. Không sửa/xóa, queue duyệt, F-Points, upload ảnh hoặc tính điểm tổng.

Đã đọc AGENTS, conventions, requirements, SRS UC13/BR08/38/39, thiết kế movie-exploration, SCREEN_FLOW/drawio và task REV-102/dependencies trong connected tracking; approval hiện tại supersede blockers cũ. Stitch đã xác nhận C18/C18b tồn tại nhưng full preview chưa inspect được do lỗi iframe trong lượt trước; Hiếu cho phép tự thiết kế theo theme đã đối chiếu. C18 intent được thực hiện inline trong Movie Detail, không thêm route/router layout. Bản nháp từ REV-101 được giữ, không commit/push, không sửa SRS hoặc sheet Done.

## Behavior và API

`GET /api/movies/:movieId/review-eligibility`: protected `requireAuth` + `requireRole("CUSTOMER")`. Middleware reload account/roles/status hiện hành; account locked hoặc role sai không được gửi. Không tạo permission/grant mới. Không chấp nhận query fields.

Response: `{ success: true, data: { canReview, reason } }`; reason là `null`, `ALREADY_REVIEWED`, `NO_ELIGIBLE_BOOKING`, `AUTHOR_NAME_REQUIRED`. Đây là UX hint; POST kiểm tra lại, không dùng frontend/history snapshot làm quyền. GET không đổi Payment hoặc dữ liệu khác. Có thể canReview=true trong khi index chưa rollout; POST sẽ fail closed 503.

`POST /api/movies/:movieId/reviews`: cùng guard; body chỉ `{ rating, content? }`, rating phải là JSON number nguyên 1–5, không coerce string; content giữ nguyên whitespace/ngôn ngữ, default empty khi không có. Không nhận customer/booking ID, status hoặc field ngoài allowlist từ client. Không nhận query fields.

201 trả `{ success: true, data: { id, authorDisplayName, rating, content, createdAt } }`, dùng đúng DTO public của REV-101; chỉ trả khi transaction commit. Account ID lấy từ cookie principal; author name từ Account's existing public-author contract, không fallback email/username. Không có PATCH/DELETE.

Lỗi: 400 `INVALID_MOVIE_ID`/`INVALID_REVIEW_INPUT` (GET query: `INVALID_QUERY`); 401 auth; 403 `FORBIDDEN`/`REVIEW_NOT_ELIGIBLE`; 404 `MOVIE_NOT_FOUND` cho Movie thiếu/DRAFT/ARCHIVED; 409 `REVIEW_ALREADY_EXISTS`/`REVIEW_AUTHOR_NAME_REQUIRED`; 503 `REVIEW_WRITE_NOT_READY` nếu unique index thiếu hoặc transaction infrastructure không hỗ trợ; lỗi DB khác 500 generic theo middleware hiện có. Auth và body được validate trước Movie lookup khi có nhiều lỗi. Không thay shared error middleware.

## Eligibility, module boundaries và concurrency

`booking/review-eligibility.service.js` là owner port. Duyệt các Booking CONFIRMED của đúng account bằng cursor, không giới hạn lịch sử 50 dòng, không chỉ lấy Booking gần nhất. Một Booking refunded không loại bỏ một Booking hợp lệ khác. Movie không import model/repository nội bộ của Booking/Payment/Showtime/Refund.

Owning-module ports:

- Showtime kiểm tra đúng Movie, status PUBLISHED, Date hợp lệ, startAt < endAt và endAt <= server now. Không dựng lại thời gian kết thúc từ Movie duration hiện tại; boundary bằng endAt hợp lệ.
- Refund kiểm tra có request khác REJECTED hay không. REQUESTED/PROCESSING/FAILED/REFUNDED hoặc status lạ đều chưa thể làm bằng chứng paid ổn định; candidate đó bị bỏ qua. Không thay Refund policy, không gọi provider và không tự xử lý refund.
- Payment kiểm tra đúng paymentId/bookingId/customer, PAID, không refundedAt và refundedAmount chỉ null/0. GET chỉ đọc. Trong POST transaction, Payment port thực hiện một real write lên **trường updatedAt đã có**, tăng timestamp ít nhất 1ms nếu cần; không thêm field/version/status. Refund finalization vốn ghi cùng Payment, nên settlement chen sau transaction snapshot sẽ gây write conflict/retry thay vì ghi review từ paid read cũ.

Write transaction dùng snapshot readConcern và majority writeConcern, không fallback unsafe trên standalone MongoDB. Nếu insert/eligibility thất bại, timestamp touch rollback theo transaction. Review thành công làm Payment.updatedAt thay đổi để phối hợp concurrency; không thay amount, payment status, Booking lifecycle, Seat/Inventory hay Ticket. Cần Payment-owner review điểm timestamp này trước merge. Một refund chỉ xảy ra sau review đã commit không tự động xóa/ẩn review cũ; tính năng retroactive moderation không được thêm.

Unique index thực thi atomic một review/Customer/Movie. Check trước insert phục vụ UX, không thay thế index. Concurrent submit hoặc retry sau mất response trả 409; không tạo review lần hai. Trước mỗi write kiểm tra index thật, không cache readiness vĩnh viễn và không tạo index ở app startup/request.

## Database / Atlas rollout

Hướng dẫn để Hiếu tự chạy từng bước, gồm kiểm tra/apply/xác nhận và cách đọc kết quả: [REV-102-ATLAS-SETUP.md](REV-102-ATLAS-SETUP.md). Theo yêu cầu tiếp theo của Hiếu, agent chuẩn bị script/hướng dẫn và không tự áp dụng thay đổi Atlas.

Reuse collection `movie_reviews`, không tạo model tự auto-create/auto-index. Insert chỉ gồm `_id`, `movieId`, `customerAccountId`, `rating`, `content`, `createdAt`, `updatedAt`, tương thích field allowlist REV-101. Numeric legacy validation dùng chung helper; không có nguồn review thứ hai.

Script: `server/src/migrations/20261027-movie-review-unique-index.js`. Thay đổi schema/relationship/validator: **không có**. Thay đổi index dự kiến: unique `uniq_movie_review_customer`, `{ movieId: 1, customerAccountId: 1 }`, collation simple, không partial/sparse/TTL. Equivalent full index được reuse. Không thêm index khác.

Preflight kiểm tra collection có thật/type, validator đúng cấu trúc permissive đã inspect (hoặc chưa có validator), existing index/options, canonical fields, rating chính xác, ObjectId/date/content, account có display name, Movie reference tồn tại và duplicate keys. Unknown moderation/privacy fields, orphan/invalid data, validator/index conflict hoặc duplicates đều dừng; không sửa/xóa/gộp/backfill. Apply chỉ create index sau preflight, có thể bị Mongo từ chối nếu writer ngoài app tạo duplicate trong lúc build; không có destructive fallback.

Đã chạy read-only preflight trên database **cinema_management_dev**: `checked: 0`, `alreadyReady: false`, `applied: false`. Không apply migration, không seed/post test data, không sửa/xóa dữ liệu Atlas phát triển. Một lần test kết nối đầu tiên gặp `MongooseServerSelectionError`; lần thử sau kết nối và toàn bộ Mongo tests chạy được. Không thay network/security configuration.

Sau khi Hiếu duyệt áp dụng cho đúng DB, lệnh dự kiến chạy từ server là:

```powershell
node src/migrations/20261027-movie-review-unique-index.js --database cinema_management_dev --apply
```

Lệnh trên **chưa chạy**. Apply CLI bắt buộc chỉ rõ `--database`; import script không tự connect/apply. Hiện đọc REV-101 vẫn hoạt động; POST trên development cố ý trả 503 cho đến khi index sẵn sàng. Không dùng test DB để giả rằng development đã rollout.

## Giao diện

Customer thấy “Share your experience” trước danh sách review tại Movie Detail. Guest/Staff không render posting form; backend vẫn là security boundary. Checking/error/retry/không đủ điều kiện/đã gửi/thiếu tên có state riêng, không tự coi eligible khi lỗi. Eligibility request và draft được scope theo Movie + account; đổi Movie/account sẽ hủy/ignore response cũ và bỏ draft của identity cũ.

Form dùng năm radio native với tên “1 star” đến “5 stars”, chuột/touch/phím mũi tên/Space; sao selected vàng, còn lại xám; không half-star, không mặc định 0/5 hay hiển thị điểm số bên cạnh. Fieldset/legend, textarea label/help text, focus outline, target 44px; content counter không live-announce từng phím. Rating bắt buộc, content optional, giới hạn/counter 2.000 ký tự; nội dung render escaped bằng React.

Khi gửi disable form/button và chặn double-click bằng request ref. Lỗi giữ rating/content, có role alert. Không tạo optimistic review. Chỉ 201 mới hiện “Review published”; danh sách REV-101 tải lại page 1. Duplicate/ineligible/auth/name error làm kiểm tra lại eligibility; draft local vẫn giữ khi cùng Movie/account, không tự gửi lại request thất bại. Network/server/index-not-ready không báo thành công.

## Changed files

Server bổ sung:

- `src/modules/booking/review-eligibility.service.js` — Booking owner port orchestration.
- `src/modules/payment/review-payment.service.js` — authoritative paid guard + transaction timestamp lock.
- `src/modules/refund/review-refund.service.js` — unsettled-refund guard.
- `src/modules/showtime/review-showtime.service.js` — stored end boundary.
- `src/modules/movie/movie-review-write.repository.js`, `movie-review-write.service.js` — create-only workflow over existing collection.
- `src/modules/movie/movie-review.indexes.js`, `movie-review.rating.js` — index readiness và shared exact numeric validation.
- `src/migrations/20261027-movie-review-unique-index.js` — reviewed-target migration, mặc định dry-run.
- `test/movie-review-write.test.js`, `test/movie-review-write.mongo.test.js`.

Server mở rộng files đang có ở working tree REV-101: `movie-review.controller.js`, `movie-review.validation.js`, `movie.routes.js` thêm endpoints; `movie-review.service.js` reuse exact-rating helper, giữ read behavior.

Client bổ sung `components/ReviewComposer.jsx`, `hooks/useReviewEligibility.js`, `test/movie-review-form.test.js`. Mở rộng `api/movieReviewApi.js`, `components/MovieReviews.jsx` để gửi/refresh; mở rộng `test/fixtures/movie-reviews-preview.mjs` cho QA Guest/Customer/Staff, eligibility, submit failure/success/index-not-ready — toàn bộ in-memory, không import vào production routes.

Docs: `REV-102-CONTRACT-REVIEW.md`, `REQUIREMENTS_STATUS.md`, `3-detailed-design/movie-exploration.md`, amendment trong `REV-101-IMPLEMENTATION.md`, và tài liệu này. Không sửa package/lockfiles, router/layout frontend, app.js, SRS, lifecycle enum, Refund/Booking/Payment runtime workflows có sẵn. Working tree REV-101 và thay đổi khác được giữ nguyên.

## Tests và kết quả

- Server review read+write: `node --test --test-concurrency=1 test/movie-review.test.js test/movie-review.mongo.test.js test/movie-review-write.test.js test/movie-review-write.mongo.test.js` — **26 pass, 0 fail, 0 skip**.
- Sau khi bật explicit snapshot/majority transaction, chạy lại `test/movie-review-write.mongo.test.js` — **9 pass, 0 fail, 0 skip**; chạy lại write unit — **6 pass**. Includes auth/locked role, sai owner/movie/payment link, unpaid/future/refunded/partial refund/pending refund, optional/invalid content/rating, exact end boundary, missing name, index-not-ready, read-after-create, duplicate/concurrent request và refund-settlement race.
- Migration thật chỉ apply trong unique `rev102_test_<24 hex>` DB; test malformed/hidden/orphan/duplicates fail preflight mà giữ nguyên records, dry-run không tạo index, apply idempotent. Guard exact DB name/prefix trước cleanup; finally đóng kết nối. REV-101 Mongo tests dùng unique DB riêng tương tự.
- Frontend `node --test --test-concurrency=1 test/movie-review-form.test.js test/movie-reviews.test.js` — **7 pass**, native radio semantics, disabled/busy, input retained, author/role gating, five read-only stars, error/empty/loading, escaped text/date and pagination.
- Server full `npm run lint` — pass. ESLint tất cả production frontend files thay đổi — pass. Client build — pass với cảnh báo bundle lớn (~1.13MB main JS minified).
- Full client lint còn lỗi có sẵn `ManagerShowtimesPage.jsx:115` (`react-hooks/immutability`) và warning line 813; không sửa module ngoài phạm vi. Full client test suite không chạy lại trong lượt REV-102; lỗi Staff test cũ “Concession Menu” so với “Sell Concessions” đã ghi ở REV-101 vẫn là limitation chưa xử lý.
- Browser QA fixture: keyboard Space/ArrowRight chọn sao; gửi lỗi giữ nguyên cả whitespace/newline; retry thành công rồi review xuất hiện đầu list; guest không thấy form; ineligible/already-reviewed đúng thông báo. Mobile 320px không tràn ngang, mỗi star radio target 44×44px. Index-not-ready giữ draft và không báo success. Chưa chạy screen-reader thực tế hoặc toàn bộ ma trận thiết bị.
- `git diff --check` — pass.

## Integration và phần còn chờ

API/UI owner và consumer: Hiếu. Review ports: Hà (Booking + refund interaction), Cường (Payment/auth + updatedAt concurrency touch), Đạt (Showtime endAt). Shared Movie router/error contract và unique index cần cross-review trước merge. Không có quyết định business hay API nào còn chờ để code scope này; **development rollout còn chờ duyệt apply unique index vào cinema_management_dev**. Chưa commit/push hoặc đánh dấu Done trong sheet.
