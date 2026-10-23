/**
 * LOW rows from the October 2026 audit. Each case compiles through this worktree's compiler.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, generateSigningSerializationBch, hash256,
  hexToBin, secp256k1, type Output,
} from '@bitauth/libauth';
import {
  asmToScript, blockOracleLockingBytecode, blockOracleRedeemScript, blockOracleUpdateUnlocking, bytecodeToScript,
  encodeBlockOracleCommitment, encodeIntegerValue, hash160, scriptToAsm, scriptToBytecode, type Artifact,
} from '@solidcash/utils';
import { compileString, compileStringSplit } from '../src/index.js';

const P = 'pragma solidcash ^0.14.0;';
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

const ORACLE_CATEGORY = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0x8e : 0x71));
const ORACLE_OWNER_KEY = Uint8Array.from({ length: 32 }, (_byte, index) => (index === 0 ? 0x02 : 0x11));

/** An owner-signed spend of the block oracle covenant from one (number, timestamp) to another. */
function oracleUpdate(locktime: number, from: [bigint, bigint], to: [bigint, bigint]): true | string {
  const ownerPub = secp256k1.derivePublicKeyCompressed(ORACLE_OWNER_KEY) as Uint8Array;
  const record = ([number, timestamp]: [bigint, bigint]): Uint8Array => encodeBlockOracleCommitment(
    hash160(ownerPub), { number, timestamp, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: Uint8Array.of(0x51) },
  );
  const lock = blockOracleLockingBytecode(ORACLE_CATEGORY);
  const token = (commitment: Uint8Array): NonNullable<Output['token']> => ({
    category: ORACLE_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment },
  });
  const next = record(to);
  const sourceOutputs: Output[] = [{ lockingBytecode: lock, valueSatoshis: VALUE, token: token(record(from)) }];
  const transaction = {
    version: 2,
    locktime,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: Uint8Array.from({ length: 32 }, () => 0x61),
      sequenceNumber: 0xfffffffe,
      unlockingBytecode: new Uint8Array() as Uint8Array,
    }],
    outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE, token: token(next) }],
  };
  const sighash = Uint8Array.of(0x41);
  const digest = hash256(generateSigningSerializationBch({ inputIndex: 0, sourceOutputs, transaction }, {
    coveredBytecode: blockOracleRedeemScript(ORACLE_CATEGORY), signingSerializationType: sighash,
  }));
  const signature = secp256k1.signMessageHashSchnorr(ORACLE_OWNER_KEY, digest) as Uint8Array;
  transaction.inputs[0].unlockingBytecode = blockOracleUpdateUnlocking(
    ORACLE_CATEGORY, ownerPub, Uint8Array.from([...signature, ...sighash]), next,
  );
  return vm.verify({ sourceOutputs, transaction });
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
      // The reader slices the shared oracle covenant, and that covenant bounds the owner's update.
      expect(artifact.usesBlockOracle).toBe(true);
    } finally {
      spy.mockRestore();
    }
    const time = 1_700_000_000n;
    const height = 1000;
    expect(oracleUpdate(Number(time), [1000n, time - 600n], [1000n, time]), 'CRYPTO-6 time at nLockTime').toBe(true);
    expect(oracleUpdate(Number(time), [1000n, time - 600n], [1000n, time + 1n]), 'CRYPTO-6 time ahead of nLockTime')
      .not.toBe(true);
    expect(oracleUpdate(Number(time), [1000n, time - 600n], [1001n, time]), 'CRYPTO-6 time update moves the number')
      .not.toBe(true);
    expect(oracleUpdate(height, [999n, time], [1000n, time]), 'CRYPTO-6 height update').toBe(true);
    expect(oracleUpdate(height, [999n, time], [1000n, time + 1n]), 'CRYPTO-6 height update moves the timestamp')
      .not.toBe(true);
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
