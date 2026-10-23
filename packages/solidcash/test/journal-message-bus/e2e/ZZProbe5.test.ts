import { compileString } from '@solidcash/solidc';
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 } as const;
const SOURCE = `contract PooledWriter() {
  struct Item { int amount; string label; bool active; }
  Item[] items;
  function append(int amount, string label) public returns (int) {
    this.items.push();
    int id = this.items.length - 1;
    this.items[id].amount = amount;
    this.items[id].label = label;
    require(true);
    return id;
  }
  function check(int id, int amount) public { require(this.items[id].amount == amount); }
}`;
describe('probe', () => {
  it('shape', () => {
    try {
      const artifact = compileString(SOURCE, KERNEL);
      writeFileSync('/tmp/probe5.json', JSON.stringify({
        convention: artifact.messageBus?.convention,
        handlers: (artifact.messageBus?.handlers ?? []).map((h) => `${h.name}:${h.eligible}`),
      }, null, 1));
    } catch (error) {
      writeFileSync('/tmp/probe5.json', JSON.stringify({ error: String(error).slice(0, 400) }, null, 1));
    }
  });
});
