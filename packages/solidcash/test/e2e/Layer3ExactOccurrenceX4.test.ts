import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { occurrenceBoundOf, occurrenceCountViolation, type Artifact } from '@solidcash/utils';
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

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/** See the sibling runtime-sized fixture: the outpoint seed space collides on a large balanced block. */
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

const POINTER_TARGET = `pragma solidcash >=0.8.0;
contract ExactPointerTarget(int brand) {
  function inc(uint value) public pure { require(value > 0); }
  function dec(uint value) public pure { require(value > 0); }
}`;

/** The literal trip count the fixture writes. Unlike a require guard this is a floor as well as a ceiling. */
const EXACT_TABLE_ROWS = 2;

/**
 * The X4 shape: a pointer table driven by a COMPILE-TIME trip count, with no dominating require anywhere.
 *
 * Its sibling `Layer3RuntimeSizedPointerTable` fixture is guard-bounded, so it honestly reaches 0..3 rows and
 * only a ceiling can be published. Here the source names the count, so every execution dispatches exactly two
 * rows and any other planned count is wrong.
 */
const EXACT_SIZED_TABLE = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract CompiledExactSizedTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    for (int i = 0; i < 2; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }
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
  provider: SemanticProvider,
  controller: Contract,
  genesisUtxo: any,
  categoryId: string,
  root: string,
  p2pkh: Contract,
  outpoints: Set<string>,
): Promise<any> {
  const fee = uniqueUtxo(outpoints, { satoshis: 20_000n });
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

/**
 * Build the whole balanced transaction for `plannedRows` co-spent handlers.
 *
 * The persisted table always holds `EXACT_TABLE_ROWS` elements, so the caller covenant always dispatches that
 * many rows. Only the PLAN varies, which is exactly the field an under-count attacks.
 */
/** Decode the caller's emission vector: framed(target) || mode || selector[4] || framed(args) || framed(result). */
function decodeEmissionRows(emissionsHex: string): { targetHex: string; selectorHex: string; argsHex: string }[] {
  const bytes = hexToBin(emissionsHex);
  const rows: { targetHex: string; selectorHex: string; argsHex: string }[] = [];
  let cursor = 0;
  const frame = (): Uint8Array => {
    const length = bytes[cursor] | (bytes[cursor + 1] << 8);
    const value = bytes.slice(cursor + 2, cursor + 2 + length);
    cursor += 2 + length;
    return value;
  };
  while (cursor < bytes.length) {
    const target = frame();
    cursor += 1;
    const selector = bytes.slice(cursor, cursor + 4);
    cursor += 4;
    const args = frame();
    frame();
    rows.push({ targetHex: binToHex(target), selectorHex: binToHex(selector), argsHex: binToHex(args) });
  }
  return rows;
}

async function buildExactSizedGraph(
  plannedRows: number,
  tamper: 'none' | 'target' | 'selector' = 'none',
): Promise<{ provider: any; transaction: string; transcript: any; handlerArtifact: Artifact }> {
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
  const handlerArtifact = compileString(POINTER_TARGET, options);
  const brands = Array.from({ length: EXACT_TABLE_ROWS }, (_, index) => BigInt(index + 2));
  const handlerSetups = await Promise.all(brands.map(async (brand) => {
    const base = new Contract(handlerArtifact, [brand], { provider });
    const setup = await setupStatefulUtxos(provider, base, handlerArtifact.stateLayout!, {});
    return { contract: base.withCategory(hexToBin(setup.categoryId)), setup, brand };
  }));
  const tableArtifact = compileString(EXACT_SIZED_TABLE, options);
  const tableBase = new Contract(tableArtifact, [], { provider });
  const tableSetup = await setupStatefulUtxos(
    provider, tableBase, tableArtifact.stateLayout!,
    { handlers: [], __fnsel_handlers: [] },
  );
  const table = tableBase.withCategory(hexToBin(tableSetup.categoryId));
  const tableStateful = StatefulContract.withCategory(tableBase, tableSetup.categoryId);
  for (const [index, setup] of handlerSetups.entries()) {
    // 'target' persists a foreign address in the LAST table element while the honest handler is still the one
    // co-spent, so the covenant's own read of the table is the only field that differs.
    const target = tamper === 'target' && index === EXACT_TABLE_ROWS - 1
      ? hexToBin(`aa20${'44'.repeat(32)}87`)
      : setup.contract.lockingBytecode;
    if (index % 2 === 0) await tableStateful.registerInc(target).send();
    else await tableStateful.registerDec(target).send();
  }
  const currentTable = await tableStateful.getFullState();
  if (!currentTable.masterUtxo || currentTable.dataNftUtxos.length !== 1) {
    throw new Error('exact-sized fixture did not materialize its current master/data state');
  }

  const participants = [
    { artifact: tableArtifact, lockingBytecode: table.lockingBytecode },
    ...handlerSetups.map(({ contract, brand }) => ({
      artifact: handlerArtifact, lockingBytecode: contract.lockingBytecode, constructorArgs: [brand],
    })),
  ];
  const planned = handlerSetups.slice(0, plannedRows);
  let dynamicCallIndex = 0;
  const plan = layer3.deriveCompiledGraphPlan({
    root: participants[0],
    function: 'fireAll',
    args: [4n],
    targets: {},
    occurrence: ({ kind }) => kind === 'loop' ? plannedRows : 0,
    dynamicCall: () => {
      const reached = dynamicCallIndex++;
      const honest = reached % 2 === 0 ? 'inc' : 'dec';
      // 'selector' swaps the LAST row's method while every participant stays honest. The 'target' attack is
      // made at registration time instead, so that here too only one field moves.
      const substituted = honest === 'inc' ? 'dec' : 'inc';
      return {
        participant: participants[reached + 1],
        function: tamper === 'selector' && reached === plannedRows - 1 ? substituted : honest,
      };
    },
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    Array.from({ length: plannedRows + 1 }, () => ''), layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh, outpoints,
  );
  const projections = Array.from({ length: plannedRows + 1 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const fee = uniqueUtxo(outpoints, { satoshis: 120_000n });
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);

  const dynamicVariables = tableArtifact.stateLayout!.variables.filter((variable) => variable.dynamic);
  const chunks: { variable: typeof dynamicVariables[number]; utxo: any; address: string }[] = [];
  for (const variable of dynamicVariables) {
    const address = getDynamicChunkAddress(table, tableSetup.categoryId, variable.name, variable.type);
    for (const utxo of await provider.getUtxos(address)) chunks.push({ variable, utxo, address });
  }
  const trailingCapacity = tableArtifact.hiddenBatch!.route.blockLayout!.trailingCapacity ?? 0;
  expect(chunks.length).toBeLessThanOrEqual(trailingCapacity);
  const trailingFunding = Array.from(
    { length: trailingCapacity - chunks.length },
    () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of trailingFunding) await provider.addUtxo(p2pkh.address, funding);

  const tableRoute = table.createCompilerRouteUnlocker(
    tableArtifact.hiddenBatch!.route, hexToBin(tableArtifact.hiddenBatch!.selector),
  );
  const handlerRoutes = planned.map(({ contract }) => contract.createCompilerRouteUnlocker(
    handlerArtifact.hiddenBatch!.route, hexToBin(handlerArtifact.hiddenBatch!.selector),
  ));
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    currentTable.masterUtxo,
    tableRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    currentTable.dataNftUtxos[0],
    createDataNftUnlocker(table, layout.participantInputs[0], tableSetup.categoryId),
  );
  for (const { variable, utxo } of chunks) {
    tx.addInput(
      utxo,
      createReadOnlyDynamicChunkUnlocker(
        table, layout.participantInputs[0], tableSetup.categoryId, variable.name, variable.type,
      ),
    );
  }
  for (const funding of trailingFunding) {
    tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
  }
  planned.forEach(({ setup }, index) => tx.addInput(
    setup.masterUtxo,
    handlerRoutes[index](
      ...layer3.compiledGraphRouteArgs(transcript, index + 1, layout.controllerInput) as any,
    ),
  ));
  projections.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: table.tokenAddress, amount: currentTable.masterUtxo.satoshis, token: currentTable.masterUtxo.token,
  });
  tx.addOutput({
    to: getDataNftAddress(table, tableSetup.categoryId),
    amount: currentTable.dataNftUtxos[0].satoshis,
    token: currentTable.dataNftUtxos[0].token,
  });
  for (const { address, utxo } of chunks) {
    tx.addOutput({ to: address, amount: utxo.satoshis, token: utxo.token });
  }
  for (const funding of trailingFunding) {
    tx.addOutput({ to: p2pkh.address, amount: funding.satoshis });
  }
  planned.forEach(({ contract, setup }) => tx.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis, token: setup.masterUtxo.token,
  }));
  for (let index = 0; index < projections.length + 1; index++) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx), transcript, handlerArtifact };
}

