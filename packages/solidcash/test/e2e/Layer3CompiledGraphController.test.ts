import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, sha256,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, getDataNftAddress,
} from '../../src/stateful/covenant-helpers.js';

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const APP = (name: string) => `pragma solidcash >=0.8.0;
contract ${name}(int brand) {
  function ping(int n) public { require(n >= 0); }
}`;
const RETURNING_APP = (name: string) => `pragma solidcash >=0.8.0;
contract ${name}(int brand) {
  function twice(int n) public pure returns (int) {
    require(n >= 0);
    return n * 2;
  }
}`;
const STATE_APP = (name: string) => `pragma solidcash >=0.8.0;
contract ${name}(int brand) {
  int count;
  function add(int n) public {
    this.count = this.count + n;
    require(n >= 0);
  }
}`;

async function build(
  tamperSecondBatch = false,
  omitController = false,
  malformedGraph = false,
  replaceProjection = false,
) {
  const provider = createTestProvider();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [], { provider },
  );
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
  };
  const artifactA = compileString(APP('CompiledGraphA'), options);
  const artifactB = compileString(APP('CompiledGraphB'), options);
  const baseA = new Contract(artifactA, [1n], { provider });
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'ping', args: [1n] },
    { parent: 0, callee: 1, function: 'ping', args: [2n] },
  ]);
  let transcript = layer3.finalizeCompiledGraph(plan, {}, [0, 1], [null, null], ['', ''], [2, 3]);
  if (malformedGraph) {
    const bytes = transcript.bytes.slice();
    let cursor = 10;
    for (const participant of plan.participants) {
      cursor += 2;
      const lbcLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + lbcLength;
      const batchLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + batchLength;
      cursor += 2; // return output
      const resultVectorLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + resultVectorLength;
      cursor += 2; // projection input
    }
    cursor += 2; // invocation count
    bytes[cursor + 4] = 1; // root invocation depth must be zero
    transcript = {
      ...transcript,
      bytes,
      root: binToHex(sha256.hash(bytes)),
    };
  }
  const layout: layer3.CompiledGraphPhysicalLayout = {
    participantInputs: [0, 1],
    controllerInput: 4,
    totalSlots: 6,
  };
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: transcript.root } },
  }]);

  const aUtxo = setupA.masterUtxo;
  const bUtxo = setupB.masterUtxo;
  const feeUtxo = randomUtxo({ satoshis: 50000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  const fakeProjection = randomUtxo({ satoshis: 1000n });
  const fakeControllerUtxo = randomUtxo({ satoshis: 3000n });
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  await provider.addUtxo(p2pkh.address, feeUtxo);
  await provider.addUtxo(projection.address, projectionA);
  await provider.addUtxo(projection.address, projectionB);
  if (replaceProjection) await provider.addUtxo(p2pkh.address, fakeProjection);
  if (omitController) await provider.addUtxo(p2pkh.address, fakeControllerUtxo);

  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const bBlob = tamperSecondBatch
    ? layer3.encodeHiddenBatch(artifactB, [{ function: 'ping', args: [3n] }]).blob
    : plan.participants[1].batch.blob;

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  const argsA = layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput);
  const argsB = [...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput)];
  if (tamperSecondBatch) argsB[0] = bBlob;
  tx.addInput(aUtxo, routeA(...argsA as any));
  tx.addInput(bUtxo, routeB(...argsB as any));
  if (replaceProjection) {
    tx.addInput(fakeProjection, p2pkh.unlock.spend(alicePub, signature()));
  } else {
    tx.addInput(projectionA, projection.unlock.verify(transcript.bytes, 4n, 0n));
  }
  tx.addInput(projectionB, projection.unlock.verify(transcript.bytes, 4n, 1n));
  if (omitController) {
    tx.addInput(fakeControllerUtxo, p2pkh.unlock.spend(alicePub, signature()));
  } else {
    tx.addInput(genesis.utxos[0], controller.unlock.attest(transcript.bytes));
  }
  tx.addInput(feeUtxo, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: aUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: bUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx) };
}

const packedResult = (value: bigint): Uint8Array =>
  scriptToBytecode([
    bigIntToVmNumber(value),
    ...Array.from({ length: 7 }, () => bigIntToVmNumber(0n)),
  ]);
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);

