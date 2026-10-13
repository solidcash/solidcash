/**
 * LOW rows from the October 2026 audit. Each case compiles through this worktree's compiler.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, bytecodeToScript, encodeIntegerValue, scriptToAsm, scriptToBytecode, type Artifact,
} from '@solidcash/utils';
import { compileString, compileStringSplit } from '../src/index.js';

const P = 'pragma solidcash ^0.13.0;';
const vm = createVirtualMachineBch2026();
const FUNDER = Uint8Array.from([0x51]);
const VALUE = 10_000n;

function p2sh32(redeem: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(redeem));
}

function redeemOf(artifact: Artifact): Uint8Array {
  return scriptToBytecode(asmToScript(artifact.bytecode));
}

function asmOf(artifact: Artifact): string {
  const parts = [artifact.bytecode];
  for (const hex of Object.values(artifact.functionBodies ?? {})) {
    parts.push(scriptToAsm(bytecodeToScript(hexToBin(hex))));
  }
  return parts.join('\n');
}

function pushesOf(values: readonly Uint8Array[]): Uint8Array {
  return new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));
}

/** Parameterless, or arguments in source order. The redeem is the contract locking script. */
function spend(artifact: Artifact, args: Uint8Array[] = [], inputValue = VALUE): true | string {
  const redeem = redeemOf(artifact);
  const lock = p2sh32(redeem);
  const unlocking = new Uint8Array([...pushesOf([...args].reverse()), ...encodeDataPush(redeem)]);
  return vm.verify({
    sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: inputValue }],
    transaction: {
      version: 2,
      locktime: 0,
      inputs: [{
        outpointIndex: 0,
        outpointTransactionHash: Uint8Array.from({ length: 32 }, () => 0x11),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: unlocking,
      }],
      outputs: [{ lockingBytecode: FUNDER, valueSatoshis: 1_000n }],
    },
  });
}

