import { describe, it, expect } from 'vitest';
import { compileString } from '../../solidc/src/index.js';
import { Contract } from '../src/index.js';
import { MockNetworkProvider } from '../src/index.js';

// Category self-pin: reworking the dead `<salt> OP_DROP` into a live category check (the contract prologue).
// See docs/external-contract-calls.md. The user CREATE2 salt remains a separate dead-drop segment.
describe('Category self-pin (Contract.ts prologue)', () => {
  const provider = new MockNetworkProvider();
  const STATEFUL = 'contract C() { int n; function f(int v) { this.n = this.n + v; } }';
  const category = new Uint8Array(32).fill(0xab);
  // OP_INPUTINDEX OP_UTXOTOKENCATEGORY push(0x20) OP_SPLIT OP_DROP OP_EQUALVERIFY
  const PIN_OPS = 'c0ce01207f7588';

  it('bakes the category-pin prologue for a stateful contract when category is set', () => {
    const art = compileString(STATEFUL);
    const withCat = new Contract(art, [], { provider, category });
    // prologue = push32(category) || pin ops, at the very start of the script
    expect(withCat.bytecode.startsWith('20' + 'ab'.repeat(32) + PIN_OPS)).toBe(true);
  });

  it('changes the address vs the un-pinned contract (category is part of the address)', () => {
    const art = compileString(STATEFUL);
    const noCat = new Contract(art, [], { provider });
    const withCat = new Contract(art, [], { provider, category });
    expect(withCat.bytecode).not.toBe(noCat.bytecode);
    expect(withCat.address).not.toBe(noCat.address);
    // the un-pinned contract does not START with the category-pin prologue (the pin opcode sequence may still
    // occur inside the covenant's own category logic, so only the prologue prefix is a reliable marker)
    expect(noCat.bytecode.startsWith(`20${'ab'.repeat(32)}${PIN_OPS}`)).toBe(false);
  });

  it('reverses the category to internal byte order (matches OP_UTXOTOKENCATEGORY)', () => {
    const art = compileString(STATEFUL);
    const asc = Uint8Array.from({ length: 32 }, (_v, i) => i); // 00 01 02 ... 1f
    const withCat = new Contract(art, [], { provider, category: asc });
    // baked value is reversed (internal order): 1f 1e ... 01 00
    const internalHex = [...asc].reverse().map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(withCat.bytecode.startsWith('20' + internalHex + PIN_OPS)).toBe(true);
  });

  it('keeps the user CREATE2 salt as a separate outermost dead-drop segment', () => {
    const art = compileString(STATEFUL);
    const salt = new Uint8Array(4).fill(0xcd);
    const withBoth = new Contract(art, [], { provider, category, salt });
    // outermost: push4(salt) OP_DROP, then the category-pin prologue
    expect(withBoth.bytecode.startsWith('04cdcdcdcd75' + '20' + 'ab'.repeat(32) + PIN_OPS)).toBe(true);
  });
});
