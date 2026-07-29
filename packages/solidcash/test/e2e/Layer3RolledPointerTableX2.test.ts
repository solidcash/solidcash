import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
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
 * X2. A pointer-table loop the compiler leaves ROLLED on the message-bus graph route.
 *
 * `ExpandBoundedPointerTableLoop` only rewrites a `for` loop into guarded per-row branches. A `while`-spelled
 * loop over the same table therefore reaches code generation rolled, and the fn-ptr lowering gives its callsite
 * a live-index expression selector (`bytes4(__fnsel_t[i])`) instead of a hoisted identifier. The graph emission
 * row builder counted that expression's tracked push twice, leaving one phantom entry after its CAT, so every
 * later name lookup in the handler read one item too deep and the row split the wrong stack value.
 *
 * The discriminator this file pins: a rolled loop was never the wall. An ordinary interface call in a rolled
 * loop and a fixed-method rolled pointer table both settled before the repair and still settle; only a callsite
 * whose selector is an EXPRESSION was broken. The ternary state-selected pointer is the second such producer and
 * is covered here for the same reason.
 *
 * SEMANTIC evidence only, on the layer3-bch2026-semantic-relaxed-v1 profile.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/**
 * `randomUtxo` draws from 10,000 txid seeds x 10 vouts, so a balanced block that needs ~67 funding outpoints
 * hits a birthday collision every few runs and the builder rejects the duplicate input. Draw until the outpoint
 * is new within this fixture.
 */
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
contract CompiledPointerTarget(int brand) {
  function inc(uint value) public pure { require(value > 0); }
  function dec(uint value) public pure { require(value > 0); }
}`;

/** The literal ceiling the fixture contract proves with its dominating require. */
const POINTER_TABLE_BOUND = 3;

// The X2 shape: a VARYING-method pointer table whose `while` spelling keeps the loop rolled, so the callsite
// carries the live-index selector expression rather than a hoisted `__fnelemsel_` identifier.
const ROLLED_VARYING_TABLE = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract CompiledRolledVaryingTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    int i = 0;
    while (i < handlers.length) { handlers[i](value); i = i + 1; }
    require(value >= 0);
  }
}`;


