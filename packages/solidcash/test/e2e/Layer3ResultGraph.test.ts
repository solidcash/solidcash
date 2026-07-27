import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, sha256, utf8ToBin,
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

// E1: nested and transitive heterogeneous result dependencies.
//
// One canonical graph, six independently compiled participants, seven invocations, depth six:
//
//   R.go -> A.step -> C.pair -> B.mid -> E.note -> D.deep -> C.tail
//
// Every non-root invocation both consumes the authenticated result of the call it makes and produces a
// result its own caller consumes, so the deepest scalar propagates transitively to the top. The result
// schemas are deliberately heterogeneous and cover every admitted class: dynamic `bytes` (A), scalar
// `int` (C, twice), named struct (B), dynamic `string` (E) and a static tuple (D). Participant C is
// reached twice from two different consumers, which makes the producer-occurrence binding - not just the
// producer identity - load bearing.
const PAIR_STRUCT = 'struct RgPair { int total; bool ok; }';
const I_TAIL = 'interface IRgTail { function tail(int seed) returns (int); }';
const I_DEEP = 'interface IRgDeep { function deep(address peer, int seed) returns (int, int); }';
const I_MID = `${PAIR_STRUCT}
interface IRgMid { function mid(address peer, int seed) returns (RgPair); }`;
const I_NOTE = 'interface IRgNote { function note(address peer, int seed) returns (string); }';
const I_PAIR = 'interface IRgPairFn { function pair(address peer, int seed) returns (int); }';
const I_STEP = 'interface IRgStep { function step(address peer, int seed, bytes label) returns (bytes); }';

/** Tuple producer: consumes C's second scalar occurrence. */
const RG_D = `pragma solidcash >=0.8.0;
${I_TAIL}
contract RgD(int brand) {
  function deep(address peer, int seed) public pure returns (int, int) {
    int leaf = IRgTail(peer).tail(seed);
    require(leaf > 0);
    return (leaf * 2, leaf + seed);
  }
}`;

/** Dynamic string producer: consumes D's tuple and picks its answer from the consumed value. */
const RG_E = `pragma solidcash >=0.8.0;
${I_DEEP}
contract RgE(int brand, address peerD) {
  function note(address peer, int seed) public pure returns (string) {
    int first, int second = IRgDeep(peerD).deep(peer, seed);
    require(first == second * 2 - seed * 2);
    return first > 40 ? "wide" : "narrow";
  }
}`;

/** Struct producer: consumes E's dynamic string. */
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

/** Two scalar producer occurrences in one owner: `pair` consumes B's struct, `tail` is a leaf. */
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

/** Dynamic bytes producer: consumes C's first scalar occurrence. */
const RG_A = `pragma solidcash >=0.8.0;
${I_PAIR}
contract RgA(int brand, address peerC) {
  function step(address peer, int seed, bytes label) public pure returns (bytes) {
    int child = IRgPairFn(peerC).pair(peer, seed);
    require(child > 0);
    return bytes.concat(label, bytes2(child));
  }
}`;

/** Root consumer of A's dynamic bytes result. */
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
// `randomUtxo` draws from ~100k distinct outpoints, which collides often enough at nineteen inputs to
// make this fixture flaky. Every sidecar slot gets its own deterministic outpoint instead.
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

export type ResultGraphTamper =
  | 'none'
  // Producer-side commitment forgery: the transcript stays honest, the on-chain result NFT does not.
  | 'forge-producer-commitment'
  // Composite field forgeries, consistently rebuilt so only the producer's real computation disagrees.
  | 'forge-deep-tuple-field'
  | 'forge-struct-field'
  | 'forge-bytes-result'
  | 'forge-string-result'
  // Occurrence forgeries, spliced into the frozen transcript bytes at exactly one field.
  | 'swap-producer-occurrences'
  | 'duplicate-producer-occurrence'
  | 'substitute-consumer-emission'
  | 'reorder-producer-result-vector';

