import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, StatefulContract, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createReadOnlyDynamicChunkUnlocker, createSatoshiContainerUnlocker,
  getDataNftAddress, getDynamicChunkAddress, getEventNftAddress, getSatoshiContainerAddress,
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
 * SEC-6's repair was a REFUSAL, because the obvious alternative was worse: keeping the clone behind OP_INVOKE
 * restores the binding but SILENTLY DROPS the effect - the route reserves its event / transfer slots by walking
 * its OWN body, so the un-flattened form declared none and the honest graph still settled with ZERO event slots
 * and no event output at all.
 *
 * X29 built the repair that refusal stood in for. The route reserves one effect FRAME per dispatch site on the
 * handler's behalf and pushes the site ordinal as hidden context; the shared subroutine resolves its own event
 * and transfer output indices against it, and settles them in its OP_INVOKE epilogue. So the emit-carrying row
 * of the table above becomes:
 *
 *   emit-carrying | behind OP_INVOKE | 3 (== effect-free) | SETTLES | REJECTS @0 | REJECTS @0
 *
 * and the effect is asserted PRESENT rather than assumed: an honest graph whose event output is replaced by a
 * plain funding output, or whose transfer output carries the wrong amount, must reject. A dropped effect
 * settles both unchanged, which is the whole point of keeping those two cases in this file.
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
 * a physical effect. The original cells reach the same two legs through ordinary interface calls; SEC-5's
 * closure cells switch only that dispatch to a persisted runtime-sized function-pointer table.
 *
 * `transferring` is X29's second, INDEPENDENT variable, and it changes the signature (a recipient parameter), so
 * it is never combined with an `emitting`-only cell - the two are measured on their own fixtures.
 */
