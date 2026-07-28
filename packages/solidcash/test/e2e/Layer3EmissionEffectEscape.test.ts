import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
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
  createDataNftUnlocker, createSatoshiContainerUnlocker,
  getDataNftAddress, getEventNftAddress, getSatoshiContainerAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * SEC-6. A graph emission handler that also performs a transfer, `emit` or token-container operation is
 * FLATTENED into the route wrapper, and a flattened handler's external calls generate with `__scb1` as the
 * current function - not a `graphEmissionHandler` - so no emission row is ever recomputed and compared.
 *
 * SEC-5 closed exactly the same escape for the EFFECT-FREE shape by keeping the clone behind `OP_INVOKE`
 * (`InlineStoragePointerCalls.keepsGraphEmissionBinding`). That guard deliberately excluded the effect-carrying
 * shape, so this file measures whether the exclusion is exploitable.
 *
 * Measured at 9bf3e5ea, one variable and only one - does the caller's handler carry an `emit`? Everything else
 * is identical: the same two legs, the same graph, the same substitutions, the same settlement outputs.
 *
 *   caller body   | graph clone      | emission binding sites | honest  | argument sub | selector sub
 *   --------------|------------------|------------------------|---------|--------------|-------------
 *   effect-free   | behind OP_INVOKE | 4                      | SETTLES | REJECTS @0   | REJECTS @0
 *   emit-carrying | flattened        | 0                      | SETTLES | SETTLED      | SETTLED
 *
 * Both substitutions are transcript-side only: every participant, every co-spent block and every selector the
 * CALLER runs is unchanged, and only what the transcript states about the caller's second outgoing edge moves.
 * The honest control settles in both configurations, which is what makes an "ACCEPTED" attributable to the
 * missing binding rather than to a fixture that never rejects.
 *
 * A SECOND variable was measured before concluding, because C1 and C3 both carry it and this file did not:
 * every callee additionally requiring `msg.sender == hub`. It changes nothing. Both substitutions still settled
 * on the emit-carrying caller and both still reject on the effect-free one, which is what it should be -
 * msg.sender authenticates WHO called, never WITH WHAT
 *
 * The repair is a REFUSAL, not a restored binding. Keeping the clone behind OP_INVOKE does restore the binding
 * (0 -> 32 sites, measured) but silently drops the effect: the route reserves its event / transfer /
 * token-container slots by walking its OWN body, so the un-flattened form declares none and the honest graph
 * still settled with ZERO event slots and no event output. Giving the subroutine those slots needs a
 * per-call-site output index threaded from the route. Until that exists the shape is refused by name.
 *
 * SEMANTIC evidence only, on the named layer3-bch2026-semantic-relaxed-v1 profile.
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

/**
 * The caller. `emit` is the single measured variable of the original SEC-6 control: with it the handler carries
 * a physical effect. Both spellings reach the same two legs through the same ordinary interface calls, so the
 * dispatch is not a second variable.
 *
 * `transferring` is X29's second, INDEPENDENT variable, and it changes the signature (a recipient parameter), so
 * it is never combined with an `emitting`-only cell - the two are measured on their own fixtures.
 */
