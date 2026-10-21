# CMS_UC38 --- Monitor Staff Shifts

## 1. Tổng quan

  -----------------------------------------------------------------------
  Thuộc tính                          Nội dung
  ----------------------------------- -----------------------------------
  Use case                            Monitor Staff Shifts

  Mã use case                         `CMS_UC38`

  Người tạo                           TuLC

  Actor chính                         Manager

  Actor phụ                           Không có

  Mục tiêu                            Cho phép Manager theo dõi, đối
                                      chiếu và kiểm tra nhật ký chấm công
                                      theo ca, phân công terminal hiện
                                      tại và lịch sử clock-in/clock-out
                                      của nhân viên vận hành tại cơ sở.
  -----------------------------------------------------------------------

## 2. Mô tả nghiệp vụ

Manager sử dụng **Staff Operations Portal** để mở **Shift Dashboard**.
Hệ thống hiển thị thống kê theo dõi theo thời gian thực, bao gồm các ca
đang hoạt động, terminal logs và các điểm/nút công việc được phân công.
Manager có thể lọc dữ liệu theo ngày ca trong quá khứ, tên nhân viên
hoặc các dấu hiệu sai lệch trong dữ liệu theo dõi. Sau khi xem lịch sử
sự kiện theo thứ tự thời gian, Manager kiểm tra và xác nhận báo cáo ca
đã hoàn tất.

Ví dụ về vị trí/terminal được nêu trong use case: -
`Box Office Station 2` - `Concierge Scanner Room B`

Các ví dụ trên minh họa dữ liệu phân công terminal/task node; tài liệu
không quy định đây là danh sách cố định.

## 3. Điều kiện tiên quyết

-   Tài khoản nhân viên đang hoạt động.
-   Nhân viên đang sử dụng giao diện terminal của hệ thống để ghi nhận
    hoạt động theo ca hằng ngày.

Use case không mô tả cách tạo tài khoản, đăng nhập hoặc ghi nhận
clock-in/clock-out; đây là các hoạt động có trước use case này.

## 4. Luồng chính

1.  Manager mở **Staff Operations Portal** và chọn **Shift Dashboard**.
2.  Hệ thống lấy và hiển thị thống kê theo dõi thời gian thực, gồm:
    -   Các ca đang hoạt động.
    -   Nhật ký terminal.
    -   Các task node/điểm công việc được phân công.
3.  Manager áp dụng bộ lọc để tra cứu:
    -   Ngày ca trong quá khứ.
    -   Tên nhân viên cụ thể.
    -   Các sai lệch trong dữ liệu theo dõi.
4.  Hệ thống hiển thị dữ liệu lịch sử dưới dạng lưới sự kiện chi tiết,
    được sắp xếp theo trình tự thời gian và ghi lại lịch sử theo dõi
    nhân sự.
5.  Manager kiểm tra và xác nhận báo cáo ca đã hoàn tất.

## 5. Hậu điều kiện

Sau khi Manager xem xét báo cáo, giao diện theo dõi ca ghi nhận sự kiện
review. Các bản ghi theo dõi thời gian được đánh dấu là đã được quản lý
kiểm tra/audit chính thức.

Tài liệu không nêu rõ trạng thái lưu trữ cụ thể, cơ chế ký số hay khả
năng chỉnh sửa/xóa bản ghi sau khi audit.

## 6. Yêu cầu chức năng suy ra từ luồng use case

> Các mục dưới đây là cách diễn giải phục vụ triển khai từ luồng use
> case, không phải business rules bổ sung được trích nguyên văn từ tài
> liệu.

-   **FR-01 --- Mở dashboard:** Manager có thể truy cập Shift Dashboard
    trong Staff Operations Portal.
-   **FR-02 --- Hiển thị số liệu hiện tại:** Dashboard hiển thị ca đang
    hoạt động, terminal logs và task node được phân công.
-   **FR-03 --- Lọc lịch sử:** Cho phép tìm kiếm/lọc theo ngày ca, tên
    nhân viên và dấu hiệu sai lệch.
-   **FR-04 --- Hiển thị dòng thời gian:** Kết quả được trình bày thành
    event grid có thứ tự thời gian và thông tin đủ chi tiết để kiểm tra
    lịch sử nhân sự.
-   **FR-05 --- Audit báo cáo:** Manager có thể xác nhận báo cáo ca đã
    hoàn tất.
-   **FR-06 --- Ghi nhận review:** Hệ thống lưu/ghi nhận sự kiện review
    và đánh dấu dữ liệu theo dõi là đã được audit.

## 7. Hướng dẫn xử lý dữ liệu và CRUD

Use case này chủ yếu là **tra cứu, theo dõi và audit**, không phải use
case tạo hoặc chỉnh sửa dữ liệu chấm công.

  -----------------------------------------------------------------------
  Nhóm dữ liệu            Hành vi được hỗ trợ     Lưu ý
                          theo use case           
  ----------------------- ----------------------- -----------------------
  Shift/attendance logs   Read / tra cứu          Hiển thị lịch sử
                                                  clock-in/clock-out và
                                                  ca làm việc nếu dữ liệu
                                                  đó có trong hệ thống.

  Terminal logs           Read / tra cứu          Hiển thị nhật ký
                                                  terminal và terminal
                                                  assignment hiện tại.

  Task node assignments   Read / tra cứu          Hiển thị các điểm/nút
                                                  công việc được phân
                                                  công.

  Review/audit event      Create / ghi nhận sự    Được suy ra từ hậu điều
                          kiện review             kiện yêu cầu hệ thống
                                                  ghi nhận việc Manager
                                                  review.

  Shift report            Read và xác nhận hoàn   Tài liệu không mô tả
                          tất                     chỉnh sửa nội dung báo
                                                  cáo.
  -----------------------------------------------------------------------

