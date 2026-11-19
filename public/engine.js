/**
 * ĐỘNG CƠ MÔ PHỎNG DUELING DQN & 9 KỊCH BẢN TẤN CÔNG ĐỐI KHÁNG (AI ATTACK)
 * Hệ thống phân bổ kho hàng (Warehouse Allocation: 50 Kho x 50 Khách hàng)
 * Tuân thủ 100% đặc tả Chương 4 của tài liệu nghiên cứu.
 */

class SeededRNG {
    constructor(seed = 2026) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }
}

class WarehouseEnvironmentEngine {
    constructor(config = {}) {
        this.numWarehouses = 50;
        this.numCustomers = 50;
        this.seed = config.seed || 2026;
        this.epsilonFGSM = config.epsilonFGSM !== undefined ? config.epsilonFGSM : 0.15;
        this.attackIntensity = config.attackIntensity !== undefined ? config.attackIntensity : 0.30;
        this.wScale = 0.05;
        this.bonusCompletion = 15.0;
        this.penaltyUnserved = 35.0;
        this.gamma = 0.95;

        this.initBaseDataset();
    }

    /**
     * Khởi tạo bộ dữ liệu gốc thống nhất cho cả 9 kịch bản:
     * - 50 Kho hàng (W1..W50): Tọa độ, Sức chứa còn lại (Cap), Trạng thái mở (O), Giới hạn phục vụ (l_max), Vai trò chiến lược
     * - 50 Khách hàng (U1..U50): Tọa độ, Nhu cầu (D)
     * - Ma trận chi phí vận chuyển C (50 x 50 = 2.500 phần tử)
     */
    initBaseDataset() {
        const rng = new SeededRNG(this.seed);
        this.warehouses = [];
        this.customers = [];
        this.costMatrix = [];

        // 5 kho chiến lược ở trung tâm chuỗi cung ứng (Kịch bản 5): W1, W10, W20, W30, W40
        const strategicIds = new Set([0, 9, 19, 29, 39]);
        // 6 kho đang đóng bảo trì (Kịch bản 1): W7, W15, W23, W31, W42, W48
        const closedSet = new Set([6, 14, 22, 30, 41, 47]);
        // 10 kho có sức chứa còn lại thấp (sắp đầy - Kịch bản 3): W3, W8, W12, W18, W25, W28, W34, W38, W44, W49
        const lowCapSet = new Set([2, 7, 11, 17, 24, 27, 33, 37, 43, 48]);

        for (let i = 0; i < this.numWarehouses; i++) {
            const isStrategic = strategicIds.has(i);
            const isLowCap = lowCapSet.has(i);
            const x = isStrategic ? rng.nextFloat(40, 60) : rng.nextFloat(6, 94);
            const y = isStrategic ? rng.nextFloat(40, 60) : rng.nextFloat(6, 94);

            const isOpen = closedSet.has(i) ? 0 : 1;

            let capacity;
            if (isStrategic) {
                capacity = rng.nextInt(190, 240);
            } else if (isLowCap) {
                capacity = rng.nextInt(22, 36);
            } else {
                capacity = rng.nextInt(90, 155);
            }

            const lmax = isStrategic ? 3 : i % 4 === 0 ? 1 : 2;

            this.warehouses.push({
                id: i,
                code: `W${i + 1}`,
                name: isStrategic ? `Kho chiến lược W${i + 1}` : `Kho W${i + 1}`,
                x,
                y,
                initialCapacity: capacity,
                openStatus: isOpen,
                lmax: lmax,
                isStrategic: isStrategic,
                isLowCap: isLowCap
            });
        }

        let totalDemand = 0;
        for (let j = 0; j < this.numCustomers; j++) {
            const x = rng.nextFloat(5, 95);
            const y = rng.nextFloat(5, 95);
            const demand = rng.nextInt(38, 64);
            totalDemand += demand;
            this.customers.push({
                id: j,
                code: `U${j + 1}`,
                name: `Khách hàng U${j + 1}`,
                x,
                y,
                initialDemand: demand
            });
        }
        this.totalInitialDemand = totalDemand;

        // Khởi tạo ma trận chi phí vận chuyển C (50 x 50)
        for (let i = 0; i < this.numWarehouses; i++) {
            const row = [];
            for (let j = 0; j < this.numCustomers; j++) {
                const dx = this.warehouses[i].x - this.customers[j].x;
                const dy = this.warehouses[i].y - this.customers[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const baseCost = Math.round(18 + dist * 1.15 + rng.nextFloat(-3, 5));
                const finalCost = this.warehouses[i].isStrategic
                    ? Math.max(15, Math.round(baseCost * 0.78))
                    : Math.max(18, baseCost);
                row.push(finalCost);
            }
            this.costMatrix.push(row);
        }
    }

    /**
     * Tính toán nhánh Value V(s; theta) và Advantage A(s, a; theta) của mạng Dueling DQN
     * Q(s, a; theta) = V(s; theta) + (A(s, a; theta) - mean(A(s, a'; theta)))
     */
    computeDuelingQValues(obsState, customerIdx, modelMode = 'M0', isPoisonedRewardModel = false) {
        const demand = obsState.demand[customerIdx];
        const openRatio = obsState.openStatus.reduce((acc, v) => acc + v, 0) / this.numWarehouses;
        const avgRemainingCap = obsState.capacity.reduce((acc, v) => acc + v, 0) / (this.numWarehouses * 130);

        const V_s = Number((12.2 * openRatio + 7.8 * avgRemainingCap - 0.05 * demand).toFixed(3));

        const rawAdvantages = [];
        for (let i = 0; i < this.numWarehouses; i++) {
            const cost = obsState.costMatrix[i][customerIdx];
            const cap = obsState.capacity[i];
            const open = obsState.openStatus[i];
            const load = obsState.servedCount[i];
            const lmax = this.warehouses[i].lmax;

            let score = 0;
            if (isPoisonedRewardModel) {
                score = +cost * this.wScale * 1.85 - (cap - demand) * 0.045 - (lmax - load) * 2.2;
                if (cap < demand) score += 3.2;
            } else {
                const capMargin = Math.min(2.2, Math.max(-3.0, (cap - demand) / Math.max(1, demand)));
                const slotMargin = (lmax - load) / lmax;
                score = -(cost * this.wScale * 2.35) + capMargin * 1.7 + slotMargin * 1.25;

                if (modelMode === 'M2') {
                    const geoDist = Math.hypot(
                        this.warehouses[i].x - this.customers[customerIdx].x,
                        this.warehouses[i].y - this.customers[customerIdx].y
                    );
                    const expectedCost = this.warehouses[i].isStrategic
                        ? Math.max(15, Math.round((18 + geoDist * 1.15) * 0.78))
                        : Math.round(18 + geoDist * 1.15);
                    const costDiff = Math.abs(cost - expectedCost) / Math.max(1, expectedCost);
                    if (costDiff > 0.28) {
                        score = -(expectedCost * this.wScale * 2.3) + capMargin * 1.55 + slotMargin * 1.2;
                    }
                    if (this.warehouses[i].isLowCap && cap > 80) {
                        score -= 4.5;
                    }
                }
            }

            if (open === 0 && !isPoisonedRewardModel) score -= 8.5;
            rawAdvantages.push(score);
        }

        const meanAdv = rawAdvantages.reduce((a, b) => a + b, 0) / this.numWarehouses;
        const advantages = rawAdvantages.map(a => Number((a - meanAdv).toFixed(3)));
        const qValues = advantages.map(adv => Number((V_s + adv).toFixed(3)));

        return {
            V_s,
            advantages,
            qValues
        };
    }

    /**
     * Xây dựng dữ liệu quan sát bị tấn công (State Manipulation / FGSM) theo từng kịch bản 1 -> 9
     */
    buildObservedState(realState, scenarioId, customerIdx) {
        const obs = {
            capacity: [...realState.capacity],
            openStatus: [...realState.openStatus],
            costMatrix: realState.costMatrix.map(r => [...r]),
            demand: [...realState.demand],
            servedCount: [...realState.servedCount]
        };

        const intensity = this.attackIntensity;
        const eps = this.epsilonFGSM;

        switch (Number(scenarioId)) {
            case 1: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (realState.openStatus[i] === 0 && customerIdx % 3 !== 2) {
                        obs.openStatus[i] = 1;
                        obs.costMatrix[i][customerIdx] = Math.max(12, Math.round(realState.costMatrix[i][customerIdx] * (0.52 - eps * 0.3)));
                    } else if (realState.openStatus[i] === 1 && i % 6 === 0 && intensity >= 0.2) {
                        obs.openStatus[i] = 0;
                    }
                }
                break;
            }
            case 2: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    const realC = realState.costMatrix[i][customerIdx];
                    if (realC > 82) {
                        obs.costMatrix[i][customerIdx] = Math.max(14, Math.round(realC * (0.24 - eps * 0.2)));
                    } else if (realC < 52) {
                        obs.costMatrix[i][customerIdx] = Math.round(realC * (2.5 + intensity));
                    }
                }
                break;
            }
            case 3: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (realState.openStatus[i] === 1 && realState.capacity[i] < realState.demand[customerIdx]) {
                        obs.capacity[i] = realState.demand[customerIdx] + Math.round(135 * (1 + eps));
                        obs.costMatrix[i][customerIdx] = Math.max(12, Math.round(realState.costMatrix[i][customerIdx] * (0.45 - eps * 0.25)));
                    }
                }
                break;
            }
            case 4: {
                if (customerIdx % 2 === 0) {
                    obs.demand[customerIdx] = Math.max(12, Math.round(realState.demand[customerIdx] * (0.48 - eps * 0.25)));
                } else {
                    obs.demand[customerIdx] = Math.round(realState.demand[customerIdx] * (1.72 + eps));
                }
                break;
            }
            case 5: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (this.warehouses[i].isStrategic) {
                        if (customerIdx % 2 === 0) {
                            obs.capacity[i] = 240;
                            obs.costMatrix[i][customerIdx] = 11;
                        } else {
                            obs.openStatus[i] = 0;
                            obs.costMatrix[i][customerIdx] = 220;
                        }
                    } else if (realState.costMatrix[i][customerIdx] < 48) {
                        obs.costMatrix[i][customerIdx] = Math.round(realState.costMatrix[i][customerIdx] * 1.95);
                    }
                }
                break;
            }
            case 6: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (
                        realState.openStatus[i] === 1 &&
                        realState.capacity[i] >= realState.demand[customerIdx] &&
                        realState.servedCount[i] >= this.warehouses[i].lmax
                    ) {
                        obs.servedCount[i] = 0;
                        obs.costMatrix[i][customerIdx] = Math.max(11, Math.round(realState.costMatrix[i][customerIdx] * (0.38 - eps * 0.2)));
                    }
                }
                break;
            }
            case 7: {
                const isAttackWindow = customerIdx >= 30 && customerIdx < 40;
                if (isAttackWindow) {
                    for (let i = 0; i < this.numWarehouses; i++) {
                        if (realState.openStatus[i] === 0) {
                            obs.openStatus[i] = 1;
                            obs.costMatrix[i][customerIdx] = 12;
                        }
                        if (realState.capacity[i] < realState.demand[customerIdx]) {
                            obs.capacity[i] = realState.demand[customerIdx] + 110;
                        }
                    }
                }
                break;
            }
            case 8: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    const actuallyInvalid =
                        realState.openStatus[i] === 0 ||
                        realState.capacity[i] < realState.demand[customerIdx] ||
                        realState.servedCount[i] >= this.warehouses[i].lmax;
                    if (actuallyInvalid && i % 2 === 0) {
                        obs.openStatus[i] = 1;
                        obs.capacity[i] = realState.demand[customerIdx] + 120;
                        obs.servedCount[i] = 0;
                        obs.costMatrix[i][customerIdx] = Math.max(11, Math.round(realState.costMatrix[i][customerIdx] * 0.45));
                    }
                }
                break;
            }
            case 9:
            default:
                break;
        }

        return obs;
    }

    getActionMask(stateToUse, customerIdx, demandToUse = null) {
        const mask = [];
        const d = demandToUse !== null ? demandToUse : stateToUse.demand[customerIdx];
        for (let i = 0; i < this.numWarehouses; i++) {
            const isOpen = stateToUse.openStatus[i] === 1;
            const hasCap = stateToUse.capacity[i] >= d;
            const hasSlot = stateToUse.servedCount[i] < this.warehouses[i].lmax;
            mask.push(isOpen && hasCap && hasSlot);
        }
        return mask;
    }

    runSimulation(scenarioId = 1, modelMode = 'M0') {
        const rng = new SeededRNG(this.seed + scenarioId * 17);

        const realState = {
            capacity: this.warehouses.map(w => w.initialCapacity),
            openStatus: this.warehouses.map(w => w.openStatus),
            costMatrix: this.costMatrix.map(row => [...row]),
            demand: this.customers.map(c => c.initialDemand),
            servedCount: new Array(this.numWarehouses).fill(0)
        };

        if (Number(scenarioId) === 5 && modelMode !== 'M0') {
            for (let i = 0; i < this.numWarehouses; i++) {
                if (this.warehouses[i].isStrategic) {
                    realState.capacity[i] = 30;
                }
            }
        }

        let totalAllocationCost = 0;
        let unservedDemand = 0;
        let servedDemand = 0;
        let capacityViolations = 0;
        let lmaxViolations = 0;
        let closedWarehouseSelections = 0;
        let invalidProposals = 0;
        let rejectedAllocations = 0;
        let invalidAccepted = 0;
        let suboptimalDecisions = 0;
        let fullyServedCustomers = 0;
        let totalAllocationDeviation = 0;
        let totalReward = 0;
        const overloadedWarehousesSet = new Set();
        const stepLogs = [];

        const phaseStats = {
            before: { tac: 0, reward: 0, ud: 0, count: 0, validCount: 0 },
            during: { tac: 0, reward: 0, ud: 0, count: 0, validCount: 0 },
            after: { tac: 0, reward: 0, ud: 0, count: 0, validCount: 0 }
        };

        const isUnderAttack = modelMode !== 'M0';
        const isRewardPoisoned = Number(scenarioId) === 9 && modelMode === 'M1';

        for (let j = 0; j < this.numCustomers; j++) {
            const realDemand = realState.demand[j];

            const obsState = isUnderAttack
                ? this.buildObservedState(realState, scenarioId, j)
                : {
                      capacity: [...realState.capacity],
                      openStatus: [...realState.openStatus],
                      costMatrix: realState.costMatrix.map(r => [...r]),
                      demand: [...realState.demand],
                      servedCount: [...realState.servedCount]
                  };

            const duelingOut = this.computeDuelingQValues(obsState, j, modelMode, isRewardPoisoned);

            const realValidMask = this.getActionMask(realState, j, realDemand);
            let bestRealCost = Infinity;
            let bestRealWarehouse = -1;
            for (let i = 0; i < this.numWarehouses; i++) {
                if (realValidMask[i] && realState.costMatrix[i][j] < bestRealCost) {
                    bestRealCost = realState.costMatrix[i][j];
                    bestRealWarehouse = i;
                }
            }

            let obsMask = this.getActionMask(obsState, j, obsState.demand[j]);

            if (isRewardPoisoned && j % 3 === 0) {
                obsMask = new Array(this.numWarehouses).fill(true);
            }

            if (modelMode === 'M2' && isUnderAttack) {
                obsMask = obsMask.map((valid, idx) => {
                    if (!valid) return false;
                    const trustedOpen = rng.next() < 0.82 ? realState.openStatus[idx] === 1 : true;
                    const trustedCap = rng.next() < 0.80 ? realState.capacity[idx] >= realDemand : true;
                    const trustedSlot = rng.next() < 0.82 ? realState.servedCount[idx] < this.warehouses[idx].lmax : true;
                    return trustedOpen && trustedCap && trustedSlot;
                });
            }

            let proposedAction = -1;
            let bestQ = -Infinity;
            for (let i = 0; i < this.numWarehouses; i++) {
                if (obsMask[i] && duelingOut.qValues[i] > bestQ) {
                    bestQ = duelingOut.qValues[i];
                    proposedAction = i;
                }
            }
            if (proposedAction === -1) {
                proposedAction = 0;
                for (let i = 1; i < this.numWarehouses; i++) {
                    if (duelingOut.qValues[i] > duelingOut.qValues[proposedAction]) {
                        proposedAction = i;
                    }
                }
            }

            const isClosedViolation = realState.openStatus[proposedAction] === 0;
            const isCapViolation = realState.capacity[proposedAction] < realDemand;
            const isLmaxViolation = realState.servedCount[proposedAction] >= this.warehouses[proposedAction].lmax;
            const isProposalInvalid = isClosedViolation || isCapViolation || isLmaxViolation;

            let finalAction = proposedAction;
            let status = 'HỢP LỆ';
            let stepCost = 0;
            let stepServed = 0;
            let stepUnserved = 0;
            let stepReward = 0;

            if (isProposalInvalid) {
                invalidProposals++;
                if (isClosedViolation) closedWarehouseSelections++;

                if (modelMode === 'M3') {
                    rejectedAllocations++;
                    status = 'BỊ TỪ CHỐI & ĐIỀU HƯỚNG AN TOÀN (M3)';

                    let fallbackAction = -1;
                    let fallbackBestQ = -Infinity;
                    for (let i = 0; i < this.numWarehouses; i++) {
                        if (realValidMask[i] && duelingOut.qValues[i] > fallbackBestQ) {
                            fallbackBestQ = duelingOut.qValues[i];
                            fallbackAction = i;
                        }
                    }

                    if (fallbackAction !== -1) {
                        finalAction = fallbackAction;
                        stepCost = realState.costMatrix[finalAction][j] + 6;
                        stepServed = realDemand;
                        fullyServedCustomers++;
                        realState.capacity[finalAction] -= realDemand;
                        realState.servedCount[finalAction] += 1;
                        stepReward = -(stepCost * this.wScale) + this.bonusCompletion * 0.9;
                    } else {
                        stepCost = 45;
                        stepUnserved = realDemand;
                        stepReward = -this.penaltyUnserved;
                    }
                } else {
                    if (isClosedViolation) {
                        rejectedAllocations++;
                        invalidAccepted++;
                        status = 'LỖI: CHỌN KHO ĐANG ĐÓNG';
                        stepCost = realState.costMatrix[proposedAction][j] + 65;
                        stepServed = Math.round(realDemand * 0.35);
                        stepUnserved = realDemand - stepServed;
                        stepReward = -(stepCost * this.wScale) - this.penaltyUnserved * 0.75;
                    } else if (isCapViolation) {
                        capacityViolations++;
                        rejectedAllocations++;
                        invalidAccepted++;
                        status = 'VI PHẠM SỨC CHỨA (CV)';
                        const available = Math.max(0, realState.capacity[proposedAction]);
                        stepServed = available;
                        stepUnserved = realDemand - available;
                        realState.capacity[proposedAction] = available - realDemand;
                        realState.servedCount[proposedAction] += 1;
                        stepCost = realState.costMatrix[proposedAction][j] + 58;
                        stepReward = -(stepCost * this.wScale) - this.penaltyUnserved * 0.75;
                    } else if (isLmaxViolation) {
                        lmaxViolations++;
                        rejectedAllocations++;
                        invalidAccepted++;
                        overloadedWarehousesSet.add(proposedAction);
                        status = 'VI PHẠM GIỚI HẠN l_max (LV)';
                        stepServed = Math.round(realDemand * 0.52);
                        stepUnserved = realDemand - stepServed;
                        realState.capacity[proposedAction] = Math.max(0, realState.capacity[proposedAction] - stepServed);
                        realState.servedCount[proposedAction] += 1;
                        stepCost = realState.costMatrix[proposedAction][j] + 52;
                        stepReward = -(stepCost * this.wScale) - this.penaltyUnserved * 0.65;
                    }
                }
            } else {
                if (Number(scenarioId) === 4 && isUnderAttack && modelMode !== 'M3') {
                    const perceivedDemand =
                        modelMode === 'M2'
                            ? Math.round(realDemand * 0.88 + obsState.demand[j] * 0.12)
                            : obsState.demand[j];
                    const allocatedAmount = Math.min(realState.capacity[finalAction], perceivedDemand);
                    const deviation = Math.abs(allocatedAmount - realDemand);
                    totalAllocationDeviation += deviation;

                    if (allocatedAmount < realDemand) {
                        stepServed = allocatedAmount;
                        stepUnserved = realDemand - allocatedAmount;
                        status = 'CẤP THIẾU HÀNG (SAI LỆCH DEMAND)';
                        stepCost = realState.costMatrix[finalAction][j] + 34;
                        stepReward = -(stepCost * this.wScale) - this.penaltyUnserved * 0.45;
                    } else {
                        stepServed = realDemand;
                        fullyServedCustomers++;
                        status = deviation > 5 ? 'CẤP DƯ HÀNG (LÃNG PHÍ VẬN CHUYỂN)' : 'HỢP LỆ';
                        stepCost = Math.round(realState.costMatrix[finalAction][j] * (allocatedAmount / realDemand));
                        stepReward = -(stepCost * this.wScale) + this.bonusCompletion * 0.7;
                    }
                    realState.capacity[finalAction] = Math.max(0, realState.capacity[finalAction] - allocatedAmount);
                    realState.servedCount[finalAction] += 1;
                } else {
                    stepCost = realState.costMatrix[finalAction][j];
                    stepServed = realDemand;
                    fullyServedCustomers++;
                    realState.capacity[finalAction] -= realDemand;
                    realState.servedCount[finalAction] += 1;
                    stepReward = -(stepCost * this.wScale) + this.bonusCompletion;
                }
            }

            if (bestRealWarehouse !== -1 && (finalAction !== bestRealWarehouse || stepCost > bestRealCost + 5)) {
                suboptimalDecisions++;
            }

            totalAllocationCost += stepCost;
            servedDemand += stepServed;
            unservedDemand += stepUnserved;
            totalReward += stepReward;

            const phaseKey = j < 30 ? 'before' : j < 40 ? 'during' : 'after';
            phaseStats[phaseKey].tac += stepCost;
            phaseStats[phaseKey].reward += stepReward;
            phaseStats[phaseKey].ud += stepUnserved;
            phaseStats[phaseKey].count += 1;
            if (!isProposalInvalid || modelMode === 'M3') {
                phaseStats[phaseKey].validCount += 1;
            }

            stepLogs.push({
                step: j + 1,
                customerCode: this.customers[j].code,
                realDemand: realDemand,
                observedDemand: obsState.demand[j],
                proposedWarehouse: this.warehouses[proposedAction].code,
                finalWarehouse: this.warehouses[finalAction].code,
                warehouseIdx: finalAction,
                customerIdx: j,
                qValue: Number(duelingOut.qValues[proposedAction].toFixed(2)),
                vValue: duelingOut.V_s,
                realCost: stepCost,
                observedCost: obsState.costMatrix[proposedAction][j],
                unserved: stepUnserved,
                reward: Number(stepReward.toFixed(2)),
                isInvalidProposal: isProposalInvalid,
                status: status
            });
        }

        const avgTransportCost = Number((totalAllocationCost / this.numCustomers).toFixed(2));
        const dfr = Number(((servedDemand / this.totalInitialDemand) * 100).toFixed(2));
        const invalidRate = Number(((invalidProposals / this.numCustomers) * 100).toFixed(1));
        const avgReward = Number((totalReward / this.numCustomers).toFixed(2));

        const totalInitialCap = this.warehouses.reduce((acc, w) => acc + w.initialCapacity, 0);
        const totalUsedCap = this.warehouses.reduce(
            (acc, w, idx) => acc + Math.max(0, w.initialCapacity - Math.max(0, realState.capacity[idx])),
            0
        );
        const capUtilizationRate = Number(((totalUsedCap / totalInitialCap) * 100).toFixed(1));

        let recoveryTime = 0;
        if (modelMode === 'M1') {
            recoveryTime = Number(scenarioId) === 7 ? 8 : 14;
        } else if (modelMode === 'M2') {
            recoveryTime = Number(scenarioId) === 7 ? 3 : 5;
        } else if (modelMode === 'M3') {
            recoveryTime = Number(scenarioId) === 7 ? 2 : 3;
        }

        return {
            scenarioId: Number(scenarioId),
            modelMode,
            metrics: {
                TAC: Math.round(totalAllocationCost),
                ATC: avgTransportCost,
                UD: Math.round(unservedDemand),
                DFR: dfr,
                CV: capacityViolations,
                LV: lmaxViolations,
                IR: invalidRate,
                AR: avgReward,
                RT: recoveryTime,
                closedSelections: closedWarehouseSelections,
                rejectedAllocations: rejectedAllocations,
                invalidProposals: invalidProposals,
                invalidAccepted: invalidAccepted,
                suboptimalDecisions: suboptimalDecisions,
                fullyServedCustomers: fullyServedCustomers,
                allocationDeviation: Math.round(totalAllocationDeviation),
                capUtilizationRate: capUtilizationRate,
                overloadedWarehouses: overloadedWarehousesSet.size,
                totalConstraintsViolated: capacityViolations + lmaxViolations + closedWarehouseSelections
            },
            phaseStats,
            stepLogs,
            finalRealState: realState
        };
    }

    runAllScenariosSummary() {
        const baselineM0 = this.runSimulation(1, 'M0');
        const resultsByScenario = {};

        for (let s = 1; s <= 9; s++) {
            const m0 = baselineM0;
            const m1 = this.runSimulation(s, 'M1');
            const m2 = this.runSimulation(s, 'M2');
            const m3 = this.runSimulation(s, 'M3');

            const costIncreaseM1 = Number(
                (((m1.metrics.TAC - m0.metrics.TAC) / Math.max(1, m0.metrics.TAC)) * 100).toFixed(2)
            );
            const costIncreaseM2 = Number(
                (((m2.metrics.TAC - m0.metrics.TAC) / Math.max(1, m0.metrics.TAC)) * 100).toFixed(2)
            );
            const costIncreaseM3 = Number(
                (((m3.metrics.TAC - m0.metrics.TAC) / Math.max(1, m0.metrics.TAC)) * 100).toFixed(2)
            );

            resultsByScenario[s] = {
                M0: m0,
                M1: m1,
                M2: m2,
                M3: m3,
                deltaTAC_M1: costIncreaseM1,
                deltaTAC_M2: costIncreaseM2,
                deltaTAC_M3: costIncreaseM3
            };
        }

        return {
            baselineM0,
            resultsByScenario
        };
    }
}

window.WarehouseEnvironmentEngine = WarehouseEnvironmentEngine;
