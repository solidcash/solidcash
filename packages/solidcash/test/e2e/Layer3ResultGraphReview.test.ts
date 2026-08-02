import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, encodeFunctionArgument, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Independent hostile review of E1 (worker C reviewing worker B).
//
// The reviewed graph is E1's own six-participant transitive chain, rebuilt here so the review can attack
// fields E1's tamper enum does not reach. Every case below leaves the PRODUCER's physical return-event NFT
// commitment completely honest, so E1's `append-producer-result-suffix` argument - "the producer's own
// route catches it" - cannot apply by construction. What varies is only how much of that honest vector the
// transcript claims each invocation consumed, which is exactly the quantity
// `generateGraphProjectionVerifier` walks with `resultCursor` and never asserts exhausted.
const PAIR_STRUCT = 'struct RgPair { int total; bool ok; }';
const I_TAIL = 'interface IRgTail { function tail(int seed) returns (int); }';
const I_DEEP = 'interface IRgDeep { function deep(address peer, int seed) returns (int, int); }';
const I_MID = `${PAIR_STRUCT}
interface IRgMid { function mid(address peer, int seed) returns (RgPair); }`;
const I_NOTE = 'interface IRgNote { function note(address peer, int seed) returns (string); }';
const I_PAIR = 'interface IRgPairFn { function pair(address peer, int seed) returns (int); }';
const I_STEP = 'interface IRgStep { function step(address peer, int seed, bytes label) returns (bytes); }';

const RG_D = `pragma solidcash >=0.8.0;
${I_TAIL}
contract RgD(int brand) {
  function deep(address peer, int seed) public pure returns (int, int) {
    int leaf = IRgTail(peer).tail(seed);
    require(leaf > 0);
    return (leaf * 2, leaf + seed);
  }
}`;

const RG_E = `pragma solidcash >=0.8.0;
${I_DEEP}
contract RgE(int brand, address peerD) {
  function note(address peer, int seed) public pure returns (string) {
    int first, int second = IRgDeep(peerD).deep(peer, seed);
    require(first == second * 2 - seed * 2);
    return first > 40 ? "wide" : "narrow";
  }
}`;

const RG_B = `pragma solidcash >=0.8.0;
${I_NOTE}
${PAIR_STRUCT}
contract RgB(int brand, address peerE) {
  function mid(address peer, int seed) public pure returns (RgPair) {
    string note = IRgNote(peerE).note(peer, seed);
    require(note.length > 0);
    return RgPair(note.length * 17 + seed, note.length == 4);
  }
}`;

const RG_C = `pragma solidcash >=0.8.0;
${I_MID}
contract RgC(int brand, address peerB) {
  function pair(address peer, int seed) public pure returns (int) {
    RgPair child = IRgMid(peerB).mid(peer, seed);
    require(child.ok);
    return child.total + seed;
  }
  function tail(int seed) public pure returns (int) {
    require(seed > 0);
    return seed * 11;
  }
}`;

const RG_A = `pragma solidcash >=0.8.0;
${I_PAIR}
contract RgA(int brand, address peerC) {
  function step(address peer, int seed, bytes label) public pure returns (bytes) {
    int child = IRgPairFn(peerC).pair(peer, seed);
    require(child > 0);
    return bytes.concat(label, bytes2(child));
  }
}`;

// Same graph position, but the reached result is bound to a local A never reads, so nothing in A's own
// answer depends on it. This is the shape E1's fixture cannot express: a producer occurrence whose
// consumer places no arithmetic constraint on the value. It is the only remaining lever on the projection
// verifier's unexhausted `resultCursor`.
//
// The stronger form - `IRgPairFn(peerC).pair(peer, seed);` as a bare expression statement - compiles to an
// artifact with NO `hiddenBatch` route at all, so it cannot be a graph participant. That is a compiler-level
// fail-closed, measured directly, not an assumption.
const RG_A_UNUSED = `pragma solidcash >=0.8.0;
${I_PAIR}
contract RgA(int brand, address peerC) {
  function step(address peer, int seed, bytes label) public pure returns (bytes) {
    int child = IRgPairFn(peerC).pair(peer, seed);
    require(seed > 0);
    return bytes.concat(label, bytes2(seed));
  }
}`;

const RG_R = `pragma solidcash >=0.8.0;
${I_STEP}
contract RgR(int brand, address peerA) {
  function go(address peer, int seed, bytes label) public pure {
    bytes tagged = IRgStep(peerA).step(peer, seed, label);
    require(tagged.length == label.length + 2 && seed > 0);
  }
}`;

const SEED = 2n;
const LABEL = hexToBin('aabb');
const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedScalar = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const packedTuple = (first: bigint, second: bigint): Uint8Array =>
  scriptToBytecode([bigIntToVmNumber(first), bigIntToVmNumber(second)]);
