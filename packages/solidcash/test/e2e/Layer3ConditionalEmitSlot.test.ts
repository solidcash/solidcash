import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { readEventsFromChain } from '../../src/stateful/StateReader.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createSatoshiContainerUnlocker,
  getDataNftAddress, getEventNftAddress, getSatoshiContainerAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * SEC-10. A one-armed conditional emit reserves its frame slot per DISPATCH SITE, unconditionally, because
 * `collectEmitStatements` allocates a slot for the longer branch of a `BranchNode` whether or not there is an
 * else. Codegen then wraps the whole event covenant verification in `OP_IF <blob non-empty>`
 * (emitEventCovenantVerification), so on a row where the branch is not taken the reserved output is checked by
 * NOTHING - not its commitment, not its locking bytecode, not its category, not its capability.
 *
 * That is exactly the capability SEC-9 exploited, and it survives SEC-9's repair: the repair compares
 * `emitInfos.length` across frame members, and a one-armed conditional emit CONTRIBUTES to that count while
 * settling nothing at runtime. So two handlers can have identical widths and still leave a reached site's slot
 * unverified.
 *
 * Measured here with `credited` as the single variable - it selects whether `note`'s second emit runs - against
 * a control that holds the forged output byte-identical and only takes the branch.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packed = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);

function uniqueUtxo(seen: Set<string>, defaults?: Parameters<typeof randomUtxo>[0]): ReturnType<typeof randomUtxo> {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const utxo = randomUtxo(defaults);
    const outpoint = `${utxo.txid}:${utxo.vout}`;
    if (seen.has(outpoint)) continue;
    seen.add(outpoint);
    return utxo;
  }
  throw new Error('could not draw a distinct funding outpoint');
}

const TRANSFER_SATS = 900n;

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

const legBSource = `pragma solidcash >=0.8.0;
contract EffectLegB(address hub) {
  uint seen;
  function credit(uint value) public {
    this.seen = this.seen + value;
    require(value > 0);
  }
}`;
const returningLegBSource = `pragma solidcash >=0.8.0;
contract EffectLegBResult(address hub) {
  uint seen;
  function credit(uint value) public returns (uint) {
    this.seen = this.seen + value;
    require(value > 0);
    return this.seen;
  }
}`;

/**
 * `note`'s SECOND emit is one-armed. Both handlers carry `emitInfos.length === 2`, so SEC-9's divergent-width
 * refusal admits the route and the frame reserves TWO event slots per dispatch site.
 */