// V2: an ORDINARY interface call over a plain address[] - the shape ExpandBoundedPointerTableLoop
// deliberately leaves ROLLED and publishes a ceiling for (recordRolledLoopCeiling).
const ROLLED_INTERFACE_TABLE = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract CompiledRolledInterface() {
  address[] handlers;
  function registerInc(address target) public { this.handlers.push(target); require(true); }
  function registerDec(address target) public { this.handlers.push(target); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { IVaryingHandler(handlers[i]).inc(value); }
    require(value >= 0);
  }
}`;

// V3: a FIXED-method pointer table left rolled by the while spelling (no parallel selector array).
const ROLLED_FIXED_TABLE = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract CompiledRolledFixed() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    int i = 0;
    while (i < handlers.length) { handlers[i](value); i = i + 1; }
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

async function buildRolledGraph(
  rows: number,
  tamper: 'none' | 'selector' | 'target' | 'overlong' = 'none',
  tableSource: string = ROLLED_VARYING_TABLE,
  initialState: Record<string, unknown> = { handlers: [], __fnsel_handlers: [] },
): Promise<{ provider: any; transaction: string }> {
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
  // 'overlong' registers one row MORE than the published bound admits while co-spending only the planned rows,
  // so the source guard that PROVES the bound is the only thing left standing between it and settlement.
  const registered = tamper === 'overlong' ? rows + 1 : rows;
  const brands = Array.from({ length: registered }, (_, index) => BigInt(index + 2));
  const handlerSetups = await Promise.all(brands.map(async (brand) => {
    const base = new Contract(handlerArtifact, [brand], { provider });
    const setup = await setupStatefulUtxos(provider, base, handlerArtifact.stateLayout!, {});
    return { contract: base.withCategory(hexToBin(setup.categoryId)), setup, brand };
  }));
  const tableArtifact = compileString(tableSource, options);
  const tableBase = new Contract(tableArtifact, [], { provider });
  const tableSetup = await setupStatefulUtxos(
    provider, tableBase, tableArtifact.stateLayout!,
    initialState,
  );
  const table = tableBase.withCategory(hexToBin(tableSetup.categoryId));
  const tableStateful = StatefulContract.withCategory(tableBase, tableSetup.categoryId);
  for (const [index, setup] of handlerSetups.entries()) {
    const target = tamper === 'target' && index === rows - 1
      ? hexToBin(`aa20${'44'.repeat(32)}87`)
      : setup.contract.lockingBytecode;
    if (index % 2 === 0) await tableStateful.registerInc(target).send();
    else await tableStateful.registerDec(target).send();
  }
  const currentTable = await tableStateful.getFullState();
  if (!currentTable.masterUtxo || currentTable.dataNftUtxos.length !== 1) {
    throw new Error('runtime-sized fixture did not materialize its current master/data state');
  }

  const participants = [
    { artifact: tableArtifact, lockingBytecode: table.lockingBytecode },
    ...handlerSetups.slice(0, rows).map(({ contract, brand }) => ({
      artifact: handlerArtifact, lockingBytecode: contract.lockingBytecode, constructorArgs: [brand],
    })),
  ];
  const planned = handlerSetups.slice(0, rows);
  let dynamicCallIndex = 0;
  const plan = layer3.deriveCompiledGraphPlan({
    root: participants[0],
    function: 'fireAll',
    args: [4n],
    targets: { IVaryingHandler: participants.slice(1) } as any,
    occurrence: ({ kind }) => kind === 'loop' ? rows : 0,
    dynamicCall: () => {
      const reached = dynamicCallIndex++;
      const honest = reached % 2 === 0 ? 'inc' : 'dec';
      const substituted = honest === 'inc' ? 'dec' : 'inc';
      return {
        participant: participants[reached + 1],
        function: tamper === 'selector' && reached === rows - 1 ? substituted : honest,
      };
    },
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    Array.from({ length: rows + 1 }, () => ''), layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh, outpoints,
  );
  const projections = Array.from({ length: rows + 1 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const fee = uniqueUtxo(outpoints, { satoshis: 120_000n });
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);

  const dynamicVariables = tableArtifact.stateLayout!.variables.filter((variable) => variable.dynamic);
  const chunks: { variable: typeof dynamicVariables[number]; utxo: any; address: string }[] = [];
  for (const variable of dynamicVariables) {
    const address = getDynamicChunkAddress(
      table, tableSetup.categoryId, variable.name, variable.type,
    );
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
    projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: table.tokenAddress, amount: currentTable.masterUtxo.satoshis,
    token: currentTable.masterUtxo.token,
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
  return { provider, transaction: raw(tx) };
}


// The second producer of an expression selector: a state-selected pointer whose method is a ternary.
// Not a loop at all, which is why it isolates the selector expression from anything loop-shaped.
const TERNARY_CALLER = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract CompiledTernaryCaller(int brand) {
  function run(address handler, bool useInc, uint value) public {
    function(uint) external chosen = useInc ? IVaryingHandler(handler).inc : IVaryingHandler(handler).dec;
    chosen(value);
    require(value >= 0);
  }
}`;

