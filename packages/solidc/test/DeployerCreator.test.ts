/**
 * B8: the creator side. With `__deployerNew` on, a direct creator's `new C(…)` binds the Deploy<C> input at the
 * site instead of embedding C's code, and publishes C's deployer as `childDeployers`.
 *
 * These tests drive the real compiler: they assert the artifact facts, the emitted binding bytes and the
 * refusals of B8.2 to B8.4. The VM-level binding attacks live beside the `create` VM tests (B7.16).
 */
import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

const P = 'pragma solidcash ^0.50.0;';
const OPTIONS = { __deployerNew: true } as const;

const compile = (source: string, options: Record<string, unknown> = {}): Artifact =>
  compileString(source, { ...OPTIONS, ...options });

const refusal = (source: string, pattern: RegExp): void => {
  expect(() => compile(source)).toThrow(pattern);
};

const statefulChild = (name = 'Child'): string =>
  `contract ${name} { int n; function bump() { n = n + 1; } }`;

describe('B8.0: a deployer child is compiled standalone and published', () => {
  it('publishes the child deployer and matches a deployer: true compile', () => {
    const source = `${P} ${statefulChild()}
      contract Parent { int m; function make() { Child c = new Child(); m = 1; } }`;
    const creator = compile(source);
    const child = compileString(statefulChild(), { deployer: true });
    expect(Object.keys(creator.childDeployers ?? {})).toEqual(['Child']);
    expect(creator.childDeployers!.Child.lockingBytecode).toBe(child.deployer!.lockingBytecode);
    expect(creator.childDeployers!.Child.bytecode).toBe(child.deployer!.bytecode);
    expect(creator.childDeployers!.Child.code).toBe(child.deployer!.code);
  });

  it('leaves a stateless child out of the map and keeps today\'s embedding', () => {
    const source = `${P} contract S { function f() { require(true); } }
      contract Parent { int m; function make() { S s = new S(); m = 1; } }`;
    const creator = compile(source);
    expect(creator.childDeployers).toBeUndefined();
  });

  it('binds each level of a nested creator to its own child deployer', () => {
    const source = `${P} ${statefulChild('G')}
      contract C { int y; function mk() { G g = new G(); y = 1; } }
      contract F { int x; function mk() { C c = new C(); x = 1; } }`;
    const outer = compileString(source, { __deployerNew: true, primaryContractName: 'F' } as never);
    expect(Object.keys(outer.childDeployers ?? {})).toEqual(['C']);
    const inner = compileString(source, { __deployerNew: true, primaryContractName: 'C' } as never);
    expect(Object.keys(inner.childDeployers ?? {})).toEqual(['G']);
  });

  it('compiles a creator with no state variable and no event', () => {
    const source = `${P} ${statefulChild()} contract Parent { function make() { Child c = new Child(); require(c.length > 0); } }`;
    const artifact = compile(source, { allowUnsafeOperations: true });
    expect(Object.keys(artifact.childDeployers ?? {})).toEqual(['Child']);
  });

  it('binds the deployer by default', () => {
    const source = `${P} ${statefulChild()}
      contract Parent { int m; function make() { Child c = new Child(); m = 1; } }`;
    const creator = compileString(source, { allowUnsafeOperations: true } as never);
    expect(Object.keys(creator.childDeployers ?? {})).toEqual(['Child']);
    expect(creator.bytecode).toContain('OP_INPUTBYTECODE');
  });

  it('refuses a contract that creates itself', () => {
    const source = `${P} contract C { int n; function make() { C c = new C(); n = 1; } }`;
    refusal(source, /creates itself/);
  });
});

