import { z } from "zod";

const nonNegative = z.number().finite().nonnegative();
export const datasetSchema = z.object({
  warehouses: z.number().int().positive(),
  customers: z.number().int().positive(),
  fixedCost: z.array(nonNegative),
  capacity: z.array(nonNegative),
  maxCustomers: z.array(z.number().int().nonnegative()),
  demand: z.array(nonNegative),
  transportCost: z.array(z.array(nonNegative))
});

export function validateDataset(data) {
  const result = datasetSchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid dataset: ${result.error.issues.map((x) => x.message).join("; ")}`);
  if (data.fixedCost.length !== data.warehouses || data.capacity.length !== data.warehouses ||
      data.maxCustomers.length !== data.warehouses || data.demand.length !== data.customers ||
      data.transportCost.length !== data.customers ||
      data.transportCost.some((r) => r.length !== data.warehouses)) throw new Error("Dataset dimensions do not match");
  return data;
}
