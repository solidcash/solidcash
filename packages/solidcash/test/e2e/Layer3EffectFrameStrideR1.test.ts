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
import { readEventsFromChain } from '../../src/stateful/StateReader.js';

/**
 * ROUND-15 INDEPENDENT HOSTILE REVIEW of X29, by a worker that implemented none of it.
 *
 * X29 reserves `sites * width` consecutive slots of each kind on the route and has the shared subroutine
 * resolve `master + base + site * width + i`. Every committed fixture settles the effect on the participant's
 * LOCAL ROW 0, so `site * width` is multiplied by zero: what those fixtures prove is that consecutive slots at
 * the frame BASE are bound, not that the frame moves with the dispatch site.
 *
 * This file reaches ordinal 1 by giving the hub TWO local rows. `StrideKick` is the graph root and makes two
 * outgoing calls to the hub, so the hub is a MULTI-ROW MID-CHAIN participant. `note` is effect-free and is
 * flattened into the route; `fireAll` carries an `emit` and a `transfer` plus an outgoing edge, so it stays
 * behind OP_INVOKE and owns a frame.
 *
 * RESULT 1 - STRIDING HOLDS. One variable, both directions, and the ordinal follows the ROW:
 *
 *   hub local rows          fireAll settles at   built at ordinal 0   built at ordinal 1
 *   [fireAll]               ordinal 0            SETTLES              REJECTS @ input 0
 *   [note, fireAll]         ordinal 1            REJECTS @ input 0    SETTLES
 *   [fireAll, note]         ordinal 0            SETTLES              REJECTS @ input 0
 *
 * and the effect is asserted PRESENT, not merely bound: a two-row batch whose row-1 transfer slot carries a
 * plain funder instead of the recipient payment REJECTS @ input 0.
 *
 * RESULT 2 - A LIVE FORGED LOG in X29's own reserved slots, now REPAIRED (SEC-15). The frame reserves 8 event
 * outputs and only the REACHED site settles one. `emitEventCovenantVerification` skipped its SEC-10 not-taken
 * binding whenever the route owned an effect frame (`frameShadowed`), and `emitOwnCategoryImmutableNftOutputPin`
 * admits an own-category immutable NFT at ANY `event` block-layout offset - so the unreached frame slots were
 * bound by nothing. One variable from the honest transaction, BEFORE -> AFTER the repair:
 *
 *   forged own-category event NFT at ...   before                     after
 *   settled ordinal 0 (flattened row 0)    REJECTS @ input 0          REJECTS @ input 0
 *   settled ordinal 1 (reached site)       REJECTS @ input 0          REJECTS @ input 0
 *   UNREACHED ordinals 2, 5, 7             ACCEPTED, and readEvents-  REJECTS @ input 0
 *                                          FromChain returns
 *                                          Fired(999999) beside the
 *                                          two genuine logs
 *   UNREACHED transfer ordinal 4           REJECTS @ input 0          REJECTS @ input 0 (SEC-11's pin)
 *   UNREACHED ordinal 3, SINGLE-ROW shape  ACCEPTED                   REJECTS @ input 0
 *   UNREACHED ordinal 3, invoked handler   ACCEPTED                   REJECTS @ input 0
 *     is the route's ONLY emitter
 *   GUARD: that same NFT, that same        ACCEPTED                   ACCEPTED
 *     unreached slot, EMPTY commitment
 *
 * The honest transaction settles in both columns of every row. The GUARD row is what credits the repair rather
 * than SEC-11's offset pin: the pin admits any own-category immutable NFT at an `event` offset, so it cannot
 * separate those two rows and only a commitment binding can.
 *
 * ATTRIBUTION, measured by ablation rather than argued: with `frameShadowed` forced to `false` the HONEST
 * transaction rejects @ input 0 too - the route's not-taken binding requires an empty commitment and the
 * reached site's genuine event NFT carries a non-empty one. The exemption is therefore load-bearing, and a
 * repair has to be per-slot (bind the ordinals this dispatch site does not own) rather than a route-wide skip.
 *
 * SEC-15 is that per-slot repair: the route carries the reached dispatch site's ORDINAL (GRAPH_EVENT_SITE, -1
 * when no site was reached) and binds every reserved event ordinal outside that site's window to an empty
 * commitment - inside the per-emit `OP_ELSE` where the route has a pending emit of its own, and standalone
 * (emitGraphFrameEventSlotBinding) where it has none, which is the last row's shape.
 *
 * RESULT 3 - a limit that is NOT X29's. Two rows that BOTH dispatch a handler with an OUTGOING EDGE never
 * settle, whatever the handler carries:
 *
 *   hub local rows      handler carries            verdict
 *   [note, note]        nothing, no edge           ACCEPTED
 *   [note, fireAll]     emit + transfer + edge     ACCEPTED
 *   [fireAll, fireAll]  nothing but an edge        REJECTS @ input 0
 *   [fireAll, fireAll]  emit + edge (no container) REJECTS @ input 0
 *   [fireAll, fireAll]  transfer + edge            REJECTS @ input 0 at every container output value
 *
 * The effect frames are not the discriminator - the edge-free control rejects identically. Consequence: the
 * subroutine's `containerIn - containerOut <= min(reached site transfers)` bound STAYS UNMEASURED, because the
 * only shape that would exercise it (two reached transfer sites in one batch) is unreachable for this
 * independent reason.
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
const CALL_VALUE = 4n;
const CONTAINER_SATS = 5_000n;

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

/**
 * The effect-carrying handler is `fireAll`; `note` is the sibling that occupies local row 0.
 *
 * The route's eligibility gate requires UNIFORM event counts across the batch
 * (`event-route-requires-uniform-events-and-at-most-one-value-transfer`), so `note` must emit exactly as
 * often as `fireAll` to occupy a row. Transfers are not required to be uniform, which is what lets
 * `transferOnly` measure the transfer frame with an effect-free row 0.
 *
 * `noteEmits: false` is measured, not assumed, to compile and settle: the uniformity assertion in
 * SymbolTableTraversal ranges over graph emission HANDLERS, and a flattened `note` is not one. It leaves the
 * invoked handler as the route's only emitter and is only used with `mode: 'single'`, where no row dispatches
 * `note` at all - so it changes no handler's published callsite count and no row binding.
 */
