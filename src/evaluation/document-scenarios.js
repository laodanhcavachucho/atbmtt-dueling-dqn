import { getActionMask, maskedArgmax } from "../environment/action-mask.js";
import { seededRandom } from "../utils/seed.js";

export const DOCUMENT_ATTACK_SCENARIOS = Object.freeze([
  {
    id: "open_status_spoofing",
    number: 1,
    member: "Thành viên 1",
    group: "Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)",
    code: "Kịch bản 1",
    name: "Giả mạo trạng thái đóng/mở kho (Open Status Spoofing Attack)",
    targetVector: "Vector Open Status O = [O₁, ..., O₅₀] (50 phần tử nhị phân)"
  },
  {
    id: "transport_cost_poisoning",
    number: 2,
    member: "Thành viên 2",
    group: "Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)",
    code: "Kịch bản 2",
    name: "Bóp méo ma trận chi phí vận chuyển (Transport Cost Poisoning)",
    targetVector: "Ma trận chi phí vận chuyển C₅₀ₓ₅₀ (2.500 phần tử)"
  },
  {
    id: "capacity_exhaustion",
    number: 3,
    member: "Thành viên 3",
    group: "Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)",
    code: "Kịch bản 3",
    name: "Bóp méo năng lực sức chứa kho (Capacity Exhaustion Attack)",
    targetVector: "Vector sức chứa còn lại Capacity = [Cap₁, ..., Cap₅₀] (50 phần tử)"
  },
  {
    id: "fake_demand_fluctuation",
    number: 4,
    member: "Thành viên 4",
    group: "Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)",
    code: "Kịch bản 4",
    name: "Làm giả nhu cầu khách hàng (Fake Demand Fluctuation Attack)",
    targetVector: "Vector nhu cầu khách hàng Demand = [D₁, ..., D₅₀] (50 phần tử)"
  },
  {
    id: "distributed_multi_node",
    number: 5,
    member: "Thành viên 5",
    group: "Nhóm 2 – Tấn công có mục tiêu và phân tán",
    code: "Kịch bản 5",
    name: "Tấn công chuỗi cung ứng phân tán (Distributed Multi-Node Attack – 5 kho chiến lược)",
    targetVector: "Nhóm 5 kho hàng chiến lược trung tâm (W1, W10, W20, W30, W40)"
  },
  {
    id: "lmax_overload",
    number: 6,
    member: "Thành viên 6",
    group: "Nhóm 2 – Tấn công có mục tiêu và phân tán",
    code: "Kịch bản 6",
    name: "Làm tràn giới hạn phục vụ khách hàng (l_max Overload Attack)",
    targetVector: "Vector bộ đếm số khách đang phục vụ l = [l₁, ..., l₅₀] (50 phần tử)"
  },
  {
    id: "transient_random_time",
    number: 7,
    member: "Thành viên 7",
    group: "Nhóm 3 – Tấn công theo thời gian và lớp bảo vệ",
    code: "Kịch bản 7",
    name: "Tấn công ngắt quãng / chớp nhoáng (Transient / Random-Time Attack)",
    targetVector: "Tác động theo cửa sổ thời gian (Bước 61–80 trong chu kỳ 100 bước)"
  },
  {
    id: "action_mask_bypass",
    number: 8,
    member: "Thành viên 8",
    group: "Nhóm 3 – Tấn công theo thời gian và lớp bảo vệ",
    code: "Kịch bản 8",
    name: "Vượt qua lớp lọc hành động (Action Mask-Bypassing Attack)",
    targetVector: "Phối hợp đồng bộ Open Status + Capacity + Bộ đếm l_i"
  },
  {
    id: "reward_poisoning",
    number: 9,
    member: "Thành viên 9",
    group: "Nhóm 4 – Tấn công quá trình huấn luyện (Training-time Attack)",
    code: "Kịch bản 9",
    name: "Đầu độc phần thưởng trong giai đoạn huấn luyện (Reward Poisoning Attack)",
    targetVector: "Hàm phần thưởng R_t = -(Cost_t × w_scale) + Bonus_completion - Penalty_unserved"
  }
]);