const packedBytes = (value: Uint8Array): Uint8Array => scriptToBytecode([value]);
const fixedUtxo = (slot: number, satoshis: bigint): Utxo => randomUtxo({
  satoshis, vout: 0, txid: slot.toString(16).padStart(2, '0').repeat(32),
});
const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

interface ReviewOverrides {
  /** Replace the transcript result bytes of one invocation, leaving the physical NFT honest. */
  results?: Readonly<Record<number, string>>;
  /** Compile A so it binds the reached result to a local it never reads. */
  unusedInA?: boolean;
  /** The value D actually consumes for `tail`, which drives D's and E's honest on-chain commitments. */
  leafSeenByD?: bigint;
}

async function createGraphAuthority(provider: ReturnType<typeof createTestProvider>): Promise<{
  projection: Contract; controller: Contract; categoryId: string; genesisUtxo: Utxo;
}> {
  const projection = new Contract(
    compileString(layer3.generateGraphProjectionVerifier()), [], { provider },
  );
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  return {
    projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0],
  };
}

async function initializeGraphAuthority(
  provider: ReturnType<typeof createTestProvider>,
  controller: Contract,
  genesisUtxo: any,
  categoryId: string,
  root: string,
  p2pkh: Contract,
): Promise<Utxo> {
  const fee = fixedUtxo(0xe1, 20_000n);
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(tx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('graph controller initialization did not create the rooted authority');
  return rooted;
}

async function buildReviewGraph(overrides: ReviewOverrides = {}): Promise<{
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  transcript: ReturnType<typeof layer3.finalizeCompiledGraph>;
}> {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  };

  const artifactD = compileString(RG_D, options);
  const baseD = new Contract(artifactD, [4n], { provider });
  const setupD = await setupStatefulUtxos(provider, baseD, artifactD.stateLayout!, {});
  const d = baseD.withCategory(hexToBin(setupD.categoryId));

  const artifactE = compileString(RG_E, options);
  const baseE = new Contract(artifactE, [5n, d.lockingBytecode], { provider });
  const setupE = await setupStatefulUtxos(provider, baseE, artifactE.stateLayout!, {});
  const e = baseE.withCategory(hexToBin(setupE.categoryId));

  const artifactB = compileString(RG_B, options);
  const baseB = new Contract(artifactB, [3n, e.lockingBytecode], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));

  const artifactC = compileString(RG_C, options);
  const baseC = new Contract(artifactC, [2n, b.lockingBytecode], { provider });
  const setupC = await setupStatefulUtxos(provider, baseC, artifactC.stateLayout!, {});
  const c = baseC.withCategory(hexToBin(setupC.categoryId));

  const artifactA = compileString(overrides.unusedInA === true ? RG_A_UNUSED : RG_A, options);
  const baseA = new Contract(artifactA, [1n, c.lockingBytecode], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));

  const artifactR = compileString(RG_R, options);
  const baseR = new Contract(artifactR, [0n, a.lockingBytecode], { provider });
  const setupR = await setupStatefulUtxos(provider, baseR, artifactR.stateLayout!, {});
  const r = baseR.withCategory(hexToBin(setupR.categoryId));

  const peer = c.lockingBytecode;
  const plan = layer3.planCompiledGraph([
    { artifact: artifactR, lockingBytecode: r.lockingBytecode },
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactC, lockingBytecode: c.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
    { artifact: artifactE, lockingBytecode: e.lockingBytecode },
    { artifact: artifactD, lockingBytecode: d.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'go', args: [peer, SEED, LABEL] },
    { parent: 0, callee: 1, function: 'step', args: [peer, SEED, LABEL] },
    { parent: 1, callee: 2, function: 'pair', args: [peer, SEED] },
    { parent: 2, callee: 3, function: 'mid', args: [peer, SEED] },
    { parent: 3, callee: 4, function: 'note', args: [peer, SEED] },
    { parent: 4, callee: 5, function: 'deep', args: [peer, SEED] },
    { parent: 5, callee: 2, function: 'tail', args: [SEED] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);

  // `leaf` is what C.tail really computes and therefore what C's own return-event NFT must commit to.
  // `leafSeenByD` is what the transcript makes D consume; they differ only in the sliding-window attack,
  // and every downstream value is recomputed from `leafSeenByD` so the physical chain stays self-consistent.
  const leaf = SEED * 11n;
  const leafSeenByD = overrides.leafSeenByD ?? leaf;
  const deepFirst = leafSeenByD * 2n;
  const deepSecond = leafSeenByD + SEED;
  const noteValue = deepFirst > 40n ? 'wide' : 'narrow';
  const midTotal = BigInt(noteValue.length) * 17n + SEED;
  const pairValue = midTotal + SEED;
  const stepScalar = overrides.unusedInA === true ? SEED : pairValue;
  const stepValue = concatBytes(LABEL, hexToBin(binToHex(bigIntToVmNumber(stepScalar)).padEnd(4, '0')));
  const structResult = (total: bigint, ok: boolean): Uint8Array => encodeFunctionArgument(
    { total, ok }, 'RgPair', artifactB.structs,
  ) as Uint8Array;

  const resultStep = packedBytes(stepValue);
  const resultPair = packedScalar(pairValue);
  const resultMid = structResult(midTotal, true);
  const resultNote = packedBytes(utf8ToBin(noteValue));
  const resultDeep = packedTuple(deepFirst, deepSecond);
  const resultTail = packedScalar(leaf);

  // Physical result vectors and the NFT commitments built from them stay HONEST in every review case.
  const vectorR = '';
  const vectorA = binToHex(resultStep);
  const vectorC = binToHex(concatBytes(resultPair, resultTail));
  const vectorB = binToHex(resultMid);
  const vectorE = binToHex(resultNote);
  const vectorD = binToHex(resultDeep);

  const honestResults: Record<number, string> = {
    1: binToHex(resultStep),
    2: binToHex(resultPair),
    3: binToHex(resultMid),
    4: binToHex(resultNote),
    5: binToHex(resultDeep),
    6: binToHex(resultTail),
  };
  const transcript = layer3.finalizeCompiledGraph(
    plan, { ...honestResults, ...(overrides.results ?? {}) },
    layout.participantInputs, layout.returnOutputs,
    [vectorR, vectorA, vectorC, vectorB, vectorE, vectorD], layout.projectionInputs,
  );

  const commitmentA = packedBytes(hexToBin(vectorA));
  const commitmentC = packedBytes(hexToBin(vectorC));
  const commitmentB = packedBytes(hexToBin(vectorB));
  const commitmentE = packedBytes(hexToBin(vectorE));
  const commitmentD = packedBytes(hexToBin(vectorD));

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const fee = fixedUtxo(0xe2, 220_000n);
  await provider.addUtxo(p2pkh.address, fee);
  const funding = [] as any[];
  for (let slot = 0; slot < 5; slot += 1) {
    const utxo = fixedUtxo(0xf0 + slot, 1000n);
    await provider.addUtxo(p2pkh.address, utxo);
    funding.push(utxo);
  }
  const projectionUtxos = [] as any[];
  for (let slot = 0; slot < 6; slot += 1) {
    const utxo = fixedUtxo(0xa0 + slot, 1000n);
    await provider.addUtxo(projection.address, utxo);
    projectionUtxos.push(utxo);
  }

  const route = (contract: Contract, artifact: typeof artifactR): ReturnType<Contract['createCompilerRouteUnlocker']> =>
    contract.createCompilerRouteUnlocker(
      artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
    );
  const routeR = route(r, artifactR);
  const routeA = route(a, artifactA);
  const routeC = route(c, artifactC);
  const routeB = route(b, artifactB);
  const routeE = route(e, artifactE);
  const routeD = route(d, artifactD);

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupR.masterUtxo, routeR(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  tx.addInput(setupA.masterUtxo, routeA(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![1]!),
  ));
  tx.addInput(funding[0], p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupC.masterUtxo, routeC(
    ...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![2]!),
  ));
  tx.addInput(funding[1], p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupB.masterUtxo, routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 3, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![3]!),
  ));
  tx.addInput(funding[2], p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupE.masterUtxo, routeE(
    ...layer3.compiledGraphRouteArgs(transcript, 4, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![4]!),
  ));
  tx.addInput(funding[3], p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupD.masterUtxo, routeD(
    ...layer3.compiledGraphRouteArgs(transcript, 5, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![5]!),
  ));
  tx.addInput(funding[4], p2pkh.unlock.spend(alicePub, signature()));
  for (let participant = 0; participant < 6; participant += 1) {
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
  const returnEvent = (setup: any, commitment: Uint8Array): any => ({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setup.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(commitment) },
    },
  });
  tx.addOutput(master(r, setupR));
  tx.addOutput(master(a, setupA));
  tx.addOutput(returnEvent(setupA, commitmentA));
  tx.addOutput(master(c, setupC));
  tx.addOutput(returnEvent(setupC, commitmentC));
  tx.addOutput(master(b, setupB));
  tx.addOutput(returnEvent(setupB, commitmentB));
  tx.addOutput(master(e, setupE));
  tx.addOutput(returnEvent(setupE, commitmentE));
  tx.addOutput(master(d, setupD));
  tx.addOutput(returnEvent(setupD, commitmentD));
  for (let slot = 0; slot < 6; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 60_000n });

  return {
    provider, builder: tx, transaction: raw(tx), transcript,
  };
}

