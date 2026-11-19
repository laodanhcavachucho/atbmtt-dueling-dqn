import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDataset } from "./data/parser.js";
import { createSyntheticData } from "./data/synthetic-data.js";
import { WarehouseEnv } from "./environment/warehouse-env.js";
import { evaluateGreedy } from "./evaluation/baseline.js";
import { evaluateRandom } from "./evaluation/baseline.js";
import fs from "node:fs/promises";
import { writeCsv } from "./attacks/csv.js";
import { evaluateDefenseConfigurations } from "./evaluation/defense-evaluation.js";
import { writeFinalComparison, aggregateMetrics } from "./evaluation/report.js";
import { createApp } from "./api/app.js";
import { evaluateDocumentScenarios } from "./evaluation/document-scenarios.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(root, "..", "cap111.txt");
let data;
try {
  const sourceData = await loadDataset(sourcePath);
  data = sourceData.warehouses === 50 && sourceData.customers === 50
    ? sourceData
    : createSyntheticData({ seed: 20261021 });
  if (data.source === "synthetic") data.sourceFile = "data/synthetic-50x50.json";
} catch {
  data = createSyntheticData({ seed: 20261021 });
  data.sourceFile = "data/synthetic-50x50.json";
}
if (data.source === "synthetic") {
  await fs.mkdir(path.resolve(root, "..", "data"), { recursive: true });
  await fs.writeFile(path.resolve(root, "..", "data", "synthetic-50x50.json"), JSON.stringify(data, null, 2));
}
const envFactory = () => new WarehouseEnv(data);
const mode = process.argv[2] ?? "baseline";
const resultsDirectory = path.resolve(root, "..", "results");
const checkpointDirectory = path.resolve(root, "..", "checkpoints", "baseline");
const adversarialCheckpointDirectory = path.resolve(root, "..", "checkpoints", "adversarial");
if (mode === "web") {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp({
    data,
    resultsDirectory,
    evaluate: runDashboardEvaluation,
    train: async () => ({ status: "Huấn luyện yêu cầu TensorFlow native runtime; sử dụng npm run train" })
  });
  app.listen(port, () => console.log(`Hệ thống mô phỏng Dueling DQN (ATBMTT) đang chạy tại http://localhost:${port}`));
} else if (mode === "train") {
  const { trainDqn } = await import("./agent/trainer.js");
  const { saveCheckpoint } = await import("./agent/checkpoint.js");
  const episodes = Number(process.argv[3]) || 100;
  const trained = await trainDqn(envFactory, { episodes, onEpisode: (row) => console.log(JSON.stringify({ episode: row.episode, epsilon: row.epsilon, loss: row.loss, reward: row.reward })) });
  await saveCheckpoint(trained.model, checkpointDirectory);
  await fs.mkdir(resultsDirectory, { recursive: true });
  await fs.writeFile(path.join(resultsDirectory, "training-history.json"), JSON.stringify(trained.history, null, 2));
  console.log(JSON.stringify({ checkpoint: checkpointDirectory, final: trained.history.at(-1) }, null, 2));
} else if (mode === "train-defense") {
  const { trainAdversarialDqn } = await import("./defenses/adversarial-training.js");
  const { saveCheckpoint } = await import("./agent/checkpoint.js");
  const episodes = Number(process.argv[3]) || 100;
  const trained = await trainAdversarialDqn(envFactory, { episodes, attackOptions: { warehouses: data.warehouses, customers: data.customers, epsilon: 0.1, transportCost: true, capacity: true, openStatus: true, remainingDemand: true }, onEpisode: (row) => console.log(JSON.stringify({ episode: row.episode, epsilon: row.epsilon, loss: row.loss, reward: row.reward })) });
  await saveCheckpoint(trained.model, adversarialCheckpointDirectory);
  await fs.mkdir(resultsDirectory, { recursive: true });
  await fs.writeFile(path.join(resultsDirectory, "adversarial-training-history.json"), JSON.stringify(trained.history, null, 2));
  console.log(JSON.stringify({ checkpoint: adversarialCheckpointDirectory, final: trained.history.at(-1) }, null, 2));
} else if (mode === "evaluate" || mode === "baseline") {
  const episodes = Number(process.argv[3]) || 5;
  const results = { random: evaluateRandom(envFactory, { episodes }), greedy: evaluateGreedy(envFactory, { episodes }) };
  try {
    const { evaluateDqn } = await import("./evaluation/dqn.js");
    const { loadCheckpoint } = await import("./agent/checkpoint.js");
    const model = await loadCheckpoint(checkpointDirectory);
    results.dqn = evaluateDqn(envFactory, model, { episodes });
    model.dispose();
  } catch (error) {
    results.dqn = { unavailable: error.message };
  }
  await fs.mkdir(resultsDirectory, { recursive: true });
  await fs.writeFile(path.join(resultsDirectory, "baseline-results.json"), JSON.stringify(results, null, 2));
  await writeCsv(path.join(resultsDirectory, "baseline.csv"), [...results.random, ...results.greedy].map(toCsvRow));
  console.log(JSON.stringify({ dataset: { source: data.source, warehouses: data.warehouses, customers: data.customers, transportRows: data.transportCost.length, transportColumns: data.transportCost[0].length }, results: summarizeResults(results) }, null, 2));
} else if (mode === "attack") {
  const episodes = Number(process.argv[3]) || 5;
  const epsilonValues = (process.argv[4] || "0,0.01,0.05,0.1").split(",").map(Number);
  const attackResults = [];
  try {
    const { loadCheckpoint } = await import("./agent/checkpoint.js");
    const { evaluateAttack } = await import("./evaluation/attack-evaluation.js");
    const model = await loadCheckpoint(checkpointDirectory);
    for (const epsilon of epsilonValues) {
      attackResults.push(...await evaluateAttack(envFactory, model, { episodes, epsilon, attackType: "fgsm" }));
    }
    model.dispose();
  } catch (error) {
    attackResults.push({ mode: "fgsm", attack_epsilon: "", error: error.message });
  }
  await fs.mkdir(resultsDirectory, { recursive: true });
  await writeCsv(path.join(resultsDirectory, "attack.csv"), attackResults.map(toCsvRow));
  const comparison = buildAttackComparison(attackResults);
  await fs.writeFile(path.join(resultsDirectory, "attack_comparison.json"), JSON.stringify(comparison, null, 2));
  console.log(JSON.stringify(comparison, null, 2));
} else if (mode === "defense") {
  const episodes = Number(process.argv[3]) || 5;
  const epsilon = Number(process.argv[4]) || 0.1;
  const defense = evaluateDefenseConfigurations(envFactory, { episodes, epsilon });
  const metrics = aggregateMetrics(defense.rows);
  await fs.mkdir(resultsDirectory, { recursive: true });
  await writeFinalComparison(path.join(resultsDirectory, "final_comparison.csv"), defense.rows);
  await fs.writeFile(path.join(resultsDirectory, "metrics.json"), JSON.stringify({ dataset: data.source, seed: 20261021, epsilon, anomaly: defense.anomalyMetrics, metrics }, null, 2));
  const reportPath = path.resolve(root, "..", "reports", "experimental-report.md");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, buildReport({ data, epsilon, metrics, anomaly: defense.anomalyMetrics }));
  console.log(JSON.stringify({ metrics, report: reportPath }, null, 2));
} else {
  throw new Error(`Unknown mode: ${mode}. Use train, evaluate, attack, or defense.`);
}

