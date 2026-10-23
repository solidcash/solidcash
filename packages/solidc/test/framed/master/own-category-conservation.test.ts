import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeAuthenticationInstructions, encodeDataPush, encodeLockingBytecodeP2pkh,
  hexToBin, Opcodes,
} from '@bitauth/libauth';
import {
  INDEX_NONE, buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash, encodeWitnessBlock,
  scriptToBytecode, sha256, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { selfSettlementScript } from '../../../src/framed/master/frame-tail.js';
import {
  decideValidator, type FramedTransaction, type TokenShape, type ValidatorReasonName,
} from '../../../src/framed/validator/index.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  chunkCommitments, chunkLock, deployChunkRunContract, distinctBytes, lengthHeader, type ChunkRunContract,
} from './chunk-run-input.js';
import {
  REAL_VALIDATOR_PROGRAM, dataRecordLock, validatorFacetPlacements, validatorSpend,
} from './validator-input.js';

/**
 * C3, the own-category mutable NFT count, on the framed path.
 *
 * The direct convention ends an entry with no mapping access by requiring as many mutable NFTs of the contract's own
 * category among the outputs as among the inputs, so no record is destroyed or minted beside it. A framed frame of
 * such an entry can sit beside a sibling frame of its contract that inserts a node or consumes a chunk, and the count
 * then refuses it. A framed master's records are settled by a census instead: its own walk when it is its
 * category's only master (S2, S3), the validator's when another master or a delegate frame shares them (V7, V8). Both
 * admit an own-category mutable token only where a frame declares it, so the count is dropped for every master whose
 * head runs that walk whenever it stands alone. A head that can forward a delegate call runs it for a frame whose
 * block records no such call, and the validator settles its contract when the call is made, so it drops the count too.
 *
 * Every case drives the shipped compile and deployment and asks the BCH-2026 machine for the verdict of each
 * contract input of one hand-built transaction. A refusal is a minimal variation of an accepted composition, and it
 * names the check that refuses: the validator's by the shipped derivation's reason, a master's by where its failing
 * instruction sits.
 */

const label = (text: string): Uint8Array => sha256(new TextEncoder().encode(text));
const USER_LOCK = encodeLockingBytecodeP2pkh(label('own category user').slice(0, 20));
const EMPTY = new Uint8Array(0);
const ZERO_SLOT = new Uint8Array(32);
const VALUE = 20_000n;
const USER_VALUE = 100_000n;
const FACETS = validatorFacetPlacements();

type Machine = ReturnType<typeof createVirtualMachineBch2026>;
type VmProgram = Parameters<Machine['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];
type VmState = ReturnType<Machine['evaluate']>;

/** A deployed framed master, and the covenant its first collection's nodes sit at, when it has one. */
interface Deployed extends ChunkRunContract {
  readonly nodeLock: Uint8Array;
  readonly nodeRedeem: Uint8Array;
}

function deploy(name: string, source: string): Deployed {
  const artifact = compileString(source, { composition: 'framed' });
  const contract = deployChunkRunContract(artifact, `own category ${name}`);
  const signature = artifact.stateLayout!.collections?.[0]?.signature ?? `${name} has no collection`;
  const nodeScript = buildEntryNftCovenantScript(contract.category, computeCollectionHash(signature));
  return { ...contract, nodeLock: scriptToLockingBytecode(nodeScript, 'p2sh32'), nodeRedeem: scriptToBytecode(nodeScript) };
}

/** `release` reads no record and writes none: the shape that carries C3. */
const RELEASE = '   function release(int escrowId) { require(escrowId > 0); }';

const LEDGER = deploy('ledger', 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) marks;'
  + '   function mark(address who, uint amount) { marks[who] = amount; }'
  + RELEASE
  + ' }');

const BLOB = deploy('blob', 'pragma solidcash ^0.14.0;'
  + ' contract Blob {'
  + '   bytes public data;'
  + '   function set(bytes value) { this.data = value; }'
  + RELEASE
  + ' }');

/** The ledger with a forwarding fallback beside its entries: a head that can make a delegate call. */
const FORWARDER = deploy('forwarder', 'pragma solidcash ^0.14.0;'
  + ' contract Forwarder {'
  + '   address implementation;'
  + '   mapping(address => uint) marks;'
  + '   function mark(address who, uint amount) { marks[who] = amount; }'
  + RELEASE
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }');

