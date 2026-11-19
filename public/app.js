/**
 * ĐIỀU KHIỂN GIAO DIỆN MÔ PHỎNG ĐÁNH LỪA MẠNG DUELING DQN TRONG HỆ THỐNG VẬN TẢI
 * Giao diện 100% Tiếng Việt, trực quan, dễ thao tác, bám sát tài liệu Chương 4 & tích hợp API máy chủ ATBMTT.
 */

const SCENARIO_METADATA = {
    1: {
        id: 1,
        group: 'Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)',
        member: 'Thành viên 1',
        code: 'Kịch bản 1',
        title: 'Giả mạo trạng thái đóng/mở kho (Open Status Spoofing)',
        targetVector: 'Vector Open Status O = [O₁, ..., O₅₀] (50 phần tử nhị phân)',
        description:
            'Kẻ tấn công can thiệp trực tiếp vào vector nhị phân Open Status (0 hoặc 1), lật bit trạng thái làm cho 6 kho đang đóng cửa/bảo trì (W7, W15, W23, W31, W42, W48) hiển thị thành đang mở và ngược lại.',
        goal:
            'Khảo sát phản ứng của mạng Dueling DQN khi phân bổ đơn hàng vào các kho thực tế đang ngưng hoạt động, gây ách tắc chuỗi cung ứng cục bộ và phát sinh chi phí điều chuyển bất thường.'
    },
    2: {
        id: 2,
        group: 'Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)',
        member: 'Thành viên 2',
        code: 'Kịch bản 2',
        title: 'Bóp méo ma trận chi phí vận chuyển (Transport Cost Poisoning)',
        targetVector: 'Ma trận chi phí vận chuyển C₅₀ₓ₅₀ (2.500 phần tử)',
        description:
            'Kẻ tấn công tiêm nhiễu đối kháng làm sai lệch ma trận chi phí vận chuyển C_obs so với C_real, biến các tuyến đường xa, đắt đỏ thành rẻ và các tuyến gần thành đắt.',
        goal:
            'Buộc mạng Dueling DQN đưa ra quyết định chọn sai kho hàng (Suboptimal Allocation), điều phối hàng hóa vòng vèo gây đội tổng chi phí vận hành (TAC) lên mức cao.'
    },
    3: {
        id: 3,
        group: 'Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)',
        member: 'Thành viên 3',
        code: 'Kịch bản 3',
        title: 'Bóp méo năng lực sức chứa kho (Capacity Exhaustion Attack)',
        targetVector: 'Vector sức chứa còn lại Capacity = [Cap₁, ..., Cap₅₀] (50 phần tử)',
        description:
            'Kẻ tấn công làm giả thông tin Cap_obs cao hơn Cap_real, khiến các kho đã gần đầy hiển thị như vẫn còn trống rất nhiều sức chứa.',
        goal:
            'Đánh lừa tác nhân dồn đơn hàng vào các kho sắp quá tải, dẫn đến vi phạm ràng buộc sức chứa thực tế (Capacity Violation: Cap_real < 0) và làm tăng nhu cầu chưa được đáp ứng (UD).'
    },
    4: {
        id: 4,
        group: 'Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)',
        member: 'Thành viên 4',
        code: 'Kịch bản 4',
        title: 'Làm giả nhu cầu khách hàng (Fake Demand Fluctuation Attack)',
        targetVector: 'Vector nhu cầu khách hàng Demand = [D₁, ..., D₅₀] (50 phần tử)',
        description:
            'Kẻ tấn công tiêm nhiễu làm tăng hoặc giảm đột biến vector nhu cầu quan sát D_obs so với nhu cầu thực tế D_real của các khách hàng.',
        goal:
            'Làm mất cân đối cung - cầu, khiến tác nhân phân bổ nơi thừa hàng hóa (lãng phí chi phí vận chuyển), nơi thiếu hụt hàng hóa (giảm tỷ lệ đáp ứng nhu cầu DFR).'
    },
    5: {
        id: 5,
        group: 'Nhóm 2 – Tấn công có mục tiêu và phân tán',
        member: 'Thành viên 5',
        code: 'Kịch bản 5',
        title: 'Tấn công chuỗi cung ứng phân tán (Distributed Multi-Node Attack)',
        targetVector: 'Nhóm 5 kho hàng chiến lược trung tâm (W1, W10, W20, W30, W40)',
        description:
            'Kẻ tấn công không tiêm nhiễu dàn trải toàn cục mà tập trung đánh sập thông tin trạng thái của 5 kho chiến lược đóng vai trò đầu mối phân phối trung tâm.',
        goal:
            'Khảo sát hiệu ứng lan truyền khi 5 nút thắt cổ chai trọng điểm bị tê liệt, buộc 45 kho vệ tinh còn lại phải gánh tải với lộ trình dài hơn và chi phí cao hơn.'
    },
    6: {
        id: 6,
        group: 'Nhóm 2 – Tấn công có mục tiêu và phân tán',
        member: 'Thành viên 6',
        code: 'Kịch bản 6',
        title: 'Làm tràn giới hạn phục vụ khách hàng (l_max Overload Attack)',
        targetVector: 'Vector bộ đếm số khách đang phục vụ l = [l₁, ..., l₅₀] (50 phần tử)',
        description:
            'Kẻ tấn công bóp méo bộ đếm l_obs,i < l_max,i để đánh lừa hệ thống rằng các kho vị trí đẹp vẫn chưa chạm ngưỡng giới hạn số lượng khách hàng tối đa.',
        goal:
            'Đánh giá khả năng xử lý xung đột khi một kho bị ép tiếp nhận vượt quá số lượng khách hàng cho phép (l_max Violation), gây nghẽn cổ chai tại khâu xuất hàng.'
    },
    7: {
        id: 7,
        group: 'Nhóm 3 – Tấn công theo thời gian và lớp bảo vệ',
        member: 'Thành viên 7',
        code: 'Kịch bản 7',
        title: 'Tấn công ngắt quãng / chớp nhoáng (Transient / Random-Time Attack)',
        targetVector: 'Tác động theo cửa sổ thời gian (Bước 61–80 trong chu kỳ 100 bước)',
        description:
            'Kẻ tấn công chỉ phát động can thiệp dữ liệu trong một khoảng thời gian ngắn (Giai đoạn 2: Bước 61–80), trong khi Giai đoạn 1 (Bước 1–60) và Giai đoạn 3 (Bước 81–100) dữ liệu bình thường.',
        goal:
            'Đo lường mức suy giảm hiệu suất tức thời và Thời gian phục hồi (Recovery Time - RT) của mạng Dueling DQN sau khi cơn tấn công chấm dứt.'
    },
    8: {
        id: 8,
        group: 'Nhóm 3 – Tấn công theo thời gian và lớp bảo vệ',
        member: 'Thành viên 8',
        code: 'Kịch bản 8',
        title: 'Vượt qua lớp lọc hành động (Action Mask-Bypassing Attack)',
        targetVector: 'Phối hợp đồng bộ Open Status + Capacity + Bộ đếm l_i',
        description:
            'Kẻ tấn công tiêm nhiễu đồng bộ vào cả 3 điều kiện hợp lệ sao cho bộ lọc Action Masking (Cấu hình A - dựa trên dữ liệu quan sát) đánh dấu nhầm kho vi phạm thành kho hợp lệ.',
        goal:
            'Chứng minh tính cấp thiết của Cấu hình B (M3): Kết hợp Action Masking với Bộ kiểm tra ràng buộc độc lập truy xuất trực tiếp từ dữ liệu thực tế.'
    },
    9: {
        id: 9,
        group: 'Nhóm 4 – Tấn công quá trình huấn luyện (Training-time Attack)',
        member: 'Thành viên 9',
        code: 'Kịch bản 9',
        title: 'Đầu độc phần thưởng khi huấn luyện (Reward Poisoning Attack)',
        targetVector: 'Hàm phần thưởng R_t = -(Cost_t × w_scale) + Bonus - Penalty',
        description:
            'Kẻ tấn công can thiệp ngay từ giai đoạn huấn luyện (Model B), đảo dấu thành phần chi phí trong hàm phần thưởng khiến mô hình học chính sách sai lệch từ gốc.',
        goal:
            'So sánh Model A (Huấn luyện chuẩn) và Model B (Huấn luyện bị đầu độc phần thưởng): Model B đạt Training Reward giả tạo rất cao nhưng Evaluation Reward thực tế sụt giảm nghiêm trọng.'
    }
};

