import fs from "node:fs/promises";

function numbers(line) {
  return line.trim().split(/\s+/).filter(Boolean).map(Number);
}

export function parseCapFile(text) {
  const lines = text.trim().split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("Dataset is empty");
  const [warehouses, customers] = numbers(lines[0]);
  if (!Number.isInteger(warehouses) || !Number.isInteger(customers) || warehouses < 1 || customers < 1) {
    throw new Error("First line must contain positive warehouse/customer counts");
  }
  const fixedCost = [], capacity = [], maxCustomers = [];
  for (let i = 0; i < warehouses; i++) {
    const row = numbers(lines[1 + i]);
    if (row.length < 3 || row.some((n) => !Number.isFinite(n) || n < 0)) throw new Error("Invalid warehouse row");
    capacity.push(row[0]); fixedCost.push(row[1]); maxCustomers.push(row[2]);
  }
  const tail = lines.slice(1 + warehouses).flatMap(numbers);
  const demand = [], transportCost = [];
  let cursor = 0;
  for (let c = 0; c < customers; c++) {
    const d = tail[cursor++];
    if (!Number.isFinite(d) || d < 0) throw new Error("Invalid demand value");
    demand.push(d);
    const costs = tail.slice(cursor, cursor + warehouses);
    cursor += warehouses;
    if (costs.length !== warehouses || costs.some((n) => !Number.isFinite(n) || n < 0)) throw new Error("Invalid transport values");
    transportCost.push(costs);
  }
  return { warehouses, customers, fixedCost, capacity, maxCustomers, demand, transportCost, source: "cap111.txt" };
}

export async function loadDataset(filePath) {
  return parseCapFile(await fs.readFile(filePath, "utf8"));
}