interface ResultGraphFixture {
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  plan: ReturnType<typeof layer3.planCompiledGraph>;
  layout: ReturnType<typeof layer3.compiledGraphPhysicalLayout>;
  transcript: ReturnType<typeof layer3.finalizeCompiledGraph>;
  artifacts: Record<'R' | 'A' | 'C' | 'B' | 'E' | 'D', ReturnType<typeof compileString>>;
  vectors: Record<'A' | 'C' | 'B' | 'E' | 'D', Uint8Array>;
  commitments: Record<'A' | 'C' | 'B' | 'E' | 'D', Uint8Array>;
  values: {
    leaf: bigint; deepFirst: bigint; deepSecond: bigint; noteValue: string;
    midTotal: bigint; pairValue: bigint; stepValue: Uint8Array;
  };
}

/**
 * Byte offsets of every authenticated result field in a finalized `L3GRAPH1` transcript.
 *
 * Hostile cases rewrite one field in place, leaving every other byte and every frame length identical.
 * The two scalar producer occurrences are chosen to encode to the same width, so an occurrence swap is a
 * pure substitution rather than a re-encoding of the whole transcript.
 */
function locateTranscriptResults(bytes: Uint8Array): {
  invocationResults: { offset: number; length: number }[];
  emissionResults: { participant: number; offset: number; length: number }[];
  participantVectors: { offset: number; length: number }[];
} {
  const u16 = (at: number): number => bytes[at] | (bytes[at + 1] << 8);
  let cursor = 10;
  const participantCount = bytes[9];
  const participantVectors: { offset: number; length: number }[] = [];
  const emissionResults: { participant: number; offset: number; length: number }[] = [];
  for (let participant = 0; participant < participantCount; participant += 1) {
    cursor += 4; // input index + block size
    cursor += 2 + u16(cursor); // locking bytecode
    cursor += 2 + u16(cursor); // SCB1 batch blob
    const emissionsLength = u16(cursor);
    cursor += 2;
    let emissionCursor = cursor;
    const emissionsEnd = cursor + emissionsLength;
    while (emissionCursor < emissionsEnd) {
      emissionCursor += 2 + u16(emissionCursor); // target
      emissionCursor += 1 + 4; // call mode + selector
      emissionCursor += 2 + u16(emissionCursor); // arguments
      const resultLength = u16(emissionCursor);
      emissionResults.push({ participant, offset: emissionCursor + 2, length: resultLength });
      emissionCursor += 2 + resultLength;
    }
    cursor = emissionsEnd;
    cursor += 2 + u16(cursor); // logical callers
    cursor += 2; // return output index
    const vectorLength = u16(cursor);
    participantVectors.push({ offset: cursor + 2, length: vectorLength });
    cursor += 2 + vectorLength;
    cursor += 2; // projection input index
  }
  const invocationCount = u16(cursor);
  cursor += 2;
  const invocationResults: { offset: number; length: number }[] = [];
  for (let invocation = 0; invocation < invocationCount; invocation += 1) {
    cursor += 2 + 1 + 1 + 1 + 2 + 4 + 1; // parent, callee, row, depth, subtreeEnd, selector, call mode
    cursor += 2 + u16(cursor); // arguments
    const resultLength = u16(cursor);
    invocationResults.push({ offset: cursor + 2, length: resultLength });
    cursor += 2 + resultLength;
  }
  if (cursor !== bytes.length) throw new Error('transcript locator did not consume every byte');
  return { invocationResults, emissionResults, participantVectors };
}