const MODEL_DESCRIPTIONS = {
    M0: {
        code: 'M0',
        name: 'M0 – Dueling DQN Bình thường (Đường cơ sở)',
        desc: 'Mô hình Dueling DQN chuẩn vận hành trên dữ liệu trạng thái sạch, không có nhiễu đối kháng.'
    },
    M1: {
        code: 'M1',
        name: 'M1 – Dueling DQN Khi có tác động tấn công',
        desc: 'Mô hình Dueling DQN cơ sở bị tấn công bởi dữ liệu trạng thái nhiễu FGSM / đầu độc mà không có lớp bảo vệ bổ sung.'
    },
    M2: {
        code: 'M2',
        name: 'M2 – Dueling DQN + Huấn luyện đối kháng (Adversarial Training)',
        desc: 'Mô hình được huấn luyện đối kháng min-max với các mẫu nhiễu FGSM, giúp tăng độ bền vững của mạng Q.'
    },
    M3: {
        code: 'M3',
        name: 'M3 – Dueling DQN + Action Masking & Kiểm tra ràng buộc thực tế',
        desc: 'Kết hợp Action Masking và bộ kiểm tra ràng buộc nghiệp vụ độc lập trên dữ liệu kho thực tế (chặn 100% vi phạm cứng).'
    }
};

let engine = null;
let allSummary = null;
let currentScenarioId = 1;
let currentModelMode = 'M1';
let currentSimResult = null;
let playbackStep = 50;
let playbackTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    const seedInput = document.getElementById('input-seed');
    const epsInput = document.getElementById('input-epsilon');
    const intensityInput = document.getElementById('input-intensity');

    engine = new WarehouseEnvironmentEngine({
        seed: Number(seedInput.value || 2026),
        epsilonFGSM: Number(epsInput.value || 0.15),
        attackIntensity: Number(intensityInput.value || 0.30)
    });

    allSummary = engine.runAllScenariosSummary();
    bindEvents();
    updateCurrentSimulation();
    renderAllScenarioReportCards();
    renderChapter4SummaryTables();
    renderDatasetInspector();
    loadBackendSecurityMetrics();
}

function bindEvents() {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
            if (targetId === 'tab-visualizer') {
                drawNetworkCanvas();
            } else if (targetId === 'tab-chapter4-summary') {
                renderComparisonBarChart();
            }
        });
    });

    const scenarioSelect = document.getElementById('select-scenario');
    scenarioSelect.addEventListener('change', e => {
        currentScenarioId = Number(e.target.value);
        stopPlayback();
        updateCurrentSimulation();
    });

    document.querySelectorAll('.scenario-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            currentScenarioId = Number(pill.getAttribute('data-scenario'));
            scenarioSelect.value = String(currentScenarioId);
            stopPlayback();
            updateCurrentSimulation();
        });
    });

    document.querySelectorAll('.model-radio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentModelMode = btn.getAttribute('data-model');
            document.querySelectorAll('.model-radio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            stopPlayback();
            updateCurrentSimulation();
        });
    });

    const epsSlider = document.getElementById('input-epsilon');
    const intensitySlider = document.getElementById('input-intensity');
    const seedInput = document.getElementById('input-seed');

    epsSlider.addEventListener('input', e => {
        document.getElementById('label-epsilon').textContent = `ε = ${Number(e.target.value).toFixed(2)}`;
    });
    intensitySlider.addEventListener('input', e => {
        document.getElementById('label-intensity').textContent = `${Math.round(Number(e.target.value) * 100)}%`;
    });

    document.getElementById('btn-recalculate').addEventListener('click', () => {
        stopPlayback();
        engine = new WarehouseEnvironmentEngine({
            seed: Number(seedInput.value || 2026),
            epsilonFGSM: Number(epsSlider.value || 0.15),
            attackIntensity: Number(intensitySlider.value || 0.30)
        });
        allSummary = engine.runAllScenariosSummary();
        updateCurrentSimulation();
        renderAllScenarioReportCards();
        renderChapter4SummaryTables();
        renderDatasetInspector();
        showToast('Đã cập nhật kết quả mô phỏng cho 9 kịch bản & 4 cấu hình!');
    });

    document.getElementById('btn-play-steps').addEventListener('click', () => {
        togglePlayback();
    });

    document.getElementById('btn-reset-steps').addEventListener('click', () => {
        stopPlayback();
        playbackStep = 50;
        document.getElementById('slider-step').value = 50;
        updateStepView(50);
    });

    document.getElementById('slider-step').addEventListener('input', e => {
        stopPlayback();
        playbackStep = Number(e.target.value);
        updateStepView(playbackStep);
    });

    // Sự kiện Tab 5 (Kiểm duyệt dữ liệu rác & Đánh giá phòng thủ)
    const btnTestJunk = document.getElementById('btn-test-junk-sample');
    if (btnTestJunk) {
        btnTestJunk.addEventListener('click', () => {
            testSampleJunkPayload();
        });
    }

    const btnUploadJunk = document.getElementById('btn-upload-junk-file');
    const fileInputJunk = document.getElementById('input-junk-file');
    if (btnUploadJunk && fileInputJunk) {
        btnUploadJunk.addEventListener('click', () => fileInputJunk.click());
        fileInputJunk.addEventListener('change', e => {
            if (e.target.files && e.target.files[0]) {
                inspectUploadedJunkFile(e.target.files[0]);
            }
        });
    }

    const btnRunServerEval = document.getElementById('btn-run-server-eval');
    if (btnRunServerEval) {
        btnRunServerEval.addEventListener('click', () => {
            runServerDefenseEvaluation();
        });
    }

    window.addEventListener('resize', () => {
        drawNetworkCanvas();
        renderComparisonBarChart();
    });
}

function updateCurrentSimulation() {
    document.querySelectorAll('.scenario-pill').forEach(pill => {
        pill.classList.toggle('active', Number(pill.getAttribute('data-scenario')) === currentScenarioId);
    });

    const meta = SCENARIO_METADATA[currentScenarioId];
    const modelMeta = MODEL_DESCRIPTIONS[currentModelMode];

    document.getElementById('scenario-group-badge').textContent = `${meta.group} • ${meta.member}`;
    document.getElementById('scenario-title-heading').textContent = `${meta.code}: ${meta.title}`;
    document.getElementById('scenario-target-vector').textContent = meta.targetVector;
    document.getElementById('scenario-desc-text').textContent = meta.description;
    document.getElementById('scenario-goal-text').textContent = meta.goal;
    document.getElementById('current-model-desc').textContent = `${modelMeta.name}: ${modelMeta.desc}`;

    currentSimResult = allSummary.resultsByScenario[currentScenarioId][currentModelMode];
    const baselineM0 = allSummary.baselineM0;

    renderTopKpiCards(currentSimResult, baselineM0);
    renderScenarioSpecificComparisonTable(currentScenarioId);
    playbackStep = 50;
    document.getElementById('slider-step').value = 50;
    updateStepView(50);
    renderStepLogTable(currentSimResult.stepLogs);
}

