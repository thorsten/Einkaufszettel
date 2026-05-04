export class Lamport {
  private value: number;

  constructor(initial = 0) {
    this.value = initial;
  }

  current(): number {
    return this.value;
  }

  observe(seen: number): void {
    if (Number.isFinite(seen) && seen > this.value) {
      this.value = seen;
    }
  }

  tick(): number {
    this.value += 1;
    return this.value;
  }
}