export async function buildResultGraph(tamper: ResultGraphTamper = 'none'): Promise<ResultGraphFixture> {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };

  // Deploy in dependency order so no participant needs a peer that does not exist yet.
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

  const artifactA = compileString(RG_A, options);
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

  // Sequential execution of the compiled sources: tail(2)=22, deep=(44,24), note="wide",
  // mid={70,true}, pair=72, step=`aabb` || bytes2(72). Both of C's scalar occurrences are deliberately
  // above OP_16 and below 128, so each canonical push is exactly two bytes and an occurrence splice
  // changes no frame length.
  const leaf = SEED * 11n;
  const deepFirst = leaf * 2n;
  const deepSecond = leaf + SEED;
  const noteValue = deepFirst > 40n ? 'wide' : 'narrow';
  const midTotal = BigInt(noteValue.length) * 17n + SEED;
  const pairValue = midTotal + SEED;
  const stepValue = concatBytes(LABEL, hexToBin(binToHex(bigIntToVmNumber(pairValue)).padEnd(4, '0')));
  const structResult = (total: bigint, ok: boolean): Uint8Array => encodeFunctionArgument(
    { total, ok }, 'RgPair', artifactB.structs,
  ) as Uint8Array;

  const forgedTupleField = tamper === 'forge-deep-tuple-field';
  const forgedStructField = tamper === 'forge-struct-field';
  const forgedBytesResult = tamper === 'forge-bytes-result';
  const resultStep = packedBytes(forgedBytesResult
    ? concatBytes(LABEL, hexToBin('4700')) : stepValue);
  const forgedStringResult = tamper === 'forge-string-result';
  const resultPair = packedScalar(pairValue);
  const resultMid = structResult(midTotal, !forgedStructField);
  const resultNote = packedBytes(utf8ToBin(forgedStringResult ? 'wild' : noteValue));
  const resultDeep = packedTuple(deepFirst, forgedTupleField ? deepSecond + 1n : deepSecond);
  const resultTail = packedScalar(leaf);

  const vectorR = '';
  const vectorA = binToHex(resultStep);
  const vectorC = binToHex(concatBytes(resultPair, resultTail));
  const vectorB = binToHex(resultMid);
  const vectorE = binToHex(resultNote);
  const vectorD = binToHex(resultDeep);

  const honest = layer3.finalizeCompiledGraph(plan, {
    1: binToHex(resultStep),
    2: binToHex(resultPair),
    3: binToHex(resultMid),
    4: binToHex(resultNote),
    5: binToHex(resultDeep),
    6: binToHex(resultTail),
  }, layout.participantInputs, layout.returnOutputs,
  [vectorR, vectorA, vectorC, vectorB, vectorE, vectorD], layout.projectionInputs);

  // Splice exactly one authenticated result field. Frame lengths never change, so the only difference
  // between the honest and hostile transactions is the attacked field plus the transcript root.
  let transcript = honest;
  if (tamper === 'reorder-producer-result-vector') {
    // Leave every invocation row, emission row and physical result NFT honest; claim only that the
    // producer packed its two occurrences in the opposite order.
    const bytes = Uint8Array.from(honest.bytes);
    const vector = locateTranscriptResults(bytes).participantVectors[2];
    const half = vector.length / 2;
    const head = bytes.slice(vector.offset, vector.offset + half);
    const tail = bytes.slice(vector.offset + half, vector.offset + vector.length);
    bytes.set(tail, vector.offset);
    bytes.set(head, vector.offset + half);
    transcript = { ...honest, bytes, root: binToHex(sha256.hash(bytes)) } as typeof honest;
  }
  if (tamper === 'swap-producer-occurrences' || tamper === 'duplicate-producer-occurrence'
    || tamper === 'substitute-consumer-emission') {
    const bytes = Uint8Array.from(honest.bytes);
    const located = locateTranscriptResults(bytes);
    const first = located.invocationResults[2];
    const second = located.invocationResults[6];
    const consumerOfFirst = located.emissionResults.find((row) => row.participant === 1)!;
    const consumerOfSecond = located.emissionResults.find((row) => row.participant === 5)!;
    if (first.length !== second.length || consumerOfFirst.length !== consumerOfSecond.length) {
      throw new Error('occurrence splice requires equal-width producer results');
    }
    const firstValue = bytes.slice(first.offset, first.offset + first.length);
    const secondValue = bytes.slice(second.offset, second.offset + second.length);
    if (tamper === 'swap-producer-occurrences') {
      bytes.set(secondValue, first.offset);
      bytes.set(firstValue, second.offset);
      bytes.set(secondValue, consumerOfFirst.offset);
      bytes.set(firstValue, consumerOfSecond.offset);
    } else if (tamper === 'duplicate-producer-occurrence') {
      bytes.set(firstValue, second.offset);
      bytes.set(firstValue, consumerOfSecond.offset);
    } else {
      bytes.set(secondValue, consumerOfFirst.offset);
    }
    transcript = {
      ...honest, bytes, root: binToHex(sha256.hash(bytes)),
    } as typeof honest;
  }

  const commitmentA = packedBytes(hexToBin(vectorA));
  const commitmentC = packedBytes(hexToBin(
    tamper === 'forge-producer-commitment'
      ? binToHex(concatBytes(packedScalar(pairValue + 1n), resultTail))
      : vectorC,
  ));
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
    provider, builder: tx, transaction: raw(tx), plan, layout, transcript,
    artifacts: {
      R: artifactR, A: artifactA, C: artifactC, B: artifactB, E: artifactE, D: artifactD,
    },
    vectors: {
      A: hexToBin(vectorA), C: hexToBin(vectorC), B: hexToBin(vectorB),
      E: hexToBin(vectorE), D: hexToBin(vectorD),
    },
    commitments: {
      A: commitmentA, C: commitmentC, B: commitmentB, E: commitmentE, D: commitmentD,
    },
    values: {
      leaf, deepFirst, deepSecond, noteValue, midTotal, pairValue, stepValue,
    },
  };
}

