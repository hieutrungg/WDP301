# REV-102 — Sửa đánh giá của chính Customer

Ngày 2026-10-27, Hiếu yêu cầu: “làm cho tôi phần edit đánh giá, cho phép người ta sửa đánh giá”. Đây là mở rộng scope create-only trước đó, không sửa SRS hoặc tự coi thiết kế Stitch là requirement đã duyệt.

## Hành vi

- Customer đăng nhập mở Movie Detail thấy **Your review**, kể cả đánh giá cũ không nằm trên trang danh sách đầu tiên. **Edit review** nạp sẵn số sao/nội dung; **Save changes** lưu; **Cancel** bỏ bản nháp và trả focus về nút sửa.
- Chỉ sửa review của tài khoản đang đăng nhập. Không nhận accountId/reviewId/status/ngày đăng từ client. Backend kiểm tra account ACTIVE và CUSTOMER bằng middleware hiện hành.
- Giữ quy tắc REV-102: phim PUBLISHED, rating là JSON number nguyên 1–5, content tùy chọn tối đa 2.000 ký tự; giữ nguyên Unicode/whitespace, HTML được React hiển thị dạng text. Nếu muốn bỏ nội dung, gửi chuỗi rỗng; bỏ content cũng thành chuỗi rỗng như POST.
- Edit vẫn kiểm tra lại Booking/Payment/Showtime/Refund eligibility hiện có bên trong transaction, dùng cùng locking port với submit. Vé hoàn tiền hoặc refund đang xử lý không đủ điều kiện. Không đổi policy để bỏ eligibility khi sửa.
- Chỉ cập nhật rating/content/updatedAt; giữ _id, customerAccountId, movieId, createdAt và thứ tự danh sách theo ngày đăng. Mỗi Customer/Movie vẫn một review. Hai lần sửa đồng thời được serialize bởi transaction; lần lưu thành công sau cùng được giữ, chưa thêm version/conflict UX.
- Chỉ báo thành công sau DB commit; refresh danh sách review. Lỗi lưu giữ nguyên bản nháp, không báo thành công giả. Chuyển phim/tài khoản hủy request phía client và bỏ state cũ (không có nghĩa hủy được transaction server đã commit).
- Không tự sửa dữ liệu legacy hoặc suy diễn trạng thái công khai nếu có trường lạ. Không thêm delete, reward, moderation, giới hạn số lần sửa hoặc hạn thời gian mới.

## API và integration contract

Owner/provider: Hiếu (Movie/Review). Consumer: frontend Movie Detail/ReviewComposer của Hiếu. Cross-review trước merge: Cường (current-account/auth), Hà (Booking/refund locking), Đạt (Showtime semantics); giữ nguyên các port đang dùng.

| Endpoint mới | Input | Success |
| --- | --- | --- |
| `GET /api/movies/:movieId/reviews/mine` | Không query/body; session CUSTOMER | 200 `{ success: true, data: reviewOrNull }` |
| `PATCH /api/movies/:movieId/reviews/mine` | `{ rating, content? }`, không query | 200 `{ success: true, data: review }` |

Review DTO giữ đúng allowlist REV-101: `id, authorDisplayName, rating, content, createdAt`. Không đổi public list, POST hoặc review-eligibility response, không thêm customerAccountId vào public API. `mine` được resolve bằng req.auth.accountId.

Error mới: 404 `REVIEW_NOT_FOUND` khi Customer chưa có review của phim. Reuse 400 `INVALID_MOVIE_ID`/`INVALID_REVIEW_INPUT`/`INVALID_QUERY`, 401/403 auth, 404 `MOVIE_NOT_FOUND`, 403 `REVIEW_NOT_ELIGIBLE`, 409 `REVIEW_AUTHOR_NAME_REQUIRED`, 503 `REVIEW_WRITE_NOT_READY`. Legacy không an toàn cũng trả 503; không trả raw document/driver error.

