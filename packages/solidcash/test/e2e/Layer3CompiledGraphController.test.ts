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
  createDataNftUnlocker, getDataNftAddress, getEventNftAddress,
} from '../../src/stateful/covenant-helpers.js';

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
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
  const graphInvocations = staticAuth ? [
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

});