const [K1, K2] = ['first holder', 'second holder'].map((text) => label(text).slice(0, 20)) as [Uint8Array, Uint8Array];
/** An amount's encoding, as the body stores it: one byte below `0x80`. */
const amountOf = (amount: number): Uint8Array => new Uint8Array([amount]);
/** A node: its key's slot, its successor's slot (zero at the end) and its value. */
const node = (key: Uint8Array, amount: number): Uint8Array =>
  encodeEntryCommitment(keyToSlot(key), ZERO_SLOT, amountOf(amount));
/** The head sentinel, linked to a key's node or to the end. */
const head = (next?: Uint8Array): Uint8Array =>
  encodeEntryCommitment(ZERO_SLOT, next === undefined ? ZERO_SLOT : keyToSlot(next));

/** One frame: the entry it runs, its arguments in parameter order, and the records its one segment declares. */
interface Frame {
  readonly entry: string;
  readonly args: readonly Uint8Array[];
  readonly records: readonly RecordEntry[];
}

/** The coordinates a composition's frames declare their records at. */
interface Indices {
  /** The first record the transaction spends. */
  readonly band: number;
  /** The first output past the user's, where created records sit. */
  readonly created: number;
}

/** A record spent at its own index, written back there or consumed, its index then paying out plainly. */
interface Placed {
  readonly lock: Uint8Array;
  readonly spent: Uint8Array;
  readonly written?: Uint8Array;
}

/** A mutable token of the contract's own category, at a lock. */
interface Token {
  readonly lock: Uint8Array;
  readonly commitment: Uint8Array;
}

interface Composition {
  readonly contract: Deployed;
  /** The frames, each entered by the user on a master of its own, at inputs 0, 1 and so on. */
  readonly frames: (at: Indices) => readonly Frame[];
  /** Whether a validator covers the frames, and whether its transcript settles the contract. */
  readonly validator?: 'settles' | 'settles nothing';
  readonly placed?: readonly Placed[];
  /** Records the frames create, at the outputs past the user. */
  readonly created?: readonly Token[];
  /** A record spent past the user, through its covenant's write path, and written nowhere. */
  readonly destroyed?: Token;
  /** A record written past every other output, which no frame declares. */
  readonly minted?: Token;
  /** Whether the transcript lists the destroyed record as a state input, or the minted one as created. */
  readonly listed?: boolean;
}

interface Built {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmOutput[];
  readonly frames: number;
  readonly validator?: number;
  readonly destroyed?: number;
}

const selectorOf = (contract: Deployed, entry: string): Uint8Array =>
  hexToBin(contract.artifact.abi.find((row) => row.name === entry)!.selector!);

/**
 * Inputs: the frames' masters, the validator and its facets, the spent records, the user, then the destroyed record.
 * Outputs recreate each in place, a consumed record's index paying out plainly; the created records follow the user,
 * and the minted one comes last.
 */
