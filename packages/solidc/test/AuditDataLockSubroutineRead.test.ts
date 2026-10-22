/**
 * DS-2 class: a data record that only an invoked body reads is still held to the data-NFT lock.
 *
 * A call through a function pointer runs its target as an OP_DEFINE, so the entry's own body names no state. That
 * entry took the guarded path: its walk kept the record at `master + 1` in place but never at the data-NFT covenant,
 * so a mutable NFT of the category at any other lock was read as the state. Evaluated on the BCH 2026 VM.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildDataNftCovenantScript, buildPushdataCommitment, encodeIntegerValue, scriptToBytecode,
  type Artifact,
} from '@solidcash/utils';
import { compileString } from '../src/index.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;

const CATEGORY = Uint8Array.from({ length: 32 }, (_, i) => (0x29 + i * 17) & 0xff);
const OWNER = Uint8Array.from({ length: 20 }, (_, i) => (0x11 + i * 37) & 0xff);
const EMPTY = new Uint8Array(0);
const VALUE = 20_000n;
const ANYONE = Uint8Array.of(0x51);
const vm = createVirtualMachineBch2026();

const SOURCE = 'pragma solidcash ^0.13.0; contract C { bytes20 owner;'
  + ' function ownerA() internal view returns (bytes20) { return this.owner; }'
  + ` function ownerB() internal view returns (bytes20) { return hex"${'00'.repeat(20)}"; }`
  + ' function go(bool b) { function() internal view returns (bytes20) p = b ? ownerA : ownerB;'
  + ` require(p() == hex"${Buffer.from(OWNER).toString('hex')}"); require(true); } }`;

const pushesOf = (values: readonly Uint8Array[]): Uint8Array =>
  new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));
const p2sh32 = (redeem: Uint8Array): Uint8Array => encodeLockingBytecodeP2sh32(hash256(redeem));
const token = (capability: 'minting' | 'mutable', commitment: Uint8Array): VmOutput['token'] =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });

function input(index: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] {
  return {
    outpointIndex: 0,
    outpointTransactionHash: Uint8Array.from({ length: 32 }, (_, i) => (0x80 + index + i * 37) & 0xff),
    sequenceNumber: 0xffffffff,
    unlockingBytecode,
  };
}

/**
 * Master at 0, the record `go(true)` reads at 1, a funder at 2. The record holds the owner `go` requires; it sits at
 * the data-NFT covenant, or at `foreignLock` as a mutable NFT of the category its holder spends freely.
 */
function spend(artifact: Artifact, foreignLock?: Uint8Array): true | string {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const lock = p2sh32(redeem);
  const recordRedeem = scriptToBytecode(buildDataNftCovenantScript(CATEGORY, lock));
  const recordLock = foreignLock ?? p2sh32(recordRedeem);
  const record = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { owner: OWNER }, 0));
  const readOnly = pushesOf([encodeIntegerValue(0n), encodeIntegerValue(0n), recordRedeem]);
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [
      input(0, new Uint8Array([...pushesOf([encodeIntegerValue(1n)]), ...encodeDataPush(redeem)])),
      input(1, foreignLock ? EMPTY : readOnly),
      input(2, EMPTY),
    ],
    outputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
      { lockingBytecode: recordLock, valueSatoshis: VALUE, token: token('mutable', record) },
      { lockingBytecode: ANYONE, valueSatoshis: 40_000n },
    ],
  };
  const sourceOutputs: SourceOutputs = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
    { lockingBytecode: recordLock, valueSatoshis: VALUE, token: token('mutable', record) },
    { lockingBytecode: ANYONE, valueSatoshis: 100_000n },
  ];
  return vm.verify({ sourceOutputs, transaction });
}

describe('a data record read only through a subroutine', () => {
  const artifact = compileString(SOURCE);
  const go = artifact.abi.find((entry) => entry.name === 'go')!;

  it('places the record the pointer target reads in the block of the entry', () => {
    expect((go.blockLayout?.slots ?? []).map((slot) => `${slot.kind}@${slot.offset}`))
      .toEqual(['master@0', 'dataNft@1']);
    console.info(`subroutine-read entry: ${scriptToBytecode(asmToScript(artifact.bytecode)).length} B`);
  });

  it('settles the honest call against the record at the data-NFT lock', () => {
    expect(spend(artifact), 'honest pointer read').toBe(true);
  });

  it('refuses a forged mutable NFT of the category at a foreign lock beside the read', () => {
    const verdict = spend(artifact, ANYONE);
    expect(verdict, 'forged record lock').not.toBe(true);
    expect(verdict, 'refused by the contract input').toMatch(/input index 0/);
  });
});