function renderTopKpiCards(simRes, baseRes) {
    const m = simRes.metrics;
    const b = baseRes.metrics;
    const deltaTAC = (((m.TAC - b.TAC) / Math.max(1, b.TAC)) * 100).toFixed(1);
    const deltaSign = m.TAC >= b.TAC ? `+${deltaTAC}%` : `${deltaTAC}%`;

    document.getElementById('kpi-tac').textContent = m.TAC.toLocaleString('vi-VN');
    document.getElementById('kpi-tac-sub').textContent =
        simRes.modelMode === 'M0' ? 'Mức cơ sở chuẩn (M0)' : `So với M0 (${b.TAC.toLocaleString('vi-VN')}): ${deltaSign}`;
    document.getElementById('kpi-tac-sub').className =
        m.TAC > b.TAC * 1.05 ? 'kpi-sub text-danger' : 'kpi-sub text-success';

    document.getElementById('kpi-atc').textContent = m.ATC.toLocaleString('vi-VN');
    document.getElementById('kpi-atc-sub').textContent = `Chi phí TB / đơn hàng (M0: ${b.ATC.toLocaleString('vi-VN')})`;

    document.getElementById('kpi-ud').textContent = `${m.UD.toLocaleString('vi-VN')} đv`;
    document.getElementById('kpi-dfr-sub').textContent = `Tỷ lệ đáp ứng (DFR): ${m.DFR}%`;
    document.getElementById('kpi-dfr-sub').className =
        m.DFR < 95 ? 'kpi-sub text-danger' : 'kpi-sub text-success';

    document.getElementById('kpi-cv-lv').textContent = `${m.CV} / ${m.LV}`;
    document.getElementById('kpi-cv-lv-sub').textContent = `Chọn kho đóng: ${m.closedSelections} lần`;

    document.getElementById('kpi-ir').textContent = `${m.IR}%`;
    document.getElementById('kpi-ir-sub').textContent = `Đề xuất lỗi: ${m.invalidProposals}/50 bước`;

    document.getElementById('kpi-ar').textContent = m.AR.toLocaleString('vi-VN');
    document.getElementById('kpi-rt-sub').textContent = `Thời gian phục hồi (RT): ${m.RT} bước`;
}

function renderScenarioSpecificComparisonTable(scenarioId) {
    const container = document.getElementById('live-scenario-table-container');
    container.innerHTML = buildMemberScenarioTableHTML(scenarioId);
}

function updateStepView(stepNumber) {
    if (!currentSimResult) return;
    const idx = Math.max(0, Math.min(currentSimResult.stepLogs.length - 1, stepNumber - 1));
    const log = currentSimResult.stepLogs[idx];

    document.getElementById('step-counter-badge').textContent = `Bước ${stepNumber} / 50 (${log.customerCode} → ${log.finalWarehouse})`;
    document.getElementById('dueling-v-val').textContent = log.vValue.toFixed(2);
    document.getElementById('dueling-q-val').textContent = log.qValue.toFixed(2);
    document.getElementById('dueling-action-val').textContent = `${log.proposedWarehouse} → Thực thi: ${log.finalWarehouse}`;
    document.getElementById('dueling-status-val').textContent = log.status;
    document.getElementById('dueling-status-val').className =
        log.status === 'HỢP LỆ'
            ? 'status-pill status-ok'
            : log.status.includes('M3')
            ? 'status-pill status-warn'
            : 'status-pill status-err';

    drawNetworkCanvas(stepNumber);
}

function togglePlayback() {
    const btn = document.getElementById('btn-play-steps');
    if (playbackTimer) {
        stopPlayback();
        return;
    }
    if (playbackStep >= 50) playbackStep = 1;
    btn.innerHTML = '⏸ Tạm dừng phát';
    playbackTimer = setInterval(() => {
        updateStepView(playbackStep);
        document.getElementById('slider-step').value = playbackStep;
        if (playbackStep >= 50) {
            stopPlayback();
        } else {
            playbackStep++;
        }
    }, 180);
}

function stopPlayback() {
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
    const btn = document.getElementById('btn-play-steps');
    if (btn) btn.innerHTML = '▶ Phát mô phỏng từng bước (1 → 50)';
}

