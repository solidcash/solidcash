import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, sha256,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, SignatureTemplate, StatefulContract, TransactionBuilder, layer3,
} from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  acceptedByNode, createLayer3SemanticTestProvider, dustOutputs, formatDustOutputs,
} from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createReadOnlyDynamicChunkUnlocker, createSatoshiContainerUnlocker,
  getDataNftAddress, getDynamicChunkAddress, getEventNftAddress, getSatoshiContainerAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * C3 - the bounded maximum graph capstone.
 *
 * EIGHT participants, which is the deployed semantic bound: `MAX_GRAPH_PARTICIPANTS` in layer3/graph.ts, and
 * the `participantCount <= 8` require in both the graph-root controller and the projection covenant. One
 * transaction settles all eight:
 *
 *   inv0  root      -> P0.run       Router:   three outgoing calls, a scalar write
 *   inv1  Router    -> P1.record    Ledger:   reads chunk-backed dynamic storage, writes a scalar
 *   inv2  Router    -> P2.broker    Broker:   consumes the graph's only result, writes a scalar
 *   inv3  Broker    -> P4.score     Oracle:   the only returning handler - effect-free, no outgoing call
 *   inv4  Router    -> P3.hold      Escrow -> Settler -> Reporter -> Sink: a depth-4 chain
 *   inv5  Escrow    -> P5.settle
 *   inv6  Settler   -> P6.report
 *   inv7  Reporter  -> P7.absorb    Sink:     an event NFT and a satoshi transfer, and no outgoing call
 *
 * Eight independently compiled contract types, eight physical blocks, 108 balanced slots.
 *
 * The shape is constrained by refusals other tasks measured, none of which this capstone tries to move: a
 * returning handler may make no outgoing call and carry no effect (C1's boundary block); a handler that
 * consumes a result may not carry ANY second edge (X3 as corrected by C1) and may not carry an effect either
 * (X22); and a pointer-table caller stops binding its emission rows once its own contract declares a returning
 * handler (SEC-5). No contract here owns a pointer table, so no claim in this file depends on SEC-5.
 *
 * WHAT CLOSES SEC-6, corrected. This header used to add a fourth refusal - "a handler that makes an outgoing
 * call may not carry a physical effect, because the effect's block slot forces it to be flattened into the
 * route and its edges then generate unbound" - and cite it as the reason the Router carries no effects. That
 * shape is UNREACHABLE at this commit and the reshape is therefore redundant with the invariant, not what
 * enforces it. In `InlineStoragePointerCalls`, a function with `graphEmissionHandler` and an outgoing call
 * either satisfies `keepsGraphEmissionBinding` - `!hasPhysicalEffects(fn) || hasOutgoingCall(fn)`, whose second
 * disjunct an effect-carrying caller satisfies - and STAYS behind OP_INVOKE with its edges bound, or it fails
 * that predicate only through a token-container effect or a storage-pointer parameter and is thrown out by name
 * as `GraphEmissionEffectError`. Kept bound, or refused; never flattened. Measured, not inferred: the
 * PRE-reshape C3 Router compiles at this commit with a synthesized route, an eligible handler and non-zero
 * emission binding sites - `R2-C1-I` in ReviewR2CapstoneC1.test.ts compiles this exact contract.
 *
 * The reshape is kept because it is the shape this file's indices and assertions were built around: the event
 * NFT and the satoshi transfer sit on the Sink, the deepest leaf, rather than on the Router. The composition
 * still settles every physical effect kind; only their owner changed. The 108-slot total is unchanged, so
 * every sidecar index in this file is unchanged; the participant bases after P1 are not.
 *
 * SEMANTIC evidence only, on the named `layer3-bch2026-semantic-relaxed-v1` profile: BCH-2026 opcodes,
 * introspection and the real 128-byte NFT commitment, relaxed capacity.
 *
 * The last two tests measure capacity, and they establish two DIFFERENT things. On the CONSENSUS knobs C3
 * fits: all 108 inputs are inside ordinary BCH-2026 operation-cost density, the worst being the controller at
 * 0.9218 (measured at `77cd1e8c`). Under standard relay POLICY it NOW fits as well: the serialized
 * transaction is 96,118 bytes, 3,882 under the 100,000-byte ceiling. That reverses what this header used to
 * record - 100,354 bytes, 354 over - and the two claims still are not the same claim, which is why they are
 * still measured separately: the density result would survive a size change and the size result would not.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
/** One ABI value as the SCB1 row encodes it: a single minimal pushdata. */
const packedResult = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
/** The aggregate return blob a route commits to its return-event NFT: the row's result vector, pushed once. */
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);

const CALL_VALUE = 6n;
const SEED_WEIGHT = 7n;
/** Oracle.score(v) = v + 1. */
const SCORE = CALL_VALUE + 1n;
const CONTAINER_SATS = 5_000n;
/**
 * Where the Sink's compiled satoshi effect pays. A CONSTRUCTOR argument, so `absorb` keeps one parameter.
 *
 * X60. A real P2PKH script paying 1,000 satoshis, not the one-byte `OP_1` placeholder paying 10 that stood
 * here. BCHN's relay dust rule is `3 * (serialized output bytes + 148)`, so the old pair was 10 satoshis
 * against a 474-satoshi threshold and a real node refuses the transaction `64: dust`. C3 never showed it: at
 * 100,650 bytes the node refused `64: tx-size` first, and the whole mock stack has dust off by default
 * (`MockNetworkProvider` defaults `enforceDust: false`), so nothing measured here ever reached the rule.
 * A real recipient RAISES the threshold to `3 * (34 + 148)` = 546, so the amount had to move with it.
 *
 * F4 is what turns this from a latent defect into a live one: with C3 now under the relay ceiling the size
 * rule no longer refuses first, so the dust rule is the next one the node reaches.
 */
const RECIPIENT = hexToBin(`76a914${binToHex(bobPkh)}88ac`);
const TRANSFER_SATS = 1_000n;

/**
 * P0. The graph root: three outgoing calls and a scalar write.
 *
 * RESHAPED for SEC-6. This handler used to carry the event NFT and the satoshi transfer as well - the shape
 * SEC-6 measured FORGEABLE, in which an effect-carrying graph emission clone is flattened into the route
 * wrapper, its outgoing edges generate with `__scb1` as the current function, no emission row is recomputed,
 * and the transcript can state any target, selector or arguments for them.
 *
 * The compiler no longer produces that shape: since X29 an effect-carrying caller stays behind OP_INVOKE with
 * its per-site effect frame, and the only remaining path out is a named refusal. So this reshape does not
 * close SEC-6 - the compiler invariant does, and it would hold with the effects left here. See the header.
 * Both effects live on the Sink, a leaf that makes no outgoing call, so the composition still carries every
 * physical effect kind - see the note on P7.
 */
const ROUTER = `pragma solidcash >=0.8.0;
interface IC3Ledger { function record(bigint v); }
interface IC3Broker { function broker(bigint v); }
interface IC3Escrow { function hold(bigint v); }
contract C3Router(address ledger, address broker, address escrow) {
  bigint fired;
  function run(bigint v) public {
    IC3Ledger(ledger).record(v);
    IC3Broker(broker).broker(v);
    IC3Escrow(escrow).hold(v);
    this.fired = this.fired + v;
    require(v > 0);
  }
}`;

/** P1. Chunk-backed dynamic storage: the settled scalar is a function of a value that lives in a chunk UTXO. */
const LEDGER = `pragma solidcash >=0.8.0;
contract C3Ledger() {
  bigint seen;
  bigint[] weights;
  function seed(bigint w) public { this.weights.push(w); require(true); }
  function record(bigint v) public {
    require(this.weights.length > 0);
    this.seen = this.seen + v + this.weights[0];
    require(v > 0);
  }
}`;

/** P2. Consumes the only result in the graph. Exactly one edge, per the X3 refusal. */
const BROKER = `pragma solidcash >=0.8.0;
interface IC3Oracle { function score(bigint v) returns (bigint); }
contract C3Broker(address oracle) {
  bigint scored;
  function broker(bigint v) public {
    bigint s = IC3Oracle(oracle).score(v);
    this.scored = this.scored + s;
    require(s >= 0);
  }
}`;

/** P3. Head of the depth-4 chain. */
const ESCROW = `pragma solidcash >=0.8.0;
interface IC3Settler { function settle(bigint v); }
contract C3Escrow(address settler) {
  bigint held;
  function hold(bigint v) public {
    IC3Settler(settler).settle(v);
    this.held = this.held + v;
    require(v > 0);
  }
}`;

/** P4. The only returning participant: no outgoing call, no effect, one state write. */
const ORACLE = `pragma solidcash >=0.8.0;
contract C3Oracle(bigint brand) {
  bigint reviews;
  function score(bigint v) public returns (bigint) {
    this.reviews = this.reviews + 1;
    require(v > 0 && brand >= 0);
    return v + 1;
  }
}`;

/** P5. */
const SETTLER = `pragma solidcash >=0.8.0;
interface IC3Reporter { function report(bigint v); }
contract C3Settler(address reporter) {
  bigint settled;
  function settle(bigint v) public {
    IC3Reporter(reporter).report(v);
    this.settled = this.settled + v;
    require(v > 0);
  }
}`;

/** P6. */
const REPORTER = `pragma solidcash >=0.8.0;
interface IC3Sink { function absorb(bigint v); }
contract C3Reporter(address sink) {
  bigint reports;
  function report(bigint v) public {
    IC3Sink(sink).absorb(v);
    this.reports = this.reports + 1;
    require(v > 0);
  }
}`;

/**
 * P7. The deepest leaf, at depth 4, and now the participant that carries the physical effects.
 *
 * It makes NO outgoing call, so there is no edge whose emission row could go unbound and nothing here depends
 * on how effect-carrying CALLERS are handled. That is why the composition can still settle an event NFT and a
 * satoshi transfer from this participant whatever SEC-6's disposition of the caller case.
 */
const SINK = `pragma solidcash >=0.8.0;
contract C3Sink(bigint brand, bytes payee) {
  bigint total;
  event Absorbed(bigint amount);
  function absorb(bigint v) public {
    this.total = this.total + v;
    emit Absorbed(v);
    this.transfer(payee, ${TRANSFER_SATS});
    require(v > 0 && brand >= 0);
  }
}`;

/**
 * Ordinary BCH-2026 capacity, for the F1-style measurement at the bottom of this file. The two deviations are
 * the ones C1 already stated: relay dust stays disabled (dust is standard policy, not consensus, and this
 * fixture pays a 10-satoshi compiled satoshi effect), and the hash-iteration allowance is 3 rather than the
 * 3.5 nonstandard consensus figure, because the mock feeds one integer to both the standard and nonstandard
 * knobs. Passing under 3 is conservative on that axis; failing under it would be inconclusive.
 */
const ORDINARY_BUDGET_PER_BYTE = 800;

const createOrdinaryCapacityProvider = (): MockNetworkProvider => new MockNetworkProvider({
  consensusLimits: {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 10_000,
    maximumTransactionBytes: 1_000_000,
    maximumNftCommitmentBytes: 128,
    operationCostBudgetPerByte: ORDINARY_BUDGET_PER_BYTE,
    hashDigestIterationsPerByte: 3,
  },
  policy: { enforceDust: false },
});

/**
 * X25. Read the TRUE operation cost of every input of an ALREADY-BUILT transaction, by evaluating those exact
 * bytes a second time against a relaxed density ceiling so evaluation runs to completion.
 *
 * Why this is needed at all: libauth checks the density limit after EVERY operation and aborts on the first
 * excess, so a reported cost is always within one operation of the budget however much evaluation still had to
 * do. Reading a near-miss off an aborted evaluation reads the budget back, not the cost.
 *
 * The control is exact. Only `operationCostBudgetPerByte` and the hash-iteration allowance move; every other
 * consensus knob is the ordinary one, and the transaction is not rebuilt, so the same bytes and the same
 * `densityControlLength` are measured at both ceilings. The ratio is always computed against the ORDINARY
 * 800/byte budget.
 */
const RELAXED_BUDGET_LIMITS = {
  maximumInputBytes: 10_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800_000,
  hashDigestIterationsPerByte: 3_000,
};

interface InputCost {
  input: number;
  /** Unlocking bytecode length: what the density budget is computed from. */
  bytes: number;
  cost: number;
  budget: number;
  ratio: number;
  instructions: number;
  hashIterations: number;
  signatureChecks: number;
  arithmetic: number;
  pushedBytes: number;
}

