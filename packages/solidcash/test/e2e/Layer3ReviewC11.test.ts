import {
  type AuthenticationProgramStateCommon,
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, sha256,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { Utxo } from '../../src/interfaces.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Round-11 independent hostile review of X23, X27, E2 and E4 (all Worker B's).
//
// THE INSTRUMENT. `layer3.preflightLayer3Transaction` throws on the FIRST failing input, so a forgery whose
// system-level rejection happens at input 0 says nothing about whether input 4 would also have rejected it.
// X23's author recorded exactly that limit for the rewritten emission comparison and reported three failed
// fixture attempts at isolating it. The isolation is not a fixture problem: script evaluation for one input
// does not read another input's unlocking bytecode (the projection verifier never touches
// `tx.inputs[i].unlockingBytecode` - only `attest` does), so evaluating each input SEPARATELY on the same
// transaction isolates each covenant. `evaluateEachInput` does that.
const evaluateEachInput = (builder: TransactionBuilder): (string | null)[] => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs as never);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.map((_input, inputIndex) => {
    const state = vm.evaluate({
      inputIndex, sourceOutputs, transaction,
    }) as AuthenticationProgramStateCommon;
    return state.error ?? null;
  });
};

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedScalar = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const packedBytes = (value: Uint8Array): Uint8Array => scriptToBytecode([value]);
const fixedUtxo = (slot: number, satoshis: bigint): Utxo => randomUtxo({
  satoshis, vout: 0, txid: slot.toString(16).padStart(2, '0').repeat(32),
});

const I_LEAF = 'interface IC11Leaf { function leaf(int seed) returns (int); }';
const C11_LEAF = `pragma solidcash >=0.8.0;
contract C11Leaf(int brand) {
  function leaf(int seed) public pure returns (int) {
    require(seed > 0);
    return seed * 11;
  }
}`;
const C11_ROOT = `pragma solidcash >=0.8.0;
${I_LEAF}
contract C11Root(int brand, address peer) {
  function go(address target, int seed) public pure returns (int) {
    int value = IC11Leaf(target).leaf(seed);
    require(value > 0);
    return value + 1;
  }
}`;

const SEED = 2n;
const LEAF_VALUE = SEED * 11n;
const ROOT_VALUE = LEAF_VALUE + 1n;

/** Byte offset of one participant's emission payload inside the framed transcript. */
function emissionsOffset(transcript: layer3.FinalizedCompiledGraph, participant: number): number {
  const execution = transcript.plan.participants[participant];
  return transcript.participantOffsets[participant]
    + 2 + 2 + 2 + execution.lockingBytecode.length / 2 + 2 + execution.batch.blob.length + 2;
}

/**
 * Independent decoder of the framed transcript's region boundaries, derived from the plan rather than from
 * the covenant's own walk, so a hostile patch can be aimed at an exact absolute byte.
 */
function transcriptLayout(transcript: layer3.FinalizedCompiledGraph): {
  invocationRegion: number; rowOffsets: number[];
} {
  const last = transcript.plan.participants.length - 1;
  const execution = transcript.plan.participants[last];
  const frameLength = 2 + 2 + 2 + execution.lockingBytecode.length / 2
    + 2 + execution.batch.blob.length
    + 2 + transcript.participantEmissionsHex[last].length / 2
    + 2 + transcript.participantCallersHex[last].length / 2
    + 2 + 2 + transcript.participantResultVectorsHex[last].length / 2
    + 2;
  const invocationRegion = transcript.participantOffsets[last] + frameLength;
  const rowOffsets: number[] = [];
  let cursor = invocationRegion + 2;
  transcript.plan.invocations.forEach((invocation, index) => {
    rowOffsets.push(cursor);
    cursor += 16 + invocation.argsHex.length / 2 + transcript.resultsHex[index].length / 2;
  });
  return { invocationRegion, rowOffsets };
}

const recommit = (
  transcript: layer3.FinalizedCompiledGraph, bytes: Uint8Array,
  emissionsHex?: readonly string[],
): layer3.FinalizedCompiledGraph => Object.freeze({
  ...transcript,
  bytes,
  root: binToHex(sha256.hash(bytes)),
  ...(emissionsHex !== undefined && { participantEmissionsHex: Object.freeze([...emissionsHex]) }),
}) as layer3.FinalizedCompiledGraph;

/** Substitute one emission byte in BOTH the framed transcript and the blob the caller's own route is handed. */
function patchEmissionByte(
  transcript: layer3.FinalizedCompiledGraph, participant: number, index: number, value: number,
): layer3.FinalizedCompiledGraph {
  const bytes = new Uint8Array(transcript.bytes);
  bytes[emissionsOffset(transcript, participant) + index] = value;
  const emissions = hexToBin(transcript.participantEmissionsHex[participant]);
  emissions[index] = value;
  const emissionsHex = [...transcript.participantEmissionsHex];
  emissionsHex[participant] = binToHex(emissions);
  return recommit(transcript, bytes, emissionsHex);
}

/** Append one unanswered byte to a caller's emission region, growing its length frame to match. */
function appendEmissionByte(
  transcript: layer3.FinalizedCompiledGraph, participant: number,
): layer3.FinalizedCompiledGraph {
  const offset = emissionsOffset(transcript, participant);
  const emissions = hexToBin(transcript.participantEmissionsHex[participant]);
  const bytes = new Uint8Array(transcript.bytes.length + 1);
  bytes.set(transcript.bytes.subarray(0, offset + emissions.length), 0);
  bytes[offset + emissions.length] = 0x00;
  bytes.set(transcript.bytes.subarray(offset + emissions.length), offset + emissions.length + 1);
  const grown = emissions.length + 1;
  bytes[offset - 2] = grown & 0xff;
  bytes[offset - 1] = (grown >>> 8) & 0xff;
  const emissionsHex = [...transcript.participantEmissionsHex];
  emissionsHex[participant] = `${transcript.participantEmissionsHex[participant]}00`;
  return recommit(transcript, bytes, emissionsHex);
}