const hubSource = (emitting: boolean, transferring = false): string => `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); function debit(uint value); }
contract EscapeEffectHub() {
  uint total;
  event Fired(uint value);
  function fireAll(address first, address second, uint value${transferring ? ', bytes recipient' : ''}) public {
${emitting ? '    emit Fired(value);' : ''}
${transferring ? `    this.transfer(recipient, ${TRANSFER_SATS});` : ''}
    IEffectLeg(first).credit(value);
    IEffectLeg(second).debit(value);
    require(true);
  }
  function note(uint credited) public {
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;

const legBSource = (senderChecked: boolean): string => `pragma solidcash >=0.8.0;
contract EffectLegB(address hub) {
  uint seen;
  function credit(uint value) public {
    this.seen = this.seen + value;
    require(value > 0${senderChecked ? ' && msg.sender == hub' : ''});
  }
}`;

/** Leg C carries both selectors so the transcript can state one where the caller invoked the other. */
const legCSource = (senderChecked: boolean): string => `pragma solidcash >=0.8.0;
contract EffectLegC(address hub) {
  uint burned;
  function debit(uint value) public {
    this.burned = this.burned + value;
    require(value > 0${senderChecked ? ' && msg.sender == hub' : ''});
  }
  function credit(uint value) public {
    this.burned = this.burned + value * 3;
    require(value > 0${senderChecked ? ' && msg.sender == hub' : ''});
  }
}`;

const CALL_VALUE = 4n;

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

interface Cell {
  /** Does the caller's handler carry an `emit`? THE measured variable. */
  emitting: boolean;
  /** Which authenticated field of the caller's second outgoing edge the transcript substitutes. */
  tamper?: 'none' | 'argument' | 'selector';
  /** Do the legs additionally require `msg.sender == hub`? The binding C1 and C3 both carry. */
  senderChecked?: boolean;
  /**
   * Build the reached event slot as a plain funding output instead of the event NFT. The guard negative
   * control for X29: an honest graph that settles WITHOUT its event output is the silent-drop failure mode,
   * not a repair. It must reject.
   */
  dropEvent?: boolean;
  /** Does the caller's handler also make a satoshi `transfer`? X29's second, independent variable. */
  transferring?: boolean;
  /** Pay the reached transfer slot to a filler instead of the recipient. The transfer's guard control. */
  dropTransfer?: boolean;
}

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

/**
 * Assemble a graph in which the caller forwards its own `value` to both legs. The transcript then states a
 * different argument, or a different target, for the caller's SECOND outgoing edge. The whole subtree below
 * that edge agrees with what the transcript states, so only the caller's own recomputation can reject.
 */
async function buildEffectSubstitution(cell: Cell): Promise<{
  builder: TransactionBuilder; transaction: string; provider: SemanticProvider;
  callerInput: number; emissionSlots: number; transferSlots: number;
}> {
  const provider = createLayer3SemanticTestProvider();
  const outpoints = new Set<string>();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const hubArtifact = compileString(hubSource(cell.emitting, cell.transferring === true), options);
  const legBArtifact = compileString(legBSource(cell.senderChecked === true), options);
  const legCArtifact = compileString(legCSource(cell.senderChecked === true), options);

  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(provider, hubBase, hubArtifact.stateLayout!, { total: 0n });
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));
  const legCBase = new Contract(legCArtifact, [hub.lockingBytecode], { provider });
  const legCSetup = await setupStatefulUtxos(provider, legCBase, legCArtifact.stateLayout!, { burned: 0n });
  const legC = legCBase.withCategory(hexToBin(legCSetup.categoryId));

  const participants: layer3.CompiledGraphParticipant[] = [
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
    { artifact: legCArtifact, lockingBytecode: legC.lockingBytecode },
  ];
  // The caller ALWAYS forwards its own `value` to both legs and always names its own two address arguments.
  const recipient = new Contract(p2pkhArtifact, [alicePkh], { provider }).lockingBytecode;
  const rootArgs = cell.transferring === true
    ? [legB.lockingBytecode, legC.lockingBytecode, CALL_VALUE, recipient]
    : [legB.lockingBytecode, legC.lockingBytecode, CALL_VALUE];
  const substituted = cell.tamper === 'argument' ? CALL_VALUE + 1n : CALL_VALUE;
  const statedSelector = cell.tamper === 'selector' ? 'credit' : 'debit';
  const invocations: layer3.CompiledGraphInvocation[] = [
    { parent: null, callee: 0, function: 'fireAll', args: rootArgs },
    { parent: 0, callee: 1, function: 'credit', args: [CALL_VALUE], callMode: 'call' },
    { parent: 0, callee: 2, function: statedSelector, args: [substituted], callMode: 'call' },
  ];
  const plan = layer3.planCompiledGraph(participants, invocations);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, plan.participants.map(() => null),
    plan.participants.map(() => ''), layout.projectionInputs,
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

  const hubLayout = hubArtifact.hiddenBatch!.route.blockLayout!;
  const hubSlotKind = new Map<number, string>(hubLayout.slots.map((slot: any) => [slot.offset, slot.kind]));
  const fillers = Array.from(
    { length: hubLayout.blockSize - 2 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of fillers) await provider.addUtxo(p2pkh.address, funding);

  const CONTAINER_SATS = 5_000n;
  const container = uniqueUtxo(outpoints, { satoshis: CONTAINER_SATS });
  if (cell.transferring === true) {
    await provider.addUtxo(getSatoshiContainerAddress(hub, hubSetup.categoryId), container);
  }

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
  tx.addInput(legCSetup.masterUtxo, routeFor(legC, legCArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any,
  ));
  tx.addInput(
    legCSetup.dataNftUtxos[0],
    createDataNftUnlocker(legC, layout.participantInputs[2], legCSetup.categoryId),
  );
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const currentCommitment: string = hubSetup.dataNftUtxos[0].token.nft.commitment;
  const zeroFieldHex = binToHex(packed(0n));
  const hubNext = binToHex(packed(0n)) + currentCommitment.slice(zeroFieldHex.length);
  const eventCommitment = binToHex(packed(CALL_VALUE));
  const eventAddress = cell.emitting
    ? getEventNftAddress(hub, hubSetup.categoryId, hubArtifact.events![0].signature) : '';
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
          category: hubSetup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: hubNext },
        },
      });
    } else if (kind === 'satoshiContainer') {
      tx.addOutput({
        to: getSatoshiContainerAddress(hub, hubSetup.categoryId), amount: CONTAINER_SATS - TRANSFER_SATS,
      });
    } else if (kind === 'transfer') {
      // Exactly one transfer is reached; every further conditional slot is an unreached filler.
      const reached = transferCursor === 0 && cell.dropTransfer !== true;
      transferCursor += 1;
      tx.addOutput(reached
        ? { to: p2pkh.address, amount: TRANSFER_SATS }
        : { to: p2pkh.address, amount: 1000n });
    } else if (kind === 'event') {
      // Exactly one `Fired` is reached; every further conditional event slot is an unreached filler pair.
      const reached = eventCursor === 0 && cell.dropEvent !== true;
      eventCursor += 1;
      tx.addOutput(reached ? {
        to: eventAddress, amount: 1000n,
        token: {
          category: hubSetup.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: eventCommitment },
        },
      } : { to: p2pkh.address, amount: 1000n });
    } else {
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
    }
  }
  const settle = (contract: Contract, setup: any, commitment: string): void => {
    tx.addOutput({
      to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
      token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    tx.addOutput({
      to: getDataNftAddress(contract, setup.categoryId), amount: setup.dataNftUtxos[0].satoshis,
      token: { category: setup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
  };
  settle(legB, legBSetup, buildInitialStateCommitments(legBArtifact.stateLayout!, { seen: CALL_VALUE })[0]);
  settle(legC, legCSetup, buildInitialStateCommitments(legCArtifact.stateLayout!, {
    burned: statedSelector === 'credit' ? substituted * 3n : substituted,
  })[0]);
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 30_000n });

  return {
    builder: tx,
    transaction: raw(tx),
    provider,
    callerInput: layout.participantInputs[0],
    emissionSlots: hubLayout.slots.filter((slot: any) => slot.kind === 'event').length,
    transferSlots: hubLayout.slots.filter((slot: any) => slot.kind === 'transfer').length,
  };
}

/**
 * X29's own hostile case, on the half the substitution cases do not reach.
 *
 * A transfer-carrying handler settles the satoshi container INSIDE its OP_INVOKE subroutine, which only runs on
 * a dispatch site that reached it - and this route also admits `note`, which carries no transfer. A batch whose
 * only row selects `note` therefore reaches no site, so nothing in the subroutine runs, while the container slot
 * is still in the block and the container's own covenant does not protect its output on the master-spend path.
 * Left unguarded that is a drain: co-spend the container, dispatch the sibling, keep the satoshis.
 *
 * `drain` is the single variable - whether the container output preserves the container or is a 0-value stub
 * with the satoshis taken to the fee change.
 */
async function buildSiblingOnlyBatch(drain: boolean): Promise<{
  builder: TransactionBuilder; transaction: string; provider: SemanticProvider; callerInput: number;
}> {
  const provider = createLayer3SemanticTestProvider();
  const outpoints = new Set<string>();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const hubArtifact = compileString(hubSource(false, true), options);
  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(provider, hubBase, hubArtifact.stateLayout!, { total: 0n });
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));

  const plan = layer3.planCompiledGraph(
    [{ artifact: hubArtifact, lockingBytecode: hub.lockingBytecode }],
    [{ parent: null, callee: 0, function: 'note', args: [CALL_VALUE] }],
  );
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, plan.participants.map(() => null),
    plan.participants.map(() => ''), layout.projectionInputs,
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

  const hubLayout = hubArtifact.hiddenBatch!.route.blockLayout!;
  const hubSlotKind = new Map<number, string>(hubLayout.slots.map((slot: any) => [slot.offset, slot.kind]));
  const fillers = Array.from(
    { length: hubLayout.blockSize }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of fillers) await provider.addUtxo(p2pkh.address, funding);
  const CONTAINER_SATS = 5_000n;
  const container = uniqueUtxo(outpoints, { satoshis: CONTAINER_SATS });
  await provider.addUtxo(getSatoshiContainerAddress(hub, hubSetup.categoryId), container);

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  let fillerCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addInput(hubSetup.masterUtxo, hub.createCompilerRouteUnlocker(
        hubArtifact.hiddenBatch!.route, hexToBin(hubArtifact.hiddenBatch!.selector),
      )(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any));
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
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

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
            commitment: buildInitialStateCommitments(hubArtifact.stateLayout!, { total: CALL_VALUE })[0],
          },
        },
      });
    } else if (kind === 'satoshiContainer') {
      // THE variable: preserve the container, or take its satoshis and leave a 0-value stub behind.
      tx.addOutput(drain
        ? { to: p2pkh.address, amount: 0n }
        : { to: getSatoshiContainerAddress(hub, hubSetup.categoryId), amount: CONTAINER_SATS });
    } else {
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
    }
  }
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: drain ? 35_000n : 30_000n });

  return {
    builder: tx, transaction: raw(tx), provider, callerInput: layout.participantInputs[0],
  };
}

const outcomeOf = (builder: TransactionBuilder): string => {
  try {
    layer3.preflightLayer3Transaction(builder);
  } catch (error) {
    return (error as Error).message;
  }
  return 'ACCEPTED';
};

const BUS_OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `76a914${'11'.repeat(20)}88ac`,
  experimentalMessageBusControllerCategory: 'cd'.repeat(32),
};

describe('Layer-3 emission binding vs an effect-carrying handler (SEMANTIC)', () => {
  const at = (input: number): string => `layer3: BCH-2026 preflight failed at input ${input}`;

  it('settles the honest graph with the effect-free caller', async () => {
    const built = await buildEffectSubstitution({ emitting: false, tamper: 'none' });
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  // The control: SEC-5's repaired shape. The clone stays behind OP_INVOKE, so the caller recomputes both of
  // its outgoing edges and rejects at its own input. It settles honestly and rejects both substitutions, in
  // exactly the configuration the emit-carrying shape settled them.
  it.each([{ tamper: 'argument' as const }, { tamper: 'selector' as const }])(
    'rejects a %o substitution when the handler carries no effect', async (cell) => {
      const built = await buildEffectSubstitution({ ...cell, emitting: false });
      expect(built.emissionSlots).toBe(0);
      expect(built.callerInput).toBe(0);
      expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
      await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
    }, 600_000,
  );

  /**
   * X29. The same two substitutions against the EMIT-CARRYING caller, which SEC-6 refused to compile at all and
   * which at 9bf3e5ea both SETTLED. The clone now stays behind OP_INVOKE like the effect-free one, so the
   * caller recomputes both of its outgoing edges and rejects at its own input - and it does so while still
   * PRODUCING the event, which is the half a plain "keep it behind OP_INVOKE" would have dropped.
   */
  it.each([{ tamper: 'argument' as const }, { tamper: 'selector' as const }])(
    'rejects a %o substitution when the handler carries an emit', async (cell) => {
      const built = await buildEffectSubstitution({ ...cell, emitting: true });
      expect(built.emissionSlots).toBe(8);
      expect(built.callerInput).toBe(0);
      expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
      await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
    }, 600_000,
  );

  // The honest positive control for the repaired shape. It must settle, and the event slots must actually be
  // in the route's block - not zero, which is what "kept behind OP_INVOKE, effect dropped" looked like.
  it('settles the honest graph with the emit-carrying caller', async () => {
    const built = await buildEffectSubstitution({ emitting: true, tamper: 'none' });
    expect(built.emissionSlots).toBe(8);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  /**
   * The guard negative control, and the one that separates X29 from the failure mode SEC-6 already found once.
   * Everything is the honest graph EXCEPT that the reached event slot carries a plain funding output instead of
   * the event NFT. A route whose emit was silently dropped settles this unchanged; a route that genuinely
   * produces the event cannot. It must reject at the caller's own input.
   */
  it('rejects the honest emit-carrying graph when its event output is missing', async () => {
    const built = await buildEffectSubstitution({ emitting: true, tamper: 'none', dropEvent: true });
    expect(built.emissionSlots).toBe(8);
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  /**
   * X29's second effect, measured on its own fixture because it changes the handler's signature. A satoshi
   * `transfer` is the other half of what C1 and C3 want alongside their outgoing calls, and it is strictly
   * harder than an event: it also co-spends the route's satoshi container, so the subroutine settles the
   * container identity and conservation too.
   */
  it('settles the honest graph with the transfer-carrying caller', async () => {
    const built = await buildEffectSubstitution({ emitting: false, transferring: true, tamper: 'none' });
    expect(built.transferSlots).toBe(8);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  // The transfer's guard control: paying the reached slot the wrong amount is the silent-drop signature.
  it('rejects the honest transfer-carrying graph when its transfer output is wrong', async () => {
    const built = await buildEffectSubstitution({
      emitting: false, transferring: true, tamper: 'none', dropTransfer: true,
    });
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  it.each([{ tamper: 'argument' as const }, { tamper: 'selector' as const }])(
    'rejects a %o substitution when the handler carries a transfer', async (cell) => {
      const built = await buildEffectSubstitution({ ...cell, emitting: false, transferring: true });
      expect(built.callerInput).toBe(0);
      expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
      await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
    }, 600_000,
  );

  /**
   * X29's own hostile case. Moving the container settlement into the subroutine leaves the not-reached path
   * unguarded unless the route preserves the container there, so this is the guard's negative control AND its
   * honest control, one variable apart. Both rows are the SAME batch selecting the transfer-free sibling.
   */
  it('settles a sibling-only batch that preserves the co-spent container', async () => {
    const built = await buildSiblingOnlyBatch(false);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  it('rejects a sibling-only batch that drains the co-spent container', async () => {
    const built = await buildSiblingOnlyBatch(true);
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // Both effects at once - the shape C1's router and C3's hub actually have.
  it('settles the honest graph with an emit AND a transfer', async () => {
    const built = await buildEffectSubstitution({ emitting: true, transferring: true, tamper: 'none' });
    expect([built.emissionSlots, built.transferSlots]).toEqual([8, 8]);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  it('rejects an argument substitution with both an emit and a transfer', async () => {
    const built = await buildEffectSubstitution({
      emitting: true, transferring: true, tamper: 'argument',
    });
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // The binding C1 and C3 both carry, measured as a separate variable: requiring `msg.sender == hub` in every
  // callee does not change the effect-free caller's own recomputation - it still rejects at input 0.
  it('rejects an argument substitution with the callee also checking msg.sender', async () => {
    const built = await buildEffectSubstitution({
      emitting: false, senderChecked: true, tamper: 'argument',
    });
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  it('settles the honest graph with the callee also checking msg.sender', async () => {
    const built = await buildEffectSubstitution({
      emitting: false, senderChecked: true, tamper: 'none',
    });
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  /**
   * The structural half of the same claim, and the discriminator between the three shapes this file has held.
   * Effect-free and emit-carrying now both admit the handler and both keep its clone behind OP_INVOKE, so the
   * emission-row recomputation appears the same number of times; only the emit-carrying one reserves the event
   * frames. The pre-SEC-6 flattened form scored 0 recomputations for the emit-carrying caller.
   */
  it('keeps the emit-carrying route bound AND gives it event slots', () => {
    // verifyGraphEmissionRow's target||len||mode frame construction, counted on debug.bytecode - the hex
    // script, i.e. the deployed form (artifact.bytecode is ASM). 0 here is the pre-SEC-6 flattened form.
    const mark = '76827752807c7e';
    const marks = (source: string): number =>
      (compileString(source, BUS_OPTIONS).debug!.bytecode as string).split(mark).length - 1;
    expect(marks(hubSource(false))).toBeGreaterThan(0);
    expect(marks(hubSource(true))).toBe(marks(hubSource(false)));
    const emitting = compileString(hubSource(true), BUS_OPTIONS);
    expect(emitting.hiddenBatch!.route.blockLayout!.slots.map((slot: any) => slot.kind))
      .toEqual(['master', 'dataNft', ...Array.from({ length: 8 }, () => 'event')]);
  }, 60_000);

  /**
   * The frame WIDTH, which is the part of X29 the VM cases above exercise only at width 1. A handler carrying
   * two or three events owns two or three consecutive slots per dispatch site, and the subroutine multiplies
   * its site ordinal by that width at runtime. Compile-level only, and stated as such: it pins that the
   * reservation scales and the edges stay bound, not that a width-3 graph settles.
   */
  it('scales the reserved frames with the handler emit width', () => {
    const wide = (emits: number): string => `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); }