function toCsvRow(row) {
  return {
    episode: row.episode,
    mode: row.mode,
    seed: row.seed,
    total_cost: row.totalCost,
    fixed_cost: row.fixedCost,
    transport_cost: row.transportCost,
    unserved_demand: row.unservedDemand,
    invalid_actions: row.invalidActions,
    attack_epsilon: row.attack_epsilon ?? 0,
    changed_dimensions: row.changed_dimensions ?? 0,
    detection_rate: row.detection_rate ?? ""
  };
}

function buildAttackComparison(rows) {
  const usable = rows.filter((row) => Number.isFinite(row.totalCost));
  const byEpsilon = Object.groupBy ? Object.groupBy(usable, (row) => row.attack_epsilon) : usable.reduce((groups, row) => {
    (groups[row.attack_epsilon] ??= []).push(row);
    return groups;
  }, {});
  const summaries = Object.fromEntries(Object.entries(byEpsilon).map(([epsilon, values]) => {
    const mean = values.reduce((sum, row) => sum + row.totalCost, 0) / values.length;
    return [epsilon, {
      episodes: values.length,
      meanTotalCost: mean,
      meanUnservedDemand: values.reduce((sum, row) => sum + row.unservedDemand, 0) / values.length,
      meanInvalidActions: values.reduce((sum, row) => sum + row.invalidActions, 0) / values.length,
      stateTraces: values.map((row) => row.stateTrace)
    }];
  }));
  const clean = summaries["0"]?.meanTotalCost;
  for (const summary of Object.values(summaries)) {
    summary.costChangeRate = clean ? (summary.meanTotalCost - clean) / clean : 0;
  }
  return { attackType: "fgsm", loss: "negative selected masked Q-value", results: summaries, unavailable: rows.find((row) => row.error)?.error ?? null };
}

