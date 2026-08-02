import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
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
  createDataNftUnlocker, createReadOnlyDynamicChunkUnlocker, getDataNftAddress, getDynamicChunkAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * A runtime-sized pointer-table caller binds its own emission rows regardless of what its contract merely
 * DECLARES. This file was written as a characterization test of SEC-5, in which two of its cells recorded
 * forgeries that settled; SEC-5 is fixed and every cell now asserts rejection at the caller's input.
 *
 * Measured, one variable at a time, with an honest control that settles in every configuration:
 *
 *   caller dispatch | returning handler declared | caller rows | target sub | argument sub
 *   ----------------|----------------------------|-------------|------------|-------------
 *   pointer table   | no                         | 1           | REJECTS    | REJECTS
 *   pointer table   | no                         | 2           | REJECTS    | REJECTS
 *   pointer table   | yes (pure or state-writing)| 1           | REJECTS    | REJECTS
 *   pointer table   | yes (pure or state-writing)| 2           | REJECTS    | REJECTS
 *   ordinary calls  | yes                        | 1 and 2     | n/a        | REJECTS
 *
 * The declared handler is never invoked in any cell. The caller's row count does not matter, and the
 * ordinary-callsite control shows a plain `IFoo(x).bar()` edge stays bound in exactly the same configuration,
 * which is what makes the pointer-table rows attributable to the persisted dispatch rather than to the route.
 *
 * SEC-5, for the record: a declared returning handler flips route synthesis to the EARLY call site
 * (`synthesizeBatchBeforeLowering`, `fn.returnTypes.length > 0` in compiler.ts). The graph emission clone
 * `__scb_graph_fireAll` therefore already existed when InlineStoragePointerCalls ran, and that pass - lacking
 * the graphEmissionHandler guard its two sibling inliners carry - flattened it into `__scb1` and dropped the
 * definition. Generated with `__scb1` as the current function, its external calls took the ordinary-call path,
 * so no emission row was recomputed and compared against `__internal__graphEmissions`. The unrolled per-row
 * parser (`resultMode`) was the trigger's neighbour, not its cause.
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
 * The returning handler under test. It is DECLARED by the cells that name it and INVOKED by none of them, in
 * either body form: whether it writes state is measured, not assumed.
 */
const RETURNING_HANDLER = `
  function audit(uint value) public returns (uint) {
    require(value > 0);
    return value + 1;
  }`;
const RETURNING_STATEFUL = `
  function audit(uint value) public returns (uint) {
    this.total = this.total + value;
    require(value > 0);
    return this.total;
  }`;
const returningBody = (kind: string): string =>
  (kind === 'pure' ? RETURNING_HANDLER : kind === 'stateful' ? RETURNING_STATEFUL : '');

const tableHub = (returning: string): string => `pragma solidcash >=0.8.0;
interface IEscapeLeg { function credit(uint value); function debit(uint value); }
contract EscapeTableHub() {
  function(uint) external[] legs;
  uint total;
  function registerCredit(address target) public { this.legs.push(IEscapeLeg(target).credit); require(true); }
  function registerDebit(address target) public { this.legs.push(IEscapeLeg(target).debit); require(true); }
  function fireAll(uint value) public {
    require(legs.length <= 2);
    for (int i = 0; i < legs.length; i = i + 1) { legs[i](value); }
    require(value >= 0);
  }
  function note(uint credited) public {
    this.total = this.total + credited;
    require(credited > 0);
  }${returningBody(returning)}
}`;

/** The control: the same declared returning handler, reached through ordinary interface calls. */
const ORDINARY_HUB = `pragma solidcash >=0.8.0;
interface IEscapeLeg { function credit(uint value); function debit(uint value); }
contract EscapeOrdinaryHub() {
  uint total;
  function fireAll(address first, address second, uint value) public {
    IEscapeLeg(first).credit(value);
    IEscapeLeg(second).debit(value);
    require(value >= 0);
  }
  function note(uint credited) public {
    this.total = this.total + credited;
    require(credited > 0);
  }${returningBody('pure')}
}`;

/** Leg B. `callback` decides whether the hub's batch executes one row or two. */
const legBSource = (callback: boolean): string => `pragma solidcash >=0.8.0;
interface IEscapeHub { function note(uint credited); }
contract EscapeLegB(address hub) {
  uint seen;
  function credit(uint value) public {
    this.seen = this.seen + value;
    ${callback ? 'IEscapeHub(hub).note(value);' : ''}
    require(value > 0);
  }
}`;

const LEG_C = `pragma solidcash >=0.8.0;
contract EscapeLegC(int brand) {
  uint burned;
  function debit(uint value) public {
    this.burned = this.burned + value;
    require(value > 0 && brand >= 0);
  }
}`;

