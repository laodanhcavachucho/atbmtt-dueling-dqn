import * as tf from "@tensorflow/tfjs-node";
import { maskedArgmax } from "../environment/action-mask.js";

export function evaluateDqn(envFactory, model, { episodes = 5, seed = 20261021 } = {}) {
  return Array.from({ length: episodes }, (_, episode) => {
    const env = envFactory();
    let state = env.reset();
    let steps = 0;
    while (!env.done && steps < env.data.customers * env.data.warehouses) {
      const values = tf.tidy(() => model.predict(tf.tensor2d([state])).dataSync().slice());
      const action = maskedArgmax(values, env.getActionMask());
      state = env.step(action).state;
      steps += 1;
    }
    if (!env.done) throw new Error("DQN policy failed to terminate within the episode limit");
    return { mode: "dqn", seed, episode, ...env.summary() };
  });
}