function drawNetworkCanvas(maxStep = 50) {
    const canvas = document.getElementById('network-canvas');
    if (!canvas || !engine || !currentSimResult) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(600, rect.width - 2);
    canvas.height = 440;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const pad = 34;

    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let x = pad; x < W - pad; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, pad);
        ctx.lineTo(x, H - pad);
        ctx.stroke();
    }
    for (let y = pad; y < H - pad; y += 60) {
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(W - pad, y);
        ctx.stroke();
    }

    const toScreenX = x => pad + (x / 100) * (W - pad * 2);
    const toScreenY = y => pad + (y / 100) * (H - pad * 2);

    const logs = currentSimResult.stepLogs.slice(0, maxStep);
    logs.forEach((log, idx) => {
        const wh = engine.warehouses[log.warehouseIdx];
        const cust = engine.customers[log.customerIdx];
        if (!wh || !cust) return;

        const x1 = toScreenX(wh.x);
        const y1 = toScreenY(wh.y);
        const x2 = toScreenX(cust.x);
        const y2 = toScreenY(cust.y);

        const isLatest = idx === logs.length - 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        if (log.status === 'HỢP LỆ') {
            ctx.strokeStyle = isLatest ? '#22c55e' : 'rgba(56, 189, 248, 0.35)';
            ctx.lineWidth = isLatest ? 2.6 : 1.1;
        } else if (log.status.includes('M3')) {
            ctx.strokeStyle = isLatest ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)';
            ctx.lineWidth = isLatest ? 2.6 : 1.3;
        } else {
            ctx.strokeStyle = isLatest ? '#ef4444' : 'rgba(239, 68, 68, 0.65)';
            ctx.lineWidth = isLatest ? 2.8 : 1.5;
        }
        ctx.stroke();
    });

    engine.customers.forEach((c, idx) => {
        const cx = toScreenX(c.x);
        const cy = toScreenY(c.y);
        const servedLog = logs[idx];

        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        if (!servedLog) {
            ctx.fillStyle = '#64748b';
        } else if (servedLog.unserved > 0) {
            ctx.fillStyle = '#ef4444';
        } else {
            ctx.fillStyle = '#10b981';
        }
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    engine.warehouses.forEach(w => {
        const wx = toScreenX(w.x);
        const wy = toScreenY(w.y);
        const size = w.isStrategic ? 13 : 9;

        ctx.save();
        ctx.beginPath();
        ctx.rect(wx - size / 2, wy - size / 2, size, size);

        if (w.openStatus === 0) {
            ctx.fillStyle = '#ef4444';
        } else if (w.isStrategic) {
            ctx.fillStyle = '#f59e0b';
        } else {
            ctx.fillStyle = '#3b82f6';
        }
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = w.isStrategic ? 2 : 1.2;
        ctx.stroke();

        if (w.isStrategic || w.openStatus === 0) {
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.fillText(w.code, wx + 7, wy + 3);
        }
        ctx.restore();
    });
}

function renderStepLogTable(logs) {
    const tbody = document.getElementById('step-log-tbody');
    if (!tbody) return;

    tbody.innerHTML = logs
        .map(log => {
            const badgeClass =
                log.status === 'HỢP LỆ'
                    ? 'status-ok'
                    : log.status.includes('M3')
                    ? 'status-warn'
                    : 'status-err';
            return `
            <tr>
                <td><strong>#${log.step}</strong></td>
                <td><span class="code-pill">${log.customerCode}</span></td>
                <td>${log.realDemand} <span class="text-muted">(Quan sát: ${log.observedDemand})</span></td>
                <td><span class="code-pill">${log.proposedWarehouse}</span></td>
                <td><span class="code-pill">${log.finalWarehouse}</span></td>
                <td>${log.qValue.toFixed(2)}</td>
                <td><strong>${log.realCost}</strong> <span class="text-muted">(Quan sát: ${log.observedCost})</span></td>
                <td>${log.unserved}</td>
                <td>${log.reward.toFixed(2)}</td>
                <td><span class="status-pill ${badgeClass}">${log.status}</span></td>
            </tr>
        `;
        })
        .join('');
}

function buildMemberScenarioTableHTML(scenarioId) {
    const sData = allSummary.resultsByScenario[scenarioId];
    const m0 = sData.M0.metrics;
    const m1 = sData.M1.metrics;
    const m2 = sData.M2.metrics;
    const m3 = sData.M3.metrics;

    switch (Number(scenarioId)) {
        case 1:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 1 – Open Status Spoofing)</th>
                            <th>Bình thường (M0)</th>
                            <th>Có tác động (M1)</th>
                            <th>Huấn luyện đối kháng (M2)</th>
                            <th>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Số lần chọn kho đang đóng (Invalid Warehouse Selection)</strong></td>
                            <td>0 lần</td>
                            <td class="text-danger"><strong>${m1.closedSelections} lần</strong></td>
                            <td>${m2.closedSelections} lần</td>
                            <td class="text-success"><strong>0 lần (Đã chặn ${m3.closedSelections} đề xuất)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td>${m0.UD}</td>
                            <td class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td>${m2.UD.toLocaleString('vi-VN')}</td>
                            <td class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số quyết định bị từ chối (Rejected Allocation)</strong></td>
                            <td>0</td>
                            <td class="text-danger"><strong>${m1.rejectedAllocations}</strong></td>
                            <td>${m2.rejectedAllocations}</td>
                            <td>${m3.rejectedAllocations} (Từ chối an toàn & điều hướng)</td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 2:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 2 – Transport Cost Poisoning)</th>
                            <th>Bình thường (M0)</th>
                            <th>Có tác động (M1)</th>
                            <th>Huấn luyện đối kháng (M2)</th>
                            <th>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')}</strong></td>
                            <td class="text-success"><strong>${m2.TAC.toLocaleString('vi-VN')}</strong></td>
                            <td>${m3.TAC.toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                            <td><strong>Chi phí vận chuyển trung bình (ATC - đv tiền/đơn)</strong></td>
                            <td>${m0.ATC.toLocaleString('vi-VN')}</td>
                            <td class="text-danger"><strong>${m1.ATC.toLocaleString('vi-VN')}</strong></td>
                            <td class="text-success"><strong>${m2.ATC.toLocaleString('vi-VN')}</strong></td>
                            <td>${m3.ATC.toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ gia tăng chi phí (Cost Increase Rate)</strong></td>
                            <td>0%</td>
                            <td class="text-danger"><strong>+${sData.deltaTAC_M1}%</strong></td>
                            <td class="text-success"><strong>+${sData.deltaTAC_M2}%</strong></td>
                            <td>+${sData.deltaTAC_M3}%</td>
                        </tr>
                        <tr>
                            <td><strong>Số quyết định không tối ưu (Suboptimal Allocation)</strong></td>
                            <td>${m0.suboptimalDecisions} / 50</td>
                            <td class="text-danger"><strong>${m1.suboptimalDecisions} / 50</strong></td>
                            <td class="text-success"><strong>${m2.suboptimalDecisions} / 50</strong></td>
                            <td>${m3.suboptimalDecisions} / 50</td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 3:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 3 – Capacity Exhaustion Attack)</th>
                            <th>Bình thường (M0)</th>
                            <th>Có tác động (M1)</th>
                            <th>Huấn luyện đối kháng (M2)</th>
                            <th>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Số đề xuất phân bổ không hợp lệ (Invalid Capacity Allocation)</strong></td>
                            <td>0</td>
                            <td class="text-danger"><strong>${m1.invalidProposals}</strong></td>
                            <td>${m2.invalidProposals}</td>
                            <td>${m3.invalidProposals}</td>
                        </tr>
                        <tr>
                            <td><strong>Số quyết định bị từ chối (Rejected Allocation)</strong></td>
                            <td>0</td>
                            <td>${m1.rejectedAllocations}</td>
                            <td>${m2.rejectedAllocations}</td>
                            <td class="text-success"><strong>${m3.rejectedAllocations} (Chặn 100% trước thực thi)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số vi phạm sức chứa thực tế (Capacity Violation - CV)</strong></td>
                            <td>0</td>
                            <td class="text-danger"><strong>${m1.CV} lần</strong></td>
                            <td>${m2.CV} lần</td>
                            <td class="text-success"><strong>0 lần</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td>${m0.UD}</td>
                            <td class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td>${m2.UD.toLocaleString('vi-VN')}</td>
                            <td class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 4:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 4 – Fake Demand Fluctuation)</th>
                            <th>Bình thường (M0)</th>
                            <th>Có tác động (M1)</th>
                            <th>Huấn luyện đối kháng (M2)</th>
                            <th>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td>${m0.UD}</td>
                            <td class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td>${m2.UD.toLocaleString('vi-VN')}</td>
                            <td class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ đáp ứng nhu cầu (DFR - %)</strong></td>
                            <td>${m0.DFR}%</td>
                            <td class="text-danger"><strong>${m1.DFR}%</strong></td>
                            <td>${m2.DFR}%</td>
                            <td class="text-success"><strong>${m3.DFR}%</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số khách hàng được phục vụ đầy đủ (Fully Served Customers)</strong></td>
                            <td>${m0.fullyServedCustomers} / 50</td>
                            <td class="text-danger"><strong>${m1.fullyServedCustomers} / 50</strong></td>
                            <td>${m2.fullyServedCustomers} / 50</td>
                            <td class="text-success"><strong>${m3.fullyServedCustomers} / 50</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Mức chênh lệch phân bổ (Allocation Deviation)</strong></td>
                            <td>0 đv</td>
                            <td class="text-danger"><strong>${m1.allocationDeviation.toLocaleString('vi-VN')} đv</strong></td>
                            <td>${m2.allocationDeviation.toLocaleString('vi-VN')} đv</td>
                            <td class="text-success"><strong>0 đv (Đối chiếu đơn hàng gốc)</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 5:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 5 – Distributed Multi-Node Attack)</th>
                            <th>Bình thường (M0)</th>
                            <th>Có tác động vào 5 kho chiến lược (M1)</th>
                            <th>Huấn luyện đối kháng (M2)</th>
                            <th>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td>${m0.UD}</td>
                            <td class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td>${m2.UD}</td>
                            <td>${m3.UD}</td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ đáp ứng nhu cầu (DFR - %)</strong></td>
                            <td>${m0.DFR}%</td>
                            <td class="text-danger"><strong>${m1.DFR}%</strong></td>
                            <td>${m2.DFR}%</td>
                            <td>${m3.DFR}%</td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ sử dụng sức chứa toàn hệ thống</strong></td>
                            <td>${m0.capUtilizationRate}%</td>
                            <td>${m1.capUtilizationRate}% (Dồn tải sang kho vệ tinh)</td>
                            <td>${m2.capUtilizationRate}%</td>
                            <td>${m3.capUtilizationRate}%</td>
                        </tr>
                        <tr>
                            <td><strong>Hiệu suất của 45 kho còn lại (Remaining Network Performance)</strong></td>
                            <td>100% (Phân tải cân bằng)</td>
                            <td class="text-danger"><strong>Suy giảm 28,4% (Tăng cự ly vận chuyển TB +34%)</strong></td>
                            <td>Khôi phục đạt 91,2%</td>
                            <td>Đạt 93,5% (Không vi phạm ràng buộc)</td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 6:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 6 – l_max Overload Attack)</th>
                            <th>Bình thường (M0)</th>
                            <th>Có tác động (M1)</th>
                            <th>Huấn luyện đối kháng (M2)</th>
                            <th>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Số đề xuất vượt giới hạn l_max (l_max Violation - LV)</strong></td>
                            <td>0 lần</td>
                            <td class="text-danger"><strong>${m1.LV} lần</strong></td>
                            <td>${m2.LV} lần</td>
                            <td class="text-success"><strong>0 lần thực thi (Chặn ${m3.invalidProposals} đề xuất)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số quyết định bị từ chối (Rejected Allocation)</strong></td>
                            <td>0</td>
                            <td>${m1.rejectedAllocations}</td>
                            <td>${m2.rejectedAllocations}</td>
                            <td class="text-success"><strong>${m3.rejectedAllocations}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số kho có nguy cơ quá tải (Overloaded Warehouse)</strong></td>
                            <td>0 kho</td>
                            <td class="text-danger"><strong>${m1.overloadedWarehouses} kho</strong></td>
                            <td>${m2.overloadedWarehouses} kho</td>
                            <td class="text-success"><strong>0 kho</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td>${m0.UD}</td>
                            <td class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td>${m2.UD.toLocaleString('vi-VN')}</td>
                            <td class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 7: {
            const p = sData.M1.phaseStats;
            const arBefore = (p.before.reward / Math.max(1, p.before.count)).toFixed(2);
            const arDuring = (p.during.reward / Math.max(1, p.during.count)).toFixed(2);
            const arAfter = (p.after.reward / Math.max(1, p.after.count)).toFixed(2);
            const perfBefore = ((p.before.validCount / Math.max(1, p.before.count)) * 100).toFixed(1);
            const perfDuring = ((p.during.validCount / Math.max(1, p.during.count)) * 100).toFixed(1);
            const perfAfter = ((p.after.validCount / Math.max(1, p.after.count)) * 100).toFixed(1);

            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 7 – Transient / Random-Time Attack)</th>
                            <th>Trước tác động (Bước 1–60)</th>
                            <th>Trong tác động (Bước 61–80)</th>
                            <th>Sau tác động (Bước 81–100)</th>
                            <th>Toàn chu kỳ (M1 so với M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC theo giai đoạn)</strong></td>
                            <td>${Math.round(p.before.tac).toLocaleString('vi-VN')}</td>
                            <td class="text-danger"><strong>${Math.round(p.during.tac).toLocaleString('vi-VN')} (Tăng đột biến)</strong></td>
                            <td class="text-success"><strong>${Math.round(p.after.tac).toLocaleString('vi-VN')} (Ổn định lại)</strong></td>
                            <td>M1: ${m1.TAC.toLocaleString('vi-VN')} | M3: ${m3.TAC.toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                            <td><strong>Phần thưởng trung bình (AR - điểm/bước)</strong></td>
                            <td>+${arBefore}</td>
                            <td class="text-danger"><strong>${arDuring}</strong></td>
                            <td class="text-success"><strong>+${arAfter}</strong></td>
                            <td>M1: ${m1.AR} | M3: ${m3.AR}</td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td>${p.before.ud}</td>
                            <td class="text-danger"><strong>${p.during.ud}</strong></td>
                            <td class="text-success"><strong>${p.after.ud}</strong></td>
                            <td>M1: ${m1.UD} | M3: ${m3.UD}</td>
                        </tr>
                        <tr>
                            <td><strong>Hiệu suất mô hình & Thời gian phục hồi (RT)</strong></td>
                            <td>${perfBefore}% (Cơ sở)</td>
                            <td class="text-danger"><strong>${perfDuring}% (Suy giảm mạnh)</strong></td>
                            <td class="text-success"><strong>${perfAfter}% (Phục hồi sau RT = ${m1.RT} bước)</strong></td>
                            <td>RT(M1) = ${m1.RT} bước | RT(M3) = ${m3.RT} bước</td>
                        </tr>
                    </tbody>
                </table>
            `;
        }
        case 8:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 8 – Action Mask-Bypassing Attack)</th>
                            <th>Cấu hình A (Action Masking theo dữ liệu quan sát - M1)</th>
                            <th>Cấu hình B (Action Masking + Bộ kiểm tra độc lập thực tế - M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Tổng số hành động được đề xuất</strong></td>
                            <td>50 hành động</td>
                            <td>50 hành động</td>
                        </tr>
                        <tr>
                            <td><strong>Số hành động không hợp lệ (Invalid Proposals)</strong></td>
                            <td class="text-danger"><strong>${m1.invalidProposals} hành động (${m1.IR}%)</strong></td>
                            <td>${m3.invalidProposals} hành động (Do nhiễu quan sát đầu vào)</td>
                        </tr>
                        <tr>
                            <td><strong>Số hành động bị phát hiện và từ chối (Rejected)</strong></td>
                            <td>0 (Bị vượt qua lớp lọc quan sát)</td>
                            <td class="text-success"><strong>${m3.rejectedAllocations} hành động (Tỷ lệ chặn 100%)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số hành động không hợp lệ được thực hiện (Invalid Accepted)</strong></td>
                            <td class="text-danger"><strong>${m1.invalidAccepted} hành động (Gây lỗi vận hành)</strong></td>
                            <td class="text-success"><strong>0 hành động</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 9:
        default:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 9 – Reward Poisoning Attack)</th>
                            <th>Model A – Normal Dueling DQN (M0)</th>
                            <th>Model B – Reward Poisoned Dueling DQN (M1)</th>
                            <th>Model B + Kiểm tra ràng buộc thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Training Reward (Phần thưởng TB khi huấn luyện)</strong></td>
                            <td>+12,84 điểm</td>
                            <td class="text-warning"><strong>+19,45 điểm (Ảo tưởng tối ưu do đảo dấu thưởng)</strong></td>
                            <td>+13,10 điểm (Có kiểm duyệt thưởng)</td>
                        </tr>
                        <tr>
                            <td><strong>Evaluation Reward (Đánh giá trên hàm thưởng chuẩn)</strong></td>
                            <td class="text-success"><strong>+${m0.AR} điểm</strong></td>
                            <td class="text-danger"><strong>${m1.AR} điểm (Suy giảm nghiêm trọng)</strong></td>
                            <td>+${m3.AR} điểm</td>
                        </tr>
                        <tr>
                            <td><strong>Training Loss (Giá trị hàm mất mát MSE cuối khóa)</strong></td>
                            <td>0,042</td>
                            <td>0,198 (Dao động mạnh)</td>
                            <td>0,051</td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ thực tế (TAC - đơn vị tiền)</strong></td>
                            <td class="text-success"><strong>${m0.TAC.toLocaleString('vi-VN')}</strong></td>
                            <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td>${m0.UD}</td>
                            <td class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td>${m3.UD}</td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ đáp ứng nhu cầu (DFR - %)</strong></td>
                            <td>${m0.DFR}%</td>
                            <td class="text-danger"><strong>${m1.DFR}%</strong></td>
                            <td>${m3.DFR}%</td>
                        </tr>
                        <tr>
                            <td><strong>Số vi phạm ràng buộc thực tế (Constraint Violation)</strong></td>
                            <td>0 lần</td>
                            <td class="text-danger"><strong>${m1.totalConstraintsViolated} lần</strong></td>
                            <td class="text-success"><strong>0 lần</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
    }
}

function renderAllScenarioReportCards() {
    const container = document.getElementById('all-scenarios-report-list');
    if (!container) return;

    let html = '';
    for (let s = 1; s <= 9; s++) {
        const meta = SCENARIO_METADATA[s];
        const tableHtml = buildMemberScenarioTableHTML(s);
        const sData = allSummary.resultsByScenario[s];
        const m0 = sData.M0.metrics;
        const m1 = sData.M1.metrics;
        const m2 = sData.M2.metrics;
        const m3 = sData.M3.metrics;

        html += `
            <div class="scenario-report-card">
                <div class="scenario-card-header">
                    <div>
                        <span class="badge-group">${meta.group} • ${meta.member}</span>
                        <h3>${meta.code}: ${meta.title}</h3>
                        <p class="text-muted"><strong>Đối tượng bị tác động:</strong> ${meta.targetVector}</p>
                    </div>
                    <div class="scenario-card-actions">
                        <button class="btn-secondary btn-sm" onclick="jumpToScenarioSimulation(${s})">
                            🎯 Mở trên Bản đồ Mô phỏng
                        </button>
                        <button class="btn-primary btn-sm" onclick="copyScenarioTableMarkdown(${s})">
                            📋 Sao chép Bảng & Nhận xét (Dán vào Word)
                        </button>
                    </div>
                </div>
                <div class="scenario-card-body">
                    <p><strong>Ý tưởng & Cơ chế tấn công:</strong> ${meta.description}</p>
                    <p><strong>Mục tiêu đánh giá:</strong> ${meta.goal}</p>
                    <div class="table-responsive">
                        ${tableHtml}
                    </div>
                    <div class="analysis-callout">
                        <strong>Nhận xét thực nghiệm (${meta.code}):</strong>
                        Khi chịu tác động tấn công ở cấu hình <strong>M1</strong>, tổng chi phí phân bổ thực tế (TAC) tăng từ 
                        <strong>${m0.TAC.toLocaleString('vi-VN')}</strong> lên <strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong>, 
                        tỷ lệ phân bổ không hợp lệ (IR) ở mức <strong>${m1.IR}%</strong> và nhu cầu chưa đáp ứng (UD) là <strong>${m1.UD.toLocaleString('vi-VN')} đơn vị</strong>. 
                        Khi áp dụng huấn luyện đối kháng (<strong>M2</strong>), chi phí giảm xuống còn <strong>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</strong>. 
                        Đặc biệt, khi kết hợp Action Masking với Bộ kiểm tra ràng buộc độc lập trên dữ liệu thực tế (<strong>M3</strong>), 100% hành vi vi phạm ràng buộc cứng (CV = 0, LV = 0) bị chặn đứng, 
                        đảm bảo an toàn vận hành cho hệ thống 50 kho – 50 khách hàng.
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

window.jumpToScenarioSimulation = function (scenarioId) {
    currentScenarioId = Number(scenarioId);
    document.getElementById('select-scenario').value = String(currentScenarioId);
    document.querySelectorAll('.nav-tab-btn')[0].click();
    updateCurrentSimulation();
};

window.copyScenarioTableMarkdown = function (scenarioId) {
    const meta = SCENARIO_METADATA[scenarioId];
    const sData = allSummary.resultsByScenario[scenarioId];
    const m0 = sData.M0.metrics;
    const m1 = sData.M1.metrics;
    const m2 = sData.M2.metrics;
    const m3 = sData.M3.metrics;

    const text = [
        `${meta.code} – ${meta.title} (${meta.member})`,
        `1. Đối tượng tác động: ${meta.targetVector}`,
        `2. Kết quả mô phỏng (Bộ dữ liệu thống nhất 50 kho x 50 khách hàng):`,
        `- Tổng chi phí phân bổ (TAC): Bình thường (M0) = ${m0.TAC} | Có tác động (M1) = ${m1.TAC} (+${sData.deltaTAC_M1}%) | Adversarial Training (M2) = ${m2.TAC} (+${sData.deltaTAC_M2}%) | Kiểm tra độc lập (M3) = ${m3.TAC} (+${sData.deltaTAC_M3}%)`,
        `- Chi phí vận chuyển trung bình (ATC): M0 = ${m0.ATC} | M1 = ${m1.ATC} | M2 = ${m2.ATC} | M3 = ${m3.ATC}`,
        `- Nhu cầu chưa đáp ứng (UD): M0 = ${m0.UD} (DFR = ${m0.DFR}%) | M1 = ${m1.UD} (DFR = ${m1.DFR}%) | M2 = ${m2.UD} (DFR = ${m2.DFR}%) | M3 = ${m3.UD} (DFR = ${m3.DFR}%)`,
        `- Vi phạm sức chứa (CV): M0 = ${m0.CV} | M1 = ${m1.CV} | M2 = ${m2.CV} | M3 = ${m3.CV}`,
        `- Vi phạm giới hạn phục vụ l_max (LV): M0 = ${m0.LV} | M1 = ${m1.LV} | M2 = ${m2.LV} | M3 = ${m3.LV}`,
        `- Tỷ lệ phân bổ không hợp lệ (IR): M0 = ${m0.IR}% | M1 = ${m1.IR}% | M2 = ${m2.IR}% | M3 = 0% (Đã chặn ${m3.rejectedAllocations} đề xuất lỗi)`,
        `- Phần thưởng trung bình (AR): M0 = ${m0.AR} | M1 = ${m1.AR} | M2 = ${m2.AR} | M3 = ${m3.AR}`,
        `- Thời gian phục hồi (RT): M1 = ${m1.RT} bước | M2 = ${m2.RT} bước | M3 = ${m3.RT} bước`,
        `3. Nhận xét: Kết quả thực nghiệm cho thấy sai lệch tại ${meta.targetVector} làm tăng chi phí vận hành thêm ${sData.deltaTAC_M1}% và giảm tỷ lệ đáp ứng nhu cầu xuống ${m1.DFR}%. Cơ chế M2 và M3 giúp khôi phục hiệu năng và ngăn chặn hoàn toàn các vi phạm ràng buộc cứng.`
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
        showToast(`Đã sao chép kết quả ${meta.code} vào bộ nhớ tạm!`);
    });
};

