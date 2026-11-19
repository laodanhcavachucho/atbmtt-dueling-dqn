import fs from "node:fs/promises";

const columns = ["configuration", "status", "episode", "seed", "total_cost", "fixed_cost", "transport_cost", "unserved_demand", "invalid_action_rate", "attack_success", "detection_rate", "blocked_actions", "inference_overhead_ms"];

export async function writeFinalComparison(filePath, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => JSON.stringify(row[column] ?? row[camelCase(column)] ?? "")).join(","));
  await fs.writeFile(filePath, `${lines.join("\n")}\n`);
}

function camelCase(value) {
  return value.replace(/_([a-z])/g, (_, character) => character.toUpperCase());
}

export function aggregateMetrics(rows) {
  const grouped = {};
  for (const row of rows) (grouped[row.configuration] ??= []).push(row);
  return Object.fromEntries(Object.entries(grouped).map(([configuration, values]) => {
    const mean = (key) => values.reduce((sum, row) => sum + Number(row[key] || 0), 0) / values.length;
    return [configuration, {
      episodes: values.length,
      meanTotalCost: mean("totalCost"),
      meanFixedCost: mean("fixedCost"),
      meanTransportCost: mean("transportCost"),
      meanUnservedDemand: mean("unservedDemand"),
      invalidActionRate: mean("invalid_action_rate"),
      attackSuccessRate: values.filter((row) => row.attack_success).length / values.length,
      detectionRate: mean("detection_rate"),
      falsePositiveRate: configuration === "baseline_clean" ? mean("detection_rate") : null,
      meanInferenceOverheadMs: mean("inference_overhead_ms")
      ,measurementStatus: configuration === "adversarial_training" ? "not_trained_without_tfjs_native" : "measured"
    }];
  }));
}
