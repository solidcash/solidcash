import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

const eligibility = (body: string): boolean | undefined => compileString(`contract C() {
  mapping(int => int) slots;
  function write(int count, int seed) public {
    int[] keys = new int[](count);
    ${body}
    require(true);
  }
}`, KERNEL).messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible;

describe('constructed-array tail replacement kernel admission', () => {
  it('replays a pop-then-push replacement after discarding the prior iteration tail', () => {
    expect(eligibility(`for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      keys.pop();
      keys.push(seed + cursor);
      this.slots[keys[cursor]] = cursor;
    }`)).toBe(true);
  });

  it('replays a fixed-width generic replacement suffix in source order', () => {
    expect(eligibility(`for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      keys.pop();
      keys.pop();
      this.slots[keys[0]] = cursor;
      keys.push(seed + cursor);
      this.slots[keys[count - 2]] = cursor + 10;
      keys.push(seed + cursor + 1);
      this.slots[keys[count - 1]] = cursor + 20;
    }`)).toBe(true);
  });

  it.each([
    ['observes the prior tail before discarding it', `for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.slots[keys[count - 1]] = cursor;
      keys.pop(); keys.push(seed + cursor);
    }`],
    ['only partially discards a two-element replacement suffix', `for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      keys.pop();
      this.slots[keys[count - 2]] = cursor;
      keys.pop(); keys.push(seed + cursor); keys.push(seed + cursor + 1);
    }`],
    ['changes the array length at the iteration boundary', `for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      keys.pop(); keys.push(seed + cursor); keys.push(seed + cursor + 1);
      this.slots[keys[count]] = cursor;
    }`],
    ['conditionally mutates the old suffix', `for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      if (seed > 0) { keys.pop(); }
      keys.push(seed + cursor);
      this.slots[keys[cursor]] = cursor;
    }`],
  ])('keeps fenced a schedule which %s', (_label, loop) => {
    expect(eligibility(loop)).toBe(false);
  });
});
