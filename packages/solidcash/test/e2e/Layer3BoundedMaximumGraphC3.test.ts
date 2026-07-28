import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, sha256,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, SignatureTemplate, StatefulContract, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
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
 *   inv0  root      -> P0.run       Router:   three outgoing calls, a scalar write, an event NFT, a satoshi transfer
 *   inv1  Router    -> P1.record    Ledger:   reads chunk-backed dynamic storage, writes a scalar
 *   inv2  Router    -> P2.broker    Broker:   consumes the graph's only result, writes a scalar
 *   inv3  Broker    -> P4.score     Oracle:   the only returning handler - effect-free, no outgoing call
 *   inv4  Router    -> P3.hold      Escrow -> Settler -> Reporter -> Sink: a depth-4 chain
 *   inv5  Escrow    -> P5.settle
 *   inv6  Settler   -> P6.report
 *   inv7  Reporter  -> P7.absorb
 *
 * Eight independently compiled contract types, eight physical blocks, 108 balanced slots.
 *
 * The shape is constrained by three refusals other tasks already measured, none of which this capstone tries
 * to move: a returning handler may make no outgoing call and carry no effect (C1's boundary block), a handler
 * that consumes a result may not carry ANY second edge (X3 as corrected by C1), and a pointer-table caller
 * stops binding its emission rows once its own contract declares a returning handler (SEC-5). No contract here
 * owns a pointer table, so no claim in this file depends on SEC-5 being fixed.
 *
 * SEMANTIC evidence only, on the named `layer3-bch2026-semantic-relaxed-v1` profile: BCH-2026 opcodes,
 * introspection and the real 128-byte NFT commitment, relaxed capacity. Not consensus-fit, not policy-fit.
 * The last test in this file measures where C3 does NOT fit ordinary capacity.
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
const TRANSFER_SATS = 10n;

/** P0. The graph root: three outgoing calls plus every physical effect kind a block can carry. */
const ROUTER = `pragma solidcash >=0.8.0;
interface IC3Ledger { function record(bigint v); }
interface IC3Broker { function broker(bigint v); }
interface IC3Escrow { function hold(bigint v); }
contract C3Router(address ledger, address broker, address escrow) {
  bigint fired;
  event Fired(bigint amount);
  function run(bigint v, bytes recipient) public {
    IC3Ledger(ledger).record(v);
    IC3Broker(broker).broker(v);
    IC3Escrow(escrow).hold(v);
    this.fired = this.fired + v;
    emit Fired(v);
    this.transfer(recipient, ${TRANSFER_SATS});
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

/** P7. The deepest leaf, at depth 4. */
const SINK = `pragma solidcash >=0.8.0;
contract C3Sink(bigint brand) {
  bigint total;
  function absorb(bigint v) public {
    this.total = this.total + v;
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
const createOrdinaryCapacityProvider = (): MockNetworkProvider => new MockNetworkProvider({
  consensusLimits: {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 10_000,
    maximumTransactionBytes: 1_000_000,
    maximumNftCommitmentBytes: 128,
    operationCostBudgetPerByte: 800,
    hashDigestIterationsPerByte: 3,
  },
  policy: { enforceDust: false },
});

type Provider = ReturnType<typeof createLayer3SemanticTestProvider>;

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
  /** Two participant rows name one physical owner. */
  | 'duplicate-owner'
  /** One subtree is presented as a second, independent graph root. */
  | 'disjoint-root';

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
  participants: readonly { lbcStart: number; lbcLength: number }[];
  invocations: readonly { parentStart: number; depthStart: number }[];
}

function transcriptFieldOffsets(bytes: Uint8Array): TranscriptFieldOffsets {
  const u16 = (at: number): number => bytes[at] | (bytes[at + 1] << 8);
  const participants: { lbcStart: number; lbcLength: number }[] = [];
  const invocations: { parentStart: number; depthStart: number }[] = [];
  const participantCount = bytes[9];
  let cursor = 10;
  for (let participant = 0; participant < participantCount; participant += 1) {
    cursor += 4; // participant input, block size
    const lbcLength = u16(cursor);
    cursor += 2;
    participants.push({ lbcStart: cursor, lbcLength });
    cursor += lbcLength;
    for (let frame = 0; frame < 3; frame += 1) { // batch, emissions, callers
      cursor += 2 + u16(cursor);
    }
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
  const sinkBase = new Contract(sinkArtifact, [1n], { provider });
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
  const recipient = Uint8Array.of(0x51);
  const edges: { parent: number | null; callee: Label; function: string; args: any[] }[] = [
    { parent: null, callee: 'router', function: 'run', args: [CALL_VALUE, recipient] },
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
  if (hostile === 'disjoint-root') {
    // Invocation 4 (Router -> Escrow) is re-presented as a second root: parent 0xffff at depth 0. That splits
    // the eight-participant table into two disjoint trees sharing one controller attestation. Three bytes.
    const record = offsets.invocations[4];
    transcript = patchTranscript(honestTranscript, [
      { at: record.parentStart, bytes: Uint8Array.of(0xff, 0xff) },
      { at: record.depthStart, bytes: Uint8Array.of(0) },
    ]);
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
  await provider.addUtxo(getSatoshiContainerAddress(router, routerSetup.categoryId), container);
  const routerFunding = Array.from({ length: 16 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const ledgerFunding = Array.from(
    { length: ledgerLayout.blockSize - 2 - chunks.length }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  const returnFunding = uniqueUtxo(outpoints, { satoshis: 1000n });
  const omissionFunding = Array.from({ length: 2 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const projectionUtxos = Array.from({ length: 8 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const fee = uniqueUtxo(outpoints, { satoshis: 3_000_000n });
  for (const utxo of [...routerFunding, ...ledgerFunding, returnFunding, ...omissionFunding, fee]) {
    await provider.addUtxo(p2pkh.address, utxo);
  }
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);

  // The ninth participant the injection cases co-spend: a real, independently categorized stateful contract
  // of the same compiled type as the Sink. The honest control never creates it.
  const injecting = hostile === 'injection' || hostile === 'injection-burned';
  let injected: any;
  let injectedContract: Contract | undefined;
  if (injecting) {
    const injectedBase = new Contract(sinkArtifact, [2n], { provider });
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
    // [master, dataNft, satoshiContainer, 8 x transfer, 8 x event]
    router: () => {
      openBlock('router');
      tx.addInput(
        container, createSatoshiContainerUnlocker(router, base('router'), routerSetup.categoryId),
      );
      routerFunding.forEach(funding);
    },
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
    sink: () => {
      // The table still commits the Sink at this base, but under `omission` the two slots carry ordinary
      // funding: the Sink's state never moves, and the block is exactly as wide as its control's.
      if (hostile === 'omission') omissionFunding.forEach(funding);
      else openBlock('sink');
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
    router: () => {
      settleBlock('router', 'fired', CALL_VALUE);
      containerOutput = tx.outputs.length;
      tx.addOutput({
        to: getSatoshiContainerAddress(router, routerSetup.categoryId),
        amount: CONTAINER_SATS - TRANSFER_SATS,
      });
      transferOutput = tx.outputs.length;
      tx.addOutput({ to: recipient, amount: TRANSFER_SATS });
      for (let slot = 1; slot < 8; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
      eventOutput = tx.outputs.length;
      tx.addOutput({
        to: getEventNftAddress(router, routerSetup.categoryId, routerArtifact.events![0].signature),
        amount: 1000n,
        token: {
          category: routerSetup.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: eventCommitment },
        },
      });
      for (let slot = 1; slot < 8; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
    },
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
      } else settleBlock('sink', 'total', CALL_VALUE);
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

    // EVENT NFT and RESOURCES: both are the Router's, and this assembly puts both inside the Router's block.
    // In-block placement and the 1,000-satoshi slot value are SDK assembly conventions, not covenant
    // invariants, so they are asserted here as facts about this assembly and nothing more.
    const routerBlock = built.blockSizes[0];
    expect(built.assembly.eventOutput).toBeGreaterThanOrEqual(built.layout.participantInputs[0]);
    expect(built.assembly.eventOutput).toBeLessThan(built.layout.participantInputs[0] + routerBlock);
    expect(built.assembly.containerOutput).toBeLessThan(built.layout.participantInputs[0] + routerBlock);
    expect(built.assembly.transferOutput).toBeLessThan(built.layout.participantInputs[0] + routerBlock);

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
    expect(built.blockSizes).toEqual([19, 66, 2, 2, 3, 2, 2, 2]);
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
    expect(built.layout.returnOutputs).toEqual([null, null, null, null, 91, null, null, null]);
    expect(built.assembly.returnOutput).toBe(91);
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
    expect([...built.layout.participantInputs]).toEqual([0, 2, 4, 23, 25, 28, 30, 32]);
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

    // The structural block-assembly gate fires first, before a single signature is taken: the injected
    // block's token outputs sit outside every participant block. This is an SDK refusal, not a covenant one.
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
      const outcome = preflightOutcome(attacked);
      expect(outcome).toContain('layer3: BCH-2026 preflight failed at input 98');
      const broadcast = await attacked.provider.sendRawTransaction(attacked.transaction)
        .then(() => 'ACCEPTED').catch((error: Error) => error.message);
      expect(broadcast).toContain('error in evaluating input index 98');
    }, 900_000);

  it('HOSTILE: two table rows naming one owner are refused at input 96', async () => {
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

    // Input 96 is the impersonated slot's OWN master route: the participant at that base refuses a table
    // whose row for it names somebody else as its owner.
    const outcome = preflightOutcome(attacked);
    expect(outcome).toContain('layer3: BCH-2026 preflight failed at input 96');
    await expect(attacked.provider.sendRawTransaction(attacked.transaction)).rejects.toThrow();

    // The SDK planner refuses the same construction before any transcript exists.
    const rows = attacked.plan.participants.map((participant, index) => ({
      artifact: attacked.artifacts[index], lockingBytecode: participant.lockingBytecode,
    }));
    rows[7] = { ...rows[7], lockingBytecode: rows[6].lockingBytecode };
    expect(() => layer3.planCompiledGraph(rows as any, [
      { parent: null, callee: 0, function: 'run', args: [CALL_VALUE, Uint8Array.of(0x51)] },
    ] as any)).toThrow(/two participant rows name the same physical locking bytecode/);

    // SCOPE. The forgery is on the table, not on the physical side: a stateful participant owns exactly one
    // minting master UTXO, so the same owner cannot be co-spent twice in one transaction to give a duplicate
    // row a block of its own. What is proven is that a table naming one owner twice is refused; what is NOT
    // proven here is any statement about two live masters of one category, which this model does not create.
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

    // SCOPE. The patch leaves the Router's emission row for that edge in place, which is what keeps the edit
    // down to three bytes. A stricter attacker would also drop that row so the two trees share nothing at
    // all - but dropping an emission row changes the transcript's length and is the omission case above.
  }, 900_000);
});

describe('C3 capacity measurement', () => {
  it('MEASURED: reports the honest participant route sizes on the relaxed semantic profile', async () => {
    const built = await buildC3();
    // Measured at this commit, in the default order: router 4,746, ledger 3,556, broker 3,114, escrow 3,085,
    // oracle 3,183, settler 3,085, reporter 3,082, sink 2,864 bytes; whole transaction 119,427 bytes;
    // transcript blob 1,329 bytes. Every compiled participant route sits under the ordinary 10,000-byte input
    // limit, so participant script size is NOT what keeps C3 off ordinary capacity - the next test names what
    // is. Bands are asserted rather than exact figures so compiler work elsewhere does not falsely fail here.
    expect(built.routeInputBytes).toHaveLength(8);
    for (const size of built.routeInputBytes) {
      expect(size).toBeGreaterThan(1_000);
      expect(size).toBeLessThan(10_000);
    }
    expect(built.transcript.bytes.length).toBeLessThan(2_000);
  }, 900_000);

  it('MEASURED: the same composition under ordinary BCH-2026 capacity does NOT fit', async () => {
    // An F1-style capacity measurement, NOT a CONSENSUS_FIT or POLICY_FIT claim: only the consensus capacity
    // knobs the semantic profile relaxes are restored. C1 already fails its first projection proof on
    // operation-cost density; C3 is strictly larger, so a failure here is expected and is a production-fitting
    // result, not a semantic one. What is worth recording is WHERE it fails and by how much, because that is
    // what the F-phase optimization has to move.
    const built = await buildC3('none', DEFAULT_ORDER, createOrdinaryCapacityProvider);
    const outcome = preflightOutcome(built);
    const broadcast = await built.provider.sendRawTransaction(built.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    // The blocker is the graph projection proof, exactly as it was for C1: input 98 is the FIRST projection,
    // whose unlocking bytecode is mostly the transcript blob and therefore buys a small density budget for a
    // long verification loop.
    expect(outcome).toContain('preflight failed at input 98');
    expect(outcome).toContain('exceed the operation cost density limit');
    expect(broadcast).toContain('error in evaluating input index 98');
    const [, maximum, length, cost] = outcome.match(
      /Maximum operation cost: (\d+) \(density control length: (\d+)\).*following operation: (\d+)/,
    )!;
    // Measured at this commit: budget 6,729,600 for an 8,412-byte projection input, overrun to 6,729,670 -
    // 70 operations, 0.001% over. Two things follow, and both matter for the F phase:
    //   1. the projection input is 8,412 bytes, UNDER the ordinary 10,000-byte input limit, so input size is
    //      not the blocker for C3 any more than it was for C1;
    //   2. C3 misses by LESS than C1 in absolute terms (70 versus C1's 626), because the density budget is
    //      800 per unlocking byte and a wider graph carries a longer transcript, which buys budget faster
    //      than the extra participant frames consume it.
    // Bands are asserted rather than the exact figures.
    expect(Number(length)).toBeLessThan(10_000);
    expect(Number(cost) - Number(maximum)).toBeGreaterThan(0);
    expect(Number(cost) - Number(maximum)).toBeLessThan(Number(maximum) / 10_000);
  }, 900_000);
});
