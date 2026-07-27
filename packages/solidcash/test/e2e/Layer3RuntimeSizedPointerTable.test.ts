import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import type { Artifact } from '@solidcash/utils';
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

const POINTER_TARGET = `pragma solidcash >=0.8.0;
contract CompiledPointerTarget(int brand) {
  function inc(uint value) public pure { require(value > 0); }
  function dec(uint value) public pure { require(value > 0); }
}`;

/** The literal ceiling the fixture contract proves with its dominating require. */
const POINTER_TABLE_BOUND = 3;

const RUNTIME_SIZED_TABLE = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract CompiledRuntimeSizedTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
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

async function buildRuntimeSizedGraph(
  rows: number,
  tamper: 'none' | 'selector' | 'target' | 'overlong' = 'none',
): Promise<{ provider: any; transaction: string }> {
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
  const tableArtifact = compileString(RUNTIME_SIZED_TABLE, options);
  const tableBase = new Contract(tableArtifact, [], { provider });
  const tableSetup = await setupStatefulUtxos(
    provider, tableBase, tableArtifact.stateLayout!,
    { handlers: [], __fnsel_handlers: [] },
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
    targets: {},
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
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projections = Array.from({ length: rows + 1 }, () => randomUtxo({ satoshis: 1000n }));
  const fee = randomUtxo({ satoshis: 120_000n });
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
    () => randomUtxo({ satoshis: 1000n }),
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

const compileTable = (): Artifact => compileString(RUNTIME_SIZED_TABLE, {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
});

// SEMANTIC evidence only. The named layer3-bch2026-semantic-relaxed-v1 profile keeps BCH-2026 opcode,
// introspection and 128-byte-commitment behaviour while relaxing capacity; it is not consensus-fit, standard
// policy, relay or deployability evidence.
describe('Layer-3 runtime-sized pointer table (SEMANTIC)', () => {
  it('publishes the compiler-proven ceiling as one bounded dispatch callsite', () => {
    const artifact = compileTable();
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'fireAll')!;
    expect(summary.bounded).toBe(true);
    expect(summary.maximumDirectInvocations).toBe(POINTER_TABLE_BOUND);
    expect(summary.externalCalls).toHaveLength(1);
    expect(summary.externalCalls![0].occurrence).toBe('loop');
    expect(summary.externalCalls![0].maximumOccurrences).toBe(POINTER_TABLE_BOUND);
    expect(summary.externalCalls![0].selectorArrayVar).toBe('__fnsel_handlers');
    const ordinary = artifact.abi.find((fn) => fn.name === 'fireAll')!;
    expect(ordinary.externalCalls![0].maximumOccurrences).toBe(POINTER_TABLE_BOUND);
  });

  it('rejects a runtime row count above the published bound before construction', () => {
    const artifact = compileTable();
    const root = { artifact, lockingBytecode: '51' };
    expect(() => layer3.deriveCompiledGraphPlan({
      root,
      function: 'fireAll',
      args: [4n],
      targets: {},
      occurrence: () => POINTER_TABLE_BOUND + 1,
      dynamicCall: () => ({ participant: root, function: 'inc' }),
    })).toThrow(/lacks a valid loop occurrence proof/);
  });

  // One artifact, one published ceiling, three different runtime row counts.
  it.each([1, 2, 3])('executes a runtime-sized table of %i rows', async (rows) => {
    const { provider, transaction } = await buildRuntimeSizedGraph(rows);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  // Attacks the row's target field: the persisted table element the covenant reads for that reached row.
  it('rejects a substituted target in the last reached row', async () => {
    const { provider, transaction } = await buildRuntimeSizedGraph(3, 'target');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

  // Attacks the row's selector field ONLY, leaving every target honest.
  it('rejects a substituted selector in the last reached row', async () => {
    const { provider, transaction } = await buildRuntimeSizedGraph(3, 'selector');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });

  // Attacks the bound invariant itself: a persisted table longer than the published ceiling must not settle a
  // truncated prefix. The source guard is the on-chain half of the compiler's proof.
  it('rejects a persisted table longer than the published bound', async () => {
    const { provider, transaction } = await buildRuntimeSizedGraph(POINTER_TABLE_BOUND, 'overlong');
    await expect(provider.sendRawTransaction(transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });
});