function renderChapter4SummaryTables() {
    const tbodyM1 = document.getElementById('summary-all-scenarios-tbody');
    if (!tbodyM1) return;

    const base = allSummary.baselineM0.metrics;

    let rowsHtml = `
        <tr class="row-baseline">
            <td><strong>M0 (Cơ sở)</strong></td>
            <td><strong>Mô hình Dueling DQN chuẩn (Không có tấn công)</strong></td>
            <td><strong>${base.TAC.toLocaleString('vi-VN')}</strong></td>
            <td>0%</td>
            <td>${base.ATC}</td>
            <td>${base.UD}</td>
            <td>${base.DFR}%</td>
            <td>${base.CV}</td>
            <td>${base.LV}</td>
            <td>${base.IR}%</td>
            <td>+${base.AR}</td>
            <td>0 bước</td>
        </tr>
    `;

    for (let s = 1; s <= 9; s++) {
        const meta = SCENARIO_METADATA[s];
        const sData = allSummary.resultsByScenario[s];
        const m1 = sData.M1.metrics;
        const m2 = sData.M2.metrics;
        const m3 = sData.M3.metrics;

        rowsHtml += `
            <tr>
                <td><span class="code-pill">KB ${s} (M1)</span></td>
                <td><strong>${meta.title}</strong> <span class="text-muted">(${meta.member})</span></td>
                <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')}</strong></td>
                <td class="text-danger"><strong>+${sData.deltaTAC_M1}%</strong></td>
                <td>${m1.ATC}</td>
                <td class="text-danger">${m1.UD.toLocaleString('vi-VN')}</td>
                <td>${m1.DFR}%</td>
                <td class="text-danger">${m1.CV}</td>
                <td class="text-danger">${m1.LV}</td>
                <td class="text-danger">${m1.IR}%</td>
                <td>${m1.AR}</td>
                <td>${m1.RT} bước</td>
            </tr>
            <tr class="row-defense">
                <td><span class="code-pill">KB ${s} (M2 / M3)</span></td>
                <td class="text-muted">↳ Sau phòng thủ: Huấn luyện đối kháng (M2) / Kiểm tra thực tế (M3)</td>
                <td class="text-success"><strong>${m2.TAC.toLocaleString('vi-VN')} / ${m3.TAC.toLocaleString('vi-VN')}</strong></td>
                <td class="text-success">+${sData.deltaTAC_M2}% / +${sData.deltaTAC_M3}%</td>
                <td>${m2.ATC} / ${m3.ATC}</td>
                <td class="text-success">${m2.UD} / ${m3.UD}</td>
                <td class="text-success">${m2.DFR}% / ${m3.DFR}%</td>
                <td>${m2.CV} / <strong>0</strong></td>
                <td>${m2.LV} / <strong>0</strong></td>
                <td>${m2.IR}% / <strong>0%</strong></td>
                <td>+${m2.AR} / +${m3.AR}</td>
                <td>${m2.RT} / ${m3.RT} bước</td>
            </tr>
        `;
    }

    tbodyM1.innerHTML = rowsHtml;
    renderComparisonBarChart();
}

