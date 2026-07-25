import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, sha256,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createEntryNftUnlocker, createSatoshiContainerUnlocker,
  getDataNftAddress, getEntryNftAddress, getEventNftAddress, getSatoshiContainerAddress,
} from '../../src/stateful/covenant-helpers.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlot, keyToSlotMulti,
} from '../../src/stateful/SortedList.js';

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
// BCH consensus input-script limit, and the margin the caller-authorized ERC-20 settlement must keep under it.
const MAXIMUM_INPUT_BYTES = 10_000;
const INPUT_HEADROOM_BYTES = 1_000;
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const APP = (name: string) => `pragma solidcash >=0.8.0;
contract ${name}(int brand) {
  function ping(int n) public { require(n >= 0); }
  function authenticated(address expected) public { require(msg.sender == expected); }
  function inspectData(int n) public { require(msg.data == abi.encodeWithSelector(msg.sig, n)); }
  function viewPing() public pure { require(true); }
}`;
const CALLING_APP = `pragma solidcash >=0.8.0;
interface ICompiledGraphTarget {
  function ping(int n);
  function authenticated(address expected);
  function inspectData(int n);
  function viewPing();
}
contract CompiledGraphA(int brand, address target) {
  function start(int first, int second) public {
    require(first >= 0 && second >= 0);
    ICompiledGraphTarget(target).ping(first);
    ICompiledGraphTarget(target).ping(second);
    require(true);
  }
  function maybe(address next, int alwaysN, int n, bool take) public {
    ICompiledGraphTarget(next).ping(alwaysN);
    if (take) {
      ICompiledGraphTarget(next).ping(n);
    }
    require(n >= 0);
  }
  function repeat(address next, int n, int times) public {
    for (int i = 0; i < times; i = i + 1) {
      ICompiledGraphTarget(next).ping(n);
    }
    require(times >= 0);
  }
  function transform(address next, int n) public {
    ICompiledGraphTarget(next).ping(n + 1);
    require(n >= 0);
  }
  function authenticate(address next, address expected) public {
    ICompiledGraphTarget(next).authenticated(expected);
    require(true);
  }
  function forwardCalldata(address next, int n) public {
    ICompiledGraphTarget(next).inspectData(n);
    require(true);
  }
  function forwardStatic(address next) public {
    ICompiledGraphTarget(next).viewPing.staticcall();
    require(true);
  }
}`;
const RETURNING_B = `pragma solidcash >=0.8.0;
contract CompiledReturningB(int brand) {
  function twice(int n) public pure returns (int) {
    require(n >= 0);
    return n * 2;
  }
}`;
const RETURNING_A = `pragma solidcash >=0.8.0;
interface IReturningB { function twice(int n) returns (int); }
contract CompiledReturningA(int brand, address target) {
  function plusOne(int n) public pure returns (int) {
    int child = IReturningB(target).twice(n);
    require(child >= 0);
    return child + 1;
  }
}`;
const STATE_A = `pragma solidcash >=0.8.0;
interface IStateB { function step(address next, address callback, int n); }
contract CompiledStateA(int brand) {
  int count;
  function start(address next, address callback, int n) public {
    this.count = this.count + n;
    require(n >= 0);
    IStateB(next).step(next, callback, n);
    require(true);
  }
  function finish(address next, address callback, int n) public {
    this.count = this.count + n;
    require(next.length > 0 && callback.length > 0 && n >= 0);
  }
}`;
const STATE_B = `pragma solidcash >=0.8.0;
interface IStateA { function finish(address next, address callback, int n); }
contract CompiledStateB(int brand) {
  int count;
  function step(address next, address callback, int n) public {
    this.count = this.count + n;
    require(n >= 0);
    IStateA(callback).finish(next, callback, n);
    require(true);
  }
}`;

