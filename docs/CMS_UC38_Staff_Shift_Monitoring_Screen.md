# Màn hình Staff Shift Monitoring (CMS_UC38)

Tài liệu mô tả màn hình **Giám sát ca làm việc của nhân viên** theo đúng trạng thái hiện tại của code (cập nhật 2026-10-21), và trả lời câu hỏi: nhân viên có cần một màn hình lịch làm việc riêng hay không.

> **Trạng thái:** phạm vi tối thiểu của UC38 được owner chỉ thị làm ngày 2026-10-20 (xem `docs/REQUIREMENTS_STATUS.md`). Những điểm UC38 không quy định được đánh dấu **ĐỀ XUẤT (PROPOSED)**: đây là cách triển khai đề xuất, **chưa phải business rule đã được duyệt**.

---

## 1. Màn hình dùng để làm gì

Màn hình giúp **Manager** của rạp:

- lập lịch ca làm việc cho nhân viên (ai làm, ở vị trí nào, từ giờ nào đến giờ nào);
- theo dõi các ca của một chi nhánh theo thời gian thực: ca nào đang diễn ra, ca nào sắp tới, ca nào đã xong và đang chờ duyệt;
- tra cứu lịch sử ca theo ngày, theo tên nhân viên, theo trạng thái, theo vị trí làm việc;
- **duyệt** ca đã kết thúc (ghi nhận người duyệt và thời điểm duyệt) hoặc **hủy** ca chưa bắt đầu.

Màn hình **không** ghi nhận chấm công (giờ vào, giờ ra, nghỉ giải lao). Xem mục 7.

| Thông tin | Giá trị |
| --- | --- |
| Đường dẫn | `/manager/staff-shifts` (menu **Staff Shifts** trong khu vực Manager) |
| Người dùng | Manager |
| Quyền cần có | `shift.view` để xem; `shift.manage` để phân ca, hủy ca, duyệt ca; cùng với role `MANAGER` |
| Chi nhánh | Lấy từ hồ sơ nhân viên của Manager (`employeeProfile.branchId`), giống màn hình Inventory. Không chọn được chi nhánh khác |
| Nơi kiểm soát quyền | **Backend** (API trả `401`/`403`). Guard ở giao diện chỉ để điều hướng |

---

## 2. Các khu vực trên màn hình

### 2.1. Chi nhánh của Manager
- Tên chi nhánh hiển thị ở đầu trang. Chi nhánh được lấy tự động từ tài khoản Manager đang đăng nhập (`employeeProfile.branchId`).
- Manager chỉ xem và thao tác trên ca của chi nhánh mình; ca của chi nhánh khác được coi là không tồn tại (`404`). Đây chưa phải phân quyền theo chi nhánh tổng quát (quyết định A-16 chưa được duyệt).
- Tài khoản Manager **chưa được gán chi nhánh** sẽ thấy thông báo "Your account is not assigned to a branch" (API trả `403 BRANCH_NOT_ASSIGNED`); cần quản trị viên gán chi nhánh.

### 2.2. Bảng điều khiển trực tiếp (dashboard)
Các thẻ mô tả **ngày đang xem** (mặc định là hôm nay, theo giờ Việt Nam) của chi nhánh. Dashboard tự làm mới mỗi 30 giây, có nút **Refresh** và giờ cập nhật gần nhất. Khi Manager chọn ngày khác ở bộ lọc, các thẻ chuyển theo ngày đó, nên duyệt một ca của ngày đó sẽ làm các thẻ đổi ngay.

| Thẻ / khối | Ý nghĩa |
| --- | --- |
| **In progress** | Số ca đang trong khung giờ làm việc của ngày đang xem, kèm số ca theo từng vị trí làm việc |
| **Scheduled** | Số ca chưa bắt đầu của ngày đang xem |
| **Awaiting approval** | Tổng số ca đã hết giờ nhưng chưa được duyệt hoặc hủy của chi nhánh, **tính mọi ngày** (dòng chú thích cho biết có bao nhiêu ca thuộc ngày đang xem). Bấm vào thẻ (**Review all**) để xem toàn bộ danh sách, ca cũ nhất trước |
| **Approved** | Số ca đã duyệt của ngày đang xem (ghi chú kèm số ca đã hủy của ngày đó) |
| **On shift now** | Danh sách người đang trong ca: tên, vị trí, giờ kết thúc |
| **Up next** | Tối đa 5 ca sắp bắt đầu hôm nay |

