import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
  hexToBin,
} from '@bitauth/libauth';
import {
  INDEX_NONE, buildChunkCommitment, buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash,
  dynamicChunkSignature, encodeWitnessBlock, scriptToBytecode, splitValueIntoChunks, type RecordEntry,
  type WitnessBlock,
} from '@solidcash/utils';
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/per-call/deploy/index.js';
import type { compileString } from '../../../src/compiler.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { dataRecordLock, REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * Dynamic values' chunk runs, laid out for a per-call master that settles alone.
 *
 * The master sits at index 0, the signing user at 1 and the data NFT that carries the values' length headers at 2.
 * Any leading records, such as a mapping write's group, follow from 3, each spent and recreated at its own index.
 * The runs follow them, each one position per chunk of the wider of its two versions, in the order given: a chunk
 * both versions hold is spent and recreated at its index, a chunk only the written value holds is created there with
 * no input, and a chunk only the spent value holds is spent there while its index carries a plain output. Every
 * commitment comes from the shipped encoders, and each position declares the record the SDK's chunk plan declares
 * for it. A mutation moves one fact of one run away from the honest transaction, so each refusal is paired with the
 * accept it changes.
 */

type Artifact = ReturnType<typeof compileString>;
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];

/** Bytes spelled distinctly per position, so no two chunks or values coincide by accident. */
export function distinctBytes(length: number, seed: number): Uint8Array {
  return Uint8Array.from({ length }, (_, at) => (seed + at * 7) & 0xff);
}

/** A P2PKH lock over a distinct-byte hash. */
export function distinctLock(seed: number): Uint8Array {
  return encodeLockingBytecodeP2pkh(distinctBytes(20, seed));
}

const USER_LOCK = distinctLock(0x40);
const MASTER_VALUE = 20_000n;
const STATE_VALUE = 20_000n;
const CHUNK_VALUE = 1_000n;
const USER_VALUE = 100_000n;
const MASTER_INDEX = 0;
const USER_INDEX = 1;
const STATE_INDEX = 2;
/** The first position past the data NFT the frame declares first: the leading records', or else the first run's. */
const RUN_BASE = 3;
/** A chunk's unlocking bytecode: the master whose write authorizes it, then the flag that takes the write path. */
const CHUNK_UNLOCKING_BYTECODE = new Uint8Array([0x00, 0x51]);
const EMPTY = new Uint8Array(0);

/** A compiled per-call master deployed under its own category. */
export interface ChunkRunContract {
  readonly artifact: Artifact;
  readonly category: Uint8Array;
  readonly program: Uint8Array;
  readonly address: Uint8Array;
  readonly masterLock: Uint8Array;
}

/** Deploys a compiled per-call master under a category seeded from `label`, and checks the deployment. */
export function deployChunkRunContract(artifact: Artifact, label: string): ChunkRunContract {
  const category = seededCategory(label);
  const deployed = deployMaster(artifact, category, REAL_VALIDATOR_PROGRAM);
  verifyMasterDeployment(deployed, artifact, category, REAL_VALIDATOR_PROGRAM);
  return {
    artifact,
    category,
    program: deployed.script,
    address: deployed.address,
    masterLock: encodeLockingBytecodeP2sh32(hash256(deployed.script)),
  };
}

/** The lock every chunk of `variable` carries: the value's own collection covenant under the contract's category. */
export function chunkLock(contract: ChunkRunContract, variable: string, type: string): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildEntryNftCovenantScript(
    contract.category, computeCollectionHash(dynamicChunkSignature(variable, type)),
  ))));
}

/** The commitments of a value's chunks, in index order. */
export function chunkCommitments(value: Uint8Array): Uint8Array[] {
  return splitValueIntoChunks(value).map((piece, index) => hexToBin(buildChunkCommitment(index, piece)));
}

