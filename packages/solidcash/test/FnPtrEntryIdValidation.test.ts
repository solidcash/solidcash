import { describe, it, expect } from 'vitest';
import { compileString, compileStringMulti } from './direct-compile.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { StatefulContract } from '../src/stateful/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, setupStatefulUtxos, verifyTransaction } from './test-util.js';

// An external fn-ptr parameter that some internal call site passes a self-ref (`run(this.g, x)`) stays a raw
// functionId, so on the entry path the caller chooses the OP_INVOKE target. Before the entry check a caller could
// name any OP_DEFINE'd body: a private helper ran directly, and an id stored into a fn-ptr state var ran later.
// The entry now accepts only this contract's public/external functions of the parameter's type (each element of
// a fn-ptr array too); internal flows (`viaSelf`) are unchanged.
const REACH = `
contract FnIdReach() {
    function g(int x) public pure returns (int) { return x + 1; }
    function h(int a, int b) public pure returns (int) { return a + b; }
    function secret(int v) private pure returns (int) { return v * 1000; }
    function run(function(int) external returns (int) cb, int x, int expected) public { require(cb(x) == expected); }
    function two(function(int, int) external returns (int) f2) public { require(f2(1, 2) == 3); }
    function viaSelf(int x) public { run(this.g, x, x + 1); require(true); }
    function viaTwo() public { two(this.h); require(true); }
    function useSecret(int v) public { require(secret(v) == v * 1000); require(secret(v + 1) > v); }
}`;

const STORED = `
contract FnIdStore() {
    int counter;
    function(int) external returns (int) stored;
    function g(int x) public pure returns (int) { return x + 1; }
    function secret(int v) private pure returns (int) { return v * 1000; }
    function setCb(function(int) external returns (int) cb) public { this.stored = cb; }
    function callStored(int x, int expected) public {
        function(int) external returns (int) f = this.stored;
        require(f(x) == expected);
    }
    function init() public { setCb(this.g); }
    function useSecret(int v) public { require(secret(v) == v * 1000); require(secret(v + 1) > v); }
}`;

const ARRAY = `
contract FnIdArray() {
    function g(int x) public pure returns (int) { return x + 1; }
    function secret(int v) private pure returns (int) { return v * 1000; }
    function run(function(int) external returns (int) cb, int x) public { require(cb(x) == x + 1); }
    function viaSelf(int x) public { run(this.g, x); require(true); }
    function runAll(function(int) external returns (int)[] memory cbs, int x, int expected) public {
        require(cbs[0](x) == expected);
    }
    function useSecret(int v) public { require(secret(v) == v * 1000); require(secret(v + 1) > v); }
}`;

const NESTED = `
contract FnIdNested() {
    function g(int x) public pure returns (int) { return x + 1; }
    function run(function(int) external returns (int) cb, int x) public { require(cb(x) == x + 1); }
    function viaSelf(int x) public { run(this.g, x); require(true); }
    function runNested(function(int) external returns (int)[][] memory cbs, int x) public {
        require(cbs[0][0](x) == x + 1);
    }
}`;

// A foreign `this.f` passed into another contract's constructor and called there.
const CROSS_CONSTRUCTOR = `
contract D {
    uint public x;
    constructor(function() external pure returns (uint) g) { x = g(); }
}
contract C {
    function f() public returns (uint r) { D d = new D(this.sixteen); r = d.x(); }
    function sixteen() public pure returns (uint) { return 16; }
}`;

// Ids from another contract carried through a contract that never invokes a function value.
const CROSS_ARRAY = `
pragma abicoder v2;
struct S { function () external[] functions; }
contract C {
    function f(function () external[] calldata functions) external returns (S memory) {
        S memory s;
        s.functions = functions;
        return s;
    }
}
contract Test {
    C immutable c = new C();
    function test() external returns (bool) {
        function() external[] memory functions = new function() external[](2);
        functions[0] = this.random1;
        functions[1] = this.random2;
        S memory ret = c.f(functions);
        return ret.functions.length == 2;
    }
    function random1() external {}
    function random2() external {}
}`;

// The same array shape in a contract that does invoke function values stays refused.
const ARRAY_NO_TARGET = `
contract FnIdNoTarget() {
    function g(int x) public pure returns (int) { return x + 1; }
    function run(function(int) external returns (int) cb, int x) public { require(cb(x) == x + 1); }
    function viaSelf(int x) public { run(this.g, x); require(true); }
    function keep(function() external[] memory fns) public { require(fns.length > 0); }
}`;