const compileExactTable = (): Artifact => compileString(EXACT_SIZED_TABLE, {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
});

const fireAllRow = (artifact: Artifact): any =>
  artifact.abi.find((fn) => fn.name === 'fireAll')!.externalCalls![0];

// SEMANTIC evidence only, using createLayer3SemanticTestProvider (BCH-2026 opcode, introspection and
// 128-byte-commitment behaviour, relaxed capacity). Not consensus-fit, policy, relay or deployability evidence.
describe('Layer-3 exact occurrence bound, X4 (SEMANTIC)', () => {
  it('publishes a floor equal to the ceiling for a compile-time trip count', () => {
    const artifact = compileExactTable();
    const row = fireAllRow(artifact);
    expect(row.occurrence).toBe('loop');
    expect(row.maximumOccurrences).toBe(EXACT_TABLE_ROWS);
    expect(row.minimumOccurrences).toBe(EXACT_TABLE_ROWS);
    expect(row.occurrenceBoundSource).toBe('literal');
    expect(occurrenceBoundOf(row)).toMatchObject({
      kind: 'loop', minimum: EXACT_TABLE_ROWS, maximum: EXACT_TABLE_ROWS, exact: true, source: 'literal',
    });
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'fireAll')!;
    expect(summary.bounded).toBe(true);
    expect(summary.maximumDirectInvocations).toBe(EXACT_TABLE_ROWS);
  });

  it('names the exact count in the under-count diagnostic and admits the honest one', () => {
    const row = fireAllRow(compileExactTable());
    expect(occurrenceCountViolation(row, EXACT_TABLE_ROWS)).toBeUndefined();
    expect(occurrenceCountViolation(row, EXACT_TABLE_ROWS - 1))
      .toBe('callsite 0 was planned with 1 occurrences, below the 2 proven by a compile-time trip count; '
        + 'this callsite reaches exactly 2 rows');
    expect(occurrenceCountViolation(row, EXACT_TABLE_ROWS + 1))
      .toBe('callsite 0 was planned with 3 occurrences, above the 2 proven by a compile-time trip count');
  });

  /**
   * The guard-derived sibling must NOT gain a floor: a runtime table shorter than its published ceiling is an
   * honest execution, and rejecting it at plan time would be a false rejection rather than a tightening.
   */
  it('leaves a require-derived ceiling free of a floor', () => {
    const guarded = compileString(`pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract GuardedSizedTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }
}`, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    });
    const row = fireAllRow(guarded);
    expect(row.maximumOccurrences).toBe(3);
    expect(row.minimumOccurrences).toBeUndefined();
    expect(row.occurrenceBoundSource).toBe('guard');
    expect(occurrenceCountViolation(row, 1)).toBeUndefined();
    expect(occurrenceCountViolation(row, 0)).toBeUndefined();
    expect(occurrenceCountViolation(row, 4))
      .toBe('callsite 0 was planned with 4 occurrences, above the 3 proven by a dominating require guard');
  });

  // HONEST control. Two planned rows against a two-row compile-time trip count, everything else identical to
  // the hostile case below.
  it('settles the exact planned row count on the BCH-2026 VM', async () => {
    const { provider, transaction, transcript, handlerArtifact } =
      await buildExactSizedGraph(EXACT_TABLE_ROWS);
    // G3: each reached occurrence resolves to ONE participant, ONE selector and ONE argument vector, and the
    // two occurrences differ in participant and selector while forwarding the same argument.
    const rows = decodeEmissionRows(transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(EXACT_TABLE_ROWS);
    expect(new Set(rows.map((row) => row.targetHex)).size).toBe(EXACT_TABLE_ROWS);
    const selectorOf = (name: string): string =>
      handlerArtifact.abi.find((fn) => fn.name === name)!.selector!.toLowerCase();
    expect(rows.map((row) => row.selectorHex)).toEqual([selectorOf('inc'), selectorOf('dec')]);
    expect(rows[0].argsHex).toBe(rows[1].argsHex);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  /**
   * HOSTILE, attacking the OCCURRENCE COUNT field of the plan and nothing else.
   *
   * The persisted table, the participants, the arguments, the selectors and the controller root are all the
   * honest ones; only one fewer row is planned and co-spent. The caller covenant still dispatches both table
   * elements, so the emitted row vector no longer matches the transcript. This is the rejection X4 moves
   * earlier: `deriveCompiledGraphPlan` accepts the count today because it checks only the ceiling, so the
   * whole transaction is built and broadcast before anything refuses it.
   */
  // Worker A proved this rejects ON CHAIN before the planner check was wired: an under-counted plan with
  // honest participants, arguments, selectors and a re-derived root was refused by the covenant's row
  // partition. Wiring occurrenceCountViolation moved the refusal EARLIER, so the builder no longer reaches
  // the covenant here and the assertion is now plan-time. The covenant rejection still exists; it is simply
  // shadowed by a guard that names the fault precisely instead of failing as a partition mismatch.
  it('refuses an under-counted plan at plan time, ahead of the covenant that also rejects it', async () => {
    await expect(buildExactSizedGraph(EXACT_TABLE_ROWS - 1)).rejects.toThrow(
      /was planned with \d+ occurrences, below the \d+ proven by a compile-time trip count/,
    );
  }, 180_000);

  // G3, TARGET. The persisted table element the covenant reads for the last row, with every selector and
  // every co-spent participant honest.
  it('rejects a substituted target in the last reached row', async () => {
    const { provider, transaction } = await buildExactSizedGraph(EXACT_TABLE_ROWS, 'target');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 180_000);

  // G3, SELECTOR. The same graph with every target honest and one row's method substituted, so target and
  // selector are shown to reject independently rather than as one compound field.
  it('rejects a substituted selector in the last reached row', async () => {
    const { provider, transaction } = await buildExactSizedGraph(EXACT_TABLE_ROWS, 'selector');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 180_000);

  // An over-count is already refused before construction, by the ceiling half of the same bound.
  it('refuses an over-counted plan before construction', () => {
    const artifact = compileExactTable();
    const root = { artifact, lockingBytecode: '51' };
    expect(() => layer3.deriveCompiledGraphPlan({
      root,
      function: 'fireAll',
      args: [4n],
      targets: {},
      occurrence: () => EXACT_TABLE_ROWS + 1,
      dynamicCall: () => ({ participant: root, function: 'inc' }),
    })).toThrow(/lacks a valid loop occurrence proof/);
  });

  /**
   * BLOCKED, recorded rather than fixed: the plan-time half of X4 is one line in
   * `packages/solidcash/src/layer3/worklist.ts`, which is leased to Worker B this round. The artifact now
   * carries the floor and `occurrenceCountViolation` implements the check; only the call site is missing.
   */
  it('rejects an under-count at plan time with the exact published-floor diagnostic', () => {
    const artifact = compileExactTable();
    const handler = compileString(POINTER_TARGET, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    });
    const root = { artifact, lockingBytecode: '51' };
    const plan = (): unknown => layer3.deriveCompiledGraphPlan({
      root,
      function: 'fireAll',
      args: [4n],
      targets: {},
      occurrence: () => EXACT_TABLE_ROWS - 1,
      dynamicCall: () => ({
        participant: { artifact: handler, lockingBytecode: '52', constructorArgs: [2n] }, function: 'inc',
      }),
    });
    // Short by exactly the row the published floor forbids, and now named as such rather than admitted.
    expect(plan).toThrow(
      /was planned with \d+ occurrences, below the \d+ proven by a compile-time trip count/,
    );
    // The published floor is what makes the diagnostic possible; without it there is nothing to compare to.
    expect(occurrenceCountViolation(fireAllRow(artifact), EXACT_TABLE_ROWS - 1)).toBeDefined();
    // The honest count still plans, so the guard rejects an under-count and not the shape itself.
    expect(occurrenceCountViolation(fireAllRow(artifact), EXACT_TABLE_ROWS)).toBeUndefined();
  });
});