const INPUT = {
  masterR: 0, masterA: 1, masterC: 3, masterB: 5, masterE: 7, masterD: 9,
  projectionR: 11, projectionA: 12, projectionC: 13, projectionB: 14,
  projectionE: 15, projectionD: 16,
  controller: 17,
} as const;
const invalidResultSplitAt = (input: number): RegExp => new RegExp('^mandatory-script-verify-flag-failed '
  + `\\(Unable to verify transaction: error in evaluating input index ${input}: `
  + 'Program called an OP_SPLIT operation with an invalid index\\. '
  + 'stack item length: 0; requested split index: 1\\.\\)$');

function failingInput(builder: TransactionBuilder): number | null {
  try {
    layer3.preflightLayer3Transaction(builder);
    return null;
  } catch (error) {
    const match = /failed at input (\d+)/.exec((error as Error).message);
    if (!match) throw error;
    return Number(match[1]);
  }
}

describe('E1 hostile review: producer result-cursor exhaustion (worker C)', () => {
  // Positive control. Nothing below may be credited to a construction error in this file's own builder,
  // so the unmodified review builder must settle on the BCH-2026 VM exactly like E1's own fixture.
  it('honest control: the rebuilt six-participant chain still settles', async () => {
    const built = await buildReviewGraph();
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  // Attacks: producer C's honest return-event NFT commits to `01480116` - occurrence 0 = 72, occurrence
  // 1 = 22. Each case below leaves that commitment untouched and rewrites only how many of those bytes
  // the transcript says each consuming invocation took, which is what `resultCursor` walks.
  it('truncating the second producer occurrence to a one-byte prefix rejects', async () => {
    // resultVector = 01480116, cursor ends at 3 of 4. `require(resultCursor == resultVector.length)` is
    // absent, so the projection verifier accepts the short read; something else must reject.
    const built = await buildReviewGraph({ results: { 6: '01' } });
    expect(failingInput(built.builder)).toBe(INPUT.masterD);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(invalidResultSplitAt(INPUT.masterD));
  });

  it('claiming the first producer occurrence returned nothing is refused by the SDK, not the VM', async () => {
    // Voiding a row shifts every later row's read window left. `finalizeCompiledGraph` catches THIS form
    // with a prefix check that lives entirely off-chain, so it is a builder guard, not a covenant one.
    await expect(buildReviewGraph({ results: { 2: '' } }))
      .rejects.toThrow('participant 2 result vector disagrees with its invocation results');
  });

  it('sliding the consumption window so the second consumer reads occurrence 0 rejects', async () => {
    // Void the first row so the cursor stays at 0, then let the SECOND consumer read `0148` (72) where
    // the producer really returned `0116` (22). The producer's own route cannot catch this - its
    // commitment is byte-identical to the honest one - and the projection verifier's slice check passes
    // because the cursor never moved. A binds its consumed result, so A is what rejects.
    const built = await buildReviewGraph({ results: { 2: '', 6: '0148' } });
    expect(failingInput(built.builder)).toBe(INPUT.masterA);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(invalidResultSplitAt(INPUT.masterA));
  });
});

describe('E1 hostile review: sliding window with a consumer that discards its result (worker C)', () => {
  // A's `pair` result is discarded, so nothing on A's side constrains what the transcript claims C
  // returned for occurrence 0. Everything the graph physically commits to stays honest: C's return event
  // still commits to (72, 22), and D's and E's return events are recomputed from whatever D consumed.
  it('honest control: the discarding variant settles with D consuming occurrence 1', async () => {
    const built = await buildReviewGraph({ unusedInA: true });
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects D consuming producer occurrence 0 while the transcript voids occurrence 0', async () => {
    // C.tail(2) really returns 22 and C's NFT commits to `01480116`. This transcript declares occurrence
    // 0 void so the cursor stays at 0, then declares occurrence 1 to be `0148` = 72 - a slice of C's own
    // honest vector at the WRONG offset. `first == second * 2 - seed * 2` holds for every leaf, so the
    // whole downstream chain is self-consistent at leaf 72 and no other participant sees a contradiction.
    const built = await buildReviewGraph({
      unusedInA: true, leafSeenByD: 72n, results: { 2: '', 6: '0148' },
    });
    // Measured: A rejects at input 1 even though `child` is never read, so the consumed bytes are
    // bound to C's physical return event by A's route, not by anything in the transcript machinery.
    expect(failingInput(built.builder)).toBe(INPUT.masterA);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(invalidResultSplitAt(INPUT.masterA));
  });
});
