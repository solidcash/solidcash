import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, sha256,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  ROW_COMPARISON_EXEMPTIONS, SYNTHETIC_BASE_BINDING_SOURCE, SYNTHETIC_PAIRWISE_SOURCE,
  SYNTHETIC_ROW_NEAR_MISS_SOURCE, SYNTHETIC_ROW_PAIRWISE_SOURCE, SYNTHETIC_ROW_TABLE_SOURCE,
  injectPairwiseComparison, scanComparisons,
} from './layer3-pairwise-guard.js';
import {
  createDataNftUnlocker, getDataNftAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * A1 - independent hostile review of the C1 and C3 capstones.
 *
 * The reviewer did not implement either slice. This file adds hostile cases for the authenticated transcript
 * fields those capstones do NOT attack, and it re-tests two claims their authors scoped, with controls that
 * separate the named field from the field the case actually moves.
 *
 * The graph below is deliberately the smallest shape that carries every transcript field C3 carries: a root
 * with two outgoing edges, a depth-2 chain, exactly one returning leaf, four independently compiled types.
 * It is NOT a capstone and makes no composition claim - it is an instrument for pinning fields.
 *
 *   inv0  root  -> P0.run     Root:   two outgoing calls
 *   inv1  P0    -> P1.record  Leaf:   plain state write
 *   inv2  P0    -> P2.broker  Broker: consumes the graph's only result
 *   inv3  P2    -> P3.score   Oracle: the only returning handler
 *
 * SEMANTIC evidence only, on the named `layer3-bch2026-semantic-relaxed-v1` profile.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedResult = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);

const CALL_VALUE = 6n;
const SCORE = CALL_VALUE + 1n;

const ROOT = `pragma solidcash >=0.8.0;
interface IA1Leaf { function record(bigint v); }
interface IA1Broker { function broker(bigint v); }
contract A1Root(address leaf, address broker) {
  bigint fired;
  function run(bigint v) public {
    IA1Leaf(leaf).record(v);
    IA1Broker(broker).broker(v);
    this.fired = this.fired + v;
    require(v > 0);
  }
}`;

const LEAF = `pragma solidcash >=0.8.0;
contract A1Leaf(bigint brand) {
  bigint seen;
  function record(bigint v) public {
    this.seen = this.seen + v;
    require(v > 0 && brand >= 0);
  }
}`;

const BROKER = `pragma solidcash >=0.8.0;
interface IA1Oracle { function score(bigint v) returns (bigint); }
contract A1Broker(address oracle) {
  bigint scored;
  function broker(bigint v) public {
    bigint s = IA1Oracle(oracle).score(v);
    this.scored = this.scored + s;
    require(s >= 0);
  }
}`;

const ORACLE = `pragma solidcash >=0.8.0;
contract A1Oracle(bigint brand) {
  bigint reviews;
  function score(bigint v) public returns (bigint) {
    this.reviews = this.reviews + 1;
    require(v > 0 && brand >= 0);
    return v + 1;
  }
}`;

/**
 * Byte offsets of every individually addressable transcript field, walked exactly as `finalizeCompiledGraph`
 * encodes them. C3's walker exposes only the two fields C3 patches; this one exposes all of them, because the
 * review has to reach the fields no capstone attacks.
 */
interface ParticipantFrame {
  inputStart: number;
  blockSizeStart: number;
  lbcLengthStart: number;
  lbcStart: number;
  lbcLength: number;
  batchStart: number;
  batchLength: number;
  emissionsLengthStart: number;
  emissionsStart: number;
  emissionsLength: number;
  callersStart: number;
  callersLength: number;
  returnOutputStart: number;
  resultStart: number;
  resultLength: number;
  projectionInputStart: number;
}

interface InvocationFrame {
  parentStart: number;
  calleeStart: number;
  localRowStart: number;
  depthStart: number;
  subtreeEndStart: number;
  selectorStart: number;
  /**
   * X5 turned this byte into a call-OPTIONS bitfield, not a two-valued mode: bit 0 is the compiler-proven
   * read-only (`staticcall`) mode and bits 1-7 are source-level options, none of them an admitted graph edge.
   * The projection verifier bounds the whole byte with `require(callOptions <= 1)` and pins the root row's
   * copy to 0, so the name here is the field, not one of its readings.
   */
  callOptionsStart: number;
  argsStart: number;
  argsLength: number;
  resultStart: number;
  resultLength: number;
}

interface TranscriptFields {
  participants: readonly ParticipantFrame[];
  invocations: readonly InvocationFrame[];
}

function transcriptFields(bytes: Uint8Array): TranscriptFields {
  const u16 = (at: number): number => bytes[at] | (bytes[at + 1] << 8);
  const participants: ParticipantFrame[] = [];
  const invocations: InvocationFrame[] = [];
  const participantCount = bytes[9];
  let cursor = 10;
  for (let participant = 0; participant < participantCount; participant += 1) {
    const inputStart = cursor;
    const lbcLength = u16(cursor + 4);
    const lbcStart = cursor + 6;
    const batchLength = u16(lbcStart + lbcLength);
    const batchStart = lbcStart + lbcLength + 2;
    const emissionsLengthStart = batchStart + batchLength;
    const emissionsLength = u16(emissionsLengthStart);
    const emissionsStart = emissionsLengthStart + 2;
    const callersLength = u16(emissionsStart + emissionsLength);
    const callersStart = emissionsStart + emissionsLength + 2;
    const returnOutputStart = callersStart + callersLength;
    const resultLength = u16(returnOutputStart + 2);
    const resultStart = returnOutputStart + 4;
    const projectionInputStart = resultStart + resultLength;
    participants.push({
      inputStart,
      blockSizeStart: cursor + 2,
      lbcLengthStart: cursor + 4,
      lbcStart,
      lbcLength,
      batchStart,
      batchLength,
      emissionsLengthStart,
      emissionsStart,
      emissionsLength,
      callersStart,
      callersLength,
      returnOutputStart,
      resultStart,
      resultLength,
      projectionInputStart,
    });
    cursor = projectionInputStart + 2;
  }
  const invocationCount = u16(cursor);
  cursor += 2;
  for (let invocation = 0; invocation < invocationCount; invocation += 1) {
    const argsLength = u16(cursor + 12);
    const resultLength = u16(cursor + 14 + argsLength);
    invocations.push({
      parentStart: cursor,
      calleeStart: cursor + 2,
      localRowStart: cursor + 3,
      depthStart: cursor + 4,
      subtreeEndStart: cursor + 5,
      selectorStart: cursor + 7,
      callOptionsStart: cursor + 11,
      argsStart: cursor + 14,
      argsLength,
      resultStart: cursor + 16 + argsLength,
      resultLength,
    });
    cursor = cursor + 16 + argsLength + resultLength;
  }
  return { participants, invocations };
}