const condHubSource = `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); }
contract Sec10EffectHub() {
  uint total;
  event Fired(uint value);
  function fireAll(address first, uint value, bytes recipient) public {
    emit Fired(value);
    emit Fired(value + 7);
    this.transfer(recipient, ${TRANSFER_SATS});
    IEffectLeg(first).credit(value);
    require(true);
  }
  function note(address first, uint credited) public {
    emit Fired(credited);
    if (credited > 100) { emit Fired(credited + 7); }
    IEffectLeg(first).credit(credited);
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;
const resultEffectHubSource = `pragma solidcash >=0.8.0;
interface IEffectLegResult { function credit(uint value) returns (uint); }
contract ResultEffectHub() {
  uint total;
  event Fired(uint value);
  function note(address first, uint credited) public {
    uint observed = IEffectLegResult(first).credit(credited);
    emit Fired(observed);
    this.total = observed;
    require(observed >= 0);
  }
}`;

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
  return { projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0] };
}

/** The minimal shape: ONE handler, ONE emit, and that emit one-armed. Frame width 1. */
const narrowHubSource = `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); }
contract Sec10NarrowHub() {
  uint total;
  event Fired(uint value);
  function note(address first, uint credited) public {
    if (credited > 100) { emit Fired(credited + 7); }
    IEffectLeg(first).credit(credited);
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;

interface CondCell {
  /** THE variable: `> 100` takes `note`'s one-armed branch, `<= 100` does not. */
  value: bigint;
  /** What the reached site's SECOND event slot carries. */
  second?: 'honest' | 'forge';
  /** What the reached site's FIRST event slot carries. Anchors "this site is the reached one". */
  first?: 'honest' | 'forge';
  /** Use the width-1 single-handler shape, whose only emit is the one-armed one. */
  narrow?: boolean;
  /** Exercise a consumed result together with the state write and event. */
  resultEffect?: boolean;
  tamperResult?: boolean;
}

async function buildConditionalEmitBatch(cell: CondCell): Promise<{
  builder: TransactionBuilder; transaction: string; provider: SemanticProvider;
  callerInput: number; producerInput: number; eventSlots: number;
  eventAddress: string; categoryId: string; eventDef: any;
}> {
  const provider = createLayer3SemanticTestProvider();
  const outpoints = new Set<string>();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  };
  const hubArtifact = compileString(
    cell.resultEffect ? resultEffectHubSource : cell.narrow ? narrowHubSource : condHubSource, options,
  );
  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(provider, hubBase, hubArtifact.stateLayout!, { total: 0n });
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const legBArtifact = compileString(cell.resultEffect ? returningLegBSource : legBSource, options);
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'note', args: [legB.lockingBytecode, cell.value] },
    { parent: 0, callee: 1, function: 'credit', args: [cell.value], callMode: 'call' },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const declaredResultValue = cell.tamperResult ? cell.value + 1n : cell.value;
  const declaredResult = packed(declaredResultValue);
  const transcript = layer3.finalizeCompiledGraph(
    plan, cell.resultEffect ? { 1: binToHex(declaredResult) } : {},
    layout.participantInputs, layout.returnOutputs,
    cell.resultEffect ? ['', binToHex(declaredResult)] : ['', ''], layout.projectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const initFee = uniqueUtxo(outpoints, { satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, initFee);
  const initTx = new TransactionBuilder({ provider });
  initTx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()));
  initTx.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
  initTx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  initTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(initTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const projections = plan.participants.map(() => uniqueUtxo(outpoints, { satoshis: 1000n }));
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  const fee = uniqueUtxo(outpoints, { satoshis: 300_000n });
  await provider.addUtxo(p2pkh.address, fee);
  const returnFunding = uniqueUtxo(outpoints, { satoshis: 1000n });
  if (cell.resultEffect) await provider.addUtxo(p2pkh.address, returnFunding);

  const hubLayout = hubArtifact.hiddenBatch!.route.blockLayout!;
  const hubSlotKind = new Map<number, string>(hubLayout.slots.map((slot: any) => [slot.offset, slot.kind]));
  const fillers = Array.from(
    { length: hubLayout.blockSize }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of fillers) await provider.addUtxo(p2pkh.address, funding);
  const CONTAINER_SATS = 5_000n;
  const container = uniqueUtxo(outpoints, { satoshis: CONTAINER_SATS });
  await provider.addUtxo(getSatoshiContainerAddress(hub, hubSetup.categoryId), container);

  const routeFor = (contract: Contract, artifact: any): any =>
    (...args: any[]): any => contract.createCompilerRouteUnlocker(
      artifact.hiddenBatch.route, hexToBin(artifact.hiddenBatch.selector),
    )(...args);

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  let fillerCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addInput(hubSetup.masterUtxo, routeFor(hub, hubArtifact)(
        ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
      ));
    } else if (kind === 'dataNft') {
      tx.addInput(
        hubSetup.dataNftUtxos[0],
        createDataNftUnlocker(hub, layout.participantInputs[0], hubSetup.categoryId),
      );
    } else if (kind === 'satoshiContainer') {
      tx.addInput(container, createSatoshiContainerUnlocker(
        hub, layout.participantInputs[0], hubSetup.categoryId,
      ));
    } else {
      tx.addInput(fillers[fillerCursor], p2pkh.unlock.spend(alicePub, signature()));
      fillerCursor += 1;
    }
  }
  tx.addInput(legBSetup.masterUtxo, routeFor(legB, legBArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
    ...(cell.resultEffect ? [BigInt(layout.returnOutputs[1]!)] : []),
  ));
  tx.addInput(
    legBSetup.dataNftUtxos[0],
    createDataNftUnlocker(legB, layout.participantInputs[1], legBSetup.categoryId),
  );
  if (cell.resultEffect) tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const eventAddress = getEventNftAddress(hub, hubSetup.categoryId, hubArtifact.events![0].signature);
  const eventNft = (value: bigint): any => ({
    to: eventAddress, amount: 1000n,
    token: {
      category: hubSetup.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(packed(value)) },
    },
  });
  const branchTaken = cell.value > 100n;
  let eventCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addOutput({
        to: hub.tokenAddress, amount: hubSetup.masterUtxo.satoshis,
        token: { category: hubSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    } else if (kind === 'dataNft') {
      tx.addOutput({
        to: getDataNftAddress(hub, hubSetup.categoryId), amount: hubSetup.dataNftUtxos[0].satoshis,
        token: {
          category: hubSetup.categoryId,
          amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: buildInitialStateCommitments(
              hubArtifact.stateLayout!, { total: cell.resultEffect ? declaredResultValue : cell.value },
            )[0],
          },
        },
      });
    } else if (kind === 'satoshiContainer') {
      tx.addOutput({
        to: getSatoshiContainerAddress(hub, hubSetup.categoryId), amount: CONTAINER_SATS,
      });
    } else if (kind === 'event') {
      // Slots 0 and 1 are the REACHED site's two frame slots. Slot 0 always carries `emit Fired(credited)`.
      // Slot 1 is THE measured slot: `emit Fired(credited + 7)` runs only when the one-armed branch is taken.
      const index = eventCursor;
      eventCursor += 1;
      // The narrow shape's ONLY slot is the one-armed one, so its slot 0 plays the role of slot 1 below.
      const armed = cell.narrow ? 0 : 1;
      if (index === 0 && !cell.narrow) {
        tx.addOutput(cell.first === 'forge' ? eventNft(999_999n)
          : eventNft(cell.resultEffect ? declaredResultValue : cell.value));
      } else if (index === armed && cell.second === 'forge') tx.addOutput(eventNft(999_999n));
      else if (index === armed && branchTaken) tx.addOutput(eventNft(cell.value + 7n));
      else tx.addOutput({ to: p2pkh.address, amount: 1000n });
    } else {
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
    }
  }
  tx.addOutput({
    to: legB.tokenAddress, amount: legBSetup.masterUtxo.satoshis,
    token: { category: legBSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(legB, legBSetup.categoryId), amount: legBSetup.dataNftUtxos[0].satoshis,
    token: {
      category: legBSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(legBArtifact.stateLayout!, { seen: cell.value })[0],
      },
    },
  });
  if (cell.resultEffect) {
    tx.addOutput({
      to: hexToBin('51'), amount: 1000n,
      token: {
        category: legBSetup.categoryId, amount: 0n,
        nft: {
          capability: 'none' as const,
          commitment: binToHex(scriptToBytecode([packed(cell.value)])),
        },
      },
    });
  }
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 30_000n });

  return {
    builder: tx,
    transaction: raw(tx),
    provider,
    callerInput: layout.participantInputs[0],
    producerInput: layout.participantInputs[1],
    eventSlots: hubLayout.slots.filter((slot: any) => slot.kind === 'event').length,
    eventAddress,
    categoryId: hubSetup.categoryId,
    eventDef: hubArtifact.events![0],
  };
}

