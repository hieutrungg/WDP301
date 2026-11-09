---
title: Hoàn tiền và huỷ vé
audience: public
status: draft
sources: [server/src/modules/refund/refund.constants.js, docs/PROJECT_CONVENTIONS.md#decision-a-29, docs/REF-101-105-IMPLEMENTATION.md]
---

# Hoàn tiền và huỷ vé

## Điều kiện hoàn tiền

### Tôi có thể huỷ vé và lấy lại tiền không?
Có, nếu đơn đã thanh toán thành công và bạn gửi yêu cầu muộn nhất 45 phút trước giờ chiếu. Sau mốc 45 phút trước giờ chiếu, hệ thống không nhận yêu cầu hoàn tiền nữa. Vé đã check-in không được hoàn tiền.

### Tôi gửi yêu cầu hoàn tiền ở đâu?
Bạn vào trang [Hoàn tiền](/refunds), chọn đơn và gửi yêu cầu. Trợ lý ảo Popo không gửi yêu cầu thay bạn nhưng có thể cho bạn xem trạng thái các yêu cầu đã gửi. Mỗi đơn chỉ có một yêu cầu hoàn tiền.

### Tôi được hoàn bao nhiêu tiền?
Bạn được hoàn tiền vé của đơn, cộng tiền bắp nước nếu phần bắp nước đó chưa được nhận tại quầy. Bắp nước đã nhận thì không hoàn. Không có phí hoàn tiền và không giới hạn số lần hoàn trong tháng.

## Xử lý yêu cầu

### Ai duyệt yêu cầu hoàn tiền và mất bao lâu?
Quản lý rạp duyệt hoặc từ chối từng yêu cầu; nhân viên quầy không duyệt được. Bạn theo dõi trạng thái tại [Hoàn tiền](/refunds): đã gửi (REQUESTED), đang xử lý (PROCESSING), đã hoàn (REFUNDED), bị từ chối (REJECTED) hoặc lỗi (FAILED). Yêu cầu bị lỗi sẽ được quản lý xử lý lại.

### Tiền hoàn về đâu?
Đơn thanh toán online được hoàn qua phương thức thanh toán ban đầu. Đơn trả bằng tiền mặt tại quầy được hoàn tiền mặt trực tiếp tại rạp. Ghế, vé và bắp nước của đơn chỉ bị huỷ sau khi hoàn tiền thành công. Sau khi hoàn, vé không còn dùng để vào rạp.

### Nếu rạp huỷ suất chiếu thì sao?
Khi một suất chiếu bị huỷ, rạp sẽ xử lý hoàn tiền cho các đơn liên quan. Bạn theo dõi tại [Hoàn tiền](/refunds) hoặc liên hệ quầy để được hỗ trợ.
