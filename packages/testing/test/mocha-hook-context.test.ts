import { expect, vi } from 'vitest';

// Exercise the shipped setup and real Vitest hook parser without initializing a contract project.
vi.mock('../src/index.js', () => ({ initHre: async () => ({ ethers: { provider: {} } }) }));
vi.mock('../src/chai.js', () => ({}));

await import('../src/vitest-setup.js');

type MochaContext = Record<string, unknown>;
type Callback = (this: MochaContext, ...args: unknown[]) => unknown;
type Hook = (fn: Callback) => unknown;
const mocha = globalThis as unknown as {
  before: Hook;
  after: Hook;
  beforeEach: Hook;
  afterEach: Hook;
  it: (name: string, fn: Callback) => unknown;
};

const calls: string[] = [];
const shared = {};

mocha.before(async function setup(...args): Promise<void> {
  calls.push('before');
  this.shared = shared;
  expect(args).toHaveLength(2);
  expect(args[0]).toEqual({});
  expect(args[1]).toHaveProperty('type', 'suite');
  await Promise.resolve();
  calls.push('before:awaited');
});

mocha.beforeEach(function setupEach(context): void {
  expect(this.shared).toBe(shared);
  expect(context).toHaveProperty('task');
  calls.push('beforeEach');
});

mocha.afterEach(function cleanupEach(context): void {
  expect(this.shared).toBe(shared);
  expect(context).toHaveProperty('task');
  calls.push('afterEach');
});

mocha.after(async function cleanup(...args): Promise<void> {
  expect(this.shared).toBe(shared);
  expect(args).toHaveLength(2);
  expect(args[1]).toHaveProperty('type', 'suite');
  await Promise.resolve();
  expect(calls).toEqual([
    'before', 'before:awaited',
    'beforeEach', 'sync', 'afterEach',
    'beforeEach', 'async', 'async:awaited', 'afterEach',
  ]);
});

mocha.it('runs a synchronous callback with shared Mocha context and Vitest arguments', function sync(context): void {
  expect(this.shared).toBe(shared);
  expect(context).toHaveProperty('task.name', 'runs a synchronous callback with shared Mocha context and Vitest arguments');
  expect(calls).toEqual(['before', 'before:awaited', 'beforeEach']);
  calls.push('sync');
});

mocha.it('awaits an asynchronous callback before the cleanup hook', async function asynchronous(): Promise<void> {
  expect(this.shared).toBe(shared);
  calls.push('async');
  await Promise.resolve();
  calls.push('async:awaited');
});