Approval: chức năng edit được user trực tiếp yêu cầu; implementation giữ policy đã duyệt. Endpoint/error cụ thể và shared Movie router vẫn cần cross-owner review trước merge; chưa có human reviewer sign-off trong lượt này.

## DB

Reuse `movie_reviews` và trường `updatedAt` sẵn có. Không thay schema, validator, index, enum hoặc relationship; **không cần migration mới**. Runtime write vẫn fail closed nếu thiếu unique index REV-102 hoặc transaction infrastructure. Không kiểm tra/apply DDL/seed/backfill trên database phát triển trong lượt edit. Migration index cũ vẫn là prerequisite của cả create và edit.

## Changed files

- Backend: `server/src/modules/movie/movie-review-write.repository.js`, `movie-review-write.service.js`, `movie-review.controller.js`, `movie.routes.js`.
- Frontend: `client/src/features/movie-showtime/api/movieReviewApi.js`, `hooks/useReviewEligibility.js`, `components/ReviewComposer.jsx`.
- Tests/QA: `server/test/movie-review-write.test.js`, `server/test/movie-review-write.mongo.test.js`, `client/test/movie-review-form.test.js`, `client/test/fixtures/movie-reviews-preview.mjs`.
- Tài liệu: tài liệu này và note approval mới trong `docs/REQUIREMENTS_STATUS.md`.

## Verification

- Backend: `node --test --test-concurrency=1 test/movie-review-write.test.js test/movie-review.test.js test/movie-review-write.mongo.test.js test/movie-review.mongo.test.js` — 29/29 pass, không skip. Sau khi thêm regression cho refund đua với edit, chạy lại `node --test --test-concurrency=1 test/movie-review-write.mongo.test.js` — 11/11 pass, không skip. Hai lượt cộng lại bao phủ 30 test/subtest riêng biệt; lượt sau có chạy lại các case Mongo trước.
- Mongo/HTTP kiểm tra Guest/Staff/locked account, other owner/movie, private/invalid movie, spoofed fields, rating/content sai, payment refunded, bất biến identity/createdAt, một review duy nhất, DTO allowlist và public readback. Race test thực sự thay Payment sau transaction snapshot: edit bị từ chối và document cũ không đổi. Dùng database `rev102_test_<random>` riêng, exact-name-guarded cleanup; không ghi database phát triển.
- Frontend: `node --test test/movie-review-form.test.js test/movie-reviews.test.js` — 8/8 pass. Test runner có warning HMR port 24678 đã dùng; không có test fail.
- `npm run lint` backend — pass (chạy lại sau test mới). ESLint ba production frontend files thay đổi — pass. `npm run build` client — pass, warning bundle lớn ~1.33MB minified. Không claim full client lint/test ngoài review suites.
- Browser QA qua fixture in-memory, không Mongo: mở review cũ, form prefill, keyboard Space chọn sao, Cancel bỏ draft, lỗi PATCH giữ số sao/nội dung, retry thành công, public list đổi nội dung và giữ ngày đăng; Guest/Staff không có nút sửa; POST thành công chuyển sang own-review có nút Edit ngay. Mobile viewport yêu cầu 390px, CSS clientWidth/scrollWidth thực tế đều 375px, không tràn ngang. Chưa chạy screen-reader thực tế.
- `git diff --check` — pass. Không commit/push, deployment, thay SRS hoặc cập nhật sheet Done.

Sources đã đọc: AGENTS/conventions/status; SRS G5 UC12/13 và business-rule review; SCREEN_FLOW.md và screen-flow.drawio C18; Stitch C18 trong project 12758682447811659045; tracking Iter3 REV-101/102; local REV-102 contract/implementation. Tracking vẫn giữ blocker lịch sử, được supersede bởi approval đã ghi trong repo và yêu cầu mới của user. Registry riêng tên “F-Cinema — Team Development Plan” chưa được xác minh trong nguồn hiện truy cập; không coi nhãn Done trên tracking là approval contract mới.
