/**
 * DS-2 class: a data record that only an invoked body reads is still held to the data-NFT lock.
 *
 * A call through a function pointer runs its target as an OP_DEFINE, so the entry's own body names no state. That
 * entry took the guarded path: its walk kept the record at `master + 1` in place but never at the data-NFT covenant,
 * so a mutable NFT of the category at any other lock was read as the state. A split or merge entry listed only the
 * records its own body names, so the invoked read sat outside its block with no pin at all. Evaluated on the BCH
 * 2026 VM.
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

const OWNER_HEX = Buffer.from(OWNER).toString('hex');
// `p()` reaches `this.owner` through a pointer; no entry below names the record itself.
const READERS = 'pragma solidcash ^0.14.0; contract C { bytes20 owner;'
  + ' function ownerA() internal view returns (bytes20) { return this.owner; }'
  + ` function ownerB() internal view returns (bytes20) { return hex"${'00'.repeat(20)}"; }`;
const POINTER_READ = 'function() internal view returns (bytes20) p = b ? ownerA : ownerB;'
  + ` require(p() == hex"${OWNER_HEX}");`;
const SOURCE = `${READERS} function go(bool b) { ${POINTER_READ} require(true); } }`;
const SPLIT = `${READERS} function fork(int n, bool b) split(n) { ${POINTER_READ} } }`;
const MERGE = `${READERS} function join(int n, bool b) merge(n) { ${POINTER_READ} } }`;
// A public getter called as `this.ownerOf()` is invoked, not inlined.
const SELF_CALL_SPLIT = 'pragma solidcash ^0.14.0; contract C { bytes20 owner;'
  + ' function ownerOf() public view returns (bytes20) { return this.owner; }'
  + ` function fork(int n) split(n) { require(this.ownerOf() == hex"${OWNER_HEX}"); } }`;
// The lifecycle entries carry no signature, which only the unsafe-operations option admits.
const LIFECYCLE = { messageBus: false, allowUnsafeOperations: true } as const;

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
 * the data-NFT covenant, or at `foreignLock` as a mutable NFT of the category its holder spends freely. With
 * `threads`, the spend is `fork(threads, true)` and that many new minting masters follow the record.
 */
function spend(artifact: Artifact, foreignLock?: Uint8Array, threads = 0): true | string {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const lock = p2sh32(redeem);
  const recordRedeem = scriptToBytecode(buildDataNftCovenantScript(CATEGORY, lock));
  const recordLock = foreignLock ?? p2sh32(recordRedeem);
  const record = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { owner: OWNER }, 0));
  const readOnly = pushesOf([encodeIntegerValue(0n), encodeIntegerValue(0n), recordRedeem]);
  // The last argument is pushed first: `b` = true, then `n`.
  const args = [encodeIntegerValue(1n), ...(threads > 0 ? [encodeIntegerValue(BigInt(threads))] : [])];
  const master = (): VmOutput => ({ lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) });
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [
      input(0, new Uint8Array([...pushesOf(args), ...encodeDataPush(redeem)])),
      input(1, foreignLock ? EMPTY : readOnly),
      input(2, EMPTY),
    ],
    outputs: [
      master(),
      { lockingBytecode: recordLock, valueSatoshis: VALUE, token: token('mutable', record) },
      ...Array.from({ length: threads }, master),
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

describe('a split or merge entry reading a record only through a subroutine', () => {
  const slotsOf = (artifact: Artifact, name: string): string[] => (artifact.abi
    .find((entry) => entry.name === name)?.blockLayout?.slots ?? []).map((slot) => `${slot.kind}@${slot.offset}`);
  const split = compileString(SPLIT, LIFECYCLE);

  it('places the record in the block of a split, a merge and a self-call split', () => {
    expect(slotsOf(split, 'fork'), 'pointer split').toEqual(['master@0', 'dataNft@1']);
    expect(slotsOf(compileString(MERGE, LIFECYCLE), 'join'), 'pointer merge').toEqual(['master@0', 'dataNft@1']);
    expect(slotsOf(compileString(SELF_CALL_SPLIT, LIFECYCLE), 'fork'), 'self-call split')
      .toEqual(['master@0', 'dataNft@1']);
    console.info(`subroutine-read split: ${scriptToBytecode(asmToScript(split.bytecode)).length} B`);
  });

  it('settles an honest split against the record at the data-NFT lock', () => {
    expect(spend(split, undefined, 1), 'honest split').toBe(true);
  });

  it('refuses a forged mutable NFT of the category at a foreign lock beside the split', () => {
    const verdict = spend(split, ANYONE, 1);
    expect(verdict, 'forged record lock').not.toBe(true);
    expect(verdict, 'refused by the contract input').toMatch(/input index 0/);
  });
});
