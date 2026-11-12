/**
 * B7.0: when a compile builds `Deploy<C>`, and why it does not.
 *
 * A plain compile builds none. `deployer: true` concerns the contract being compiled only, and a contract that
 * cannot have one records the A4.1 reason and warns instead of failing.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';
import { asmToScript, computeCollectionHash, scriptToBytecode } from '@solidcash/utils';
import type { DeployerConstants } from '../src/generation/deployerConstants.js';

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

  it('derives the deployer constants from C\'s compile', () => {
    const source = `${P} contract C { mapping(int => int) m; int n;
      function bump() { n = n + 1; } }`;
    const box: { constants?: DeployerConstants } = {};
    const { artifact } = compile(source, { deployer: true, __deployerConstantsBox: box } as never);
    const constants = box.constants!;
    expect(constants.code).toEqual(scriptToBytecode(asmToScript(artifact.bytecode)));
    expect(constants.dataNftCount).toBe(artifact.stateLayout!.dataNftCount);
    const collection = constants.collections.find((candidate) => candidate.name === 'm')!;
    expect(collection.signature).toBe('m:mapping(int256 => int256)');
    expect(collection.hash).toEqual(computeCollectionHash(collection.signature));
    expect(constants.singleTokenContainer).toBe(false);
    expect(constants.singleTokenContainerKeys).toEqual([]);
  });

  it('derives the empty sorted-list HEAD and single-container keys', () => {
    const source = `${P} contract C { mapping(int => int) m; bytes32 t;
      function put(int k, int v) { m[k] = v; } }`;
    const box: { constants?: DeployerConstants } = {};
    const { artifact } = compile(source, { deployer: true, __deployerConstantsBox: box } as never);
    expect(artifact.stateLayout!.collections!.find((c) => c.name === 'm')!.sorted).toBe(true);
    const constants = box.constants!;
    const collection = constants.collections.find((candidate) => candidate.name === 'm')!;
    expect(collection.sorted).toBe(true);
    expect(collection.headCommitment).toEqual(new Uint8Array(128));
  });

  it('a supported stateful direct contract records no reason', () => {
    const { artifact } = compile(STATEFUL, { deployer: true });
    expect(artifact.deployerUnsupported).toBeUndefined();
    // The deployer program itself is B7.3; until it lands the artifact carries neither field.
    expect(artifact.deployer).toBeUndefined();
  });
});