async function createGraphAuthority(provider: ReturnType<typeof createTestProvider>) {
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
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
) {
  const fee = randomUtxo({ satoshis: 20_000n });
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

async function build(
  tamperSecondBatch = false,
  omitController = false,
  malformedGraph = false,
  replaceProjection = false,
  aliasProjection = false,
  forgeControllerCategory = false,
  sourceChildArg = 1n,
  conditional?: { take: boolean; includeChild: boolean },
  loopCount?: number,
  senderAuth?: { forgeExpected: boolean },
  dataAuth = false,
  staticAuth = false,
  tamperBlockSize = false,
  transformedChildArg?: bigint,
) {
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
  const artifactB = compileString(APP('CompiledGraphB'), options);
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(CALLING_APP, options);
  const baseA = new Contract(artifactA, [1n, b.lockingBytecode], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const graphInvocations = transformedChildArg !== undefined ? [
    { parent: null, callee: 0, function: 'transform', args: [b.lockingBytecode, 6n] },
    { parent: 0, callee: 1, function: 'ping', args: [transformedChildArg] },
  ] : staticAuth ? [
    { parent: null, callee: 0, function: 'forwardStatic', args: [b.lockingBytecode] },
    { parent: 0, callee: 1, function: 'viewPing', args: [] },
  ] : dataAuth ? [
    { parent: null, callee: 0, function: 'forwardCalldata', args: [b.lockingBytecode, 7n] },
    { parent: 0, callee: 1, function: 'inspectData', args: [7n] },
  ] : senderAuth ? [
    {
      parent: null, callee: 0, function: 'authenticate',
      args: [b.lockingBytecode, senderAuth.forgeExpected ? b.lockingBytecode : a.lockingBytecode],
    },
    {
      parent: 0, callee: 1, function: 'authenticated',
      args: [senderAuth.forgeExpected ? b.lockingBytecode : a.lockingBytecode],
    },
  ] : loopCount !== undefined ? [
    { parent: null, callee: 0, function: 'repeat', args: [b.lockingBytecode, 7n, BigInt(loopCount)] },
    ...Array.from({ length: loopCount }, () =>
      ({ parent: 0, callee: 1, function: 'ping', args: [7n] })),
  ] : conditional ? [
    {
      parent: null, callee: 0, function: 'maybe',
      args: [b.lockingBytecode, 0n, 3n, conditional.take],
    },
    { parent: 0, callee: 1, function: 'ping', args: [0n] },
    ...(conditional.includeChild
      ? [{ parent: 0, callee: 1, function: 'ping', args: [3n] }] : []),
  ] : [
    { parent: null, callee: 0, function: 'start', args: [1n, 2n] },
    { parent: 0, callee: 1, function: 'ping', args: [sourceChildArg] },
    { parent: 0, callee: 1, function: 'ping', args: [2n] },
  ];
  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], graphInvocations);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  let transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  if (malformedGraph || aliasProjection || tamperBlockSize) {
    const bytes = transcript.bytes.slice();
    if (tamperBlockSize) bytes[12] += 1;
    let cursor = 10;
    for (const participant of plan.participants) {
      cursor += 4; // participant input + compiler-bound block size
      const lbcLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + lbcLength;
      const batchLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + batchLength;
      const emissionsLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + emissionsLength;
      const callersLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + callersLength;
      cursor += 2; // return output
      const resultVectorLength = bytes[cursor] | (bytes[cursor + 1] << 8);
      cursor += 2 + resultVectorLength;
      if (aliasProjection && participant.participant === 1) {
        bytes[cursor] = layout.projectionInputs[0] & 0xff;
        bytes[cursor + 1] = layout.projectionInputs[0] >> 8;
      }
      cursor += 2; // projection input
    }
    if (malformedGraph) {
      cursor += 2; // invocation count
      bytes[cursor + 4] = 1; // root invocation depth must be zero
    }
    transcript = {
      ...transcript,
      bytes,
      root: binToHex(sha256.hash(bytes)),
    };
  }
  const aUtxo = setupA.masterUtxo;
  const bUtxo = setupB.masterUtxo;
  const feeUtxo = randomUtxo({ satoshis: 50000n });
  const projectionA = randomUtxo({ satoshis: 1000n });
  const projectionB = randomUtxo({ satoshis: 1000n });
  const fakeProjection = randomUtxo({ satoshis: 1000n });
  const fakeControllerUtxo = randomUtxo({ satoshis: 3000n });
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const forgedController = forgeControllerCategory
    ? (await (provider as any).addTokenUtxosDynamic((_category: string) => [{
      address: controller.tokenAddress,
      satoshis: 3000n,
      token: { amount: 0n, nft: { capability: 'mutable', commitment: transcript.root } },
    }])).utxos[0]
    : undefined;
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
    tx.addInput(projectionA, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n));
  }
  tx.addInput(
    projectionB,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 1n),
  );
  if (omitController) {
    tx.addInput(fakeControllerUtxo, p2pkh.unlock.spend(alicePub, signature()));
  } else {
    tx.addInput(
      forgedController ?? rootedController,
      controller.unlock.attest(transcript.bytes),
    );
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
  return { provider, transaction: raw(tx), builder: tx, transcript };
}