const hubSource = (emitting: boolean, transferring = false, pointerTable = false): string => `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); function debit(uint value); }
contract EscapeEffectHub() {
${pointerTable ? '  function(uint) external[] legs;' : ''}
  uint total;
  event Fired(uint value);
${pointerTable ? `  function registerCredit(address target) public { this.legs.push(IEffectLeg(target).credit); require(true); }
  function registerDebit(address target) public { this.legs.push(IEffectLeg(target).debit); require(true); }` : ''}
  function fireAll(${pointerTable ? '' : 'address first, address second, '}uint value${transferring ? ', bytes recipient' : ''}) public {
${emitting ? '    emit Fired(value);' : ''}
${transferring ? `    this.transfer(recipient, ${TRANSFER_SATS});` : ''}
${pointerTable ? `    require(legs.length <= 2);
    for (int i = 0; i < legs.length; i = i + 1) { legs[i](value); }` : `    IEffectLeg(first).credit(value);
    IEffectLeg(second).debit(value);`}
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
  /** Dispatch the same two calls through a persisted runtime-sized function-pointer table. */
  pointerTable?: boolean;
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
  const hubArtifact = compileString(hubSource(
    cell.emitting, cell.transferring === true, cell.pointerTable === true,
  ), options);
  const legBArtifact = compileString(legBSource(cell.senderChecked === true), options);
  const legCArtifact = compileString(legCSource(cell.senderChecked === true), options);

  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(provider, hubBase, hubArtifact.stateLayout!, cell.pointerTable
    ? { total: 0n, legs: [], __fnsel_legs: [] } : { total: 0n });
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));
  const legCBase = new Contract(legCArtifact, [hub.lockingBytecode], { provider });
  const legCSetup = await setupStatefulUtxos(provider, legCBase, legCArtifact.stateLayout!, { burned: 0n });
  const legC = legCBase.withCategory(hexToBin(legCSetup.categoryId));

  if (cell.pointerTable) {
    const stateful = StatefulContract.withCategory(hubBase, hubSetup.categoryId);
    await stateful.registerCredit(legB.lockingBytecode).send();
    await stateful.registerDebit(legC.lockingBytecode).send();
  }
  const currentHub = cell.pointerTable
    ? await StatefulContract.withCategory(hubBase, hubSetup.categoryId).getFullState()
    : { masterUtxo: hubSetup.masterUtxo, dataNftUtxos: hubSetup.dataNftUtxos };

  const participants: layer3.CompiledGraphParticipant[] = [
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
    { artifact: legCArtifact, lockingBytecode: legC.lockingBytecode },
  ];
  // The caller ALWAYS forwards its own `value` to both legs and always names its own two address arguments.
  const recipient = new Contract(p2pkhArtifact, [alicePkh], { provider }).lockingBytecode;
  const rootArgs = cell.pointerTable
    ? (cell.transferring === true ? [CALL_VALUE, recipient] : [CALL_VALUE])
    : (cell.transferring === true
      ? [legB.lockingBytecode, legC.lockingBytecode, CALL_VALUE, recipient]
      : [legB.lockingBytecode, legC.lockingBytecode, CALL_VALUE]);
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

  const chunks: { variable: any; utxo: any; address: string }[] = [];
  for (const variable of hubArtifact.stateLayout!.variables.filter((entry: any) => entry.dynamic)) {
    const address = getDynamicChunkAddress(hub, hubSetup.categoryId, variable.name, variable.type);
    for (const utxo of await provider.getUtxos(address)) chunks.push({ variable, utxo, address });
  }

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
  let chunkCursor = 0;
  let fillerCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addInput(currentHub.masterUtxo, routeFor(hub, hubArtifact)(
        ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
      ));
    } else if (kind === 'dataNft') {
      tx.addInput(
        currentHub.dataNftUtxos[0],
        createDataNftUnlocker(hub, layout.participantInputs[0], hubSetup.categoryId),
      );
    } else if (kind === 'satoshiContainer') {
      tx.addInput(container, createSatoshiContainerUnlocker(
        hub, layout.participantInputs[0], hubSetup.categoryId,
      ));
    } else if (kind === 'trailing' && chunkCursor < chunks.length) {
      const { variable, utxo } = chunks[chunkCursor];
      chunkCursor += 1;
      tx.addInput(utxo, createReadOnlyDynamicChunkUnlocker(
        hub, layout.participantInputs[0], hubSetup.categoryId, variable.name, variable.type,
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

  const currentCommitment: string = currentHub.dataNftUtxos[0].token.nft.commitment;
  const zeroFieldHex = binToHex(packed(0n));
  const hubNext = binToHex(packed(0n)) + currentCommitment.slice(zeroFieldHex.length);
  const eventCommitment = binToHex(packed(CALL_VALUE));
  const eventAddress = cell.emitting
    ? getEventNftAddress(hub, hubSetup.categoryId, hubArtifact.events![0].signature) : '';
  let eventCursor = 0;
  let transferCursor = 0;
  let chunkOutCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addOutput({
        to: hub.tokenAddress, amount: currentHub.masterUtxo.satoshis,
        token: { category: hubSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    } else if (kind === 'dataNft') {
      tx.addOutput({
        to: getDataNftAddress(hub, hubSetup.categoryId), amount: currentHub.dataNftUtxos[0].satoshis,
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
    } else if (kind === 'trailing' && chunkOutCursor < chunks.length) {
      const { address, utxo } = chunks[chunkOutCursor];
      chunkOutCursor += 1;
      tx.addOutput({ to: address, amount: utxo.satoshis, token: utxo.token });
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

/**
 * SEC-8. The sibling batch again, with the sibling itself a FRAME MEMBER.
 *
 * `buildSiblingOnlyBatch`'s `note` carries no effect at all, so it joins no frame group and is flattened into
 * the route - the reached flag is never written and the route's not-reached guard fires. Give the sibling an
 * `emit` and an outgoing call and it becomes a frame member sharing ONE `GraphEffectFrame` with the
 * transfer-carrying handler, whose `transferWidth` is the group MAXIMUM. The dispatch site then claims the
 * container was settled while the sibling's subroutine settles nothing.
 *
 * Both handlers must emit: `eventMode` refuses any eligible handler with no direct emit, so a route admitting
 * an emit-carrying sibling drops a purely transfer-carrying one from the ABI and reserves no container at all.
 * That is the shape Worker C measured, and it is why its drain was accepted with no container in the
 * transaction. Here the container slot is asserted present before the batch is built.
 *
 * `drain` is the single variable, exactly as in the transfer-free pair above.
 */
const sec8HubSource = `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); }
contract Sec8EffectHub() {
  uint total;
  event Fired(uint value);
  function fireAll(address first, uint value, bytes recipient) public {
    emit Fired(value);
    this.transfer(recipient, ${TRANSFER_SATS});
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

async function buildSec8ContainerBatch(drain: boolean): Promise<{
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
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const hubArtifact = compileString(sec8HubSource, options);
  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(provider, hubBase, hubArtifact.stateLayout!, { total: 0n });
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const legBArtifact = compileString(legBSource(false), options);
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'note', args: [legB.lockingBytecode, CALL_VALUE] },
    { parent: 0, callee: 1, function: 'credit', args: [CALL_VALUE], callMode: 'call' },
  ]);
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

  const eventCommitment = binToHex(packed(CALL_VALUE));
  const eventAddress = getEventNftAddress(hub, hubSetup.categoryId, hubArtifact.events![0].signature);
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
            commitment: buildInitialStateCommitments(hubArtifact.stateLayout!, { total: CALL_VALUE })[0],
          },
        },
      });
    } else if (kind === 'satoshiContainer') {
      // THE variable: preserve the container, or take its satoshis and leave a 0-value stub behind.
      tx.addOutput(drain
        ? { to: p2pkh.address, amount: 0n }
        : { to: getSatoshiContainerAddress(hub, hubSetup.categoryId), amount: CONTAINER_SATS });
    } else if (kind === 'event') {
      const reached = eventCursor === 0;
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
        commitment: buildInitialStateCommitments(legBArtifact.stateLayout!, { seen: CALL_VALUE })[0],
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
 * SEC-9. `eventWidth` is a group MAXIMUM by the same construction that produced SEC-8, and there is no event
 * analogue of the not-reached container guard.
 *
 * The route's ELIGIBILITY gate does require uniform event counts, but it counts DIRECT `emit` statements before
 * lowering while the frame reservation counts `emitInfos` after it, so an emit reached through an INTERNAL CALL
 * is invisible to it. Measured on `Sec9EffectHub` with `note`'s `this.chirp(credited)` line deleted: both
 * handlers show one direct emit and are admitted, `fireAll` carries two `emitInfos` and `note` one, the shared
 * frame reserves TWO event slots per dispatch site, and a row selecting `note` settles ONE of them. An
 * own-category event NFT minted by the spender into the REACHED site's second slot - commitment 999999, one
 * variable from an otherwise identical honest batch - was **ACCEPTED**. The unsettled slot belonging to a
 * reached site is what separates this from the unreached conditional slots of a short batch, which are
 * unconstrained already and predate X29.
 *
 * That shape is now REFUSED (see the compile-level case below), so the surviving VM evidence is the UNIFORM
 * width-2 route: `mode` varies only what the reached site's SECOND event slot carries, which is the slot the
 * divergent shape left unverified.
 */
const sec9HubSource = (uniform: boolean): string => `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); }
contract Sec9EffectHub() {
  uint total;
  event Fired(uint value);
  function chirp(uint v) internal { emit Fired(v + 7); }
  function fireAll(address first, uint value, bytes recipient) public {
    emit Fired(value);
    this.chirp(value);
    this.transfer(recipient, ${TRANSFER_SATS});
    IEffectLeg(first).credit(value);
    require(true);
  }
  function note(address first, uint credited) public {
    emit Fired(credited);
${uniform ? '    this.chirp(credited);' : ''}
    IEffectLeg(first).credit(credited);
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;

type Sec9Mode = 'honest' | 'dropSecond' | 'forgeSecond' | 'forgeUnreached' | 'emptyUnreached';

async function buildSec9EventBatch(mode: Sec9Mode): Promise<{
  builder: TransactionBuilder; transaction: string; provider: SemanticProvider;
  callerInput: number; eventSlots: number;
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
  const hubArtifact = compileString(sec9HubSource(true), options);
  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(provider, hubBase, hubArtifact.stateLayout!, { total: 0n });
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const legBArtifact = compileString(legBSource(false), options);
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'note', args: [legB.lockingBytecode, CALL_VALUE] },
    { parent: 0, callee: 1, function: 'credit', args: [CALL_VALUE], callMode: 'call' },
  ]);
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
  const eventNft = (value: bigint): any => ({
    to: eventAddress, amount: 1000n,
    token: {
      category: hubSetup.categoryId, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(packed(value)) },
    },
  });
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
            commitment: buildInitialStateCommitments(hubArtifact.stateLayout!, { total: CALL_VALUE })[0],
          },
        },
      });
    } else if (kind === 'satoshiContainer') {
      tx.addOutput({
        to: getSatoshiContainerAddress(hub, hubSetup.categoryId), amount: CONTAINER_SATS,
      });
    } else if (kind === 'event') {
      // Slots 0 and 1 are the REACHED site's two frame slots - `emit Fired(credited)` then the internal
      // `chirp`'s `emit Fired(credited + 7)`. Slot 1 is THE variable for the SEC-9 rows. Slot 6 belongs to
      // dispatch site 3, which no row reaches: it is the SEC-15 variable, and stays a plain funding output
      // everywhere else.
      const index = eventCursor;
      eventCursor += 1;
      const settledSecond = mode !== 'dropSecond' && mode !== 'forgeSecond';
      if (index === 0) tx.addOutput(eventNft(CALL_VALUE));
      else if (index === 1 && settledSecond) tx.addOutput(eventNft(CALL_VALUE + 7n));
      else if (index === 1 && mode === 'forgeSecond') tx.addOutput(eventNft(999_999n));
      else if (index === 6 && mode === 'forgeUnreached') tx.addOutput(eventNft(999_999n));
      else if (index === 6 && mode === 'emptyUnreached') {
        tx.addOutput({
          to: eventAddress,
          amount: 1000n,
          token: {
            category: hubSetup.categoryId,
            amount: 0n,
            nft: { capability: 'none' as const, commitment: '' },
          },
        });
      } else tx.addOutput({ to: p2pkh.address, amount: 1000n });
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
        commitment: buildInitialStateCommitments(legBArtifact.stateLayout!, { seen: CALL_VALUE })[0],
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
    eventSlots: hubLayout.slots.filter((slot: any) => slot.kind === 'event').length,
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

/**
 * X152. Which byte rules the finalized bytes break, if any.
 *
 * The container-drain hostiles below leave a below-dust output BECAUSE they drain the container, so they
 * cannot be moved off the dust without deleting the attack. What can be pinned is that the dust is not what
 * refuses them: `preflightLayer3Transaction` runs the VM before the byte rules, so the covenant speaks first
 * and names the caller's own input. Asserting the byte objection EXISTS and is not the one delivered is what
 * keeps a future move onto a gate-bearing send path from silently making these rejections dust-attributable.
 */
const byteRefusals = (rawTx: string): string[] =>
  layer3.assessFinalizedTransactionBytes(decodeTransactionUnsafe(hexToBin(rawTx)))
    .refusals.map((row) => row.rule).sort();

const BUS_OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `76a914${'11'.repeat(20)}88ac`,
  experimentalMessageBusControllerCategory: 'cd'.repeat(32),
};

// The mock network's consensus decider owns every broadcast refusal below. Keep the node-facing half named
// too: the adjacent preflight assertion pins the exact caller input, while this marker proves the finalized
// bytes reached script verification rather than failing for dust, size, missing inputs, or an RPC condition.
const SCRIPT_REFUSAL = /mandatory-script-verify-flag-failed/;

describe('Layer-3 emission binding vs an effect-carrying handler (SEMANTIC)', () => {
  const at = (input: number): string =>
    `layer3 [L3_SCB_ENVELOPE_MALFORMED]: BCH-2026 preflight failed at input ${input}`;

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
      await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
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
      await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
  }, 600_000);

  it.each([{ tamper: 'argument' as const }, { tamper: 'selector' as const }])(
    'rejects a %o substitution when the handler carries a transfer', async (cell) => {
      const built = await buildEffectSubstitution({ ...cell, emitting: false, transferring: true });
      expect(built.callerInput).toBe(0);
      expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
      await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
    }, 600_000,
  );

  /**
   * SEC-5's formerly unproved intersection: the caller's two edges come from a persisted runtime-sized
   * function-pointer table AND the caller carries a physical output effect. These are VM cases rather than a
   * composition of the effect-free pointer-table test with the ordinary-call effect test.
   */
  it.each([
    { emitting: true, transferring: false, label: 'event' },
    { emitting: false, transferring: true, label: 'transfer' },
  ])('settles persisted pointer-table dispatch carrying an honest $label', async (cell) => {
    const built = await buildEffectSubstitution({
      emitting: cell.emitting, transferring: cell.transferring, pointerTable: true, tamper: 'none',
    });
    expect(cell.emitting ? built.emissionSlots : built.transferSlots).toBeGreaterThan(0);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  it.each([
    { emitting: true, transferring: false, dropEvent: true, label: 'event' },
    { emitting: false, transferring: true, dropTransfer: true, label: 'transfer' },
  ])('rejects persisted pointer-table dispatch with its reached $label output missing', async (cell) => {
    const built = await buildEffectSubstitution({
      emitting: cell.emitting, transferring: cell.transferring, pointerTable: true, tamper: 'none',
      dropEvent: cell.dropEvent, dropTransfer: cell.dropTransfer,
    });
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
  }, 600_000);

  it.each([
    { emitting: true, transferring: false, label: 'event' },
    { emitting: false, transferring: true, label: 'transfer' },
  ])('rejects an argument-substituted caller row for persisted pointer-table + $label', async (cell) => {
    const built = await buildEffectSubstitution({
      emitting: cell.emitting, transferring: cell.transferring, pointerTable: true, tamper: 'argument',
    });
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
  }, 600_000);

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
   * SEC-8. The same pair with the sibling upgraded to a FRAME MEMBER, which is the case the shared frame's
   * group-maximum `transferWidth` cannot distinguish. One variable against its honest control: whether the
   * container output preserves the container. The container slot is asserted present so an ACCEPTED drain
   * cannot be credited to a batch that co-spends no container.
   */
  it('settles an effect-carrying sibling batch that preserves the co-spent container', async () => {
    const built = await buildSec8ContainerBatch(false);
    expect(built.containerSlots).toBe(1);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  it('rejects an effect-carrying sibling batch that drains the co-spent container', async () => {
    const built = await buildSec8ContainerBatch(true);
    expect(built.containerSlots).toBe(1);
    expect(built.callerInput).toBe(0);
    const outcome = outcomeOf(built.builder);
    expect(outcome).toContain(at(built.callerInput));
    // X152, same as the sibling-only drain above: the dust is a consequence of the attack, and the refusal
    // delivered is the covenant's rather than the byte gate's.
    expect(byteRefusals(built.transaction)).toEqual(['output-dust']);
    expect(outcome, 'the byte gate spoke before the covenant').not.toMatch(/finalized transaction refused by/);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(new RegExp(`evaluating input index ${built.callerInput}`));
  }, 600_000);

  /**
   * SEC-9's positive control, and the first VM settlement of an effect frame at width > 1: the reached site
   * owns TWO event slots and both carry the handler's own events, one of them emitted through an internal call.
   */
  it('settles a uniform width-2 event frame with both reached slots settled', async () => {
    const built = await buildSec9EventBatch('honest');
    expect(built.eventSlots).toBe(16);
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  // The guard negative controls for the SAME slot the divergent shape left unverified: dropping it and forging
  // it must both reject, so an accepted forgery in the divergent shape is attributable to the missing frame
  // width and not to event slots being unchecked in general.
  it('rejects the width-2 batch with the reached site second event dropped', async () => {
    const built = await buildSec9EventBatch('dropSecond');
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
  }, 600_000);

  it('rejects a forged event NFT in the reached site second event slot', async () => {
    const built = await buildSec9EventBatch('forgeSecond');
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
  }, 600_000);

  /**
   * SEC-15 at frame width TWO, which is the only shape that exercises the ordinal-window form of the binding
   * (`site * width <= ordinal < site * width + width`) rather than the width-1 equality. Slot 6 belongs to
   * dispatch site 3, which no row reaches, and the honest batch leaves it a plain funder. Measured ACCEPTED
   * before the repair - a forged log in a slot no handler settles - and refused at the route's own input now.
   */
  it('SEC-15: rejects a forged event NFT in an UNREACHED width-2 frame slot', async () => {
    const built = await buildSec9EventBatch('forgeUnreached');
    expect(built.eventSlots).toBe(16);
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
  }, 600_000);

  /**
   * SEC-15 guard control at width two. Same output class in the same unreached slot - own-category, 'none'
   * capability, event covenant address, same value - carrying an EMPTY commitment. It must still settle, so
   * the refusal above belongs to the commitment binding rather than to SEC-11's offset pin, which admits any
   * own-category immutable NFT at an `event` offset and cannot separate these two rows.
   */
  it('SEC-15 guard: an EMPTY-commitment NFT in that same unreached width-2 slot settles', async () => {
    const built = await buildSec9EventBatch('emptyUnreached');
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  /** Graph framing carries each handler's event width, while the legacy flattened route remains fail-closed. */
  it('supports heterogeneous graph event frames but refuses the ambiguous flattened route', () => {
    const heterogeneous = compileString(sec9HubSource(false), BUS_OPTIONS);
    expect(heterogeneous.hiddenBatch!.route.blockLayout!.slots
      .filter((slot: any) => slot.kind === 'event')).toHaveLength(16);
    const flattened = compileString(sec9HubSource(false), {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    expect(flattened.hiddenBatch).toBeUndefined();
    const uniform = compileString(sec9HubSource(true), BUS_OPTIONS);
    expect(uniform.hiddenBatch!.route.blockLayout!.slots
      .filter((slot: any) => slot.kind === 'event')).toHaveLength(16);
  }, 60_000);

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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
  }, 600_000);

  // The binding C1 and C3 both carry, measured as a separate variable: requiring `msg.sender == hub` in every
  // callee does not change the effect-free caller's own recomputation - it still rejects at input 0.
  it('rejects an argument substitution with the callee also checking msg.sender', async () => {
    const built = await buildEffectSubstitution({
      emitting: false, senderChecked: true, tamper: 'argument',
    });
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(SCRIPT_REFUSAL);
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
      .toThrow(/performs a token-container operation, which the route reserves no output slot for/);
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
      .toThrow(/performs a token-container operation, which the route reserves no output slot for/);
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
