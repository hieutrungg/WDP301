---
title: Đánh giá phim
audience: public
status: draft
sources: [docs/REV-102-CONTRACT-REVIEW.md, docs/REV-102-EDIT-IMPLEMENTATION.md, server/src/modules/movie/movie-review.validation.js, docs/Cinema_Management_System_Business_Rules.md#BR-38]
---

# Đánh giá phim

## Điều kiện đánh giá

### Ai được đánh giá phim?
Chỉ khách hàng đã đăng nhập, có đơn đặt vé đã thanh toán thành công cho đúng phim đó, và suất chiếu đã kết thúc. Đơn đã hoàn tiền không được tính. Bạn không cần check-in vé.

### Tôi có thể đánh giá một phim nhiều lần không?
Không. Mỗi khách chỉ có một đánh giá cho mỗi phim, kể cả khi mua vé nhiều lần. Bạn có thể sửa đánh giá của mình trên trang chi tiết phim.

### Đánh giá gồm những gì?
Một số sao nguyên từ 1 đến 5 và phần nhận xét không bắt buộc, tối đa 2.000 ký tự. Đánh giá hiển thị công khai ngay sau khi gửi.

### Popo có gửi đánh giá giúp tôi không?
Có. Bạn nói với Popo tên phim, số sao và nhận xét, Popo sẽ hiện thẻ xác nhận. Đánh giá chỉ được gửi khi bạn bấm "Xác nhận". Nếu bạn chưa đủ điều kiện, hệ thống sẽ báo lý do.