contract WideEffectHub() {
  uint total;
  event Fired(uint value);
  function fireAll(address first, uint value) public {
${Array.from({ length: emits }, () => '    emit Fired(value);').join('\n')}
    IEffectLeg(first).credit(value);
    require(true);
  }
}`;
    const mark = '76827752807c7e';
    for (const [emits, expected] of [[1, 8], [2, 16], [3, 24]] as const) {
      const artifact = compileString(wide(emits), BUS_OPTIONS);
      expect(artifact.hiddenBatch!.route.blockLayout!.slots
        .filter((slot: any) => slot.kind === 'event')).toHaveLength(expected);
      expect((artifact.debug!.bytecode as string).split(mark).length - 1).toBeGreaterThan(0);
    }
  }, 60_000);

  /**
   * SEC-7, and it turned out NOT to be a message-bus property at all.
   *
   * SEC-6 pinned `this.tokens[c].transfer(..)` as bound-but-slotless and left it open. Probing it named the
   * real discriminator, which is whether the handler also READS its container:
   *
   *   handler body                                   route block
   *   require(tokens[c].tokenAmount >= a); transfer   [master, dataNft, tokenContainer, 8 x tcTransfer]
   *   transfer only                                   [master, dataNft]
   *
   * The read is what reserves the container INPUT slot, and without it the route settles with no transfer at
   * all - on the PLAIN hidden batch exactly as on the bus, so the message bus was never the variable. The same
   * function called DIRECTLY does enforce it ([master] -> [master, tokenContainer, tcTransfer] when the
   * transfer is added), and the spender picks which entry to use, so this is spender-selected effect omission
   * rather than a loss the caller absorbs.
   *
   * X29's per-site frames cannot repair it: a container is a co-spent INPUT bound to a category parameter, one
   * for the whole route rather than one per dispatch site. So it fails closed, on the drop condition itself
   * (routed handler transfers a container + route reserves no tcTransfer) rather than on a spelling.
   */
  const TOKEN_HUB = (reading: boolean): string => `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(int value); }
