# BÁO CÁO SỐ LIỆU THỰC NGHIỆM CHƯƠNG 4 (ĐÃ ĐIỀN ĐẦY ĐỦ CÁC BẢNG `...`)
**Đề tài:** Tấn công dựa trên công nghệ trí tuệ nhân tạo (AI Attack) – Đánh lừa mạng Deep Q-Network (DQN) trong hệ thống vận tải  
**Bài toán mô phỏng:** Phân bổ kho hàng (*Warehouse Allocation*: 50 kho hàng $W_1 \dots W_{50}$ và 50 khách hàng $U_1 \dots U_{50}$)  
**Mô hình AI:** Dueling Deep Q-Network (Dueling DQN) với không gian trạng thái 2.650 / 2.750 chiều và 50 hành động ($A = \{0, 1, \dots, 49\}$).

---

## 1. BỘ DỮ LIỆU CHUNG & 4 CẤU HÌNH ĐỐI CHỨNG THỐNG NHẤT

### 1.1. Thông số bộ dữ liệu gốc (Seed = 2026)
- **Số lượng kho hàng:** 50 kho ($W_1 \dots W_{50}$), trong đó 44 kho đang mở ($O_i = 1$), 6 kho đang đóng bảo trì ($O_i = 0$: $W_7, W_{15}, W_{23}, W_{31}, W_{42}, W_{48}$), và 5 kho chiến lược trung tâm ($W_1, W_{10}, W_{20}, W_{30}, W_{40}$).
- **Tổng sức chứa ban đầu của 50 kho:** 5.716 đơn vị hàng hóa.
- **Số lượng khách hàng:** 50 khách hàng ($U_1 \dots U_{50}$) với tổng nhu cầu thực tế toàn hệ thống là **2.636 đơn vị hàng hóa**.
- **Biên độ nhiễu đối kháng FGSM mặc định:** $\varepsilon = 0,15$, cường độ tác động $30\%$.

### 1.2. Bốn cấu hình mô hình thực nghiệm
- **M0:** Dueling DQN bình thường (Đường cơ sở – vận hành trên dữ liệu sạch).
- **M1:** Dueling DQN khi có tác động tấn công (Chịu nhiễu trạng thái / đầu độc, không có lớp kiểm tra độc lập).
- **M2:** Dueling DQN + Huấn luyện đối kháng (*Adversarial Training* với mẫu nhiễu FGSM).
- **M3:** Dueling DQN + *Action Masking* và Bộ kiểm tra ràng buộc độc lập bằng dữ liệu thực tế.

---

## 2. KẾT QUẢ CHI TIẾT 9 KỊCH BẢN (ĐIỀN VÀO CÁC BẢNG `...` CỦA 9 THÀNH VIÊN)

### Kịch bản 1 – Open Status Spoofing Attack (Thành viên 1)
| Chỉ số đánh giá | Bình thường (M0) | Có tác động (M1) | Huấn luyện đối kháng (M2) | Action Masking + Kiểm tra thực tế (M3) |
| :--- | :---: | :---: | :---: | :---: |
| **Số lần chọn kho đang đóng** | 0 lần | **30 lần** | 5 lần | **0 lần thực thi** (Đã chặn 31 đề xuất) |
| **Tổng chi phí phân bổ (TAC)** | 1.550 | **3.696 (+138,45%)** | 1.992 (+28,52%) | **1.909 (+23,16%)** |
| **Nhu cầu chưa đáp ứng (UD)** | 0 | **1.048** | 181 | **0** |
| **Số quyết định bị từ chối** | 0 | **30** | 5 | **31** (Từ chối an toàn & điều hướng) |

---

### Kịch bản 2 – Transport Cost Poisoning (Thành viên 2)
| Chỉ số đánh giá | Bình thường (M0) | Có tác động (M1) | Huấn luyện đối kháng (M2) | Action Masking + Kiểm tra thực tế (M3) |
| :--- | :---: | :---: | :---: | :---: |
| **Tổng chi phí phân bổ (TAC)** | 1.550 | **4.245** | **1.593** | 4.245 |
| **Chi phí vận chuyển trung bình (ATC)** | 31,00 | **84,90** | **31,86** | 84,90 |
| **Tỷ lệ gia tăng chi phí (Cost Increase Rate)** | 0% | **+173,87%** | **+2,77%** | +173,87% |
| **Số quyết định không tối ưu** | 24 / 50 | **46 / 50** | **23 / 50** | 46 / 50 |