### 2.3. Bộ lọc
- Chọn ngày: nút ngày trước / ngày sau, ô chọn ngày, nút **Today**.
- Tìm theo **tên nhân viên** (hoặc username).
- Lọc theo **trạng thái** và theo **vị trí làm việc**.
- Nút **Reset** đưa tất cả về mặc định (hôm nay, không lọc).
- Bộ lọc được lưu trên URL nên có thể gửi đường dẫn cho người khác hoặc tải lại trang mà không mất bộ lọc.
- Ca qua đêm (ví dụ 22:00 – 06:00) được tính vào **ngày bắt đầu**.
- **Review all** (thẻ *Awaiting approval*) mở danh sách mọi ca đang chờ duyệt, không phụ thuộc ngày, ca cũ nhất trước; mỗi dòng hiển thị cả ngày của ca. Trong chế độ này bộ lọc ngày và trạng thái được thay bằng một thanh thông báo và nút **Back to the date view**. Ca đã duyệt biến mất khỏi danh sách.

### 2.4. Bảng danh sách ca
Mỗi dòng là một ca, sắp xếp ca mới nhất lên trước, 10 ca mỗi trang.

| Cột | Nội dung |
| --- | --- |
| Employee | Họ tên, số điện thoại (hoặc username) |
| Work position | Vị trí làm việc (ví dụ `Box Office Station 2`) |
| Shift | Giờ bắt đầu – kết thúc, thời lượng dự kiến, nhãn `+1 day` nếu qua nửa đêm |
| Status | Trạng thái của ca (xem mục 3) |
| Approval | Người duyệt và thời điểm duyệt; hoặc người hủy và thời điểm hủy; hoặc `Ready to approve` |
| Hành động | **View** (xem), hoặc **Review** nếu ca đang chờ duyệt |

Có đủ trạng thái đang tải, lỗi (kèm nút thử lại) và trống (kèm gợi ý đổi ngày hoặc xóa bộ lọc).

### 2.5. Ngăn chi tiết ca
Mở khi bấm View / Review:

- thông tin ca: trạng thái, ngày, giờ dự kiến, vị trí, nhân viên, số điện thoại;
- **lịch sử** theo thứ tự thời gian: ai phân ca, ai hủy, ai duyệt và lúc nào (kèm ghi chú duyệt);
- **Approve shift**: ghi chú tùy chọn (tối đa 500 ký tự), có bước xác nhận. Chỉ hiện khi ca đã kết thúc;
- **Cancel shift**: có bước xác nhận. Chỉ hiện khi ca chưa bắt đầu;
- người không có quyền `shift.manage` chỉ xem được, không thấy nút thay đổi.

### 2.6. Form phân ca (**Assign shift**)
- **Employee**: ô tìm theo tên và danh sách chọn, hiển thị tên, chức danh (`employeeProfile.position`) và số điện thoại; chỉ gồm tài khoản đang `ACTIVE` có role `STAFF` **làm việc tại chi nhánh của Manager**.
- **Work position**: nhập tự do (tối đa 100 ký tự), có gợi ý từ các vị trí đã dùng ở chi nhánh.
- **Starts / Ends**: giờ theo **giờ rạp (Asia/Ho_Chi_Minh)**, mặc định bắt đầu ở giờ tròn kế tiếp, kéo dài 8 giờ.
- Báo lỗi ngay tại từng ô và hiện thông báo khi máy chủ từ chối (ví dụ trùng ca).

---

## 3. Vòng đời của một ca (**ĐỀ XUẤT**)

