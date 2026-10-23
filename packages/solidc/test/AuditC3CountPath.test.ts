/**
 * C3 on the count path (docs/security/SECURITY-AUDIT.md C3; AUTHHEAD-1 in docs/security/security-audit-2026-10-16.md).
 *
 * A function the own-category mutable count covers writes one of two data records. Beside its call the other record is
 * rewritten in place through the data covenant's write flag, or destroyed through its destroy flag while a mutable NFT
 * of the category appears at the authhead lock. Both keep the count balanced, and the record's own covenant accepts
 * both spends. The master refuses them. A record destroyed at the input index of an output-only slot inside the block
 * is refused too. The honest calls settle. Each case runs the whole transaction on the BCH 2026 VM, then the record
 * and master inputs alone.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildDataNftCovenantScript, buildPushdataCommitment, buildSatoshiContainerCovenantScript,
  encodeIntegerValue, scriptToBytecode, type AbiFunction, type Artifact,
} from '@solidcash/utils';
import { authheadLockingBytecode } from '../../solidcash/src/bcmr/authhead.js';
import { compileString } from '../src/index.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;

interface Spend {
  readonly sourceOutputs: SourceOutputs;
  readonly transaction: VmTransaction;
}

const P = 'pragma solidcash ^0.14.0;';
const CATEGORY = Uint8Array.from({ length: 32 }, (_, i) => (0x29 + i * 17) & 0xff);
const EMPTY = new Uint8Array(0);
const VALUE = 20_000n;
const FUNDER_LOCK = Uint8Array.from([0x51]);
const RECIPIENT = Uint8Array.of(0x76, 0xa9, 0x14, 0x22, 0x88, 0xac);
const vm = createVirtualMachineBch2026();

// a, b, c fill the first record (3 x 34 of 128 bytes), so n opens the second.
const TOUCH = 'int a; int b; int c; int n; function touch() { this.n = this.n + 1; require(true); }';
const PAY = ' function pay(bytes to) { this.transfer(to, 1000); this.n = this.n + 1; require(true); }';
const VICTIM = { a: 1n, b: 2n, c: 3n };
const FORGED = { a: 9n, b: 2n, c: 3n };

const num = (value: bigint): Uint8Array => encodeIntegerValue(value);

function p2sh32(redeem: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(redeem));
}

function tokenOf(capability: 'minting' | 'mutable', nftCommitment: Uint8Array): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: nftCommitment } };
}

function input(index: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] {
  return {
    outpointIndex: 0,
    outpointTransactionHash: Uint8Array.from({ length: 32 }, (_, i) => (0x80 + index + i * 37) & 0xff),
    sequenceNumber: 0xffffffff,
    unlockingBytecode,
  };
}

function pushesOf(values: readonly Uint8Array[]): Uint8Array {
  return new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));
}

function fnOf(artifact: Artifact, name: string): AbiFunction {
  const fn = artifact.abi.find((entry) => entry.name === name);
  if (!fn) throw new Error(`no function ${name}; have ${artifact.abi.map((entry) => entry.name).join(',')}`);
  return fn;
}

function redeemOf(artifact: Artifact): Uint8Array {
  return scriptToBytecode(asmToScript(artifact.bytecode));
}

/** The selector at the bottom, then the ABI arguments with the first on top, then the redeem. */
function masterUnlock(artifact: Artifact, name: string, values: Record<string, Uint8Array> = {}): Uint8Array {
  const fn = fnOf(artifact, name);
  const args = fn.inputs.map((entry) => {
    const value = values[entry.name] ?? (entry.name.startsWith('__internal__') ? EMPTY : undefined);
    if (value === undefined) throw new Error(`no value for ${name}.${entry.name}`);
    return value;
  }).reverse();
  if (fn.selector) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushesOf(args), ...encodeDataPush(redeemOf(artifact))]);
}

function nftIndexOf(artifact: Artifact, name: string): number {
  const variable = artifact.stateLayout!.variables.find((entry) => entry.name === name);
  if (variable?.nftIndex === undefined) throw new Error(`no state variable ${name}`);
  return variable.nftIndex;
}

