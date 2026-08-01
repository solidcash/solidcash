import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode, type Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createSatoshiContainerUnlocker, getSatoshiContainerAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * E2 - call options and bounded iterated low-level calls.
 *
 * The admitted low-level class is ONE `address.call/staticcall(payload)` per handler, plus the singular
 * unconditional raw `call{value: amount}` form. This file pins mode, target, calldata, result, and for that
 * value-bearing form the option byte, recipient, amount, and container settlement. Gas/salt, staticcall-value,
 * conditional, and iterated forms stay fail-closed rather than silently degrading.
 *
 * SEMANTIC evidence only, on createLayer3SemanticTestProvider (layer3-bch2026-semantic-relaxed-v1: BCH-2026
 * opcode, introspection and 128-byte commitment behaviour, relaxed capacity).
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedResult = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);

const RAW_CALLER = `pragma solidcash >=0.8.0;
contract E2RawCaller() {
  function run(address target, bytes payload) public {
    (bool ok, bytes result) = target.call(payload);
    require(ok && result == hex"53");
  }
}`;
const RAW_STATIC_CALLER = RAW_CALLER
  .replace('E2RawCaller', 'E2RawStaticCaller')
  .replace('.call(payload)', '.staticcall(payload)');
const RAW_LOOP_CALLER = `pragma solidcash >=0.8.0;
contract E2RawLoopCaller() {
  function run(address[2] targets, bytes payload) public {
    for (int i = 0; i < 2; i = i + 1) {
      (bool ok, bytes result) = targets[i].call(payload);
      require(ok && result == hex"53");
    }
    require(payload.length > 0);
  }
}`;
const RAW_VALUE_CALLER = `pragma solidcash >=0.8.0;
contract E2RawValueCaller() {
  function run(address target, bytes payload, int amount) public {
    (bool ok, bytes result) = target.call{value: amount}(payload);
    require(ok && result == hex"53" && amount > 0);
  }
}`;
/**
 * X18: the VOID spelling of the same admitted callsite. `LowLevelCallShapes` listed it as ADMITTED while the
 * bus route leaked `Block slot not found: lowLevelCall[0]` for it; it now lowers to the same opaque `__raw__`
 * transcript row as the returning spelling, with no result binding.
 */
const RAW_VOID_CALLER = `pragma solidcash >=0.8.0;
contract E2RawVoidCaller() {
  function run(address target, bytes payload) public {
    target.call(payload);
    require(payload.length > 0);
  }
}`;
const RAW_VOID_STATIC_CALLER = RAW_VOID_CALLER
  .replace('E2RawVoidCaller', 'E2RawVoidStaticCaller')
  .replace('.call(payload)', '.staticcall(payload)');
/** A callee with no return: a void row must bind mode/target/calldata with no result field at all. */
const RAW_VOID_TARGET = `pragma solidcash >=0.8.0;
contract E2RawVoidTarget() {
  function poke(int value) public pure { require(value >= 0); }
}`;
const RAW_TARGET = `pragma solidcash >=0.8.0;
contract E2RawTarget() {
  function echo(int value) public returns (int) {
    require(value >= 0);
    return value;
  }
}`;

/** Identical bodies except for the `{value: amount}` call option. */
const VALUE_OPTION_CALLER = `pragma solidcash >=0.8.0;
interface IE2Sink { function take(int amount); }
contract E2ValueCaller() {
  function run(address target, int amount) public {
    IE2Sink(target).take{value: amount}(amount);
    require(amount > 0);
  }
}`;
const OPTION_FREE_CALLER = VALUE_OPTION_CALLER
  .replace('E2ValueCaller', 'E2PlainCaller')
  .replace('take{value: amount}', 'take');
const SINK_TARGET = `pragma solidcash >=0.8.0;
contract E2Sink() {
  function take(int amount) public pure { require(amount > 0); }
}`;

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

