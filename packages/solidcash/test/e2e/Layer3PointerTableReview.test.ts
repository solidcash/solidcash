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
 * Hostile review of G1 (compiler-bounded runtime-sized pointer table), written by the worker who did NOT
 * implement it. G1 publishes a CEILING rather than an exact reached-row count, so the question this file
 * answers on the BCH-2026 VM is: can a caller co-spend FEWER rows than the persisted table actually reaches
 * and still settle? The persisted table stays within the published bound in every case here, so the source
 * `require(handlers.length <= 3)` never fires; only the per-row guard the expansion emits can reject.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

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
 * `registered` rows are persisted in the table; `planned` rows are co-spent and appear in the transcript.
 * `registered === planned` is the honest control. `registered > planned` is the omission attack: every
 * persisted row is inside the published bound, so the only thing that can reject is the emitted per-row guard.
 */
async function buildPartialGraph(
  registered: number, planned: number,
): Promise<{ provider: any; builder: TransactionBuilder; transaction: string }> {
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
    if (index % 2 === 0) await tableStateful.registerInc(setup.contract.lockingBytecode).send();
    else await tableStateful.registerDec(setup.contract.lockingBytecode).send();
  }
  const currentTable = await tableStateful.getFullState();
  if (!currentTable.masterUtxo || currentTable.dataNftUtxos.length !== 1) {
    throw new Error('pointer-table review fixture did not materialize its current master/data state');
  }

  const participants = [
    { artifact: tableArtifact, lockingBytecode: table.lockingBytecode },
    ...handlerSetups.slice(0, planned).map(({ contract, brand }) => ({
      artifact: handlerArtifact, lockingBytecode: contract.lockingBytecode, constructorArgs: [brand],
    })),
  ];
  const cospent = handlerSetups.slice(0, planned);
  let dynamicCallIndex = 0;
  const plan = layer3.deriveCompiledGraphPlan({
    root: participants[0],
    function: 'fireAll',
    args: [4n],
    targets: {},
    occurrence: ({ kind }) => kind === 'loop' ? planned : 0,
    dynamicCall: () => {
      const reached = dynamicCallIndex++;
      return { participant: participants[reached + 1], function: reached % 2 === 0 ? 'inc' : 'dec' };
    },
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    Array.from({ length: planned + 1 }, () => ''), layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh, outpoints,
  );
  const projections = Array.from({ length: planned + 1 }, () => uniqueUtxo(outpoints, { satoshis: 1000n }));
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
  const handlerRoutes = cospent.map(({ contract }) => contract.createCompilerRouteUnlocker(
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
  for (const funding of trailingFunding) tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
  cospent.forEach(({ setup }, index) => tx.addInput(
    setup.masterUtxo,
    handlerRoutes[index](...layer3.compiledGraphRouteArgs(transcript, index + 1, layout.controllerInput) as any),
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
    amount: currentTable.dataNftUtxos[0].satoshis, token: currentTable.dataNftUtxos[0].token,
  });
  for (const { address, utxo } of chunks) tx.addOutput({ to: address, amount: utxo.satoshis, token: utxo.token });
  for (const funding of trailingFunding) tx.addOutput({ to: p2pkh.address, amount: funding.satoshis });
  cospent.forEach(({ contract, setup }) => tx.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis, token: setup.masterUtxo.token,
  }));
  for (let index = 0; index < projections.length + 1; index++) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, builder: tx, transaction: raw(tx) };
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

// SEMANTIC evidence only, on createLayer3SemanticTestProvider (layer3-bch2026-semantic-relaxed-v1: real
// BCH-2026 opcode, introspection and 128-byte commitment behaviour, relaxed capacity).
describe('Layer-3 pointer-table ceiling review (G1, SEMANTIC)', () => {
  it('settles when every persisted row is co-spent', async () => {
    const built = await buildPartialGraph(2, 2);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 120_000);

  // Attacks the reached-occurrence count: the persisted table holds 3 rows (inside the published ceiling of 3,
  // so the source require passes), but only 2 are co-spent and only 2 appear in the transcript. The third row's
  // emitted guard `2 < handlers.length` is true, so suppressing that call must not settle.
  it('rejects co-spending fewer rows than the persisted table reaches', async () => {
    const built = await buildPartialGraph(3, 2);
    expect(failingInput(built.builder)).toBe(0);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 120_000);

  // Same attack one row lower, to show the rejection is not an artifact of the ceiling itself being reached.
  it('rejects a single suppressed row at the bottom of the table', async () => {
    const built = await buildPartialGraph(2, 1);
    expect(failingInput(built.builder)).toBe(0);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 120_000);
});