function commitment(artifact: Artifact, values: Record<string, bigint>, nftIndex: number): Uint8Array {
  return hexToBin(buildPushdataCommitment(artifact.stateLayout!, values, nftIndex));
}

function record(artifact: Artifact): { lock: Uint8Array; redeem: Uint8Array } {
  const redeem = scriptToBytecode(buildDataNftCovenantScript(CATEGORY, p2sh32(redeemOf(artifact))));
  return { lock: p2sh32(redeem), redeem };
}

/** The data record `field` lives in, holding `values`. */
function recordOutput(artifact: Artifact, field: string, values: Record<string, bigint>): VmOutput {
  const token = tokenOf('mutable', commitment(artifact, values, nftIndexOf(artifact, field)));
  return { lockingBytecode: record(artifact).lock, valueSatoshis: VALUE, token };
}

function compile(members: string): Artifact {
  return compileString(`${P} contract C { ${members} }`, { messageBus: true });
}

function verdict(spend: Spend): true | string {
  return vm.verify(spend);
}

function inputVerdict(spend: Spend, inputIndex: number): true | string {
  return vm.stateSuccess(vm.evaluate({ ...spend, inputIndex }));
}

/** Master at 0, the record `n` lives in at 1, a funder at 2. */
function touchSpend(artifact: Artifact): Spend {
  const lock = p2sh32(redeemOf(artifact));
  const data = record(artifact);
  return {
    sourceOutputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
      recordOutput(artifact, 'n', { n: 1n }),
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n },
    ],
    transaction: {
      version: 2, locktime: 0,
      inputs: [
        input(0, masterUnlock(artifact, 'touch')),
        input(1, pushesOf([num(0n), num(1n), data.redeem])),
        input(2, EMPTY),
      ],
      outputs: [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
        recordOutput(artifact, 'n', { n: 2n }),
        { lockingBytecode: FUNDER_LOCK, valueSatoshis: 40_000n },
      ],
    },
  };
}

/** Master, the record `n` lives in, the satoshi container, then a funder at the transfer slot's input index. */
function paySpend(artifact: Artifact): Spend {
  const slots = fnOf(artifact, 'pay').blockLayout?.slots ?? [];
  const container = slots.find((slot) => slot.kind === 'satoshiContainer');
  const transfer = slots.find((slot) => slot.kind === 'transfer');
  if (container?.offset !== 2 || transfer?.offset !== 3) throw new Error(`pay slots ${JSON.stringify(slots)}`);
  const lock = p2sh32(redeemOf(artifact));
  const data = record(artifact);
  const containerRedeem = scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY, lock));
  const containerLock = p2sh32(containerRedeem);
  return {
    sourceOutputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
      recordOutput(artifact, 'n', { n: 1n }),
      { lockingBytecode: containerLock, valueSatoshis: 50_000n },
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n },
    ],
    transaction: {
      version: 2, locktime: 0,
      inputs: [
        input(0, masterUnlock(artifact, 'pay', { to: RECIPIENT })),
        input(1, pushesOf([num(0n), num(1n), data.redeem])),
        input(2, pushesOf([num(0n), num(1n), containerRedeem])),
        input(3, EMPTY),
      ],
      outputs: [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', EMPTY) },
        recordOutput(artifact, 'n', { n: 2n }),
        { lockingBytecode: containerLock, valueSatoshis: 49_000n },
        { lockingBytecode: RECIPIENT, valueSatoshis: 1_000n },
        { lockingBytecode: FUNDER_LOCK, valueSatoshis: 40_000n },
      ],
    },
  };
}

/** A mutable NFT of the category at the authhead lock, naming an owner no input holds. */
function lookAlike(): VmOutput {
  const owner = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x66), 0x88, 0xac);
  const lockingBytecode = authheadLockingBytecode(binToHex(CATEGORY));
  return { lockingBytecode, valueSatoshis: VALUE, token: tokenOf('mutable', owner) };
}