const hubSource = (emitting: boolean, transferring = true, noteEmits = true): string => `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); }
contract StrideHub() {
  uint total;
${emitting ? '  event Fired(uint value);' : ''}
  function fireAll(address first, uint value, bytes recipient) public {
${emitting ? '    emit Fired(value);' : ''}
${transferring ? `    this.transfer(recipient, ${TRANSFER_SATS});` : ''}
    IEffectLeg(first).credit(value);
    require(true);
  }
  function note(uint credited) public {
${emitting && noteEmits ? '    emit Fired(credited);' : ''}
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;

/** The graph root. Its outgoing edges are what give the hub its local rows. */
const kickSource = (mode: Mode): string => `pragma solidcash >=0.8.0;
interface IStrideHub { function note(uint credited); function fireAll(address first, uint value, bytes recipient); }
interface IStrideLeg { function credit(uint value); }
contract StrideKick(address hub) {
  uint fired;
  function kick(address leg, uint value, bytes recipient) public {
    this.fired = this.fired + 1;
${mode === 'noteThenFire' ? '    IStrideHub(hub).note(value);' : ''}
${mode === 'noteTwice'
    ? '    IStrideHub(hub).note(value);\n    IStrideHub(hub).note(value);\n    IStrideLeg(leg).credit(value);'
    : '    IStrideHub(hub).fireAll(leg, value, recipient);'}
${mode === 'fireThenNote' ? '    IStrideHub(hub).note(value);' : ''}
${mode === 'fireTwice' ? '    IStrideHub(hub).fireAll(leg, value, recipient);' : ''}
    require(true);
  }
}`;

const legSource = `pragma solidcash >=0.8.0;
contract StrideLeg(address hub) {
  uint seen;
  function credit(uint value) public {
    this.seen = this.seen + value;
    require(value > 0);
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

type Mode = 'single' | 'noteThenFire' | 'fireThenNote' | 'fireTwice' | 'noteTwice';

interface Cell {
  /**
   * `single` - one hub row (`fireAll`), the shape every committed fixture uses.
   * `noteThenFire` - two hub rows, `note` on local row 0 and `fireAll` on local row 1.
   * `fireTwice` - two hub rows, BOTH `fireAll`, so two dispatch sites settle from one subroutine.
   */
  mode: Mode;
  /** Which frame ordinals the measured effect outputs are built at. THE measured variable. */
  effectOrdinals: number[];
  /** Does the hub carry an `emit` at all? Off = the transfer frame alone; on = both frames. */
  emitting: boolean;
  /** Does the hub carry a `this.transfer(..)`? Off isolates the event frame from the satoshi container. */
  transferring?: boolean;
  /** Satoshis the container output keeps back. Defaults to one TRANSFER_SATS per reached site. */
  containerOut?: bigint;
  /**
   * Mint an own-category IMMUTABLE NFT at this UNREACHED frame event ordinal, at the contract's own event
   * covenant address, with a commitment no handler ever emitted. That is byte-for-byte what a genuine log is.
   */
  forgedEventOrdinal?: number;
  /** The same forged NFT, at an unreached TRANSFER frame ordinal - the offset class SEC-11's pin refuses. */
  forgedTransferOrdinal?: number;
  /**
   * GUARD CONTROL for SEC-15. Mint the forged NFT with an EMPTY commitment instead of a forged log body.
   * Byte-for-byte the same output class - same address, same category, same 'none' capability, same value -
   * differing only in the one field the repair rules on. It must stay ACCEPTED, which is what separates
   * "the not-taken commitment binding refused this" from "something refuses any token at an unreached slot".
   */
  forgedEventCommitmentEmpty?: boolean;
  /**
   * Does the FLATTENED sibling `note` carry the `emit`? Off leaves the invoked handler as the only emitter, so
   * the route has no pending emit of its own and `emitEventCovenantVerification` never runs on it at all -
   * the same reserved slots, reached by a different code path.
   */
  noteEmits?: boolean;
}

async function buildStrideCase(cell: Cell): Promise<{
  transaction: string; provider: SemanticProvider; callerInput: number; hubRows: string[];
  eventSlots: number; transferSlots: number; blockSize: number;
  eventAddress: string; eventDef: any; hubCategory: string;
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
  const hubArtifact = compileString(
    hubSource(cell.emitting, cell.transferring !== false, cell.noteEmits !== false), options,
  );
  const kickArtifact = compileString(kickSource(cell.mode), options);
  const legArtifact = compileString(legSource, options);

  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(provider, hubBase, hubArtifact.stateLayout!, { total: 0n });
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const kickBase = new Contract(kickArtifact, [hub.lockingBytecode], { provider });
  const kickSetup = await setupStatefulUtxos(provider, kickBase, kickArtifact.stateLayout!, { fired: 0n });
  const kick = kickBase.withCategory(hexToBin(kickSetup.categoryId));
  const legBase = new Contract(legArtifact, [hub.lockingBytecode], { provider });
  const legSetup = await setupStatefulUtxos(provider, legBase, legArtifact.stateLayout!, { seen: 0n });
  const leg = legBase.withCategory(hexToBin(legSetup.categoryId));

  const participants: layer3.CompiledGraphParticipant[] = [
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: kickArtifact, lockingBytecode: kick.lockingBytecode },
    { artifact: legArtifact, lockingBytecode: leg.lockingBytecode },
  ];
  const recipient = new Contract(p2pkhArtifact, [alicePkh], { provider }).lockingBytecode;
  const fire = (parent: number): layer3.CompiledGraphInvocation[] => ([
    {
      parent, callee: 0, function: 'fireAll',
      args: [leg.lockingBytecode, CALL_VALUE, recipient], callMode: 'call' as const,
    },
  ]);
  const root: layer3.CompiledGraphInvocation = {
    parent: null, callee: 1, function: 'kick', args: [leg.lockingBytecode, CALL_VALUE, recipient],
  };
  const note = (parent: number): layer3.CompiledGraphInvocation => ({
    parent, callee: 0, function: 'note', args: [CALL_VALUE], callMode: 'call' as const,
  });
  const invocations: layer3.CompiledGraphInvocation[] = cell.mode === 'noteTwice'
    ? [
      root,
      note(0),
      note(0),
      { parent: 0, callee: 2, function: 'credit', args: [CALL_VALUE], callMode: 'call' as const },
    ]
    : cell.mode === 'fireThenNote'
      ? [
        root,
        ...fire(0),
        { parent: 1, callee: 2, function: 'credit', args: [CALL_VALUE], callMode: 'call' as const },
        note(0),
      ]
      : cell.mode === 'noteThenFire'
        ? [
          root,
          note(0),
          ...fire(0),
          { parent: 2, callee: 2, function: 'credit', args: [CALL_VALUE], callMode: 'call' as const },
        ]
        : cell.mode === 'fireTwice'
          ? [
            root,
            ...fire(0),
            { parent: 1, callee: 2, function: 'credit', args: [CALL_VALUE], callMode: 'call' as const },
            ...fire(0),
            { parent: 3, callee: 2, function: 'credit', args: [CALL_VALUE], callMode: 'call' as const },
          ]
          : [
            root,
            ...fire(0),
            { parent: 1, callee: 2, function: 'credit', args: [CALL_VALUE], callMode: 'call' as const },
          ];
  const plan = layer3.planCompiledGraph(participants, invocations);
  const hubRows = (plan.participants[0] as any).batch.rows.map((row: any) => row.function ?? row.name);
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
  const fee = uniqueUtxo(outpoints, { satoshis: 400_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const hubLayout = hubArtifact.hiddenBatch!.route.blockLayout!;
  const hubSlotKind = new Map<number, string>(hubLayout.slots.map((slot: any) => [slot.offset, slot.kind]));
  const fillers = Array.from(
    { length: hubLayout.blockSize }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of fillers) await provider.addUtxo(p2pkh.address, funding);
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
  tx.addInput(kickSetup.masterUtxo, routeFor(kick, kickArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  tx.addInput(
    kickSetup.dataNftUtxos[0],
    createDataNftUnlocker(kick, layout.participantInputs[1], kickSetup.categoryId),
  );
  tx.addInput(legSetup.masterUtxo, routeFor(leg, legArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any,
  ));
  tx.addInput(
    legSetup.dataNftUtxos[0],
    createDataNftUnlocker(leg, layout.participantInputs[2], legSetup.categoryId),
  );
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const reachedSites = cell.mode === 'fireTwice' ? 2 : cell.mode === 'noteTwice' ? 0 : 1;
  const legCalls = cell.mode === 'fireTwice' ? 2 : 1;
  const hubTotal = cell.mode === 'noteTwice' ? CALL_VALUE * 2n
    : (cell.mode === 'noteThenFire' || cell.mode === 'fireThenNote') ? CALL_VALUE : 0n;
  const currentCommitment: string = hubSetup.dataNftUtxos[0].token.nft.commitment;
  const zeroFieldHex = binToHex(packed(0n));
  const hubNext = binToHex(packed(hubTotal)) + currentCommitment.slice(zeroFieldHex.length);
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
        to: getSatoshiContainerAddress(hub, hubSetup.categoryId),
        amount: cell.containerOut ?? (CONTAINER_SATS - TRANSFER_SATS * BigInt(reachedSites)),
      });
    } else if (kind === 'transfer') {
      const reached = cell.effectOrdinals.includes(transferCursor);
      const forged = cell.forgedTransferOrdinal === transferCursor;
      transferCursor += 1;
      if (forged) {
        tx.addOutput({
          to: eventAddress, amount: 1000n,
          token: {
            category: hubSetup.categoryId, amount: 0n,
            nft: { capability: 'none', commitment: binToHex(packed(999_999n)) },
          },
        });
      } else {
        tx.addOutput(reached
          ? { to: p2pkh.address, amount: TRANSFER_SATS }
          : { to: p2pkh.address, amount: 1000n });
      }
    } else if (kind === 'event') {
      // In `noteThenFire`, row 0 dispatches `note`, which is flattened into the route and settles its own
      // event at the route's own slot 0. `fireAll`'s event is the measured one, at `effectOrdinals`.
      const noteFires = cell.noteEmits !== false;
      const reached = cell.effectOrdinals.includes(eventCursor)
        || (noteFires && cell.mode === 'noteThenFire' && eventCursor === 0)
        || (noteFires && cell.mode === 'fireThenNote' && eventCursor === 1);
      const forged = cell.forgedEventOrdinal === eventCursor;
      eventCursor += 1;
      tx.addOutput(reached || forged ? {
        to: eventAddress, amount: 1000n,
        token: {
          category: hubSetup.categoryId, amount: 0n,
          nft: {
            capability: 'none',
            commitment: forged
              ? (cell.forgedEventCommitmentEmpty ? '' : binToHex(packed(999_999n)))
              : eventCommitment,
          },
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
  settle(kick, kickSetup, buildInitialStateCommitments(kickArtifact.stateLayout!, { fired: 1n })[0]);
  settle(leg, legSetup, buildInitialStateCommitments(
    legArtifact.stateLayout!, { seen: CALL_VALUE * BigInt(legCalls) },
  )[0]);
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 30_000n });

  return {
    transaction: raw(tx),
    provider,
    hubRows,
    eventAddress,
    eventDef: hubArtifact.events?.[0],
    hubCategory: hubSetup.categoryId as string,
    callerInput: layout.participantInputs[0],
    eventSlots: hubLayout.slots.filter((slot: any) => slot.kind === 'event').length,
    transferSlots: hubLayout.slots.filter((slot: any) => slot.kind === 'transfer').length,
    blockSize: hubLayout.blockSize,
  };
}

const show = (value: unknown): string =>
  JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));

/** Report the VM's rejection so a finding can name the input index rather than only "rejects". */
async function reject(built: { provider: SemanticProvider; transaction: string }): Promise<string> {
  try {
    await built.provider.sendRawTransaction(built.transaction);
  } catch (error) {
    return String((error as Error).message);
  }
  return 'ACCEPTED';
}

describe('X29 review R1: per-dispatch-site effect frame striding', () => {
  it('the hub really does dispatch fireAll on LOCAL ROW 1', async () => {
    const built = await buildStrideCase({ mode: 'noteThenFire', effectOrdinals: [1], emitting: false });
    expect(built.hubRows).toEqual(['note', 'fireAll']);
    expect(built.transferSlots).toBeGreaterThan(1);
  }, 900_000);

  it('transfer frame, single row: settles at ordinal 0, refused at ordinal 1', async () => {
    const ok = await buildStrideCase({ mode: 'single', effectOrdinals: [0], emitting: false });
    await expect(ok.provider.sendRawTransaction(ok.transaction)).resolves.toBeDefined();
    const moved = await buildStrideCase({ mode: 'single', effectOrdinals: [1], emitting: false });
    console.log('R1 single-row, transfer at ordinal 1:', await reject(moved));
    expect(await reject(moved)).not.toEqual('ACCEPTED');
  }, 900_000);

  it('transfer frame, TWO rows: the row-1 transfer settles at ordinal 1 and NOT at ordinal 0', async () => {
    const honest = await buildStrideCase({ mode: 'noteThenFire', effectOrdinals: [1], emitting: false });
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeDefined();
    const hostile = await buildStrideCase({ mode: 'noteThenFire', effectOrdinals: [0], emitting: false });
    console.log('R1 two-row, transfer at ordinal 0:', await reject(hostile));
    expect(await reject(hostile)).not.toEqual('ACCEPTED');
  }, 900_000);

  it('event + transfer frames, TWO rows: the row-1 effect settles at ordinal 1 and NOT at ordinal 0', async () => {
    const honest = await buildStrideCase({ mode: 'noteThenFire', effectOrdinals: [1], emitting: true });
    expect(honest.eventSlots).toBeGreaterThan(1);
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeDefined();
    const hostile = await buildStrideCase({ mode: 'noteThenFire', effectOrdinals: [0], emitting: true });
    console.log('R1 two-row, effect at ordinal 0:', await reject(hostile));
    expect(await reject(hostile)).not.toEqual('ACCEPTED');
  }, 900_000);

  it('the ordinal FOLLOWS the row: fireAll on row 0 of a two-row batch settles at ordinal 0', async () => {
    const honest = await buildStrideCase({ mode: 'fireThenNote', effectOrdinals: [0], emitting: false });
    expect(honest.hubRows).toEqual(['fireAll', 'note']);
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeDefined();
    const hostile = await buildStrideCase({ mode: 'fireThenNote', effectOrdinals: [1], emitting: false });
    console.log('R1 fireThenNote, transfer at ordinal 1:', await reject(hostile));
    expect(await reject(hostile)).not.toEqual('ACCEPTED');
  }, 900_000);

  /**
   * The effect must be PRESENT at the strided ordinal, not merely bound. A two-row batch whose transfer slot
   * carries a plain funder instead of the recipient payment is the silent-drop failure mode X29 exists to
   * remove, and it must reject.
   */
  it('two rows: dropping the row-1 transfer entirely is refused', async () => {
    const dropped = await buildStrideCase({ mode: 'noteThenFire', effectOrdinals: [], emitting: false });
    console.log('R1 two-row, transfer DROPPED:', await reject(dropped));
    expect(await reject(dropped)).not.toEqual('ACCEPTED');
  }, 900_000);

  /**
   * The X29 frames reserve `sites x width` event outputs but only the REACHED site settles one. On a route
   * that owns an effect frame, `emitEventCovenantVerification` skips its SEC-10 not-taken binding
   * (`frameShadowed`), and `emitOwnCategoryImmutableNftOutputPin` admits an own-category immutable NFT at ANY
   * `event` block-layout offset. So this asks directly whether an UNREACHED frame slot can carry a forged log.
   */
  it('an unreached frame event slot refuses a forged own-category event NFT', async () => {
    const honest = await buildStrideCase({ mode: 'noteThenFire', effectOrdinals: [1], emitting: true });
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeDefined();
    const honestLogs = await readEventsFromChain(
      honest.provider as any, honest.eventAddress, honest.hubCategory, honest.eventDef,
    );
    console.log('R1 honest logs:', show(honestLogs.map((e: any) => e.args ?? e)));
    expect(show(honestLogs)).not.toContain('999999');

    // The SETTLED slots are bound: forging over the reached site, or over the flattened row-0 site, rejects.
    for (const ordinal of [0, 1]) {
      const bound = await buildStrideCase({
        mode: 'noteThenFire', effectOrdinals: [1], emitting: true, forgedEventOrdinal: ordinal,
      });
      console.log(`R1 forged at SETTLED ordinal ${ordinal}:`, await reject(bound));
      expect(await reject(bound)).toContain('input index 0');
    }

    // One variable from the honest case: an UNREACHED frame slot carries the same forged NFT instead of a
    // plain funder. ACCEPTED before SEC-15, and `readEventsFromChain` returned Fired(999999) beside the two
    // genuine logs; the per-slot not-taken binding now refuses it at the route's own input.
    for (const ordinal of [2, 5, 7]) {
      const forged = await buildStrideCase({
        mode: 'noteThenFire', effectOrdinals: [1], emitting: true, forgedEventOrdinal: ordinal,
      });
      const verdict = await reject(forged);
      console.log(`R1 forged at UNREACHED frame ordinal ${ordinal}:`, verdict);
      expect(verdict).toContain('input index 0');
    }
  }, 900_000);

  /**
   * SEC-15 GUARD CONTROL. The repair is a rule about the COMMITMENT of an unreached reserved slot, not a ban on
   * tokens there, and the credit for the rejections above belongs to it rather than to SEC-11's offset pin -
   * which cannot discriminate, because an `event` offset is exactly what it admits. One field changes: the
   * forged own-category immutable NFT keeps its address, category, 'none' capability and value, and carries an
   * EMPTY commitment. It must settle, and it must read back as nothing.
   */
  it('the same NFT at the same unreached slot with an EMPTY commitment still settles', async () => {
    const guard = await buildStrideCase({
      mode: 'noteThenFire', effectOrdinals: [1], emitting: true,
      forgedEventOrdinal: 5, forgedEventCommitmentEmpty: true,
    });
    const verdict = await reject(guard);
    console.log('R1 GUARD empty-commitment NFT at unreached ordinal 5:', verdict);
    expect(verdict).toEqual('ACCEPTED');
    const logs = await readEventsFromChain(
      guard.provider as any, guard.eventAddress, guard.hubCategory, guard.eventDef,
    );
    console.log('R1 GUARD logs:', show(logs.map((e: any) => e.args ?? e)));
    expect(show(logs)).not.toContain('999999');
  }, 900_000);

  /**
   * The same reserved slots reached by a DIFFERENT code path. With the flattened sibling silent, the invoked
   * handler is the route's only emitter, the route has no pending emit of its own, and
   * `emitEventCovenantVerification` never runs on it - so the per-emit not-taken binding has nothing to hang
   * off. Measured ACCEPTED before SEC-15's standalone frame binding; the honest control settles either way.
   */
  it('an unreached frame slot is bound when the INVOKED handler is the only emitter', async () => {
    const honest = await buildStrideCase({
      mode: 'single', effectOrdinals: [0], emitting: true, noteEmits: false,
    });
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeDefined();
    const forged = await buildStrideCase({
      mode: 'single', effectOrdinals: [0], emitting: true, noteEmits: false, forgedEventOrdinal: 3,
    });
    const verdict = await reject(forged);
    console.log('R1 handler-only emitter, forged at UNREACHED ordinal 3:', verdict);
    expect(verdict).toContain('input index 0');
    const guard = await buildStrideCase({
      mode: 'single',
      effectOrdinals: [0],
      emitting: true,
      noteEmits: false,
      forgedEventOrdinal: 3,
      forgedEventCommitmentEmpty: true,
    });
    const guardVerdict = await reject(guard);
    console.log('R1 handler-only emitter, GUARD empty commitment at ordinal 3:', guardVerdict);
    expect(guardVerdict).toEqual('ACCEPTED');
  }, 900_000);

  // SEC-11's own-category immutable pin allows an `event` offset but not a `transfer` offset. Confirm it
  // still holds on the route X29 built, so the finding above is scoped to the event frame.
  it('an unreached frame TRANSFER slot still refuses the same forged NFT', async () => {
    const forged = await buildStrideCase({
      mode: 'noteThenFire', effectOrdinals: [1], emitting: true, forgedTransferOrdinal: 4,
    });
    console.log('R1 forged NFT at UNREACHED transfer ordinal 4:', await reject(forged));
    expect(await reject(forged)).not.toEqual('ACCEPTED');
  }, 900_000);

  // The SINGLE-row shape every committed X29 fixture uses has the same seven unreached frame slots.
  it('the committed single-row shape has the same unreached frame slots bound', async () => {
    const honest = await buildStrideCase({ mode: 'single', effectOrdinals: [0], emitting: true });
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeDefined();
    const honestLogs = await readEventsFromChain(
      honest.provider as any, honest.eventAddress, honest.hubCategory, honest.eventDef,
    );
    expect(show(honestLogs)).not.toContain('999999');
    const forged = await buildStrideCase({
      mode: 'single', effectOrdinals: [0], emitting: true, forgedEventOrdinal: 3,
    });
    const verdict = await reject(forged);
    console.log('R1 single-row, forged event NFT at UNREACHED frame ordinal 3:', verdict);
    expect(verdict).toContain('input index 0');
  }, 900_000);

  it('isolation: TWO rows reaching the effect-FREE handler settle', async () => {
    const built = await buildStrideCase({ mode: 'noteTwice', effectOrdinals: [], emitting: false });
    expect(built.hubRows).toEqual(['note', 'note']);
    expect(await reject(built)).toEqual('ACCEPTED');
  }, 900_000);

  /**
   * The container conservation rule the subroutine emits is evaluated once per REACHED dispatch site, so the
   * effective bound is `containerIn - containerOut <= min(reached site transfers)` rather than the flattened
   * form's `<= sum`. Two rows that BOTH reach `fireAll` drain 2 x TRANSFER_SATS, which the min-form bound
   * cannot authorize. Measured here rather than argued, with a transfer-FREE control that isolates the
   * container from the rest of the two-reached-site machinery.
   */
  it('TWO reached sites: the effect frames are what refuses, not the two rows', async () => {
    const effectFree = await buildStrideCase({
      mode: 'fireTwice', effectOrdinals: [], emitting: false, transferring: false,
    });
    expect(effectFree.hubRows).toEqual(['fireAll', 'fireAll']);
    expect(effectFree.blockSize).toEqual(2);
    const control = await reject(effectFree);
    console.log('R1 fireTwice, handler carries NO effect (control):', control);
    expect(control).not.toEqual('ACCEPTED');

    const eventsOnly = await buildStrideCase({
      mode: 'fireTwice', effectOrdinals: [0, 1], emitting: true, transferring: false,
    });
    expect(eventsOnly.hubRows).toEqual(['fireAll', 'fireAll']);
    console.log('R1 fireTwice, EVENT frames only (no container):', await reject(eventsOnly));
    expect(await reject(eventsOnly)).not.toEqual('ACCEPTED');

    const honest = await buildStrideCase({ mode: 'fireTwice', effectOrdinals: [0, 1], emitting: false });
    console.log('R1 fireTwice, honest 2 x 900 drain:', await reject(honest));
    expect(await reject(honest)).not.toEqual('ACCEPTED');
    const single = await buildStrideCase({
      mode: 'fireTwice', effectOrdinals: [0, 1], emitting: false,
      containerOut: CONTAINER_SATS - TRANSFER_SATS,
    });
    console.log('R1 fireTwice, container keeps back ONE transfer:', await reject(single));
    expect(await reject(single)).not.toEqual('ACCEPTED');
    const none = await buildStrideCase({
      mode: 'fireTwice', effectOrdinals: [0, 1], emitting: false, containerOut: CONTAINER_SATS,
    });
    console.log('R1 fireTwice, container fully preserved:', await reject(none));
    expect(await reject(none)).not.toEqual('ACCEPTED');
  }, 900_000);
});