/** Substitute one absolute transcript byte, leaving every route blob alone. */
function patchTranscriptByte(
  transcript: layer3.FinalizedCompiledGraph, index: number, value: number,
): layer3.FinalizedCompiledGraph {
  const bytes = new Uint8Array(transcript.bytes);
  bytes[index] = value;
  return recommit(transcript, bytes);
}

function appendTranscriptByte(
  transcript: layer3.FinalizedCompiledGraph, value: number,
): layer3.FinalizedCompiledGraph {
  const bytes = new Uint8Array(transcript.bytes.length + 1);
  bytes.set(transcript.bytes, 0);
  bytes[transcript.bytes.length] = value;
  return recommit(transcript, bytes);
}

function truncateTranscript(transcript: layer3.FinalizedCompiledGraph): layer3.FinalizedCompiledGraph {
  return recommit(transcript, transcript.bytes.slice(0, transcript.bytes.length - 1));
}

interface GraphOverrides {
  results?: Readonly<Record<number, string>>;
  patch?: (transcript: layer3.FinalizedCompiledGraph) => layer3.FinalizedCompiledGraph;
}

/**
 * The committed X7 two-participant returning-root fixture, rebuilt here so the review's own hostile patches
 * are independent of the reviewed file's helpers.
 */
async function buildRootReturningGraph(overrides: GraphOverrides = {}): Promise<{
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  transcript: layer3.FinalizedCompiledGraph;
}> {
  const provider = createLayer3SemanticTestProvider();
  const projection = new Contract(
    compileString(layer3.generateGraphProjectionVerifier()), [], { provider },
  );
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

  const artifactLeaf = compileString(C11_LEAF, options);
  const baseLeaf = new Contract(artifactLeaf, [7n], { provider });
  const setupLeaf = await setupStatefulUtxos(provider, baseLeaf, artifactLeaf.stateLayout!, {});
  const leaf = baseLeaf.withCategory(hexToBin(setupLeaf.categoryId));

  const artifactRoot = compileString(C11_ROOT, options);
  const baseRoot = new Contract(artifactRoot, [1n, leaf.lockingBytecode], { provider });
  const setupRoot = await setupStatefulUtxos(provider, baseRoot, artifactRoot.stateLayout!, {});
  const root = baseRoot.withCategory(hexToBin(setupRoot.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: artifactRoot, lockingBytecode: root.lockingBytecode },
    { artifact: artifactLeaf, lockingBytecode: leaf.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'go', args: [leaf.lockingBytecode, SEED] },
    { parent: 0, callee: 1, function: 'leaf', args: [SEED] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);

  const vectorRoot = binToHex(packedScalar(ROOT_VALUE));
  const vectorLeaf = binToHex(packedScalar(LEAF_VALUE));
  const finalized = layer3.finalizeCompiledGraph(
    plan,
    { 0: vectorRoot, 1: vectorLeaf, ...(overrides.results ?? {}) },
    layout.participantInputs, layout.returnOutputs,
    [vectorRoot, vectorLeaf], layout.projectionInputs,
  );
  const transcript = overrides.patch === undefined ? finalized : overrides.patch(finalized);

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const initFee = fixedUtxo(0xe1, 20_000n);
  await provider.addUtxo(p2pkh.address, initFee);
  const initialize = new TransactionBuilder({ provider });
  initialize.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
  initialize.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(initialize));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
  if (!rootedController) throw new Error('graph controller initialization did not create the authority');

  const fee = fixedUtxo(0xe2, 120_000n);
  await provider.addUtxo(p2pkh.address, fee);
  const funding: Utxo[] = [];
  for (let slot = 0; slot < 2; slot += 1) {
    const utxo = fixedUtxo(0xf0 + slot, 1000n);
    await provider.addUtxo(p2pkh.address, utxo);
    funding.push(utxo);
  }
  const projectionUtxos: Utxo[] = [];
  for (let slot = 0; slot < 2; slot += 1) {
    const utxo = fixedUtxo(0xa0 + slot, 1000n);
    await provider.addUtxo(projection.address, utxo);
    projectionUtxos.push(utxo);
  }

  const routeOf = (
    contract: Contract, artifact: typeof artifactRoot,
  ): ReturnType<Contract['createCompilerRouteUnlocker']> => contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupRoot.masterUtxo, routeOf(root, artifactRoot)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![0]!),
  ));
  tx.addInput(funding[0], p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupLeaf.masterUtxo, routeOf(leaf, artifactLeaf)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![1]!),
  ));
  tx.addInput(funding[1], p2pkh.unlock.spend(alicePub, signature()));
  for (let participant = 0; participant < 2; participant += 1) {
    tx.addInput(projectionUtxos[participant], projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ));
  }
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const master = (contract: Contract, setup: any): any => ({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
  });
  const returnEvent = (setup: any, vector: string): any => ({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setup.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(packedBytes(hexToBin(vector))) },
    },
  });
  tx.addOutput(master(root, setupRoot));
  tx.addOutput(returnEvent(setupRoot, vectorRoot));
  tx.addOutput(master(leaf, setupLeaf));
  tx.addOutput(returnEvent(setupLeaf, vectorLeaf));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 40_000n });

  return { provider, builder: tx, transaction: raw(tx), transcript };
}

// Physical input map of the two-participant returning-root graph.
const INPUT = {
  masterRoot: 0, masterLeaf: 2, projectionRoot: 4, projectionLeaf: 5, controller: 6,
} as const;

// The emission row of the only emitted invocation: length frame [0,2), target [2,37), call mode 37,
// selector [38,42), args frame [42,44).
const EMISSION = {
  targetLengthFrame: 0, target: 5, callMode: 37, selector: 38,
} as const;

const scriptRefusalAt = (input: number): RegExp => new RegExp(
  `mandatory-script-verify-flag-failed .*error in evaluating input index ${input}:`,
);