/** Appends the unnamed record at the next input index, spent with `flag`, and `created` after the outputs. */
function withVictim(artifact: Artifact, honest: Spend, flag: bigint, created: readonly VmOutput[]): Spend {
  const at = honest.transaction.inputs.length;
  return {
    sourceOutputs: [...honest.sourceOutputs, recordOutput(artifact, 'a', VICTIM)],
    transaction: {
      ...honest.transaction,
      inputs: [...honest.transaction.inputs, input(at, pushesOf([num(0n), num(flag), record(artifact).redeem]))],
      outputs: [...honest.transaction.outputs, ...created],
    },
  };
}

/** Write flag: the victim comes back at its own index and lock with another commitment. */
function rewritten(artifact: Artifact, honest: Spend): Spend {
  return withVictim(artifact, honest, 1n, [recordOutput(artifact, 'a', FORGED)]);
}

/** Destroy flag: no token at the victim's own index, and the look-alike after it. */
function destroyed(artifact: Artifact, honest: Spend): Spend {
  return withVictim(artifact, honest, 2n, [{ lockingBytecode: FUNDER_LOCK, valueSatoshis: VALUE }, lookAlike()]);
}

/** Destroy flag at input 3, the transfer slot, whose output carries no token. The funder moves to input 4. */
function destroyedAtTransferSlot(artifact: Artifact, honest: Spend): Spend {
  const { inputs, outputs } = honest.transaction;
  return {
    sourceOutputs: [...honest.sourceOutputs.slice(0, 3), recordOutput(artifact, 'a', VICTIM), honest.sourceOutputs[3]!],
    transaction: {
      ...honest.transaction,
      inputs: [...inputs.slice(0, 3), input(3, pushesOf([num(0n), num(2n), record(artifact).redeem])), input(4, EMPTY)],
      outputs: [...outputs, lookAlike()],
    },
  };
}

describe('C3 count path: a record the call does not name is pinned at its index', () => {
  for (const [label, members] of [['one count-path entry', TOUCH], ['two count-path entries', TOUCH + PAY]] as const) {
    it(`${label}: touch settles, and a rewritten or destroyed unnamed record is refused at the master`, () => {
      const artifact = compile(members);
      const touched = nftIndexOf(artifact, 'n');
      expect(nftIndexOf(artifact, 'a'), 'two records').not.toBe(touched);
      expect(fnOf(artifact, 'touch').blockLayout?.slots.filter((slot) => slot.kind === 'dataNft')
        .map((slot) => `${slot.nftIndex}@${slot.offset}`), 'touch names one record').toEqual([`${touched}@1`]);

      const honest = touchSpend(artifact);
      expect(verdict(honest), 'honest touch').toBe(true);

      const rewrite = rewritten(artifact, honest);
      expect(inputVerdict(rewrite, 3), 'the write flag accepts the rewrite').toBe(true);
      expect(inputVerdict(rewrite, 0), 'the master refuses the rewrite').not.toBe(true);
      expect(verdict(rewrite), 'rewritten in place').not.toBe(true);

      const destroy = destroyed(artifact, honest);
      expect(inputVerdict(destroy, 3), 'the destroy flag accepts the burn').toBe(true);
      expect(inputVerdict(destroy, 0), 'the master refuses the burn').not.toBe(true);
      expect(verdict(destroy), 'destroyed, look-alike at the authhead').not.toBe(true);
    });
  }

  it('pay settles, and a record destroyed at the transfer slot inside the block is refused at the master', () => {
    const artifact = compile(TOUCH + PAY);
    const honest = paySpend(artifact);
    expect(verdict(honest), 'honest pay').toBe(true);
    const destroy = destroyedAtTransferSlot(artifact, honest);
    expect(inputVerdict(destroy, 3), 'the destroy flag accepts the burn').toBe(true);
    expect(inputVerdict(destroy, 0), 'the master refuses the burn').not.toBe(true);
    expect(verdict(destroy), 'destroyed at the transfer slot').not.toBe(true);
  });
});