const STATE_POLICY = "dueling_dqn_sim";

function alterObservation(env, state, scenario, step, options, random) {
  const observed = [...state];
  const n = env.data.warehouses;
  const costStart = n * 2;
  const demandIndex = n * 3;
  const active =
    scenario !== "transient_random_time" ||
    (env.currentCustomer >= options.attackStart && env.currentCustomer < options.attackEnd);
  const epsilon = options.epsilon;
  if (!active) return { observed, active, attackedMask: null };

  const indices =
    scenario === "distributed_multi_node"
      ? env.data.capacity
          .map((_, i) => i)
          .sort((a, b) => env.data.capacity[b] - env.data.capacity[a])
          .slice(0, Math.min(5, n))
      : env.data.capacity.map((_, i) => i);

  if (scenario === "open_status_spoofing") {
    for (const i of indices) observed[n + i] = observed[n + i] > 0.5 ? 0 : 1;
  } else if (scenario === "transport_cost_poisoning") {
    for (const i of indices)
      observed[costStart + i] = Math.min(1, Math.max(0, 1 - observed[costStart + i]));
  } else if (scenario === "capacity_exhaustion" || scenario === "distributed_multi_node") {
    for (const i of indices) observed[i] = Math.min(1, observed[i] + epsilon);
  } else if (scenario === "fake_demand_fluctuation") {
    observed[demandIndex] = Math.min(
      1,
      Math.max(0, observed[demandIndex] + (random() < 0.5 ? -epsilon : epsilon))
    );
  } else if (scenario === "transient_random_time") {
    for (const i of indices)
      observed[costStart + i] = Math.min(
        1,
        Math.max(0, observed[costStart + i] + (random() < 0.5 ? -epsilon : epsilon))
      );
  } else if (scenario === "action_mask_bypass") {
    for (const i of indices) observed[i] = Math.max(observed[i], epsilon);
    for (const i of indices) observed[n + i] = 1;
  }

  let attackedMask = null;
  if (
    [
      "open_status_spoofing",
      "capacity_exhaustion",
      "distributed_multi_node",
      "lmax_overload",
      "action_mask_bypass"
    ].includes(scenario)
  ) {
    attackedMask = getActionMask(env).map((allowed, i) => {
      if (scenario === "open_status_spoofing")
        return observed[n + i] > 0.5 && env.data.capacity[i] - env.usedCapacity[i] > 0;
      if (
        scenario === "capacity_exhaustion" ||
        scenario === "distributed_multi_node" ||
        scenario === "action_mask_bypass"
      )
        return observed[i] > 0 && observed[n + i] > 0.5;
      if (scenario === "lmax_overload")
        return (
          env.data.capacity[i] - env.usedCapacity[i] > 0 &&
          Number.isFinite(env.data.transportCost[env.currentCustomer][i])
        );
      return allowed;
    });
  }
  return { observed, active, attackedMask };
}

function chooseObservedAction(env, state, mask) {
  if (!mask.some(Boolean)) return -1;
  const n = env.data.warehouses;
  const customer = Math.min(env.currentCustomer, env.data.customers - 1);
  const remaining = Math.max(0, env.data.demand[customer] - env.served[customer]);
  const score = state.slice(0, n).map((capacity, i) => {
    const opening = state[n + i] > 0.5 ? 0 : env.data.fixedCost[i];
    const cost = state[n * 2 + i] * 100;
    return -(opening + Math.min(remaining, Math.max(1, capacity * env.data.capacity[i])) * cost);
  });
  return maskedArgmax(score, mask);
}

