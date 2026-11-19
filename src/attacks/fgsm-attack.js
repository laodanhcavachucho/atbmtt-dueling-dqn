import { maskedArgmax } from "../environment/action-mask.js";

export function fgsmPerturb(state, gradient, epsilon = 0.1, bounds = { min: 0, max: 1 }) {
  if (!Array.isArray(state) || state.length !== gradient.length) {
    throw new Error("State and gradient dimensions differ");
  }
  if (!Number.isFinite(epsilon) || epsilon < 0) throw new Error("epsilon must be non-negative");
  return state.map((value, index) => {
    const next = value + epsilon * Math.sign(gradient[index]);
    return Math.min(bounds.max, Math.max(bounds.min, next));
  });
}

export async function computeFgsmAttack(model, state, mask, {
  epsilon = 0.1,
  action = null,
  bounds = { min: 0, max: 1 }
} = {}) {
  if (!model || typeof model.predict !== "function") throw new Error("A TensorFlow.js model is required");
  const tf = await import("@tensorflow/tfjs-node");
  const selectedAction = action ?? maskedArgmax(
    tf.tidy(() => model.predict(tf.tensor2d([state])).dataSync().slice()),
    mask
  );
  if (selectedAction < 0) throw new Error("No feasible action for FGSM loss");

  const result = tf.tidy(() => {
    const input = tf.tensor2d([state]);
    const variable = tf.variable(input);
    const gradientFunction = tf.grad((candidate) => {
      const qValues = model.predict(candidate);
      return tf.neg(qValues.slice([0, selectedAction], [1, 1]).squeeze());
    });
    const gradientTensor = gradientFunction(variable);
    const gradient = gradientTensor.dataSync().slice();
    const loss = Number(tf.neg(model.predict(variable).slice([0, selectedAction], [1, 1]).squeeze()).dataSync()[0]);
    const adversarialState = fgsmPerturb(state, gradient, epsilon, bounds);
    return { gradient, loss, adversarialState, action: selectedAction };
  });
  return result;
}

export function finiteDifferenceGradient(lossFunction, state, delta = 1e-5) {
  if (!Number.isFinite(delta) || delta <= 0) throw new Error("delta must be positive");
  return state.map((value, index) => {
    const plus = [...state]; plus[index] = value + delta;
    const minus = [...state]; minus[index] = value - delta;
    return (lossFunction(plus) - lossFunction(minus)) / (2 * delta);
  });
}