async function buildReturning(tamperResult = false) {
  const provider = createTestProvider();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [], { provider },
  );
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
  };
  const artifactA = compileString(RETURNING_APP('CompiledReturningA'), options);
  const artifactB = compileString(RETURNING_APP('CompiledReturningB'), options);
  const baseA = new Contract(artifactA, [1n], { provider });
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'twice', args: [1n] },
    { parent: 0, callee: 1, function: 'twice', args: [2n] },
  ]);
  const transcript = layer3.finalizeCompiledGraph(plan, {
    0: binToHex(scriptToBytecode([bigIntToVmNumber(2n)])),
    1: binToHex(scriptToBytecode([bigIntToVmNumber(4n)])),
  }, [0, 2], [1, 3], [binToHex(packedResult(2n)), binToHex(packedResult(4n))], [4, 5]);
  const resultA = aggregateResult(2n);
  const resultB = aggregateResult(tamperResult ? 5n : 4n);
  const layout: layer3.CompiledGraphPhysicalLayout = {
    participantInputs: [0, 2],
    controllerInput: 6,
    totalSlots: 8,
    returnOutputs: [1, 3],
  };
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: transcript.root } },
  }]);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const returnFundingA = randomUtxo({ satoshis: 1000n });
  const returnFundingB = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  await provider.addUtxo(p2pkh.address, returnFundingA);
  await provider.addUtxo(p2pkh.address, returnFundingB);
  await provider.addUtxo(p2pkh.address, fee);
  await provider.addUtxo(projection.address, projectionA);
  await provider.addUtxo(projection.address, projectionB);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupA.masterUtxo, routeA(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
    1n,
  ));
  tx.addInput(returnFundingA, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupB.masterUtxo, routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    3n,
  ));
  tx.addInput(returnFundingB, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(projectionA, projection.unlock.verify(transcript.bytes, 6n, 0n));
  tx.addInput(projectionB, projection.unlock.verify(transcript.bytes, 6n, 1n));
  tx.addInput(genesis.utxos[0], controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupA.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: binToHex(resultA) },
    },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: binToHex(resultB) },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), artifactA, plan, resultA };
}

async function buildStateCycle(tamperState = false) {
  const provider = createTestProvider();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [], { provider },
  );
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
  };
  const artifactA = compileString(STATE_APP('CompiledStateA'), options);
  const artifactB = compileString(STATE_APP('CompiledStateB'), options);
  const baseA = new Contract(artifactA, [1n], { provider });
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupA = await setupStatefulUtxos(
    provider, baseA, artifactA.stateLayout!, { count: 0n },
  );
  const setupB = await setupStatefulUtxos(
    provider, baseB, artifactB.stateLayout!, { count: 0n },
  );
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'add', args: [1n] },
    { parent: 0, callee: 1, function: 'add', args: [2n] },
    { parent: 1, callee: 0, function: 'add', args: [3n] },
  ]);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, [0, 2], [null, null], ['', ''], [4, 5],
  );
  const controllerGenesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: transcript.root } },
  }]);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fee = randomUtxo({ satoshis: 50000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  await provider.addUtxo(p2pkh.address, fee);
  await provider.addUtxo(projection.address, projectionA);
  await provider.addUtxo(projection.address, projectionB);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const nextA = buildInitialStateCommitments(
    artifactA.stateLayout!, { count: tamperState ? 5n : 4n },
  )[0];
  const nextB = buildInitialStateCommitments(artifactB.stateLayout!, { count: 2n })[0];
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupA.masterUtxo, routeA(...layer3.compiledGraphRouteArgs(transcript, 0, 6) as any));
  tx.addInput(setupA.dataNftUtxos[0], createDataNftUnlocker(a, 0, setupA.categoryId));
  tx.addInput(setupB.masterUtxo, routeB(...layer3.compiledGraphRouteArgs(transcript, 1, 6) as any));
  tx.addInput(setupB.dataNftUtxos[0], createDataNftUnlocker(b, 2, setupB.categoryId));
  tx.addInput(projectionA, projection.unlock.verify(transcript.bytes, 6n, 0n));
  tx.addInput(projectionB, projection.unlock.verify(transcript.bytes, 6n, 1n));
  tx.addInput(controllerGenesis.utxos[0], controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(a, setupA.categoryId), amount: setupA.dataNftUtxos[0].satoshis,
    token: {
      category: setupA.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: nextA },
    },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(b, setupB.categoryId), amount: setupB.dataNftUtxos[0].satoshis,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: nextB },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx) };
}

describe('Layer-3 compiled graph controller', () => {
  it('joins independently compiled application SCB1 routes under one canonical graph', async () => {
    const { provider, transaction } = await build();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects an application input executing a different locally-valid batch', async () => {
    const { provider, transaction } = await build(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('rejects omitting the graph controller even when every local batch remains valid', async () => {
    const { provider, transaction } = await build(false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('rejects a root-committed but structurally invalid invocation tree', async () => {
    const { provider, transaction } = await build(false, false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('rejects replacing a participant projection proof with an ordinary funding input', async () => {
    const { provider, transaction } = await build(false, false, false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('authenticates compiler-produced return blobs in balanced owner slots', async () => {
    const {
      provider, transaction, artifactA, plan, resultA,
    } = await buildReturning();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    expect(layer3.decodeHiddenBatchResults(artifactA, plan.participants[0].batch, resultA))
      .toEqual([{ row: 0, type: 'int256', value: 2n }]);
  });

  it('rejects a forged return commitment even when the result NFT is otherwise well formed', async () => {
    const { provider, transaction } = await buildReturning(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('executes an authentic stateful A -> B -> A cycle with one flush per owner', async () => {
    const { provider, transaction } = await buildStateCycle();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a graph settlement whose owner post-state differs from compiled sequential execution', async () => {
    const { provider, transaction } = await buildStateCycle(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });
});