function measureRunToCompletion(built: BuiltC3): InputCost[] {
  const transaction = built.builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs as never);
  const vm = createVirtualMachineBch2026ForProvider({ consensusLimits: RELAXED_BUDGET_LIMITS } as never);
  return transaction.inputs.map((_input, input) => {
    const state = vm.evaluate({ inputIndex: input, sourceOutputs, transaction }) as any;
    if (state.error !== undefined) {
      throw new Error(`X25: relaxed-budget evaluation still failed at input ${input}: ${state.error}`);
    }
    const metrics = state.metrics;
    const budget = metrics.densityControlLength * ORDINARY_BUDGET_PER_BYTE;
    return {
      input,
      bytes: metrics.densityControlLength,
      cost: metrics.operationCost,
      budget,
      ratio: metrics.operationCost / budget,
      instructions: metrics.evaluatedInstructionCount,
      hashIterations: metrics.hashDigestIterations,
      signatureChecks: metrics.signatureCheckCount,
      arithmetic: metrics.arithmeticCost,
      pushedBytes: metrics.stackPushedBytes,
    };
  });
}

/**
 * X59. Widened from `createLayer3SemanticTestProvider`'s mock-only return type to the union
 * `createTestProvider` returns, so `buildC3` can build this shape against a real BCHN regtest node. Until F4
 * this bought C3 nothing - it was over the 100,000-byte relay ceiling and the node refused it `64: tx-size`
 * without executing anything. F4 put it under, so the node block at the bottom of this file is now reachable.
 */
type Provider = ReturnType<typeof createTestProvider>;

/** The eight participant labels, in the physical order the default assembly concatenates them. */
const DEFAULT_ORDER = [
  'router', 'ledger', 'broker', 'escrow', 'oracle', 'settler', 'reporter', 'sink',
] as const;
type Label = (typeof DEFAULT_ORDER)[number];

/**
 * The one thing each hostile build changes. Every hostile build keeps the eight sources, the eight compiled
 * artifacts, the graph edges and the physical layout exactly as the control produced them.
 */
type Hostile =
  | 'none'
  /** A ninth stateful participant block is co-spent by the same transaction; the table still names eight. */
  | 'injection'
  /** The same injection, with the ninth block's NFTs burned so the structural gate has nothing to say. */
  | 'injection-burned'
  /** The table still names eight, but one participant's block is ordinary funding: its state never moves. */
  | 'omission'
  /**
   * Two participant rows name one physical owner. NOTE (A1, C3-R2): this does not isolate duplication - a row
   * naming a stranger that duplicates nothing is refused identically. See the case's scope note.
   */
  | 'duplicate-owner'
  /** The control for `duplicate-owner`: one row names a stranger, so all eight owners stay DISTINCT. */
  | 'stranger-owner'
  /** One subtree is presented as a second, independent graph root. */
  | 'disjoint-root'
  /** The same re-rooting one edge deeper, with the caller's now-orphaned emission row stripped as well. */
  | 'disjoint-root-stripped';

function uniqueUtxo(
  seen: Set<string>, defaults?: Parameters<typeof randomUtxo>[0],
): ReturnType<typeof randomUtxo> {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const utxo = randomUtxo(defaults);
    const outpoint = `${utxo.txid}:${utxo.vout}`;
    if (seen.has(outpoint)) continue;
    seen.add(outpoint);
    return utxo;
  }
  throw new Error('could not draw a distinct funding outpoint');
}

/**
 * Byte offsets of the individually addressable transcript fields, walked exactly as `finalizeCompiledGraph`
 * encodes them.
 *
 * Two hostile builds patch the canonical bytes here and then root the controller with the RE-DERIVED hash,
 * which is precisely what an attacker can do: the transcript is witness data and its commitment is whatever
 * the attacker committed. Nothing is mutated after derivation - each patched transcript is a self-consistent
 * blob, so only a covenant can refuse it.
 */
interface TranscriptFieldOffsets {
  participants: readonly {
    lbcStart: number; lbcLength: number; emissionsLengthStart: number; emissionsLength: number;
  }[];
  invocations: readonly { parentStart: number; depthStart: number }[];
}

function transcriptFieldOffsets(bytes: Uint8Array): TranscriptFieldOffsets {
  const u16 = (at: number): number => bytes[at] | (bytes[at + 1] << 8);
  const participants: TranscriptFieldOffsets['participants'][number][] = [];
  const invocations: { parentStart: number; depthStart: number }[] = [];
  const participantCount = bytes[9];
  let cursor = 10;
  for (let participant = 0; participant < participantCount; participant += 1) {
    cursor += 4; // participant input, block size
    const lbcLength = u16(cursor);
    cursor += 2;
    const lbcStart = cursor;
    cursor += lbcLength;
    cursor += 2 + u16(cursor); // batch frame
    const emissionsLengthStart = cursor;
    const emissionsLength = u16(cursor);
    cursor += 2 + emissionsLength;
    cursor += 2 + u16(cursor); // callers frame
    participants.push({ lbcStart, lbcLength, emissionsLengthStart, emissionsLength });
    cursor += 2; // return output
    cursor += 2 + u16(cursor); // result vector
    cursor += 2; // projection input
  }
  const invocationCount = u16(cursor);
  cursor += 2;
  for (let invocation = 0; invocation < invocationCount; invocation += 1) {
    // parent(2) callee(1) localRow(1) depth(1) subtreeEnd(2) selector(4) callMode(1)
    invocations.push({ parentStart: cursor, depthStart: cursor + 4 });
    cursor += 12;
    cursor += 2 + u16(cursor); // args
    cursor += 2 + u16(cursor); // result
  }
  return { participants, invocations };
}

/** Apply length-preserving byte patches and re-derive the root the controller is then rooted with. */
function patchTranscript(
  transcript: layer3.FinalizedCompiledGraph,
  patches: readonly { at: number; bytes: Uint8Array }[],
): layer3.FinalizedCompiledGraph {
  const bytes = Uint8Array.from(transcript.bytes);
  for (const patch of patches) bytes.set(patch.bytes, patch.at);
  return { ...transcript, bytes, root: binToHex(sha256.hash(bytes)) };
}

/**
 * Rewrite one participant's emission region to a NEW length: fix the region's own length prefix, shift every
 * LATER participant's frame offset by the delta, rewrite the copy that participant's route is handed, and
 * re-derive the root. `compiledGraphRouteArgs` hands each route its own frame offset, so a length-CHANGING
 * edit that left those alone would make later routes read the wrong frame - a fixture artifact rather than a
 * covenant result. Needed by `disjoint-root-stripped`, which is the only length-changing transcript edit here.
 */
function replaceEmissions(
  transcript: layer3.FinalizedCompiledGraph, participant: number, replacement: Uint8Array,
): layer3.FinalizedCompiledGraph {
  const frame = transcriptFieldOffsets(transcript.bytes).participants[participant];
  const head = transcript.bytes.subarray(0, frame.emissionsLengthStart);
  const tail = transcript.bytes.subarray(frame.emissionsLengthStart + 2 + frame.emissionsLength);
  const bytes = new Uint8Array(head.length + 2 + replacement.length + tail.length);
  bytes.set(head, 0);
  bytes[head.length] = replacement.length & 0xff;
  bytes[head.length + 1] = (replacement.length >>> 8) & 0xff;
  bytes.set(replacement, head.length + 2);
  bytes.set(tail, head.length + 2 + replacement.length);
  const delta = replacement.length - frame.emissionsLength;
  const emissionsHex = [...transcript.participantEmissionsHex];
  emissionsHex[participant] = binToHex(replacement);
  return {
    ...transcript,
    bytes,
    root: binToHex(sha256.hash(bytes)),
    participantOffsets: Object.freeze(transcript.participantOffsets.map(
      (offset, index) => (index > participant ? offset + delta : offset),
    )),
    participantEmissionsHex: Object.freeze(emissionsHex),
  } as layer3.FinalizedCompiledGraph;
}

interface BuiltC3 {
  provider: Provider;
  builder: TransactionBuilder;
  transaction: string;
  transcript: layer3.FinalizedCompiledGraph;
  /**
   * The unpatched transcript this build derived before any hostile patch. Two builds mint fresh categories,
   * so cross-build byte comparison is meaningless; a patch is measured against this, inside its own build.
   */
  honestTranscript: layer3.FinalizedCompiledGraph;
  plan: layer3.CompiledGraphPlan;
  layout: layer3.CompiledGraphPhysicalLayout;
  order: readonly Label[];
  /** Compiled artifact per participant, in the build's physical order. */
  artifacts: readonly any[];
  blockSizes: readonly number[];
  chunkCount: number;
  /** True when the head input of participant k's block really is that participant's own master UTXO. */
  blockHeadIsOwner: readonly boolean[];
  /** Assembly facts this build chose, read back where they physically landed. */
  assembly: {
    eventOutput: number;
    eventCommitment: string;
    returnOutput: number;
    returnCommitment: string;
    containerOutput: number;
    transferOutput: number;
    chunkOffsets: readonly number[];
  };
  /** Where each settled state transition can be read back off the chain. */
  settled: readonly { label: string; address: string; commitment: string }[];
  routeInputBytes: readonly number[];
}

/**
 * Assemble one C3 transaction.
 *
 * `order` is the physical concatenation order of the eight participants. The graph EDGES are declared by
 * label and are identical for every order, so a permuted order changes only where each compiled block lands.
 */