describe('B8.6: the site binds the deployer instead of embedding the child', () => {
  const binding = (source: string): string => compile(source).bytecode.replace(/\s+/g, ' ');

  it('compares the six-byte selector prefix and reads OP_INPUTBYTECODE', () => {
    const source = `${P} ${statefulChild()}
      contract Parent { int m; function make() { Child c = new Child(); m = 1; } }`;
    const asm = binding(source);
    // push(0x04 ‖ af341413 ‖ byte(0)): the create selector and an empty callee list.
    expect(asm).toContain('OP_6 OP_SPLIT OP_SWAP 04af34141300 OP_EQUALVERIFY');
    expect(asm).toContain('OP_INPUTBYTECODE OP_6 OP_SPLIT');
  });

  it('binds two call slots with a two-byte long callee list at byte 6', () => {
    const source = `${P} interface IA { function f(int x) external returns (bool); }
      interface IB { function g(int x) external returns (bool); }
      contract Child { int n; constructor(address a, address b) { IA(a).f(1); IB(b).g(2); n = 1; } }
      contract Parent { int m; function make(address a, address b) { Child c = new Child(a, b); m = 1; } }`;
    const creator = compile(source);
    expect(creator.childDeployers!.Child.callSlots).toBe(2);
    expect(binding(source)).toContain('04af34141304');
  });

  it('gets the arguments from args and the parentheses from the constructor', () => {
    const source = `${P} contract Child(int limit, bytes20 tag) {
        int n; constructor(int start) { n = start + limit; }
        function bump() { n = n + 1; } }
      contract Parent { int m; function make(int limit, bytes20 tag, int start) {
        Child c = new Child{args: (limit, tag)}(start); m = 1; } }`;
    const creator = compile(source);
    const target = creator.abi.find((entry) => entry.name === 'make')!.deployTargets![0];
    expect(target.contractName).toBe('Child');
    expect(target.contractArgs).toEqual(['limit', 'tag']);
    expect(target.constructorArgs).toEqual(['start']);
    expect(target.creationBytecode).toBe(creator.childDeployers!.Child.code);
    expect(target.dataNftCount).toBe(1);
  });

  it('records the value source for a payable child', () => {
    const source = `${P} contract Child { int n; constructor(int a) payable { n = a; }
        function bump() { n = n + 1; } }
      contract Parent { int m; function make(int v) { Child c = new Child{value: v}(7); m = 1; } }`;
    const creator = compile(source);
    const target = creator.abi.find((entry) => entry.name === 'make')!.deployTargets![0];
    expect(target.valueArg).toBe('v');
    expect(target.constructorArgs).toEqual([null]);
    expect(target.contractArgs).toEqual([]);
  });

  it('keeps the whole child genesis range in the layout', () => {
    const source = `${P} ${statefulChild()}
      contract Parent { int m; function make() { Child c = new Child(); m = 1; } }`;
    const creator = compile(source);
    expect(creator.childDeployers!.Child.genesisOutputs).toBe(2);
    expect(creator.bytecode).toContain('OP_INPUTBYTECODE');
  });

  it('compiles a site in a branch and refuses one in a loop', () => {
    expect(() => compile(`${P} ${statefulChild()}
      contract Parent { int m; function make(int x) { if (x > 0) { Child c = new Child(); } m = 1; } }`))
      .not.toThrow();
    refusal(`${P} ${statefulChild()}
      contract Parent { int m; function make(int n) { for (int i = 0; i < n; i = i + 1) { Child c = new Child(); } m = 1; } }`,
    /in a loop is not available/);
  });
});

describe('B8.2/B8.3: the argument forms and their diagnostics', () => {
  const both = `${P} contract Child(int x) { int n; constructor(int a) { n = a + x; }
      function bump() { n = n + 1; } }`;
  const contractOnly = `${P} contract Child(int x) { int n; function bump() { n = n + 1; } }`;
  const ctorOnly = `${P} contract Child { int n; constructor(int a) payable { n = a; }
      function bump() { n = n + 1; } }`;

  it('requires args when the child has both kinds of parameter', () => {
    refusal(`${P} ${both} contract Parent { int m; function make(int v, int a) {
      Child c = new Child(v, a); m = 1; } }`, /has contract parameters and constructor parameters/);
  });

  it('refuses the wrong number of args', () => {
    refusal(`${P} ${contractOnly} contract Parent { int m; function make(int v) {
      Child c = new Child{args: (v, v)}(); m = 1; } }`, /takes 1 contract parameter/);
  });

  it('refuses args on a child with no contract parameters', () => {
    refusal(`${P} ${ctorOnly} contract Parent { int m; function make(int v) {
      Child c = new Child{args: (v)}(v); m = 1; } }`, /has no contract parameters/);
  });

  it('refuses args on a stateless child', () => {
    refusal(`${P} contract S { function f() { require(true); } }
      contract Parent { int m; function make(int v) { S s = new S{args: (v)}(); m = 1; } }`,
    /args-outside-deployer-new/);
  });

  it('applies the compatibility rule with a warning', () => {
    const warnings: string[] = [];
    compile(`${P} ${contractOnly} contract Parent { int m; function make(int v) {
      Child c = new Child(v); m = 1; } }`, { warningListener: (warning: { message: string }) => warnings.push(warning.message) });
    expect(warnings.some((warning) => warning.includes('fills its contract parameters'))).toBe(true);
  });

  it('refuses salt on a deployer new', () => {
    refusal(`${P} ${contractOnly} contract Parent { int m; function make(int v, bytes s) {
      Child c = new Child{args: (v), salt: s}(); m = 1; } }`, /salt.*not available/);
  });

  it('refuses a value below the reserve', () => {
    refusal(`${P} ${ctorOnly} contract Parent { int m; function make() {
      Child c = new Child{value: 500}(1); m = 1; } }`, /cannot be opened with 500 satoshis/);
  });

  it('refuses a value when the child has no satoshi container', () => {
    refusal(`${P} contract C { int n; function bump() { n = n + 1; } }
      contract Parent { int m; function make() { C c = new C{value: 5000}(); m = 1; } }`,
    /no satoshi container row/);
  });

  it('refuses a child that reads block data', () => {
    refusal(`${P} contract C { int n; constructor() { n = 1; }
      function bump() { n = int(block.number); } }
      contract Parent { int m; function make() { C c = new C(); m = 1; } }`,
    /child-reads-block-data/);
  });

  it('refuses a second coin at a container the child keeps single', () => {
    refusal(`${P} pragma satoshicontainer single;
      contract Child { int n; constructor() payable { n = msg.value; }
        function bump() { n = n + 1; } }
      contract Parent { int m; function make() { Child c = new Child(); this.transfer(c, 1000); m = 1; } }`,
    /second-coin-at-single-container/);
  });

  it('refuses a deployer new in a fallback', () => {
    refusal(`${P} ${statefulChild()} contract Parent { int m;
      receive() external payable { m = 1; }
      fallback() external payable { Child c = new Child(); m = 2; } }`,
    /creator-shape/);
  });
});

