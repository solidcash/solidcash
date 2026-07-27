import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// X7 - assert the projection result cursor is exhausted.
//
// `generateGraphProjectionVerifier` walks its owner's SCB1 result vector with `resultCursor`, but never
// asserts `resultCursor == resultVector.length`, and `if (resultLength > 0)` lets a row decline to advance
// the cursor at all. Worker C's E1 review proved every attack it could build was caught one level lower, by
// the CONSUMER's compiled route decoding the emission result against its declared ABI type.
//
// That lower defence has one structural gap: it only exists where a consumer exists. The ROOT invocation has
// no parent, so no emission row is built for it and no route decodes it. A root handler that RETURNS a value
// therefore has its transcript result byte-vector bound by exactly one thing - the projection verifier's
// `resultVector` slice - and that binding is prefix-only until the exhaustion assertion exists.
//
// The two hostile cases below leave every physical byte honest: the root's return-event NFT still commits to
// the true packed result. Only the transcript's claim about how much of it invocation 0 produced is forged.
const I_LEAF = 'interface IX7Leaf { function leaf(int seed) returns (int); }';

const X7_LEAF = `pragma solidcash >=0.8.0;
contract X7Leaf(int brand) {
  function leaf(int seed) public pure returns (int) {
    require(seed > 0);
    return seed * 11;
  }
}`;

const X7_ROOT = `pragma solidcash >=0.8.0;
${I_LEAF}
contract X7Root(int brand, address peer) {
  function go(address target, int seed) public pure returns (int) {
    int value = IX7Leaf(target).leaf(seed);
    require(value > 0);
    return value + 1;
  }
}`;

const SEED = 2n;
const LEAF_VALUE = SEED * 11n;
const ROOT_VALUE = LEAF_VALUE + 1n;
const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedScalar = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const packedBytes = (value: Uint8Array): Uint8Array => scriptToBytecode([value]);
const fixedUtxo = (slot: number, satoshis: bigint): Utxo => randomUtxo({
  satoshis, vout: 0, txid: slot.toString(16).padStart(2, '0').repeat(32),
});

interface CursorOverrides {
  /** Replace the transcript result bytes of one invocation, leaving every physical NFT honest. */
  results?: Readonly<Record<number, string>>;
}

async function buildRootReturningGraph(overrides: CursorOverrides = {}): Promise<{
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
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

  const artifactLeaf = compileString(X7_LEAF, options);
  const baseLeaf = new Contract(artifactLeaf, [7n], { provider });
  const setupLeaf = await setupStatefulUtxos(provider, baseLeaf, artifactLeaf.stateLayout!, {});
  const leaf = baseLeaf.withCategory(hexToBin(setupLeaf.categoryId));

  const artifactRoot = compileString(X7_ROOT, options);
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

  const resultRoot = packedScalar(ROOT_VALUE);
  const resultLeaf = packedScalar(LEAF_VALUE);
  // Physical result vectors, and therefore both return-event NFT commitments, stay HONEST in every case.
  const vectorRoot = binToHex(resultRoot);
  const vectorLeaf = binToHex(resultLeaf);
  const transcript = layer3.finalizeCompiledGraph(
    plan,
    { 0: vectorRoot, 1: vectorLeaf, ...(overrides.results ?? {}) },
    layout.participantInputs, layout.returnOutputs,
    [vectorRoot, vectorLeaf], layout.projectionInputs,
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

  return { provider, builder: tx, transaction: raw(tx) };
}

// Physical input map of the two-participant returning-root graph.
const INPUT = {
  masterRoot: 0, masterLeaf: 2, projectionRoot: 4, projectionLeaf: 5, controller: 6,
} as const;

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

describe('X7: the projection verifier exhausts its owner result vector', () => {
  it('honest control: a returning root plus a returning leaf settles', async () => {
    const built = await buildRootReturningGraph();
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 120_000);

  it('rejects a root whose transcript result is declared void while its NFT commits to a value', async () => {
    // Attacks: the per-invocation `result` frame of invocation 0. `resultLength == 0` takes the
    // `if (resultLength > 0)` early-out, so the cursor never advances and the honest two-byte vector is
    // left entirely unconsumed. No consumer exists for the root, so no route decodes this value: before
    // the exhaustion assertion this transaction settled.
    const built = await buildRootReturningGraph({ results: { 0: '' } });
    expect(failingInput(built.builder)).toBe(INPUT.projectionRoot);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 120_000);

  it('rejects a root whose transcript result is a one-byte prefix of its honest result', async () => {
    // Attacks: the same field, but with a cursor that does advance. `resultVector.slice(0, 1)` matches the
    // honest vector's first byte, so the slice equality passes; only exhaustion separates the forged
    // one-byte claim from the honest two-byte one.
    const built = await buildRootReturningGraph({ results: { 0: '01' } });
    expect(failingInput(built.builder)).toBe(INPUT.projectionRoot);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 120_000);

  it('a voided NON-root result still reaches the lower consumer defence first', async () => {
    // Control for the ordering claim. Invocation 1 has a consumer, so its emission row is decoded by the
    // root's compiled route against the declared `int` type. Every participant master input precedes every
    // projection input by construction, so wherever a consumer route rejects it always rejects first: the
    // exhaustion assertion is second in the stack, never first, for any non-root producer.
    const built = await buildRootReturningGraph({ results: { 1: '' } });
    expect(failingInput(built.builder)).toBe(INPUT.masterRoot);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 120_000);
});