/** A length-preserving byte patch, re-rooted so the blob stays self-consistent. */
interface Patch { at: number; bytes: Uint8Array }

/**
 * Every LATER participant's frame start moves when an earlier participant's region changes length.
 * `compiledGraphRouteArgs` hands each route its own frame offset, so a length-changing patch that does not
 * fix these would make later routes read the wrong frame - a fixture artifact, not a covenant result.
 */
function shiftedOffsets(
  transcript: layer3.FinalizedCompiledGraph, participant: number, delta: number,
): readonly number[] {
  return Object.freeze(transcript.participantOffsets.map(
    (offset, index) => (index > participant ? offset + delta : offset),
  ));
}

/**
 * Rewrite one participant's emissions region to a NEW length, fixing the region's own length frame and
 * re-deriving the root. Also rewrites the blob that participant's compiled route is handed, so the attacker
 * is not caught by a mismatch between the two copies it controls.
 */
function replaceEmissions(
  transcript: layer3.FinalizedCompiledGraph, participant: number, replacement: Uint8Array,
): layer3.FinalizedCompiledGraph {
  const frame = transcriptFields(transcript.bytes).participants[participant];
  const head = transcript.bytes.subarray(0, frame.emissionsLengthStart);
  const tail = transcript.bytes.subarray(frame.emissionsStart + frame.emissionsLength);
  const bytes = new Uint8Array(head.length + 2 + replacement.length + tail.length);
  bytes.set(head, 0);
  bytes[head.length] = replacement.length & 0xff;
  bytes[head.length + 1] = (replacement.length >>> 8) & 0xff;
  bytes.set(replacement, head.length + 2);
  bytes.set(tail, head.length + 2 + replacement.length);
  const emissionsHex = [...transcript.participantEmissionsHex];
  emissionsHex[participant] = binToHex(replacement);
  return {
    ...transcript,
    bytes,
    root: binToHex(sha256.hash(bytes)),
    participantOffsets: shiftedOffsets(transcript, participant, replacement.length - frame.emissionsLength),
    participantEmissionsHex: Object.freeze(emissionsHex),
  } as layer3.FinalizedCompiledGraph;
}

/**
 * Rewrite one participant's logical CALLER region to a new length, in both copies the attacker owns.
 *
 * The root invocation's caller row is the transcript's `tx.origin` binding, and `finalizeCompiledGraph`
 * leaves it EMPTY by default - `rootCallerLockingBytecode` defaults to `''` - which takes the verifier's
 * `logicalCallerLength == 0 ||` early-out. C1, C3 and this fixture all inherit that default, so no committed
 * test exercises a non-empty root caller row.
 */
function replaceCallers(
  transcript: layer3.FinalizedCompiledGraph, participant: number, replacement: Uint8Array,
): layer3.FinalizedCompiledGraph {
  const frame = transcriptFields(transcript.bytes).participants[participant];
  const head = transcript.bytes.subarray(0, frame.callersStart - 2);
  const tail = transcript.bytes.subarray(frame.callersStart + frame.callersLength);
  const bytes = new Uint8Array(head.length + 2 + replacement.length + tail.length);
  bytes.set(head, 0);
  bytes[head.length] = replacement.length & 0xff;
  bytes[head.length + 1] = (replacement.length >>> 8) & 0xff;
  bytes.set(replacement, head.length + 2);
  bytes.set(tail, head.length + 2 + replacement.length);
  const callersHex = [...transcript.participantCallersHex];
  callersHex[participant] = binToHex(replacement);
  return {
    ...transcript,
    bytes,
    root: binToHex(sha256.hash(bytes)),
    participantOffsets: shiftedOffsets(transcript, participant, replacement.length - frame.callersLength),
    participantCallersHex: Object.freeze(callersHex),
  } as layer3.FinalizedCompiledGraph;
}

/** Apply length-preserving patches and re-derive the root the controller is then rooted with. */
function patchTranscript(
  transcript: layer3.FinalizedCompiledGraph, patches: readonly Patch[],
): layer3.FinalizedCompiledGraph {
  const bytes = Uint8Array.from(transcript.bytes);
  for (const patch of patches) bytes.set(patch.bytes, patch.at);
  return { ...transcript, bytes, root: binToHex(sha256.hash(bytes)) } as layer3.FinalizedCompiledGraph;
}

/**
 * Also rewrite the caller blob a participant's compiled route is handed, so a callers-region forgery is a
 * consistent attacker rather than a self-inflicted mismatch between two copies it owns.
 */
function withCallerBlob(
  transcript: layer3.FinalizedCompiledGraph, participant: number, blob: Uint8Array,
): layer3.FinalizedCompiledGraph {
  const callersHex = [...transcript.participantCallersHex];
  callersHex[participant] = binToHex(blob);
  return { ...transcript, participantCallersHex: Object.freeze(callersHex) } as layer3.FinalizedCompiledGraph;
}

type Rewrite = (
  transcript: layer3.FinalizedCompiledGraph,
) => layer3.FinalizedCompiledGraph;

/**
 * A physical substitution that leaves the transcript entirely honest and moves exactly one property of one
 * settled output. These are the preservation properties the review checklist names: value, category,
 * capability, commitment and locking bytecode.
 */
type Physical =
  /** The leaf's state authority is downgraded from a minting master to an ordinary mutable NFT. */
  | 'master-capability'
  /** The leaf's master output is re-branded with another participant's token category. */
  | 'master-category'
  /** The leaf's master output keeps one satoshi less than the input it continues. */
  | 'master-value'
  /** The leaf's data NFT is sent to an ordinary p2pkh token address, not its own state covenant. */
  | 'data-locking-bytecode'
  /** The leaf's data NFT carries a post-state commitment the handler did not compute. */
  | 'data-commitment'
  /** The oracle's return-event NFT is published as a mutable NFT rather than an immutable one. */
  | 'return-capability'
  /** The graph-root controller's own continuation output is paid 1,200 satoshis instead of 1,000. */
  | 'controller-slot-value'
  /** The first projection proof's own continuation output is paid 1,200 satoshis instead of 1,000. */
  | 'projection-slot-value';