describe('C-R11 / X23: the rewritten projection verifier, isolated from the caller route', () => {
  it('honest control: every input passes independently, and the graph settles', async () => {
    const built = await buildRootReturningGraph();
    expect(evaluateEachInput(built.builder)).toEqual(new Array(8).fill(null));
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 120_000);

  // ISOLATION. X23's file records that these forgeries refuse at input 0, the caller's own master route, and
  // states the verifier's comparison "cannot be isolated from this fixture". It can: the same transaction,
  // evaluated one input at a time, shows whether input 4 - the projection slot running the REWRITTEN
  // comparison - also refuses. The honest control above is the same fixture with this field untouched.
  it.each([
    { field: 'emitted target', index: EMISSION.target, value: 0x00 },
    { field: 'call mode', index: EMISSION.callMode, value: 0x01 },
    { field: 'selector', index: EMISSION.selector, value: 0x00 },
    { field: 'target length frame', index: EMISSION.targetLengthFrame, value: 0x22 },
  ])('the projection verifier itself refuses a forged $field', async ({ index, value }) => {
    const built = await buildRootReturningGraph({
      patch: (transcript) => patchEmissionByte(transcript, 0, index, value),
    });
    const results = evaluateEachInput(built.builder);
    // Recorded system-level result: the caller's own route refuses first.
    expect(results[INPUT.masterRoot]).not.toBe(null);
    // NEW: the rewritten one-slice comparison refuses the same forgery on its own.
    expect(results[INPUT.projectionRoot]).not.toBe(null);
    // The callee's projection slot has no emission region, so it must NOT be credited with the rejection.
    expect(results[INPUT.projectionLeaf]).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(INPUT.masterRoot));
  }, 120_000);

  it('the projection verifier itself refuses an emissions region no invocation exhausts', async () => {
    const built = await buildRootReturningGraph({ patch: (t) => appendEmissionByte(t, 0) });
    const results = evaluateEachInput(built.builder);
    expect(results[INPUT.masterRoot]).not.toBe(null);
    expect(results[INPUT.projectionRoot]).not.toBe(null);
    expect(results[INPUT.projectionLeaf]).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(INPUT.masterRoot));
  }, 120_000);

  // Attacks the `activeCallees` BYTE TABLE X23 substituted for the unrolled scalar frames plus if-chain.
  // Raising invocation 1's depth from 1 to 2 makes the verifier read frame slot 2, which no row has opened,
  // so the caller resolves to the 0xff sentinel and participant 0's emission row is never answered. Honest
  // control differs in exactly this byte.
  it('the frame byte table refuses a row whose depth names an unopened frame', async () => {
    const built = await buildRootReturningGraph({
      patch: (transcript) => patchTranscriptByte(
        transcript, transcriptLayout(transcript).rowOffsets[1] + 4, 0x02,
      ),
    });
    const results = evaluateEachInput(built.builder);
    expect(results[INPUT.projectionRoot]).not.toBe(null);
    expect(results[INPUT.controller]).not.toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(INPUT.projectionRoot));
  }, 120_000);

  // Attacks the `usedMask` BYTE TABLE X23 substituted for the eight `participantUsed` booleans and the
  // participantCount-indexed require chain. Retargeting invocation 1 at callee 2 leaves participant 1 unused.
  it('the used-mask byte table refuses a callee outside the participant set', async () => {
    const built = await buildRootReturningGraph({
      patch: (transcript) => patchTranscriptByte(
        transcript, transcriptLayout(transcript).rowOffsets[1] + 2, 0x02,
      ),
    });
    const results = evaluateEachInput(built.builder);
    expect(results[INPUT.projectionRoot]).not.toBe(null);
    expect(results[INPUT.projectionLeaf]).not.toBe(null);
    expect(results[INPUT.controller]).not.toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(INPUT.projectionRoot));
  }, 120_000);
});