describe('October 2026 low holes', () => {
  it('ARITH-8 an enum cast inside unchecked still rejects a value that is not a member', () => {
    const artifact = compileString(
      `${P} contract C { enum Status { A, B }`
      + ' function f(int x) { unchecked { Status s = Status(x); require(s == Status.A); } } }',
      { messageBus: false },
    );
    expect(artifact.bytecode).toContain('OP_1 OP_LESSTHANOREQUAL OP_VERIFY');
  });

  // Message-bus builds keep the kernel's own lifecycle policy (decided 2026-10-13); the rule holds elsewhere.
  it('DX-9 a split without a trusted signature is rejected outside the message bus', () => {
    const src = `${P} contract C(pubkey admin) { int n; function fork(int k) split(k) { require(true); } }`;
    expect(() => compileString(src, { messageBus: false })).toThrow(/without an unconditional trusted-key signature/);
  });

  it('DX-9 checkDataSig does not authorize a split, and checkSig fences the sighash', () => {
    const dataSig = `${P} contract C(pubkey admin) { int n;`
      + ' function fork(datasig ds, bytes m, int k) split(k) { require(checkDataSig(ds, m, admin)); } }';
    expect(() => compileString(dataSig, { messageBus: false })).toThrow(/without an unconditional trusted-key signature/);
    const signed = compileString(
      `${P} contract C(pubkey admin) { int n;`
      + ' function fork(sig s, int k) split(k) { require(checkSig(s, admin)); } }',
      { messageBus: true },
    );
    expect(asmOf(signed)).toMatch(/1f OP_AND/);
  });

  it('ARITH-7 a slice past the array length is rejected, and the real prefix is not', () => {
    const tooFar = compileString(
      `${P} contract C { function f() { int[] items = [1]; int[] part = items[0:2]; require(part.length == 2); } }`,
      { messageBus: false },
    );
    const kept = compileString(
      `${P} contract C { function f() { int[] items = [1, 2]; int[] part = items[0:2]; require(part.length == 2); } }`,
      { messageBus: false },
    );
    expect(spend(tooFar), 'ARITH-7 slice past the end').not.toBe(true);
    expect(spend(kept), 'ARITH-7 slice of the real prefix').toBe(true);
  });

  it('ARITH-9 int8(bytes1(0x80)) is -128 and bytes1 of a high uint8 is 0xff', () => {
    const fromBytes = compileString(
      `${P} contract C { function f(bytes1 b) { require(int8(b) == int8(-128)); } }`,
      { messageBus: false, evmCompat: true },
    );
    expect(spend(fromBytes, [Uint8Array.of(0x80)]), 'ARITH-9 bytes1 0x80').toBe(true);
    const high = compileString(
      `${P} contract C { function f() { uint8 x = 255; require(bytes1(x) == hex"ff"); } }`,
      { messageBus: false, evmCompat: true },
    );
    expect(spend(high), 'ARITH-9 uint8 255 as bytes1').toBe(true);
    const negative = compileString(
      `${P} contract C { function f() { require(bytes1(int8(-1)) == hex"ff"); } }`,
      { messageBus: false, evmCompat: true },
    );
    expect(spend(negative), 'ARITH-9 int8 -1 as bytes1').toBe(true);
  });

  it('ARITH-12 cost - msg.value reverts when the input value is larger', () => {
    const artifact = compileString(
      `${P} contract C { function f(uint256 cost, uint256 tip) { require(cost - msg.value <= tip); } }`,
      { messageBus: false, evmCompat: true },
    );
    expect(spend(artifact, [encodeIntegerValue(100n), encodeIntegerValue(100_000n)]), 'ARITH-12 underflow').not.toBe(true);
    expect(spend(artifact, [encodeIntegerValue(20_000n), encodeIntegerValue(20_000n)]), 'ARITH-12 in range').toBe(true);
  });

  it('CRYPTO-6 block.timestamp warns and a timestamp update cannot precede the chain', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const artifact = compileString(
        `${P} contract C { function f() { require(block.timestamp >= 0); } }`,
        { messageBus: false },
      );
      const warnings = spy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(warnings).toContain('block.timestamp is the last value the oracle owner wrote');
      expect(asmOf(artifact)).toContain('OP_CHECKLOCKTIMEVERIFY');
    } finally {
      spy.mockRestore();
    }
  });

  it('SEM-7 a same-name internal overload of a split entry stays internal', () => {
    const bundle = compileStringSplit(
      `${P} contract C { int n; function ping() { this.n = this.n + 1; require(true); }`
      + ' function ping(int x) internal { require(x == 0); } }',
      { forceSplit: true, messageBus: false },
    );
    const info = bundle.manifest.facets[0];
    if (!info) throw new Error('ping was not moved to a facet');
    const facetPings = bundle.facets[info.name].abi.filter((entry) => entry.name === 'ping');
    const rootPing = bundle.root.abi.find((entry) => entry.name === 'ping');
    expect(facetPings).toHaveLength(1);
    expect(rootPing).toBeDefined();
    // The facet publishes the zero-argument entry. The internal ping(int) is not a second delegate.
    expect(facetPings[0].selector).toBe(rootPing!.selector);
    expect(facetPings[0].inputs.map((input) => input.name)).toEqual(['__internal__proxyMasterIndex']);
  });

  it('ARITH-11 Yul add, sub, and mul wrap mod 2^256', () => {
    const word = (1n << 256n) - 1n;
    const add = compileString(
      `${P} contract C { function spend(uint256 a) { uint256 r; assembly { r := add(a, 1) } require(r == 0); } }`,
      { messageBus: false, evmCompat: true },
    );
    expect(spend(add, [encodeIntegerValue(word)]), 'ARITH-11 add wrap').toBe(true);
    const sub = compileString(
      `${P} contract C { function spend(uint256 a) { uint256 r; assembly { r := sub(a, 1) } require(r == ${word}); } }`,
      { messageBus: false, evmCompat: true },
    );
    expect(spend(sub, [encodeIntegerValue(0n)]), 'ARITH-11 sub wrap').toBe(true);
    const mul = compileString(
      `${P} contract C { function spend(uint256 a) { uint256 r; assembly { r := mul(a, 2) } require(r == ${word} - 1); } }`,
      { messageBus: false, evmCompat: true },
    );
    expect(spend(mul, [encodeIntegerValue(word)]), 'ARITH-11 mul wrap').toBe(true);
  });
});