**Không tự động bổ sung** thao tác tạo/sửa/xóa shift logs, thay đổi phân
công terminal, sửa giờ clock-in/clock-out hoặc xóa audit record. Những
thao tác này không được mô tả trong use case và cần được xác nhận bằng
đặc tả nghiệp vụ khác trước khi triển khai.

## 8. Quy tắc về quyền truy cập

-   Actor được xác định trong tài liệu là `Manager`.
-   Luồng thao tác của use case được thực hiện bởi Manager.
-   Tài liệu không cung cấp ma trận phân quyền chi tiết, danh sách
    permission key hoặc quy tắc cho các role khác. Không tự đặt tên
    permission hay suy diễn quyền truy cập của role khác nếu chưa có tài
    liệu Screen Authorization/permission tương ứng.

## 9. Ngoại lệ và luồng thay thế

-   Tài liệu ghi **Alternative Sequences: None**.
-   Không có luồng lỗi cụ thể được định nghĩa, chẳng hạn không tải được
    dữ liệu, không có kết quả tìm kiếm hoặc lỗi khi ghi nhận audit.
-   Nếu cần triển khai các tình huống này, hãy xác nhận với chủ sở hữu
    nghiệp vụ hoặc đặc tả hệ thống liên quan; không coi chúng là quy tắc
    đã được phê duyệt.

## 10. Business rules

Tài liệu gốc ghi **Business Rule: None**. Vì vậy, không có business rule
riêng nào được định nghĩa trong use case này.

Các chi tiết chưa được quy định và không nên tự giả định gồm: - Công
thức xác định thế nào là một tracking discrepancy. - Múi giờ và cách xử
lý ca qua ngày. - Các trường bắt buộc trong từng event log. - Cách phân
trang, sắp xếp mặc định và giới hạn khoảng thời gian tìm kiếm. - Manager
có được audit lại báo cáo đã audit hay không. - Audit có khóa bản ghi
gốc hay chỉ thêm trạng thái/event. - Quy tắc lưu trữ, thời hạn giữ dữ
liệu và xử lý lỗi khi ghi audit.

## 11. Tiêu chí nghiệm thu gợi ý

Các tiêu chí dưới đây được đề xuất để kiểm tra việc hiện thực hóa luồng
chính; cần đối chiếu với các tài liệu yêu cầu khác trước khi xem là tiêu
chí chính thức.

1.  Manager mở được Shift Dashboard khi đáp ứng quyền truy cập đã cấu
    hình.
2.  Dashboard hiển thị được ca đang hoạt động, terminal logs và task
    node assignments từ dữ liệu hệ thống.
3.  Manager có thể lọc lịch sử theo ngày ca, tên nhân viên và dấu hiệu
    sai lệch theo các bộ lọc được hỗ trợ.
4.  Kết quả hiển thị theo thứ tự thời gian và đủ chi tiết để đối chiếu
    lịch sử theo dõi.
5.  Manager có thể thực hiện thao tác review/sign-off trên báo cáo ca đã
    hoàn tất.
6.  Sau khi xác nhận, hệ thống ghi nhận review event và thể hiện trạng
    thái đã audit.
7.  Việc xem hoặc audit không tự ý sửa/xóa các bản ghi
    clock-in/clock-out gốc.

## 12. Ghi chú cho người triển khai/AI coding agent

-   Tuân thủ đúng actor, luồng chính, điều kiện tiên quyết và hậu điều
    kiện trong use case `CMS_UC38`.
-   Tận dụng các model/schema và API hiện có nếu chúng đã đáp ứng yêu
    cầu; không tự ý thêm trường hoặc thay đổi schema chỉ dựa trên suy
    luận.
-   Nếu thiếu dữ liệu để biểu diễn terminal logs, task node assignment,
    discrepancy hoặc audit event, hãy nêu rõ phần thiếu và đề xuất thay
    đổi để chủ dự án phê duyệt trước khi chỉnh sửa schema.
-   Không tự tạo thêm luồng nghiệp vụ, business rules, quyền hạn hay
    thao tác CRUD ngoài tài liệu được cung cấp.
-   Khi có tài liệu Business Rules, Screen Authorization hoặc schema
    liên quan, dùng chúng để xác định chi tiết triển khai còn thiếu và
    giải quyết xung đột theo quy trình phê duyệt của dự án.

## Nguồn

Được biên soạn từ tài liệu use case **3.5.4 Monitor Staff Shifts ---
CMS_UC38**. Các mục được ghi rõ là "suy ra", "gợi ý" hoặc "chưa được quy
định" là diễn giải phục vụ triển khai, không phải nội dung được xác nhận
trực tiếp trong use case gốc.