describe('C-R11 / X27: the suffix-split invariant in attest', () => {
  // X27's stated invariant is `frame.length == transcriptLength - cursor`, with the suffix split "always in
  // range because cursor <= transcriptLength is an invariant on entry to every iteration". Every case here
  // drives `cursor`/`tail` to or past that boundary and asserts the CONTROLLER input refuses.

  // The tight case: inflating invocationCount by one makes the extra iteration split at tail == length
  // EXACTLY. If the invariant were off by one this is where an out-of-range split would appear instead of a
  // clean length refusal.
  it('refuses an invocation count one past the rows the transcript holds', async () => {
    const built = await buildRootReturningGraph({
      patch: (transcript) => patchTranscriptByte(
        transcript, transcriptLayout(transcript).invocationRegion, 0x03,
      ),
    });
    const results = evaluateEachInput(built.builder);
    expect(results[INPUT.controller]).not.toBe(null);
    expect(results[INPUT.projectionRoot]).not.toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(INPUT.projectionRoot));
  }, 120_000);

  // Drives `cursor` into the invocation region: the third participant frame is parsed out of invocation
  // bytes, at an offset the honest path never reaches, and every bound there is frame-relative.
  it('refuses a participant count one past the frames the transcript holds', async () => {
    const built = await buildRootReturningGraph({ patch: (t) => patchTranscriptByte(t, 9, 0x03) });
    const results = evaluateEachInput(built.builder);
    expect(results[INPUT.controller]).not.toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(INPUT.projectionRoot));
  }, 120_000);

  // `require(lbcLength > 0 && 8 + lbcLength <= frame.length)` is the rewritten form of
  // `cursor + 8 + lbcLength <= transcript.length`. Participant 0's lbc length frame lives at offset 14.
  it('refuses a participant lbc length frame larger than its own suffix', async () => {
    const built = await buildRootReturningGraph({ patch: (t) => patchTranscriptByte(t, 15, 0xff) });
    const results = evaluateEachInput(built.builder);
    expect(results[INPUT.controller]).not.toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(INPUT.masterRoot));
  }, 120_000);

  it('refuses a transcript carrying one trailing byte no row claims', async () => {
    const built = await buildRootReturningGraph({ patch: (t) => appendTranscriptByte(t, 0x00) });
    const results = evaluateEachInput(built.builder);
    expect(results[INPUT.controller]).not.toBe(null);
    expect(results[INPUT.projectionRoot]).not.toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(INPUT.projectionRoot));
  }, 120_000);

  it('refuses a transcript truncated by one byte', async () => {
    const built = await buildRootReturningGraph({ patch: (t) => truncateTranscript(t) });
    const results = evaluateEachInput(built.builder);
    expect(results[INPUT.controller]).not.toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(INPUT.projectionRoot));
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------------------
// E4 and E2 share one two-participant, one-slot-per-block fixture: neither handler writes state, returns a
// value, or emits, so the physical map is masterRoot 0, masterChild 1, projection 2/3, controller 4, fee 5.
// ---------------------------------------------------------------------------------------------------------

/** Alice's BARE P2PKH locking bytecode - 25 bytes, which is what `tx.origin` scans for. */
const bareP2pkhLbc = (pkh: Uint8Array): string => `76a914${binToHex(pkh)}88ac`;

interface PairOverrides {
  /** `bare` funds the fee slot from a real 25-byte P2PKH; `p2sh` funds it from the repo's P2SH artifact. */
  origin?: 'bare' | 'p2sh';
  rootCaller?: string;
  rootArgs?: readonly any[];
  childArgs?: readonly any[];
}

async function buildPairGraph(
  rootSource: string, childSource: string, childFunction: string, overrides: PairOverrides = {},
): Promise<{
    provider: ReturnType<typeof createLayer3SemanticTestProvider>;
    builder: TransactionBuilder;
    transaction: string;
    rootArtifact: any;
    childArtifact: any;
  }> {
  const provider = createLayer3SemanticTestProvider();
  const projection = new Contract(
    compileString(layer3.generateGraphProjectionVerifier()), [], { provider },
  );
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

  const childArtifact = compileString(childSource, options);
  const baseChild = new Contract(childArtifact, [7n], { provider });
  const setupChild = await setupStatefulUtxos(provider, baseChild, childArtifact.stateLayout!, {});
  const child = baseChild.withCategory(hexToBin(setupChild.categoryId));

  const rootArtifact = compileString(rootSource, options);
  const baseRoot = new Contract(rootArtifact, [1n, child.lockingBytecode], { provider });
  const setupRoot = await setupStatefulUtxos(provider, baseRoot, rootArtifact.stateLayout!, {});
  const root = baseRoot.withCategory(hexToBin(setupRoot.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: rootArtifact, lockingBytecode: root.lockingBytecode },
    { artifact: childArtifact, lockingBytecode: child.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'go', args: overrides.rootArgs as any },
    { parent: 0, callee: 1, function: childFunction, args: overrides.childArgs as any },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    plan.participants.map(() => ''), layout.projectionInputs, overrides.rootCaller ?? '',
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const initFee = fixedUtxo(0xe1, 20_000n);
  await provider.addUtxo(p2pkh.address, initFee);
  const initialize = new TransactionBuilder({ provider });
  initialize.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
  initialize.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(initialize));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
  if (!rootedController) throw new Error('graph controller initialization did not create the authority');

  const projectionUtxos: Utxo[] = [];
  for (let slot = 0; slot < 2; slot += 1) {
    const utxo = fixedUtxo(0xa0 + slot, 1000n);
    await provider.addUtxo(projection.address, utxo);
    projectionUtxos.push(utxo);
  }
  const fee = fixedUtxo(0xe2, 120_000n);
  const bareOrigin = (overrides.origin ?? 'p2sh') === 'bare';
  await provider.addUtxo(bareOrigin ? aliceAddress : p2pkh.address, fee);

  const routeOf = (
    contract: Contract, artifact: any,
  ): ReturnType<Contract['createCompilerRouteUnlocker']> => contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupRoot.masterUtxo, routeOf(root, rootArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  tx.addInput(setupChild.masterUtxo, routeOf(child, childArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  for (let participant = 0; participant < 2; participant += 1) {
    tx.addInput(projectionUtxos[participant], projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ));
  }
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, bareOrigin ? signature().unlockP2PKH() : p2pkh.unlock.spend(alicePub, signature()));

  const master = (contract: Contract, setup: any): any => ({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
  });
  tx.addOutput(master(root, setupRoot));
  tx.addOutput(master(child, setupChild));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 40_000n });

  return { provider, builder: tx, transaction: raw(tx), rootArtifact, childArtifact };
}

const PAIR = { masterRoot: 0, masterChild: 1, projectionRoot: 2, projectionChild: 3, controller: 4 } as const;

const CTX_CHILD = `pragma solidcash >=0.8.0;
contract C11CtxChild(int brand) {
  function observe(int n) public pure { require(n >= 0); }
}`;
// A root that does NOT read msg.sender: the arm that isolates the transcript-side tx.origin binding.
const CTX_ROOT_PLAIN = `pragma solidcash >=0.8.0;
interface IC11CtxChild { function observe(int n); }
contract C11CtxRoot(int brand, address peer) {
  function go(int n, address expectedSender) public pure {
    require(expectedSender.length >= 0);
    IC11CtxChild(peer).observe(n);
    require(n >= 0);
  }
}`;
// Byte-identical apart from ONE token: the predicate reads msg.sender instead of the parameter, and it is a
// tautology, so nothing about the VALUE of msg.sender can be what refuses it.
const CTX_ROOT_READS_SENDER = CTX_ROOT_PLAIN
  .replace('require(expectedSender.length >= 0);', 'require(msg.sender.length >= 0);');

