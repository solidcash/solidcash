import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash, encodeWitnessBlock,
  type Artifact, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import {
  deployMaster, stateRecordLockingBytecode, verifyMasterDeployment,
} from '../../../../solidcash/src/per-call/deploy/index.js';
import { encodeEntryCommitment } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A root frame's spend of one compiled per-call master and the records it declares.
 *
 * The source runs through `compileString` with the per-call convention and `deployMaster`, and the BCH-2026 machine
 * is asked for a verdict on the master's own input. The transaction is the user's signed input and the master,
 * then every record at the index it declares: a spent record is an input and the output at the same index, a
 * created one an output only. Unused indices carry plain user outputs.
 */

/** `length` bytes that are pairwise distinct for any length up to 256. */
export function distinctBytes(length: number, seed: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (seed + index * 37) & 0xff);
}

export const USER_LOCK = encodeLockingBytecodeP2pkh(distinctBytes(20, 0x51));
export const USER_INDEX = 0;
export const MASTER_INDEX = 1;
const EMPTY = new Uint8Array(0);
const ZERO_SLOT = new Uint8Array(32);
const RECORD_VALUE = 20_000n;

/** A node's commitment: its slot, its successor and its value tail. */
export function node(slot: Uint8Array, next: Uint8Array = ZERO_SLOT, tail: Uint8Array = EMPTY): Uint8Array {
  return encodeEntryCommitment(slot, next, tail);
}

/** The empty list's head sentinel, and the same head relinked to its first node. */
export function head(next: Uint8Array = ZERO_SLOT): Uint8Array {
  return encodeEntryCommitment(ZERO_SLOT, next);
}

/** A compiled master deployed under its own category, with the locks its records sit at. */
export interface DeployedMaster {
  readonly artifact: Artifact;
  readonly category: Uint8Array;
  readonly script: Uint8Array;
  readonly address: Uint8Array;
  readonly lock: Uint8Array;
  /** The lock of the collection the layout publishes under `name`. */
  collectionLock(name: string): Uint8Array;
  /** The data record's lock. */
  readonly recordLock: Uint8Array;
  /** The data record's commitment for the given field values. */
  record(values: Record<string, bigint>): Uint8Array;
}

export function deployPerCallMaster(source: string, label: string): DeployedMaster {
  const artifact = compileString(source, { composition: 'per-call' });
  const category = seededCategory(label);
  const deployed = deployMaster(artifact, category, REAL_VALIDATOR_PROGRAM);
  verifyMasterDeployment(deployed, artifact, category, REAL_VALIDATOR_PROGRAM);
  return {
    artifact,
    category,
    script: deployed.script,
    address: deployed.address,
    lock: encodeLockingBytecodeP2sh32(hash256(deployed.script)),
    collectionLock: (name: string): Uint8Array => {
      const collection = artifact.stateLayout?.collections?.find((candidate) => candidate.name === name);
      if (collection === undefined) throw new Error(`the layout publishes no collection '${name}'`);
      return scriptToLockingBytecode(
        buildEntryNftCovenantScript(category, computeCollectionHash(collection.signature)), 'p2sh32',
      );
    },
    recordLock: stateRecordLockingBytecode(binToHex(category)),
    record: (values: Record<string, bigint>): Uint8Array =>
      new Uint8Array(Buffer.from(buildPushdataCommitment(artifact.stateLayout!, values, 0), 'hex')),
  };
}

/** One record of the spend: where it sits and the views its declaration states. */
export interface PlacedRecord {
  readonly lock: Uint8Array;
  /** The input index it is spent at; absent for a record the transaction creates. */
  readonly in?: number;
  readonly out: number;
  /** The commitment it is spent with, which is also the declared `viewIn`. */
  readonly before?: Uint8Array;
  /** The declared `viewOut`. */
  readonly after: Uint8Array;
  /** The commitment its output carries, when it is not the declared `viewOut`. */
  readonly written?: Uint8Array;
  /** The lock its output sits at, when it is not the lock it is spent from. */
  readonly writtenLock?: Uint8Array;
}

/** A record spent at `index` and recreated there. */
export function spent(lock: Uint8Array, index: number, before: Uint8Array, after: Uint8Array = before): PlacedRecord {
  return { lock, in: index, out: index, before, after };
}