| Trạng thái hiển thị | Cách có được | Ý nghĩa | Hành động được phép |
| --- | --- | --- | --- |
| `SCHEDULED` (Scheduled) | Lưu trong DB | Ca đã lập, chưa đến giờ bắt đầu | Hủy |
| `IN_PROGRESS` (In progress) | **Tính từ giờ hiện tại** | Đang trong khung giờ dự kiến | Không |
| `COMPLETED` (hiển thị *Awaiting approval*) | **Tính từ giờ hiện tại** | Đã hết giờ dự kiến, chờ Manager duyệt | Duyệt |
| `APPROVED` (Approved) | Lưu trong DB | Manager đã duyệt, ghi `approvedBy`, `approvedAt` | Không (duyệt đúng một lần) |
| `CANCELLED` (Cancelled) | Lưu trong DB | Ca đã hủy, ghi `cancelledBy`, `cancelledAt` | Không |

Lưu ý quan trọng:

- Hệ thống chỉ **lưu** `SCHEDULED`, `APPROVED`, `CANCELLED`. `IN_PROGRESS` và `COMPLETED` được tính từ giờ bắt đầu, giờ kết thúc và đồng hồ, nên không cần job chạy nền.
- `IN_PROGRESS` / `COMPLETED` chỉ nói **khung giờ dự kiến** đang chạy hay đã qua. Chúng **không** cho biết nhân viên có đi làm thật hay không.
- Ca **không bị xóa**, chỉ chuyển sang `CANCELLED`, để giữ lịch sử.
- Dữ liệu cũ có `status` khác hoặc thiếu được đọc là `SCHEDULED`.

---

## 4. Quy tắc kiểm tra khi phân ca (**ĐỀ XUẤT**)

| Quy tắc | Mã lỗi khi vi phạm |
| --- | --- |
| Giờ kết thúc phải sau giờ bắt đầu; giờ phải có múi giờ | `VALIDATION_FAILED` (400) |
| Ca phải bắt đầu trong tương lai | `SHIFT_IN_THE_PAST` (409) |
| Ca dài tối đa 12 giờ | `SHIFT_TOO_LONG` (409) |
| Chi nhánh của Manager phải được gán, tồn tại và đang `ACTIVE` | `BRANCH_NOT_ASSIGNED` (403) / `BRANCH_NOT_FOUND` (404) / `BRANCH_INACTIVE` (409) |
| Nhân viên phải là tài khoản `ACTIVE` có role `STAFF` và thuộc chi nhánh của Manager | `EMPLOYEE_NOT_FOUND` (404) |
| Một nhân viên không có hai ca trùng giờ (kiểm tra xuyên chi nhánh; ca liền kề được phép; ca đã hủy không tính) | `SHIFT_OVERLAP` (409) |
| Chỉ hủy được ca chưa bắt đầu | `SHIFT_NOT_CANCELLABLE`, `SHIFT_ALREADY_CANCELLED` (409) |
| Chỉ duyệt được ca đã kết thúc, đúng một lần | `SHIFT_NOT_APPROVABLE`, `SHIFT_ALREADY_APPROVED` (409) |

Hủy và duyệt dùng cập nhật có điều kiện trong một thao tác, nên hai người cùng bấm một lúc thì chỉ một người thành công.

---

## 5. API và dữ liệu

Tất cả bắt đầu bằng `/api/staff-shifts`, yêu cầu đăng nhập, role `MANAGER`. **Chi nhánh không phải là tham số**: máy chủ lấy từ hồ sơ nhân viên của Manager; gửi `branchId` sẽ bị từ chối.

