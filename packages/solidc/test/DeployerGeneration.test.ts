/**
 * B7.0: when a compile builds `Deploy<C>`, and why it does not.
 *
 * A plain compile builds none. `deployer: true` concerns the contract being compiled only, and a contract that
 * cannot have one records the A4.1 reason and warns instead of failing.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const P = 'pragma solidcash ^0.50.0;';
const STATEFUL = `${P} contract C { int n; function bump() { n = n + 1; } }`;

const compile = (source: string, options: Record<string, unknown>): {
  artifact: ReturnType<typeof compileString>;
  warnings: string[];
} => {
  const warnings: string[] = [];
  const artifact = compileString(source, { messageBus: false, warningListener: (warning) => warnings.push(warning.message), ...options });
  return { artifact, warnings };
};

describe('B7.0: when a deployer is built', () => {
  it('a plain compile builds no deployer and records no reason', () => {
    const { artifact, warnings } = compile(STATEFUL, {});
    expect(artifact.deployer).toBeUndefined();
    expect(artifact.deployerUnsupported).toBeUndefined();
    expect(warnings.some((warning) => warning.includes('no deployer'))).toBe(false);
  });

  it('a stateless contract asked for a deployer warns and records not-stateful-direct', () => {
    const source = `${P} contract S { function f(int x) { require(x == 1); } }`;
    const { artifact, warnings } = compile(source, { deployer: true });
    expect(artifact.deployerUnsupported).toBe('not-stateful-direct');
    expect(artifact.deployer).toBeUndefined();
    expect(warnings.some((warning) => warning.includes('no deployer (not-stateful-direct)'))).toBe(true);
  });

  it('a blockhash reader records blockhash-ring', () => {
    const source = `${P} contract B { int n; function f(bytes32 h) { require(blockhash(n) == h); } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.deployerUnsupported).toBe('blockhash-ring');
  });

  it('a message-bus compile records lock-composition', () => {
    const source = `${P} contract C { int n; function a() { n = n + 1; } function b() { n = n + 2; } }`;
    const { artifact, warnings } = compile(source, { deployer: true, messageBus: true });
    expect(artifact.deployerUnsupported).toBe('lock-composition');
    expect(warnings.some((warning) => warning.includes('lock-composition'))).toBe(true);
  });

  it('a struct constructor parameter records param-type', () => {
    const source = `${P} struct P { int x; } contract C { int n; constructor(P p) { n = p.x; } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.deployerUnsupported).toBe('param-type');
  });

  it('records that the constructor writes a collection', () => {
    const source = `${P} contract C { mapping(int => int) m; int n;
      constructor() { m[1] = 2; } function bump() { n = n + 1; } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.constructorWritesCollections).toBe(true);
  });

  it('a supported stateful direct contract records no reason', () => {
    const { artifact } = compile(STATEFUL, { deployer: true });
    expect(artifact.deployerUnsupported).toBeUndefined();
    // The deployer program itself is B7.3; until it lands the artifact carries neither field.
    expect(artifact.deployer).toBeUndefined();
  });
});