const packedResult = (value: bigint): Uint8Array =>
  scriptToBytecode([
    bigIntToVmNumber(value),
    ...Array.from({ length: 7 }, () => bigIntToVmNumber(0n)),
  ]);
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);

async function buildReturning(tamperResult = false) {
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
  const artifactB = compileString(RETURNING_B, options);
  const baseB = new Contract(artifactB, [2n], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(RETURNING_A, options);
  const baseA = new Contract(artifactA, [1n, b.lockingBytecode], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'plusOne', args: [2n] },
    { parent: 0, callee: 1, function: 'twice', args: [2n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(plan, {
    0: binToHex(scriptToBytecode([bigIntToVmNumber(5n)])),
    1: binToHex(scriptToBytecode([bigIntToVmNumber(4n)])),
  }, layout.participantInputs, layout.returnOutputs,
  [binToHex(packedResult(5n)), binToHex(packedResult(4n))], layout.projectionInputs);
  const resultA = aggregateResult(5n);
  const resultB = aggregateResult(tamperResult ? 5n : 4n);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
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
    BigInt(layout.returnOutputs![0]!),
  ));
  tx.addInput(returnFundingA, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(setupB.masterUtxo, routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![1]!),
  ));
  tx.addInput(returnFundingB, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(
    projectionA,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(
    projectionB,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 1n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
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
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactA = compileString(STATE_A, options);
  const artifactB = compileString(STATE_B, options);
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
  const commonArgs = [b.lockingBytecode, a.lockingBytecode, 1n] as const;
  const plan = layer3.planCompiledGraph([
    { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    { artifact: artifactB, lockingBytecode: b.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'start', args: commonArgs },
    { parent: 0, callee: 1, function: 'step', args: commonArgs },
    { parent: 1, callee: 0, function: 'finish', args: commonArgs },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
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
    artifactA.stateLayout!, { count: tamperState ? 3n : 2n },
  )[0];
  const nextB = buildInitialStateCommitments(artifactB.stateLayout!, { count: 1n })[0];
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setupA.masterUtxo,
    routeA(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    setupA.dataNftUtxos[0],
    createDataNftUnlocker(a, layout.participantInputs[0], setupA.categoryId),
  );
  tx.addInput(
    setupB.masterUtxo,
    routeB(...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any),
  );
  tx.addInput(
    setupB.dataNftUtxos[0],
    createDataNftUnlocker(b, layout.participantInputs[1], setupB.categoryId),
  );
  tx.addInput(
    projectionA,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(
    projectionB,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 1n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
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

async function buildEventGraph(tamperEvent = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(`pragma solidcash >=0.8.0;
    contract CompiledGraphEvent() {
      event Noted(bigint n);
      function note(bigint n) public {
        emit Noted(n);
        require(n >= 0);
      }
    }`, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const plan = layer3.planCompiledGraph([
    { artifact, lockingBytecode: contract.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'note', args: [7n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const eventFunding = Array.from({ length: 8 }, () => randomUtxo({ satoshis: 1000n }));
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  for (const funding of eventFunding) await provider.addUtxo(p2pkh.address, funding);
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  eventFunding.forEach((funding) =>
    tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  const eventSignature = artifact.events![0].signature;
  tx.addOutput({
    to: tamperEvent
      ? contract.tokenAddress
      : getEventNftAddress(contract, setup.categoryId, eventSignature),
    amount: 1000n,
    token: {
      category: setup.categoryId,
      amount: 0n,
      nft: { capability: 'none', commitment: binToHex(scriptToBytecode([bigIntToVmNumber(7n)])) },
    },
  });
  for (let slot = 2; slot < 9; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

async function buildValueEffectGraph(tamperAmount = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(`pragma solidcash >=0.8.0;
    contract CompiledGraphValue() {
      function pay(bytes recipient, bigint amount) public {
        this.transfer(recipient, amount);
        require(msg.value == -amount && amount >= 0);
      }
    }`, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const recipient = Uint8Array.of(0x51);
  const plan = layer3.planCompiledGraph([
    { artifact, lockingBytecode: contract.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'pay', args: [recipient, 100n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const container = randomUtxo({ satoshis: 5000n });
  const effectFunding = Array.from(
    { length: plan.participants[0].blockLayout!.blockSize - 2 },
    () => randomUtxo({ satoshis: 1000n }),
  );
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  await provider.addUtxo(getSatoshiContainerAddress(contract, setup.categoryId), container);
  for (const funding of effectFunding) await provider.addUtxo(p2pkh.address, funding);
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(container, createSatoshiContainerUnlocker(contract, 0, setup.categoryId));
  effectFunding.forEach((funding) =>
    tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getSatoshiContainerAddress(contract, setup.categoryId),
    amount: 4900n,
  });
  tx.addOutput({ to: recipient, amount: tamperAmount ? 101n : 100n });
  for (let slot = 3; slot < plan.participants[0].blockLayout!.blockSize; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

async function buildMappingGraph(tamperValue = false) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(`pragma solidcash >=0.8.0;
    contract CompiledGraphMapping() {
      mapping(bigint => bigint) values;
      function add(bigint key, bigint amount) public {
        this.values[key] = this.values[key] + amount;
        require(amount >= 0);
      }
    }`, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const initialSlot = keyToSlot(bigIntToVmNumber(1n));
  const initialCommitment = encodeEntryCommitment(
    initialSlot,
    new Uint8Array(initialSlot.length),
    bigIntToVmNumber(10n),
  );
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, {
    extraOutputs: (categoryId) => [{
      address: getEntryNftAddress(base, categoryId, 'values'),
      satoshis: 10000n,
      token: {
        amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(initialCommitment) },
      },
    }],
  });
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const master = setup.masterUtxo;
  const entryAddress = getEntryNftAddress(contract, setup.categoryId, 'values');
  const entry = setup.extraUtxos?.[0];
  if (!master || !entry?.token?.nft?.commitment) {
    throw new Error('mapping fixture did not create its authenticated entry');
  }
  const decoded = decodeEntryCommitment(hexToBin(entry.token.nft.commitment));
  const nextCommitment = encodeEntryCommitment(
    decoded.slot,
    decoded.nextKey,
    bigIntToVmNumber(tamperValue ? 16n : 15n),
  );
  const plan = layer3.planCompiledGraph([
    { artifact, lockingBytecode: contract.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'add', args: [1n, 5n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    master,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(entry, createEntryNftUnlocker(contract, 0, setup.categoryId, 'values'));
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress, amount: master.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: entryAddress, amount: entry.satoshis,
    token: {
      category: setup.categoryId,
      amount: 0n,
      nft: { capability: 'mutable', commitment: binToHex(nextCommitment) },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  return { provider, transaction: raw(tx), layout };
}

async function buildCallerAuthorizedTransferGraph(forgeCallerWitness = false) {
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
  const tokenArtifact = compileString(`pragma solidcash >=0.8.0;
    contract GraphAllowanceToken() {
      mapping(bytes20 => bigint) balances;
      mapping(bytes20 => mapping(address => bigint)) allowance;
      function transferFrom(bytes20 from, bytes20 to, bigint amount) public {
        require(this.allowance[from][msg.sender] >= amount);
        require(this.balances[from] >= amount);
        this.allowance[from][msg.sender] = this.allowance[from][msg.sender] - amount;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
      }
    }`, options);
  const tokenBase = new Contract(tokenArtifact, [], { provider });
  const tokenSetup = await setupStatefulUtxos(
    provider, tokenBase, tokenArtifact.stateLayout!, {},
  );
  const token = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));
  const callerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IGraphAllowanceToken {
      function transferFrom(bytes20 from, bytes20 to, bigint amount);
    }
    contract GraphAllowanceRouter(int brand, address token) {
      function route(
        bytes20 from, bytes20 first, bytes20 second, bigint firstAmount, bigint secondAmount
      ) public {
        IGraphAllowanceToken(token).transferFrom(from, first, firstAmount);
        IGraphAllowanceToken(token).transferFrom(from, second, secondAmount);
        require(true);
      }
    }`, options);
  const callerBase = new Contract(callerArtifact, [1n, token.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));
  const from = hexToBin('31'.repeat(20));
  const first = hexToBin('32'.repeat(20));
  const second = hexToBin('33'.repeat(20));
  const balanceRows = [
    { slot: keyToSlot(from), value: 100n },
    { slot: keyToSlot(first), value: 0n },
    { slot: keyToSlot(second), value: 0n },
    // The covenant orders slots with OP_BIN2NUM + OP_LESSTHAN, i.e. as little-endian VM numbers. Sorting the
    // bytes lexicographically would build a linked list the sorted-list invariant rejects.
  ].sort((left, right) => Number(bytesToSlotValue(left.slot) - bytesToSlotValue(right.slot)));
  const balanceCommitments = new Map(balanceRows.map((row, index) => [
    binToHex(row.slot),
    encodeEntryCommitment(
      row.slot,
      balanceRows[index + 1]?.slot ?? new Uint8Array(32),
      bigIntToVmNumber(row.value),
    ),
  ]));
  // `Contract.lockingBytecode` is hex; the covenant hashes the raw script bytes, so the spender key must be
  // decoded before it reaches the slot derivation.
  const allowanceSlot = keyToSlotMulti([from, hexToBin(caller.lockingBytecode)]);
  const allowanceCommitment = encodeEntryCommitment(
    allowanceSlot, new Uint8Array(32), bigIntToVmNumber(50n),
  );
  const entries = [
      {
        satoshis: 10000n,
        token: {
          category: tokenSetup.categoryId,
          amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: binToHex(balanceCommitments.get(binToHex(keyToSlot(from)))!),
          },
        },
      },
      {
        satoshis: 10000n,
        token: {
          category: tokenSetup.categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: binToHex(allowanceCommitment) },
        },
      },
      ...[first, second].map((recipient) => ({
        satoshis: 10000n,
        token: {
          category: tokenSetup.categoryId,
          amount: 0n,
          nft: {
            capability: 'mutable' as const,
            commitment: binToHex(balanceCommitments.get(binToHex(keyToSlot(recipient)))!),
          },
        },
      })),
  ].map((entry) => randomUtxo(entry));
  await provider.addUtxo(
    getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entries[0],
  );
  await provider.addUtxo(
    getEntryNftAddress(token, tokenSetup.categoryId, 'allowance'), entries[1],
  );
  await provider.addUtxo(
    getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entries[2],
  );
  await provider.addUtxo(
    getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entries[3],
  );
  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: tokenArtifact, lockingBytecode: token.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'route', args: [from, first, second, 10n, 20n] },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, first, 10n] },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, second, 20n] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxos = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50000n });
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const tokenRoute = token.createCompilerRouteUnlocker(
    tokenArtifact.hiddenBatch!.route, hexToBin(tokenArtifact.hiddenBatch!.selector),
  );
  const tokenRouteArgs = [
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput),
  ] as FunctionArgument[];
  // Route input 7 is `__scb_key_allowance_sender_1`, the spender key the route must tie to the authenticated
  // graph caller.
  if (forgeCallerWitness) tokenRouteArgs[7] = hexToBin(token.lockingBytecode);
  // C2 batch groups follow the wrapper's journal order: allowance[from][spender], balances[from], then
  // balances[to] once per row. `entries` is laid out [from-balance, allowance, first, second]. Entry inputs are
  // addressed by an explicit per-group offset, but the write-backs are positional (activeInputIndex + 1 + group),
  // so the settled outputs have to be emitted in this same order.
  const journalOrder = [1, 0, 2, 3];
  for (const routeSlot of journalOrder) {
    const entry = entries[routeSlot];
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    tokenRouteArgs.push(decoded.slot, BigInt(routeSlot + 1), decoded.nextKey, -1n);
  }
  tokenRouteArgs.push(0n);
  const nextValues = [70n, 10n, 20n];
  const nextBalances = new Map([from, first, second].map((key, index) => [
    binToHex(keyToSlot(key)),
    bigIntToVmNumber(nextValues[index]),
  ]));
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    tokenSetup.masterUtxo,
    tokenRoute(...tokenRouteArgs as any),
  );
  // Every entry is authorized by co-spending the token master, which this graph places at input 1.
  entries.forEach((entry, slotIndex) =>
    tx.addInput(entry, createEntryNftUnlocker(
      token, 1, tokenSetup.categoryId, slotIndex === 1 ? 'allowance' : 'balances',
    )));
  projectionUtxos.forEach((proof, participant) =>
    tx.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress, amount: callerSetup.masterUtxo.satoshis,
    token: {
      category: callerSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: token.tokenAddress, amount: tokenSetup.masterUtxo.satoshis,
    token: {
      category: tokenSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  for (const slotIndex of journalOrder) {
    const entry = entries[slotIndex];
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    const value = slotIndex === 1
      ? bigIntToVmNumber(20n)
      : nextBalances.get(binToHex(decoded.slot))!;
    tx.addOutput({
      to: getEntryNftAddress(token, tokenSetup.categoryId, slotIndex === 1 ? 'allowance' : 'balances'),
      amount: entry.satoshis,
      token: {
        category: tokenSetup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(decoded.slot, decoded.nextKey, value)),
        },
      },
    });
  }
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  const tokenInputBytes = tx.buildLibauthTransaction().inputs[1].unlockingBytecode.length;
  return { provider, transaction: raw(tx), layout, tokenInputBytes };
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

  it('rejects a canonical graph whose child arguments differ from the source-executed call', async () => {
    const { provider, transaction } = await build(false, false, false, false, false, false, 2n);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('binds conditional call reachability to the runtime emission cursor', async () => {
    const taken = await build(false, false, false, false, false, false, 1n,
      { take: true, includeChild: true });
    await expect(taken.provider.sendRawTransaction(taken.transaction)).resolves.toBeTypeOf('string');

    const skipped = await build(false, false, false, false, false, false, 1n,
      { take: false, includeChild: false });
    await expect(skipped.provider.sendRawTransaction(skipped.transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects omitted and injected conditional child rows', async () => {
    const omitted = await build(false, false, false, false, false, false, 1n,
      { take: true, includeChild: false });
    await expect(omitted.provider.sendRawTransaction(omitted.transaction)).rejects.toThrow();

    const injected = await build(false, false, false, false, false, false, 1n,
      { take: false, includeChild: true });
    await expect(injected.provider.sendRawTransaction(injected.transaction)).rejects.toThrow();
  });

  it('consumes one authenticated child row per reached loop iteration', async () => {
    const repeated = await build(false, false, false, false, false, false, 1n, undefined, 2);
    await expect(repeated.provider.sendRawTransaction(repeated.transaction)).resolves.toBeTypeOf('string');
  });

  it('binds a compiler-evaluated call expression to the canonical child row', async () => {
    const exact = await build(
      false, false, false, false, false, false, 1n, undefined, undefined,
      undefined, false, false, false, 7n,
    );
    await expect(exact.provider.sendRawTransaction(exact.transaction)).resolves.toBeTypeOf('string');

    const substituted = await build(
      false, false, false, false, false, false, 1n, undefined, undefined,
      undefined, false, false, false, 8n,
    );
    await expect(substituted.provider.sendRawTransaction(substituted.transaction)).rejects.toThrow();
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

  it('rejects aliasing two participant projections to one physical proof input', async () => {
    const { provider, transaction } = await build(false, false, false, false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('rejects a valid controller covenant carrying a forged token category', async () => {
    const { provider, transaction } = await build(false, false, false, false, false, true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('supplies graph msg.sender from the authenticated parent participant', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n, undefined, undefined,
      { forgeExpected: false },
    );
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects using a different participant as graph msg.sender', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n, undefined, undefined,
      { forgeExpected: true },
    );
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('constructs graph msg.data from the authenticated selector and row arguments', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n, undefined, undefined, undefined, true,
    );
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('commits compiler-derived staticcall mode for a read-only callee', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n,
      undefined, undefined, undefined, false, true,
    );
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a transcript block size that differs from the compiler-owned route', async () => {
    const { provider, transaction } = await build(
      false, false, false, false, false, false, 1n,
      undefined, undefined, undefined, false, false, true,
    );
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('authenticates compiler-produced return blobs in balanced owner slots', async () => {
    const {
      provider, transaction, artifactA, plan, resultA,
    } = await buildReturning();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    expect(layer3.decodeHiddenBatchResults(artifactA, plan.participants[0].batch, resultA))
      .toEqual([{ row: 0, type: 'int256', value: 5n }]);
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

  it('composes an ordinary event NFT inside the compiler-derived balanced block', async () => {
    const { provider, transaction, layout } = await buildEventGraph();
    expect(layout.participantInputs).toEqual([0]);
    expect(layout.controllerInput).toBe(10);
    expect(layout.totalSlots).toBe(12);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects substituting the event-NFT covenant in a balanced graph slot', async () => {
    const { provider, transaction } = await buildEventGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('settles a compiler-authenticated satoshi effect inside a balanced graph block', async () => {
    const { provider, transaction, layout } = await buildValueEffectGraph();
    expect(layout.controllerInput).toBe(4);
    expect(layout.totalSlots).toBe(6);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects changing a compiler-authenticated graph effect amount', async () => {
    const { provider, transaction } = await buildValueEffectGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('journals an authenticated mapping entry inside a balanced graph block', async () => {
    const { provider, transaction, layout } = await buildMappingGraph();
    expect(layout.participantInputs).toEqual([0]);
    expect(layout.controllerInput).toBe(3);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a forged mapping-entry post-state in graph settlement', async () => {
    const { provider, transaction } = await buildMappingGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

  it('settles two msg.sender-authorized ERC-20 transfers in one balanced graph', async () => {
    const {
      provider, transaction, layout, tokenInputBytes,
    } = await buildCallerAuthorizedTransferGraph();
    expect(layout.participantInputs).toEqual([0, 1]);
    expect(layout.controllerInput).toBe(8);
    expect(layout.totalSlots).toBe(10);
    // Deployability is part of the claim, not a side effect: the honest token input has to clear BCH's
    // 10,000-byte input-script limit with room to spare, so a later codegen change cannot creep past it.
    expect(tokenInputBytes).toBeLessThanOrEqual(MAXIMUM_INPUT_BYTES - INPUT_HEADROOM_BYTES);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects substituting the allowance spender witness for the authenticated caller', async () => {
    const { provider, transaction } = await buildCallerAuthorizedTransferGraph(true);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow();
  });

});
