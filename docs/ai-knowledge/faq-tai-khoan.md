---
title: Tài khoản
audience: public
status: draft
sources: [server/src/modules/auth/auth.service.js, server/src/modules/auth/auth.validation.js, server/src/modules/account/account.validation.js]
---

# Tài khoản

## Đăng ký và đăng nhập

### Đăng ký tài khoản như thế nào?
Bạn vào trang [Đăng ký](/register), nhập họ tên, email, số điện thoại, tên đăng nhập và mật khẩu. Hệ thống gửi mã xác minh tới email. Mã có hiệu lực 5 phút, và bạn có thể yêu cầu gửi lại mã sau 60 giây. Bạn cũng có thể đăng nhập bằng tài khoản Google.

### Mật khẩu cần đáp ứng yêu cầu gì?
Mật khẩu dài từ 8 đến 128 ký tự, có ít nhất một chữ thường, một chữ hoa, một chữ số và một ký tự đặc biệt.

### Phiên đăng nhập kéo dài bao lâu?
Phiên đăng nhập kéo dài 8 giờ. Nếu chọn "Ghi nhớ đăng nhập" thì phiên kéo dài 7 ngày.

### Tôi quên mật khẩu thì làm sao?
Bạn vào trang [Quên mật khẩu](/forgot-password) và nhập email tài khoản. Hệ thống gửi mã OTP tới email đó, mã có hiệu lực 5 phút. Sau khi nhập đúng mã, bạn có 10 phút để đặt mật khẩu mới, và mỗi mã chỉ dùng được một lần. Tài khoản chưa xác minh email phải xác minh trước. Không chia sẻ mã OTP với bất kỳ ai, kể cả trợ lý ảo Popo.

### Vì sao tài khoản của tôi không đăng nhập được?
Tài khoản có thể chưa xác minh email (hãy nhập mã xác minh đã gửi, hoặc yêu cầu gửi lại), hoặc đã bị quản trị viên khoá. Tài khoản bị khoá không đăng nhập được cho tới khi quản trị viên mở lại. Hãy liên hệ rạp nếu bạn cần hỗ trợ.

## Hồ sơ

### Tôi đổi họ tên hoặc số điện thoại ở đâu?
Bạn vào [Hồ sơ](/profile) để sửa. Trợ lý ảo Popo cũng có thể đề xuất thay đổi giúp bạn, và thay đổi chỉ được lưu khi bạn bấm "Xác nhận". Muốn đổi mật khẩu, bạn vào [Đổi mật khẩu](/profile/change-password).

### Tôi có thể thêm ngày sinh, giới tính, địa chỉ hay sở thích vào hồ sơ không?
Hiện tại chưa được. Hồ sơ F-Cinema chỉ cho đổi họ tên và số điện thoại; email gắn với tài khoản và không đổi được ở trang Hồ sơ. Ngày sinh, giới tính, địa chỉ và sở thích chưa lưu được ở đâu trên F-Cinema. Nếu bạn muốn đổi họ tên hoặc số điện thoại, Popo có thể chuẩn bị giúp để bạn bấm "Xác nhận".

### Ai xem được thông tin của tôi?
Bạn chỉ xem được dữ liệu của chính mình: hồ sơ, lịch sử đặt vé, vé và yêu cầu hoàn tiền. Popo cũng chỉ truy cập được đúng những dữ liệu đó của bạn.
