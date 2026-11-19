import fs from "node:fs/promises";
import * as tf from "@tensorflow/tfjs-node";

export async function saveCheckpoint(model, directory) {
  await fs.mkdir(directory, { recursive: true });
  await model.save(`file://${directory}`);
}

export async function loadCheckpoint(directory) {
  return tf.loadLayersModel(`file://${directory}/model.json`);
}