describe('C-R11 / E4: the open row - a ROOT caller frame and tx.origin', () => {
  // E4 attributes the open row to the repository's P2PKH fixture being a P2SH contract. That obstacle is a
  // fixture choice and it is removable: `SignatureTemplate.unlockP2PKH()` spends a real 25-byte P2PKH script,
  // and `emitTxOrigin` scans for exactly `76a914<20>88ac` on a non-self, non-token input. With one present,
  // the projection verifier's NON-EMPTY root-caller branch - `logicalCaller == tx.origin` - is satisfied
  // positively for the first time; every committed case took the empty-frame branch or refused.
  it('a non-empty root caller frame equal to tx.origin settles', async () => {
    const origin = bareP2pkhLbc(alicePkh);
    const built = await buildPairGraph(CTX_ROOT_PLAIN, CTX_CHILD, 'observe', {
      origin: 'bare', rootCaller: origin, rootArgs: [3n, hexToBin(origin)], childArgs: [3n],
    });
    expect(evaluateEachInput(built.builder)).toEqual(new Array(6).fill(null));
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 120_000);

  // Honest control differing in exactly one field: the root caller frame names a well-formed P2PKH that is
  // not the origin, while a real origin IS present. E4's committed hostile case could not separate "not the
  // origin" from "no origin exists", because its fixture had no 25-byte input at all.
  it('refuses a root caller which is not the origin, while an origin exists', async () => {
    const notOrigin = `76a914${'ab'.repeat(20)}88ac`;
    const built = await buildPairGraph(CTX_ROOT_PLAIN, CTX_CHILD, 'observe', {
      origin: 'bare', rootCaller: notOrigin, rootArgs: [3n, hexToBin(notOrigin)], childArgs: [3n],
    });
    const results = evaluateEachInput(built.builder);
    expect(results[PAIR.projectionRoot]).not.toBe(null);
    expect(results[PAIR.masterRoot]).toBe(null);
    expect(results[PAIR.projectionChild]).toBe(null);
    expect(results[PAIR.controller]).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(PAIR.projectionRoot));
  }, 120_000);

  // The measurement that says the committed E4 hostile case was not discriminating: the SAME honest root
  // caller that settles above is refused once the only difference is that no 25-byte P2PKH input exists.
  it('refuses the honest root caller when no P2PKH input satisfies the origin scan', async () => {
    const origin = bareP2pkhLbc(alicePkh);
    const built = await buildPairGraph(CTX_ROOT_PLAIN, CTX_CHILD, 'observe', {
      origin: 'p2sh', rootCaller: origin, rootArgs: [3n, hexToBin(origin)], childArgs: [3n],
    });
    const results = evaluateEachInput(built.builder);
    expect(results[PAIR.projectionRoot]).not.toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(PAIR.projectionRoot));
  }, 120_000);

  // FINDING. Removing the P2PKH obstacle does not open the row, because a second obstacle E4 does not record
  // sits in front of it: a ROOT graph row whose handler READS msg.sender cannot execute at all. The
  // predicate here is a tautology over msg.sender, so no VALUE can be the reason, and the control above is
  // the same source with that one token replaced by a parameter. The refusal is at the root's own master
  // route (input 0) and it is a malformed-script failure, not a designed refusal:
  //   "Program called an OP_SPLIT operation with an invalid index. stack item length: 25;
  //    requested split index: 73."
  // measured on the honest 25-byte caller. It is caller-shape independent - every frame below refuses.
  it.each([
    { shape: 'the honest 25-byte origin', caller: bareP2pkhLbc(alicePkh) },
    { shape: 'a 35-byte p2sh32 participant', caller: `aa20${'ab'.repeat(32)}87` },
    { shape: 'a 20-byte payload', caller: 'ab'.repeat(20) },
    { shape: 'an empty frame', caller: '' },
  ])('a ROOT handler reading msg.sender is refused at its own route with $shape', async ({ caller }) => {
    const built = await buildPairGraph(CTX_ROOT_READS_SENDER, CTX_CHILD, 'observe', {
      origin: 'bare', rootCaller: caller, rootArgs: [3n, hexToBin(bareP2pkhLbc(alicePkh))], childArgs: [3n],
    });
    expect(evaluateEachInput(built.builder)[PAIR.masterRoot]).not.toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(PAIR.masterRoot));
  }, 120_000);

  // The exact failing operation, so the refusal is not read as a covenant decision.
  it('names the failure: an OP_SPLIT index taken against the authenticated caller', async () => {
    const origin = bareP2pkhLbc(alicePkh);
    const built = await buildPairGraph(CTX_ROOT_READS_SENDER, CTX_CHILD, 'observe', {
      origin: 'bare', rootCaller: origin, rootArgs: [3n, hexToBin(origin)], childArgs: [3n],
    });
    const transaction = built.builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs as never);
    const vm = createVirtualMachineBch2026ForProvider(built.builder.provider);
    const trace = (vm as any).debug({ inputIndex: PAIR.masterRoot, sourceOutputs, transaction });
    const failure = trace.find((state: any) => state.error !== undefined);
    expect(failure.error).toMatch(/OP_SPLIT operation with an invalid index/);
    expect(failure.error).toMatch(/stack item length: 25/);
  }, 120_000);
});

const SINK_CHILD = `pragma solidcash >=0.8.0;
contract C11Sink(int brand) {
  function take(int amount) public pure { require(amount > 0); }
}`;
const VALUE_OPTION_ROOT = `pragma solidcash >=0.8.0;
interface IC11Sink { function take(int amount); }
contract C11ValueRoot(int brand, address peer) {
  function go(int amount) public {
    IC11Sink(peer).take{value: amount}(amount);
    require(amount > 0);
  }
}`;
const OPTION_FREE_ROOT = VALUE_OPTION_ROOT
  .replace('C11ValueRoot', 'C11PlainRoot').replace('take{value: amount}', 'take');

const busOnly = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

