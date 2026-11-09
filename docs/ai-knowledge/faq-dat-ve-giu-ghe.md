---
title: Đặt vé và giữ ghế
audience: public
status: draft
sources: [server/src/modules/booking/seat-hold.constants.js, docs/3-detailed-design/seat-hold.md, docs/Cinema_Management_System_Business_Rules.md#BR-14, docs/Cinema_Management_System_Business_Rules.md#BR-18]
---

# Đặt vé và giữ ghế

## Các bước đặt vé

### Đặt vé xem phim online như thế nào?
Bạn chọn phim tại [Phim](/movies) hoặc [Lịch chiếu](/showtimes), chọn rạp và suất chiếu, rồi chọn ghế trên sơ đồ phòng chiếu. Sau khi xác nhận ghế, bạn có thể thêm bắp nước hoặc bỏ qua, kiểm tra lại đơn và thanh toán. Vé điện tử được phát hành ngay sau khi thanh toán thành công.

### Tôi có cần tài khoản để đặt vé không?
Có. Khách chưa đăng nhập vẫn xem được phim, lịch chiếu và bắp nước, nhưng phải [đăng nhập](/login) hoặc [đăng ký](/register) mới chọn được ghế và mua vé.

### Tôi có thể đặt vé cho suất chiếu đã bắt đầu không?
Không. Chỉ đặt được vé cho các suất chiếu chưa bắt đầu.

## Giữ ghế

### Ghế được giữ cho tôi trong bao lâu?
Khi bạn xác nhận ghế, hệ thống giữ ghế cho bạn trong 10 phút. Trong thời gian này người khác không chọn được các ghế đó. Nếu bạn không thanh toán xong trong 10 phút, ghế tự động được nhả và đơn hết hạn. Thời gian giữ ghế không được gia hạn, kể cả khi bạn thêm bắp nước.

### Vì sao tôi không chọn được một số ghế?
Ghế đã bán hoặc đang được khách khác giữ sẽ không chọn được. Mỗi ghế của một suất chiếu chỉ có một người giữ tại một thời điểm và chỉ bán cho một khách. Nếu một trong các ghế bạn chọn vừa bị người khác giữ, cả lần giữ sẽ không thành công. Khi đó bạn chọn lại ghế khác.

### Nếu tôi đóng trang khi đang thanh toán thì sao?
Ghế vẫn được giữ đến hết 10 phút tính từ lúc bạn xác nhận ghế. Bạn có thể mở lại trang chọn ghế của suất đó để tiếp tục thanh toán. Hết 10 phút mà chưa thanh toán thì ghế được nhả, bạn cần chọn lại.

### Giá vé được tính thế nào?
Giá vé phụ thuộc vào suất chiếu và loại ghế, ví dụ ghế thường hay ghế VIP. Giá từng ghế hiện trên sơ đồ ghế và trong tóm tắt đơn trước khi thanh toán. Tổng tiền gồm tiền vé, trừ giảm giá nếu có, cộng tiền bắp nước. Mọi số tiền tính bằng đồng (VND).