contract EscapeTokenHub() {
  int total;
  function fireAll(bytes32 category, bytes20 recipient, address first, int value) public {
${reading ? '    require(this.tokens[category].tokenAmount >= value);' : ''}
    this.tokens[category].transfer(recipient, value);
    IEffectLeg(first).credit(value);
    require(true);
  }
  function note(int credited) public {
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;

  it('refuses a routed token-container transfer the route reserves no slot for', () => {
    expect(() => compileString(TOKEN_HUB(false), BUS_OPTIONS))
      .toThrow(/performs a token-container operation the route reserves no output slot for/);
    expect(() => compileString(TOKEN_HUB(false), BUS_OPTIONS)).toThrow(/'fireAll'/);
  }, 30_000);

  // The refusal is on the drop, not on the bus: the same handler under a PLAIN hidden batch (no message-bus
  // controller, so no graph handler at all) drops the transfer identically and is refused identically.
  it('refuses the same drop on a plain hidden batch, with no message bus involved', () => {
    const plain = { forceStateful: true, experimentalHiddenBatch: true };
    const source = `pragma solidcash >=0.8.0;
contract PlainTokenBatch() {
  int calls;
  function send(bytes32 category, bytes20 recipient, int amount) public {
    this.tokens[category].transfer(new LockingBytecodeP2PKH(recipient), amount);
    this.calls = this.calls + 1;
  }
}`;
    expect(() => compileString(source, plain))
      .toThrow(/performs a token-container operation the route reserves no output slot for/);
  }, 30_000);

  /**
   * The over-refusal negative control, and the repair the error message names. Adding the container READ
   * reserves the input slot and the eight tcTransfer outputs, and the shape compiles unchanged - this is
   * Release 4's routed token batch, which is settled end-to-end (forged amount and forged recipient both
   * reject) in HiddenBatchRelease4. The refusal is therefore on the DROP, not on token containers.
   *
   * Kept on the plain hidden batch deliberately: the same body plus an outgoing external call is refused by
   * the OTHER guard (SEC-6's, in InlineStoragePointerCalls), because that clone would be flattened and its
   * edges would generate unbound - a different defect with a different refusal.
   */
  it('still admits a routed token-container transfer whose handler reads the container', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
contract TokenContainerReadBatch() {
  int calls;
  function send(bytes32 category, bytes20 recipient, int amount) public {
    require(this.tokens[category].tokenAmount >= amount);
    this.tokens[category].transfer(new LockingBytecodeP2PKH(recipient), amount);
    this.calls = this.calls + 1;
  }
}`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch!.route.blockLayout!.slots.map((slot: any) => slot.kind))
      .toEqual(['master', 'dataNft', 'tokenContainer', ...Array.from({ length: 8 }, () => 'tcTransfer')]);
  }, 30_000);

  // And the bus + external call spelling of the SAME body is refused too, by SEC-6's guard rather than this
  // one: an effect-carrying clone with an outgoing edge that no output frame can settle stays refused.
  it('refuses the read-and-transfer spelling once it also makes an outgoing call', () => {
    expect(() => compileString(TOKEN_HUB(true), BUS_OPTIONS))
      .toThrow(/token-container operation/);
  }, 30_000);

  /**
   * The refusal must not be wider than the defect. Two shapes that keep compiling, both admitted to a route:
   * an effect-carrying handler with NO outgoing call has no edge for a transcript to misstate, and the
   * effect-free caller is SEC-5's repaired shape.
   */
  it('still admits an effect-carrying handler that makes no outgoing call', () => {
    const source = `pragma solidcash >=0.8.0;
contract EscapeLocalEffect() {
  uint total;
  event Noted(uint credited);
  function note(uint credited) public {
    emit Noted(credited);
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;
    const artifact = compileString(source, BUS_OPTIONS);
    expect(artifact.hiddenBatch?.handlers.map((handler: any) => [handler.name, handler.eligible]))
      .toEqual([['note', true]]);
  }, 30_000);

  it('still admits the effect-free caller', () => {
    const artifact = compileString(hubSource(false), BUS_OPTIONS);
    expect(artifact.hiddenBatch?.handlers.map((handler: any) => [handler.name, handler.eligible]))
      .toEqual([['fireAll', true], ['note', true]]);
  }, 30_000);
});