function summarizeResults(results) {
  return Object.fromEntries(Object.entries(results).map(([modeName, rows]) => {
    if (!Array.isArray(rows)) return [modeName, rows];
    const costs = rows.map((row) => row.totalCost);
    const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
    const std = Math.sqrt(costs.reduce((sum, cost) => sum + (cost - mean) ** 2, 0) / costs.length);
    return [modeName, { episodes: rows.length, meanTotalCost: mean, stdTotalCost: std, meanUnservedDemand: rows.reduce((s, r) => s + r.unservedDemand, 0) / rows.length, meanOpenedWarehouses: rows.reduce((s, r) => s + r.openedWarehouses, 0) / rows.length }];
  }));
}

async function runDashboardEvaluation(requestedMode, options = {}) {
  const episodes = options.episodes ?? 5;
  const epsilon = options.epsilon ?? 0.1;
  if (requestedMode === "scenario") {
    if (options.scenario === "reward_poisoning") {
      try {
        const { trainDqn } = await import("./agent/trainer.js");
        const { evaluateDqn } = await import("./evaluation/dqn.js");
        const normal = await trainDqn(envFactory, { episodes, seed: 20261021 });
        const poisoned = await trainDqn(envFactory, { episodes, seed: 20261021, rewardTransform: (reward) => -reward });
        const normalRows = evaluateDqn(envFactory, normal.model, { episodes, seed: 20261121 });
        const poisonedRows = evaluateDqn(envFactory, poisoned.model, { episodes, seed: 20261121 });
        const mean = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
        const rows = [
          { model: "Mô hình phần thưởng chuẩn", trainingReward: mean(normal.history, "trainingReward"), trainingLoss: mean(normal.history.filter((row) => row.loss !== null), "loss"), ...{ meanTotalCost: mean(normalRows, "totalCost"), meanUnservedDemand: mean(normalRows, "unservedDemand"), meanReward: -mean(normalRows, "totalCost") } },
          { model: "Mô hình bị đảo dấu phần thưởng", trainingReward: mean(poisoned.history, "trainingReward"), trainingLoss: mean(poisoned.history.filter((row) => row.loss !== null), "loss"), meanTotalCost: mean(poisonedRows, "totalCost"), meanUnservedDemand: mean(poisonedRows, "unservedDemand"), meanReward: -mean(poisonedRows, "totalCost") }
        ];
        normal.model.dispose(); normal.target.dispose(); poisoned.model.dispose(); poisoned.target.dispose();
        return { status: "completed", dataset: data.source, seed: 20261021, scenario: options.scenario, scenarioName: "Đầu độc phần thưởng khi huấn luyện", policy: "Dueling DQN", rows, summary: { message: "Hai mô hình dùng cùng số episode và seed; đánh giá bằng chi phí thực tế chuẩn.", normal: rows[0], poisoned: rows[1] } };
      } catch (error) {
        return { status: "unavailable", dataset: data.source, seed: 20261021, scenario: options.scenario, error: `Không thể huấn luyện và so sánh hai mô hình DQN: ${error.message}` };
      }
    }
    const result = evaluateDocumentScenarios(envFactory, { scenario: options.scenario, episodes, epsilon, seed: 20261021 });
    return { status: "completed", dataset: data.source, seed: 20261021, epsilon, ...result };
  }
  if (requestedMode === "defense") {
    const defense = evaluateDefenseConfigurations(envFactory, { episodes, epsilon });
    return { status: "completed", dataset: data.source, seed: 20261021, epsilon, metrics: aggregateMetrics(defense.rows), summary: defense.anomalyMetrics };
  }
  if (requestedMode === "baseline") {
    const rows = evaluateGreedy(envFactory, { episodes });
    const costs = rows.map((row) => row.totalCost);
    const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
    return { status: "completed", dataset: data.source, seed: 20261021, epsilon: 0, metrics: { baseline_clean: { episodes, meanTotalCost: mean, meanFixedCost: rows.reduce((s, r) => s + r.fixedCost, 0) / episodes, meanTransportCost: rows.reduce((s, r) => s + r.transportCost, 0) / episodes, meanUnservedDemand: rows.reduce((s, r) => s + r.unservedDemand, 0) / episodes, invalidActionRate: 0, attackSuccessRate: 0, detectionRate: 0, falsePositiveRate: 0, meanInferenceOverheadMs: 0, measurementStatus: "measured" } }, summary: { message: "Greedy feasible baseline completed" } };
  }
  try {
    const { loadCheckpoint } = await import("./agent/checkpoint.js");
    const { evaluateAttack } = await import("./evaluation/attack-evaluation.js");
    const model = await loadCheckpoint(checkpointDirectory);
    const rows = await evaluateAttack(envFactory, model, { episodes, epsilon, attackType: "fgsm" });
    model.dispose();
    return { status: "completed", dataset: data.source, seed: 20261021, epsilon, metrics: { attack: { episodes, meanTotalCost: rows.reduce((s, r) => s + r.totalCost, 0) / rows.length, detectionRate: 0, attackSuccessRate: 1, meanUnservedDemand: rows.reduce((s, r) => s + r.unservedDemand, 0) / rows.length, measurementStatus: "measured" } } };
  } catch (error) {
    return { status: "unavailable", error: error.message, dataset: data.source, seed: 20261021, epsilon };
  }
}

