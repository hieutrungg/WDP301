# Kho tri thức của Popo (AI-001)

Popo là tên của trợ lý ảo F-Cinema. Thư mục này chứa các tài liệu được đưa vào **vector database** (collection `ai_knowledge_chunks` trên MongoDB Atlas) để Popo trả lời câu hỏi về chính sách và hướng dẫn. File `README.md` này **không** được nạp.

Dữ liệu thay đổi liên tục, như phim, suất chiếu, ghế, giá, booking hay tồn kho, **không** viết vào đây. Popo đọc chúng trực tiếp từ database qua các tool gọi API, nên luôn đúng theo thời gian thực. Riêng danh mục phim được tự động nhúng thêm vào vector DB (`npm run ai:ingest`) để gợi ý phim theo mô tả. Chi tiết phim vẫn được đọc lại trực tiếp.

## Nên viết gì vào đây

Viết những thứ ít thay đổi mà khách hay hỏi: quy tắc, chính sách, các bước làm, giải thích trạng thái.

Mỗi câu trong tài liệu phải **lấy từ code hoặc quyết định đã duyệt**, ví dụ hằng số trong `server/src/modules/*/…constants.js` hoặc mục Decision A-xx trong `docs/PROJECT_CONVENTIONS.md`, rồi ghi nguồn vào `sources`. Không viết điều hệ thống chưa làm.

## Cấu trúc một file

```markdown
---
title: Hoàn tiền và huỷ vé          # tên chủ đề, hiện trong trích dẫn
audience: public                    # public: khách xem được; internal: chỉ Staff/Manager/Admin
status: draft                       # draft: chưa duyệt; approved: được nạp
sources: [server/src/modules/refund/refund.constants.js, docs/PROJECT_CONVENTIONS.md#decision-a-29]
---

# Hoàn tiền và huỷ vé

## Điều kiện hoàn tiền

### Tôi có thể huỷ vé và lấy lại tiền không?
Câu trả lời ngắn, đủ ý, tự đứng được một mình.
```

Quy tắc viết để tìm kiếm tốt:

1. **Mỗi câu hỏi là một heading `###`, câu trả lời ngay dưới.** Bộ chia (chunker) cắt theo heading. Mỗi đoạn mang theo đường dẫn heading, ví dụ "Hoàn tiền > Điều kiện hoàn tiền > Tôi có thể huỷ vé…", nên một đoạn đứng riêng vẫn hiểu được.
2. **Viết câu hỏi bằng lời của khách**: "bao lâu thì ghế hết giữ?", không viết "Seat hold TTL".
3. **Mỗi đoạn trả lời khoảng 2–8 câu.** Đoạn quá dài (hơn khoảng 1.800 ký tự) sẽ bị cắt nhỏ.
4. **Ghi rõ con số và điều kiện**: 10 phút, 45 phút, 30 phút. Không viết "một thời gian ngắn".
5. **Chỉ đường bằng link nội bộ**, ví dụ `/refunds`, `/my-tickets`.
6. **Tài liệu nội bộ** (quy trình quầy, hướng dẫn quản lý) đặt `audience: internal`. Khách hàng và khách vãng lai sẽ không bao giờ truy xuất được các đoạn này, vì vector index lọc theo `audience`.

## Quy trình cập nhật

1. Sửa hoặc thêm file `.md` và để `status: draft`.
2. Thử trên môi trường dev bằng `cd server && npm run ai:ingest -- --include-draft --faq`.
3. Owner của module liên quan đọc lại. Ví dụ hoàn tiền thì Hà (Booking) xem; payment và vé thì Cường xem.
4. Đổi thành `status: approved` rồi chạy `npm run ai:ingest`. Hoặc Admin gọi `POST /api/ai/knowledge/sync`.

Mỗi lần nạp, chỉ đoạn nào đổi nội dung mới được tính embedding lại, nên chạy lại tốn rất ít. Nếu có thay đổi thì `knowledgeVersion` tăng và cache câu trả lời cũ tự mất hiệu lực.

## Các file hiện có

Các file dưới đây do AI soạn từ code và docs ngày 2026-11-09, đang ở `status: draft` và **chờ owner duyệt** theo AGENTS.md.

| File | Chủ đề | Người nên duyệt |
| --- | --- | --- |
| `faq-tro-ly.md` | Popo là ai, làm được gì, không làm gì | Cường |
| `faq-dat-ve-giu-ghe.md` | Tìm suất, chọn ghế, giữ ghế 10 phút | Hà, Đạt |
| `faq-thanh-toan.md` | Thanh toán, hết hạn, thanh toán trễ | Cường |
| `faq-ve-dien-tu-check-in.md` | Vé điện tử, email vé, check-in | Cường |
| `faq-hoan-tien.md` | Chính sách hoàn tiền A-29 | Hà |
| `faq-bap-nuoc.md` | Bắp nước khi đặt vé và tại quầy | Hiếu, Nam |
| `faq-tai-khoan.md` | Đăng ký, đăng nhập, mật khẩu, hồ sơ | Cường |
| `faq-danh-gia-phim.md` | Điều kiện đánh giá phim | Hiếu |