function build(composition: Composition): Built {
  const { contract } = composition;
  const placed = composition.placed ?? [];
  const created = composition.created ?? [];
  const frameCount = composition.frames({ band: 0, created: 0 }).length;
  const validatorIndex = composition.validator === undefined ? undefined : frameCount;
  const band = frameCount + (validatorIndex === undefined ? 0 : 1 + FACETS.length);
  const user = band + placed.length;
  const frames = composition.frames({ band, created: user + 1 });
  const token = (capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY): VmOutput['token'] =>
    ({ category: contract.category, amount: 0n, nft: { capability, commitment } });
  const input = (index: number, unlockingBytecode: Uint8Array): VmInput => ({
    outpointIndex: 0,
    outpointTransactionHash: label(`own category outpoint ${index}`),
    sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const mutable = (record: Token): VmOutput =>
    ({ lockingBytecode: record.lock, valueSatoshis: VALUE, token: token('mutable', record.commitment) });
  // A node's write path: the master at input 0 authorizes it, and the covenant then pins nothing else. The spent
  // records' own inputs are not evaluated, so they carry the same two pushes without their covenants.
  const writePath = [Opcodes.OP_0, Opcodes.OP_1];
  const destroyPath = new Uint8Array([...writePath, ...encodeDataPush(contract.nodeRedeem)]);
  const destroyed = composition.destroyed === undefined ? undefined : user + 1;
  const minted = user + 1 + created.length;
  const validator = validatorSpend(contract.category, {
    roots: frames.map((_, index) => index),
    masters: frames.map((_, index) => index),
    settles: composition.validator === 'settles'
      ? [{
        category: contract.category,
        stateInputs: [
          ...placed.map((_, offset) => band + offset),
          ...(destroyed !== undefined && composition.listed === true ? [destroyed] : []),
        ],
        createdOutputs: [
          ...created.map((_, offset) => user + 1 + offset),
          ...(composition.minted !== undefined && composition.listed === true ? [minted] : []),
        ],
      }]
      : [],
  });
  const master: VmOutput = { lockingBytecode: contract.masterLock, valueSatoshis: VALUE, token: token('minting') };
  const validatorOutput: VmOutput = { lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token('mutable') };
  const userOutput: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE };
  const masterUnlocking = (frame: Frame): Uint8Array => {
    const block: WitnessBlock = {
      kind: 0,
      callerRef: user,
      originRef: user,
      validatorRef: validatorIndex ?? INDEX_NONE,
      sender: USER_LOCK,
      self: contract.address,
      value: 0n,
      retval: EMPTY,
      calls: [],
      segments: [[...frame.records]],
      events: [],
      sends: [],
    };
    return new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(selectorOf(contract, frame.entry)),
      ...[...frame.args].reverse().flatMap((push) => [...encodeDataPush(push)]),
      ...encodeDataPush(contract.program),
    ]);
  };
  const validatorSpan = validatorIndex === undefined ? [] : [validatorOutput, ...FACETS.map((facet) => facet.output)];
  const inputs: VmInput[] = [
    ...frames.map((frame, index) => input(index, masterUnlocking(frame))),
    ...(validatorIndex === undefined ? [] : [
      input(validatorIndex, validator.unlockingBytecode),
      ...FACETS.map((facet, offset) => input(validatorIndex + 1 + offset, facet.input.unlockingBytecode)),
    ]),
    ...placed.map((_, offset) => input(band + offset, new Uint8Array(writePath))),
    input(user, callerUnlockingBytecode()),
    ...(destroyed === undefined ? [] : [input(destroyed, destroyPath)]),
  ];
  const sourceOutputs: VmOutput[] = [
    ...frames.map(() => master),
    ...validatorSpan,
    ...placed.map((record) => mutable({ lock: record.lock, commitment: record.spent })),
    userOutput,
    ...(composition.destroyed === undefined ? [] : [mutable(composition.destroyed)]),
  ];
  const outputs: VmOutput[] = [
    ...frames.map(() => master),
    ...validatorSpan,
    ...placed.map((record) => (record.written === undefined
      ? { lockingBytecode: USER_LOCK, valueSatoshis: VALUE }
      : mutable({ lock: record.lock, commitment: record.written }))),
    userOutput,
    ...created.map(mutable),
    ...(composition.minted === undefined ? [] : [mutable(composition.minted)]),
  ];
  return {
    transaction: { version: 2, inputs, outputs, locktime: 0 },
    sourceOutputs,
    frames: frames.length,
    ...(validatorIndex === undefined ? {} : { validator: validatorIndex }),
    ...(destroyed === undefined ? {} : { destroyed }),
  };
}

/** Where a master's refusal happened: the code that was running, and the failing instruction's place in it. */
interface Site {
  /** The running code: the master's program, or the body of a helper it invoked. */
  readonly code: Uint8Array;
  readonly opcodes: readonly number[];
  /** The failing instruction's position among `opcodes`, and its byte offset in `code`. */
  readonly at: number;
  readonly offset: number;
}

interface Verdicts {
  /** Each frame's master, in input order: accepted, or the site of its refusal. */
  readonly frames: readonly (true | Site)[];
  /** The validator and every facet: the settlement is theirs together. */
  readonly settlement?: boolean;
  /** The destroyed record's own covenant. */
  readonly destroyed?: boolean;
  /** The shipped derivation's reason for refusing the validator input, if it refuses. */
  readonly reason?: ValidatorReasonName;
}