/**
 * SEC-8's hostile case. `graphEffectSettlesTransfers` is `transferInfos.length > 0`, and a ONE-ARMED
 * conditional `this.transfer(..)` contributes to that count while settling nothing on the not-taken row. So the
 * dispatch site arms GRAPH_TRANSFER_REACHED and the route's not-reached container preservation is skipped -
 * exactly the state SEC-8 was about. The question is whether the subroutine's own conservation covers it.
 */
const condTransferHubSource = `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); }
contract Sec8CondTransferHub() {
  uint total;
  event Fired(uint value);
  function fireAll(address first, uint value, bytes recipient) public {
    emit Fired(value);
    if (value > 100) { this.transfer(recipient, ${TRANSFER_SATS}); }
    IEffectLeg(first).credit(value);
    require(true);
  }
  function note(address first, uint credited) public {
    emit Fired(credited);
    IEffectLeg(first).credit(credited);
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;

async function buildCondTransferBatch(value: bigint, drain: boolean): Promise<{
  builder: TransactionBuilder; transaction: string; provider: SemanticProvider;
  callerInput: number; containerSlots: number;
}> {
  const provider = createLayer3SemanticTestProvider();
  const outpoints = new Set<string>();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  };
  const hubArtifact = compileString(condTransferHubSource, options);
  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(provider, hubBase, hubArtifact.stateLayout!, { total: 0n });
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const legBArtifact = compileString(legBSource, options);
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const plan = layer3.planCompiledGraph([
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'fireAll', args: [legB.lockingBytecode, value, p2pkh.lockingBytecode] },
    { parent: 0, callee: 1, function: 'credit', args: [value], callMode: 'call' },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, plan.participants.map(() => null),
    plan.participants.map(() => ''), layout.projectionInputs,
  );

  const initFee = uniqueUtxo(outpoints, { satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, initFee);
  const initTx = new TransactionBuilder({ provider });
  initTx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()));
  initTx.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
  initTx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  initTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(initTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const projections = plan.participants.map(() => uniqueUtxo(outpoints, { satoshis: 1000n }));
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  const fee = uniqueUtxo(outpoints, { satoshis: 300_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const hubLayout = hubArtifact.hiddenBatch!.route.blockLayout!;
  const hubSlotKind = new Map<number, string>(hubLayout.slots.map((slot: any) => [slot.offset, slot.kind]));
  const fillers = Array.from(
    { length: hubLayout.blockSize }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of fillers) await provider.addUtxo(p2pkh.address, funding);
  const CONTAINER_SATS = 5_000n;
  const container = uniqueUtxo(outpoints, { satoshis: CONTAINER_SATS });
  await provider.addUtxo(getSatoshiContainerAddress(hub, hubSetup.categoryId), container);

  const routeFor = (contract: Contract, artifact: any): any =>
    (...args: any[]): any => contract.createCompilerRouteUnlocker(
      artifact.hiddenBatch.route, hexToBin(artifact.hiddenBatch.selector),
    )(...args);

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  let fillerCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addInput(hubSetup.masterUtxo, routeFor(hub, hubArtifact)(
        ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
      ));
    } else if (kind === 'dataNft') {
      tx.addInput(
        hubSetup.dataNftUtxos[0],
        createDataNftUnlocker(hub, layout.participantInputs[0], hubSetup.categoryId),
      );
    } else if (kind === 'satoshiContainer') {
      tx.addInput(container, createSatoshiContainerUnlocker(
        hub, layout.participantInputs[0], hubSetup.categoryId,
      ));
    } else {
      tx.addInput(fillers[fillerCursor], p2pkh.unlock.spend(alicePub, signature()));
      fillerCursor += 1;
    }
  }
  tx.addInput(legBSetup.masterUtxo, routeFor(legB, legBArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  tx.addInput(
    legBSetup.dataNftUtxos[0],
    createDataNftUnlocker(legB, layout.participantInputs[1], legBSetup.categoryId),
  );
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const eventAddress = getEventNftAddress(hub, hubSetup.categoryId, hubArtifact.events![0].signature);
  const branchTaken = value > 100n;
  let eventCursor = 0;
  let transferCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addOutput({
        to: hub.tokenAddress, amount: hubSetup.masterUtxo.satoshis,
        token: { category: hubSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    } else if (kind === 'dataNft') {
      tx.addOutput({
        to: getDataNftAddress(hub, hubSetup.categoryId), amount: hubSetup.dataNftUtxos[0].satoshis,
        token: {
          category: hubSetup.categoryId,
          amount: 0n,
          nft: {
            capability: 'mutable',
            // `fireAll` does not write `total`.
            commitment: buildInitialStateCommitments(hubArtifact.stateLayout!, { total: 0n })[0],
          },
        },
      });
    } else if (kind === 'satoshiContainer') {
      // THE variable: preserve the container, or take its satoshis and leave a 0-value stub.
      tx.addOutput(drain
        ? { to: p2pkh.address, amount: 0n }
        : { to: getSatoshiContainerAddress(hub, hubSetup.categoryId), amount: CONTAINER_SATS });
    } else if (kind === 'transfer') {
      const index = transferCursor;
      transferCursor += 1;
      tx.addOutput(index === 0 && branchTaken
        ? { to: p2pkh.address, amount: TRANSFER_SATS }
        : { to: p2pkh.address, amount: 1000n });
    } else if (kind === 'event') {
      const index = eventCursor;
      eventCursor += 1;
      tx.addOutput(index === 0 ? {
        to: eventAddress, amount: 1000n,
        token: {
          category: hubSetup.categoryId, amount: 0n,
          nft: { capability: 'none' as const, commitment: binToHex(packed(value)) },
        },
      } : { to: p2pkh.address, amount: 1000n });
    } else {
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
    }
  }
  tx.addOutput({
    to: legB.tokenAddress, amount: legBSetup.masterUtxo.satoshis,
    token: { category: legBSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(legB, legBSetup.categoryId), amount: legBSetup.dataNftUtxos[0].satoshis,
    token: {
      category: legBSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(legBArtifact.stateLayout!, { seen: value })[0],
      },
    },
  });
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: drain ? 35_000n : 30_000n });

  return {
    builder: tx,
    transaction: raw(tx),
    provider,
    callerInput: layout.participantInputs[0],
    containerSlots: hubLayout.slots.filter((slot: any) => slot.kind === 'satoshiContainer').length,
  };
}

/**
 * SEC-9 on the OTHER axis. `transferWidth` is a group maximum by the identical construction, and the new
 * refusal compares `emitInfos` only. The eligibility gate cannot see the divergence either: it counts
 * `TransferStatementNode` alone, while `collectTransferStatements` also records `AddressTransferStatementNode`,
 * `AddressSendExpressionNode`, `{value:}` options and `new C{value:}`. So `wide` publishes ONE direct transfer
 * to the gate and TWO `transferInfos` to the frame, exactly the pre/post-lowering mismatch SEC-9 was about.
 */
const divergentTransferHubSource = `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); }
contract Sec9TransferHub() {
  uint total;
  event Fired(uint value);
  function wide(address first, uint value, bytes recipient, address payable other) public {
    emit Fired(value);
    this.transfer(recipient, ${TRANSFER_SATS});
    other.transfer(700);
    IEffectLeg(first).credit(value);
    require(true);
  }
  function narrow(address first, uint value, bytes recipient) public {
    emit Fired(value);
    this.transfer(recipient, ${TRANSFER_SATS});
    IEffectLeg(first).credit(value);
    this.total = this.total + value;
    require(value > 0);
  }
}`;

/** `forgeAt` names which of the reached site's two transfer slots carries a spender-minted event NFT. */
async function buildDivergentTransferBatch(forgeAt: 'none' | 'settled' | 'reserved'): Promise<{
  builder: TransactionBuilder; transaction: string; provider: SemanticProvider;
  callerInput: number; transferSlots: number; eventAddress: string; categoryId: string; eventDef: any;
}> {
  const provider = createLayer3SemanticTestProvider();
  const outpoints = new Set<string>();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  };
  const hubArtifact = compileString(divergentTransferHubSource, options);
  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(provider, hubBase, hubArtifact.stateLayout!, { total: 0n });
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const legBArtifact = compileString(legBSource, options);
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const VALUE = 4n;
  const plan = layer3.planCompiledGraph([
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'narrow', args: [legB.lockingBytecode, VALUE, p2pkh.lockingBytecode] },
    { parent: 0, callee: 1, function: 'credit', args: [VALUE], callMode: 'call' },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, plan.participants.map(() => null),
    plan.participants.map(() => ''), layout.projectionInputs,
  );

  const initFee = uniqueUtxo(outpoints, { satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, initFee);
  const initTx = new TransactionBuilder({ provider });
  initTx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()));
  initTx.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
  initTx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  initTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(initTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const projections = plan.participants.map(() => uniqueUtxo(outpoints, { satoshis: 1000n }));
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  const fee = uniqueUtxo(outpoints, { satoshis: 300_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const hubLayout = hubArtifact.hiddenBatch!.route.blockLayout!;
  const hubSlotKind = new Map<number, string>(hubLayout.slots.map((slot: any) => [slot.offset, slot.kind]));
  const fillers = Array.from(
    { length: hubLayout.blockSize }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of fillers) await provider.addUtxo(p2pkh.address, funding);
  const CONTAINER_SATS = 5_000n;
  const container = uniqueUtxo(outpoints, { satoshis: CONTAINER_SATS });
  await provider.addUtxo(getSatoshiContainerAddress(hub, hubSetup.categoryId), container);

  const routeFor = (contract: Contract, artifact: any): any =>
    (...args: any[]): any => contract.createCompilerRouteUnlocker(
      artifact.hiddenBatch.route, hexToBin(artifact.hiddenBatch.selector),
    )(...args);

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  let fillerCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addInput(hubSetup.masterUtxo, routeFor(hub, hubArtifact)(
        ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
      ));
    } else if (kind === 'dataNft') {
      tx.addInput(
        hubSetup.dataNftUtxos[0],
        createDataNftUnlocker(hub, layout.participantInputs[0], hubSetup.categoryId),
      );
    } else if (kind === 'satoshiContainer') {
      tx.addInput(container, createSatoshiContainerUnlocker(
        hub, layout.participantInputs[0], hubSetup.categoryId,
      ));
    } else {
      tx.addInput(fillers[fillerCursor], p2pkh.unlock.spend(alicePub, signature()));
      fillerCursor += 1;
    }
  }
  tx.addInput(legBSetup.masterUtxo, routeFor(legB, legBArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  tx.addInput(
    legBSetup.dataNftUtxos[0],
    createDataNftUnlocker(legB, layout.participantInputs[1], legBSetup.categoryId),
  );
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const eventAddress = getEventNftAddress(hub, hubSetup.categoryId, hubArtifact.events![0].signature);
  const forgedNft = {
    to: eventAddress, amount: 1000n,
    token: {
      category: hubSetup.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(packed(999_999n)) },
    },
  };
  let eventCursor = 0;
  let transferCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addOutput({
        to: hub.tokenAddress, amount: hubSetup.masterUtxo.satoshis,
        token: { category: hubSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    } else if (kind === 'dataNft') {
      tx.addOutput({
        to: getDataNftAddress(hub, hubSetup.categoryId), amount: hubSetup.dataNftUtxos[0].satoshis,
        token: {
          category: hubSetup.categoryId,
          amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: buildInitialStateCommitments(hubArtifact.stateLayout!, { total: VALUE })[0],
          },
        },
      });
    } else if (kind === 'satoshiContainer') {
      tx.addOutput({
        to: getSatoshiContainerAddress(hub, hubSetup.categoryId), amount: CONTAINER_SATS,
      });
    } else if (kind === 'transfer') {
      // Site 0 owns transfer slots 0 and 1. `narrow` settles slot 0; slot 1 is reserved and unsettled.
      const index = transferCursor;
      transferCursor += 1;
      if (index === 0) {
        tx.addOutput(forgeAt === 'settled' ? forgedNft
          : { to: p2pkh.address, amount: TRANSFER_SATS });
      } else if (index === 1 && forgeAt === 'reserved') {
        tx.addOutput(forgedNft);
      } else tx.addOutput({ to: p2pkh.address, amount: 1000n });
    } else if (kind === 'event') {
      const index = eventCursor;
      eventCursor += 1;
      tx.addOutput(index === 0 ? {
        to: eventAddress, amount: 1000n,
        token: {
          category: hubSetup.categoryId, amount: 0n,
          nft: { capability: 'none' as const, commitment: binToHex(packed(VALUE)) },
        },
      } : { to: p2pkh.address, amount: 1000n });
    } else {
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
    }
  }
  tx.addOutput({
    to: legB.tokenAddress, amount: legBSetup.masterUtxo.satoshis,
    token: { category: legBSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(legB, legBSetup.categoryId), amount: legBSetup.dataNftUtxos[0].satoshis,
    token: {
      category: legBSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(legBArtifact.stateLayout!, { seen: VALUE })[0],
      },
    },
  });
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 30_000n });

  return {
    builder: tx,
    transaction: raw(tx),
    provider,
    callerInput: layout.participantInputs[0],
    transferSlots: hubLayout.slots.filter((slot: any) => slot.kind === 'transfer').length,
    eventAddress,
    categoryId: hubSetup.categoryId,
    eventDef: hubArtifact.events![0],
  };
}

const show = (value: unknown): string =>
  JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));

const outcomeOf = (builder: TransactionBuilder): string => {
  try {
    layer3.preflightLayer3Transaction(builder);
  } catch (error) {
    return (error as Error).message;
  }
  return 'ACCEPTED';
};

/**
 * X152. Which byte rules the finalized bytes break, if any. The container-drain hostile below leaves a
 * below-dust output BECAUSE it drains the container, so it cannot be moved off the dust without deleting the
 * attack; what is pinned instead is that the dust is not what refuses it.
 */
const byteRefusals = (rawTx: string): string[] =>
  layer3.assessFinalizedTransactionBytes(decodeTransactionUnsafe(hexToBin(rawTx)))
    .refusals.map((row) => row.rule).sort();

const verifyAtCaller =
  /mandatory-script-verify-flag-failed .*error in evaluating input index 0: Program failed an OP_VERIFY operation/;

describe('SEC-10: a one-armed conditional emit reserves a slot nothing verifies (SEMANTIC)', () => {
  const at = (input: number): string =>
    `layer3 [L3_SCB_ENVELOPE_MALFORMED]: BCH-2026 preflight failed at input ${input}`;
  it('settles a consumed result together with its state write and event', async () => {
    const built = await buildConditionalEmitBatch({ value: 40n, resultEffect: true });
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  it('rejects a tampered result while keeping the consumer state/event internally consistent', async () => {
    const built = await buildConditionalEmitBatch({ value: 40n, resultEffect: true, tamperResult: true });
    expect(outcomeOf(built.builder)).not.toBe('ACCEPTED');
  }, 600_000);

  it('compiles: the conditional second emit counts toward the frame width SEC-9 compares', () => {
    const artifact = compileString(condHubSource, {
      forceStateful: true,
      hiddenBatch: true,
      messageBusController: `76a914${'11'.repeat(20)}88ac`,
      messageBusControllerCategory: 'cd'.repeat(32),
    });
    // SEC-9's refusal did not fire: both handlers report 2 emits, and 8 sites x width 2 = 16 slots.
    expect(artifact.hiddenBatch!.handlers.map((h: any) => h.emits.length)).toEqual([2, 2]);
    expect(artifact.hiddenBatch!.route.blockLayout!.slots
      .filter((slot: any) => slot.kind === 'event')).toHaveLength(16);
  }, 60_000);

  // Control A: the branch IS taken, so slot 1 is settled by the handler's own emit.
  it('settles the branch-taken row with both reached slots settled', async () => {
    const built = await buildConditionalEmitBatch({ value: 200n, second: 'honest' });
    expect(built.eventSlots).toBe(16);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  // Control B: the SAME forged output, on the branch-taken row. Slot 1 is verified there, so it must reject.
  it('rejects the forged event NFT when the branch IS taken', async () => {
    const built = await buildConditionalEmitBatch({ value: 200n, second: 'forge' });
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
  }, 600_000);

  // Control C: the branch is NOT taken and the reserved slot carries a plain funding output.
  it('settles the branch-not-taken row with the reserved slot left as funding', async () => {
    const built = await buildConditionalEmitBatch({ value: 4n, second: 'honest' });
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  // Control D anchors WHICH site is reached: on the same not-taken row, forging the site's FIRST slot - the
  // one the unconditional `emit Fired(credited)` settles - must reject. So site 0 is the reached site and its
  // slot 1 is a reached site's slot, not an unreached site's.
  it('rejects a forged event NFT in the reached site FIRST slot on the not-taken row', async () => {
    const built = await buildConditionalEmitBatch({ value: 4n, first: 'forge' });
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
  }, 600_000);

  /**
   * THE MEASUREMENT. One variable against control B: whether the one-armed branch ran. The forged output is
   * byte-identical in both. REPAIRED: the conditional emit's covenant now has an OP_ELSE that binds the
   * reserved slot's commitment to EMPTY on the path that does not reach the emit.
   */
  it('SEC-10: rejects a forged event NFT in the reserved slot of a NOT-taken branch', async () => {
    const built = await buildConditionalEmitBatch({ value: 4n, second: 'forge' });
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
  }, 600_000);

  /**
   * What the forgery used to buy: the SDK's own reader returned it as a genuine `Fired` log. It no longer
   * reaches the chain, so the reader sees only the honest emit.
   *
   * R3-12. THIS TEST NAMED A READ-BACK AND READ NOTHING. Its body was a byte-for-byte duplicate of the test
   * six lines above, minus that test's `expect(outcomeOf(...))` line, with a bare `rejects.toThrow()` and no
   * mention anywhere in the file of `readEventsFromChain` - the reader whose answer the title is about. It was
   * strictly weaker than its own neighbour and was not a second data point.
   *
   * It is now the read-back, and it is built so neither half can pass vacuously:
   *
   *  1. the NOT-TAKEN row settled honestly, read back through `readEventsFromChain`: EXACTLY ONE genuine log,
   *     the unconditional `emit Fired(credited)`, and not the forged value. A count rather than an absence,
   *     because the reader returns `[]` on any failure and `'[]'` contains no forged value either (R3-9);
   *  2. a READER-CAPABILITY control: the forged event NFT, the same shape the refused build would have created,
   *     is placed at the same event address on that same provider and the reader DOES return it. So what keeps
   *     the forgery out of the reader's answer is the covenant's refusal and not some unrelated property of the
   *     reader's filter - which is the difference between the impact claim and a coincidence;
   *  3. the forged build refused at the CALLER'S OWN input, matched rather than merely thrown. The opcode is
   *     deliberately not pinned: R3-7 measured that which OP_VERIFY fails first is not stable, while the input
   *     index is the load-bearing part here.
   *
   * The guard negative control is in the same test and differs in exactly one field: whether the reserved slot
   * of the not-taken branch carries the forged event NFT or a plain funding output.
   */
  it('SEC-10 impact: the forged NFT no longer reaches the chain to be read back', async () => {
    // (1) The honest not-taken row settles, and its ONE genuine log is readable.
    const honest = await buildConditionalEmitBatch({ value: 4n, second: 'honest' });
    expect(outcomeOf(honest.builder)).toBe('ACCEPTED');
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeTypeOf('string');
    const settled = await readEventsFromChain(
      honest.provider as any, honest.eventAddress, honest.categoryId, honest.eventDef,
    );
    console.log('SEC-10 impact, honest not-taken logs:', show(settled));
    expect(settled, 'the reader returned the wrong number of GENUINE logs, so its silence about the forgery '
      + 'says nothing').toHaveLength(1);
    expect(show(settled)).toContain('"4"');
    expect(show(settled)).not.toContain('999999');

    // (2) READER-CAPABILITY CONTROL. The forged NFT is exactly what this reader accepts, so the covenant is
    // what keeps it out of the answer above. Placed on the chain directly rather than through the covenant,
    // which is the whole point: no route admits it.
    await honest.provider.addUtxo(honest.eventAddress, randomUtxo({
      satoshis: 1000n,
      token: {
        category: honest.categoryId,
        amount: 0n,
        nft: { capability: 'none', commitment: binToHex(packed(999_999n)) },
      },
    }) as never);
    const withForgery = await readEventsFromChain(
      honest.provider as any, honest.eventAddress, honest.categoryId, honest.eventDef,
    );
    console.log('SEC-10 impact, reader capability control:', show(withForgery));
    expect(withForgery, 'the reader cannot see the forged shape at all, so its absence above is a coincidence '
      + 'rather than the repair').toHaveLength(2);
    expect(show(withForgery)).toContain('999999');

    // (3) And the build that would have put it there is refused at the caller's own input.
    const forged = await buildConditionalEmitBatch({ value: 4n, second: 'forge' });
    expect(outcomeOf(forged.builder)).toContain(at(forged.callerInput));
    const verdict = await forged.provider.sendRawTransaction(forged.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    console.log('SEC-10 impact, forged verdict:', verdict);
    expect(verdict).toContain(`error in evaluating input index ${forged.callerInput}`);
    expect(await readEventsFromChain(
      forged.provider as any, forged.eventAddress, forged.categoryId, forged.eventDef,
    ), 'the refused transaction settled an event anyway').toEqual([]);
  }, 600_000);

  // The minimal shape: one handler, one emit, that emit one-armed. Frame width 1, no sibling, no divergence.
  it('narrow shape compiles with a reserved slot for the one-armed emit', () => {
    const artifact = compileString(narrowHubSource, {
      forceStateful: true,
      hiddenBatch: true,
      messageBusController: `76a914${'11'.repeat(20)}88ac`,
      messageBusControllerCategory: 'cd'.repeat(32),
    });
    expect(artifact.hiddenBatch!.handlers.map((h: any) => h.emits.length)).toEqual([1]);
    expect(artifact.hiddenBatch!.route.blockLayout!.slots
      .filter((slot: any) => slot.kind === 'event')).toHaveLength(8);
  }, 60_000);

  it('narrow control: rejects the forged NFT when the one-armed branch IS taken', async () => {
    const built = await buildConditionalEmitBatch({ value: 200n, second: 'forge', narrow: true });
    expect(built.eventSlots).toBe(8);
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
  }, 600_000);

  // The capability needed neither a sibling nor a width divergence: one handler, one emit, one arm.
  it('SEC-10 narrow: rejects a forged NFT in the width-1 slot of a NOT-taken branch', async () => {
    const built = await buildConditionalEmitBatch({ value: 4n, second: 'forge', narrow: true });
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
  }, 600_000);

  /**
   * SEC-8's hostile case, and its fix HOLDS. The flag is armed by a transfer that does not run, so the route's
   * not-reached preservation is skipped - but the subroutine's own `emitGraphEffectContainerConservation` runs
   * unconditionally (its guard is the compile-time `pendingTransfers.length > 0`) and contributes 0 for the
   * inactive transfer, leaving `containerIn <= containerOut`.
   */
  it('SEC-8 hostile: settles a NOT-taken conditional transfer that preserves the container', async () => {
    const built = await buildCondTransferBatch(4n, false);
    expect(built.containerSlots).toBe(1);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  it('SEC-8 hostile: rejects a container drain on a NOT-taken conditional transfer', async () => {
    const built = await buildCondTransferBatch(4n, true);
    expect(built.containerSlots).toBe(1);
    expect(built.callerInput).toBe(0);
    const outcome = outcomeOf(built.builder);
    expect(outcome).toContain(at(built.callerInput));
    // X152. The drain leaves a below-dust output, so the byte gate HAS an objection to these bytes - and it
    // is not the one delivered. The refusal is the covenant's, at the caller's own input, on both paths.
    expect(byteRefusals(built.transaction)).toEqual(['output-dust']);
    expect(outcome, 'the byte gate spoke before the covenant').not.toMatch(/finalized transaction refused by/);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(new RegExp(`evaluating input index ${built.callerInput}`));
  }, 600_000);

  /**
   * SEC-9's refusal DOES catch a second divergence vector the pre-lowering gate misses: an if/else whose arms
   * both emit counts 3 direct statements (so `eventWidths` in the gate agrees with the 3-emit sibling) while
   * `emitInfos` records only the longer arm, 2.
   */
  it('supports heterogeneous event frames in explicit and inferred controllerless graph routes', () => {
    const source = `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); }