| Phương thức | Đường dẫn | Quyền | Việc |
| --- | --- | --- | --- |
| GET | `/dashboard?date=` | `shift.view` | Số liệu dashboard của chi nhánh cho ngày `date` (mặc định hôm nay) và `awaitingApprovalTotal` (mọi ngày). Ca qua đêm đang chạy chỉ được tính khi xem hôm nay |
| GET | `/` | `shift.view` | Danh sách ca của chi nhánh. Tham số: `date` hoặc `dateFrom`/`dateTo` (tối đa 31 ngày), `q`, `status`, `station`, `page`, `limit` (tối đa 50); hoặc `pending=true` để lấy mọi ca đang chờ duyệt (không kết hợp được với `date`, `dateFrom`, `dateTo`, `status`) |
| GET | `/:shiftId` | `shift.view` | Chi tiết ca và lịch sử |
| GET | `/stations` | `shift.view` | Gợi ý vị trí làm việc đã dùng ở chi nhánh |
| GET | `/employees?q=` | `shift.manage` | Nhân viên của chi nhánh có thể phân ca (kèm chức danh) |
| POST | `/` | `shift.manage` | Phân ca |
| POST | `/:shiftId/cancel` | `shift.manage` | Hủy ca |
| POST | `/:shiftId/approve` | `shift.manage` | Duyệt ca (ghi chú tùy chọn) |

Dữ liệu nằm trong collection `staff_shifts`:

| Field | Ý nghĩa |
| --- | --- |
| `employeeAccountId` | Tài khoản nhân viên làm ca |
| `branchId` | Chi nhánh |
| `startTime`, `endTime` | Giờ dự kiến (lưu UTC, hiển thị giờ Việt Nam) |
| `station` | Vị trí làm việc (văn bản tự do) |
| `status` | `SCHEDULED`, `APPROVED` hoặc `CANCELLED` |
| `createdBy` | Manager phân ca |
| `approvedBy`, `approvedAt`, `approvalNote` | **Người duyệt**, thời điểm và ghi chú |
| `cancelledBy`, `cancelledAt` | Người hủy và thời điểm |
| `createdAt`, `updatedAt` | Mốc thời gian của bản ghi |

Vai trò của một người được xác định bằng **role** của tài khoản (`roleIds`); chi nhánh làm việc và chức danh lấy từ `employeeProfile` của tài khoản.

---

## 6. Hướng dẫn dùng nhanh

1. Đăng nhập bằng tài khoản Manager đã được gán chi nhánh, vào menu **Staff Shifts**.
2. Bấm **Assign shift**, chọn nhân viên của chi nhánh, nhập vị trí, giờ bắt đầu và giờ kết thúc, bấm **Assign shift**.
3. Theo dõi ca trên dashboard và trong bảng. Dùng bộ lọc để xem ngày khác hoặc một nhân viên.
4. Khi ca đã kết thúc, bấm **Review**, đọc lịch sử, thêm ghi chú nếu cần rồi **Approve shift**.
5. Ca chưa bắt đầu mà không còn cần nữa thì mở chi tiết và bấm **Cancel shift**.

Hiện **chưa có dữ liệu mẫu**: danh sách ca bắt đầu rỗng, và chỉ những tài khoản `STAFF` thuộc chi nhánh của Manager (hiện là `hieutrung`, F-Cinema Central) mới chọn được ở form phân ca.

---

## 7. Không nằm trong phạm vi của màn hình này

Theo nguyên tắc của nhóm *"chỉ làm phần ca làm việc tối thiểu, không tự thêm chấm công"*:

- chấm công: giờ vào, giờ ra, nghỉ giải lao, nhật ký terminal, phát hiện đi trễ / về sớm / vắng mặt;
- sửa giờ của một ca đã tạo (muốn đổi thì hủy và tạo ca mới);
- đổi ca, thay thế nhân viên, nhắc ca, báo cáo sự cố, xem theo tuần, xuất bảng phân công;
- phân quyền theo chi nhánh tổng quát (chưa được duyệt); màn hình chỉ giới hạn theo chi nhánh trong hồ sơ của Manager.

---

## 8. Nhân viên có cần màn hình xem lịch làm việc không?

### 8.1. Hiện trạng: nhân viên **chưa có cách nào** biết lịch của mình trong hệ thống

- Ma trận quyền trong Business Rules chỉ cho **Manager** chức năng "Monitor Staff Shifts".
- Role `STAFF` không có quyền `shift.view` hay `shift.manage`; nếu nhân viên gọi API ca làm việc sẽ nhận `403`.
- Menu của nhân viên (Staff) không có mục xem lịch làm việc.
- Hệ thống chưa có thông báo (email hoặc trong ứng dụng) khi được phân ca hoặc khi ca bị hủy.

