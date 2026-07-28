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
  createDataNftUnlocker, getDataNftAddress, getEventNftAddress,
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

/**
 * The caller. `emit` is the single measured variable: with it the handler carries a physical effect and its
 * graph clone is flattened; without it the clone stays behind OP_INVOKE. Both spellings reach the same two
 * legs through the same ordinary interface calls, so the dispatch is not a second variable.
 */
const hubSource = (emitting: boolean): string => `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(uint value); function debit(uint value); }
contract EscapeEffectHub() {
  uint total;
  event Fired(uint value);
  function fireAll(address first, address second, uint value) public {
${emitting ? '    emit Fired(value);' : ''}
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
  callerInput: number; emissionSlots: number;
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
  const hubArtifact = compileString(hubSource(cell.emitting), options);
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
  const rootArgs = [legB.lockingBytecode, legC.lockingBytecode, CALL_VALUE];
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
    } else if (kind === 'event') {
      // Exactly one `Fired` is reached; every further conditional event slot is an unreached filler pair.
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
   * SEC-6, closed by refusal. The emit-carrying caller is no longer compiled at all, so the two substitutions
   * above cannot be assembled against it. Recorded here because the refusal is only justified by what it
   * replaces: at 9bf3e5ea this exact fixture, built by `buildEffectSubstitution({ emitting: true })`,
   * SETTLED both substitutions - `preflightLayer3Transaction` returned ACCEPTED and the raw transaction was
   * accepted by the provider - while the effect-free control rejected at input 0 in both. Reverting the
   * refusal reproduces that.
   */
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

  it('refuses an emit-carrying graph emission handler by name', () => {
    expect(() => compileString(hubSource(true), BUS_OPTIONS))
      .toThrow(/makes an external call and also performs an emit or transfer, which is not enabled/);
    expect(() => compileString(hubSource(true), BUS_OPTIONS)).toThrow(/'fireAll'/);
  }, 30_000);

  /**
   * The token-container spelling of the same idea does NOT reach the refusal, and the reason is worth pinning:
   * `this.tokens[c].transfer(..)` is still a MethodCallStatement when InlineStoragePointerCalls runs, so
   * `hasTokenContainerEffects` is false, the clone is never flattened and its edge stays bound (2 sites,
   * measured). But the route reserves no tokenContainer/tcTransfer slot either - its block is master+dataNft
   * only - which is the same silent-effect-drop the un-flattened emit showed. NOT part of SEC-6's claim; pinned
   * so the next reader does not mistake "compiles" for "the transfer happened".
   */
  it('leaves the token-container spelling bound, with no token slot in its block', () => {
    const source = `pragma solidcash >=0.8.0;
interface IEffectLeg { function credit(int value); }
contract EscapeTokenHub() {
  int total;
  function fireAll(bytes32 category, bytes20 recipient, address first, int value) public {
    this.tokens[category].transfer(recipient, value);
    IEffectLeg(first).credit(value);
    require(true);
  }
  function note(int credited) public {
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;
    const artifact = compileString(source, BUS_OPTIONS);
    expect(artifact.hiddenBatch?.handlers.map((handler: any) => [handler.name, handler.eligible]))
      .toEqual([['fireAll', true], ['note', true]]);
    expect(artifact.hiddenBatch!.route.blockLayout!.slots.map((slot: any) => slot.kind))
      .toEqual(['master', 'dataNft']);
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
