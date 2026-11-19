# Secure CWLP AI Agent

Mô phỏng Clean Baseline của Capacitated Warehouse Location/Allocation bằng
Node.js ES Modules. Giai đoạn này chỉ đánh giá random feasible, greedy feasible
và Dueling DQN; chưa chạy FGSM hay bất kỳ kịch bản tấn công nào.

## Yêu cầu môi trường

- Windows 10/11, Node.js LTS 20 hoặc 22 (64-bit), npm 10+.
- `@tensorflow/tfjs-node` 4.x hỗ trợ Node LTS 20/22. Nếu native binding không
  tải được, xóa `node_modules` và cài lại bằng đúng Node 64-bit.
- Không cần Python để chạy hệ thống.

## Chạy từ đầu trên PowerShell

```powershell
cd C:\Users\thinh\Desktop\ATBMTT
node --version
npm --version
npm install
npm test
npm run train
npm run evaluate
node src/index.js attack 5 0,0.01,0.05,0.1
```

Nếu `node` không được nhận diện, cài Node.js LTS từ https://nodejs.org rồi mở
PowerShell mới. `cap111.txt` là dữ liệu nguồn 16 kho x 50 khách hàng và được
giữ nguyên. Vì mô hình tiểu luận yêu cầu 50 kho x 50 khách hàng, chương trình
dùng synthetic 50x50 có seed cố định `20261021` làm dataset vận hành chính khi
file nguồn không đúng kích thước mục tiêu. Dataset được lưu tại
`data\synthetic-50x50.json`.

Kết quả baseline nằm trong `results/baseline-results.json`, lịch sử train trong
`results/training-history.json`, checkpoint trong `checkpoints/baseline/`.

Giai đoạn attack chỉ đọc checkpoint tại `checkpoints\baseline`; nó không gọi
`fit`, không cập nhật gradient và không ghi đè checkpoint. Lệnh attack ghi
`results/attack.csv` và `results/attack_comparison.json`. `epsilon=0` là đối
chứng sạch. FGSM dùng loss `L(s) = -Q(s, a_selected)` với action hợp lệ được
chọn bằng action mask; `s_adv = clip(s + epsilon * sign(gradient_s L), 0, 1)`.
Nếu native TensorFlow hoặc checkpoint chưa có, chương trình ghi trạng thái
`unavailable` thay vì tự tạo kết quả.

## Giai đoạn 3: Defense

```powershell
npm run defense
npm run train-defense
```

Defense tạo:

- `results/final_comparison.csv`
- `results/metrics.json`
- `reports/experimental-report.md`

Sanitizer phân biệt lỗi cấu trúc (kích thước/kiểu/NaN/Infinity) với trạng thái
hợp lệ về cấu trúc nhưng bất thường theo phân phối validation sạch. Detector
fit ngưỡng từ validation, không dùng test. Guardrail kiểm tra action mask ngay
trước `step`, ghi quyết định gốc/cuối và dùng action khả thi dự phòng.

`train-defense` dùng replay samples có trường `source` và lưu riêng tại
`checkpoints\adversarial`; không ghi đè `checkpoints\baseline`. Đây là pipeline
trộn mẫu sạch/nhiễu trong replay, không được gọi là min-max training.

## Mô hình và giới hạn

Mỗi bước chọn kho cho khách hàng kế tiếp; một khách hàng có thể nhận từ nhiều
kho. Kho tự mở khi được chọn, chỉ tính fixed cost một lần. Action mask loại kho
đã hết sức chứa, vượt giới hạn khách hoặc không có chi phí vận chuyển hợp lệ.
Chi phí vận chuyển được tính `quantity * transportCost[customer][warehouse]`.
Penalty unmet demand mặc định là `1000` cho mỗi đơn vị nhu cầu chưa đáp ứng;
đây là tham số chi phí kinh doanh, không phải phần thưởng tùy ý.

Mỗi reward là âm của delta total cost phát sinh trong bước; terminal reward bao
gồm penalty unmet demand. Vì vậy tổng reward của episode bằng `-totalCost`.
DQN là heuristic học được, không được tuyên bố là nghiệm tối ưu nếu chưa so
sánh với solver/đối chứng. Các báo cáo do chương trình tạo ra chứa trung bình,
độ lệch chuẩn và tỷ lệ thay đổi chi phí trên cùng seed/dữ liệu.

State theo mô hình 50x50 có 151 chiều: 50 remaining capacity, 50 open status,
50 normalized transport costs của khách hàng hiện tại và 1 remaining demand.
