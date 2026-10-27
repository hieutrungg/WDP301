# REV-102 — Quy tắc đã duyệt và đề xuất triển khai

Ngày ghi nhận: 2026-10-27. Owner: Hiếu.

## Approval triển khai mới nhất

Hiếu đã duyệt phần bổ sung kỹ thuật (2.000 ký tự, backend eligibility, DB unique constraint, mốc Showtime endAt bao gồm cleanup) và yêu cầu “oke triển khai đi bạn ơi, cần phải thay đổi cả atlas cơ à”. API/DTO/error proposal dưới đây được dùng làm contract triển khai REV-102. Các nhãn PROPOSED/chưa implement bên dưới là bản đề xuất lịch sử trước approval này; kết quả thực tế nằm ở REV-102-IMPLEMENTATION.md. Chuẩn bị migration được phép; apply trên Atlas phát triển vẫn chưa được thực hiện và cần chỉ định/duyệt riêng.

## Quy tắc đã được Hiếu duyệt trong chat

Hiếu trả lời “mình đồng ý vs cách của bạn” sau đề xuất bằng văn bản thuần túy:

- Chỉ Customer đã đăng nhập được gửi đánh giá.
- Phải có đặt vé đã thanh toán thành công cho đúng phim và đợi suất chiếu kết thúc.
- Đặt vé đã hoàn tiền không được dùng để đủ điều kiện đánh giá.
- Mỗi Customer chỉ gửi một đánh giá cho mỗi phim, kể cả mua vé nhiều lần.
- Không yêu cầu quét vé/check-in; kiểm tra bằng Booking, Payment và Showtime hiện có.
- Chỉ gửi mới; chưa sửa hoặc xóa đánh giá.

Các quyết định trước vẫn áp dụng: rating nguyên 1–5, nội dung tùy chọn, gửi thành công công khai ngay, không có hàng chờ duyệt, không tính điểm trung bình, không phát sinh thưởng F-Points. Approval mới này cho phép dùng điều kiện Booking/Payment/Showtime thay cho dependency Ticket ở task board; không có nghĩa Ticket module đã hoàn tất. Không sửa sheet hoặc SRS trong lượt này.

## Hiện trạng kiểm tra

REV-101 đang có thay đổi chưa commit và phải được giữ nguyên. API đọc đã dùng collection `movie_reviews` với DTO allowlist. Chưa có API ghi review.

Booking hiện có `CONFIRMED`, `REFUNDED` và liên kết `customerAccountId`, `showtimeId`, `paymentId`. Payment có `PAID`, `REFUNDED`, `PARTIALLY_REFUNDED`. Showtime có `movieId`, `startAt`, `endAt`; `endAt` hiện bao gồm cleanup buffer. Không được suy luận chỉ từ `CONFIRMED` rằng khách đã thanh toán hoặc đã xem phim. Không dùng danh sách lịch sử mặc định giới hạn 50 booking để kết luận khách không đủ điều kiện; cần owning-module eligibility query.

Atlas inspection từ REV-101: collection rỗng, validator rộng, chỉ `_id_`, chưa có unique index theo customer/movie. Đây là kết quả kiểm tra trước đó, chưa phải kiểm tra lại Atlas trong lượt này.

## Đề xuất kỹ thuật — PROPOSED, chưa implement

### API kiểm tra quyền gửi

`GET /api/movies/:movieId/review-eligibility`

Áp dụng `requireAuth` + `requireRole("CUSTOMER")`, kiểm tra account ACTIVE hiện hành server-side. Không tạo permission code mới. Movie phải tồn tại và PUBLISHED theo contract Movie hiện có.

Response: `{ success: true, data: { canReview: boolean, reason: null | "ALREADY_REVIEWED" | "NO_ELIGIBLE_BOOKING" | "AUTHOR_NAME_REQUIRED" } }`.

Không trả danh sách booking, payment, thông tin riêng tư hoặc dùng client state làm bằng chứng. Nếu đã review, không hiện form gửi lại.

### API gửi

`POST /api/movies/:movieId/reviews`

Cùng auth/role/visibility guard. Body allowlist `{ rating, content? }`; rating phải là JSON number nguyên 1–5; không coerce chuỗi. Content đề xuất tối đa 2.000 ký tự, bỏ qua thì lưu chuỗi rỗng; giữ nguyên nội dung, xuống dòng và ngôn ngữ; không nhận HTML attachment/image, accountId, bookingId hay status từ client. Mức 2.000 là đề xuất cần duyệt, chưa phải business rule cũ.

201: `{ success: true, data: { id, authorDisplayName, rating, content, createdAt } }`, DTO giống phần tử REV-101. Chỉ trả thành công sau khi DB xác nhận insert; UI cập nhật/invalidate trang review đầu tiên sau response thành công. Không hiển thị review optimistic chưa lưu, không reset form khi request lỗi.

