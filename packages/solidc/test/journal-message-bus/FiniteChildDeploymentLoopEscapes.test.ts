import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

type Handler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const select = (loop: string): Handler => {
  const artifact = compileString(`
    contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
    contract Store() {
      bool stopped;
      function apply(bool skip) public {
        ${loop}
        require(true);
      }
    }
  `, KERNEL);
  const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
  expect(handler).toBeDefined();
  return handler!;
};

const evaluateIntegerRecipe = (recipe: unknown): bigint | undefined => {
  if (!recipe || typeof recipe !== 'object') return undefined;
  const value = recipe as { kind?: string; value?: string; operator?: string; left?: unknown; right?: unknown };
  if (value.kind === 'intLiteral' && value.value !== undefined) return BigInt(value.value);
  if (value.kind !== 'binary') return undefined;
  const left = evaluateIntegerRecipe(value.left);
  const right = evaluateIntegerRecipe(value.right);
  if (left === undefined || right === undefined) return undefined;
  if (value.operator === '+') return left + right;
  if (value.operator === '-') return left - right;
  return undefined;
};

const constructorLiterals = (handler: Handler): string[] => (handler.childDeployments ?? []).map((site) => {
  const value = evaluateIntegerRecipe(site.constructorArgs[0]);
  expect(value).toBeDefined();
  return value!.toString();
});

describe('finite child-deployment loops with source escapes', () => {
  it('replays a statically selected continue before deployment', () => {
    const handler = select(`for (int i = 0; i < 5; i = i + 1) {
      if (i % 2 == 0) continue;
      Unit child = new Unit(i);
    }`);
    expect(handler).toMatchObject({ eligible: true });
    expect(constructorLiterals(handler)).toEqual(['1', '3']);
  });

  it('stops before the statically selected break iteration', () => {
    const handler = select(`for (int i = 0; i < 5; i = i + 1) {
      if (i == 2) break;
      Unit child = new Unit(i);
    }`);
    expect(handler).toMatchObject({ eligible: true });
    expect(constructorLiterals(handler)).toEqual(['0', '1']);
  });

  it('retains effects preceding a static break in source order', () => {
    const handler = select(`for (int i = 0; i < 5; i = i + 1) {
      Unit child = new Unit(i);
      if (i == 2) break;
    }`);
    expect(handler).toMatchObject({ eligible: true });
    expect(constructorLiterals(handler)).toEqual(['0', '1', '2']);
  });

  it('preserves per-iteration order when continue skips a later deployment site', () => {
    const handler = select(`for (int i = 0; i < 3; i = i + 1) {
      Unit first = new Unit(i);
      if (i % 2 == 0) continue;
      Unit second = new Unit(i + 10);
    }`);
    expect(handler).toMatchObject({ eligible: true });
    expect(constructorLiterals(handler)).toEqual(['0', '1', '11', '2']);
    expect(handler.childDeployments?.map((site) => site.siteIndex)).toEqual([0, 1, 2, 3]);
    expect(handler.childDeployments?.map((site) => site.spanOffset)).toEqual([0, 2, 4, 6]);
  });

  it('replays non-unit iteration steps before applying continue and break', () => {
    const handler = select(`for (int i = 1; i < 9; i = i + 2) {
      if (i == 3) continue;
      Unit child = new Unit(i);
      if (i == 7) break;
    }`);
    expect(handler).toMatchObject({ eligible: true });
    expect(constructorLiterals(handler)).toEqual(['1', '5', '7']);
  });

  it('erases a statically unreachable deployment suffix', () => {
    const handler = select(`for (int i = 0; i < 3; i = i + 1) {
      if (i == 0) break;
      Unit child = new Unit(i);
    }`);
    expect(handler).toMatchObject({ eligible: true });
    expect(handler.childDeployments ?? []).toEqual([]);
  });

  it.each([
    ['runtime continue', 'if (skip) continue;'],
    ['runtime break', 'if (skip) break;'],
    ['state-derived continue', 'if (this.stopped) continue;'],
    ['state-derived break', 'if (this.stopped) break;'],
  ])('fences %s because its deployment activation set is not static', (_label, escape) => {
    const handler = select(`for (int i = 0; i < 3; i = i + 1) {
      ${escape}
      Unit child = new Unit(i);
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
