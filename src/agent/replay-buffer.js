export class ReplayBuffer {
  constructor(capacity = 10000) { this.capacity = capacity; this.items = []; }
  add(item) { if (this.items.length >= this.capacity) this.items.shift(); this.items.push(item); }
  sample(size, random = Math.random) { const copy = [...this.items], out = []; while (copy.length && out.length < size) out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]); return out; }
  get length() { return this.items.length; }
}
