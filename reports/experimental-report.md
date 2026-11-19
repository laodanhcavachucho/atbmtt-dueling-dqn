# Experimental Defense Report

## 1. Objective and business model

This experiment evaluates capacitated warehouse allocation on `synthetic`
with 50 warehouses and 50 customers. Total cost is
fixed opening cost plus transportation cost plus unmet-demand and invalid-action
penalties. A warehouse opening cost is charged once.

## 2. MDP

The state is normalized residual capacity, open status, normalized transport
costs for the current customer, and the current residual demand ratio. For the
target 50x50 dataset this is 151 dimensions.
An action selects a warehouse. Action masking rejects exhausted capacity,
customer-limit violations, and invalid transport costs. The reward is the
negative incremental business cost; terminal unmet demand is penalized.

## 3. Agent and threat model

The baseline agent is a Dueling DQN when a compatible TensorFlow.js checkpoint
is available; the local reproducible defense evaluation also contains a greedy
feasible policy so the environment and defenses can be measured without
inventing DQN results. The attacker can alter only the inference state vector
and cannot change weights, source data, or external systems. Rule perturbation
epsilon in this run is 0.1.

## 4. Defenses

- Input sanitization rejects wrong dimensions, non-numeric values, NaN,
  Infinity, values outside [0,1], and distribution outliers.
- Anomaly threshold is fitted from clean validation states, not test states.
- Adversarial-training code marks replay samples with source metadata and saves
  to a separate checkpoint path when training is available. It is not claimed
  to be min-max training.
- Safety guardrails re-check the action mask, apply a validation-derived cost
  threshold when configured, and use a feasible fallback.

## 5. Results

```json
{
  "baseline_clean": {
    "episodes": 5,
    "meanTotalCost": 656353,
    "meanFixedCost": 209147,
    "meanTransportCost": 447206,
    "meanUnservedDemand": 0,
    "invalidActionRate": 0,
    "attackSuccessRate": 0,
    "detectionRate": 0,
    "falsePositiveRate": 0,
    "meanInferenceOverheadMs": 0.027196271186440364,
    "measurementStatus": "measured"
  },
  "under_attack": {
    "episodes": 5,
    "meanTotalCost": 1032957.6,
    "meanFixedCost": 187410.2,
    "meanTransportCost": 845547.4,
    "meanUnservedDemand": 0,
    "invalidActionRate": 0,
    "attackSuccessRate": 1,
    "detectionRate": 1,
    "falsePositiveRate": null,
    "meanInferenceOverheadMs": 0.033026601995395075,
    "measurementStatus": "measured"
  },
  "input_sanitization": {
    "episodes": 5,
    "meanTotalCost": 725979,
    "meanFixedCost": 203643,
    "meanTransportCost": 522336,
    "meanUnservedDemand": 0,
    "invalidActionRate": 0,
    "attackSuccessRate": 1,
    "detectionRate": 1,
    "falsePositiveRate": null,
    "meanInferenceOverheadMs": 0.01925442622950812,
    "measurementStatus": "measured"
  },
  "adversarial_training": {
    "episodes": 5,
    "meanTotalCost": 1032957.6,
    "meanFixedCost": 187410.2,
    "meanTransportCost": 845547.4,
    "meanUnservedDemand": 0,
    "invalidActionRate": 0,
    "attackSuccessRate": 1,
    "detectionRate": 1,
    "falsePositiveRate": null,
    "meanInferenceOverheadMs": 0.023981523921250265,
    "measurementStatus": "not_trained_without_tfjs_native"
  },
  "safety_guardrails": {
    "episodes": 5,
    "meanTotalCost": 1032957.6,
    "meanFixedCost": 187410.2,
    "meanTransportCost": 845547.4,
    "meanUnservedDemand": 0,
    "invalidActionRate": 0,
    "attackSuccessRate": 1,
    "detectionRate": 1,
    "falsePositiveRate": null,
    "meanInferenceOverheadMs": 0.021430618297661252,
    "measurementStatus": "measured"
  },
  "combined_defense": {
    "episodes": 5,
    "meanTotalCost": 725979,
    "meanFixedCost": 203643,
    "meanTransportCost": 522336,
    "meanUnservedDemand": 0,
    "invalidActionRate": 0,
    "attackSuccessRate": 1,
    "detectionRate": 1,
    "falsePositiveRate": null,
    "meanInferenceOverheadMs": 0.02786393442623074,
    "measurementStatus": "measured"
  }
}
```

## 6. Limitations

The source data has no ground-truth attack labels. Therefore precision,
recall, and false-positive estimates are limited; the recorded clean-state
detector run reports this explicitly. A native TensorFlow.js binding and
baseline checkpoint are required for measured DQN FGSM and adversarial
training. No result is replaced with a target or reference cost.