type Unlock = Record<string, (...args: unknown[]) => unknown>;
type Artifact = ReturnType<typeof compileString>;

// A body's id as its OP_DEFINE names it (the artifact's invoke debug table).
function idOf(artifact: Artifact, name: string): bigint {
  const entry = Object.entries(artifact.debug?.invokeDebug ?? {}).find(([, info]) => info.name === name);
  if (!entry) throw new Error(`no OP_DEFINE for ${name}`);
  return BigInt(entry[0]);
}

async function spend(artifact: Artifact, fn: string, args: unknown[]): Promise<void> {
  const provider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  const utxo = randomUtxo();
  await provider.addUtxo(contract.address, utxo);
  const tx = new TransactionBuilder({ provider })
    .addInput(utxo, (contract.unlock as Unlock)[fn](...args) as never)
    .addOutput({ to: contract.address, amount: 10000n });
  verifyTransaction(tx);
}

describe('entry fn-ptr parameters accept only matching public/external functions', () => {
  it('rejects a private helper, a mismatched and an undefined id; accepts the public target', async () => {
    const artifact = compileString(REACH, {});
    const gId = idOf(artifact, 'g');
    const hId = idOf(artifact, 'h');
    const secretId = idOf(artifact, 'secret');
    await expect(spend(artifact, 'run', [gId, 7n, 8n])).resolves.toBeUndefined();
    await expect(spend(artifact, 'run', [secretId, 7n, 7000n])).rejects.toThrow(/verification failed/);
    await expect(spend(artifact, 'run', [hId, 7n, 8n])).rejects.toThrow(/verification failed/);
    await expect(spend(artifact, 'run', [999n, 7n, 8n])).rejects.toThrow(/verification failed/);
    await expect(spend(artifact, 'two', [hId])).resolves.toBeUndefined();
    await expect(spend(artifact, 'two', [gId])).rejects.toThrow(/verification failed/);
    await expect(spend(artifact, 'viaSelf', [7n])).resolves.toBeUndefined();
  });

  it('refuses to store a private helper id into a fn-ptr state variable', async () => {
    const artifact = compileString(STORED, {});
    const gId = idOf(artifact, 'g');
    const secretId = idOf(artifact, 'secret');
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n, stored: 0x7fffffffn }, { saltContract: true },
    );
    const call = (fn: string, ...args: unknown[]): Promise<unknown> => (
      (StatefulContract.withCategory(contract, categoryId) as unknown as Unlock)[fn](...args) as {
        send(): Promise<unknown>;
      }).send();
    await expect(call('setCb', secretId)).rejects.toThrow();
    expect((await StatefulContract.withCategory(contract, categoryId).getState()).stored).toBe(0x7fffffffn);
    await expect(call('setCb', gId)).resolves.toBeDefined();
    expect((await StatefulContract.withCategory(contract, categoryId).getState()).stored).toBe(gId);
    await expect(call('callStored', 5n, 6n)).resolves.toBeDefined();
  });

  it('checks every element of a fn-ptr array parameter', async () => {
    const artifact = compileString(ARRAY, {});
    const gId = idOf(artifact, 'g');
    const secretId = idOf(artifact, 'secret');
    await expect(spend(artifact, 'runAll', [[gId], 7n, 8n])).resolves.toBeUndefined();
    await expect(spend(artifact, 'runAll', [[secretId], 7n, 7000n])).rejects.toThrow(/verification failed/);
    await expect(spend(artifact, 'runAll', [[gId, secretId], 7n, 8n])).rejects.toThrow(/verification failed/);
  });

  it('refuses function ids nested deeper than one array level in an entry parameter', () => {
    expect(() => compileString(NESTED, {})).toThrow(/cannot be validated at entry/);
  });

  it('compiles a foreign `this.f` passed to another contract\'s constructor', () => {
    // `f` deploys without a signature check; permissionless deploy is intended here.
    const artifacts = compileStringMulti(CROSS_CONSTRUCTOR, {
      evmCompat: true, enforceFinalRequire: false, allowUnsafeOperations: true,
    });
    expect(Object.keys(artifacts)).toEqual(expect.arrayContaining(['C', 'D']));
  });

  it('compiles foreign ids carried by a contract that never invokes a function value', () => {
    const artifacts = compileStringMulti(CROSS_ARRAY, { evmCompat: true, enforceFinalRequire: false });
    expect(Object.keys(artifacts)).toEqual(expect.arrayContaining(['C', 'Test']));
    expect(() => compileString(ARRAY_NO_TARGET, {})).toThrow(/none of them is invocable by id/);
  });
});