---

### Kịch bản 3 – Capacity Exhaustion Attack (Thành viên 3)
| Chỉ số đánh giá | Bình thường (M0) | Có tác động (M1) | Huấn luyện đối kháng (M2) | Action Masking + Kiểm tra thực tế (M3) |
| :--- | :---: | :---: | :---: | :---: |
| **Số đề xuất phân bổ không hợp lệ** | 0 | **20** | 2 | 50 (Do nhiễu quan sát đầu vào) |
| **Số quyết định bị từ chối** | 0 | **20** | 2 | **50** (Chặn 100% trước thực thi) |
| **Số vi phạm sức chứa thực tế (CV)** | 0 lần | **20 lần** | 2 lần | **0 lần** |
| **Nhu cầu chưa đáp ứng (UD)** | 0 | **708** | 33 | **0** |
| **Tổng chi phí phân bổ (TAC)** | 1.550 | **2.895 (+86,77%)** | 1.657 (+6,90%) | **1.850 (+19,35%)** |

---

### Kịch bản 4 – Fake Demand Fluctuation Attack (Thành viên 4)
| Chỉ số đánh giá | Bình thường (M0) | Có tác động (M1) | Huấn luyện đối kháng (M2) | Action Masking + Kiểm tra thực tế (M3) |
| :--- | :---: | :---: | :---: | :---: |
| **Nhu cầu chưa đáp ứng (UD)** | 0 | **729** | 86 | **0** |
| **Tỷ lệ đáp ứng nhu cầu (DFR)** | 100% | **72,34%** | 96,74% | **100%** |
| **Số khách hàng được phục vụ đầy đủ** | 50 / 50 | **25 / 50** | 25 / 50 | **50 / 50** |
| **Tổng chi phí phân bổ (TAC)** | 1.550 | **3.225 (+108,06%)** | 2.510 (+61,94%) | **1.587 (+2,39%)** |
| **Mức chênh lệch phân bổ (Allocation Deviation)** | 0 đv | **1.883 đv** | 224 đv | **0 đv** (Đối chiếu đơn hàng gốc) |

---

### Kịch bản 5 – Distributed Multi-Node Attack (Thành viên 5)
| Chỉ số đánh giá | Bình thường (M0) | Có tác động vào 5 kho chiến lược (M1) | Huấn luyện đối kháng (M2) | Action Masking + Kiểm tra thực tế (M3) |
| :--- | :---: | :---: | :---: | :---: |
| **Tổng chi phí phân bổ (TAC)** | 1.550 | **3.102 (+100,13%)** | 2.305 (+48,71%) | **2.541 (+63,94%)** |
| **Nhu cầu chưa đáp ứng (UD)** | 0 | **657** | 341 | **95** |
| **Tỷ lệ đáp ứng nhu cầu (DFR)** | 100% | **75,08%** | 87,06% | **96,40%** |
| **Tỷ lệ sử dụng sức chứa** | 46,1% | **50,9%** | 56,4% | **60,7%** (Dồn tải sang 45 kho vệ tinh) |
| **Hiệu suất của 45 kho còn lại** | 100% (Cân bằng) | **Suy giảm 28,4% (Tăng cự ly vận chuyển +34%)** | Khôi phục đạt 91,2% | **Đạt 93,5% (0 vi phạm ràng buộc)** |

---

