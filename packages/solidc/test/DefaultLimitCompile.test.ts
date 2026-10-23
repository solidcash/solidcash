import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti, DEFAULT_COMPILER_OPTIONS } from '../src/index.js';

/**
 * Representative default-limit compile: no `maximumInputBytes` override (BCH 10,000-byte cap).
 * Two process-level invocations of compileString plus compileStringMulti must both succeed.
 */
export const DEFAULT_LIMIT_SOURCE = `
pragma solidcash ^0.14.0;

contract Vault() {
  int public stored;
  function set(int next) public {
    require(next >= 0);
    this.stored = next;
  }
  function bump(int delta) public {
    int next = this.stored + delta;
    require(next >= 0);
    this.stored = next;
  }
}

contract Token() {
  int public totalSupply;
  mapping(bytes20 => int) public balances;
  mapping(bytes20 => mapping(bytes20 => int)) public allowances;
  event Transfer(bytes20 indexed from, bytes20 indexed to, int amount);

  function transfer(bytes20 from, bytes20 to, int amount) {
    int fromBal = this.balances[from];
    require(fromBal >= amount);
    this.balances[from] = fromBal - amount;
    this.balances[to] = this.balances[to] + amount;
    emit Transfer(from, to, amount);
  }

  function approve(bytes20 owner, bytes20 spender, int amount) {
    this.allowances[owner][spender] = amount;
    require(amount >= 0);
  }

  function transferFrom(bytes20 owner, bytes20 spender, bytes20 to, int amount) {
    int allowed = this.allowances[owner][spender];
    require(allowed >= amount);
    this.allowances[owner][spender] = allowed - amount;
    int fromBal = this.balances[owner];
    require(fromBal >= amount);
    this.balances[owner] = fromBal - amount;
    this.balances[to] = this.balances[to] + amount;
    emit Transfer(owner, to, amount);
  }

  function mint(bytes20 recipient, int amount) {
    require(amount > 0);
    this.balances[recipient] = this.balances[recipient] + amount;
    this.totalSupply = this.totalSupply + amount;
    emit Transfer(bytes20(0), recipient, amount);
  }
}
`;

const bytecodeBytes = (hex: string | undefined): number => (hex ? hex.length / 2 : 0);

describe('default 10,000-byte compile path', () => {
  it('compiles the representative fixture twice via compileString without a size override', () => {
    const first = compileString(DEFAULT_LIMIT_SOURCE);
    const second = compileString(DEFAULT_LIMIT_SOURCE);
    for (const artifact of [first, second]) {
      const bytes = bytecodeBytes(artifact.debug?.bytecode);
      expect(bytes).toBeGreaterThan(0);
      expect(bytes).toBeLessThanOrEqual(10_000);
      expect(artifact.abi.some((fn) => fn.name === 'transfer')).toBe(true);
      expect(artifact.abi.some((fn) => fn.name === 'mint')).toBe(true);
    }
    expect(bytecodeBytes(first.debug?.bytecode)).toBe(bytecodeBytes(second.debug?.bytecode));
  });

  it('compiles both contracts via compileStringMulti without a size override', () => {
    const map = compileStringMulti(DEFAULT_LIMIT_SOURCE, { compileDeclarations: ['Token', 'Vault'] });
    expect(map.Token).toBeDefined();
    expect(map.Vault).toBeDefined();
    const tokenBytes = bytecodeBytes(map.Token.debug?.bytecode);
    const vaultBytes = bytecodeBytes(map.Vault.debug?.bytecode);
    expect(tokenBytes).toBeGreaterThan(0);
    expect(tokenBytes).toBeLessThanOrEqual(10_000);
    expect(vaultBytes).toBeGreaterThan(0);
    expect(vaultBytes).toBeLessThanOrEqual(10_000);
    expect(map.Token.abi.some((fn) => fn.name === 'transferFrom')).toBe(true);
    expect(map.Vault.abi.some((fn) => fn.name === 'bump')).toBe(true);
  });

  it('caches two loop-free writes to the same sorted mapping key as one upsert', () => {
    const sameKey = compileString(`
pragma solidcash ^0.14.0;
contract SameKey() {
  mapping(bytes20 => int) public balances;
  function creditTwice(bytes20 to, int a, int b) {
    this.balances[to] = this.balances[to] + a;
    this.balances[to] = this.balances[to] + b;
    require(a >= 0);
  }
}
`);
    const once = compileString(`
pragma solidcash ^0.14.0;
contract SameKey() {
  mapping(bytes20 => int) public balances;
  function creditOnce(bytes20 to, int a) {
    this.balances[to] = this.balances[to] + a;
    require(a >= 0);
  }
}
`);
    const twoKeys = compileString(`
pragma solidcash ^0.14.0;
contract SameKey() {
  mapping(bytes20 => int) public balances;
  function creditTwo(bytes20 a, bytes20 b, int x) {
    this.balances[a] = this.balances[a] + x;
    this.balances[b] = this.balances[b] + x;
    require(x >= 0);
  }
}
`);
    const sameFn = sameKey.abi.find((fn) => fn.name === 'creditTwice');
    const twoFn = twoKeys.abi.find((fn) => fn.name === 'creditTwo');
    expect(sameFn?.entryAccesses).toHaveLength(1);
    expect(sameFn?.entryAccesses?.[0].operations).toEqual(expect.arrayContaining(['read', 'write']));
    expect(sameFn?.blockLayout?.slots.filter((slot) => slot.kind === 'entry')).toHaveLength(1);
    expect(twoFn?.entryAccesses).toHaveLength(2);
    const sameBytes = bytecodeBytes(sameKey.debug?.bytecode);
    const onceBytes = bytecodeBytes(once.debug?.bytecode);
    const twoKeyBytes = bytecodeBytes(twoKeys.debug?.bytecode);
    expect(sameBytes).toBeGreaterThan(0);
    expect(sameBytes).toBeLessThanOrEqual(10_000);
    expect(onceBytes).toBeGreaterThan(0);
    expect(twoKeyBytes).toBeGreaterThan(sameBytes);
    // One extra same-key write is a local add + one upsert, not a second entry slot.
    expect(sameBytes - onceBytes).toBeLessThan(Math.floor((twoKeyBytes - onceBytes) / 8));
  });

  it('does not enable leftover-window-8 outlining by default', () => {
    expect(DEFAULT_COMPILER_OPTIONS.optimizeForCompilationSpeed).not.toBe(true);
    const artifact = compileString(DEFAULT_LIMIT_SOURCE);
    const bytes = bytecodeBytes(artifact.debug?.bytecode);
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThanOrEqual(10_000);
    expect(artifact.abi.some((fn) => fn.name === 'transfer')).toBe(true);
  });
});
