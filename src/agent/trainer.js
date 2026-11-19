import * as tf from "@tensorflow/tfjs-node";
import { createDuelingModel } from "./dueling-dqn.js";
import { ReplayBuffer } from "./replay-buffer.js";
import { syncTargetNetwork } from "./target-network.js";
import { maskedArgmax } from "../environment/action-mask.js";
import { seededRandom } from "../utils/seed.js";

function chooseAction(values, mask, epsilon, random) {
  const feasible = mask.flatMap((allowed, action) => allowed ? [action] : []);
  if (!feasible.length) return -1;
  if (random() < epsilon) return feasible[Math.floor(random() * feasible.length)];
  return maskedArgmax(values, mask);
}

export async function trainDqn(envFactory, {
  episodes = 100,
  seed = 20261021,
  gamma = 0.99,
  learningRate = 0.001,
  batchSize = 32,
  replayCapacity = 10000,
  targetUpdateFrequency = 10,
  epsilon = 1,
  epsilonDecay = 0.995,
  minEpsilon = 0.05,
  rewardTransform = (reward) => reward,
  replayTransform = null,
  onEpisode
} = {}) {
  const probe = envFactory();
  const stateSize = probe.reset().length;
  const actionSize = probe.data.warehouses;
  const model = createDuelingModel(stateSize, actionSize, learningRate);
  const target = createDuelingModel(stateSize, actionSize, learningRate);
  syncTargetNetwork(target, model);
  const memory = new ReplayBuffer(replayCapacity);
  const random = seededRandom(seed);
  const history = [];

  for (let episode = 1; episode <= episodes; episode += 1) {
    const env = envFactory();
    let state = env.reset();
    let loss = null;
    let trainingReward = 0;
    let steps = 0;
    while (!env.done && steps < env.data.customers * env.data.warehouses) {
      const mask = env.getActionMask();
      const values = tf.tidy(() => model.predict(tf.tensor2d([state])).dataSync().slice());
      const action = chooseAction(values, mask, epsilon, random);
      const transition = env.step(action);
      const transformedReward = rewardTransform(transition.reward, { episode, step: steps, action });
      if (!Number.isFinite(transformedReward)) throw new Error("Reward transform must return a finite number");
      trainingReward += transformedReward;
      const sample = { state, action, reward: transformedReward, nextState: transition.state, done: transition.done, nextMask: transition.mask, source: "clean" };
      memory.add(replayTransform ? replayTransform(sample) : sample);
      state = transition.state;
      steps += 1;

      if (memory.length >= batchSize) {
        const batch = memory.sample(batchSize, random);
        const targets = await buildBellmanTargets(batch, model, target, gamma, actionSize);
        const xs = tf.tensor2d(batch.map((item) => item.state));
        const ys = tf.tensor2d(targets);
        const result = await model.fit(xs, ys, { epochs: 1, batchSize, verbose: 0 });
        loss = Number(result.history.loss.at(-1));
        xs.dispose();
        ys.dispose();
      }
    }
    if (steps >= env.data.customers * env.data.warehouses && !env.done) {
      throw new Error("Episode step limit reached before termination");
    }
    if (episode % targetUpdateFrequency === 0) syncTargetNetwork(target, model);
    epsilon = Math.max(minEpsilon, epsilon * epsilonDecay);
    const row = { episode, epsilon, loss, reward: -env.summary().totalCost, trainingReward, ...env.summary() };
    history.push(row);
    if (onEpisode) onEpisode(row);
  }
  return { model, target, history };
}

async function buildBellmanTargets(batch, model, target, gamma, actionSize) {
  const nextQ = tf.tidy(() => target.predict(tf.tensor2d(batch.map((item) => item.nextState))));
  const nextValues = await nextQ.array();
  nextQ.dispose();
  const currentQ = tf.tidy(() => model.predict(tf.tensor2d(batch.map((item) => item.state))));
  const targets = await currentQ.array();
  currentQ.dispose();
  for (let i = 0; i < batch.length; i += 1) {
    const item = batch[i];
    const feasible = item.nextMask.flatMap((allowed, action) =>
      allowed && Number.isFinite(nextValues[i][action]) ? [nextValues[i][action]] : []);
    const maxNext = feasible.length ? Math.max(...feasible) : 0;
    if (item.action >= 0 && item.action < actionSize) {
      targets[i][item.action] = item.reward + (item.done ? 0 : gamma * maxNext);
    }
  }
  return targets;
}