/** One dynamic value the entry touches: its declared type and its encoding before and after the entry. */
export interface ChunkRun {
  readonly variable: string;
  /** The declared type, which the chunk collection's covenant identity is derived from. */
  readonly type: string;
  readonly spent: Uint8Array;
  readonly written: Uint8Array;
}

/**
 * A record the segment declares between the data record and the runs, spent and recreated at its own index, or
 * created there from nothing when its input view is empty.
 */
export interface LeadingRecord {
  readonly lock: Uint8Array;
  readonly viewIn: Uint8Array;
  readonly viewOut: Uint8Array;
}

/** The entry's arguments, the runs it touches, and the encoded lengths of the values it leaves alone. */
export interface ChunkRunEntry {
  /** The entry's argument pushes, in declaration order. */
  readonly args?: readonly Uint8Array[];
  readonly runs: readonly ChunkRun[];
  /** The byte length of each dynamic value no run touches, which the header carries unchanged. */
  readonly untouched?: Readonly<Record<string, number>>;
  /** Records past the data record and ahead of the runs, such as a mapping write's group. */
  readonly leading?: readonly LeadingRecord[];
}

/** One fact of one run, the first unless `run` names another, moved away from the honest transaction. */
export interface ChunkRunMutation {
  /** The position in `runs` of the run the facts below move; the first when unset. */
  readonly run?: number;
  /**
   * The runs after the first are declared where the first run's spent or written chunks end, and the first run's
   * records past that count after them, rather than each run past every record of the one before it.
   */
  readonly laterRunsAt?: 'spent' | 'written';
  /** Drop every chunk record from the segment. */
  readonly undeclaredRun?: boolean;
  /** The commitment the first spent chunk's input carries, while its declaration keeps the honest view. */
  readonly spentInputChunk?: Uint8Array;
  /** The commitment the first written chunk carries, in its declaration and its output. */
  readonly writtenChunk?: Uint8Array;
  /** The length header the transaction writes, in its declaration and its output. */
  readonly writtenHeader?: Uint8Array;
  /** One more chunk created past the runs, declared and written at the run's chunk address. */
  readonly orphan?: Uint8Array;
  /** Chunks only the spent value holds are left unspent and undeclared. */
  readonly leaveRemoved?: boolean;
  /** Chunks only the spent value holds are recreated unchanged at their index rather than consumed. */
  readonly keepRemoved?: boolean;
  /** Chunks only the spent value holds are declared consumed while their index carries them back unchanged. */
  readonly recreateRemoved?: boolean;
  /** The lock every chunk of the run is spent from and written at, instead of the value's chunk address. */
  readonly runLock?: Uint8Array;
  /** The lock the first chunk is spent from, while it is still written at the value's chunk address. */
  readonly spentInputLock?: Uint8Array;
  /** The lock the first chunk is recreated at, instead of the one it is spent from. */
  readonly keptOutputLock?: Uint8Array;
  /** The first spent chunk is declared created, carrying this view, and its input is left unspent. */
  readonly fabricatedSpentView?: Uint8Array;
}

/** The length header for the given encoded byte lengths, from the shipped encoder. */
export function lengthHeader(contract: ChunkRunContract, lengths: Readonly<Record<string, number>>): Uint8Array {
  const values = Object.fromEntries(Object.entries(lengths).map(([name, length]) => [`${name}$len`, BigInt(length)]));
  return hexToBin(buildPushdataCommitment(contract.artifact.stateLayout!, values, 0));
}

