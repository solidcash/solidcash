import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

const handler = (body: string): NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number]
| undefined => compileString(`contract C() {
  mapping(int => int) slots;
  function write(int count, int seed, int step) public {
    int[] keys = new int[](count);
    ${body}
    require(true);
  }
}`, KERNEL).messageBus?.handlers.find((candidate) => candidate.name === 'write');

const eligibility = (body: string): boolean | undefined => handler(body)?.eligible;

describe('constructed-array tail replacement kernel admission', () => {
  it('replays a pop-then-push replacement after discarding the prior iteration tail', () => {
    expect(eligibility(`for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      keys.pop();
      keys.push(seed + cursor);
      this.slots[keys[cursor]] = cursor;
    }`)).toBe(true);
  });

  it('keeps a multi-site generic replacement suffix behind the layout fence', () => {
    expect(handler(`for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      keys.pop();
      keys.pop();
      this.slots[keys[0]] = cursor;
      keys.push(seed + cursor);
      this.slots[keys[count - 2]] = cursor + 10;
      keys.push(seed + cursor + 1);
      this.slots[keys[count - 1]] = cursor + 20;
    }`)).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('replays a conditional replacement arm with a canonical runtime step', () => {
    expect(eligibility(`for (int cursor = 0; cursor < count; cursor = cursor + step) {
      if (seed > 0) {
        keys.pop();
        this.slots[keys[0]] = cursor;
        keys.push(seed + cursor);
      }
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
    ['mutates its canonical runtime step', `for (int cursor = 0; cursor < count; cursor = cursor + step) {
      keys.pop(); keys.push(seed + cursor); step = step + 1;
      this.slots[keys[0]] = cursor;
    }`],
    ['mixes a selected write into the surviving prefix', `for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      keys.pop(); keys[0] = seed; keys.push(seed + cursor);
      this.slots[keys[0]] = cursor;
    }`],
    ['selects replacement with the changing logical counter', `for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      if (cursor % 2 == 0) { keys.pop(); keys.push(seed + cursor); }
      this.slots[keys[0]] = cursor;
    }`],
    ['can continue before restoring the discarded suffix', `for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      keys.pop(); if (seed == 0) { continue; } keys.push(seed + cursor);
      this.slots[keys[0]] = cursor;
    }`],
  ])('keeps fenced a schedule which %s', (_label, loop) => {
    expect(eligibility(loop)).toBe(false);
  });

  it('fails closed when finite replacement alternatives exceed the 256-path budget', () => {
    const arms = Array.from({ length: 257 }, (_, index) => `
      case ${index}: keys.pop(); keys.push(seed + cursor);`).join('');
    expect(eligibility(`for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      switch (seed) { ${arms} default: require(true); }
      this.slots[keys[0]] = cursor;
    }`)).toBe(false);
  });
});
