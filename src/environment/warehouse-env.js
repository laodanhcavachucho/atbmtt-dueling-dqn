import { validateDataset } from "../data/validator.js";
import { buildState } from "./state-builder.js";
import { getActionMask } from "./action-mask.js";

export class WarehouseEnv {
  constructor(data, { penalty = 1000, invalidActionPenalty = penalty } = {}) {
    validateDataset(data);
    this.data = data;
    this.penalty = penalty;
    this.invalidActionPenalty = invalidActionPenalty;
    this.reset();
  }

  reset() {
    const { warehouses, customers } = this.data;
    this.currentCustomer = 0;
    this.served = Array(customers).fill(0);
    this.open = Array(warehouses).fill(false);
    this.usedCapacity = Array(warehouses).fill(0);
    this.usedCustomers = Array(warehouses).fill(0);
    this.customerAssignments = Array(customers).fill(0);
    this.fixedCost = 0;
    this.transportCost = 0;
    this.unservedPenalty = 0;
    this.invalidActionCost = 0;
    this.invalidActions = 0;
    this.assignments = [];
    this.done = false;
    return this.getState();
  }

  getState() {
    return buildState(this);
  }

  state() {
    return this.getState();
  }

  getActionMask() {
    return getActionMask(this);
  }

  actionMask() {
    return this.getActionMask();
  }

  step(action) {
    if (this.done) throw new Error("Episode has ended; call reset() before step()");
    const mask = this.getActionMask();
    if (!Number.isInteger(action) || action < 0 || action >= this.data.warehouses || !mask[action]) {
      this.invalidActions += 1;
      this.invalidActionCost += this.invalidActionPenalty;
      this.done = true;
      const terminalPenalty = this.recordUnservedPenalty();
      return this.transition(-(this.invalidActionPenalty + terminalPenalty), true, true);
    }

    const customer = this.currentCustomer;
    const warehouse = action;
    const remaining = this.data.demand[customer] - this.served[customer];
    const available = this.data.capacity[warehouse] - this.usedCapacity[warehouse];
    const quantity = Math.min(remaining, available);
    const openingCost = this.open[warehouse] ? 0 : this.data.fixedCost[warehouse];
    const transport = quantity * this.data.transportCost[customer][warehouse];

    this.open[warehouse] = true;
    this.fixedCost += openingCost;
    this.transportCost += transport;
    this.usedCapacity[warehouse] += quantity;
    this.usedCustomers[warehouse] += 1;
    this.served[customer] += quantity;
    this.customerAssignments[customer] += 1;
    this.assignments.push({ customer, warehouse, quantity, openingCost, transportCost: transport });

    let terminalPenalty = 0;
    if (this.served[customer] >= this.data.demand[customer]) {
      this.currentCustomer += 1;
    }
    if (this.currentCustomer >= this.data.customers) {
      this.done = true;
    } else if (this.getActionMask().every((allowed) => !allowed)) {
      this.done = true;
      terminalPenalty = this.recordUnservedPenalty();
    }

    return this.transition(-(openingCost + transport + terminalPenalty), this.done, false);
  }

  recordUnservedPenalty() {
    const unmet = this.unservedDemand();
    const penalty = unmet * this.penalty;
    this.unservedPenalty += penalty;
    return penalty;
  }

  transition(reward, done, invalid) {
    return {
      state: this.getState(),
      reward,
      done,
      invalid,
      mask: this.getActionMask()
    };
  }

  unservedDemand() {
    return this.data.demand.reduce(
      (total, demand, customer) => total + Math.max(0, demand - this.served[customer]),
      0
    );
  }

  summary() {
    const servedCustomers = this.data.demand.filter(
      (demand, customer) => this.served[customer] >= demand
    ).length;
    return {
      totalCost: this.fixedCost + this.transportCost + this.unservedPenalty + this.invalidActionCost,
      fixedCost: this.fixedCost,
      transportCost: this.transportCost,
      unservedPenalty: this.unservedPenalty,
      invalidActionCost: this.invalidActionCost,
      servedCustomers,
      unservedDemand: this.unservedDemand(),
      openedWarehouses: this.open.filter(Boolean).length,
      invalidActions: this.invalidActions,
      steps: this.assignments.length,
      assignments: this.assignments
    };
  }
}