/** Builds the runs' transaction and evaluates the master's own input on the BCH-2026 machine. */
export function evaluateChunkRuns(
  contract: ChunkRunContract,
  entry: ChunkRunEntry,
  mutation: ChunkRunMutation = {},
): { accepted: boolean; objection?: string } {
  const lengths = (side: 'spent' | 'written'): Record<string, number> => ({
    ...entry.untouched,
    ...Object.fromEntries(entry.runs.map((run) => [run.variable, run[side].length])),
  });
  const headerIn = lengthHeader(contract, lengths('spent'));
  const headerOut = mutation.writtenHeader ?? lengthHeader(contract, lengths('written'));
  const token = (capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY): VmOutput['token'] =>
    ({ category: contract.category, amount: 0n, nft: { capability, commitment } });
  const spend = (seed: number, unlockingBytecode: Uint8Array): VmInput => ({
    outpointIndex: 0,
    outpointTransactionHash: distinctBytes(32, seed),
    sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });

  const records: RecordEntry[] = [{ in: STATE_INDEX, out: STATE_INDEX, viewIn: headerIn, viewOut: headerOut }];
  const runInputs: { input: VmInput; source: VmOutput }[] = [];
  const runOutputs: VmOutput[] = [];
  // A position with no input or no output of its own is padded with a plain one, so later positions keep their index.
  const padInputs = (to: number): void => {
    while (RUN_BASE + runInputs.length < to) {
      runInputs.push({
        input: spend(0x90 + runInputs.length, encodeDataPush(new Uint8Array([1]))),
        source: { lockingBytecode: USER_LOCK, valueSatoshis: CHUNK_VALUE },
      });
    }
  };
  const padOutputs = (to: number): void => {
    while (RUN_BASE + runOutputs.length < to) runOutputs.push({ lockingBytecode: USER_LOCK, valueSatoshis: CHUNK_VALUE });
  };
  for (const [offset, leading] of (entry.leading ?? []).entries()) {
    const at = RUN_BASE + offset;
    const created = leading.viewIn.length === 0;
    records.push({ in: created ? INDEX_NONE : at, out: at, viewIn: leading.viewIn, viewOut: leading.viewOut });
    if (created) {
      padInputs(at + 1);
    } else {
      runInputs.push({
        input: spend(0x70 + offset, CHUNK_UNLOCKING_BYTECODE),
        source: { lockingBytecode: leading.lock, valueSatoshis: CHUNK_VALUE, token: token('mutable', leading.viewIn) },
      });
    }
    runOutputs.push({ lockingBytecode: leading.lock, valueSatoshis: CHUNK_VALUE, token: token('mutable', leading.viewOut) });
  }
  const mutated = mutation.run ?? 0;
  const laid = entry.runs.map((run, runIndex) => {
    const spentChunks = chunkCommitments(run.spent);
    const writtenChunks = chunkCommitments(run.written);
    if (runIndex === mutated && mutation.writtenChunk !== undefined) writtenChunks[0] = mutation.writtenChunk;
    return {
      lock: (runIndex === mutated ? mutation.runLock : undefined) ?? chunkLock(contract, run.variable, run.type),
      spentChunks,
      writtenChunks,
      width: Math.max(spentChunks.length, writtenChunks.length),
    };
  });
  // Each run's positions in declaration order; `laterRunsAt` moves the first run's positions past the count it names
  // behind every other run.
  const cut = mutation.laterRunsAt === undefined ? laid[0]?.width ?? 0
    : laid[0]![mutation.laterRunsAt === 'spent' ? 'spentChunks' : 'writtenChunks'].length;
  const positions = laid.flatMap(({ width }, runIndex) =>
    Array.from({ length: width }, (_, offset) => ({ runIndex, offset })));
  const order = [
    ...positions.filter(({ runIndex, offset }) => runIndex !== 0 || offset < cut),
    ...positions.filter(({ runIndex, offset }) => runIndex === 0 && offset >= cut),
  ];
  let index = RUN_BASE + (entry.leading?.length ?? 0);
  for (const { runIndex, offset } of order) {
    const { lock, spentChunks, writtenChunks } = laid[runIndex]!;
    const subject = runIndex === mutated;
    const spent = spentChunks[offset];
    const written = writtenChunks[offset];
    const head = subject && offset === 0;
    if (spent !== undefined && written === undefined && subject && mutation.leaveRemoved === true) {
      index += 1;
      continue;
    }
    const kept = written ?? (spent !== undefined && subject && mutation.keepRemoved === true ? spent : undefined);
    const fabricated = head && spent !== undefined && mutation.fabricatedSpentView !== undefined;
    if (fabricated) {
      records.push({ in: INDEX_NONE, out: index, viewIn: mutation.fabricatedSpentView!, viewOut: kept! });
    } else {
      records.push({
        in: spent === undefined ? INDEX_NONE : index,
        out: kept === undefined ? INDEX_NONE : index,
        viewIn: spent ?? EMPTY,
        viewOut: kept ?? EMPTY,
      });
    }
    if (spent !== undefined && !fabricated) {
      padInputs(index);
      runInputs.push({
        input: spend(0x50 + index, CHUNK_UNLOCKING_BYTECODE),
        source: {
          lockingBytecode: head && mutation.spentInputLock !== undefined ? mutation.spentInputLock : lock,
          valueSatoshis: CHUNK_VALUE,
          token: token('mutable', head && mutation.spentInputChunk !== undefined ? mutation.spentInputChunk : spent),
        },
      });
    }
    padOutputs(index);
    if (kept !== undefined) {
      const outputLock = head && mutation.keptOutputLock !== undefined ? mutation.keptOutputLock : lock;
      runOutputs.push({ lockingBytecode: outputLock, valueSatoshis: CHUNK_VALUE, token: token('mutable', kept) });
    } else if (spent !== undefined && subject && mutation.recreateRemoved === true) {
      runOutputs.push({ lockingBytecode: lock, valueSatoshis: CHUNK_VALUE, token: token('mutable', spent) });
    } else {
      // A consumed chunk's satoshis are paid out; its index carries no record.
      runOutputs.push({ lockingBytecode: USER_LOCK, valueSatoshis: CHUNK_VALUE });
    }
    index += 1;
  }
  if (mutation.orphan !== undefined) {
    const run = entry.runs[mutated]!;
    records.push({ in: INDEX_NONE, out: index, viewIn: EMPTY, viewOut: mutation.orphan });
    padOutputs(index);
    runOutputs.push({
      lockingBytecode: chunkLock(contract, run.variable, run.type),
      valueSatoshis: CHUNK_VALUE,
      token: token('mutable', mutation.orphan),
    });
  }

  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: INDEX_NONE,
    sender: USER_LOCK,
    self: contract.address,
    value: 0n,
    retval: EMPTY,
    calls: [],
    segments: [mutation.undeclaredRun === true ? records.slice(0, 1) : records],
    events: [],
    sends: [],
  };
  const argumentPushes = [...(entry.args ?? [])].reverse().flatMap((argument) => [...encodeDataPush(argument)]);
  const transaction: VmTransaction = {
    version: 2,
    inputs: [
      spend(0x10, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(block)), ...argumentPushes, ...encodeDataPush(contract.program),
      ])),
      spend(0x20, callerUnlockingBytecode()),
      spend(0x30, encodeDataPush(new Uint8Array([1]))),
      ...runInputs.map((run) => run.input),
    ],
    outputs: [
      { lockingBytecode: contract.masterLock, valueSatoshis: MASTER_VALUE, token: token('minting') },
      { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE },
      { lockingBytecode: dataRecordLock(contract.category), valueSatoshis: STATE_VALUE, token: token('mutable', headerOut) },
      ...runOutputs,
    ],
    locktime: 0,
  };
  const sourceOutputs: VmOutput[] = [
    { lockingBytecode: contract.masterLock, valueSatoshis: MASTER_VALUE, token: token('minting') },
    { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE },
    { lockingBytecode: dataRecordLock(contract.category), valueSatoshis: STATE_VALUE, token: token('mutable', headerIn) },
    ...runInputs.map((run) => run.source),
  ];

  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}