export function evaluateDocumentScenarios(
  envFactory,
  { scenario = "open_status_spoofing", episodes = 5, epsilon = 0.2, seed = 20261021 } = {}
) {
  if (!DOCUMENT_ATTACK_SCENARIOS.some((item) => item.id === scenario))
    throw new Error("Kịch bản tấn công không hợp lệ");
  const rows = [];
  for (let episode = 0; episode < episodes; episode += 1) {
    const cleanEnv = envFactory();
    let cleanState = cleanEnv.reset();
    let cleanSteps = 0;
    while (!cleanEnv.done && cleanSteps < cleanEnv.data.customers * cleanEnv.data.warehouses) {
      cleanState = cleanEnv.step(chooseObservedAction(cleanEnv, cleanState, cleanEnv.getActionMask())).state;
      cleanSteps += 1;
    }
    const cleanSummary = cleanEnv.summary();
    const env = envFactory();
    let state = env.reset();
    let step = 0;
    let attackedSteps = 0;
    let rejected = 0;
    let invalidProposals = 0;
    let costDuringAttack = 0;
    const random = seededRandom(seed + episode);
    const totalDecisionLimit = env.data.customers * env.data.warehouses;
    const options = {
      epsilon,
      attackStart:
        scenario === "transient_random_time" ? Math.floor(env.data.customers * 0.6) : 0,
      attackEnd:
        scenario === "transient_random_time"
          ? Math.floor(env.data.customers * 0.8)
          : env.data.customers
    };
    while (!env.done && step < totalDecisionLimit) {
      const attack = alterObservation(env, state, scenario, step, options, random);
      const realMask = env.getActionMask();
      const selectionMask = attack.attackedMask ?? realMask;
      let action = chooseObservedAction(env, attack.observed, selectionMask);
      if (action < 0) action = maskedArgmax([0], [false]);
      const proposedInvalid = action < 0 || !realMask[action];
      if (proposedInvalid) invalidProposals += 1;

      if (scenario === "action_mask_bypass" && proposedInvalid) {
        rejected += 1;
        action = chooseObservedAction(env, state, realMask);
      }
      if (attack.active) attackedSteps += 1;
      const before = env.summary().totalCost;
      const transition = env.step(action);
      if (attack.active) costDuringAttack += Math.max(0, env.summary().totalCost - before);
      state = transition.state;
      step += 1;
    }
    const summary = env.summary();
    const demandTotal = env.data.demand.reduce((sum, value) => sum + value, 0);
    const utilization =
      env.data.capacity.reduce(
        (sum, capacity, i) => sum + Math.min(capacity, env.usedCapacity[i]),
        0
      ) / Math.max(1, env.data.capacity.reduce((sum, value) => sum + value, 0));
    rows.push({
      scenario,
      episode,
      policy: STATE_POLICY,
      status: "measured",
      baselineTotalCost: cleanSummary.totalCost,
      costChangeRate: cleanSummary.totalCost
        ? (summary.totalCost - cleanSummary.totalCost) / cleanSummary.totalCost
        : 0,
      attackedSteps,
      invalidProposals,
      rejectedActions: rejected,
      invalidAccepted: Math.max(0, invalidProposals - rejected),
      meanCostDuringAttack: attackedSteps ? costDuringAttack / attackedSteps : 0,
      fulfillmentRate: 1 - summary.unservedDemand / Math.max(1, demandTotal),
      fullyServedCustomers: summary.servedCustomers,
      capacityUtilization: utilization,
      recoveryTime:
        scenario === "transient_random_time" ? Math.max(0, step - options.attackEnd) : null,
      reward: -summary.totalCost,
      ...summary
    });
  }
  return {
    scenario,
    scenarioName: DOCUMENT_ATTACK_SCENARIOS.find((item) => item.id === scenario).name,
    policy: STATE_POLICY,
    status: "measured",
    rows,
    summary: {
      meanTotalCost: rows.reduce((sum, row) => sum + row.totalCost, 0) / rows.length,
      meanUnservedDemand: rows.reduce((sum, row) => sum + row.unservedDemand, 0) / rows.length,
      meanFulfillmentRate: rows.reduce((sum, row) => sum + row.fulfillmentRate, 0) / rows.length,
      meanInvalidProposals:
        rows.reduce((sum, row) => sum + row.invalidProposals, 0) / rows.length,
      meanRejectedActions: rows.reduce((sum, row) => sum + row.rejectedActions, 0) / rows.length,
      meanRecoveryTime:
        scenario === "transient_random_time"
          ? rows.reduce((sum, row) => sum + row.recoveryTime, 0) / rows.length
          : null
    }
  };
}