async function buildTernaryGraph(
  tamper: 'none' | 'selector' | 'target' = 'none',
): Promise<{ provider: any; transaction: string }> {
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
  const calleeArtifact = compileString(POINTER_TARGET, options);
  const calleeBase = new Contract(calleeArtifact, [2n], { provider });
  const calleeSetup = await setupStatefulUtxos(provider, calleeBase, calleeArtifact.stateLayout!, {});
  const callee = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
  const callerArtifact = compileString(TERNARY_CALLER, options);
  const callerBase = new Contract(callerArtifact, [1n], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));
  const participantCaller = {
    artifact: callerArtifact, lockingBytecode: caller.lockingBytecode, constructorArgs: [1n],
  };
  const participantCallee = {
    artifact: calleeArtifact, lockingBytecode: callee.lockingBytecode, constructorArgs: [2n],
  };
  // The compiler publishes `inc` as the row's function, so `useInc == true` is the honest discriminant.
  // 'selector' flips the on-chain discriminant while the rooted row still claims inc.
  const target = tamper === 'target' ? hexToBin(`aa20${'44'.repeat(32)}87`) : callee.lockingBytecode;
  const plan = layer3.deriveCompiledGraphPlan({
    root: participantCaller,
    function: 'run',
    args: [target, tamper !== 'selector', 4n],
    targets: { IVaryingHandler: participantCallee },
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh, outpoints,
  );
  const fee = uniqueUtxo(outpoints, { satoshis: 50_000n });
  const projections = [
    uniqueUtxo(outpoints, { satoshis: 1000n }), uniqueUtxo(outpoints, { satoshis: 1000n }),
  ];
  await provider.addUtxo(p2pkh.address, fee);
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const calleeRoute = callee.createCompilerRouteUnlocker(
    calleeArtifact.hiddenBatch!.route, hexToBin(calleeArtifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(callerSetup.masterUtxo, callerRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
  ));
  tx.addInput(calleeSetup.masterUtxo, calleeRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  projections.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: caller.tokenAddress, amount: callerSetup.masterUtxo.satoshis,
    token: { category: callerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: callee.tokenAddress, amount: calleeSetup.masterUtxo.satoshis,
    token: { category: calleeSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  for (let index = 0; index < projections.length + 1; index += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx) };
}

describe('Layer-3 rolled pointer-table loop (X2, SEMANTIC)', () => {
  it('leaves the while-spelled loop rolled and unexpanded', () => {
    const artifact = compileString(ROLLED_VARYING_TABLE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    });
    const call = artifact.abi.find((fn) => fn.name === 'fireAll')!.externalCalls![0];
    // Rolled, not expanded: the callsite still names the array and its parallel selector array, and the
    // handler asks for no per-row master-index witness.
    expect(call.occurrence).toBe('loop');
    expect(call.loopArrayVar).toBe('handlers');
    expect(call.selectorArrayVar).toBe('__fnsel_handlers');
    expect(call.addressParam).toBeUndefined();
    // X63. The ceiling this spelling used to escape. The loop is still ROLLED - the four assertions above are
    // the ones that would move if it had been expanded, and the bytecode is byte-identical to what this file
    // measured before - but the bound the source proves now reaches the artifact, so a consumer is refused a
    // fourth row at plan time as well as by the on-chain `require(handlers.length <= 3)`.
    expect(call.maximumOccurrences).toBe(3);
    expect(call.occurrenceBoundSource).toBe('guard');
  }, 120_000);

  it.each([1, 2, 3])('executes a rolled varying-method table of %i rows', async (rows) => {
    const { provider, transaction } = await buildRolledGraph(rows);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  // Hostile, pinned to input 0 - the table's own graph route, the input whose covenant reads the row.
  // Discriminating power differs per case, and only the first two are evidence for this repair: at
  // `ffef8568` the target and method cases reject with the OP_SPLIT crash instead, so their rejection was
  // vacuous. The `overlong` case rejects at `ffef8568` too - the dominating require runs before the loop -
  // so it is a property of the rolled shape, not of the fix.
  it.each([
    ['a substituted target in the last reached row', 'target'],
    ['a substituted method in the last reached row', 'selector'],
    ['one more registered row than the guard admits', 'overlong'],
  ] as const)('rejects %s at input 0', async (_name, tamper) => {
    const { provider, transaction } = await buildRolledGraph(POINTER_TABLE_BOUND, tamper);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(
      /error in evaluating input index 0: Program failed an OP_VERIFY operation/,
    );
  }, 300_000);

  // GUARD NEGATIVE CONTROL. Both of these settle at `ffef8568` as well. They pin that "a rolled loop in a
  // graph handler" is not what the repair fixed - it is specifically a callsite whose selector is an
  // expression. Without them the honest positive above could be credited to the wrong mechanism.
  it.each([1, 2])('rolled ORDINARY interface loop settles unchanged, %i rows', async (rows) => {
    const { provider, transaction } = await buildRolledGraph(
      rows, 'none', ROLLED_INTERFACE_TABLE, { handlers: [] },
    );
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it.each([1, 2])('rolled FIXED-method pointer table settles unchanged, %i rows', async (rows) => {
    const { provider, transaction } = await buildRolledGraph(
      rows, 'none', ROLLED_FIXED_TABLE, { handlers: [] },
    );
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('executes a ternary state-selected pointer on the graph route', async () => {
    const { provider, transaction } = await buildTernaryGraph();
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it.each([
    ['a flipped ternary discriminant', 'selector'],
    ['a substituted ternary target', 'target'],
  ] as const)('rejects %s at input 0', async (_name, tamper) => {
    const { provider, transaction } = await buildTernaryGraph(tamper);
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(
      /error in evaluating input index 0: Program failed an OP_VERIFY operation/,
    );
  }, 300_000);
});