Lỗi đề xuất:

- 400 `INVALID_MOVIE_ID`, `INVALID_REVIEW_INPUT` cho ID/body sai.
- 401 theo middleware auth hiện có.
- 403 `FORBIDDEN` cho actor sai; `REVIEW_NOT_ELIGIBLE` cho không có booking đủ điều kiện.
- 404 `MOVIE_NOT_FOUND` theo Movie read contract.
- 409 `REVIEW_ALREADY_EXISTS` cho lần gửi thứ hai/concurrent duplicate; `REVIEW_AUTHOR_NAME_REQUIRED` nếu account thiếu tên hiển thị dùng bởi REV-101.
- 503 `REVIEW_WRITE_NOT_READY` nếu unique index chưa sẵn sàng hoặc chưa xác nhận được eligibility an toàn; không tự tạo index khi request tới.
- 500 generic cho lỗi không dự kiến; không lộ document hoặc driver message.

Các code mới, endpoint và reason enum trên chưa được approval kỹ thuật. Không có PATCH/DELETE, trung bình, tổng rating, pending moderation hay thưởng loyalty.

### Kiểm tra điều kiện ở backend

Đề xuất `ReviewEligibilityPort` do Booking owner cung cấp và phối hợp Payment/Showtime owner. Xác định Customer có ít nhất một Booking đúng phim, CONFIRMED, có Payment đúng liên kết/owner và PAID, Showtime đã kết thúc và không CANCELLED. Nếu có nhiều Booking, một Booking đã hoàn tiền không tự loại bỏ các Booking hợp lệ khác.

Không để Movie import trực tiếp model/repository nội bộ của Booking, Payment, Showtime. Consumer gửi `accountId`, `movieId`, server `now`; provider trả thông tin tối thiểu để khẳng định eligibility. POST luôn kiểm tra lại; kết quả GET trước đó chỉ phục vụ UI.

Trước implementation cần thống nhất cách xác định kết thúc: đề xuất dùng `endAt <= now` như display status hiện có, nghĩa là chờ cả cleanup buffer; không lấy Movie duration đang thay đổi để dựng thời gian kết thúc lịch sử. Cần review transaction/coordination với refund đang chạy để không coi một eligibility read cũ là bảo đảm atomic. Không tự sửa Refund policy, Booking lifecycle hoặc thêm trường khóa DB trong task này.

### DB đề xuất

Reuse `movie_reviews`; dữ liệu ghi chỉ gồm `_id`, `movieId`, `customerAccountId`, `rating`, `content`, `createdAt`, `updatedAt`, phù hợp allowlist reader REV-101. Không thêm review source, status hay quan hệ mới.

Đề xuất unique index tên `uniq_movie_review_customer`, keys `{ movieId: 1, customerAccountId: 1 }`, `unique: true`, để hai request đồng thời vẫn chỉ tạo một review. Kiểm tra bằng code trước insert không thay thế index.

Migration phải versioned, mặc định read-only, kiểm tra collection/validator/index thực tế và duplicate hoặc reference/rating/date không hợp lệ. Gặp legacy visibility/unknown fields, duplicate hoặc invalid data thì dừng và báo owner; không tự xóa, sửa, gộp hoặc backfill. Chỉ áp dụng index sau approval cho database đích. Không thêm index khác chỉ vì dự đoán nhu cầu.

Chưa có script hoặc DB mutation nào được thực hiện trong lượt ghi nhận này. Approval business không tự được coi là approval chạy migration trên Atlas.

## Reviewers, consumers và kế hoạch kiểm thử

Hiếu: owner Movie/Review và frontend consumer. Hà: Booking eligibility/refund interaction. Cường: Payment/auth/current-account semantics. Đạt: Showtime end-time semantics. Các shared API/error/index thay đổi cần review chéo theo AGENTS.md trước merge.

Kiểm thử dự kiến: guest/actor sai/locked account; đúng và sai phim/owner; chưa trả tiền, trả tiền thành công nhưng suất chưa kết thúc, ranh giới kết thúc; refunded/partial refund/pending refund; nhiều booking; gửi trùng/concurrent submits; rating/content validation; thiếu display name; index chưa tồn tại; successful insert đọc lại qua REV-101; retry sau mất response; giữ input khi lỗi; keyboard/screen-reader/responsive. DB test tên riêng duy nhất, cleanup kiểm tra exact database name, không chạm DB phát triển.

## Bàn giao lượt ghi nhận approval

Changed files: tài liệu này và dòng/note approval mới trong REQUIREMENTS_STATUS.md. Chưa sửa runtime UI/API/model, chưa đổi DB, chưa chạy tests runtime; chỉ chạy `git diff --check`. Không commit/push, sửa SRS hoặc cập nhật sheet Done. Business eligibility/uniqueness đã duyệt; proposal kỹ thuật, index rollout và các integration details nêu trên còn chờ duyệt.