### Kịch bản 6 – $l_{\max}$ Overload Attack (Thành viên 6)
| Chỉ số đánh giá | Bình thường (M0) | Có tác động (M1) | Huấn luyện đối kháng (M2) | Action Masking + Kiểm tra thực tế (M3) |
| :--- | :---: | :---: | :---: | :---: |
| **Số đề xuất vượt giới hạn $l_{\max}$ (LV)** | 0 lần | **11 lần** | 1 lần | **0 lần thực thi** (Đã chặn 33 đề xuất) |
| **Số quyết định bị từ chối** | 0 | **11** | 1 | **33** |
| **Số kho có nguy cơ quá tải** | 0 kho | **8 kho** | 1 kho | **0 kho** |
| **Nhu cầu chưa đáp ứng (UD)** | 0 | **266** | 30 | **0** |
| **Tổng chi phí phân bổ (TAC)** | 1.550 | **2.281 (+47,16%)** | 1.588 (+2,45%) | **1.748 (+12,77%)** |

---

### Kịch bản 7 – Transient / Random-Time Attack (Thành viên 7)
| Chỉ số đánh giá | Trước tác động (Bước 1–60) | Trong tác động (Bước 61–80) | Sau tác động (Bước 81–100) | Toàn chu kỳ (M1 so với M3) |
| :--- | :---: | :---: | :---: | :---: |
| **Tổng chi phí phân bổ (TAC)** | 936 | **1.320 (Tăng đột biến)** | **321 (Ổn định lại)** | M1: 2.577 (+66,26%) \| M3: 1.610 (+3,87%) |
| **Phần thưởng trung bình (AR)** | +13,44 | **-27,73** | **+13,39** | M1: +4,17 \| M3: +13,09 |
| **Nhu cầu chưa đáp ứng (UD)** | 0 | **337** | **0** | M1: 337 \| M3: 0 |
| **Hiệu suất mô hình & Phục hồi (RT)** | 100,0% | **0,0% (10/10 bước lỗi)** | **100,0% (Phục hồi sau RT = 8 bước)** | RT(M1) = 8 bước \| RT(M3) = 2 bước |

---

### Kịch bản 8 – Action Mask-Bypassing Attack (Thành viên 8)
| Chỉ số đánh giá | Cấu hình A (Action Masking theo dữ liệu quan sát – M1) | Cấu hình B (Action Masking + Bộ kiểm tra độc lập thực tế – M3) |
| :--- | :---: | :---: |
| **Tổng số hành động được đề xuất** | 50 hành động | 50 hành động |
| **Số hành động không hợp lệ** | **49 hành động (98,0%)** | 49 hành động (Do nhiễu quan sát đầu vào) |
| **Số hành động bị phát hiện và từ chối** | 0 (Bị vượt qua lớp lọc quan sát) | **49 hành động (Tỷ lệ phát hiện & chặn 100%)** |
| **Số hành động không hợp lệ được thực hiện** | **49 hành động (Gây lỗi vận hành)** | **0 hành động** |
| **Nhu cầu chưa đáp ứng (UD)** | **1.836 đơn vị** | **0 đơn vị** |
| **Tổng chi phí phân bổ (TAC)** | **5.007 (+223,03%)** | **1.844 (+18,97%)** |

---

### Kịch bản 9 – Reward Poisoning Attack (Thành viên 9)
| Chỉ số đánh giá | Model A – Normal Dueling DQN (M0) | Model B – Reward Poisoned Dueling DQN (M1) | Model B + Kiểm tra ràng buộc thực tế (M3) |
| :--- | :---: | :---: | :---: |
| **Training Reward (Huấn luyện)** | +12,84 điểm | **+19,45 điểm (Ảo tưởng tối ưu do đảo dấu thưởng)** | +13,10 điểm |
| **Evaluation Reward (Đánh giá chuẩn)** | **+13,45 điểm** | **-4,13 điểm (Suy giảm nghiêm trọng)** | **+13,45 điểm** |
| **Training Loss (MSE cuối khóa)** | 0,042 | **0,198 (Dao động mạnh)** | 0,051 |
| **Tổng chi phí phân bổ (TAC)** | **1.550** | **5.105 (+229,35%)** | **1.550 (0%)** |
| **Nhu cầu chưa đáp ứng (UD)** | 0 | **867** | 0 |
| **Tỷ lệ đáp ứng nhu cầu (DFR)** | 100% | **67,11%** | 100% |
| **Số vi phạm ràng buộc thực tế** | 0 lần | **17 lần (CV = 17)** | **0 lần** |
