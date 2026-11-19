import { fitStateDistribution } from "./input-sanitizer.js";

export function fitAnomalyDetector(cleanValidationStates, { quantile = 0.95 } = {}) {
  const distribution = fitStateDistribution(cleanValidationStates);
  const scores = cleanValidationStates.map((state) => anomalyScore(state, distribution));
  const sorted = [...scores].sort((a, b) => a - b);
  const threshold = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))];
  return { distribution, threshold, quantile };
}

export function anomalyScore(state, distribution) {
  if (state.length !== distribution.mean.length) throw new Error("State dimensions differ");
  return state.reduce((sum, value, index) => sum + Math.abs(value - distribution.mean[index]) / distribution.std[index], 0) / state.length;
}

export function detectAnomaly(state, detector) {
  const score = anomalyScore(state, detector.distribution);
  return { score, threshold: detector.threshold, detected: score > detector.threshold };
}

export function classificationMetrics(labels, predictions) {
  if (labels.length !== predictions.length) throw new Error("Labels and predictions differ");
  let tp = 0, fp = 0, fn = 0, tn = 0;
  labels.forEach((label, index) => {
    if (label && predictions[index]) tp += 1;
    else if (!label && predictions[index]) fp += 1;
    else if (label && !predictions[index]) fn += 1;
    else tn += 1;
  });
  return { precision: tp / Math.max(1, tp + fp), recall: tp / Math.max(1, tp + fn), falsePositiveRate: fp / Math.max(1, fp + tn), detectionRate: (tp + tn) / Math.max(1, labels.length) };
}