async function createGraphAuthority(provider: SemanticProvider): Promise<any> {
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
  provider: SemanticProvider, controller: Contract, genesisUtxo: any,
  categoryId: string, root: string, p2pkh: Contract,
): Promise<any> {
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

interface RawGraphOptions {
  staticCall?: boolean;
  /** Commit a result the callee did not produce: attacks the opaque return field of the low-level row. */
  tamperResult?: boolean;
  /** Forge one mutable resource after an otherwise honest read-only target has returned. */
  tamperStaticResource?: 'state' | 'event' | 'value' | 'token';
}

async function buildRawCallGraph(
  graphOptions: RawGraphOptions = {},
): Promise<{ provider: SemanticProvider; builder: TransactionBuilder; transaction: string; plan: any }> {
  const provider = createLayer3SemanticTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactB = compileString(RAW_TARGET, options);
  const baseB = new Contract(artifactB, [], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(graphOptions.staticCall ? RAW_STATIC_CALLER : RAW_CALLER, options);
  const baseA = new Contract(artifactA, [], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const selector = artifactB.abi.find((fn) => fn.name === 'echo')!.selector!;
  const payload = Uint8Array.from([...hexToBin(selector), ...packedResult(3n)]);
  const plan = layer3.deriveCompiledGraphPlan({
    root: { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    function: 'run',
    args: [b.lockingBytecode, payload],
    targets: {},
    dynamicCall: () => ({
      participant: { artifact: artifactB, lockingBytecode: b.lockingBytecode },
      function: 'echo',
      args: [3n],
    }),
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const result = packedResult(3n);
  const transcript = layer3.finalizeCompiledGraph(
    plan, { 1: binToHex(result) },
    layout.participantInputs, layout.returnOutputs, ['', binToHex(result)], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const returnFunding = randomUtxo({ satoshis: 1000n });
  const projections = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50_000n });
  await provider.addUtxo(p2pkh.address, returnFunding);
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setupA.masterUtxo,
    routeA(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    setupB.masterUtxo,
    routeB(
      ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
      BigInt(layout.returnOutputs[1]!),
    ),
  );
  tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
  projections.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: graphOptions.tamperStaticResource === 'event' ? hexToBin('51') : b.tokenAddress,
    amount: setupB.masterUtxo.satoshis
      + (graphOptions.tamperStaticResource === 'value' ? 1n : 0n),
    token: {
      category: setupB.categoryId,
      amount: graphOptions.tamperStaticResource === 'token' ? 1n : 0n,
      nft: {
        capability: 'minting',
        commitment: graphOptions.tamperStaticResource === 'state' ? '01' : '',
      },
    },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: {
        capability: 'none',
        commitment: binToHex(aggregateResult(graphOptions.tamperResult ? 4n : 3n)),
      },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, builder: tx, transaction: raw(tx), plan };
}

async function buildRawLoopGraph(graphOptions: { tamperProducerAt?: 1 | 2 } = {}): Promise<{
  provider: SemanticProvider; builder: TransactionBuilder; transaction: string; plan: any;
}> {
  const provider = createLayer3SemanticTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactTarget = compileString(RAW_TARGET, options);
  const targetSetups = [];
  const targets = [];
  for (let index = 0; index < 2; index += 1) {
    const base = new Contract(artifactTarget, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifactTarget.stateLayout!, {});
    targetSetups.push(setup);
    targets.push(base.withCategory(hexToBin(setup.categoryId)));
  }
  const artifactCaller = compileString(RAW_LOOP_CALLER, options);
  const baseCaller = new Contract(artifactCaller, [], { provider });
  const callerSetup = await setupStatefulUtxos(
    provider, baseCaller, artifactCaller.stateLayout!, {},
  );
  const caller = baseCaller.withCategory(hexToBin(callerSetup.categoryId));
  const selector = artifactTarget.abi.find((fn) => fn.name === 'echo')!.selector!;
  const payload = Uint8Array.from([...hexToBin(selector), ...packedResult(3n)]);
  const plan = layer3.deriveCompiledGraphPlan({
    root: { artifact: artifactCaller, lockingBytecode: caller.lockingBytecode },
    function: 'run',
    args: [targets.map((target) => hexToBin(target.lockingBytecode)), payload],
    targets: {},
    dynamicCall: ({ occurrence }: { occurrence: number }) => ({
      participant: {
        artifact: artifactTarget, lockingBytecode: targets[occurrence]!.lockingBytecode,
      },
      function: 'echo',
      args: [3n],
    }),
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const result = binToHex(packedResult(3n));
  const transcript = layer3.finalizeCompiledGraph(
    plan, { 1: result, 2: result }, layout.participantInputs, layout.returnOutputs,
    ['', result, result], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const returnFunding = Array.from({ length: 2 }, () => randomUtxo({ satoshis: 1000n }));
  const projections = Array.from({ length: 3 }, () => randomUtxo({ satoshis: 1000n }));
  const fee = randomUtxo({ satoshis: 50_000n });
  for (const utxo of [...returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);
  for (const proof of projections) await provider.addUtxo(projection.address, proof);

  const callerRoute = caller.createCompilerRouteUnlocker(
    artifactCaller.hiddenBatch!.route, hexToBin(artifactCaller.hiddenBatch!.selector),
  );
  const targetRoutes = targets.map((target) => target.createCompilerRouteUnlocker(
    artifactTarget.hiddenBatch!.route, hexToBin(artifactTarget.hiddenBatch!.selector),
  ));
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(callerSetup.masterUtxo, callerRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  for (let participant = 1; participant <= 2; participant += 1) {
    tx.addInput(targetSetups[participant - 1]!.masterUtxo, targetRoutes[participant - 1]!(
      ...layer3.compiledGraphRouteArgs(transcript, participant, layout.controllerInput) as any,
      BigInt(layout.returnOutputs![participant]!),
    ));
    tx.addInput(returnFunding[participant - 1]!, p2pkh.unlock.spend(alicePub, signature()));
  }
  projections.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: caller.tokenAddress, amount: callerSetup.masterUtxo.satoshis,
    token: {
      category: callerSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  for (let participant = 1; participant <= 2; participant += 1) {
    const setup = targetSetups[participant - 1]!;
    tx.addOutput({
      to: targets[participant - 1]!.tokenAddress, amount: setup.masterUtxo.satoshis,
      token: {
        category: setup.categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    });
    tx.addOutput({
      to: hexToBin('51'), amount: 1000n,
      token: {
        category: setup.categoryId, amount: 0n,
        nft: {
          capability: 'none',
          commitment: binToHex(aggregateResult(graphOptions.tamperProducerAt === participant ? 4n : 3n)),
        },
      },
    });
  }
  projections.forEach(() => tx.addOutput({ to: p2pkh.address, amount: 1000n }));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, builder: tx, transaction: raw(tx), plan };
}

interface RawValueGraphOptions {
  tamperAmount?: boolean;
  tamperContainerLoss?: boolean;
  tamperRecipient?: boolean;
  tamperOption?: 0 | 4;
  tamperResult?: boolean;
}

async function buildRawValueGraph(
  hostile: RawValueGraphOptions = {},
): Promise<{ provider: SemanticProvider; builder: TransactionBuilder; transaction: string; plan: any }> {
  const provider = createLayer3SemanticTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactB = compileString(RAW_TARGET, options);
  const baseB = new Contract(artifactB, [], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const artifactA = compileString(RAW_VALUE_CALLER, options);
  const baseA = new Contract(artifactA, [], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const selector = artifactB.abi.find((fn) => fn.name === 'echo')!.selector!;
  const payload = Uint8Array.from([...hexToBin(selector), ...packedResult(3n)]);
  const amount = 3000n;
  const derivedPlan = layer3.deriveCompiledGraphPlan({
    root: { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    function: 'run',
    args: [b.lockingBytecode, payload, amount],
    targets: {},
    dynamicCall: () => ({
      participant: { artifact: artifactB, lockingBytecode: b.lockingBytecode },
      function: 'echo',
      args: [3n],
    }),
  });
  const plan = hostile.tamperOption === undefined ? derivedPlan : {
    ...derivedPlan,
    invocations: derivedPlan.invocations.map((invocation, index) => index === 1
      ? { ...invocation, callOptions: hostile.tamperOption! }
      : invocation),
  };
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const result = packedResult(3n);
  const transcript = layer3.finalizeCompiledGraph(
    plan, { 1: binToHex(result) }, layout.participantInputs, layout.returnOutputs,
    ['', binToHex(result)], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const container = randomUtxo({ satoshis: 10_000n });
  await provider.addUtxo(getSatoshiContainerAddress(a, setupA.categoryId), container);
  const transferFunding = Array.from({ length: 8 }, () => randomUtxo({ satoshis: 1000n }));
  const returnFunding = randomUtxo({ satoshis: 1000n });
  const projections = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 80_000n });
  for (const utxo of [...transferFunding, returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);
  for (const proof of projections) await provider.addUtxo(projection.address, proof);

  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(setupA.masterUtxo, routeA(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  tx.addInput(container, createSatoshiContainerUnlocker(a, layout.participantInputs[0], setupA.categoryId));
  transferFunding.forEach((utxo) => tx.addInput(utxo, p2pkh.unlock.spend(alicePub, signature())));
  tx.addInput(setupB.masterUtxo, routeB(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![1]!),
  ));
  tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getSatoshiContainerAddress(a, setupA.categoryId),
    amount: container.satoshis - (hostile.tamperAmount ? amount + 1n : amount)
      - (hostile.tamperContainerLoss ? 1n : 0n),
  });
  tx.addOutput({
    to: hostile.tamperRecipient ? p2pkh.address : hexToBin(b.lockingBytecode),
    amount: hostile.tamperAmount ? amount + 1n : amount,
  });
  for (let slot = 1; slot < 8; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: setupB.categoryId, amount: 0n,
      nft: {
        capability: 'none',
        commitment: binToHex(aggregateResult(hostile.tamperResult ? 4n : 3n)),
      },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 50_000n });
  return { provider, builder: tx, transaction: raw(tx), plan };
}

interface VoidRawGraphOptions {
  staticCall?: boolean;
  /** Commit calldata the caller did not authorize: attacks the CALLDATA field of a void low-level row. */
  tamperCalldata?: boolean;
  /** Make the co-spent callee attest the CALLER's row instead of its own: attacks row/participant binding. */
  tamperParticipantRow?: boolean;
}

/**
 * X18: the same two-participant graph as `buildRawCallGraph`, but the caller writes the VOID spelling
 * `target.call(payload);` into a callee that returns nothing. There is no result field to bind, so the row
 * must stand on mode, target and calldata alone.
 */
async function buildVoidRawCallGraph(
  graphOptions: VoidRawGraphOptions = {},
): Promise<{ provider: SemanticProvider; builder: TransactionBuilder; transaction: string; plan: any }> {
  const provider = createLayer3SemanticTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const artifactB = compileString(RAW_VOID_TARGET, options);
  const baseB = new Contract(artifactB, [], { provider });
  const setupB = await setupStatefulUtxos(provider, baseB, artifactB.stateLayout!, {});
  const b = baseB.withCategory(hexToBin(setupB.categoryId));
  const compiled = compileString(
    graphOptions.staticCall ? RAW_VOID_STATIC_CALLER : RAW_VOID_CALLER, options,
  );
  // PROBE, not a fixture: `worklist.ts` routes a raw edge to `dynamicCall` only when the ABI declares
  // `opaqueReturn`, which a VOID edge must not claim - it returns nothing. Forcing the flag here isolates
  // that one gate, so a settlement below proves the rest of the raw-edge path already handles a void row.
  const artifactA: any = JSON.parse(JSON.stringify(compiled));
  artifactA.abi.find((fn: any) => fn.name === 'run').externalCalls[0].opaqueReturn = true;
  const baseA = new Contract(artifactA, [], { provider });
  const setupA = await setupStatefulUtxos(provider, baseA, artifactA.stateLayout!, {});
  const a = baseA.withCategory(hexToBin(setupA.categoryId));
  const selector = artifactB.abi.find((fn) => fn.name === 'poke')!.selector!;
  const argument = graphOptions.tamperCalldata ? 4n : 3n;
  const payload = Uint8Array.from([...hexToBin(selector), ...packedResult(3n)]);
  const plan = layer3.deriveCompiledGraphPlan({
    root: { artifact: artifactA, lockingBytecode: a.lockingBytecode },
    function: 'run',
    args: [b.lockingBytecode, payload],
    targets: {},
    dynamicCall: () => ({
      participant: { artifact: artifactB, lockingBytecode: b.lockingBytecode },
      function: 'poke',
      args: [argument],
    }),
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projections = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50_000n });
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const routeA = a.createCompilerRouteUnlocker(
    artifactA.hiddenBatch!.route, hexToBin(artifactA.hiddenBatch!.selector),
  );
  const routeB = b.createCompilerRouteUnlocker(
    artifactB.hiddenBatch!.route, hexToBin(artifactB.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    setupA.masterUtxo,
    routeA(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    setupB.masterUtxo,
    routeB(...layer3.compiledGraphRouteArgs(
      transcript, graphOptions.tamperParticipantRow ? 0 : 1, layout.controllerInput,
    ) as any),
  );
  projections.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: a.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: b.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, builder: tx, transaction: raw(tx), plan };
}

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

const busOptions = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

/** Deep clone so a forged-ABI case never leaks into another test's artifact. */
const clone = (artifact: Artifact): any => JSON.parse(JSON.stringify(artifact));

/** Plan a two-participant raw-call graph from artifacts alone; no chain state is needed to reach the gates. */
const planRaw = (callerArtifact: any, targetArtifact: any, overrides?: (call: any) => void): unknown => {
  const caller = clone(callerArtifact);
  const run = caller.abi.find((fn: any) => fn.name === 'run');
  if (overrides) overrides(run.externalCalls[0]);
  const selector = targetArtifact.abi.find((fn: any) => fn.name === 'echo').selector;
  const targetLbc = `aa20${'ab'.repeat(32)}87`;
  const payload = Uint8Array.from([...hexToBin(selector), ...packedResult(3n)]);
  return layer3.deriveCompiledGraphPlan({
    root: { artifact: caller, lockingBytecode: `aa20${'cd'.repeat(32)}87` },
    function: 'run',
    args: [targetLbc, payload],
    targets: {},
    dynamicCall: () => ({
      participant: { artifact: targetArtifact, lockingBytecode: targetLbc },
      function: 'echo',
      args: [3n],
    }),
  });
};

describe('Layer-3 call options and low-level iteration (E2, SEMANTIC)', () => {
  describe('the admitted exact raw-call loop binds both ordered occurrences', () => {
    it('settles two authenticated low-level call edges to distinct targets', async () => {
      const built = await buildRawLoopGraph();
      expect(built.plan.invocations).toHaveLength(3);
      expect(failingInput(built.builder)).toBe(null);
      await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
    }, 120_000);

    it.each([1, 2] as const)(
      'rejects a forged producer result at ordered occurrence %i',
      async (occurrence) => {
        const built = await buildRawLoopGraph({ tamperProducerAt: occurrence });
        // Each callee master is followed by its return-funding input: physical inputs 1 and 3.
        expect(failingInput(built.builder)).toBe(occurrence === 1 ? 1 : 3);
        await expect(built.provider.sendRawTransaction(built.transaction))
          .rejects.toThrow(/mandatory-script-verify-flag-failed/);
      },
      120_000,
    );
  });

  describe('the admitted singular low-level class still binds its four fields', () => {
    it('settles an authenticated low-level call edge', async () => {
      const built = await buildRawCallGraph();
      expect(failingInput(built.builder)).toBe(null);
      await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
      expect(built.plan.invocations[1].callMode).toBe('call');
    }, 120_000);

    it('settles an authenticated low-level staticcall edge and commits the read-only mode', async () => {
      const built = await buildRawCallGraph({ staticCall: true });
      expect(failingInput(built.builder)).toBe(null);
      await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
      expect(built.plan.invocations[1].callMode).toBe('staticcall');
    }, 120_000);

    it.each(['state', 'event', 'value', 'token'] as const)(
      'rejects a staticcall whose target consumes a mutable %s resource at the controller',
      async (resource) => {
        const built = await buildRawCallGraph({ staticCall: true, tamperStaticResource: resource });
        // State/token forgeries are otherwise valid target transitions and reach the graph controller.
        // Locking-bytecode/value forgeries are additionally caught by the target route at input 1; either
        // ordering is a runtime boundary, and the honest case above proves the negative control.
        expect(failingInput(built.builder)).toBe(
          resource === 'state' || resource === 'token' ? 5 : 1,
        );
        await expect(built.provider.sendRawTransaction(built.transaction))
          .rejects.toThrow(/mandatory-script-verify-flag-failed/);
      },
      120_000,
    );

    // Attacks the RESULT field of the low-level row: the callee's committed return event. Input 1 is the
    // producer's own SCB1 route, which is what authenticates the commitment it publishes.
    it('rejects a committed result the low-level callee did not produce', async () => {
      const built = await buildRawCallGraph({ tamperResult: true });
      expect(failingInput(built.builder)).toBe(1);
      await expect(built.provider.sendRawTransaction(built.transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    }, 120_000);
  });

  /**
   * X18. The VOID spelling `target.call(payload);` was listed ADMITTED by the shape module while the bus
   * route leaked `Block slot not found: lowLevelCall[0]` for it. It now lowers to the same `__raw__`
   * transcript row as the returning spelling. These cases prove the row is authenticated, not merely
   * compilable: it binds mode, target and calldata with no result field to lean on.
   *
   * The settlement cases force ONE ABI flag - see the PROBE comment in `buildVoidRawCallGraph`. The pin
   * below states exactly what that probe stands in for, so the covenant evidence is not read as an
   * end-to-end claim about today's planner.
   */
  describe('the admitted VOID low-level class binds mode, target and calldata (X18)', () => {
    /**
     * OPEN: the compiler now publishes a void raw edge honestly - `interfaceName`/`functionName` `__raw__`,
     * no `opaqueReturn`, because the callsite returns nothing. `worklist.ts` routes a raw edge to
     * `dynamicCall` on `call.opaqueReturn` alone, so it does not recognize the honest artifact and reports
     * `no symbolic target registered for '__raw__'`, naming a compiler sentinel to the user.
     *
     * Repair: gate that branch on `interfaceName === '__raw__' && functionName === '__raw__'` - how the
     * compiler itself recognizes the edge - instead of on `opaqueReturn`. `packages/solidcash/src` is leased
     * elsewhere, so this is pinned rather than fixed. The settlement cases above show the rest of the
     * raw-edge path already handles a void row once that gate admits it.
     */
    // Was pinned OPEN by Worker C: the planner keyed its raw-edge branch off `opaqueReturn`, which a VOID
    // edge must not claim, so the honestly published artifact surfaced the internal sentinel. The integration
    // owner applied C's one-line handoff - recognize a raw edge by its compiler-authored `__raw__` identity -
    // and inverted this pin. It now asserts the planner accepts what the compiler publishes.
    it('recognizes the honestly published void raw edge without an opaqueReturn flag', () => {
      const busArtifact = compileString(RAW_VOID_CALLER, busOptions);
      const run = busArtifact.abi.find((fn) => fn.name === 'run')!;
      expect(run.externalCalls![0].interfaceName).toBe('__raw__');
      expect(run.externalCalls![0].opaqueReturn).toBeUndefined();
      expect(() => layer3.deriveCompiledGraphPlan({
        root: { artifact: busArtifact, lockingBytecode: `aa20${'cd'.repeat(32)}87` },
        function: 'run',
        args: [`aa20${'ab'.repeat(32)}87`, hexToBin('0011223344')],
        targets: {},
        dynamicCall: () => ({
          participant: { artifact: busArtifact, lockingBytecode: `aa20${'ab'.repeat(32)}87` },
          function: 'run',
          args: [],
        }),
      // It no longer emits the internal `no symbolic target registered for '__raw__'` sentinel. It now reaches
      // the genuine requirement for a raw edge - a decoded calldata proof - which this stub does not supply.
      // Reaching the real check IS the fix; a stub that satisfied it would be testing calldata, not recognition.
      })).toThrow(/raw callsite 0 (decoded|lacks)/);
      expect(() => layer3.deriveCompiledGraphPlan({
        root: { artifact: busArtifact, lockingBytecode: `aa20${'cd'.repeat(32)}87` },
        function: 'run',
        args: [`aa20${'ab'.repeat(32)}87`, hexToBin('0011223344')],
        targets: {},
        dynamicCall: () => ({
          participant: { artifact: busArtifact, lockingBytecode: `aa20${'ab'.repeat(32)}87` },
          function: 'run',
          args: [],
        }),
      })).not.toThrow(/no symbolic target registered/);
    });

    it('settles an authenticated VOID low-level call edge', async () => {
      const built = await buildVoidRawCallGraph();
      expect(failingInput(built.builder)).toBe(null);
      await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
      expect(built.plan.invocations[1].callMode).toBe('call');
      expect(built.plan.invocations[0].resultDependencies).toEqual([]);
    }, 120_000);

    it('settles an authenticated VOID low-level staticcall edge and commits the read-only mode', async () => {
      const built = await buildVoidRawCallGraph({ staticCall: true });
      expect(failingInput(built.builder)).toBe(null);
      await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
      expect(built.plan.invocations[1].callMode).toBe('staticcall');
    }, 120_000);

    // Attacks the CALLDATA field. A void row publishes no result, so calldata is the only thing tying the
    // co-spent callee's execution to the caller's committed payload; decoding must be canonical.
    it('rejects decoded calldata a VOID caller did not commit', async () => {
      await expect(buildVoidRawCallGraph({ tamperCalldata: true }))
        .rejects.toThrow(/decoded calldata is not canonical/);
    }, 120_000);

    // Hostile, on the VM rather than in the planner: the co-spent callee attests the CALLER's row instead of
    // its own, so the void edge's callee half is unproven. Input 1 is the callee's own SCB1 route - the
    // covenant that has to reject it. The honest build above is the negative control for this case.
    it('rejects a co-spent callee attesting a row that is not its own, at input 1', async () => {
      const built = await buildVoidRawCallGraph({ tamperParticipantRow: true });
      expect(failingInput(built.builder)).toBe(1);
      await expect(built.provider.sendRawTransaction(built.transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    }, 120_000);
  });

  describe('call options are not an admitted graph edge', () => {
    const optionFree = compileString(OPTION_FREE_CALLER, busOptions);
    const withOption = compileString(VALUE_OPTION_CALLER, busOptions);
    const sink = compileString(SINK_TARGET, busOptions);

    // The two artifacts differ by exactly `{value: amount}` in the source.
    it('publishes a direct-route transfer covenant but no admitted graph-edge difference', () => {
      expect(withOption.bytecode).not.toBe(optionFree.bytecode);
      const abi = withOption.abi.find((fn) => fn.name === 'run')!;
      expect(abi.transferCount).toBe(1);
      expect(abi.blockLayout!.slots.map((slot) => slot.kind))
        .toEqual(['master', 'satoshiContainer', 'transfer']);
      // The compiler-authored graph edge itself remains indistinguishable from the option-free one.
      expect(JSON.stringify(abi.externalCalls))
        .toBe(JSON.stringify(optionFree.abi.find((fn) => fn.name === 'run')!.externalCalls));
    });

    // Honest control: same source, option removed.
    it('plans the option-free typed edge', () => {
      const target = { artifact: sink, lockingBytecode: `aa20${'ab'.repeat(32)}87` };
      const plan = layer3.deriveCompiledGraphPlan({
        root: { artifact: optionFree, lockingBytecode: `aa20${'cd'.repeat(32)}87` },
        function: 'run',
        args: [target.lockingBytecode, 5n],
        targets: { IE2Sink: target },
      });
      expect(plan.participants).toHaveLength(2);
      expect(plan.invocations.map((row) => [row.parent, row.callee, row.function]))
        .toEqual([[null, 0, 'run'], [0, 1, 'take']]);
    });

    // Attacks the OPTIONS field: the transcript row has no place for it, so the row would execute as if the
    // option were absent. Rejection must name the option, not fail somewhere downstream.
    it('rejects a participant function that carries a value call option', () => {
      const target = { artifact: sink, lockingBytecode: `aa20${'ab'.repeat(32)}87` };
      expect(() => layer3.deriveCompiledGraphPlan({
        root: { artifact: withOption, lockingBytecode: `aa20${'cd'.repeat(32)}87` },
        function: 'run',
        args: [target.lockingBytecode, 5n],
        targets: { IE2Sink: target },
      })).toThrow(/declares 1 value option\(s\)\/transfer\(s\), which the transcript row does not bind/);
    });

    /*
     * X144. This was a bare `toThrow()` on `compileString`, so ANY compile failure satisfied it - a syntax
     * error, a pragma bump, a grammar regression - and the low-level value-option refusal it names could have
     * been deleted outright without turning it red. Repaired as an attributable refusal plus the control that
     * differs in exactly the attacked field: the same source with the option removed must COMPILE.
     */
    const rawValueSource = (option: string): string => `pragma solidcash >=0.8.0;
contract E2RawValueCaller() {
  function run(address target, bytes payload, int amount) public {
    (bool ok, bytes result) = target.call${option}(payload);
    require(ok && result.length >= 0 && amount >= 0);
  }
}`;

    it('admits the singular raw value option while leaving the option-free form intact', () => {
      expect(() => compileString(rawValueSource(''), busOptions)).not.toThrow();
      const artifact = compileString(rawValueSource('{value: amount}'), busOptions);
      expect(artifact.abi.find((fn) => fn.name === 'run')!.transfers?.[0]).toMatchObject({
        recipient: { kind: 'forward', paramIndex: 0 },
        amount: { kind: 'forward', paramIndex: 2 },
        callOption: 'value',
      });
    });
  });

  describe('the singular raw value option binds its option and transfer', () => {
    it('settles the value-bearing raw edge', async () => {
      const built = await buildRawValueGraph();
      expect(built.plan.invocations[1].callOptions).toBe(2);
      expect(failingInput(built.builder)).toBe(null);
      await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
    }, 120_000);

    it.each([
      ['amount', { tamperAmount: true }, 0],
      ['container overdraw', { tamperContainerLoss: true }, 0],
      ['recipient', { tamperRecipient: true }, 0],
      ['missing option bit', { tamperOption: 0 as const }, 0],
      ['unsupported option bit', { tamperOption: 4 as const }, 0],
      ['result', { tamperResult: true }, 10],
    ])('rejects a forged %s', async (_name, hostile, input) => {
      const built = await buildRawValueGraph(hostile);
      expect(failingInput(built.builder)).toBe(input);
      await expect(built.provider.sendRawTransaction(built.transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    }, 120_000);
  });

  describe('low-level mode and occurrence are taken from the compiler, never coerced', () => {
    const callerArtifact = compileString(RAW_CALLER, busOptions);
    const targetArtifact = compileString(RAW_TARGET, busOptions);

    it('plans the compiler-authored call and staticcall modes', () => {
      expect((planRaw(callerArtifact, targetArtifact) as any).invocations[1].callMode).toBe('call');
      const staticArtifact = compileString(RAW_STATIC_CALLER, busOptions);
      expect(staticArtifact.abi.find((fn) => fn.name === 'run')!.externalCalls![0].callMode)
        .toBe('staticcall');
      expect((planRaw(staticArtifact, targetArtifact) as any).invocations[1].callMode).toBe('staticcall');
    });

    // Attacks the MODE field. The worklist refuses the artifact where it first reads the published mode;
    // `planCompiledGraph` now reads that mode too, whether or not the caller supplied one, so neither entry
    // point admits a delegate edge (its own case is in `Layer3OccurrenceBoundX36`).
    it('rejects a raw callsite declaring a delegatecall mode', () => {
      expect(() => planRaw(callerArtifact, targetArtifact, (call) => { call.callMode = 'delegatecall'; }))
        .toThrow(/declares call mode 'delegatecall', which is not a participant-graph edge/);
    });

    // Attacks the OCCURRENCE COUNT of a low-level row: a raw edge proves ONE decoded payload, so an iterated
    // callsite would be expanded as exactly one row whatever its runtime count is.
    it.each(['loop', 'conditional'] as const)('rejects a %s raw callsite', (occurrence) => {
      expect(() => planRaw(callerArtifact, targetArtifact, (call) => {
        call.occurrence = occurrence;
        call.maximumOccurrences = 3;
      })).toThrow(/has no bounded occurrence proof; iterated low-level calls are not an admitted graph edge/);
    });

    // Carries the E1 result invariants onto the low-level edge: exactly one producer, one consumer callsite
    // and one dependency, so the opaque return cannot answer two callsites.
    it('binds one canonical consumer callsite to the low-level result edge', () => {
      const plan = planRaw(callerArtifact, targetArtifact) as any;
      expect(plan.invocations.map((invocation: any) => invocation.resultDependencies))
        .toEqual([[1], []]);
      expect(plan.invocations.map((invocation: any) => invocation.consumerCallsiteId))
        .toEqual([undefined, 0]);
    });

    // The structural reason a low-level result cannot be consumed twice today: exactly one low-level callsite
    // per graph handler, so a second raw callsite never reaches the planner. Before X6 was wired this reached
    // the user as `Graph handler '__scb_graph_run' requires call/staticcall edges and at most one returning
    // call`, naming a synthesized handler; that broader guard is still live for typed interface edges.
    it('rejects a handler holding two low-level callsites at compile time', () => {
      expect(() => compileString(`pragma solidcash >=0.8.0;
contract E2RawTwice() {
  function run(address first, address second, bytes payload) public {
    (bool okA, bytes a) = first.call(payload);
    (bool okB, bytes b) = second.call(payload);
    require(okA && okB && a == b);
  }
}`, busOptions)).toThrow(
        /function 'run' issues 2 low-level calls\. The admitted class is exactly one per handler/,
      );
    });

    // Attacks the CALLDATA field: the decoded arguments must re-encode to the exact committed payload.
    it('rejects decoded calldata that is not the committed payload', () => {
      const caller = clone(callerArtifact);
      const selector = targetArtifact.abi.find((fn) => fn.name === 'echo')!.selector!;
      const targetLbc = `aa20${'ab'.repeat(32)}87`;
      expect(() => layer3.deriveCompiledGraphPlan({
        root: { artifact: caller, lockingBytecode: `aa20${'cd'.repeat(32)}87` },
        function: 'run',
        args: [targetLbc, Uint8Array.from([...hexToBin(selector), ...packedResult(3n)])],
        targets: {},
        dynamicCall: () => ({
          participant: { artifact: targetArtifact, lockingBytecode: targetLbc },
          function: 'echo',
          args: [4n],
        }),
      })).toThrow(/decoded calldata is not canonical/);
    });

    // Attacks the TARGET field: the resolved calldata owner must be the caller's committed target argument.
    it('rejects a resolved callee other than the committed target', () => {
      const caller = clone(callerArtifact);
      const selector = targetArtifact.abi.find((fn) => fn.name === 'echo')!.selector!;
      expect(() => layer3.deriveCompiledGraphPlan({
        root: { artifact: caller, lockingBytecode: `aa20${'cd'.repeat(32)}87` },
        function: 'run',
        args: [`aa20${'ab'.repeat(32)}87`, Uint8Array.from([...hexToBin(selector), ...packedResult(3n)])],
        targets: {},
        dynamicCall: () => ({
          participant: { artifact: targetArtifact, lockingBytecode: `aa20${'ef'.repeat(32)}87` },
          function: 'echo',
          args: [3n],
        }),
      })).toThrow(/target proof disagrees with calldata owner/);
    });
  });
});