Hậu quả: Manager lập lịch xong, nhưng nhân viên chỉ biết mình có ca nếu **Manager báo trực tiếp** (nói miệng, nhắn tin, ...). Lịch trong hệ thống không đến được người phải đi làm.

### 8.2. Khuyến nghị: **nên có**, ở mức tối thiểu, chỉ đọc (**ĐỀ XUẤT**)

Một màn hình **"Lịch làm việc của tôi"** cho nhân viên, vì nếu không có thì chức năng phân ca của Manager không phát huy được giá trị. Màn hình này **chưa có trong SRS và SCREEN_FLOW**, cần owner duyệt trước khi làm.

Đề xuất tối thiểu:

| Hạng mục | Đề xuất |
| --- | --- |
| Đường dẫn | `/staff/schedule`, thêm mục **My Schedule** vào menu nhân viên |
| Nội dung | Danh sách (hoặc xem theo tuần) các ca **của chính mình**: ngày, giờ, vị trí làm việc, chi nhánh, trạng thái; ca sắp tới xếp trên cùng, ca hôm nay được làm nổi bật |
| API | `GET /api/staff-shifts/me` |
| Bảo mật | Máy chủ lấy tài khoản từ **phiên đăng nhập**, không nhận mã nhân viên từ yêu cầu, nên không ai xem được ca của người khác |
| Quyền | Cần owner chọn: cấp `shift.view` cho role `STAFF` nhưng chỉ trả dữ liệu của chính họ, hoặc dùng một quyền mới được duyệt |
| Không làm | Không chấm công, không cho nhân viên sửa hay hủy ca |

Mở rộng về sau (không bắt buộc ngay):

- thông báo khi được phân ca hoặc ca bị hủy (cần một module thông báo hiện chưa tồn tại);
- thẻ **"Ca tiếp theo của tôi"** trên trang chủ của nhân viên.

### 8.3. Giải pháp tạm nếu chưa làm màn hình

Manager dùng bảng của màn hình này làm nguồn, và báo trực tiếp cho nhân viên về ca của họ. Cách này dễ sai sót (quên báo, thay đổi không đến được người liên quan).

---

## 9. Hạn chế hiện tại và việc cần team quyết định

- Kiểm tra trùng ca **không nguyên tử**: hai thao tác phân ca cùng lúc cho cùng một nhân viên có thể cùng thành công (MongoDB không ép khoảng thời gian trùng bằng index).
- Cần reviewer của `auth/RBAC` xác nhận route `/api/staff-shifts`, việc dùng `shift.view` / `shift.manage` cho Manager và việc đọc `employeeProfile.branchId` để xác định chi nhánh (như Inventory).
- Phần đọc thông tin tài khoản nằm trong chính module staff-shift (`staff-shift.accounts.js`, chỉ đọc, chỉ dùng field gốc của tài khoản); Account owner có thể muốn một read contract chính thức.
- Quyết định chờ owner: có làm màn hình **Lịch làm việc của tôi** (mục 8) hay không, và cấp quyền cho `STAFF` như thế nào.

---

## 10. Tài liệu và code liên quan

| Nội dung | Vị trí |
| --- | --- |
| Use case gốc | `docs/CMS_UC38_Monitor_Staff_Shifts.md` |
| Trạng thái yêu cầu | `docs/REQUIREMENTS_STATUS.md` (dòng UC38 và mục *Staff shift*) |
| Cấu trúc dữ liệu | `docs/cinema_database_schema.md` (mục `staff_shifts`) |
| Mockup tham khảo | `docs/screens/monitoring_staff_shift/` |
| Backend | `server/src/modules/staff-shift/` |
| Frontend | `client/src/features/staff-shifts/` |
| Kiểm thử | `server/test/staff-shift.e2e.test.js`, `server/test/staff-shift.policy.test.js`, `client/test/staff-shift-format.test.js` |