function siteOf(state: VmState): Site {
  const at = state.ip - 1;
  return {
    code: encodeAuthenticationInstructions(state.instructions),
    opcodes: state.instructions.map((instruction) => instruction.opcode),
    at,
    offset: encodeAuthenticationInstructions(state.instructions.slice(0, at)).length,
  };
}

/** The same transaction in the shape the validator's derivation reads. */
function modelOf(built: Built): FramedTransaction {
  const capabilities = { none: 0, mutable: 1, minting: 2 } as const;
  const shape = (holder: VmOutput): TokenShape => (holder.token === undefined
    ? { category: EMPTY, capability: 0, hasNft: false, nftCommitment: EMPTY, amount: 0n }
    : {
      category: holder.token.category,
      capability: capabilities[holder.token.nft?.capability ?? 'none'],
      hasNft: holder.token.nft !== undefined,
      nftCommitment: holder.token.nft?.commitment ?? EMPTY,
      amount: holder.token.amount,
    });
  return {
    inputs: built.transaction.inputs.map((input, index) => ({
      index,
      value: built.sourceOutputs[index]!.valueSatoshis,
      lockingBytecode: built.sourceOutputs[index]!.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: shape(built.sourceOutputs[index]!),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    })),
    outputs: built.transaction.outputs.map((output, index) => ({
      index, value: output.valueSatoshis, lockingBytecode: output.lockingBytecode, token: shape(output),
    })),
  };
}

function verdicts(composition: Composition): Verdicts {
  const built = build(composition);
  const vm = compositionMachine();
  const evaluate = (inputIndex: number): VmState =>
    vm.evaluate({ inputIndex, sourceOutputs: built.sourceOutputs, transaction: built.transaction });
  const accepted = (inputIndex: number): boolean => vm.stateSuccess(evaluate(inputIndex)) === true;
  const frames = Array.from({ length: built.frames }, (_, index): true | Site => {
    const state = evaluate(index);
    return vm.stateSuccess(state) === true ? true : siteOf(state);
  });
  const validator = built.validator;
  const reason = validator === undefined ? undefined : decideValidator(modelOf(built), {
    validatorTemplate: REAL_VALIDATOR_PROGRAM, validatorInputIndex: validator,
  }).rejection?.reason;
  return {
    frames,
    ...(validator === undefined ? {} : {
      settlement: FACETS.every((_, offset) => accepted(validator + 1 + offset)) && accepted(validator),
    }),
    ...(built.destroyed === undefined ? {} : { destroyed: accepted(built.destroyed) }),
    ...(reason === undefined ? {} : { reason }),
  };
}

/** The byte offset of the first occurrence of `needle` in `code` at or past `from`, or -1. */
function byteIndexOf(code: Uint8Array, needle: Uint8Array, from = 0): number {
  const hex = binToHex(code);
  const wanted = binToHex(needle);
  for (let at = hex.indexOf(wanted, from * 2); at >= 0; at = hex.indexOf(wanted, at + 1)) {
    if (at % 2 === 0) return at / 2;
  }
  return -1;
}

/** The byte ranges of the head's own walk in a program: from the walk's leading bytes to the end of its index loop. */
function walkRanges(contract: Deployed): readonly (readonly [number, number])[] {
  const lead = selfSettlementScript({
    addressPayloadOffset: contract.artifact.composition!.placeholders.addressOffset + 1,
  }).slice(0, 40);
  // `OP_TXINPUTCOUNT OP_TXOUTPUTCOUNT OP_MAX OP_GREATERTHANOREQUAL OP_UNTIL`: the walk's last index test.
  const loopEnd = new Uint8Array([
    Opcodes.OP_TXINPUTCOUNT, Opcodes.OP_TXOUTPUTCOUNT, Opcodes.OP_MAX, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_UNTIL,
  ]);
  const ranges: [number, number][] = [];
  for (let start = byteIndexOf(contract.program, lead); start >= 0;
    start = byteIndexOf(contract.program, lead, start + 1)) {
    ranges.push([start, byteIndexOf(contract.program, loopEnd, start)]);
  }
  return ranges;
}

/**
 * The refusal is the walk's census (S2, S3): the failing instruction is the `OP_BOOLOR OP_VERIFY` that weighs an
 * index's token against what the walk saw there, inside the walk, in the master's own program. The program carries
 * the walk twice, in the standalone arm and in the arm that settles alone under a validator, so `copy` names which;
 * a master that can make a call has no standalone arm to settle in, so its one walk is the one under a validator.
 */
