import { perturbState } from "../attacks/state-perturbation.js";

export function adversarialState(state, options = {}) {
  return perturbState(state, options).adversarialState;
}

export function createAdversarialTransition(transition, options) {
  return { ...transition, state: adversarialState(transition.state, options), source: "adversarial" };
}

export function mixReplaySamples(cleanSamples, adversarialSamples, adversarialRatio = 0.5) {
  if (adversarialRatio < 0 || adversarialRatio > 1) throw new Error("adversarialRatio must be between 0 and 1");
  const count = Math.min(adversarialSamples.length, Math.round(cleanSamples.length * adversarialRatio / Math.max(1e-9, 1 - adversarialRatio)));
  return [...cleanSamples, ...adversarialSamples.slice(0, count)];
}

export async function trainAdversarialDqn(envFactory, options = {}) {
  const { trainDqn } = await import("../agent/trainer.js");
  return trainDqn(envFactory, { ...options, replayTransform: (transition) => createAdversarialTransition(transition, options.attackOptions) });
}