describe('B8.7: a marked creator lists the children it makes', () => {
  const senderReader = `${P} contract Child { address owner; constructor() { owner = msg.sender; }
      function bump() { owner = owner; } }`;
  const creator = `${P} ${senderReader}
    contract Parent { int m; function make() { Child c = new Child(); m = 1; } }`;

  it('publishes the flag and the creator code-marker bit', () => {
    const artifact = compile(creator);
    expect(artifact.createsSenderReadingChildren).toBe(true);
    // The marker is `15 ‖ MAGIC ‖ flags ‖ 75` at the code's end; bit 0 is the marked creator.
    expect(artifact.bytecode).toContain('1744a65e30fda2209c561da7e1920101f44c313a03');
    expect(artifact.bytecode).toContain('OP_INPUTBYTECODE');
    expect(artifact.bytecode).toContain('OP_SHA256');
  });

  it('leaves a creator of a child that does not read the sender unmarked', () => {
    const artifact = compile(`${P} ${statefulChild()}
      contract Parent { int m; function make() { Child c = new Child(); m = 1; } }`);
    expect(artifact.createsSenderReadingChildren).toBeUndefined();
    expect(artifact.bytecode).not.toContain('OP_SHA256');
  });

  it('refuses a fallback on a marked creator', () => {
    refusal(`${P} ${senderReader} contract Parent { int m;
      receive() external payable { m = 1; }
      fallback() external payable { m = 2; }
      function make() { Child c = new Child(); m = 3; } }`, /creator-shape/);
  });

  it('refuses a sender-reading new in receive', () => {
    refusal(`${P} ${senderReader} contract Parent { int m;
      receive() external payable { Child c = new Child(); m = 1; } }`, /creator-shape/);
  });
});

describe('B8.2/B8.4: new results', () => {
  it('types child.category as bytes32 and stores the child\'s category', () => {
    const source = `${P} ${statefulChild()}
      contract Parent { bytes32 id; function make() { Child c = new Child(); id = c.category; } }`;
    expect(() => compile(source)).not.toThrow();
  });

  it('refuses .category on a contract-typed parameter', () => {
    refusal(`${P} ${statefulChild()}
      contract Parent { bytes32 id; function make(Child c) { id = c.category; } }`,
    /available on the result of `new/);
  });

  it('refuses .category on a state variable', () => {
    refusal(`${P} ${statefulChild()}
      contract Parent { Child stored; bytes32 id; function make() { id = stored.category; } }`,
    /available on the result of `new/);
  });

  it('refuses a call on the child created in the same function', () => {
    refusal(`${P} ${statefulChild()}
      contract Parent { int m; function make() { Child c = new Child(); c.bump(); m = 1; } }`,
    /cannot be bound at its creation/);
  });
});