function isWalkCensus(contract: Deployed, verdict: true | Site, copy: 'standalone' | 'under a validator'): boolean {
  if (verdict === true) return false;
  const ranges = walkRanges(contract);
  const range = copy === 'standalone' ? ranges[0] : ranges[ranges.length - 1];
  return range !== undefined
    && binToHex(verdict.code) === binToHex(contract.program)
    && verdict.opcodes[verdict.at] === Opcodes.OP_VERIFY && verdict.opcodes[verdict.at - 1] === Opcodes.OP_BOOLOR
    && verdict.offset > range[0] && verdict.offset < range[1];
}

const release: Frame = { entry: 'release', args: [new Uint8Array([7])], records: [] };

/**
 * A first mark: K1 inserted through the head the transaction spends, which follows any leading records, and its
 * node created at the first output past the user.
 */
function firstMark(at: Indices, leading: readonly RecordEntry[] = []): Frame {
  const headIndex = at.band + leading.length;
  return {
    entry: 'mark',
    args: [K1, amountOf(11)],
    records: [
      ...leading,
      { in: headIndex, out: headIndex, viewIn: head(), viewOut: head(K1) },
      { in: INDEX_NONE, out: at.created, viewIn: EMPTY, viewOut: node(K1, 11) },
    ],
  };
}

/** The first mark and the release, two frames of the ledger under one validator that settles it. */
const markBesideRelease = (change: Partial<Composition> = {}): Composition => ({
  contract: LEDGER,
  frames: (at) => [firstMark(at), release],
  validator: 'settles',
  placed: [{ lock: LEDGER.nodeLock, spent: head(), written: head(K1) }],
  created: [{ lock: LEDGER.nodeLock, commitment: node(K1, 11) }],
  ...change,
});

/** A node of another key, which no frame of any case declares. */
const STRAY: Token = { lock: LEDGER.nodeLock, commitment: node(K2, 5) };

describe('an entry with no mapping access beside a sibling frame that creates or consumes a record', () => {
  it('settles beside a first insert: both frames and the validator accept', () => {
    // The insert adds one mutable token of the ledger's category, which the count read as one minted.
    expect(verdicts(markBesideRelease())).toStrictEqual({ frames: [true, true], settlement: true });
  });

  it('settles beside a write that consumes a chunk of a dynamic value: both frames and the validator accept', () => {
    // The write shortens a two-chunk value to one chunk, so the second chunk is spent and written back nowhere.
    const spent = distinctBytes(150, 0x31);
    const written = distinctBytes(30, 0x57);
    const [first, second] = chunkCommitments(spent) as [Uint8Array, Uint8Array];
    const [rewritten] = chunkCommitments(written) as [Uint8Array];
    const lock = chunkLock(BLOB, 'data', 'bytes');
    const headerIn = lengthHeader(BLOB, { data: spent.length });
    const headerOut = lengthHeader(BLOB, { data: written.length });
    const composition: Composition = {
      contract: BLOB,
      frames: (at) => [{
        entry: 'set',
        args: [written],
        records: [
          { in: at.band, out: at.band, viewIn: headerIn, viewOut: headerOut },
          { in: at.band + 1, out: at.band + 1, viewIn: first, viewOut: rewritten },
          { in: at.band + 2, out: INDEX_NONE, viewIn: second, viewOut: EMPTY },
        ],
      }, release],
      validator: 'settles',
      placed: [
        { lock: dataRecordLock(BLOB.category), spent: headerIn, written: headerOut },
        { lock, spent: first, written: rewritten },
        { lock, spent: second },
      ],
    };
    expect(verdicts(composition)).toStrictEqual({ frames: [true, true], settlement: true });
  });
});