/**
 * Physical input slots of the balanced graph, so every hostile case can name the exact covenant that
 * rejects it rather than asserting only that something failed.
 */
const INPUT = {
  masterR: 0, masterA: 1, masterC: 3, masterB: 5, masterE: 7, masterD: 9,
  projectionR: 11, projectionA: 12, projectionC: 13, projectionB: 14,
  projectionE: 15, projectionD: 16,
  controller: 17,
} as const;

/** Report the first input whose BCH-2026 evaluation fails, so a hostile case names one exact covenant. */
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

describe('Layer-3 nested and transitive heterogeneous result graph (E1)', () => {
  it('settles a six-participant transitive chain whose five result schemas all differ', async () => {
    const built = await buildResultGraph();
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');

    // Each level's authenticated result is the input of the level above it, so the deepest scalar
    // determines every value up the chain.
    expect(built.values).toEqual({
      leaf: 22n, deepFirst: 44n, deepSecond: 24n, noteValue: 'wide',
      midTotal: 70n, pairValue: 72n, stepValue: hexToBin('aabb4800'),
    });
    // Decode each producer's on-chain return-event commitment, not a locally recomputed value.
    const decode = (participant: number, artifact: any, commitment: Uint8Array): unknown =>
      layer3.decodeHiddenBatchResults(artifact, built.plan.participants[participant].batch, commitment);
    expect(decode(1, built.artifacts.A, built.commitments.A))
      .toEqual([{ row: 0, type: 'bytes', value: hexToBin('aabb4800') }]);
    expect(decode(2, built.artifacts.C, built.commitments.C)).toEqual([
      { row: 0, type: 'int256', value: 72n },
      { row: 1, type: 'int256', value: 22n },
    ]);
    expect(decode(3, built.artifacts.B, built.commitments.B))
      .toEqual([{ row: 0, type: 'RgPair', value: { total: 70n, ok: true } }]);
    expect(decode(4, built.artifacts.E, built.commitments.E))
      .toEqual([{ row: 0, type: 'string', value: 'wide' }]);
    expect(decode(5, built.artifacts.D, built.commitments.D))
      .toEqual([{ row: 0, type: '(int256,int256)', value: [44n, 24n] }]);
  });

  it('binds one canonical producer, consumer and occurrence to every result edge', async () => {
    const built = await buildResultGraph();
    // Every consumer names exactly one producer, and the chain is a single transitive path.
    expect(built.plan.invocations.map((invocation) => invocation.resultDependencies))
      .toEqual([[1], [2], [3], [4], [5], [6], []]);
    // Every non-root invocation answers exactly one compiler-authored consumer callsite.
    expect(built.plan.invocations.map((invocation) => invocation.consumerCallsiteId))
      .toEqual([undefined, 0, 0, 0, 0, 0, 0]);
    expect(built.plan.invocations.map((invocation) => invocation.resultTypes)).toEqual([
      [], ['bytes'], ['int256'], ['RgPair'], ['string'], ['int256', 'int256'], ['int256'],
    ]);
    // Participant C is reached twice from two different consumers and packs both occurrences into one
    // result vector, so the consumer must bind an offset, not just a producer identity.
    expect(built.plan.participants[2].invocations).toEqual([2, 6]);
    expect(built.plan.invocations[2].localRow).toBe(0);
    expect(built.plan.invocations[6].localRow).toBe(1);
    expect(built.plan.invocations[2].caller).toBe(1);
    expect(built.plan.invocations[6].caller).toBe(5);
    expect(binToHex(built.vectors.C)).toBe('01480116');
    expect(built.transcript.resultsHex).toEqual([
      '', binToHex(packedBytes(hexToBin('aabb4800'))), '0148',
      binToHex(built.vectors.B), '0477696465', '012c0118', '0116',
    ]);
  });

  it('measures the honest graph against ordinary BCH-2026 capacity without a relaxed profile', async () => {
    const built = await buildResultGraph();
    const transaction = built.builder.buildLibauthTransaction();
    const largestInput = Math.max(...transaction.inputs.map((input) => input.unlockingBytecode.length));
    // Measured at this commit: transcript 1,778 bytes, largest input 8,812 bytes (a projection proof,
    // which carries the whole transcript), serialized transaction 83,032 bytes. Ordinary BCH-2026
    // capacity, not the relaxed semantic profile - but the standard-policy and headroom questions belong
    // to task F1, not here.
    expect(built.transcript.bytes.length).toBeLessThan(2_500);
    expect(largestInput).toBeLessThan(10_000);
    expect(built.transaction.length / 2).toBeLessThan(100_000);
    expect(transaction.inputs).toHaveLength(19);
    expect(transaction.outputs).toHaveLength(19);
  });
});