describe('C-R11 / E2: do call options and iterated low-level calls fail closed for every spelling?', () => {
  // X31, CLOSED. The refusal used to live in `deriveCompiledGraphPlan` only, while `planCompiledGraph` - the
  // other public `layer3` planning entry point, and the one every committed capstone fixture (C1, C2, C3, X7,
  // E4) uses - carried no option check at all. Both now run the SAME refusal, so the diagnostic below is one
  // string produced by one function. Honest control: the same source with `{value: amount}` deleted.
  it('both planning entry points refuse the value option with the same diagnostic', () => {
    const withOption = compileString(VALUE_OPTION_ROOT, busOnly);
    const optionFree = compileString(OPTION_FREE_ROOT, busOnly);
    const sink = compileString(SINK_CHILD, busOnly);
    const rootLbc = `aa20${'cd'.repeat(32)}87`;
    const sinkLbc = `aa20${'ab'.repeat(32)}87`;
    expect(withOption.abi.find((fn) => fn.name === 'go')!.transferCount).toBe(1);
    expect(optionFree.abi.find((fn) => fn.name === 'go')!.transferCount).toBeUndefined();
    // The SCB1 route the graph actually executes is byte-identical between the two.
    expect(JSON.stringify(withOption.hiddenBatch)).toBe(JSON.stringify(optionFree.hiddenBatch));
    const expected = /declares 1 value option\(s\)\/transfer\(s\), which the transcript row does not bind/;
    expect(() => layer3.deriveCompiledGraphPlan({
      root: { artifact: withOption, lockingBytecode: rootLbc },
      function: 'go', args: [5n], targets: { IC11Sink: { artifact: sink, lockingBytecode: sinkLbc } },
    } as any)).toThrow(expected);
    const viaPlan = (): unknown => layer3.planCompiledGraph([
      { artifact: withOption, lockingBytecode: rootLbc },
      { artifact: sink, lockingBytecode: sinkLbc },
    ], [
      { parent: null, callee: 0, function: 'go', args: [5n] },
      { parent: 0, callee: 1, function: 'take', args: [5n] },
    ]);
    expect(viaPlan).toThrow(expected);
    // Honest control for the same entry point: the option-free source plans through it.
    expect(() => layer3.planCompiledGraph([
      { artifact: optionFree, lockingBytecode: rootLbc },
      { artifact: sink, lockingBytecode: sinkLbc },
    ], [
      { parent: null, callee: 0, function: 'go', args: [5n] },
      { parent: 0, callee: 1, function: 'take', args: [5n] },
    ])).not.toThrow();
  });

  // The end-to-end consequence, inverted. The option-bearing source used to SETTLE as a graph while the route
  // block it executes has no satoshi slot at all, so the promised value never moved. The compiler asymmetry
  // that made the drop invisible is unchanged; what changed is that the transaction can no longer be built.
  it('the value-option graph can no longer be assembled at all', async () => {
    const withOption = compileString(VALUE_OPTION_ROOT, busOnly);
    const direct = withOption.abi.find((fn) => fn.name === 'go')!;
    expect(direct.blockLayout!.slots.map((slot) => slot.kind))
      .toEqual(['master', 'satoshiContainer', 'transfer']);
    // The SCB1 route block the graph would run carries neither slot: nothing could move the option's value.
    expect(withOption.hiddenBatch!.route.blockLayout!.slots.map((slot) => slot.kind)).toEqual(['master']);
    await expect(buildPairGraph(VALUE_OPTION_ROOT, SINK_CHILD, 'take', {
      rootArgs: [5n], childArgs: [5n],
    })).rejects.toThrow(/value option\(s\)\/transfer\(s\)/);
  }, 120_000);

  /**
   * The refusal must not be wider than the defect, and this is the exact line it must not cross.
   *
   * A first-party `this.transfer(..)` publishes the SAME direct-mode `transferCount` and the same
   * `satoshiContainer`/`transfer` block slots as the call option, so a guard keyed on the direct layout alone
   * refuses both. It must not: the compiler CARRIES a first-party transfer into the route (one
   * `handler.transfers` entry plus eight route `transfer` slots) and the C1/C3/Controller capstones settle
   * exactly that shape on the VM, with a hostile case pinning the paid amount. Measured: refusing the whole
   * class fails 40 tests across five committed Layer-3 files.
   */
  it('admits a first-party transfer, which the route carries, through both entry points', () => {
    const payer = compileString(`pragma solidcash >=0.8.0;
interface IC11Sink { function take(int amount); }
contract C11Payer(bytes payee, address peer) {
  bigint total;
  function go(bigint amount) public {
    this.total = this.total + amount;
    this.transfer(payee, 10);
    IC11Sink(peer).take(amount);
    require(amount > 0);
  }
}`, busOnly);
    const sink = compileString(SINK_CHILD, busOnly);
    const fn = payer.abi.find((candidate) => candidate.name === 'go')!;
    const handler = payer.hiddenBatch!.handlers.find((candidate) => candidate.name === 'go')!;
    // Direct mode is INDISTINGUISHABLE from the refused option; the handler projection is the discriminator.
    expect(fn.transferCount).toBe(1);
    expect(fn.blockLayout!.slots.map((slot) => slot.kind))
      .toEqual(['master', 'dataNft', 'satoshiContainer', 'transfer']);
    expect(handler.transfers).toHaveLength(1);
    expect(payer.hiddenBatch!.route.blockLayout!.slots.filter((slot) => slot.kind === 'transfer').length)
      .toBeGreaterThan(0);
    const rootLbc = `aa20${'ce'.repeat(32)}87`;
    const sinkLbc = `aa20${'ab'.repeat(32)}87`;
    expect(() => layer3.planCompiledGraph([
      { artifact: payer, lockingBytecode: rootLbc },
      { artifact: sink, lockingBytecode: sinkLbc },
    ], [
      { parent: null, callee: 0, function: 'go', args: [5n] },
      { parent: 0, callee: 1, function: 'take', args: [5n] },
    ])).not.toThrow();
    expect(() => layer3.deriveCompiledGraphPlan({
      root: { artifact: payer, lockingBytecode: rootLbc },
      function: 'go', args: [5n], targets: { IC11Sink: { artifact: sink, lockingBytecode: sinkLbc } },
    } as any)).not.toThrow();
  });

  // The OTHER divergence the same reconciliation closed: a caller-authored call mode outside the admitted
  // pair. `deriveCompiledGraphPlan` refuses it at the callsite; `planCompiledGraph` used to skip its
  // delegatecall rejection entirely whenever the mode was supplied rather than inferred, and the transcript
  // encodes any non-staticcall mode as a plain call.
  it('refuses a caller-authored call mode outside call/staticcall', () => {
    const root = compileString(OPTION_FREE_ROOT, busOnly);
    const sink = compileString(SINK_CHILD, busOnly);
    const rows = [
      { artifact: root, lockingBytecode: `aa20${'cd'.repeat(32)}87` },
      { artifact: sink, lockingBytecode: `aa20${'ab'.repeat(32)}87` },
    ];
    expect(() => layer3.planCompiledGraph(rows, [
      { parent: null, callee: 0, function: 'go', args: [5n] },
      { parent: 0, callee: 1, function: 'take', args: [5n], callMode: 'delegatecall' as any },
    ])).toThrow(/invocation 1 declares call mode 'delegatecall', which is not a participant-graph edge/);
    // Honest control: the admitted mode on the same row plans.
    expect(() => layer3.planCompiledGraph(rows, [
      { parent: null, callee: 0, function: 'go', args: [5n] },
      { parent: 0, callee: 1, function: 'take', args: [5n], callMode: 'call' },
    ])).not.toThrow();
  });

  // Honest control for the case above: the same source with the option deleted produces the same settlement.
  it('honest control: the option-free source settles identically', async () => {
    const built = await buildPairGraph(OPTION_FREE_ROOT, SINK_CHILD, 'take', {
      rootArgs: [5n], childArgs: [5n],
    });
    expect(evaluateEachInput(built.builder)).toEqual(new Array(6).fill(null));
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 120_000);

  // SCOPE. The guard keys on `transferCount` and the option block slots, which only `value` produces. The
  // grammar admits exactly three option names (`value`, `salt`, `gas`; anything else is a ParseError), and
  // the two non-value ones compile to byte-identical bytecode and an identical block layout in BOTH modes -
  // dropped rather than bound, and never refused. Direct mode drops them too, so this is a compiler-level
  // silent drop, not a graph/direct divergence. `gas` at least emits a warning; `salt` on an ordinary
  // external call - which Solidity rejects outright, salt being a `new` option - emits nothing at all.
  it.each([
    { option: '{gas: amount}', warns: true },
    { option: '{salt: amount}', warns: false },
  ])('drops the $option call option in both modes', ({ option, warns }) => {
    const source = (opt: string): string => `pragma solidcash >=0.8.0;
interface IC11Sink { function take(int amount); }
contract C11Opt() {
  function run(address target, int amount) public {
    IC11Sink(target).take${opt}(amount);
    require(amount > 0);
  }
}`;
    for (const mode of [{}, busOnly]) {
      const plain = compileString(source(''), mode as any);
      const logged: string[] = [];
      const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
      });
      const optioned = compileString(source(option), mode as any);
      spy.mockRestore();
      expect(optioned.bytecode).toBe(plain.bytecode);
      expect(optioned.abi.find((fn) => fn.name === 'run')!.transferCount).toBeUndefined();
      expect(JSON.stringify(optioned.abi.find((fn) => fn.name === 'run')!.blockLayout))
        .toBe(JSON.stringify(plain.abi.find((fn) => fn.name === 'run')!.blockLayout));
      expect(logged.some((line) => /call option/.test(line))).toBe(warns);
    }
  });

  /*
   * The remaining VALUE spellings, so the class is covered by syntax and not only by the modern one.
   *
   * X144. Both were bare `toThrow()` on `compileString`: any compile failure passed them, so the refusal they
   * name could have been deleted and they would have stayed green on a syntax error instead. Now each names
   * the refusal, and each carries the control that differs in exactly the attacked field - the same contract
   * with no value option must COMPILE, which is what makes the refusal attributable to the option.
   */
  const c11ValueSource = (name: string, call: string): string => `pragma solidcash >=0.8.0;
contract ${name}() {
  function run(address target, bytes payload, int amount) public {
    (bool ok, bytes result) = target.${call}(payload);
    require(ok && result.length >= 0 && amount >= 0);
  }
}`;

  it('admits the legacy low-level value-option spelling in the bounded raw value class', () => {
    expect(() => compileString(c11ValueSource('C11LegacyValue', 'call'), busOnly)).not.toThrow();
    expect(() => compileString(c11ValueSource('C11LegacyValue', 'call.value(amount)'), busOnly))
      .not.toThrow();
  });

  it('admits the modern low-level value-option spelling in the bounded raw value class', () => {
    expect(() => compileString(c11ValueSource('C11ModernValue', 'call'), busOnly)).not.toThrow();
    expect(() => compileString(c11ValueSource('C11ModernValue', 'call{value: amount}'), busOnly))
      .not.toThrow();
  });

  // A value option written in only ONE arm of a branch still publishes the transfer, so the branch spelling
  // does not slip past either entry point now that both run the same refusal.
  it('a branch-local value option is refused by both entry points', () => {
    const branched = compileString(`pragma solidcash >=0.8.0;
interface IC11Sink { function take(int amount); }
contract C11BranchValue(int brand, address peer) {
  function go(int amount) public {
    if (amount > 1) { IC11Sink(peer).take{value: amount}(amount); }
    else { IC11Sink(peer).take(amount); }
    require(amount > 0);
  }
}`, busOnly);
    const sink = compileString(SINK_CHILD, busOnly);
    expect(branched.abi.find((fn) => fn.name === 'go')!.transferCount).toBe(1);
    const rootLbc = `aa20${'cd'.repeat(32)}87`;
    const sinkLbc = `aa20${'ab'.repeat(32)}87`;
    expect(() => layer3.deriveCompiledGraphPlan({
      root: { artifact: branched, lockingBytecode: rootLbc },
      function: 'go', args: [5n], targets: { IC11Sink: { artifact: sink, lockingBytecode: sinkLbc } },
    } as any)).toThrow(/value option\(s\)\/transfer\(s\)/);
    expect(() => layer3.planCompiledGraph([
      { artifact: branched, lockingBytecode: rootLbc },
      { artifact: sink, lockingBytecode: sinkLbc },
    ], [
      { parent: null, callee: 0, function: 'go', args: [5n] },
      { parent: 0, callee: 1, function: 'take', args: [5n] },
    ])).toThrow(/value option\(s\)\/transfer\(s\)/);
  });

  describe('iterated low-level calls', () => {
    const RAW_CALLER = `pragma solidcash >=0.8.0;
contract C11RawCaller() {
  function run(address target, bytes payload) public {
    (bool ok, bytes result) = target.call(payload);
    require(ok && result == hex"53");
  }
}`;
    const RAW_TARGET = `pragma solidcash >=0.8.0;
contract C11RawTarget() {
  function echo(int value) public returns (int) { require(value >= 0); return value; }
}`;
    const callerArtifact = compileString(RAW_CALLER, busOnly);
    const targetArtifact = compileString(RAW_TARGET, busOnly);
    const targetLbc = `aa20${'ab'.repeat(32)}87`;
    const selector = targetArtifact.abi.find((fn) => fn.name === 'echo')!.selector!;
    const payload = Uint8Array.from([...hexToBin(selector), ...packedScalar(3n)]);
    const planRaw = (override: (call: any) => void): unknown => {
      const caller = JSON.parse(JSON.stringify(callerArtifact));
      override(caller.abi.find((fn: any) => fn.name === 'run').externalCalls[0]);
      return layer3.deriveCompiledGraphPlan({
        root: { artifact: caller, lockingBytecode: `aa20${'cd'.repeat(32)}87` },
        function: 'run', args: [targetLbc, payload], targets: {},
        dynamicCall: () => ({
          participant: { artifact: targetArtifact, lockingBytecode: targetLbc },
          function: 'echo', args: [3n],
        }),
      } as any);
    };

    // Honest control: the singular class with the SAME canonical calldata is admitted as exactly two rows,
    // so every refusal below is attributable to the occurrence field and not to the calldata proof.
    it('honest control: the singular raw edge plans two rows', () => {
      expect((planRaw(() => {}) as any).invocations).toHaveLength(2);
    });

    it.each(['loop', 'conditional', 'unbounded'])('fails closed on occurrence %s', (occurrence) => {
      expect(() => planRaw((call) => { call.occurrence = occurrence; }))
        .toThrow(/has no bounded occurrence proof; iterated low-level calls are not an admitted graph edge/);
      expect(() => planRaw((call) => { call.occurrence = occurrence; call.maximumOccurrences = 3; }))
        .toThrow(/has no bounded occurrence proof; iterated low-level calls are not an admitted graph edge/);
    });

    it('expands an exact compiler-literal raw loop once per authenticated occurrence', () => {
      const plan = planRaw((call) => {
        call.occurrence = 'loop';
        call.maximumOccurrences = 3;
        call.minimumOccurrences = 3;
        call.occurrenceBoundSource = 'literal';
      }) as any;
      expect(plan.invocations).toHaveLength(4);
      expect(plan.invocations.slice(1).map((row: any) => row.parent)).toEqual([0, 0, 0]);
    });

    it.each([
      ['mismatched floor', 2, 3, 'literal'],
      ['non-literal provenance', 3, 3, 'guard'],
    ])('keeps raw fan-in fail-closed for %s', (_label, minimum, maximum, source) => {
      expect(() => planRaw((call) => {
        call.occurrence = 'loop';
        call.minimumOccurrences = minimum;
        call.maximumOccurrences = maximum;
        call.occurrenceBoundSource = source;
      })).toThrow(/has no bounded occurrence proof/);
    });

    it('publishes the exact bound for a source-level literal raw loop', () => {
      const artifact = compileString(`pragma solidcash >=0.8.0;
contract C11RawLoop() {
  function run(address target, bytes payload) public {
    for (int i = 0; i < 2; i = i + 1) {
      (bool ok, bytes result) = target.call(payload);
      require(ok && result.length >= 0);
    }
    require(payload.length > 0);
  }
}`, busOnly);
      expect(artifact.abi.find((fn) => fn.name === 'run')!.externalCalls![0]).toMatchObject({
        occurrence: 'loop', minimumOccurrences: 2, maximumOccurrences: 2,
        occurrenceBoundSource: 'literal',
      });
    });

    // SCOPE. The guard reads `occurrence` alone. `maximumOccurrences`, `loopArrayVar`, `selectorArrayVar`
    // and `fnPtrCall` are all admitted as ONE row when `occurrence` is absent. Compiler output always
    // carries `occurrence` (`Artifact.ts` spreads `occurrenceInfoOf`, which defaults to `once`), so this is
    // reachable only from a hand-written artifact - recorded, not claimed as an escape.
    it.each([
      ['maximumOccurrences alone', (call: any) => { call.maximumOccurrences = 3; }],
      ['loopArrayVar alone', (call: any) => { call.loopArrayVar = 'targets'; }],
      ['selectorArrayVar alone', (call: any) => { call.selectorArrayVar = 'selectors'; }],
    ])('admits %s as a single row when occurrence is absent', (_label, override) => {
      expect((planRaw(override) as any).invocations).toHaveLength(2);
    });

    it('every compiler-emitted external callsite publishes an occurrence class', () => {
      const published = compileString(RAW_CALLER, busOnly).abi
        .flatMap((fn) => fn.externalCalls ?? []);
      expect(published.length).toBeGreaterThan(0);
      expect(published.every((call) => call.occurrence !== undefined)).toBe(true);
    });
  });
});