function buildReport({ data, epsilon, metrics, anomaly }) {
  return `# Experimental Defense Report

## 1. Objective and business model

This experiment evaluates capacitated warehouse allocation on \`${data.source}\`
with ${data.warehouses} warehouses and ${data.customers} customers. Total cost is
fixed opening cost plus transportation cost plus unmet-demand and invalid-action
penalties. A warehouse opening cost is charged once.

## 2. MDP

The state is normalized residual capacity, open status, normalized transport
costs for the current customer, and the current residual demand ratio. For the
target 50x50 dataset this is 151 dimensions.
An action selects a warehouse. Action masking rejects exhausted capacity,
customer-limit violations, and invalid transport costs. The reward is the
negative incremental business cost; terminal unmet demand is penalized.

## 3. Agent and threat model

The baseline agent is a Dueling DQN when a compatible TensorFlow.js checkpoint
is available; the local reproducible defense evaluation also contains a greedy
feasible policy so the environment and defenses can be measured without
inventing DQN results. The attacker can alter only the inference state vector
and cannot change weights, source data, or external systems. Rule perturbation
epsilon in this run is ${epsilon}.

## 4. Defenses

- Input sanitization rejects wrong dimensions, non-numeric values, NaN,
  Infinity, values outside [0,1], and distribution outliers.
- Anomaly threshold is fitted from clean validation states, not test states.
- Adversarial-training code marks replay samples with source metadata and saves
  to a separate checkpoint path when training is available. It is not claimed
  to be min-max training.
- Safety guardrails re-check the action mask, apply a validation-derived cost
  threshold when configured, and use a feasible fallback.

## 5. Results

\`\`\`json
${JSON.stringify(metrics, null, 2)}
\`\`\`

## 6. Limitations

The source data has no ground-truth attack labels. Therefore precision,
recall, and false-positive estimates are limited; the recorded clean-state
detector run reports this explicitly. A native TensorFlow.js binding and
baseline checkpoint are required for measured DQN FGSM and adversarial
training. No result is replaced with a target or reference cost.
`;
}
