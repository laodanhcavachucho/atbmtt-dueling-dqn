export function syncTargetNetwork(target, source) { target.setWeights(source.getWeights().map((x) => x.clone())); }