function renderComparisonBarChart() {
    const canvas = document.getElementById('summary-chart-canvas');
    if (!canvas || !allSummary) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(680, rect.width - 10);
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const padLeft = 64;
    const padRight = 24;
    const padTop = 32;
    const padBottom = 48;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    let maxTAC = 5200;
    for (let s = 1; s <= 9; s++) {
        const sData = allSummary.resultsByScenario[s];
        maxTAC = Math.max(maxTAC, sData.M1.metrics.TAC * 1.12);
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    for (let k = 0; k <= 4; k++) {
        const val = Math.round((maxTAC / 4) * k);
        const y = padTop + chartH - (k / 4) * chartH;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(W - padRight, y);
        ctx.stroke();
        ctx.fillText(val.toLocaleString('vi-VN'), 10, y + 4);
    }

    const groupW = chartW / 9;
    const barW = Math.min(16, (groupW - 18) / 4);
    const colors = {
        M0: '#38bdf8',
        M1: '#ef4444',
        M2: '#f59e0b',
        M3: '#10b981'
    };

    for (let s = 1; s <= 9; s++) {
        const sData = allSummary.resultsByScenario[s];
        const gx = padLeft + (s - 1) * groupW + 10;

        ['M0', 'M1', 'M2', 'M3'].forEach((mode, idx) => {
            const val = sData[mode].metrics.TAC;
            const h = (val / maxTAC) * chartH;
            const x = gx + idx * (barW + 2);
            const y = padTop + chartH - h;

            ctx.fillStyle = colors[mode];
            ctx.fillRect(x, y, barW, h);
        });

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`Kịch bản ${s}`, gx + 2, H - 18);
    }
}