const CALL_VALUE = 4n;

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

interface Cell {
  /** What returning handler the caller's contract declares. None of them is ever invoked. */
  returningHandler: 'none' | 'pure' | 'stateful';
  /** Does leg B call back, giving the caller a second local row? */
  callback: boolean;
  /** Pointer-table dispatch, or plain interface calls. */
  ordinary?: boolean;
  /** Which authenticated field the transcript substitutes. */
  tamper?: 'none' | 'argument' | 'target';
}

/** A locking bytecode no participant owns, persisted into table slot 1 by the 'target' substitution. */
const FOREIGN_TARGET = `aa20${'44'.repeat(32)}87`;

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
 * Assemble a graph in which the caller forwards its own `value` to both legs while the transcript states a
 * different argument for the second leg. The whole subtree below that edge agrees with the stated value, so
 * only the caller's own recomputation can reject.
 */
async function buildArgumentSubstitution(cell: Cell): Promise<{
  builder: TransactionBuilder; transaction: string; provider: SemanticProvider;
  callerInput: number; hubRows: number; resultMode: boolean;
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
    cell.ordinary ? ORDINARY_HUB : tableHub(cell.returningHandler), options,
  );
  const legBArtifact = compileString(legBSource(cell.callback), options);
  const legCArtifact = compileString(LEG_C, options);
  const resultMode = hubArtifact.hiddenBatch!.handlers.some((handler: any) => (handler.outputs?.length ?? 0) > 0);
  expect(resultMode).toBe(cell.returningHandler !== 'none' || cell.ordinary === true);

  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(
    provider, hubBase, hubArtifact.stateLayout!,
    cell.ordinary ? { total: 0n } : { total: 0n, legs: [], __fnsel_legs: [] },
  );
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));
  const legCBase = new Contract(legCArtifact, [7n], { provider });
  const legCSetup = await setupStatefulUtxos(provider, legCBase, legCArtifact.stateLayout!, { burned: 0n });
  const legC = legCBase.withCategory(hexToBin(legCSetup.categoryId));

  if (!cell.ordinary) {
    const hubStateful = StatefulContract.withCategory(hubBase, hubSetup.categoryId);
    await hubStateful.registerCredit(legB.lockingBytecode).send();
    await hubStateful.registerDebit(
      cell.tamper === 'target' ? hexToBin(FOREIGN_TARGET) : legC.lockingBytecode,
    ).send();
  }
  const currentHub = cell.ordinary
    ? { masterUtxo: hubSetup.masterUtxo, dataNftUtxos: hubSetup.dataNftUtxos }
    : await StatefulContract.withCategory(hubBase, hubSetup.categoryId).getFullState();

  const participants: layer3.CompiledGraphParticipant[] = [
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
    { artifact: legCArtifact, lockingBytecode: legC.lockingBytecode },
  ];
  const substituted = cell.tamper === 'argument' ? CALL_VALUE + 1n : CALL_VALUE;
  const invocations: layer3.CompiledGraphInvocation[] = [
    {
      parent: null, callee: 0, function: 'fireAll',
      args: cell.ordinary ? [legB.lockingBytecode, legC.lockingBytecode, CALL_VALUE] : [CALL_VALUE],
    },
    { parent: 0, callee: 1, function: 'credit', args: [CALL_VALUE], callMode: 'call' },
    ...(cell.callback
      ? [{ parent: 1, callee: 0, function: 'note', args: [CALL_VALUE], callMode: 'call' as const }] : []),
    // The substitution: the caller forwards its own `value`, the transcript states `value + 1`.
    { parent: 0, callee: 2, function: 'debit', args: [substituted], callMode: 'call' },
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
    { length: hubLayout.blockSize - 2 - chunks.length }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of fillers) await provider.addUtxo(p2pkh.address, funding);

  const routeFor = (contract: Contract, artifact: any, extra: bigint[] = []): any =>
    (...args: any[]): any => contract.createCompilerRouteUnlocker(
      artifact.hiddenBatch.route, hexToBin(artifact.hiddenBatch.selector),
    )(...args, ...extra);
  // A declared returning handler reserves a return-event slot even when no returning row is reached; the route
  // still verifies the slot, against the pushdata-encoded empty result vector.
  const hubReturnSlot = hubLayout.slots.find((slot: any) => slot.kind === 'returnEvent');
  const hubExtra = hubArtifact.hiddenBatch!.route.inputs
    .some((input: any) => input.name === '__internal__returnOutputIdx')
    ? [BigInt(layout.participantInputs[0] + hubReturnSlot!.offset)] : [];

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  let chunkCursor = 0;
  let fillerCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addInput(currentHub.masterUtxo, routeFor(hub, hubArtifact, hubExtra)(
        ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
      ));
    } else if (kind === 'dataNft') {
      tx.addInput(
        currentHub.dataNftUtxos[0],
        createDataNftUnlocker(hub, layout.participantInputs[0], hubSetup.categoryId),
      );
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

  const hubTotal = cell.callback ? CALL_VALUE : 0n;
  const currentCommitment: string = currentHub.dataNftUtxos[0].token.nft.commitment;
  const zeroFieldHex = binToHex(packed(0n));
  const hubNext = binToHex(packed(hubTotal)) + currentCommitment.slice(zeroFieldHex.length);
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
    } else if (kind === 'returnEvent') {
      tx.addOutput({
        to: hexToBin('51'), amount: 1000n,
        token: {
          category: hubSetup.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: binToHex(scriptToBytecode([new Uint8Array()])) },
        },
      });
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
  settle(legC, legCSetup, buildInitialStateCommitments(legCArtifact.stateLayout!, { burned: substituted })[0]);
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 30_000n });

  return {
    builder: tx,
    transaction: raw(tx),
    provider,
    callerInput: layout.participantInputs[0],
    hubRows: plan.participants[0].batch.rowCount,
    resultMode,
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

const verifyAtCaller =
  /mandatory-script-verify-flag-failed .*error in evaluating input index 0: Program failed an OP_VERIFY operation/;

describe('Layer-3 pointer-table emission binding vs a declared returning handler (SEMANTIC)', () => {
  const at = (input: number): string =>
    `layer3 [L3_SCB_ENVELOPE_MALFORMED]: BCH-2026 preflight failed at input ${input}`;

  // The honest control for every cell below. Without it, an "ACCEPTED" forgery could not be distinguished
  // from a fixture that simply never rejects, and a "REJECTS" could not be distinguished from a broken build.
  it.each([
    { returningHandler: 'none', callback: false },
    { returningHandler: 'none', callback: true },
    { returningHandler: 'pure', callback: false },
    { returningHandler: 'pure', callback: true },
  ])('settles the honest graph with %o', async (cell) => {
    const built = await buildArgumentSubstitution({ ...cell, tamper: 'none' });
    expect(outcomeOf(built.builder)).toBe('ACCEPTED');
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  it.each([
    { tamper: 'target' as const, callback: false }, { tamper: 'target' as const, callback: true },
    { tamper: 'argument' as const, callback: false }, { tamper: 'argument' as const, callback: true },
  ])('rejects a %o substitution when no returning handler is declared', async (cell) => {
    const built = await buildArgumentSubstitution({ ...cell, returningHandler: 'none' });
    expect(built.resultMode).toBe(false);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
  }, 600_000);

  // Control: the same declared returning handler, reached through ordinary interface calls instead of the
  // persisted table. This cell rejected throughout, which is what showed SEC-5 was never "resultMode breaks
  // all binding" - the same route, the same unrolled parser, a bound edge.
  it.each([{ callback: false }, { callback: true }])(
    'rejects an argument substitution on ordinary calls with a returning handler declared and %o',
    async (cell) => {
      const built = await buildArgumentSubstitution({
        ...cell, returningHandler: 'pure', ordinary: true, tamper: 'argument',
      });
      expect(built.resultMode).toBe(true);
      expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
      await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
    }, 600_000,
  );

  /**
   * SEC-5's cells, inverted. These four settled before the emission binding was repaired; each now rejects at
   * the caller's own input - the same input and the same recomputation as the no-returning-handler rows above.
   * Reverting the InlineStoragePointerCalls guard makes exactly these five assertions fail again.
   */
  it.each([
    { tamper: 'target' as const, callback: false }, { tamper: 'target' as const, callback: true },
    { tamper: 'argument' as const, callback: false }, { tamper: 'argument' as const, callback: true },
  ])('rejects a %o substitution when a returning handler is declared', async (cell) => {
    const built = await buildArgumentSubstitution({ ...cell, returningHandler: 'pure' });
    expect(built.resultMode).toBe(true);
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
  }, 600_000);

  // The declared handler's own body never mattered to the measurement: a state-writing returning handler binds
  // exactly like a pure one, just as it escaped exactly like a pure one before the repair.
  it('rejects a target substitution when the declared returning handler writes state', async () => {
    const built = await buildArgumentSubstitution({
      returningHandler: 'stateful', callback: false, tamper: 'target',
    });
    expect(built.resultMode).toBe(true);
    expect(built.callerInput).toBe(0);
    expect(outcomeOf(built.builder)).toContain(at(built.callerInput));
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow(verifyAtCaller);
  }, 600_000);
});
