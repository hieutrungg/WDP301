---
title: Thanh toán
audience: public
status: draft
sources: [docs/PAY-001-IMPLEMENTATION.md, server/src/modules/payment/payment.constants.js, docs/Cinema_Management_System_Business_Rules.md#BR-16]
---

# Thanh toán

## Phương thức thanh toán

### Tôi có thể thanh toán bằng cách nào?
Khi mua online, bạn chọn phương thức trên trang thanh toán. Chuyển khoản ngân hàng qua mã VietQR (payOS) dùng mã QR thật: bạn quét bằng ứng dụng ngân hàng và chuyển đúng số tiền cùng nội dung chuyển khoản hiển thị. Tại quầy, nhân viên nhận tiền mặt và các phương thức quầy hỗ trợ.

### Sau khi chuyển khoản, bao lâu thì đơn được xác nhận?
Trang thanh toán tự kiểm tra trạng thái giao dịch vài giây một lần. Khi hệ thống xác minh được bạn đã chuyển đủ tiền, đơn chuyển sang "đã xác nhận" và vé điện tử được phát hành. Vui lòng giữ nguyên trang cho tới khi thấy thông báo thành công.

## Hết hạn và sự cố

### Nếu tôi thanh toán sau khi hết thời gian giữ ghế thì sao?
Đơn chỉ được xác nhận nếu thanh toán thành công trong 10 phút giữ ghế. Nếu tiền về sau khi đơn đã hết hạn, hệ thống không phát hành vé vì ghế có thể đã được bán cho người khác. Giao dịch được chuyển sang trạng thái cần xem xét để xử lý hoàn tiền. Bạn hãy liên hệ quầy hoặc quản lý rạp, mang theo thông tin chuyển khoản.

### Tôi bị trừ tiền hai lần thì sao?
Mỗi đơn chỉ được ghi nhận thanh toán thành công một lần, nên một đơn không bao giờ phát hành vé hai lần. Nếu ngân hàng ghi nhận hai khoản chuyển cho cùng một đơn, hãy liên hệ quầy hoặc quản lý rạp để được kiểm tra và hoàn khoản dư.

### Tôi có nhận được vé trước khi thanh toán không?
Không. Vé điện tử và mã vé chỉ được phát hành sau khi thanh toán được xác minh thành công.