describe('Layer-3 result graph hostile cases (E1)', () => {
  it('rejects a forged producer result commitment on an otherwise honest transcript', async () => {
    const built = await buildResultGraph('forge-producer-commitment');
    expect(failingInput(built.builder)).toBe(INPUT.masterC);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  });

  it('rejects a forged non-leading tuple field produced by the deepest consumer', async () => {
    const built = await buildResultGraph('forge-deep-tuple-field');
    // The next consumer up the chain checks the tuple it consumed, so the forgery stops at E, not at D.
    expect(failingInput(built.builder)).toBe(INPUT.masterE);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  });

  it('rejects a forged struct field midway along the transitive chain', async () => {
    const built = await buildResultGraph('forge-struct-field');
    expect(failingInput(built.builder)).toBe(INPUT.masterC);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  });

  it('rejects a forged dynamic string result midway along the transitive chain', async () => {
    const built = await buildResultGraph('forge-string-result');
    expect(failingInput(built.builder)).toBe(INPUT.masterE);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  });

  it('rejects a forged dynamic bytes result consumed by the root', async () => {
    const built = await buildResultGraph('forge-bytes-result');
    expect(failingInput(built.builder)).toBe(INPUT.masterA);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  });

  it('rejects swapping the two occurrences one producer contributes to two consumers', async () => {
    const built = await buildResultGraph('swap-producer-occurrences');
    expect(failingInput(built.builder)).toBe(INPUT.masterA);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  });

  it('rejects consuming one producer occurrence twice', async () => {
    const built = await buildResultGraph('duplicate-producer-occurrence');
    expect(failingInput(built.builder)).toBe(INPUT.masterD);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  });

  it('rejects a consumer emission that substitutes another occurrence of the same producer', async () => {
    const built = await buildResultGraph('substitute-consumer-emission');
    expect(failingInput(built.builder)).toBe(INPUT.masterA);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  });

  it('rejects a transcript that reorders one producer result vector', async () => {
    const built = await buildResultGraph('reorder-producer-result-vector');
    expect(failingInput(built.builder)).toBe(INPUT.projectionC);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  });
});
