import fs from "node:fs/promises";

const columns = ["episode", "mode", "seed", "total_cost", "fixed_cost", "transport_cost", "unserved_demand", "invalid_actions", "attack_epsilon", "changed_dimensions", "detection_rate"];

export async function writeCsv(filePath, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => JSON.stringify(row[column] ?? "")).join(","));
  }
  await fs.writeFile(filePath, `${lines.join("\n")}\n`);
}