describe('a record destroyed or minted outside any declared write, under the validator\'s census (V7)', () => {
  it('refuses a node the transaction spends and writes nowhere, whichever state inputs the transcript lists', () => {
    // The node's own covenant admits the spend beside a master, and neither frame reads it; the validator refuses.
    for (const [listed, reason] of [
      [false, 'V7_STATE_INPUTS_MISMATCH'], [true, 'V7_TOUCHED_RECORDS_MISMATCH'],
    ] as const) {
      expect(verdicts(markBesideRelease({ destroyed: STRAY, listed })))
        .toStrictEqual({ frames: [true, true], settlement: false, destroyed: true, reason });
    }
  });

  it('refuses a node the transaction writes that no frame declares, whichever outputs the transcript lists', () => {
    for (const listed of [false, true]) {
      expect(verdicts(markBesideRelease({ minted: STRAY, listed })))
        .toStrictEqual({ frames: [true, true], settlement: false, reason: 'V7_CENSUS_UNEXPECTED_MUTABLE' });
    }
  });
});

describe('a record destroyed or minted outside any declared write, under a master that settles alone (S2, S3)', () => {
  it('accepts the release standing alone', () => {
    expect(verdicts({ contract: LEDGER, frames: () => [release] })).toStrictEqual({ frames: [true] });
  });

  it('refuses a node spent and written nowhere, at the census of the standalone walk', () => {
    const refused = verdicts({ contract: LEDGER, frames: () => [release], destroyed: STRAY });
    expect(refused.destroyed).toBe(true);
    expect(isWalkCensus(LEDGER, refused.frames[0]!, 'standalone')).toBe(true);
  });

  it('refuses a node written that no segment declares, at the census of the standalone walk', () => {
    const refused = verdicts({ contract: LEDGER, frames: () => [release], minted: STRAY });
    expect(isWalkCensus(LEDGER, refused.frames[0]!, 'standalone')).toBe(true);
  });

  it('refuses a node spent and written nowhere beside a validator that settles nothing, at the walk under it', () => {
    // The ledger has one master, so the validator does not settle it (V8) and accepts; the master's own walk refuses.
    expect(verdicts({ contract: LEDGER, frames: () => [release], validator: 'settles nothing' }))
      .toStrictEqual({ frames: [true], settlement: true });
    const refused = verdicts({ contract: LEDGER, frames: () => [release], validator: 'settles nothing', destroyed: STRAY });
    expect(refused.settlement).toBe(true);
    expect(refused.destroyed).toBe(true);
    expect(isWalkCensus(LEDGER, refused.frames[0]!, 'under a validator')).toBe(true);
  });
});

describe('a master whose head can forward a delegate call drops the count', () => {
  const STRAY_NODE: Token = { lock: FORWARDER.nodeLock, commitment: node(K2, 5) };

  it('settles alone under a validator a frame that makes no delegate call, so its walk refuses a stray node', () => {
    // The head asks the frame's block which calls it made: a frame that made no delegate call is its category's
    // only master, which the validator leaves to its own walk (V8).
    expect(walkRanges(FORWARDER)).toHaveLength(1);
    expect(verdicts({ contract: FORWARDER, frames: () => [release], validator: 'settles nothing' }))
      .toStrictEqual({ frames: [true], settlement: true });
    const refused = verdicts({
      contract: FORWARDER, frames: () => [release], validator: 'settles nothing', destroyed: STRAY_NODE,
    });
    expect(refused.settlement).toBe(true);
    expect(refused.destroyed).toBe(true);
    expect(isWalkCensus(FORWARDER, refused.frames[0]!, 'under a validator')).toBe(true);
  });

  it('settles an entry with no mapping access beside a sibling insert: both frames and the validator accept', () => {
    // The count refused this until the head ran its walk for a frame that makes no delegate call; with two masters
    // the validator settles the contract, as it does for the ledger beside the same insert.
    const record = hexToBin(buildPushdataCommitment(
      FORWARDER.artifact.stateLayout!, { implementation: LEDGER.address }, 0,
    ));
    const composition: Composition = {
      contract: FORWARDER,
      frames: (at) => [firstMark(at, [{ in: at.band, out: at.band, viewIn: record, viewOut: record }]), release],
      validator: 'settles',
      placed: [
        { lock: dataRecordLock(FORWARDER.category), spent: record, written: record },
        { lock: FORWARDER.nodeLock, spent: head(), written: head(K1) },
      ],
      created: [{ lock: FORWARDER.nodeLock, commitment: node(K1, 11) }],
    };
    expect(verdicts(composition)).toStrictEqual({ frames: [true, true], settlement: true });
  });
});