async function buildC3(
  hostile: Hostile = 'none',
  order: readonly Label[] = DEFAULT_ORDER,
  createProvider: () => Provider = createLayer3SemanticTestProvider,
): Promise<BuiltC3> {
  const provider = createProvider();
  const outpoints = new Set<string>();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const controllerCategory = genesis.categoryId as string;
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };

  // ---- Compile and instantiate leaf-first: every caller pins its callee's instantiated locking bytecode ----
  const sinkArtifact = compileString(SINK, options);
  const sinkBase = new Contract(sinkArtifact, [1n, RECIPIENT], { provider });
  const sinkSetup = await setupStatefulUtxos(provider, sinkBase, sinkArtifact.stateLayout!, { total: 0n });
  const sink = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));

  const reporterArtifact = compileString(REPORTER, options);
  const reporterBase = new Contract(reporterArtifact, [sink.lockingBytecode], { provider });
  const reporterSetup = await setupStatefulUtxos(
    provider, reporterBase, reporterArtifact.stateLayout!, { reports: 0n },
  );
  const reporter = reporterBase.withCategory(hexToBin(reporterSetup.categoryId));

  const settlerArtifact = compileString(SETTLER, options);
  const settlerBase = new Contract(settlerArtifact, [reporter.lockingBytecode], { provider });
  const settlerSetup = await setupStatefulUtxos(
    provider, settlerBase, settlerArtifact.stateLayout!, { settled: 0n },
  );
  const settler = settlerBase.withCategory(hexToBin(settlerSetup.categoryId));

  const escrowArtifact = compileString(ESCROW, options);
  const escrowBase = new Contract(escrowArtifact, [settler.lockingBytecode], { provider });
  const escrowSetup = await setupStatefulUtxos(provider, escrowBase, escrowArtifact.stateLayout!, { held: 0n });
  const escrow = escrowBase.withCategory(hexToBin(escrowSetup.categoryId));

  const oracleArtifact = compileString(ORACLE, options);
  const oracleBase = new Contract(oracleArtifact, [9n], { provider });
  const oracleSetup = await setupStatefulUtxos(
    provider, oracleBase, oracleArtifact.stateLayout!, { reviews: 0n },
  );
  const oracle = oracleBase.withCategory(hexToBin(oracleSetup.categoryId));

  const brokerArtifact = compileString(BROKER, options);
  const brokerBase = new Contract(brokerArtifact, [oracle.lockingBytecode], { provider });
  const brokerSetup = await setupStatefulUtxos(
    provider, brokerBase, brokerArtifact.stateLayout!, { scored: 0n },
  );
  const broker = brokerBase.withCategory(hexToBin(brokerSetup.categoryId));

  const ledgerArtifact = compileString(LEDGER, options);
  const ledgerBase = new Contract(ledgerArtifact, [], { provider });
  const ledgerSetup = await setupStatefulUtxos(
    provider, ledgerBase, ledgerArtifact.stateLayout!, { seen: 0n, weights: [] },
  );
  const ledger = ledgerBase.withCategory(hexToBin(ledgerSetup.categoryId));

  const routerArtifact = compileString(ROUTER, options);
  const routerBase = new Contract(
    routerArtifact, [ledger.lockingBytecode, broker.lockingBytecode, escrow.lockingBytecode], { provider },
  );
  const routerSetup = await setupStatefulUtxos(
    provider, routerBase, routerArtifact.stateLayout!, { fired: 0n },
  );
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  // Materialize the Ledger's chunk-backed dynamic storage through an ordinary stateful transaction, so the
  // graph transaction reads a chunk UTXO that exists on chain rather than a fixture-authored blob.
  const ledgerStateful = StatefulContract.withCategory(ledgerBase, ledgerSetup.categoryId);
  await (ledgerStateful as any).seed(SEED_WEIGHT).send();
  const currentLedger = await (ledgerStateful as any).getFullState();
  if (!currentLedger.masterUtxo || currentLedger.dataNftUtxos.length !== 1) {
    throw new Error('C3 fixture did not materialize the ledger master/data state');
  }

  const rows: Record<Label, { artifact: any; contract: Contract; setup: any; master: any; data: any }> = {
    router: {
      artifact: routerArtifact, contract: router, setup: routerSetup,
      master: routerSetup.masterUtxo, data: routerSetup.dataNftUtxos[0],
    },
    ledger: {
      artifact: ledgerArtifact, contract: ledger, setup: ledgerSetup,
      master: currentLedger.masterUtxo, data: currentLedger.dataNftUtxos[0],
    },
    broker: {
      artifact: brokerArtifact, contract: broker, setup: brokerSetup,
      master: brokerSetup.masterUtxo, data: brokerSetup.dataNftUtxos[0],
    },
    escrow: {
      artifact: escrowArtifact, contract: escrow, setup: escrowSetup,
      master: escrowSetup.masterUtxo, data: escrowSetup.dataNftUtxos[0],
    },
    oracle: {
      artifact: oracleArtifact, contract: oracle, setup: oracleSetup,
      master: oracleSetup.masterUtxo, data: oracleSetup.dataNftUtxos[0],
    },
    settler: {
      artifact: settlerArtifact, contract: settler, setup: settlerSetup,
      master: settlerSetup.masterUtxo, data: settlerSetup.dataNftUtxos[0],
    },
    reporter: {
      artifact: reporterArtifact, contract: reporter, setup: reporterSetup,
      master: reporterSetup.masterUtxo, data: reporterSetup.dataNftUtxos[0],
    },
    sink: {
      artifact: sinkArtifact, contract: sink, setup: sinkSetup,
      master: sinkSetup.masterUtxo, data: sinkSetup.dataNftUtxos[0],
    },
  };
  const at = new Map<Label, number>(order.map((label, index) => [label, index]));

  // ---- Plan. The edges are declared by label, so a permuted physical order re-indexes them mechanically. ----
  const edges: { parent: number | null; callee: Label; function: string; args: any[] }[] = [
    { parent: null, callee: 'router', function: 'run', args: [CALL_VALUE] },
    { parent: 0, callee: 'ledger', function: 'record', args: [CALL_VALUE] },
    { parent: 0, callee: 'broker', function: 'broker', args: [CALL_VALUE] },
    { parent: 2, callee: 'oracle', function: 'score', args: [CALL_VALUE] },
    { parent: 0, callee: 'escrow', function: 'hold', args: [CALL_VALUE] },
    { parent: 4, callee: 'settler', function: 'settle', args: [CALL_VALUE] },
    { parent: 5, callee: 'reporter', function: 'report', args: [CALL_VALUE] },
    { parent: 6, callee: 'sink', function: 'absorb', args: [CALL_VALUE] },
  ];
  const plan = layer3.planCompiledGraph(
    order.map((label) => ({
      artifact: rows[label].artifact, lockingBytecode: rows[label].contract.lockingBytecode,
    })),
    edges.map((edge) => ({
      parent: edge.parent, callee: at.get(edge.callee)!, function: edge.function, args: edge.args,
    })),
  );
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const blockSizes = plan.participants.map((participant) => participant.blockLayout!.blockSize);
  const base = (label: Label): number => layout.participantInputs[at.get(label)!];

  const honestTranscript = layer3.finalizeCompiledGraph(
    plan,
    { 3: binToHex(packedResult(SCORE)) },
    layout.participantInputs,
    layout.returnOutputs,
    plan.participants.map((participant) =>
      (participant.batch.results.length > 0 ? binToHex(packedResult(SCORE)) : '')),
    layout.projectionInputs,
  );
  const offsets = transcriptFieldOffsets(honestTranscript.bytes);
  let transcript = honestTranscript;
  if (hostile === 'duplicate-owner') {
    // The last participant's table row now names the second-to-last participant's physical owner. Every
    // participant here is a p2sh32 covenant, so both frames are 35 bytes and the patch preserves every offset.
    const impersonated = offsets.participants[6];
    const forged = offsets.participants[7];
    expect(impersonated.lbcLength).toBe(forged.lbcLength);
    transcript = patchTranscript(honestTranscript, [{
      at: forged.lbcStart,
      bytes: honestTranscript.bytes.slice(
        impersonated.lbcStart, impersonated.lbcStart + impersonated.lbcLength,
      ),
    }]);
  }
  if (hostile === 'stranger-owner') {
    // The control the duplicate-owner case was missing. Participant 7's row now names a well-formed p2sh32
    // that belongs to NO participant, so the table still names eight distinct owners. Same field, same 35
    // bytes, same offsets as the duplicate patch - the only thing removed is the duplication itself.
    const forged = offsets.participants[7];
    const stranger = hexToBin(`aa20${'5c'.repeat(32)}87`);
    expect(stranger.length).toBe(forged.lbcLength);
    transcript = patchTranscript(honestTranscript, [{ at: forged.lbcStart, bytes: stranger }]);
  }
  if (hostile === 'disjoint-root') {
    // Invocation 4 (Router -> Escrow) is re-presented as a second root: parent 0xffff at depth 0. That splits
    // the eight-participant table into two disjoint trees sharing one controller attestation. Three bytes.
    const record = offsets.invocations[4];
    transcript = patchTranscript(honestTranscript, [
      { at: record.parentStart, bytes: Uint8Array.of(0xff, 0xff) },
      { at: record.depthStart, bytes: Uint8Array.of(0) },
    ]);
  }
  if (hostile === 'disjoint-root-stripped') {
    // The stricter attacker the disjoint-root scope note describes, built one edge deeper so the strip is
    // exact: invocation 5 (Escrow -> Settler) is re-presented as a second root, AND the Escrow's emission row
    // answering that edge is removed. The Escrow emits exactly one row, so its whole emissions frame is that
    // row and the strip needs no row-level parsing. The two trees then share nothing at all.
    const record = offsets.invocations[5];
    transcript = replaceEmissions(patchTranscript(honestTranscript, [
      { at: record.parentStart, bytes: Uint8Array.of(0xff, 0xff) },
      { at: record.depthStart, bytes: Uint8Array.of(0) },
    ]), at.get('escrow')!, new Uint8Array(0));
  }

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  // ---- Root the graph controller in its own prior transaction ----
  const rootingFee = uniqueUtxo(outpoints, { satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, rootingFee);
  const rootingTx = new TransactionBuilder({ provider });
  rootingTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  rootingTx.addInput(rootingFee, p2pkh.unlock.spend(alicePub, signature()));
  rootingTx.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  rootingTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(rootingTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
  if (!rootedController) throw new Error('C3 harness did not root its graph controller');

  // ---- The Ledger's chunk UTXOs, which occupy the head of its trailing region ----
  const ledgerLayout = ledgerArtifact.hiddenBatch!.route.blockLayout!;
  const chunks: { variable: any; utxo: any; address: string }[] = [];
  for (const variable of ledgerArtifact.stateLayout!.variables.filter((entry: any) => entry.dynamic)) {
    const address = getDynamicChunkAddress(ledger, ledgerSetup.categoryId, variable.name, variable.type);
    for (const utxo of await provider.getUtxos(address)) chunks.push({ variable, utxo, address });
  }
  if (chunks.length === 0) throw new Error('C3 fixture produced no dynamic chunk UTXO');
  expect(chunks.length).toBeLessThanOrEqual(ledgerLayout.trailingCapacity ?? 0);

  // ---- Funding ----
  const container = uniqueUtxo(outpoints, { satoshis: CONTAINER_SATS });
  await provider.addUtxo(getSatoshiContainerAddress(sink, sinkSetup.categoryId), container);
  const sinkBlockSize = sinkArtifact.hiddenBatch!.route.blockLayout!.blockSize as number;
  const sinkFunding = Array.from({ length: sinkBlockSize - 3 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const ledgerFunding = Array.from(
    { length: ledgerLayout.blockSize - 2 - chunks.length }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  const returnFunding = uniqueUtxo(outpoints, { satoshis: 1000n });
  // The omission case replaces the Sink's WHOLE block with ordinary funding, so it needs one funding slot per
  // slot of that block - which is now the widest participant block rather than the narrowest.
  const omissionFunding = Array.from(
    { length: sinkBlockSize }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  const projectionUtxos = Array.from({ length: 8 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const fee = uniqueUtxo(outpoints, { satoshis: 3_000_000n });
  for (const utxo of [...sinkFunding, ...ledgerFunding, returnFunding, ...omissionFunding, fee]) {
    await provider.addUtxo(p2pkh.address, utxo);
  }
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);

  // The ninth participant the injection cases co-spend: a real, independently categorized stateful contract
  // of the same compiled type as the Sink. The honest control never creates it.
  const injecting = hostile === 'injection' || hostile === 'injection-burned';
  let injected: any;
  let injectedContract: Contract | undefined;
  if (injecting) {
    const injectedBase = new Contract(sinkArtifact, [2n, RECIPIENT], { provider });
    injected = await setupStatefulUtxos(provider, injectedBase, sinkArtifact.stateLayout!, { total: 0n });
    injectedContract = injectedBase.withCategory(hexToBin(injected.categoryId));
  }

  const routeFor = (contract: Contract, artifact: any): any => contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch.route, hexToBin(artifact.hiddenBatch.selector),
  );
  const routeArgs = (participant: number): any[] =>
    [...layer3.compiledGraphRouteArgs(transcript, participant, layout.controllerInput)] as any[];

  // ---- Inputs: one gapless block per participant, anchored at input 0 ----
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  const funding = (utxo: any): void => { tx.addInput(utxo, p2pkh.unlock.spend(alicePub, signature())); };
  const blockHeadIsOwner: boolean[] = [];
  const chunkOffsets: number[] = [];

  const openBlock = (label: Label): void => {
    const row = rows[label];
    const index = at.get(label)!;
    tx.addInput(row.master, routeFor(row.contract, row.artifact)(
      ...routeArgs(index),
      ...(layout.returnOutputs![index] === null ? [] : [BigInt(layout.returnOutputs![index]!)]),
    ));
    tx.addInput(row.data, createDataNftUnlocker(row.contract, base(label), row.setup.categoryId));
  };

  const inputBlock: Record<Label, () => void> = {
    // [master, dataNft]
    router: () => openBlock('router'),
    // [master, dataNft, 64 x trailing], with the chunk UTXOs at the head of the trailing region
    ledger: () => {
      openBlock('ledger');
      chunks.forEach(({ variable, utxo }) => {
        chunkOffsets.push(tx.inputs.length - base('ledger'));
        tx.addInput(utxo, createReadOnlyDynamicChunkUnlocker(
          ledger, base('ledger'), ledgerSetup.categoryId, variable.name, variable.type,
        ));
      });
      ledgerFunding.forEach(funding);
    },
    broker: () => openBlock('broker'),
    escrow: () => openBlock('escrow'),
    // [master, dataNft, returnEvent]
    oracle: () => { openBlock('oracle'); funding(returnFunding); },
    settler: () => openBlock('settler'),
    reporter: () => openBlock('reporter'),
    // [master, dataNft, satoshiContainer, 8 x transfer, 8 x event]
    sink: () => {
      // The table still commits the Sink at this base, but under `omission` every slot carries ordinary
      // funding: the Sink's state never moves, and the block is exactly as wide as its control's.
      if (hostile === 'omission') { omissionFunding.forEach(funding); return; }
      openBlock('sink');
      tx.addInput(container, createSatoshiContainerUnlocker(sink, base('sink'), sinkSetup.categoryId));
      sinkFunding.forEach(funding);
    },
  };
  for (const label of order) {
    const head = tx.inputs.length;
    inputBlock[label]();
    blockHeadIsOwner.push(
      (tx.inputs[head] as any).txid === rows[label].master.txid
      && (tx.inputs[head] as any).vout === rows[label].master.vout,
    );
  }

  projectionUtxos.forEach((proof, participant) => tx.addInput(proof, projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
  )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  funding(fee);
  if (injecting) {
    // Appended AFTER the fee slot, so the controller's own input-count rule is evaluated strictly before the
    // injected block's covenants: what refuses the transaction is the graph table's exhaustiveness over the
    // whole transaction, not the injected participant's own route.
    tx.addInput(injected.masterUtxo, routeFor(injectedContract!, sinkArtifact)(...routeArgs(7)));
    tx.addInput(
      injected.dataNftUtxos[0],
      createDataNftUnlocker(injectedContract!, layout.participantInputs[7], injected.categoryId),
    );
  }

  // ---- Outputs: one per input, at the same index ----
  const settled: { label: string; address: string; commitment: string }[] = [];
  const eventCommitment = binToHex(scriptToBytecode([bigIntToVmNumber(CALL_VALUE)]));
  const returnCommitment = binToHex(aggregateResult(SCORE));
  let eventOutput = -1;
  let containerOutput = -1;
  let transferOutput = -1;
  let returnOutput = -1;

  const settleBlock = (
    label: Label, field: string, value: bigint, commitmentOverride?: string,
  ): void => {
    const row = rows[label];
    const commitment = commitmentOverride
      ?? buildInitialStateCommitments(row.artifact.stateLayout!, { [field]: value })[0];
    tx.addOutput({
      to: row.contract.tokenAddress,
      amount: row.master.satoshis,
      token: {
        category: row.setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
      },
    });
    tx.addOutput({
      to: getDataNftAddress(row.contract, row.setup.categoryId),
      amount: row.data.satoshis,
      token: { category: row.setup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
    settled.push({
      label: `${label}.${field}`,
      address: getDataNftAddress(row.contract, row.setup.categoryId),
      commitment,
    });
  };

  // The Ledger's commitment is one minimally encoded pushdata per state field, and only the leading scalar
  // moves; the dynamic field carries a chunk header no initial-state builder reproduces. So its post-state is
  // the current commitment with exactly the leading field replaced.
  const currentLedgerCommitment: string = currentLedger.dataNftUtxos[0].token.nft.commitment;
  const zeroField = binToHex(scriptToBytecode([bigIntToVmNumber(0n)]));
  expect(currentLedgerCommitment.startsWith(zeroField)).toBe(true);
  const ledgerNext = binToHex(scriptToBytecode([bigIntToVmNumber(CALL_VALUE + SEED_WEIGHT)]))
    + currentLedgerCommitment.slice(zeroField.length);

  const outputBlock: Record<Label, () => void> = {
    router: () => settleBlock('router', 'fired', CALL_VALUE),
    ledger: () => {
      settleBlock('ledger', 'seen', CALL_VALUE + SEED_WEIGHT, ledgerNext);
      for (const chunk of chunks) {
        tx.addOutput({ to: chunk.address, amount: chunk.utxo.satoshis, token: chunk.utxo.token });
      }
      ledgerFunding.forEach(() => tx.addOutput({ to: p2pkh.address, amount: 1000n }));
    },
    broker: () => settleBlock('broker', 'scored', SCORE),
    escrow: () => settleBlock('escrow', 'held', CALL_VALUE),
    oracle: () => {
      settleBlock('oracle', 'reviews', 1n);
      returnOutput = tx.outputs.length;
      tx.addOutput({
        to: hexToBin('51'),
        amount: 1000n,
        token: {
          category: oracleSetup.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: returnCommitment },
        },
      });
    },
    settler: () => settleBlock('settler', 'settled', CALL_VALUE),
    reporter: () => settleBlock('reporter', 'reports', 1n),
    sink: () => {
      if (hostile === 'omission') {
        omissionFunding.forEach(() => tx.addOutput({ to: p2pkh.address, amount: 1000n }));
        return;
      }
      settleBlock('sink', 'total', CALL_VALUE);
      containerOutput = tx.outputs.length;
      tx.addOutput({
        to: getSatoshiContainerAddress(sink, sinkSetup.categoryId),
        amount: CONTAINER_SATS - TRANSFER_SATS,
      });
      transferOutput = tx.outputs.length;
      tx.addOutput({ to: RECIPIENT, amount: TRANSFER_SATS });
      for (let slot = 1; slot < 8; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
      eventOutput = tx.outputs.length;
      tx.addOutput({
        to: getEventNftAddress(sink, sinkSetup.categoryId, sinkArtifact.events![0].signature),
        amount: 1000n,
        token: {
          category: sinkSetup.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: eventCommitment },
        },
      });
      for (let slot = 1; slot < 8; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
    },
  };
  for (const label of order) outputBlock[label]();

  projectionUtxos.forEach(() => tx.addOutput({ to: p2pkh.address, amount: 1000n }));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  if (hostile === 'injection') {
    tx.addOutput({
      to: injectedContract!.tokenAddress,
      amount: injected.masterUtxo.satoshis,
      token: { category: injected.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    tx.addOutput({
      to: getDataNftAddress(injectedContract!, injected.categoryId),
      amount: injected.dataNftUtxos[0].satoshis,
      token: {
        category: injected.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildInitialStateCommitments(sinkArtifact.stateLayout!, { total: CALL_VALUE })[0],
        },
      },
    });
  }
  if (hostile === 'injection-burned') {
    // Identical injection with the ninth block's NFTs burned, so no token sits outside a participant block
    // and the SDK's structural block-assembly gate has nothing to object to. What remains is the covenant.
    tx.addOutput({ to: p2pkh.address, amount: injected.masterUtxo.satoshis });
    tx.addOutput({ to: p2pkh.address, amount: injected.dataNftUtxos[0].satoshis });
  }

  const built = tx.buildLibauthTransaction();
  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    transcript,
    honestTranscript,
    plan,
    layout,
    order,
    artifacts: order.map((label) => rows[label].artifact),
    blockSizes,
    chunkCount: chunks.length,
    blockHeadIsOwner,
    assembly: {
      eventOutput,
      eventCommitment,
      returnOutput,
      returnCommitment,
      containerOutput,
      transferOutput,
      chunkOffsets,
    },
    settled,
    routeInputBytes: layout.participantInputs.map((input) => built.inputs[input].unlockingBytecode.length),
  };
}

/**
 * Byte indices at which a build's patched transcript differs from the honest one it derived first. Measured
 * inside a single build, so no cross-fixture category difference can pollute it.
 */
function patchedByteIndices(built: BuiltC3): number[] {
  const patched = built.transcript.bytes;
  const honest = built.honestTranscript.bytes;
  expect(patched.length).toBe(honest.length);
  const differing: number[] = [];
  for (let index = 0; index < patched.length; index += 1) {
    if (patched[index] !== honest[index]) differing.push(index);
  }
  return differing;
}

/** Pin the exact input whose covenant refused a transaction, rather than only that it was refused. */
function preflightOutcome(built: BuiltC3): string {
  try {
    layer3.preflightLayer3Transaction(built.builder);
    return 'ACCEPTED';
  } catch (error) {
    return (error as Error).message;
  }
}

/** The honest control every hostile case is measured against, asserted before the attack is built. */
async function honestControl(): Promise<BuiltC3> {
  const control = await buildC3();
  expect(preflightOutcome(control)).toBe('ACCEPTED');
  await expect(control.provider.sendRawTransaction(control.transaction)).resolves.toBeTypeOf('string');
  return control;
}

describe('C3 bounded maximum graph capstone (SEMANTIC)', () => {
  it('SEMANTIC: settles an eight-participant graph in one transaction', async () => {
    const built = await buildC3();

    // EIGHT participants: the deployed semantic bound, not an arbitrary width. Eight distinct compiled types.
    expect(built.plan.participants).toHaveLength(8);
    expect(new Set(built.artifacts.map((artifact: any) => artifact.bytecode)).size).toBe(8);
    expect(new Set(built.plan.participants.map((participant) => participant.lockingBytecode)).size).toBe(8);
    expect(built.plan.invocations).toHaveLength(8);
    expect(built.blockHeadIsOwner).toEqual(Array.from({ length: 8 }, () => true));

    // CALLS: seven non-root edges, and the depth-4 chain really is a chain.
    expect(built.plan.invocations.filter((invocation) => invocation.parent !== null)).toHaveLength(7);
    expect(built.plan.invocations.map((invocation) => invocation.depth)).toEqual([0, 1, 1, 2, 1, 2, 3, 4]);
    expect(built.plan.invocations.map((invocation) => invocation.callee)).toEqual([0, 1, 2, 4, 3, 5, 6, 7]);
    // Every physical input is spent once; no participant is co-spent twice to fake an extra hop.
    const spent = (built.builder.inputs as any[]).map((input) => `${input.txid}:${input.vout}`);
    expect(new Set(spent).size).toBe(spent.length);

    // RESULTS: exactly one returning edge, consumed by exactly one participant.
    expect(built.plan.invocations.filter((invocation) => invocation.resultTypes.length > 0)
      .map((invocation) => invocation.index)).toEqual([3]);
    expect(built.plan.invocations[2].resultDependencies).toEqual([3]);
    expect(built.transcript.resultsHex.filter((value) => value !== ''))
      .toEqual([binToHex(packedResult(SCORE))]);

    // DYNAMIC CHUNKS: at least one chunk UTXO, inside the Ledger's compiler-published trailing region.
    expect(built.chunkCount).toBeGreaterThan(0);
    const ledgerLayout = built.artifacts[1].hiddenBatch.route.blockLayout;
    expect(ledgerLayout.trailingBase).toBe(2);
    expect(built.assembly.chunkOffsets.every((offset) =>
      offset >= ledgerLayout.trailingBase
      && offset < ledgerLayout.trailingBase + ledgerLayout.trailingCapacity)).toBe(true);

    // EVENT NFT and RESOURCES: both are the SINK's since the SEC-6 reshape, and this assembly puts both
    // inside the Sink's block. In-block placement and the 1,000-satoshi value of THESE slots are SDK assembly
    // conventions, so they are asserted here as facts about this assembly and nothing more. That is a claim
    // about event, transfer and funding slots only: the two SIDECAR slot kinds are different, and both
    // generated covenants really do require `tx.outputs[this.activeInputIndex].value == 1000` at a projection
    // slot and at the controller slot (layer3/graph.ts:580 and :786).
    const sinkBase = built.layout.participantInputs[7];
    const sinkBlock = built.blockSizes[7];
    expect(built.assembly.eventOutput).toBeGreaterThanOrEqual(sinkBase);
    expect(built.assembly.eventOutput).toBeLessThan(sinkBase + sinkBlock);
    expect(built.assembly.containerOutput).toBeGreaterThanOrEqual(sinkBase);
    expect(built.assembly.containerOutput).toBeLessThan(sinkBase + sinkBlock);
    expect(built.assembly.transferOutput).toBeGreaterThanOrEqual(sinkBase);
    expect(built.assembly.transferOutput).toBeLessThan(sinkBase + sinkBlock);

    // HONEST ALL-INPUT EXECUTION: `preflightLayer3Transaction` evaluates every one of the 108 inputs on the
    // BCH-2026 VM and throws on the first that fails, so a pass here is whole-transaction evidence and not a
    // spot check. The broadcast then re-evaluates the same bytes through the provider.
    layer3.preflightLayer3Transaction(built.builder);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');

    // Every settled transition is read back off the chain against numbers stated here, not by the builder:
    // router 0+6, ledger 0+6+7 (the 7 lives in a chunk UTXO), broker 0+7 (the SCORE the oracle returned),
    // escrow 0+6, oracle 0+1, settler 0+6, reporter 0+1, sink 0+6.
    expect(built.settled).toHaveLength(8);
    for (const transition of built.settled) {
      const utxos = await built.provider.getUtxos(transition.address);
      expect(
        utxos.map((utxo: any) => utxo.token?.nft?.commitment),
        `${transition.label} settled post-state`,
      ).toContain(transition.commitment);
    }
    // The satoshi effect and both NFT effects landed too.
    expect(built.builder.outputs[built.assembly.transferOutput].amount).toBe(TRANSFER_SATS);
    expect(built.builder.outputs[built.assembly.containerOutput].amount)
      .toBe(CONTAINER_SATS - TRANSFER_SATS);
    expect(built.builder.outputs[built.assembly.eventOutput].token!.nft!.commitment)
      .toBe(built.assembly.eventCommitment);
    expect(built.builder.outputs[built.assembly.returnOutput].token!.nft!.commitment)
      .toBe(binToHex(aggregateResult(SCORE)));
  }, 900_000);

  it('SEMANTIC: the eight blocks compose by concatenation, with no absolute index inside any block', async () => {
    const built = await buildC3();

    // Every compiled block declares LOCAL offsets only: a complete 0..blockSize-1 span whose first slot is
    // the master. No block layout names a physical input.
    built.artifacts.forEach((artifact: any, participant: number) => {
      const blockLayout = artifact.hiddenBatch.route.blockLayout;
      const offsets = blockLayout.slots.map((slot: any) => slot.offset).sort((a: number, b: number) => a - b);
      expect(offsets).toEqual(Array.from({ length: blockLayout.blockSize }, (_unused, index) => index));
      expect(blockLayout.slots.find((slot: any) => slot.kind === 'master').offset).toBe(0);
      expect(blockLayout.blockSize).toBe(built.blockSizes[participant]);
    });

    // The physical bases are the running prefix sum of those block sizes, gapless from input 0. That prefix
    // sum is the only arithmetic that places a block: a block's base reaches it as a transcript-authenticated
    // witness (`compiledGraphRouteArgs` passes the participant's frame offset and its block size), never as a
    // constant patched into the compiled script.
    const expectedBases: number[] = [];
    let cursor = 0;
    for (const size of built.blockSizes) { expectedBases.push(cursor); cursor += size; }
    expect([...built.layout.participantInputs]).toEqual(expectedBases);
    // The Sink's block is the wide one since the SEC-6 reshape moved the two physical effects onto it; the
    // Router's is now a bare [master, dataNft]. The total is unchanged, so every sidecar index is unchanged.
    expect(built.blockSizes).toEqual([2, 66, 2, 2, 3, 2, 2, 19]);
    expect(built.layout.participantInputs[0]).toBe(0);
    expect([...built.layout.projectionInputs]).toEqual(
      Array.from({ length: 8 }, (_unused, index) => cursor + index),
    );
    expect(built.layout.controllerInput).toBe(cursor + 8);
    expect(built.layout.feeInput).toBe(cursor + 9);
    expect(built.layout.totalSlots).toBe(108);
    expect(built.builder.inputs).toHaveLength(108);
    expect(built.builder.outputs).toHaveLength(108);

    // MEASURED BOUND, inherited from L1 and restated so the criterion is not overclaimed: blocks relocate
    // RELATIVE TO EACH OTHER, but the participant REGION is pinned to physical input 0. Both the controller
    // and the projection covenant start their packing cursor at 0, so a whole-region shift is refused even
    // when every committed index moves with it. C3 is gapless from input 0 by construction.
    expect(built.transcript.participantInputs[0]).toBe(0);

    // The return-event slot is inside its producer's block. WHERE inside is an SDK assembly choice - the
    // covenant only requires membership of the block - so this asserts what the SDK did, not a covenant rule.
    expect(built.layout.returnOutputs).toEqual([null, null, null, null, 74, null, null, null]);
    expect(built.assembly.returnOutput).toBe(74);
  }, 900_000);

  it('SEMANTIC: the same eight blocks compose at eight different bases when the order is permuted', async () => {
    // The graph EDGES are declared by label and are identical in both builds; only the physical concatenation
    // order differs. Every participant lands at a base it did not have in the default order, and the same
    // eight compiled block layouts still tile the transaction gaplessly.
    const permuted: readonly Label[] = [
      'sink', 'broker', 'router', 'escrow', 'oracle', 'settler', 'reporter', 'ledger',
    ];
    const control = await buildC3();
    const built = await buildC3('none', permuted);

    const baseOf = (build: BuiltC3, label: Label): number =>
      build.layout.participantInputs[build.order.indexOf(label)];
    for (const label of DEFAULT_ORDER) {
      expect(baseOf(built, label), `${label} base`).not.toBe(baseOf(control, label));
    }
    expect([...built.layout.participantInputs]).toEqual([0, 19, 21, 23, 25, 28, 30, 32]);
    expect(built.layout.totalSlots).toBe(control.layout.totalSlots);
    // Block sizes are a property of the compiled source, so the permutation only reorders them.
    expect([...built.blockSizes].sort((a, b) => a - b))
      .toEqual([...control.blockSizes].sort((a, b) => a - b));
    // The graph itself is unchanged: same eight edges, same tree, same depths.
    expect(built.plan.invocations.map((invocation) => invocation.depth))
      .toEqual(control.plan.invocations.map((invocation) => invocation.depth));
    expect(built.plan.invocations.map((invocation) => invocation.parent))
      .toEqual(control.plan.invocations.map((invocation) => invocation.parent));
    // The root is no longer participant 0, and the returning participant moved with its block.
    expect(built.plan.invocations[0].callee).toBe(2);
    expect(built.layout.returnOutputs).toEqual([null, null, null, null, 27, null, null, null]);
    expect(built.blockHeadIsOwner).toEqual(Array.from({ length: 8 }, () => true));

    layer3.preflightLayer3Transaction(built.builder);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
    for (const transition of built.settled) {
      const utxos = await built.provider.getUtxos(transition.address);
      expect(
        utxos.map((utxo: any) => utxo.token?.nft?.commitment),
        `${transition.label} settled post-state at the permuted base`,
      ).toContain(transition.commitment);
    }
    // What this does NOT show: the two builds mint fresh categories, so their participant locking bytecodes
    // and compiled route bytecode differ for reasons unrelated to placement. Byte-identical relocation of ONE
    // instance across bases is L1's claim, proven there; this is the eight-wide composition claim.
  }, 900_000);

  it('SEMANTIC: eight is the published bound - a ninth participant is refused before any assembly', async () => {
    const built = await buildC3();
    const rows = built.plan.participants.map((participant, index) => ({
      artifact: built.artifacts[index], lockingBytecode: participant.lockingBytecode,
    }));
    expect(() => layer3.planCompiledGraph(
      [...rows, { artifact: built.artifacts[7], lockingBytecode: `aa20${'44'.repeat(32)}87` }] as any,
      [{ parent: null, callee: 0, function: 'run', args: [CALL_VALUE, Uint8Array.of(0x51)] }] as any,
    )).toThrow(/participant count must be between 1 and 8/);
    // The same bound is enforced by both covenants, independently of the SDK.
    expect(layer3.generateGraphRootController('51')).toContain('participantCount <= 8');
    expect(layer3.generateGraphProjectionVerifier()).toContain('participantCount <= 8');

    // SCOPE of "bounded maximum". The deployed graph has three independent bounds: 8 participants, 24
    // invocations and depth 7, each enforced by the SDK planner and by both covenants. C3 saturates the
    // PARTICIPANT bound only. It reaches 8 of 24 invocations and depth 4 of 7, so nothing in this file is
    // evidence about the invocation-count or depth ceilings, which are separately bounded elsewhere.
    expect(built.plan.participants).toHaveLength(8);
    expect(built.plan.invocations).toHaveLength(8);
    expect(Math.max(...built.plan.invocations.map((invocation) => invocation.depth))).toBe(4);
    expect(layer3.generateGraphRootController('51')).toContain('invocationCount <= 24');
    expect(layer3.generateGraphProjectionVerifier()).toContain('invocationCount <= 24');
  }, 900_000);
});

/**
 * One hostile case per listed rejection. Each is measured against an honest control produced by the same
 * function, which is preflighted and settled first, and each names the exact input whose covenant refused it.
 */
describe('C3 hostile cases', () => {
  it('HOSTILE: an injected ninth participant is refused - by the SDK gate, then by the controller', async () => {
    const control = await honestControl();

    const attacked = await buildC3('injection');
    // The single difference: one extra co-spent participant block. Nothing inside the eight moved.
    expect(attacked.builder.inputs.length - control.builder.inputs.length).toBe(2);
    expect(attacked.builder.outputs.length - control.builder.outputs.length).toBe(2);
    expect(attacked.layout.totalSlots).toBe(control.layout.totalSlots);

    expect(attacked.layout.controllerInput).toBe(106);
    // The structural block-assembly gate fires first, before a single signature is taken: the injected
    // block's token outputs sit outside every participant block. This is an SDK refusal, not a covenant one,
    // so for THIS shape `preflightLayer3Transaction` never reaches the VM and never names an input. The
    // following test isolates the covenant refusal by removing the SDK gate's objection.
    const outcome = preflightOutcome(attacked);
    expect(outcome).toContain('carries a token outside every participant block (region ends at 98)');
    // And the covenant refuses it independently, at input 106 - the graph-root controller, whose
    // `tx.inputs.length == this.activeInputIndex + 2` rule makes the participant table exhaustive over the
    // WHOLE transaction. 106 is strictly before the injected block at 108/109, so what rejects here is the
    // table's exhaustiveness and not the injected participant's own route.
    const broadcast = await attacked.provider.sendRawTransaction(attacked.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(broadcast).toContain('error in evaluating input index 106');
    expect(broadcast).toContain('mandatory-script-verify-flag-failed');
  }, 900_000);

  it('HOSTILE: the same injection with the ninth block burned is refused at input 106', async () => {
    const control = await honestControl();

    // Identical injection, except the ninth block's NFTs are burned rather than preserved, so no token sits
    // outside a participant block and the structural gate has nothing to say. The covenant still refuses.
    const attacked = await buildC3('injection-burned');
    expect(attacked.builder.inputs.length - control.builder.inputs.length).toBe(2);
    expect(attacked.builder.outputs.length - control.builder.outputs.length).toBe(2);
    expect(attacked.layout.controllerInput).toBe(106);
    const outcome = preflightOutcome(attacked);
    expect(outcome).toContain('layer3: BCH-2026 preflight failed at input 106');
    await expect(attacked.provider.sendRawTransaction(attacked.transaction)).rejects.toThrow();
  }, 900_000);

  it('HOSTILE: omitting one participant\'s block while the table still names it is refused at input 98',
    async () => {
      const control = await honestControl();

      // The transaction still has 108 input and 108 output slots, the transcript still commits eight
      // participants at the same eight bases, and the Sink's two slots are ordinary funding: its state never
      // moves. The serialized length differs only because those two witnesses are p2pkh spends rather than
      // the Sink's SCB1 route - which is exactly the omission.
      const attacked = await buildC3('omission');
      expect(attacked.builder.inputs).toHaveLength(control.builder.inputs.length);
      expect(attacked.builder.outputs).toHaveLength(control.builder.outputs.length);
      expect([...attacked.transcript.participantInputs]).toEqual([...control.transcript.participantInputs]);
      expect(attacked.blockHeadIsOwner).toEqual([true, true, true, true, true, true, true, false]);
      expect(control.blockHeadIsOwner).toEqual(Array.from({ length: 8 }, () => true));
      expect(attacked.settled).toHaveLength(7);

      // Input 98 is the FIRST graph projection proof, which walks the whole participant table and requires
      // each committed row's locking bytecode to be the one actually co-spent at that base.
      expect(attacked.layout.projectionInputs[0]).toBe(98);
      const outcome = preflightOutcome(attacked);
      expect(outcome).toContain('layer3: BCH-2026 preflight failed at input 98');
      const broadcast = await attacked.provider.sendRawTransaction(attacked.transaction)
        .then(() => 'ACCEPTED').catch((error: Error) => error.message);
      expect(broadcast).toContain('error in evaluating input index 98');
    }, 900_000);

  it('HOSTILE: a table row that names the wrong owner for its base is refused at input 79', async () => {
    const control = await honestControl();

    // 35 patched bytes: participant 7's row now names participant 6's locking bytecode. Every other byte of
    // the transcript, and the entire physical transaction, is what the control assembles.
    const attacked = await buildC3('duplicate-owner');
    expect(attacked.transaction.length).toBe(control.transaction.length);
    expect(attacked.builder.inputs).toHaveLength(control.builder.inputs.length);
    const offsets = transcriptFieldOffsets(attacked.transcript.bytes);
    const rowLbc = (index: number): string => binToHex(attacked.transcript.bytes.slice(
      offsets.participants[index].lbcStart,
      offsets.participants[index].lbcStart + offsets.participants[index].lbcLength,
    ));
    expect(rowLbc(7)).toBe(rowLbc(6));
    expect(new Set(Array.from({ length: 8 }, (_unused, index) => rowLbc(index))).size).toBe(7);
    // Measured inside this build: every differing byte lies inside participant 7's 35-byte locking-bytecode
    // frame, and the transcript it was derived from named eight distinct owners.
    const forged = offsets.participants[7];
    const differing = patchedByteIndices(attacked);
    expect(differing.length).toBeGreaterThan(0);
    expect(differing.every((index) =>
      index >= forged.lbcStart && index < forged.lbcStart + forged.lbcLength)).toBe(true);
    const honestRows = transcriptFieldOffsets(attacked.honestTranscript.bytes);
    expect(new Set(Array.from({ length: 8 }, (_unused, index) => binToHex(
      attacked.honestTranscript.bytes.slice(
        honestRows.participants[index].lbcStart,
        honestRows.participants[index].lbcStart + honestRows.participants[index].lbcLength,
      ),
    ))).size).toBe(8);

    // Input 79 is the impersonated slot's OWN master route: the participant at that base refuses a table
    // whose row for it names somebody else as its owner.
    expect(attacked.layout.participantInputs[7]).toBe(79);
    const outcome = preflightOutcome(attacked);
    expect(outcome).toContain('layer3: BCH-2026 preflight failed at input 79');
    await expect(attacked.provider.sendRawTransaction(attacked.transaction)).rejects.toThrow();

    // CONTROL (A1 finding C3-R2), reproduced here at eight-participant width. The same field of the same row,
    // the same 35 bytes, rewritten to a p2sh32 that belongs to NO participant - so every owner in the table
    // stays DISTINCT and the only thing removed is the duplication. It is refused at the SAME input, by the
    // same covenant, with the same class of failure. The duplication therefore contributes nothing.
    const stranger = await buildC3('stranger-owner');
    const strangerOffsets = transcriptFieldOffsets(stranger.transcript.bytes);
    const strangerRow = (index: number): string => binToHex(stranger.transcript.bytes.slice(
      strangerOffsets.participants[index].lbcStart,
      strangerOffsets.participants[index].lbcStart + strangerOffsets.participants[index].lbcLength,
    ));
    expect(new Set(Array.from({ length: 8 }, (_unused, index) => strangerRow(index))).size).toBe(8);
    expect(patchedByteIndices(stranger).every((index) =>
      index >= forged.lbcStart && index < forged.lbcStart + forged.lbcLength)).toBe(true);
    expect(preflightOutcome(stranger)).toContain('layer3: BCH-2026 preflight failed at input 79');
    await expect(stranger.provider.sendRawTransaction(stranger.transaction)).rejects.toThrow();

    // Neither generated covenant ever compares two participant rows to each other. This guard went VACUOUS
    // once: it hunted `participantLbcN == participantLbcM`, and X65 replaced the 8-way dispatch with an
    // input-index table, so those identifiers stopped existing and the regex could never match again. It is
    // now expressed against the property rather than the spelling - no comparison may carry a participant
    // locking bytecode on both sides - plus an assertion that the old identifiers really are gone.
    for (const source of [
      layer3.generateGraphProjectionVerifier(), layer3.generateGraphRootController('51'),
    ]) {
      const pairwise = source.split('\n')
        .flatMap((line) => line.split(/&&|\|\|/))
        .filter((clause) => /[=!]=/.test(clause))
        .filter((clause) => {
          const [left, right] = clause.split(/[=!]=/);
          return right !== undefined
            && /lockingBytecode|participantLbc/.test(left) && /lockingBytecode|participantLbc/.test(right);
        });
      expect(pairwise, `pairwise participant comparison in:\n${pairwise.join('\n')}`).toEqual([]);
      expect(/participantLbc\d/.test(source)).toBe(false);
    }

    // The SDK planner is where uniqueness actually lives: it refuses the construction before any transcript.
    const rows = attacked.plan.participants.map((participant, index) => ({
      artifact: attacked.artifacts[index], lockingBytecode: participant.lockingBytecode,
    }));
    rows[7] = { ...rows[7], lockingBytecode: rows[6].lockingBytecode };
    expect(() => layer3.planCompiledGraph(rows as any, [
      { parent: null, callee: 0, function: 'run', args: [CALL_VALUE, Uint8Array.of(0x51)] },
    ] as any)).toThrow(/two participant rows name the same physical locking bytecode/);

    // SCOPE, CORRECTED (A1 finding C3-R2). This case was written as C3's duplicate-owner case and read as
    // evidence that the covenants enforce OWNER UNIQUENESS. They do not, and this construction never tested
    // it - the stranger control above is what shows that.
    //
    // What is actually proven here is the row-to-base binding: the participant at input 79 refuses a table
    // whose row for its own base names a locking bytecode other than the one physically co-spent there. The
    // duplication contributes nothing; naming ANY wrong owner is what fails. That is the same invariant the
    // omission case above attacks from the other side.
    //
    // Owner uniqueness is real but lives ENTIRELY in the SDK: `planCompiledGraph` refuses two rows naming one
    // locking bytecode, which is the assertion immediately above, and neither generated covenant ever
    // compares two participant rows. A transcript assembled outside the planner is therefore not refused for
    // duplication by anything on chain; it is refused only because each duplicated row still has to match the
    // owner co-spent at its own base.
    //
    // Unchanged from the original note: the forgery is on the table, not on the physical side. A stateful
    // participant owns exactly one minting master UTXO, so the same owner cannot be co-spent twice in one
    // transaction to give a duplicate row a block of its own, and nothing here is a statement about two live
    // masters of one category - this model does not create that.
  }, 900_000);

  it('HOSTILE: a subtree re-presented as a second graph root is refused at input 98', async () => {
    const control = await honestControl();

    // Three patched bytes: invocation 4 claims parent 0xffff at depth 0, splitting the eight participants
    // into two disjoint trees that share one controller attestation. Nothing else differs.
    const attacked = await buildC3('disjoint-root');
    expect(attacked.transaction.length).toBe(control.transaction.length);
    const record = transcriptFieldOffsets(attacked.transcript.bytes).invocations[4];
    expect(binToHex(attacked.transcript.bytes.slice(record.parentStart, record.parentStart + 2))).toBe('ffff');
    expect(attacked.transcript.bytes[record.depthStart]).toBe(0);
    // The transcript this build derived first states the honest edge: invocation 4's parent is invocation 0,
    // at depth 1. Measured inside this build, exactly those three bytes differ.
    expect(binToHex(attacked.honestTranscript.bytes.slice(record.parentStart, record.parentStart + 2)))
      .toBe('0000');
    expect(attacked.honestTranscript.bytes[record.depthStart]).toBe(1);
    expect(patchedByteIndices(attacked))
      .toEqual([record.parentStart, record.parentStart + 1, record.depthStart]);

    // Input 98 is the first graph projection proof: its depth dispatch has no branch for a depth-0 row that
    // is not invocation 0, so the second root has no caller frame to bind and the walk reverts.
    expect(attacked.layout.projectionInputs[0]).toBe(98);
    const outcome = preflightOutcome(attacked);
    expect(outcome).toContain('layer3: BCH-2026 preflight failed at input 98');
    await expect(attacked.provider.sendRawTransaction(attacked.transaction)).rejects.toThrow();

    // The SDK planner refuses the same construction before any transcript exists.
    const rows = attacked.plan.participants.map((participant, index) => ({
      artifact: attacked.artifacts[index], lockingBytecode: participant.lockingBytecode,
    }));
    expect(() => layer3.planCompiledGraph(rows as any, [
      { parent: null, callee: 0, function: 'run', args: [CALL_VALUE, Uint8Array.of(0x51)] },
      { parent: null, callee: 3, function: 'hold', args: [CALL_VALUE] },
    ] as any)).toThrow(/requires exactly one root invocation at index 0/);

    // SCOPE, CORRECTED (A1 finding C3-R3). This note previously said that a stricter attacker who ALSO drops
    // the caller's now-orphaned emission row is "the omission case above, because it changes the transcript's
    // length". That is wrong on both halves. Length is not what makes the omission case: the omission case
    // replaces a participant's whole block with ordinary funding so its state never moves, and stripping an
    // emission row does no such thing - every participant still executes its own route and settles its own
    // post-state. And the refusal is not the same one: it lands at the CALLER's own master route rather than
    // at a projection proof, so it is a different covenant at a different input. The next case is that build.
  }, 900_000);

  it('HOSTILE: re-rooting an edge AND stripping its caller emission row is refused at the caller, input 70',
    async () => {
      const control = await honestControl();

      // Invocation 5 (Escrow -> Settler) re-rooted to parent 0xffff at depth 0, plus the Escrow's single
      // emission row - the row answering exactly that edge - removed. This is the stricter attacker the
      // disjoint-root note describes, and it is a DIFFERENT refusal from the three-byte version.
      const attacked = await buildC3('disjoint-root-stripped');

      // Not the omission case. The transaction keeps every slot, every participant block is still that
      // participant's own master and data NFT, and all eight blocks settle in the control.
      expect(attacked.builder.inputs).toHaveLength(control.builder.inputs.length);
      expect(attacked.builder.outputs).toHaveLength(control.builder.outputs.length);
      expect(attacked.blockHeadIsOwner).toEqual(Array.from({ length: 8 }, () => true));
      expect(control.blockHeadIsOwner).toEqual(Array.from({ length: 8 }, () => true));

      // It IS a length-changing transcript edit - which the corrected note says is not what "omission" means.
      expect(attacked.transcript.bytes.length).toBeLessThan(attacked.honestTranscript.bytes.length);
      expect(attacked.transcript.participantEmissionsHex[attacked.order.indexOf('escrow')]).toBe('');
      expect(attacked.honestTranscript
        .participantEmissionsHex[attacked.order.indexOf('escrow')].length).toBeGreaterThan(0);

      // The refusal names the Escrow's own master route, not a projection proof and not the controller.
      const escrow = attacked.layout.participantInputs[attacked.order.indexOf('escrow')];
      expect(escrow).toBe(70);
      expect(escrow).not.toBe(attacked.layout.projectionInputs[0]);
      expect(escrow).not.toBe(attacked.layout.controllerInput);
      const outcome = preflightOutcome(attacked);
      expect(outcome).toContain(`layer3: BCH-2026 preflight failed at input ${escrow}`);
      const broadcast = await attacked.provider.sendRawTransaction(attacked.transaction)
        .then(() => 'ACCEPTED').catch((error: Error) => error.message);
      expect(broadcast).toContain(`error in evaluating input index ${escrow}`);
    }, 900_000);
});

describe('C3 capacity measurement', () => {
  it('MEASURED: reports the honest participant route sizes on the relaxed semantic profile', async () => {
    const built = await buildC3();
    // RE-MEASURED at `77cd1e8c`, in the default order: router 3,287, ledger 3,560, broker 3,100, escrow
    // 3,064, oracle 3,263, settler 3,064, reporter 3,061, sink 4,938 bytes; transcript blob 1,325 bytes.
    // Seven of the eight reproduce their recorded value exactly; the SINK does not - it was recorded 4,910
    // and measures 4,938, +28, which is the same +28 the next test's Sink row carries (4,951 -> 4,979).
    // The block that stood here was introduced as "re-measured after the SEC-6 reshape" and gave 3,294 /
    // 3,552 / 3,110 / 3,081 / 3,179 / 3,081 / 3,078 / 4,605 - not one of the eight reproduces, the oracle by
    // 84 bytes and the sink by 305. It also asserted a pre-versus-post-reshape delta ("the Router shed 1,452
    // bytes and the Sink gained them") that cannot be re-measured on a tree carrying only the post-reshape
    // fixture; it is dropped rather than carried forward.
    //
    // Every compiled participant route sits under the ordinary 10,000-byte input limit, so no single route is
    // a capacity constraint. Nor were the routes ever what pushed C3 at the relay ceiling: measured on one
    // common scale (`densityControlLength`, which the next test tabulates), the eight participant inputs total
    // 27,665 bytes against 43,784 for the eight projection proofs at 5,473 each, out of a 96,118-byte
    // transaction. Re-derived at `77cd1e8c`; the 27,637 / 48,072 at 6,009 each / 100,354 recorded here was
    // three readings stale, and the ratio it was making the point with has if anything sharpened.
    // Bands are asserted rather than exact figures so compiler work elsewhere does not falsely fail here; the
    // run prints the figures so a reader compares against a measurement rather than a citation.
    console.log(`C3 route input sizes (${DEFAULT_ORDER.join(', ')}): ${built.routeInputBytes.join(', ')}; `
      + `transcript ${built.transcript.bytes.length} bytes`);
    expect(built.routeInputBytes).toHaveLength(8);
    for (const size of built.routeInputBytes) {
      expect(size).toBeGreaterThan(1_000);
      expect(size).toBeLessThan(10_000);
    }
    expect(built.transcript.bytes.length).toBeLessThan(2_000);
  }, 900_000);

  it('MEASURED: the same composition NOW FITS ordinary BCH-2026 capacity', async () => {
    // An F1-style capacity measurement, NOT a CONSENSUS_FIT or POLICY_FIT claim: only the consensus capacity
    // knobs the semantic profile relaxes are restored.
    //
    // TWO DIFFERENT CLAIMS, AND C3 NOW MEETS BOTH. "Fits ordinary BCH-2026 capacity" is about the CONSENSUS
    // knobs - operation-cost density above all - and C3 does fit: the next test measures every one of its 108
    // inputs run-to-completion with an empty over-budget set, the worst being the controller at 0.9218.
    // "Relayable under standard policy" is a separate claim, and at `77cd1e8c` the serialized transaction is
    // 96,118 bytes against the 100,000-byte standard relay ceiling, 3,882 UNDER. This paragraph recorded
    // 100,354 bytes and 354 OVER, which was the pre-F4 reading; F4 and then X65 both cut the projection
    // verifier and C3 pays each cut eight times. This profile sets `maximumTransactionBytes` to the 1,000,000
    // CONSENSUS figure, so nothing in this file rejects it either way; the size is asserted below so the
    // margin is a measured number rather than an untested caveat. C1, at 60,502 bytes, clears both.
    //
    // ATTRIBUTION, CORRECTED. This test used to justify itself with "C1 already fails its first PROJECTION
    // proof on operation-cost density; C3 is strictly larger". Both halves are stale. C1 was brought under
    // ordinary capacity by X23 and settles there now, and C3's projections are not a blocker either: measured
    // run-to-completion at `77cd1e8c` they are 0.5039-0.5083 of budget (0.6257-0.6334 pre-X5, 0.6284-0.6361
    // post-X5). Every F-phase statement that names the projection input as the thing to shrink is reading a
    // pre-X23 figure.
    //
    // RESULT CHANGED, and in the good direction. X24 (unroll the deep stack write) and X27 (suffix-split the
    // transcript in attest) landed in separate worker rounds and were measured separately; neither was
    // predicted to close the controller's gap alone. Composed on one tree they do close it. The controller
    // figures this paragraph used to quote as current - 1.2310x, and 16.9% still needed - were measured before
    // that composition and do not reproduce here; see the corrected table in the next test.
    const built = await buildC3('none', DEFAULT_ORDER, createOrdinaryCapacityProvider);
    const outcome = preflightOutcome(built);
    const broadcast = await built.provider.sendRawTransaction(built.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    const controller = built.layout.controllerInput;
    expect(controller).toBe(106);
    // Both gates accept: every input passes BCH-2026 preflight run over the ordinary capacity knobs, and the
    // node accepts the broadcast. The controller was the last input over budget and is no longer.
    expect(outcome).toBe('ACCEPTED');
    expect(broadcast).toBe('ACCEPTED');
    // The density-overrun parse that stood here is gone with the overrun. It existed to show that the REPORTED
    // near-miss was worthless - the check aborts on first excess, so a reported cost is always within one
    // operation of the budget - and the next test still reads the real figure run-to-completion. Keeping a
    // regex that requires an error message would now assert the failure this composition no longer has.
    //
    // THE POLICY GAP IS CLOSED, AND IT HAS SINCE WIDENED. This band did its job: it was written around the
    // measured 100,650 precisely so that shrinking C3 under the relay ceiling would FAIL here and force this
    // comment to be re-read, and that is what happened. F4 cut 129 bytes from the projection verifier, which
    // is ONE covenant instantiated once per participant, so C3 paid 8x: 100,650 -> 99,670 measured (the
    // 99,618 this comment used to give was the ARITHMETIC 129 x 8, and the build came in 52 bytes above it).
    // X65 then cut 444 more from the same covenant, worth another 3,552 to C3 with no such residue, and the
    // measurement at `77cd1e8c` is 96,118 bytes - 3,882 under the ceiling, still with all 108 slots intact.
    // The band's lower bound of 95,000 is now the one within reach of the next cut, not the upper.
    //
    // The history is worth keeping, because it is the reason this file distrusts its own recorded figures.
    // 100,354 was measured before X5 added 37 bytes to each of the eight projection scripts (+296, overrun
    // 354 -> 650); F1 then costed a fix - remove the two cheapest slot pairs, free 388, land at 99,966 - whose
    // ARITHMETIC STOPPED WORKING when the figure moved (100,650 - 388 = 100,262, still over). F4 cleared it
    // without removing any slot, so those options remain as headroom rather than as the plan.
    const serialized = built.transaction.length / 2;
    console.log(`C3 serialized transaction size: ${serialized} bytes `
      + `(${100_000 - serialized} under the 100,000-byte standard relay ceiling)`);
    expect(serialized).toBeLessThan(100_000);
    expect(serialized).toBeGreaterThan(95_000);

    // X60, AND F4 IS WHAT MAKES IT MATTER. C3 carried the same 10-satoshi placeholder output C1 did, and no
    // measurement here ever reached it: a real node refused this transaction `64: tx-size` first, so the size
    // overrun MASKED a second, independent reason it could not be relayed. F4 removed the mask. Had only the
    // visible reason been fixed, C3 would have arrived at a legal size and still been unrelayable, and the
    // masking rule would have been gone to say so. Asserted on the bytes, where no provider setting can mask
    // it, because the mock stack has dust off by default.
    expect(formatDustOutputs(dustOutputs(built.builder.buildLibauthTransaction()))).toBe('no dust outputs');
  }, 900_000);

  it('MEASURED: X25 - the true run-to-completion cost of every C3 sidecar input', async () => {
    const built = await buildC3('none', DEFAULT_ORDER, createOrdinaryCapacityProvider);
    const costs = measureRunToCompletion(built);
    const at = (input: number): InputCost => costs.find((row) => row.input === input)!;
    const projections = built.layout.projectionInputs.map(at);
    const controller = at(built.layout.controllerInput);
    const interesting = new Set([
      ...built.layout.participantInputs, ...built.layout.projectionInputs, built.layout.controllerInput,
    ]);
    console.log('C3 capacity, run to completion (input:bytes:cost:instructions:ratio): '
      + costs.filter((row) => interesting.has(row.input))
        .map((row) => `${row.input}:${row.bytes}b:${row.cost}:${row.instructions}i:${row.ratio.toFixed(4)}`)
        .join(' '));
    console.log(`C3 serialized transaction size: ${built.transaction.length / 2} bytes; `
      + `transcript ${built.transcript.bytes.length} bytes; ${built.layout.totalSlots} slots; `
      + `over budget: ${JSON.stringify(costs.filter((row) => row.ratio > 1).map((row) => row.input))}`);
    // WHERE THE CONTROLLER'S COST GOES, printed rather than cited, because the comment below has been wrong
    // about this split twice. Every term is read off the same run that prints the table above it.
    console.log(`C3 controller cost split: total ${controller.cost}; `
      + `instructions ${controller.instructions} x100 = ${controller.instructions * 100} `
      + `(${(controller.instructions * 100 * 100 / controller.cost).toFixed(1)}%); `
      + `pushedBytes ${controller.pushedBytes} (${(controller.pushedBytes * 100 / controller.cost).toFixed(1)}%); `
      + `arithmetic ${controller.arithmetic}; hashIterations ${controller.hashIterations} `
      + `x64 = ${controller.hashIterations * 64}; `
      + `arithmetic+hashing ${((controller.arithmetic + controller.hashIterations * 64) * 100
        / controller.cost).toFixed(2)}%`);

    // RE-MEASURED at `77cd1e8c`, run to completion, ratio against the ORDINARY 800/byte budget. Every row is
    // a reading from the run that prints the table above; the budget column is bytes x 800:
    //
    //   input             bytes   cost        budget      instr    ratio
    //   0    P0 Router     3,328   1,181,940   2,662,400   11,088   0.4439
    //   2    P1 Ledger     3,601   1,321,596   2,880,800   12,336   0.4588
    //   68   P2 Broker     3,141   1,165,193   2,512,800   10,963   0.4637
    //   70   P3 Escrow     3,105   1,149,577   2,484,000   10,808   0.4628
    //   72   P4 Oracle     3,304   1,508,269   2,643,200   14,331   0.5706
    //   75   P5 Settler    3,105   1,149,845   2,484,000   10,808   0.4629
    //   77   P6 Reporter   3,102   1,149,679   2,481,600   10,807   0.4633
    //   79   P7 Sink       4,979   1,670,061   3,983,200   15,692   0.4193
    //   98-105 projections 5,473 each, 2,206,194-2,225,512, budget 4,378,400, 18,656 each, 0.5039-0.5083
    //   106  controller    2,891   2,131,942   2,312,800   15,336   0.9218   <- the worst input, and it FITS
    //
    // The over-budget set is EMPTY: all 108 inputs are inside ordinary BCH-2026 operation-cost density, and the
    // controller clears it with 7.8% headroom.
    //
    // WHAT THIS CORRECTS. The table that stood here was introduced as "RE-MEASURED after the SEC-6 reshape, run
    // to completion" and NOT ONE of its ten rows reproduces. It recorded the controller at 1.2310x and called
    // it "the ONLY input over budget", which this same test's own assertion of an EMPTY over-budget set
    // already contradicted; it recorded projections at 5,876 bytes and 0.681-0.689 while the assertion a few
    // lines under it pinned 6,009 bytes; and it gave both 24,067 and 25,984 instructions for one quantity, the
    // per-projection instruction count. The figures were taken on a reshape branch before X24 and X27 were
    // composed on one tree, then carried forward rather than re-run. Every consequence drawn from them is
    // corrected in place below. The run now prints its own table above these assertions so the next reader
    // compares against a measurement instead of a citation.
    //
    // THE PROJECTION ROW HAS MOVED TWICE SINCE, and the table above is the reading at this commit, not either
    // history. X5 bound the ROOT row's call-options byte and cost 6,009 -> 6,046 bytes, 24,067 -> 24,382
    // instructions, 0.6257-0.6334 -> 0.6284-0.6361. X65 then replaced the projection verifier's 8-way dispatch
    // with an input-index table, cutting the REDEEM script 4,542 -> 4,098 (-444, pinned by
    // `Layer3CompiledGraph.test.ts`), and the row moved again to the 5,473 bytes / 18,656 instructions /
    // 0.5039-0.5083 asserted below. The row's byte column is UNLOCKING bytecode, not redeem, so its -573 is
    // not the -444 and this file does not decompose it. Both older readings are HISTORY; the
    // pre-X5 figures are kept only because the paragraph that introduced them named 6,009 as current while X5
    // had already moved it.
    //
    // THE CONTROLLER ROW IS NO LONGER THE CLEAN CONTROL IT WAS, and that is a finding rather than a re-pin.
    // For X5 it was: X5 edited `generateGraphProjectionVerifier` only, and `generateGraphRootController`'s
    // bytes, cost and instruction count all reproduced exactly. At this commit the controller's bytes (2,891)
    // and instruction count (15,336) still reproduce exactly, but its COST does not: 2,131,662 -> 2,131,942,
    // and the whole +280 is `stackPushedBytes` (588,523 -> 588,803, printed by the split line above). So a
    // reader may no longer take "the controller row is unchanged" as evidence that a change was scoped to one
    // covenant - bytes and instructions carry that evidence, cost does not. WHICH change moved it is NOT
    // established here: several landed between the two readings, and the participant rows moved too (P7 Sink
    // 4,951 -> 4,979 bytes, which no projection edit can explain). Attributing it needs a bisect this file
    // does not run, so it is recorded as a measured difference and not as a cause.
    //
    // SCOPE, and the reason the two claims are stated separately. "Fits ordinary BCH-2026 capacity" is a
    // CONSENSUS-knob result and is what the empty over-budget set establishes. "Relayable under standard
    // policy" is a different claim, and C3 NOW MEETS IT TOO: the serialized transaction is 96,118 bytes,
    // 3,882 UNDER the 100,000-byte standard relay ceiling, against the 1,000,000-byte consensus figure this
    // profile sets. This reverses the verdict this paragraph used to record - 100,650 bytes, 650 over - which
    // was true when F4's cut was the last one; X65's -444 per projection took a further 3,552 off C3's eight.
    // C1, at 60,502 bytes, clears both (X39).
    for (const projection of projections) {
      expect(projection.bytes).toBe(5_473);
      expect(projection.ratio).toBeGreaterThan(0.5);
      expect(projection.ratio).toBeLessThan(0.7);
    }
    // The +325 RETURNING-ROW SURCHARGE IS GONE, and that is a finding rather than a re-pin. It was recorded as
    // exactly 325 instructions on three independent compositions and treated as a stable property of the row
    // that authenticates a result. X24's unroll eliminated it. Measured at X38 time, every projection within
    // a build cost the same regardless of which row it proves: C3 24,067 x8, and on the same harness C1
    // 17,441 x5 and C2 14,798 x4. So the surcharge was an artifact of the counted-loop lowering, not an
    // intrinsic cost of authenticating a result. (The pre-X24 figures this paragraph used to quote - 17,259 /
    // 17,584 for C1 and C2, 25,984 / 26,309 for C3 - are HISTORY, not values obtainable on this tree; the
    // block above also quoted 25,984 as C3's current count while asserting 24,067 six lines later.)
    //
    // X5 then added the row call-options bound to the same walk: 24,067 -> 24,382, +315 instructions over 15
    // invocations, +1.3%. ALL EIGHT ROWS STILL COST THE SAME, so the surcharge finding above is unaffected -
    // which is the property that mattered, not the absolute figure.
    expect(projections.map((row) => row.instructions))
      .toEqual([18_656, 18_656, 18_656, 18_656, 18_656, 18_656, 18_656, 18_656]);
    expect(new Set(projections.map((row) => row.instructions)).size).toBe(1);
    for (const input of built.layout.participantInputs) {
      expect(at(input).ratio).toBeLessThan(0.75);
    }
    // The controller is the worst input and it FITS: measured 0.9217 at this commit, 7.8% of headroom. Asserted
    // as a band under 1.0 rather than an exact ratio, so a future density change fails loudly instead of
    // drifting. The 1.2310x this comment used to report does not reproduce at this commit, which carries both
    // X24 and X27; that is why the empty-set assertion below already contradicted it.
    expect(controller.ratio).toBeLessThan(1.0);
    expect(controller.ratio).toBeGreaterThan(0.8);
    // EMPTY: every one of C3's 108 inputs is inside ordinary BCH-2026 operation-cost density. This is the
    // assertion that makes the eight-participant composition a capacity result and not only a semantic one.
    expect(costs.filter((row) => row.ratio > 1).map((row) => row.input)).toEqual([]);

    // KNOB LIVENESS. An empty over-budget set is only evidence if the budget knob can refuse these exact bytes.
    // Same transaction, same source outputs, budget divided by four: the controller must now fail on density.
    // This is the control the 1.2310x/0.0095% history makes mandatory - libauth checks density after every
    // operation and aborts on the first excess, so an aborted evaluation reports the budget back, not the cost.
    const tightened = createVirtualMachineBch2026ForProvider({
      consensusLimits: { ...RELAXED_BUDGET_LIMITS, operationCostBudgetPerByte: 200 },
    } as never);
    const tight = tightened.evaluate({
      inputIndex: built.layout.controllerInput,
      sourceOutputs: generateLibauthSourceOutputs(built.builder.inputs as never),
      transaction: built.builder.buildLibauthTransaction(),
    }) as any;
    expect(tight.error, 'the operation-cost knob does not bite at 200/byte').toBeDefined();
    expect(String(tight.error)).toMatch(/density|operation cost/i);

    // WHERE the controller's cost goes, measured at `77cd1e8c` and printed by the split line above rather than
    // cited: 71.9% is instruction count (15,336 x 100) and 27.6% is `stackPushedBytes` (588,803 bytes pushed
    // for a 1,325-byte transcript; the 588,523 this comment used to carry no longer reproduces, and its +280
    // is the whole of the controller's cost move). Arithmetic and hashing, priced the way the assertion below
    // prices them, are together 0.17%. `attest` reads its fields with 160 `transcript.slice(a, b)` calls against the WHOLE
    // blob, and a slice of an L-byte item pushes O(L) no matter how few bytes it extracts, which is what makes
    // the pushed-bytes term grow with rows x transcript length rather than with transcript length alone.
    // The recorded split - 64.9% from 18,771 instructions and 34.7% from 1,003,837 pushed bytes - was taken
    // before X24 and X27 were composed and reproduces neither term.
    expect(controller.instructions * 100 / controller.cost).toBeGreaterThan(0.6);
    expect(controller.pushedBytes / controller.cost).toBeGreaterThan(0.25);
    expect((controller.arithmetic + controller.hashIterations * 64) / controller.cost).toBeLessThan(0.01);

    // WHAT WOULD WIDEN THE 7.8% HEADROOM. This block used to be headed "what 18.8% could come off", which was
    // a requirement derived from the 1.2310x that does not reproduce; nothing has to come off. Recosted against
    // the measured 2,131,942. None of these is implemented here.
    //   - A destructive left-to-right transcript walk in `attest`, so each field is split off a SHRINKING
    //     remainder instead of re-splitting the whole blob. `attest` issues 14 slices per participant and 6
    //     per invocation - 160 for C3 - which is what makes the instruction count track 14P + 6N, and each
    //     slice pushes O(transcript length) whatever it extracts. Halving the pushed-bytes term saves 294,401,
    //     which is 13.8%. (Re-derived, not carried: half of the measured 588,803, over the measured 2,131,942.)
    //   - Shrinking the Ledger's 64-slot trailing region to what one chunk needs: 198,400 against the measured
    //     base, which is 9.3%, and 9.5% on X28's corrected slot count. The constant lives in
    //     SymbolTableTraversal.ts; the per-output price it is costed at comes from X28, not from this file.
    //
    // Scaling, against C1 and C2 run to completion on the same relaxed-budget harness AT THIS COMMIT. All three
    // builds now print their own tables from their own capacity tests, so every row below is a reading rather
    // than a citation. C2's block, which this comment used to flag as stale and defer, has been repaired: it
    // recorded projections 5,294 B at 0.4607-0.4677 and controller 2,354 B / 1,538,567 / 0.8170, and not one
    // of its six rows reproduced. The re-measurement that flagged it - projections 5,427 B at 0.3916-0.3957 -
    // did not reproduce either, because X5 landed between the two readings.
    //
    //   build  P/N   transcript  slots  projection instr  controller instr  controller ratio  serialized
    //   C1     5/6   1,314 B      38    13,735 x5          9,561            0.6183            60,502 B
    //   C2     4/5     743 B      79    11,692 x4          9,536            0.6491            50,957 B
    //   C3     8/8   1,325 B     108    18,656 x8         15,336            0.9218            96,118 B
    //
    // Re-read at `77cd1e8c` from each capstone's own capacity test. The projection column moved on all three
    // (17,686 / 15,008 / 24,382 before) and the serialized column moved on all three (63,315 / 53,249 /
    // 100,650 before), because X65's input-index table cut the projection verifier by 444 bytes and every
    // build pays it once per participant: -2,220 on C1's five, -1,776 on C2's four, -3,552 on C3's eight,
    // which is 444 x N exactly, three times over. The controller instruction counts did NOT move.
    //
    // WHAT THAT SUPPORTS, and what it no longer does:
    //   1. Within a build every projection costs the same instruction count whatever row it proves - 13,735,
    //      11,692 and 18,656 respectively - so the per-row cost does not depend on the row.
    //   2. The stronger claim that the projection verifier is a pure function of participant and invocation
    //      count with transcript LENGTH not entering rested on C1 and C2 sharing row counts (both 4/5) while
    //      differing by 398 transcript bytes - C1 carried 1,141 before the SEC-6 reshape. The reshape made C1
    //      5/6, so no two of these three builds share row counts any more and that control is GONE. The claim
    //      is not re-asserted here; re-earning it needs two builds at equal P/N and different transcript
    //      length.
    //   3. The controller model "projection cost plus 32 instructions per transaction output" is NOT what these
    //      three builds establish, and this file should stop citing them for it: P, N and slots all differ
    //      across them, so a linear model in P, N, slots and a constant has four unknowns against three
    //      measurements and ANY per-output constant fits. The recorded 10,035 / 11,443 / 18,771 controller
    //      instruction counts reproduce as 9,561 / 9,536 / 15,336, so the arithmetic that "fit exactly" no
    //      longer does either. The constant itself is not in doubt - X28 re-fit it independently at exactly 32
    //      instructions per output with participant count, invocation count and transcript length held fixed,
    //      which is the right control and the one to cite.
    //
    // C3's own structural finding stands, and its price is now against the measured base: 66 of its 108 slots
    // are the Ledger's trailing region, held at BALANCED_TRAILING_CAPACITY = 64 for ONE chunk UTXO. At X28's
    // 32 instructions per output the unused slots cost the controller 198,400 of the measured 2,131,942 -
    // 9.3%, not the 6.9% recorded, which divided by the stale 2,891,475 base. X28 further records that the
    // unused count is 63 rather than the 62 that 198,400 is computed from, and that the price is a floor, which puts
    // the cut at 9.3% to 9.5%; this file does not re-derive the slot count, so the correction is cited rather
    // than applied. Either way it is headroom this composition already has, not a deficit it has to close.
    expect(built.plan.participants).toHaveLength(8);
    expect(built.plan.invocations).toHaveLength(8);
    expect(built.transcript.bytes.length).toBeGreaterThan(1_100);
    expect(built.transcript.bytes.length).toBeLessThan(1_500);
  }, 900_000);
});

/**
 * X59. THE EIGHT-PARTICIPANT GRAPH, BUILT AGAINST A REAL BCHN NODE.
 *
 * Round 17 offered C3's mock-built bytes to BCHN and got `64: tx-size`: at 100,650 bytes it was over the
 * 100,000-byte standard ceiling, so the node refused it on POLICY without executing a single script. (That the
 * ceiling is policy rather than consensus was settled separately, by getting oversized bytes refused through
 * the mempool and then accepted inside a submitted block.) F4 cut 129 bytes from the projection verifier -
 * one covenant instantiated once per participant, so C3 paid 8x - and put it under.
 *
 * That is what makes this block reachable: with the size refusal gone, and X60's dust output gone with it, the
 * node has to look up the inputs and execute all eight participants, eight projection proofs and the
 * controller. Nothing is relaxed: `RegtestNetworkProvider` carries no `consensusLimits`.
 *
 * Requires the docker regtest stack; see the root CLAUDE.md.
 */
describe.runIf(process.env.TESTS_USE_REGTEST)('X59: C3 on a real BCHN node', () => {
  it('CONSENSUS: BCHN executes the eight-participant graph, accepts it and mines it', async () => {
    const built = await buildC3('none', DEFAULT_ORDER, createTestProvider);
    expect(built.layout.controllerInput).toBe(106);

    const transaction = built.builder.buildLibauthTransaction();
    expect(formatDustOutputs(dustOutputs(transaction))).toBe('no dust outputs');

    const accepted = await acceptedByNode(built.provider as never, transaction, built.transaction);
    console.log(`X59 C3 accepted by BCHN: ${accepted.txid} at height ${accepted.blockHeight}, `
      + `${accepted.serializedBytes} B, ${accepted.inputCount} inputs`);
    // The size the node accepted, which is the figure the whole F4 argument turns on - read from the accepted
    // transaction rather than cited.
    expect(accepted.serializedBytes).toBeLessThan(100_000);
    expect(accepted.inputCount).toBe(108);
    expect(accepted.outputCount).toBe(108);
    expect(accepted.blockHeight).toBeGreaterThan(0);
  }, 900_000);

  /** The control: a transaction the covenants should refuse, refused by the node, same chain, same run. */
  it('CONSENSUS: BCHN refuses the disjoint-root transcript', async () => {
    const built = await buildC3('disjoint-root', DEFAULT_ORDER, createTestProvider);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 900_000);
});