/** A record the transaction creates at output `index`. */
export function created(lock: Uint8Array, index: number, after: Uint8Array): PlacedRecord {
  return { lock, out: index, after };
}

export interface MasterSpend {
  /** The entry a contract with several dispatches to: its selector leads the argument pushes. */
  readonly entry?: string;
  /** The entry's argument pushes, deepest parameter first. */
  readonly args: readonly Uint8Array[];
  /** The records, in the order the segment declares them. */
  readonly records: readonly PlacedRecord[];
  /** A declaration that differs from the one the records state. */
  readonly declared?: readonly RecordEntry[];
  /** The `retval` the frame declares; empty when unset. */
  readonly retval?: Uint8Array;
}

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];

/** The declaration the records state, in their own order. */
export function declarationOf(records: readonly PlacedRecord[]): RecordEntry[] {
  return records.map((record) => ({
    in: record.in ?? 0xffff, out: record.out, viewIn: record.before ?? EMPTY, viewOut: record.after,
  }));
}

/** Evaluates the master's own input in the transaction the spend lays out. */
export function evaluateMasterSpend(
  master: DeployedMaster,
  spend: MasterSpend,
): { accepted: boolean; objection?: string } {
  const token = (capability: 'minting' | 'mutable', commitment: Uint8Array): VmOutput['token'] =>
    ({ category: master.category, amount: 0n, nft: { capability, commitment } });
  const outpoint = (index: number): Uint8Array => distinctBytes(32, 0x80 + index);
  const selector = spend.entry === undefined ? [] : [...encodeDataPush(new Uint8Array(Buffer.from(
    master.artifact.abi.find((candidate) => candidate.name === spend.entry)!.selector!, 'hex')))];
  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: master.address,
    value: 0n,
    retval: spend.retval ?? EMPTY,
    calls: [],
    segments: [[...(spend.declared ?? declarationOf(spend.records))]],
    events: [],
    sends: [],
  };
  const inputs: VmInput[] = [
    {
      outpointIndex: 0, outpointTransactionHash: outpoint(USER_INDEX), sequenceNumber: 0xffffffff,
      unlockingBytecode: callerUnlockingBytecode(),
    },
    {
      outpointIndex: 0, outpointTransactionHash: outpoint(MASTER_INDEX), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(block)),
        ...selector,
        ...spend.args.flatMap((arg) => [...encodeDataPush(arg)]),
        ...encodeDataPush(master.script),
      ]),
    },
  ];
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    { lockingBytecode: master.lock, valueSatoshis: RECORD_VALUE, token: token('minting', EMPTY) },
  ];
  const outputs: VmOutput[] = [
    { lockingBytecode: USER_LOCK, valueSatoshis: 50_000n },
    { lockingBytecode: master.lock, valueSatoshis: RECORD_VALUE, token: token('minting', EMPTY) },
  ];
  const lastInput = Math.max(MASTER_INDEX, ...spend.records.map((record) => record.in ?? 0));
  for (let index = MASTER_INDEX + 1; index <= lastInput; index += 1) {
    const record = spend.records.find((candidate) => candidate.in === index);
    inputs.push({
      outpointIndex: 0, outpointTransactionHash: outpoint(index), sequenceNumber: 0xffffffff,
      unlockingBytecode: encodeDataPush(new Uint8Array([1])),
    });
    sourceOutputs.push(record === undefined
      ? { lockingBytecode: USER_LOCK, valueSatoshis: 10_000n }
      : { lockingBytecode: record.lock, valueSatoshis: RECORD_VALUE, token: token('mutable', record.before!) });
  }
  const lastOutput = Math.max(MASTER_INDEX, ...spend.records.map((record) => record.out));
  for (let index = MASTER_INDEX + 1; index <= lastOutput; index += 1) {
    const record = spend.records.find((candidate) => candidate.out === index);
    outputs.push(record === undefined
      ? { lockingBytecode: USER_LOCK, valueSatoshis: 1_000n }
      : {
        lockingBytecode: record.writtenLock ?? record.lock,
        valueSatoshis: RECORD_VALUE,
        token: token('mutable', record.written ?? record.after),
      });
  }
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}