contract ArmHub() {
  uint total;
  event Fired(uint value);
  function fireAll(address first, uint value) public {
    emit Fired(value);
    if (value > 100) { emit Fired(value + 7); } else { emit Fired(value + 9); }
    IEffectLeg(first).credit(value);
    require(true);
  }
  function note(address first, uint credited) public {
    emit Fired(credited);
    emit Fired(credited + 7);
    emit Fired(credited + 9);
    IEffectLeg(first).credit(credited);
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;
    const graph = compileString(source, {
      forceStateful: true,
      hiddenBatch: true,
      messageBusController: `76a914${'11'.repeat(20)}88ac`,
      messageBusControllerCategory: 'cd'.repeat(32),
    });
    expect(graph.hiddenBatch!.handlers.map((handler: any) => handler.emits.length)).toEqual([2, 3]);
    expect(graph.hiddenBatch!.route.blockLayout!.slots
      .filter((slot: any) => slot.kind === 'event')).toHaveLength(24);
    const controllerless = compileString(source, { forceStateful: true, hiddenBatch: true });
    expect(controllerless.hiddenBatch?.singleTransactionBus).toMatchObject({
      carrierInput: 0, maximumParticipants: 8, maximumRows: 24,
    });
    expect(controllerless.hiddenBatch!.route.blockLayout!.slots
      .filter((slot: any) => slot.kind === 'event')).toHaveLength(24);
  }, 60_000);

  // SEC-9 on the transfer axis: the refusal compares emitInfos only, so this compiles.
  it('SEC-9 gap: admits divergent TRANSFER widths on one route', () => {
    const artifact = compileString(divergentTransferHubSource, {
      forceStateful: true,
      hiddenBatch: true,
      messageBusController: `76a914${'11'.repeat(20)}88ac`,
      messageBusControllerCategory: 'cd'.repeat(32),
    });
    // R3-10 class, found sideways: `every` over an empty handler list is `true`, so a route that published no
    // handler at all would satisfy "all admitted".
    expect(artifact.hiddenBatch!.handlers, 'the route published no handler, so "all eligible" is vacuous')
      .not.toEqual([]);
    expect(artifact.hiddenBatch!.handlers.every((h: any) => h.eligible)).toBe(true);
    // 8 sites x transferWidth 2, while `narrow` settles one slot per site.
    expect(artifact.hiddenBatch!.route.blockLayout!.slots
      .filter((slot: any) => slot.kind === 'transfer')).toHaveLength(16);
  }, 60_000);

  it('settles the narrow row with its one transfer slot paid', async () => {
    const built = await buildDivergentTransferBatch('none');
    expect(built.transferSlots).toBe(16);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  // Control: the same forged NFT in the SETTLED transfer slot of the same site must reject.
  it('rejects a forged NFT in the SETTLED transfer slot of the reached site', async () => {
    const built = await buildDivergentTransferBatch('settled');
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
  }, 600_000);

  /**
   * The measurement: one variable, which of the reached site's two transfer slots carries the forgery.
   * REPAIRED by emitOwnCategoryImmutableNftOutputPin: a transfer offset is not an event offset.
   *
   * R3-12, SAME CLASS AND NOT ON THE REPORT'S LIST. `SEC-9 gap impact: the transfer-slot forgery no longer
   * reaches the chain` stood here as a separate test and was a byte-for-byte duplicate of this one minus the
   * `expect(outcomeOf(...))` line - strictly weaker than its neighbour, with a bare `rejects.toThrow()`, and
   * counted as a second data point in the tally. Unlike the SEC-10 pair it had nothing to be repaired INTO: a
   * transfer slot carries no log, so `readEventsFromChain` has nothing to say about it, and "reaches the chain"
   * for a transfer slot is exactly the refusal this test already measures. It is folded in here, and what it
   * was reaching for is now asserted properly: the node-level refusal is MATCHED at the caller's own input
   * rather than merely thrown. Per R3-7, the flag and the input index are pinned and the opcode is not.
   */
  it('SEC-9 gap: rejects a forged NFT in the RESERVED transfer slot', async () => {
    const built = await buildDivergentTransferBatch('reserved');
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    const verdict = await built.provider.sendRawTransaction(built.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    console.log('SEC-9 gap, reserved transfer slot:', verdict);
    expect(verdict).toContain('mandatory-script-verify-flag-failed');
    expect(verdict).toContain(`error in evaluating input index ${built.callerInput}`);
  }, 600_000);
});
