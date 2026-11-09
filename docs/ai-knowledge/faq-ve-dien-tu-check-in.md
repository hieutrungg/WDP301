---
title: Vé điện tử và check-in
audience: public
status: draft
sources: [server/src/modules/ticket/ticket.constants.js, docs/TICKET-001-IMPLEMENTATION.md, docs/TICKET-101-IMPLEMENTATION.md, docs/Cinema_Management_System_Business_Rules.md#BR-17, docs/Cinema_Management_System_Business_Rules.md#BR-40]
---

# Vé điện tử và check-in

## Vé điện tử

### Tôi xem vé điện tử ở đâu?
Vé nằm ở trang [Vé của tôi](/my-tickets) và trong [Lịch sử đặt vé](/booking-history). Mỗi ghế có một vé riêng với mã vé dạng TK- và 10 ký tự. Hệ thống cũng gửi email vé tới địa chỉ email của tài khoản sau khi thanh toán thành công.

### Một đơn nhiều ghế thì có mấy vé?
Mỗi ghế là một vé. Ví dụ đặt 3 ghế sẽ có 3 vé, mỗi vé một mã riêng.

### Tôi chưa thấy vé sau khi thanh toán?
Vé được phát hành ngay khi thanh toán được xác minh. Hãy mở lại [Vé của tôi](/my-tickets) hoặc trang chi tiết đơn trong [Lịch sử đặt vé](/booking-history). Hệ thống sẽ tự phát hành lại vé còn thiếu cho đơn đã thanh toán. Nếu vẫn không thấy, hãy liên hệ quầy.

## Check-in tại rạp

### Khi nào tôi có thể check-in?
Check-in mở từ 30 phút trước giờ chiếu và đóng khi suất chiếu kết thúc. Bạn đưa mã vé cho nhân viên tại rạp của suất chiếu đó. Nhân viên chỉ check-in được vé thuộc chi nhánh của mình.

### Một vé có dùng được nhiều lần không?
Không. Mỗi vé chỉ check-in được một lần; vé đã dùng sẽ bị từ chối ở lần sau. Vé đã hoàn tiền hoặc đã bị huỷ cũng không được chấp nhận vào phòng chiếu.