interface BuiltA1 {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  transcript: layer3.FinalizedCompiledGraph;
  honestTranscript: layer3.FinalizedCompiledGraph;
  layout: layer3.CompiledGraphPhysicalLayout;
  plan: layer3.CompiledGraphPlan;
  fields: TranscriptFields;
  participantLbc: readonly string[];
  settled: readonly { label: string; address: string; commitment: string }[];
}

/**
 * Assemble one review transaction. `rewrite` receives the honestly finalized transcript and returns the blob
 * the controller is rooted with and every covenant is handed - exactly the freedom a real attacker has, since
 * the transcript is witness data and its commitment is whatever the attacker committed.
 */
async function buildA1(rewrite?: Rewrite, physical?: Physical): Promise<BuiltA1> {
  const provider = createLayer3SemanticTestProvider();
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

  const oracleArtifact = compileString(ORACLE, options);
  const oracleBase = new Contract(oracleArtifact, [3n], { provider });
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

  const leafArtifact = compileString(LEAF, options);
  const leafBase = new Contract(leafArtifact, [5n], { provider });
  const leafSetup = await setupStatefulUtxos(provider, leafBase, leafArtifact.stateLayout!, { seen: 0n });
  const leaf = leafBase.withCategory(hexToBin(leafSetup.categoryId));

  const rootArtifact = compileString(ROOT, options);
  const rootBase = new Contract(
    rootArtifact, [leaf.lockingBytecode, broker.lockingBytecode], { provider },
  );
  const rootSetup = await setupStatefulUtxos(provider, rootBase, rootArtifact.stateLayout!, { fired: 0n });
  const root = rootBase.withCategory(hexToBin(rootSetup.categoryId));

  const rows = [
    { artifact: rootArtifact, contract: root, setup: rootSetup, field: 'fired', value: CALL_VALUE },
    { artifact: leafArtifact, contract: leaf, setup: leafSetup, field: 'seen', value: CALL_VALUE },
    { artifact: brokerArtifact, contract: broker, setup: brokerSetup, field: 'scored', value: SCORE },
    { artifact: oracleArtifact, contract: oracle, setup: oracleSetup, field: 'reviews', value: 1n },
  ];

  const plan = layer3.planCompiledGraph(
    rows.map((row) => ({ artifact: row.artifact, lockingBytecode: row.contract.lockingBytecode })),
    [
      { parent: null, callee: 0, function: 'run', args: [CALL_VALUE] },
      { parent: 0, callee: 1, function: 'record', args: [CALL_VALUE] },
      { parent: 0, callee: 2, function: 'broker', args: [CALL_VALUE] },
      { parent: 2, callee: 3, function: 'score', args: [CALL_VALUE] },
    ],
  );
  const layout = layer3.compiledGraphPhysicalLayout(plan);

  const honestTranscript = layer3.finalizeCompiledGraph(
    plan,
    { 3: binToHex(packedResult(SCORE)) },
    layout.participantInputs,
    layout.returnOutputs,
    plan.participants.map((participant) =>
      (participant.batch.results.length > 0 ? binToHex(packedResult(SCORE)) : '')),
    layout.projectionInputs,
  );
  const transcript = rewrite === undefined ? honestTranscript : rewrite(honestTranscript);

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootingFee = randomUtxo({ satoshis: 20_000n });
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
  if (!rootedController) throw new Error('A1 harness did not root its graph controller');

  const returnFunding = randomUtxo({ satoshis: 1000n });
  const projectionUtxos = Array.from({ length: 4 }, () => randomUtxo({ satoshis: 1000n }));
  const fee = randomUtxo({ satoshis: 500_000n });
  for (const utxo of [returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  rows.forEach((row, participant) => {
    const routeUnlocker = row.contract.createCompilerRouteUnlocker(
      row.artifact.hiddenBatch!.route, hexToBin(row.artifact.hiddenBatch!.selector),
    );
    tx.addInput(row.setup.masterUtxo, routeUnlocker(
      ...layer3.compiledGraphRouteArgs(transcript, participant, layout.controllerInput) as any,
      ...(layout.returnOutputs![participant] === null
        ? [] : [BigInt(layout.returnOutputs![participant]!)]),
    ));
    tx.addInput(row.setup.dataNftUtxos[0], createDataNftUnlocker(
      row.contract, layout.participantInputs[participant], row.setup.categoryId,
    ));
    if (layout.returnOutputs![participant] !== null) {
      tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
    }
  });
  projectionUtxos.forEach((proof, participant) => tx.addInput(proof, projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
  )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const settled: { label: string; address: string; commitment: string }[] = [];
  // Every physical substitution below targets participant 1 (the leaf) except the return-event one, which can
  // only target participant 3 (the oracle) because it is the graph's only returning participant.
  const participantOf = (kind: Physical): number => (kind === 'return-capability' ? 3 : 1);
  const attacked = (target: number, kind: Physical): boolean =>
    physical === kind && participantOf(kind) === target;
  rows.forEach((row, participant) => {
    const honest = buildInitialStateCommitments(row.artifact.stateLayout!, { [row.field]: row.value })[0];
    const next = attacked(participant, 'data-commitment')
      ? buildInitialStateCommitments(row.artifact.stateLayout!, { [row.field]: row.value + 1n })[0]
      : honest;
    tx.addOutput({
      to: row.contract.tokenAddress,
      amount: row.setup.masterUtxo.satoshis - (attacked(participant, 'master-value') ? 1n : 0n),
      token: {
        category: attacked(participant, 'master-category')
          ? rows[0].setup.categoryId : row.setup.categoryId,
        amount: 0n,
        nft: {
          capability: attacked(participant, 'master-capability') ? 'mutable' : 'minting',
          commitment: '',
        },
      },
    });
    tx.addOutput({
      to: attacked(participant, 'data-locking-bytecode')
        ? p2pkh.tokenAddress : getDataNftAddress(row.contract, row.setup.categoryId),
      amount: row.setup.dataNftUtxos[0].satoshis,
      token: {
        category: row.setup.categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: next },
      },
    });
    settled.push({
      label: `p${participant}.${row.field}`,
      address: getDataNftAddress(row.contract, row.setup.categoryId),
      commitment: honest,
    });
    if (layout.returnOutputs![participant] !== null) {
      tx.addOutput({
        to: hexToBin('51'),
        amount: 1000n,
        token: {
          category: row.setup.categoryId, amount: 0n,
          nft: {
            capability: attacked(participant, 'return-capability') ? 'mutable' : 'none',
            commitment: binToHex(aggregateResult(SCORE)),
          },
        },
      });
    }
  });
  projectionUtxos.forEach((_proof, slot) => tx.addOutput({
    to: p2pkh.address,
    amount: physical === 'projection-slot-value' && slot === 0 ? 1200n : 1000n,
  }));
  tx.addOutput({
    to: p2pkh.address, amount: physical === 'controller-slot-value' ? 1200n : 1000n,
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });

  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    transcript,
    honestTranscript,
    layout,
    plan,
    fields: transcriptFields(transcript.bytes),
    participantLbc: plan.participants.map((participant) => participant.lockingBytecode),
    settled,
  };
}

/** Pin the exact input whose covenant refused a transaction, rather than only that it was refused. */
function preflightOutcome(built: BuiltA1): string {
  try {
    layer3.preflightLayer3Transaction(built.builder);
    return 'ACCEPTED';
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * First input whose covenant refuses the transaction, evaluated directly.
 *
 * `preflightLayer3Transaction` now runs the structural block-assembly gate ahead of the VM, and that gate
 * refuses some shapes on its own - the sidecar 1,000-satoshi slot value is one of them, since closing L2's
 * FINDING 2 made the derived assembly name its auxiliary slots. A structural refusal is a DIFFERENT layer, so
 * it must not be read as "no covenant refused this": the per-input evaluation below is what pins the covenant.
 */
function covenantFailingInput(built: BuiltA1): number | null {
  const transaction = built.builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs as never);
  const vm = createVirtualMachineBch2026ForProvider(built.builder.provider);
  for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
    const state = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as { error?: string };
    if (state.error !== undefined) return inputIndex;
  }
  return null;
}

function failingInput(built: BuiltA1): number | null {
  const outcome = preflightOutcome(built);
  if (outcome === 'ACCEPTED') return null;
  if (/^balanced assembly: /.test(outcome)) return covenantFailingInput(built);
  const match = /failed at input (\d+)/.exec(outcome);
  if (!match) throw new Error(`A1: refusal did not name an input: ${outcome}`);
  return Number(match[1]);
}

/** Byte indices at which a build's transcript differs from the honest one it derived first. */
function patchedByteIndices(built: BuiltA1): number[] {
  const patched = built.transcript.bytes;
  const honest = built.honestTranscript.bytes;
  expect(patched.length).toBe(honest.length);
  const differing: number[] = [];
  for (let index = 0; index < patched.length; index += 1) {
    if (patched[index] !== honest[index]) differing.push(index);
  }
  return differing;
}

/** Physical input map of the review graph. */
const INPUT = {
  root: 0, leaf: 2, broker: 4, oracle: 6,
  projection0: 9, projection1: 10, projection2: 11, projection3: 12,
  controller: 13, fee: 14,
} as const;

describe('A1 review: honest control', () => {
  it('the review graph settles, and its physical layout is the one every case below pins', async () => {
    const built = await buildA1();
    expect([...built.layout.participantInputs]).toEqual([0, 2, 4, 6]);
    expect([...built.layout.projectionInputs]).toEqual([9, 10, 11, 12]);
    expect(built.layout.controllerInput).toBe(INPUT.controller);
    expect(built.layout.totalSlots).toBe(15);
    expect(built.layout.returnOutputs).toEqual([null, null, null, 8]);
    expect(built.plan.invocations.map((invocation) => invocation.depth)).toEqual([0, 1, 1, 2]);

    expect(preflightOutcome(built)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
    for (const transition of built.settled) {
      const utxos = await built.provider.getUtxos(transition.address);
      expect(
        utxos.map((utxo: any) => utxo.token?.nft?.commitment), `${transition.label}`,
      ).toContain(transition.commitment);
    }
  }, 120_000);
});

/**
 * One hostile case per authenticated transcript field that NEITHER capstone attacks.
 *
 * C1 attacks no transcript byte at all: its seven substitutions move route arguments, state commitments,
 * satoshi amounts and event NFTs. C3 attacks two fields - a participant row's locking bytecode, and an
 * invocation's parent+depth pair. Everything below is a field no capstone reaches.
 *
 * Every patch is length-preserving and re-rooted, so each attacked transcript is a self-consistent blob and
 * only a covenant can refuse it. The honest control is the build above.
 */
describe('A1 review: unattacked transcript fields', () => {
  const cases: {
    field: string;
    input: number;
    rewrite: Rewrite;
  }[] = [
    {
      // Participant frame: the physical base a row claims. Both covenants recompute the base as a running
      // prefix sum of block sizes, so a row that names any other base breaks the chain at that row.
      field: 'participant input base',
      input: INPUT.leaf,
      rewrite: (transcript) => patchTranscript(transcript, [{
        at: transcriptFields(transcript.bytes).participants[1].inputStart,
        bytes: Uint8Array.of(3, 0),
      }]),
    },
    {
      // Participant frame: block size, with a COMPENSATING shrink so the running prefix sum still lands on
      // the projection region. This is the only blockSize forgery that survives the region-end equality.
      field: 'block size (compensated)',
      input: INPUT.leaf,
      rewrite: (transcript) => {
        const frames = transcriptFields(transcript.bytes).participants;
        return patchTranscript(transcript, [
          { at: frames[1].blockSizeStart, bytes: Uint8Array.of(3, 0) },
          { at: frames[2].inputStart, bytes: Uint8Array.of(5, 0) },
          { at: frames[2].blockSizeStart, bytes: Uint8Array.of(1, 0) },
        ]);
      },
    },
    {
      // Participant frame: which proof slot verifies this row. Swapping two rows' projection inputs keeps
      // both slots occupied and the region consecutive; only the verifier's own identity check separates them.
      field: 'projection input slot',
      input: INPUT.projection0,
      rewrite: (transcript) => {
        const frames = transcriptFields(transcript.bytes).participants;
        return patchTranscript(transcript, [
          { at: frames[1].projectionInputStart, bytes: Uint8Array.of(11, 0) },
          { at: frames[2].projectionInputStart, bytes: Uint8Array.of(10, 0) },
        ]);
      },
    },
    {
      // Participant frame: where the returning participant publishes its result NFT. Moved to another output
      // inside its OWN block, so the controller's block-membership range check still passes.
      field: 'return output slot',
      input: INPUT.controller,
      rewrite: (transcript) => patchTranscript(transcript, [{
        at: transcriptFields(transcript.bytes).participants[3].returnOutputStart,
        bytes: Uint8Array.of(7, 0),
      }]),
    },
    {
      // Participant frame: the aggregate result vector the return NFT commits to.
      field: 'participant result vector',
      input: INPUT.projection3,
      rewrite: (transcript) => {
        const frame = transcriptFields(transcript.bytes).participants[3];
        const forged = Uint8Array.from(
          transcript.bytes.subarray(frame.resultStart, frame.resultStart + frame.resultLength),
        );
        forged[forged.length - 1] ^= 0x01;
        return patchTranscript(transcript, [{ at: frame.resultStart, bytes: forged }]);
      },
    },
    {
      // Participant frame: the SCB1 execution blob. The controller compares it byte for byte against the
      // pushdata the owner's route actually carries.
      field: 'batch blob',
      input: INPUT.leaf,
      rewrite: (transcript) => {
        const frame = transcriptFields(transcript.bytes).participants[1];
        const forged = Uint8Array.from(
          transcript.bytes.subarray(frame.batchStart, frame.batchStart + frame.batchLength),
        );
        forged[forged.length - 1] ^= 0x01;
        return patchTranscript(transcript, [{ at: frame.batchStart, bytes: forged }]);
      },
    },
    {
      // Participant frame: the emission region of a CALLER, transcript copy only.
      field: 'emission region (transcript copy)',
      input: INPUT.root,
      rewrite: (transcript) => {
        const frame = transcriptFields(transcript.bytes).participants[0];
        const forged = Uint8Array.from(
          transcript.bytes.subarray(frame.emissionsStart, frame.emissionsStart + frame.emissionsLength),
        );
        forged[frame.emissionsLength - 1] ^= 0x01;
        return patchTranscript(transcript, [{ at: frame.emissionsStart, bytes: forged }]);
      },
    },
    {
      // Participant frame: the logical CALLER region - the field that authenticates `msg.sender`. Patched in
      // BOTH copies the attacker owns, so this is not a self-inflicted mismatch. The leaf is told the ORACLE
      // called it rather than the root.
      field: 'logical caller region (both copies)',
      input: INPUT.projection1,
      rewrite: (transcript) => {
        const frames = transcriptFields(transcript.bytes).participants;
        const impersonator = transcript.bytes.subarray(
          frames[3].lbcLengthStart, frames[3].lbcStart + frames[3].lbcLength,
        );
        expect(impersonator.length).toBe(frames[1].callersLength);
        const forged = Uint8Array.from(impersonator);
        return withCallerBlob(
          patchTranscript(transcript, [{ at: frames[1].callersStart, bytes: forged }]), 1, forged,
        );
      },
    },
    {
      // Invocation frame: which participant an edge reaches. Retargeting invocation 1 from the leaf to the
      // broker leaves the leaf uncalled. MEASURED ORDERING, not an attribution: the refusal lands on the
      // CALLER's own proof slot, where the canonical emission row is rebuilt and compared inside the walk.
      // The verifier's whole-table exhaustion mask (`usedMask == allUsed`) runs only after that loop, so this
      // case is not evidence about the mask - see the note under this block.
      field: 'invocation callee',
      input: INPUT.projection0,
      rewrite: (transcript) => patchTranscript(transcript, [{
        at: transcriptFields(transcript.bytes).invocations[1].calleeStart,
        bytes: Uint8Array.of(2),
      }]),
    },
    {
      // Invocation frame: the owner-local journal row an edge claims.
      field: 'invocation local row',
      input: INPUT.projection2,
      rewrite: (transcript) => patchTranscript(transcript, [{
        at: transcriptFields(transcript.bytes).invocations[2].localRowStart,
        bytes: Uint8Array.of(1),
      }]),
    },
    {
      // Invocation frame: the inclusive end of a subtree. Shrinking invocation 2's subtree end to itself
      // leaves invocation 3 - its own child - outside the frame that is supposed to contain it.
      field: 'invocation subtree end',
      input: INPUT.controller,
      rewrite: (transcript) => patchTranscript(transcript, [{
        at: transcriptFields(transcript.bytes).invocations[2].subtreeEndStart,
        bytes: Uint8Array.of(2, 0),
      }]),
    },
    {
      // Invocation frame: the method selector.
      field: 'invocation selector',
      input: INPUT.projection0,
      rewrite: (transcript) => {
        const frame = transcriptFields(transcript.bytes).invocations[1];
        const forged = Uint8Array.from(
          transcript.bytes.subarray(frame.selectorStart, frame.selectorStart + 4),
        );
        forged[0] ^= 0x01;
        return patchTranscript(transcript, [{ at: frame.selectorStart, bytes: forged }]);
      },
    },
    {
      // Invocation frame: the call-options byte. Setting bit 0 claims the read-only (`staticcall`) mode on a
      // row the caller's compiled route emitted as an ordinary call. Bits 1-7 are unreachable from here:
      // `require(callOptions <= 1)` in the projection verifier refuses them before any comparison runs, so
      // this case attacks the only bit that has a defined honest value to disagree with.
      field: 'invocation call options (read-only bit)',
      input: INPUT.projection0,
      rewrite: (transcript) => patchTranscript(transcript, [{
        at: transcriptFields(transcript.bytes).invocations[1].callOptionsStart,
        bytes: Uint8Array.of(1),
      }]),
    },
    {
      // Invocation frame: the encoded arguments.
      field: 'invocation arguments',
      input: INPUT.projection0,
      rewrite: (transcript) => {
        const frame = transcriptFields(transcript.bytes).invocations[1];
        const forged = Uint8Array.from(
          transcript.bytes.subarray(frame.argsStart, frame.argsStart + frame.argsLength),
        );
        forged[forged.length - 1] ^= 0x01;
        return patchTranscript(transcript, [{ at: frame.argsStart, bytes: forged }]);
      },
    },
    {
      // Invocation frame: the per-edge result bytes.
      field: 'invocation result',
      input: INPUT.projection2,
      rewrite: (transcript) => {
        const frame = transcriptFields(transcript.bytes).invocations[3];
        const forged = Uint8Array.from(
          transcript.bytes.subarray(frame.resultStart, frame.resultStart + frame.resultLength),
        );
        forged[forged.length - 1] ^= 0x01;
        return patchTranscript(transcript, [{ at: frame.resultStart, bytes: forged }]);
      },
    },
    {
      // Invocation frame: parent ALONE. C3's disjoint-root moves parent and depth together; this moves only
      // the parent, so invocation 3 claims the root called it while still declaring depth 2.
      field: 'invocation parent alone',
      input: INPUT.controller,
      rewrite: (transcript) => patchTranscript(transcript, [{
        at: transcriptFields(transcript.bytes).invocations[3].parentStart,
        bytes: Uint8Array.of(0, 0),
      }]),
    },
    {
      // Invocation frame: depth ALONE, with the honest parent left in place.
      field: 'invocation depth alone',
      input: INPUT.projection0,
      rewrite: (transcript) => patchTranscript(transcript, [{
        at: transcriptFields(transcript.bytes).invocations[3].depthStart,
        bytes: Uint8Array.of(1),
      }]),
    },
  ];

  it.each(cases)('HOSTILE: forging the $field is rejected at input $input', async (
    { field, input, rewrite },
  ) => {
    const attacked = await buildA1(rewrite);
    // Length-preserving: the attacked transcript differs from the honest one this build derived first only
    // in the named field's own bytes.
    expect(patchedByteIndices(attacked).length).toBeGreaterThan(0);
    void field;
    expect(failingInput(attacked)).toBe(input);
    await expect(attacked.provider.sendRawTransaction(attacked.transaction)).rejects.toThrow();
  }, 120_000);

  // EVIDENCE LIMIT, recorded rather than claimed away. Every forgery above is refused, but the projection
  // verifier's four exhaustion assertions - `usedMask == allUsed`, `batchCursor == ownerBatch.length`,
  // `emissionCursor == ownerEmissions.length` and `callerCursor == ownerCallers.length` - all run AFTER the
  // invocation loop. In every shape this fixture can build, a comparison inside that loop rejects first, so
  // none of these cases isolates an exhaustion assertion. They are system-level evidence that no field is
  // unbound; they are not evidence about the exhaustion assertions on their own. This is the same structural
  // caveat X23 recorded for the emission comparison.
});

/**
 * The ROOT invocation's caller row - the transcript's `tx.origin` binding - which no capstone reaches.
 *
 * `finalizeCompiledGraph` defaults `rootCallerLockingBytecode` to `''`, so every committed graph fixture
 * encodes an EMPTY root caller row and takes the verifier's `logicalCallerLength == 0 ||` early-out. The
 * binding therefore exists but has never been exercised by a settling fixture.
 */
describe('A1 review: the root caller row and its tx.origin binding', () => {
  it('every committed fixture leaves the root caller row EMPTY, so the binding is never reached', async () => {
    const built = await buildA1();
    // Participant 0 is the root's owner; its callers region holds exactly one row, for invocation 0.
    // The region holds exactly one row for invocation 0, and that row is a two-byte ZERO-LENGTH frame, so
    // the verifier's `logicalCallerLength == 0 ||` early-out is what every committed fixture takes.
    expect(built.fields.participants[0].callersLength).toBe(2);
    expect(built.transcript.participantCallersHex[0]).toBe('0000');
    // Every non-root participant carries a real 35-byte framed caller row, so the region is otherwise used.
    for (const participant of [1, 2, 3]) {
      expect(built.fields.participants[participant].callersLength).toBe(37);
    }
  }, 120_000);

  it('HOSTILE: a non-empty root caller row that is not tx.origin is rejected', async () => {
    // Give the root a caller row naming the leaf, in both copies the attacker owns. This is the shape the
    // `== tx.origin` require exists for, and the first case anywhere to reach it.
    const built = await buildA1((transcript) => {
      const frames = transcriptFields(transcript.bytes).participants;
      const framedLeaf = transcript.bytes.slice(
        frames[1].lbcLengthStart, frames[1].lbcStart + frames[1].lbcLength,
      );
      expect(framedLeaf.length).toBe(37);
      return replaceCallers(transcript, 0, framedLeaf);
    });
    expect(built.transcript.participantCallersHex[0].length).toBe(74);
    expect(failingInput(built)).toBe(INPUT.projection0);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 120_000);
});

/**
 * What an "identical control" can and cannot mean for a fixture built twice.
 *
 * C1's hostile matrix compares an attacked build against a control produced by a SECOND call to the same
 * builder, and asserts the two serialize to the same LENGTH. C1's own comment goes further and states that
 * "every other byte of the transaction is identical to the `none` control produced by the same function".
 * These builders draw fresh outpoints and mint fresh token categories per call, so that stronger statement
 * cannot hold. This test measures it on a fixture that uses exactly the same helpers.
 */
describe('A1 review: what a same-length control proves', () => {
  it('two honest builds are the same LENGTH but are NOT the same bytes', async () => {
    const first = await buildA1();
    const second = await buildA1();

    // Same length: this is the property that supports "no input, output or witness was added or removed".
    expect(second.transaction.length).toBe(first.transaction.length);

    // Not the same bytes: fresh categories and fresh outpoints per build. A same-length control is therefore
    // evidence about SHAPE, and is not evidence that only the named field differs.
    expect(second.transaction).not.toBe(first.transaction);
    let differing = 0;
    for (let index = 0; index < first.transaction.length; index += 1) {
      if (first.transaction[index] !== second.transaction[index]) differing += 1;
    }
    expect(differing).toBeGreaterThan(first.transaction.length / 100);
    // The transcripts differ too, for the same reason - which is why every byte-level claim in this file is
    // measured against the honest transcript of the SAME build.
    expect(binToHex(second.honestTranscript.bytes)).not.toBe(binToHex(first.honestTranscript.bytes));
  }, 240_000);
});

/**
 * Preservation of the settled resource itself, with an entirely honest transcript.
 *
 * C1 attacks a satoshi amount, a state commitment and an event NFT's destination. Neither capstone attacks a
 * token CATEGORY or a token CAPABILITY, and neither moves a state NFT out of its own covenant. Each case below
 * changes exactly one property of exactly one settled output and nothing else.
 */
describe('A1 review: state and resource preservation', () => {
  const cases: { property: string; physical: Physical; input: number }[] = [
    { property: 'master NFT capability', physical: 'master-capability', input: INPUT.leaf },
    { property: 'master NFT category', physical: 'master-category', input: INPUT.root },
    { property: 'master output value', physical: 'master-value', input: INPUT.leaf },
    { property: 'data NFT locking bytecode', physical: 'data-locking-bytecode', input: INPUT.leaf },
    { property: 'data NFT state commitment', physical: 'data-commitment', input: INPUT.leaf },
    { property: 'return-event NFT capability', physical: 'return-capability', input: INPUT.oracle },
    // The 1,000-satoshi slot value is often described as an SDK assembly convention. For the two SIDECAR
    // slot kinds it is not: both generated covenants require `tx.outputs[activeInputIndex].value == 1000`
    // for their own continuation output, so paying 1,200 there is refused by the covenant itself.
    // These two are now ALSO refused structurally, before the VM, because the derived block assembly names
    // its auxiliary slots (X32/L2 FINDING 2); `failingInput` evaluates each input to keep pinning the covenant.
    { property: 'projection slot 1,000-satoshi value', physical: 'projection-slot-value', input: INPUT.projection0 },
    { property: 'controller slot 1,000-satoshi value', physical: 'controller-slot-value', input: INPUT.controller },
  ];

  // NOTE for the review record: unlike C1's matrix, the covenant that refuses is not always the one that owns
  // the field. Re-branding the leaf's master output with the root's token category is refused at input 0, the
  // ROOT's route, before the leaf's own route at input 2 is ever reached.
  it.each(cases)('HOSTILE: not preserving the $property is rejected at input $input', async (
    { physical, input },
  ) => {
    const control = await buildA1();
    expect(preflightOutcome(control)).toBe('ACCEPTED');

    const built = await buildA1(undefined, physical);
    // The transcript is byte-identical to an honest one: only a physical output property moved.
    expect(patchedByteIndices(built)).toEqual([]);
    expect(built.transaction.length).toBe(control.transaction.length);
    expect(failingInput(built)).toBe(input);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 240_000);
});

/**
 * C3's `duplicate-owner` case is scoped by its author as a TABLE-LEVEL forgery. This section asks the
 * narrower question a reviewer has to ask: does the DUPLICATION contribute anything to the refusal?
 */
describe('A1 review: C3 duplicate-owner - what the refusal is actually caused by', () => {
  /** Row 3's locking bytecode is replaced by row 1's. This is C3's duplicate-owner construction. */
  const duplicate: Rewrite = (transcript) => {
    const frames = transcriptFields(transcript.bytes).participants;
    expect(frames[3].lbcLength).toBe(frames[1].lbcLength);
    return patchTranscript(transcript, [{
      at: frames[3].lbcStart,
      bytes: transcript.bytes.slice(frames[1].lbcStart, frames[1].lbcStart + frames[1].lbcLength),
    }]);
  };
  /**
   * CONTROL. Row 3's locking bytecode is replaced by a well-formed p2sh32 script that belongs to NO
   * participant, so the table still names four distinct owners. Same field, same byte count, same offsets -
   * the only thing removed is the duplication itself.
   */
  const stranger: Rewrite = (transcript) => {
    const frames = transcriptFields(transcript.bytes).participants;
    const lbc = hexToBin(`aa20${'5c'.repeat(32)}87`);
    expect(lbc.length).toBe(frames[3].lbcLength);
    return patchTranscript(transcript, [{ at: frames[3].lbcStart, bytes: lbc }]);
  };

  it('the duplicate and a NON-duplicate stranger are refused identically, at the same input', async () => {
    const duplicated = await buildA1(duplicate);
    const strange = await buildA1(stranger);

    // Both are the same 35-byte, length-preserving edit to the same field of the same row.
    const duplicatedBytes = patchedByteIndices(duplicated);
    const strangeBytes = patchedByteIndices(strange);
    const frame = duplicated.fields.participants[3];
    for (const differing of [duplicatedBytes, strangeBytes]) {
      // R3-11. NON-EMPTINESS FIRST. `every` over an empty array is `true`, so a no-op rewrite satisfied the
      // locality claim, and the distinctness checks below would ALSO pass on an unpatched honest transcript -
      // no backstop. `:854` in this same file already writes the assertion this way.
      expect(differing.length, 'the rewrite changed NOTHING, so byte locality proves nothing')
        .toBeGreaterThan(0);
      expect(differing.every((index) =>
        index >= frame.lbcStart && index < frame.lbcStart + frame.lbcLength)).toBe(true);
    }

    // The duplicate really is a duplicate, and the stranger really is not.
    const rowLbc = (built: BuiltA1, index: number): string => binToHex(built.transcript.bytes.slice(
      built.fields.participants[index].lbcStart,
      built.fields.participants[index].lbcStart + built.fields.participants[index].lbcLength,
    ));
    expect(rowLbc(duplicated, 3)).toBe(rowLbc(duplicated, 1));
    expect(new Set([0, 1, 2, 3].map((index) => rowLbc(duplicated, index))).size).toBe(3);
    expect(new Set([0, 1, 2, 3].map((index) => rowLbc(strange, index))).size).toBe(4);

    // FINDING. Both are refused at the SAME input, by the SAME covenant, with the same class of failure.
    // The refusal is caused by the row naming a locking bytecode other than the one physically co-spent at
    // that base - the identical invariant the omission case attacks - and not by two rows naming one owner.
    expect(failingInput(duplicated)).toBe(INPUT.oracle);
    expect(failingInput(strange)).toBe(INPUT.oracle);
    await expect(duplicated.provider.sendRawTransaction(duplicated.transaction)).rejects.toThrow();
    await expect(strange.provider.sendRawTransaction(strange.transaction)).rejects.toThrow();
  }, 240_000);

  it('no covenant compares participant rows to each other: owner uniqueness is an SDK-only rule', async () => {
    // Both generated covenants bind each row to the input at its own base, and neither ever compares two
    // rows. The only uniqueness rule in the deployed system lives in the SDK planner.
    const projectionSource = layer3.generateGraphProjectionVerifier();
    const controllerSource = layer3.generateGraphRootController('51');
    // R3-10. THE DETECTOR IS CONTROLLED BEFORE IT IS TRUSTED. The previous version bound a local `comparisons`,
    // used it only to derive `pairwise`, and never asserted it was non-empty - so a generator that emitted
    // comparisons differently would have yielded `[]` and passed, which is the same shape as the vacuity it
    // replaced. A count floor alone still would not say the detector can SEE a pairwise comparison, so the
    // control is a synthetic source that IS one, plus a near-miss that must not be flagged. Detector shared with
    // `Layer3BoundedMaximumGraphC3.test.ts` via `layer3-pairwise-guard.ts`, which is where the two blind spots
    // it closes are written down.
    expect(scanComparisons(SYNTHETIC_PAIRWISE_SOURCE).pairwise,
      'the detector cannot see a pairwise participant comparison, so its verdict below is worthless')
      .toHaveLength(1);
    expect(scanComparisons(SYNTHETIC_BASE_BINDING_SOURCE).pairwise,
      'the detector flags the HONEST base binding as pairwise, so it over-reports').toEqual([]);
    // X134. THE HOLE THE LOCKING-BYTECODE VOCABULARY LEFT OPEN, reproduced first and closed second. Two table
    // rows compared to each other with NEITHER side naming a locking bytecode were silent under the rule
    // above, and both halves are asserted so the hole stays recorded rather than merely patched.
    for (const hostile of [SYNTHETIC_ROW_PAIRWISE_SOURCE, SYNTHETIC_ROW_TABLE_SOURCE]) {
      expect(scanComparisons(hostile).pairwise,
        'the locking-bytecode rule now sees the row-to-row shape, so X134 is no longer the hole it was and '
        + 'this reproduction has stopped reproducing').toEqual([]);
      expect(scanComparisons(hostile).rowPairwise,
        'the row rule cannot see a row-to-row comparison, so its verdict below is worthless').toHaveLength(1);
    }
    expect(scanComparisons(SYNTHETIC_ROW_NEAR_MISS_SOURCE).rowPairwise,
      'the row rule flags a legitimate row comparison, so it over-reports').toEqual([]);
    for (const source of [projectionSource, controllerSource]) {
      expect(source).toContain('lockingBytecode');
      const scan = scanComparisons(source);
      expect(scan.comparisons.length, 'the splitter found no comparison clause at all').toBeGreaterThan(20);
      expect(scan.mentioningLbc, 'no comparison mentions a participant locking bytecode, so the both-sides '
        + 'filter is running over a population that cannot contain a hit').not.toEqual([]);
      expect(scan.pairwise, `pairwise participant comparison in:\n${scan.pairwise.join('\n')}`).toEqual([]);
      // X134 liveness, the row rule's own version of the assertion above: the derivation found more than the
      // seed, and there is a population of comparisons carrying transcript bytes for the both-sides filter to
      // run over. Either at zero would mean the row verdict is being read off an empty set.
      expect(scan.rowDerived.length, 'the derivation found only the seed, so nothing propagated and the row '
        + 'rule is running over a vocabulary that cannot match').toBeGreaterThan(1);
      expect(scan.mentioningRow, 'no comparison carries transcript bytes, so the row both-sides filter is '
        + 'running over a population that cannot contain a hit').not.toEqual([]);
      expect(scan.rowPairwise, `row-to-row comparison in:\n${scan.rowPairwise.join('\n')}`).toEqual([]);
      // MUTATION CONTROL ON THE REAL SOURCE. One row-to-row comparison added to the generated participant
      // loop and nothing else: the detector must see it HERE, not only in sources this guard wrote. The
      // injector throws when its anchor is gone, so the control cannot outlive its subject.
      expect(scanComparisons(injectPairwiseComparison(source)).rowPairwise,
        'one row-to-row comparison injected into the REAL covenant is invisible to the detector').toHaveLength(1);
      // And the old identifiers really are gone, so a future reader cannot mistake the detector above for the
      // regex that used to run here.
      expect(/participantLbc\d/.test(source)).toBe(false);
    }
    // The controller's own-script preservation at its own index is the ONE both-sides comparison in the tree
    // and is exempted by name; asserted present so the exemption cannot rot into dead text.
    expect(scanComparisons(controllerSource).exempted,
      'the named self-preservation exemption matches nothing now, so it should be deleted').toHaveLength(1);
    // X134's exemptions, the same way: every comparison carrying transcript bytes on both sides is named, and
    // each name is asserted at its EXACT clause count. All five clauses are in the projection verifier; a
    // sixth landing under an existing name would otherwise be absorbed silently, which is the failure this
    // guard exists to prevent.
    const projectionScan = scanComparisons(projectionSource);
    expect(projectionScan.rowBothSides).toHaveLength(5);
    expect(scanComparisons(controllerSource).rowBothSides).toEqual([]);
    for (const exemption of ROW_COMPARISON_EXEMPTIONS) {
      expect(projectionScan.rowExempted[exemption.name],
        `the row exemption "${exemption.name}" matches nothing now, so it should be deleted`)
        .toBe(exemption.count);
    }
    const built = await buildA1();
    expect(new Set(built.participantLbc).size).toBe(4);
  }, 120_000);
});

/**
 * C3's `disjoint-root` case leaves the caller's emission row for the re-rooted edge in place, and its scope
 * note says that stripping the row too "changes the transcript's length and is the omission case above".
 * This section tests that claim.
 */
describe('A1 review: C3 disjoint-root - is stripping the emission row separable?', () => {
  /** Invocation 3 is re-presented as a second root: parent 0xffff at depth 0. C3's three-byte edit. */
  const disjointRoot: Rewrite = (transcript) => {
    const frame = transcriptFields(transcript.bytes).invocations[3];
    return patchTranscript(transcript, [
      { at: frame.parentStart, bytes: Uint8Array.of(0xff, 0xff) },
      { at: frame.depthStart, bytes: Uint8Array.of(0) },
    ]);
  };
  /**
   * The same re-rooting, PLUS the broker's emission row for that edge removed from both copies the attacker
   * owns. A second root has no caller, so an emission row answering it is exactly the leftover C3 names.
   */
  const disjointRootStripped: Rewrite = (transcript) => {
    const rerooted = disjointRoot(transcript);
    // The broker emits exactly one row - the edge being re-rooted - so the honest strip is the empty region.
    expect(rerooted.participantEmissionsHex[2].length).toBeGreaterThan(0);
    return replaceEmissions(rerooted, 2, new Uint8Array(0));
  };

  it('C3 reproduces: the three-byte re-rooting is refused at the first projection proof', async () => {
    const attacked = await buildA1(disjointRoot);
    const frame = attacked.fields.invocations[3];
    expect(patchedByteIndices(attacked))
      .toEqual([frame.parentStart, frame.parentStart + 1, frame.depthStart]);
    expect(failingInput(attacked)).toBe(INPUT.projection0);
    await expect(attacked.provider.sendRawTransaction(attacked.transaction)).rejects.toThrow();
  }, 120_000);

  it('stripping the leftover emission row too is a DIFFERENT refusal, at a different input', async () => {
    const attacked = await buildA1(disjointRootStripped);
    // The transcript is now shorter, so this is not a length-preserving edit - which is precisely what C3's
    // scope note says makes it "the omission case". It is not: no participant block is replaced by funding,
    // every one of the four owners still executes its own route, and the refusal names a different input.
    expect(attacked.transcript.bytes.length)
      .toBeLessThan(attacked.honestTranscript.bytes.length);
    expect(attacked.transcript.participantEmissionsHex[2]).toBe('');
    expect(failingInput(attacked)).toBe(INPUT.broker);
    await expect(attacked.provider.sendRawTransaction(attacked.transaction)).rejects.toThrow();
  }, 120_000);
});
