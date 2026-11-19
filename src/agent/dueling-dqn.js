import * as tf from "@tensorflow/tfjs-node";

export function createDuelingModel(stateSize, actionSize, learningRate = 0.001) {
  const input = tf.input({ shape: [stateSize] });
  const hidden = tf.layers.dense({ units: 128, activation: "relu" }).apply(input);
  const value = tf.layers.dense({ units: 64, activation: "relu" }).apply(hidden);
  const advantage = tf.layers.dense({ units: 64, activation: "relu" }).apply(hidden);
  const v = tf.layers.dense({ units: 1 }).apply(value);
  const a = tf.layers.dense({ units: actionSize }).apply(advantage);
  const mean = tf.layers.lambda({ function: (x) => tf.mean(x, 1, true) }).apply(a);
  const q = tf.layers.add().apply([v, tf.layers.subtract().apply([a, mean])]);
  const model = tf.model({ inputs: input, outputs: q });
  model.compile({ optimizer: tf.train.adam(learningRate), loss: "meanSquaredError" });
  return model;
}

export function maskedQMax(qValues, mask) {
  return qValues.map((row) => Math.max(...row.map((v, i) => mask[i] ? v : -Infinity)));
}