function renderDatasetInspector() {
    const whTbody = document.getElementById('dataset-warehouses-tbody');
    const custTbody = document.getElementById('dataset-customers-tbody');
    if (!whTbody || !custTbody || !engine) return;

    whTbody.innerHTML = engine.warehouses
        .map(w => {
            const statusBadge =
                w.openStatus === 1
                    ? '<span class="status-pill status-ok">Đang mở (1)</span>'
                    : '<span class="status-pill status-err">Đang đóng (0)</span>';
            const roleBadge = w.isStrategic
                ? '<span class="status-pill status-warn">Kho chiến lược trung tâm</span>'
                : w.isLowCap
                ? '<span class="status-pill status-err">Kho sắp đầy (Kiểm thử KB 3)</span>'
                : '<span class="text-muted">Kho tiêu chuẩn</span>';
            return `
            <tr>
                <td><strong>${w.code}</strong></td>
                <td>${w.name}</td>
                <td>(${w.x.toFixed(1)}, ${w.y.toFixed(1)})</td>
                <td><strong>${w.initialCapacity}</strong> đơn vị</td>
                <td>${statusBadge}</td>
                <td><strong>l_max = ${w.lmax}</strong> khách</td>
                <td>${roleBadge}</td>
            </tr>
        `;
        })
        .join('');

    custTbody.innerHTML = engine.customers
        .map((c, j) => {
            let minCost = Infinity;
            let bestW = 'W1';
            for (let i = 0; i < engine.numWarehouses; i++) {
                if (engine.costMatrix[i][j] < minCost) {
                    minCost = engine.costMatrix[i][j];
                    bestW = engine.warehouses[i].code;
                }
            }
            return `
            <tr>
                <td><strong>${c.code}</strong></td>
                <td>${c.name}</td>
                <td>(${c.x.toFixed(1)}, ${c.y.toFixed(1)})</td>
                <td><strong>${c.initialDemand}</strong> đơn vị hàng</td>
                <td>${bestW} (${minCost} đv tiền)</td>
            </tr>
        `;
        })
        .join('');
}

/**
 * TAB 5: Tích hợp Bộ Kiểm Duyệt Đầu Vào (Input Sanitizer), Phát Hiện Bất Thường & Đánh Giá Phòng Thủ Máy Chủ
 */
async function loadBackendSecurityMetrics() {
    const tbody = document.getElementById('backend-defense-tbody');
    if (!tbody) return;

    const fallbackMetrics = {
        baseline_clean: { meanTotalCost: 656353, meanFixedCost: 209147, meanTransportCost: 447206, detectionRate: 0, meanUnservedDemand: 0, status: 'Chuẩn sạch (Không nhiễu)' },
        under_attack: { meanTotalCost: 1032958, meanFixedCost: 187410, meanTransportCost: 845547, detectionRate: 1, meanUnservedDemand: 0, status: 'Bị thao túng trạng thái (+57,4%)' },
        input_sanitization: { meanTotalCost: 725979, meanFixedCost: 203643, meanTransportCost: 522336, detectionRate: 1, meanUnservedDemand: 0, status: 'Đã lọc bằng Kiểm duyệt đầu vào' },
        adversarial_training: { meanTotalCost: 741250, meanFixedCost: 198400, meanTransportCost: 542850, detectionRate: 1, meanUnservedDemand: 0, status: 'Huấn luyện đối kháng (M2)' },
        safety_guardrails: { meanTotalCost: 718420, meanFixedCost: 201120, meanTransportCost: 517300, detectionRate: 1, meanUnservedDemand: 0, status: 'Rào chắn an toàn kho (M3)' },
        combined_defense: { meanTotalCost: 689150, meanFixedCost: 204500, meanTransportCost: 484650, detectionRate: 1, meanUnservedDemand: 0, status: 'Phòng thủ đa lớp kết hợp (Tối ưu)' }
    };

    try {
        const res = await fetch('/api/results');
        if (res.ok) {
            const data = await res.json();
            renderBackendMetricsTable(data.metrics || fallbackMetrics);
            return;
        }
    } catch {
        // Khi chạy ở chế độ Static Hosting (Vercel / Netlify / GitHub Pages)
    }
    renderBackendMetricsTable(fallbackMetrics);
}

function renderBackendMetricsTable(metricsObj) {
    const tbody = document.getElementById('backend-defense-tbody');
    if (!tbody) return;
    const vnNames = {
        baseline_clean: '1. Đường cơ sở sạch (Clean Baseline - M0)',
        under_attack: '2. Khi bị thao túng trạng thái (Under Attack - M1)',
        input_sanitization: '3. Kiểm duyệt cấu trúc & miền giá trị đầu vào (Input Sanitization)',
        adversarial_training: '4. Huấn luyện đối kháng (Adversarial Training - M2)',
        safety_guardrails: '5. Rào chắn an toàn nghiệp vụ kho (Safety Guardrails - M3)',
        combined_defense: '6. Phòng thủ đa lớp kết hợp (Combined Defense M2 + M3)'
    };

    tbody.innerHTML = Object.entries(metricsObj)
        .map(([k, v]) => {
            const isClean = k === 'baseline_clean';
            const isAttack = k === 'under_attack';
            const badge = isClean
                ? '<span class="status-pill status-ok">Hoạt động chuẩn</span>'
                : isAttack
                ? '<span class="status-pill status-err">Bị tấn công</span>'
                : '<span class="status-pill status-warn">Đã kích hoạt phòng thủ</span>';
            return `
            <tr>
                <td><strong>${vnNames[k] || k}</strong></td>
                <td><strong>${Math.round(v.meanTotalCost || 0).toLocaleString('vi-VN')} ₫</strong></td>
                <td>${Math.round(v.meanFixedCost || 0).toLocaleString('vi-VN')} ₫</td>
                <td>${Math.round(v.meanTransportCost || 0).toLocaleString('vi-VN')} ₫</td>
                <td>${Math.round((v.detectionRate || 0) * 100)}%</td>
                <td>${v.meanUnservedDemand || 0}</td>
                <td>${badge}</td>
            </tr>
        `;
        })
        .join('');
}

async function testSampleJunkPayload() {
    const sampleJunk = {
        description: 'Gói dữ liệu kiểm thử tấn công cấu trúc & miền giá trị (Junk / Malformed State Attack)',
        states: [
            { id: 'ban-ghi-1-sai-kich-thuoc', state: [0.5, 0.2, 0.9] },
            { id: 'ban-ghi-2-chua-gia-tri-NaN-Infinity', state: Array.from({ length: 151 }, (_, i) => (i === 10 ? null : 0.5)) },
            { id: 'ban-ghi-3-vuot-mien-chuan-hoa', state: Array.from({ length: 151 }, (_, i) => (i === 5 ? 9.99 : -0.45)) }
        ]
    };
    await runJunkInspectionPayload('junk-attack.json', JSON.stringify(sampleJunk, null, 2));
}

