export function inspectState(state, {
  warehouses,
  customers,
  distribution = null,
  tolerance = 0.05
} = {}) {
  const expected = warehouses * 3 + 1;
  const reasons = [];
  if (!Array.isArray(state)) reasons.push("state_not_array");
  if (Array.isArray(state) && state.length !== expected) reasons.push("invalid_dimension");
  if (Array.isArray(state) && state.some((value) => typeof value !== "number")) reasons.push("non_numeric");
  if (Array.isArray(state) && state.some((value) => !Number.isFinite(value))) reasons.push("nan_or_infinity");
  if (Array.isArray(state) && state.some((value) => value < 0 || value > 1)) reasons.push("outside_normalized_domain");
  const distributionScore = distribution && reasons.length === 0
    ? state.reduce((sum, value, index) => sum + Math.max(0, Math.abs(value - distribution.mean[index]) - distribution.std[index] * 3), 0) / state.length
    : 0;
  if (distribution && distributionScore > tolerance) reasons.push("outside_training_distribution");
  return {
    accepted: reasons.length === 0,
    category: reasons.some((reason) => ["invalid_dimension", "non_numeric", "nan_or_infinity"].includes(reason)) ? "structural" : reasons.length ? "anomalous" : "valid",
    reasons,
    distributionScore,
    state: reasons.length === 0 ? [...state] : null,
    decision: reasons.length === 0 ? "accept" : "reject"
  };
}

export function sanitizeState(state, options = {}) {
  const result = inspectState(state, options);
  if (!result.accepted) {
    const error = new Error(`State rejected: ${result.reasons.join(", ")}`);
    error.report = result;
    throw error;
  }
  return result.state;
}

export function fitStateDistribution(states) {
  if (!Array.isArray(states) || !states.length) throw new Error("At least one clean validation state is required");
  const length = states[0].length;
  if (states.some((state) => state.length !== length || state.some((value) => !Number.isFinite(value)))) throw new Error("Invalid validation states");
  const mean = Array.from({ length }, (_, index) => states.reduce((sum, state) => sum + state[index], 0) / states.length);
  const std = Array.from({ length }, (_, index) => Math.sqrt(states.reduce((sum, state) => sum + (state[index] - mean[index]) ** 2, 0) / states.length) || 1e-6);
  return { mean, std };
}