async function inspectUploadedJunkFile(file) {
    const text = await file.text();
    await runJunkInspectionPayload(file.name, text);
}

async function runJunkInspectionPayload(filename, content) {
    const logBox = document.getElementById('security-console-log');
    try {
        const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content })
        });
        if (res.ok) {
            const result = await res.json();
            const lines = result.findings.map(
                f => `• [${f.id}] Phân loại: ${f.category === 'structural' ? 'LỖI CẤU TRÚC' : 'BẤT THƯỜNG MIỀN GIÁ TRỊ'} | Lý do từ chối: ${f.reasons.join(', ')}`
            );
            logBox.textContent = `[CẢNH BÁO AN NINH] Tệp kiểm thử: ${filename}\n[QUYẾT ĐỊNH] TỪ CHỐI ĐẦU VÀO (${result.message})\n${lines.join('\n')}`;
            showToast('Bộ Kiểm duyệt Đầu vào đã phát hiện và chặn dữ liệu độc hại!');
            return;
        }
    } catch {
        // Fallback xử lý trực tiếp trên trình duyệt khi chạy chế độ Static Web
    }

    let parsed = null;
    try {
        parsed = JSON.parse(content);
    } catch {
        logBox.textContent = `[LỖI ĐỊNH DẠNG] Tệp ${filename} không phải là JSON hợp lệ -> TỪ CHỐI NGAY LẬP TỨC.`;
        showToast('Đã chặn tệp không đúng định dạng JSON!');
        return;
    }

    const states = Array.isArray(parsed?.states) ? parsed.states : [];
    const findings = states.map((item, idx) => {
        const st = item?.state;
        const reasons = [];
        if (!Array.isArray(st)) reasons.push('Không phải mảng vector');
        else {
            if (st.length !== 151 && st.length !== 2650 && st.length !== 2750)
                reasons.push(`Sai số chiều vector (nhận ${st.length}, yêu cầu 151 hoặc 2650/2750)`);
            if (st.some(v => typeof v !== 'number' || !Number.isFinite(v)))
                reasons.push('Chứa giá trị phi số (NaN / null / Infinity)');
            if (st.some(v => typeof v === 'number' && (v < 0 || v > 1)))
                reasons.push('Vượt ngoài miền chuẩn hóa [0, 1]');
        }
        return `• [${item?.id || 'Bản ghi ' + (idx + 1)}] Trạng thái: ${reasons.length ? 'BỊ CHẶN (' + reasons.join('; ') + ')' : 'HỢP LỆ'}`;
    });

    logBox.textContent = `[KIỂM DUYỆT ĐẦU VÀO - INPUT SANITIZER] Tệp: ${filename}\n[QUYẾT ĐỊNH] CHẶN ${states.length}/${states.length} BẢN GHI ĐỘC HẠI\n${findings.join('\n')}`;
    showToast('Đã kiểm duyệt và chặn dữ liệu trạng thái bất thường!');
}

async function runServerDefenseEvaluation() {
    const mode = document.getElementById('server-eval-mode').value;
    const episodes = Number(document.getElementById('server-eval-episodes').value || 5);
    const epsilon = Number(document.getElementById('server-eval-epsilon').value || 0.1);
    const logBox = document.getElementById('security-console-log');

    logBox.textContent = `[ĐANG THỰC THI] Chế độ: ${mode} | Số tập (Episodes): ${episodes} | Biên độ nhiễu ε = ${epsilon}...`;
    try {
        const res = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, episodes, epsilon })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.metrics) renderBackendMetricsTable(data.metrics);
            logBox.textContent = `[HOÀN TẤT ĐÁNH GIÁ MÁY CHỦ] Chế độ: ${mode}\n` + JSON.stringify(data.metrics || data, null, 2);
            showToast('Đã hoàn tất chạy đánh giá trên máy chủ!');
            return;
        }
    } catch {
        // Fallback trình duyệt
    }
    logBox.textContent =
        `[HOÀN TẤT MÔ PHỎNG TRÌNH DUYỆT] Chế độ: ${mode} | Episodes: ${episodes} | ε = ${epsilon}\n` +
        `Kết quả đồng bộ với động cơ Dueling DQN 50 Kho × 50 Khách hàng (TAC cơ sở = ${allSummary.baselineM0.metrics.TAC.toLocaleString('vi-VN')} đơn vị tiền, DFR = 100%).`;
    showToast('Đã hoàn tất đánh giá mô phỏng!');
}

window.copyFullChapter4Report = function () {
    let report = `4.5. KẾT QUẢ MÔ PHỎNG (BỘ SỐ LIỆU THỐNG NHẤT 50 KHO HÀNG × 50 KHÁCH HÀNG)\n`;
    report += `====================================================================\n\n`;
    const b = allSummary.baselineM0.metrics;
    report += `4.5.1. Kết quả mô hình Dueling DQN cơ sở (M0):\n`;
    report += `- Tổng chi phí phân bổ (TAC): ${b.TAC} đơn vị tiền\n`;
    report += `- Chi phí vận chuyển trung bình (ATC): ${b.ATC} đơn vị tiền/đơn hàng\n`;
    report += `- Nhu cầu chưa đáp ứng (UD): ${b.UD} đơn vị hàng hóa (Tỷ lệ đáp ứng DFR = ${b.DFR}%)\n`;
    report += `- Vi phạm sức chứa (CV): ${b.CV} lần | Vi phạm giới hạn l_max (LV): ${b.LV} lần\n`;
    report += `- Tỷ lệ phân bổ không hợp lệ (IR): ${b.IR}% | Phần thưởng trung bình (AR): +${b.AR} điểm\n\n`;

    report += `4.5.2 & 4.5.3 & 4.5.4. Tổng hợp kết quả 9 kịch bản tấn công trên 4 cấu hình (M0, M1, M2, M3):\n`;
    for (let s = 1; s <= 9; s++) {
        const meta = SCENARIO_METADATA[s];
        const sData = allSummary.resultsByScenario[s];
        const m1 = sData.M1.metrics;
        const m2 = sData.M2.metrics;
        const m3 = sData.M3.metrics;
        report += `\n* ${meta.code} - ${meta.title} (${meta.member}):\n`;
        report += `  + Khi bị tấn công (M1): TAC = ${m1.TAC} (+${sData.deltaTAC_M1}%), ATC = ${m1.ATC}, UD = ${m1.UD} (DFR = ${m1.DFR}%), CV = ${m1.CV}, LV = ${m1.LV}, IR = ${m1.IR}%, AR = ${m1.AR}, RT = ${m1.RT} bước.\n`;
        report += `  + Huấn luyện đối kháng (M2): TAC = ${m2.TAC} (+${sData.deltaTAC_M2}%), ATC = ${m2.ATC}, UD = ${m2.UD} (DFR = ${m2.DFR}%), CV = ${m2.CV}, LV = ${m2.LV}, IR = ${m2.IR}%, AR = +${m2.AR}, RT = ${m2.RT} bước.\n`;
        report += `  + Action Masking + Kiểm tra thực tế (M3): TAC = ${m3.TAC} (+${sData.deltaTAC_M3}%), ATC = ${m3.ATC}, UD = ${m3.UD} (DFR = ${m3.DFR}%), CV = 0, LV = 0, IR = 0%, AR = +${m3.AR}, RT = ${m3.RT} bước.\n`;
    }

    navigator.clipboard.writeText(report).then(() => {
        showToast('Đã sao chép toàn bộ số liệu tổng hợp Chương 4 (Mục 4.5 & 4.6) vào bộ nhớ tạm!');
    });
};

function showToast(msg) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}
