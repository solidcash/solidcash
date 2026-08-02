import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildChunkCommitment, buildInitialStateCommitments } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createDynamicChunkUnlocker, getDataNftAddress, getDynamicChunkAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * X105 - a later handler row of one route observes the value an earlier row wrote.
 *
 * S3 measured the opposite and reported it rather than fixing it: a row that only READS a state variable
 * observed the PRE-transaction value even when an earlier row of the same route had written it, and the
 * transaction SETTLED. The mechanism is one classifier. `computeScalarJournalClosures` built the journal
 * closure and then dropped every function that writes nothing (`writerIds.has(id)`), so a pure reader
 * reached from `__scb1` as an OP_INVOKE subroutine read the authenticated pre-state commitment while the
 * earlier row's write was live in the wrapper's frame. A handler that reads AND writes was never affected,
 * which is why S2's two-row counter always advanced twice.
 *
 * That is an implementation divergence, not a spec one. Both governing documents state the opposite:
 * `compiler-hidden-batch-v1.md` section 5 defines `load(slot) -> newest write or authenticated pre-state`
 * and lists "read-your-writes state" among what the protocol covers, and section 7 lists ordinary `require`
 * as initially eligible. `invocation-transcript-v1.md` section 1.3 says the same for the deferred candidate.
 *
 * The exploitable shape is a post-condition the CALLER contract enforces. The router below emits both rows
 * from its own on-chain body, so a spender cannot drop the guard row - the graph transcript binds the row
 * list. Before the fix the guard evaluated against the pre-state and passed for a post-state it was written
 * to refuse.
 *
 * Discriminating set - the five shapes below, enumerated rather than sampled:
 *
 * 1. honest, guard holds against the post-state                          -> settles, before and after
 * 2. HOSTILE, guard holds against the PRE-state and fails the post-state -> settled before, refused after
 * 3. guard liveness: a one-row read-only route with a false expectation  -> refused (the require is live)
 * 4. guard liveness: the same one-row route with a true expectation      -> settles (3 is not vacuous)
 * 5. reader FIRST, writer second                                         -> settles; the pre-state IS the
 *                                                                          correct value in that order, so
 *                                                                          the repair does not over-reject
 *
 * Shapes 6-9 below extend the same question to a chunk-backed value; that is X104, and it turns out to have
 * the same cause.
 *
 * NOT in this set, and not claimed: mapping and collection readers; a reader reached through a further
 * foreign participant; the Release 5 repeated-external-callee route; a route with more than one writer of
 * the same slot; and a reader whose slot no handler of the route writes. Only the balanced two-participant
 * graph route is measured here.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/**
 * `withdraw` reads and writes `balance`, so it is journalled today. `assertFloor` only reads it, so before
 * the repair it read the pre-state commitment. Both are ordinary handlers with one parameter each.
 */
const VAULT = `pragma solidcash >=0.8.0;
    contract Vault() {
      bigint balance;
      function withdraw(bigint amount) public {
        this.balance = this.balance - amount;
        require(amount >= 0);
      }
      function assertFloor(bigint floor) public {
        require(this.balance >= floor);
      }
    }`;

interface Row { fn: 'withdraw' | 'assertFloor'; value: bigint }

interface Spec {
  rows: Row[];
  /** Pre-transaction balance seeded into the participant's data NFT. */
  opening: bigint;
}

interface Built {
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  closing: bigint;
  vaultInput: number;
}

async function buildGuardGraph(spec: Spec): Promise<Built> {
  const provider = createTestProvider();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const controllerCategory = genesis.categoryId as string;
  const options = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  };
  const vaultArtifact = compileString(VAULT, options);
  const vaultBase = new Contract(vaultArtifact, [], { provider });
  const vaultSetup = await setupStatefulUtxos(
    provider, vaultBase, vaultArtifact.stateLayout!, { balance: spec.opening },
  );
  const vault = vaultBase.withCategory(hexToBin(vaultSetup.categoryId));

  // The ROUTER emits both rows from its own body, so the guard row is not a spender's choice.
  const calls = spec.rows.map((row, index) => `        IVault(vault).${row.fn}(a${index});`).join('\n');
  const params = spec.rows.map((_row, index) => `bigint a${index}`).join(', ');
  const iface = [...new Set(spec.rows.map((row) => row.fn))]
    .map((fn) => `function ${fn}(bigint v);`).join(' ');
  const routerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IVault { ${iface} }
    contract GuardRouter(int brand, address vault) {
      function route(${params}) public {
${calls}
        require(true);
      }
    }`, options);
  const routerBase = new Contract(routerArtifact, [1n, vault.lockingBytecode], { provider });
  const routerSetup = await setupStatefulUtxos(provider, routerBase, routerArtifact.stateLayout!, {});
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: routerArtifact, lockingBytecode: router.lockingBytecode },
    { artifact: vaultArtifact, lockingBytecode: vault.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'route', args: spec.rows.map((row) => row.value) },
    ...spec.rows.map((row) => ({ parent: 0, callee: 1, function: row.fn, args: [row.value] })),
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const seedFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, seedFee);
  const seedTx = new TransactionBuilder({ provider });
  seedTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  seedTx.addInput(seedFee, p2pkh.unlock.spend(alicePub, signature()));
  seedTx.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  seedTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(seedTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const projectionUtxos = plan.participants.map(() => randomUtxo({ satoshis: 1000n }));
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  const fee = randomUtxo({ satoshis: 50_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const closing = spec.rows.reduce(
    (running, row) => (row.fn === 'withdraw' ? running - row.value : running), spec.opening,
  );
  const routeUnlocker = (contract: Contract<any, any>, artifact: any): any =>
    contract.createCompilerRouteUnlocker(artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector));

  const builder = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  builder.addInput(routerSetup.masterUtxo, routeUnlocker(router, routerArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as FunctionArgument[] as any,
  ));
  builder.addInput(vaultSetup.masterUtxo, routeUnlocker(vault, vaultArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as FunctionArgument[] as any,
  ));
  builder.addInput(
    vaultSetup.dataNftUtxos[0],
    createDataNftUnlocker(vault, layout.participantInputs[1], vaultSetup.categoryId),
  );
  projectionUtxos.forEach((proof, participant) =>
    builder.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  builder.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  builder.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  builder.addOutput({
    to: router.tokenAddress, amount: routerSetup.masterUtxo.satoshis,
    token: { category: routerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({
    to: vault.tokenAddress, amount: vaultSetup.masterUtxo.satoshis,
    token: { category: vaultSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({
    to: getDataNftAddress(vault, vaultSetup.categoryId), amount: vaultSetup.dataNftUtxos[0].satoshis,
    token: {
      category: vaultSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(vaultArtifact.stateLayout!, { balance: closing })[0],
      },
    },
  });
  for (let i = 0; i < plan.participants.length; i++) {
    builder.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  builder.addOutput({ to: p2pkh.address, amount: 1000n });
  builder.addOutput({ to: p2pkh.address, amount: 20_000n });
  return {
    provider, builder, transaction: raw(builder), closing, vaultInput: layout.participantInputs[1],
  };
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

describe('X105 - a router-enforced guard row reads the live journal, not the pre-state', () => {
  it('1. honest: the guard holds against the post-state and the route settles', async () => {
    const built = await buildGuardGraph({ opening: 100n, rows: [
      { fn: 'withdraw', value: 10n }, { fn: 'assertFloor', value: 50n },
    ] });
    expect(built.closing).toBe(90n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('2. HOSTILE: a guard true of the PRE-state and false of the post-state is refused at the vault', async () => {
    // opening 100 -> closing 20. `assertFloor(50)` is TRUE of 100 and FALSE of 20. Before X105 this settled.
    const built = await buildGuardGraph({ opening: 100n, rows: [
      { fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 50n },
    ] });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(built.vaultInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('3. guard liveness: a one-row read-only route with a false expectation is refused', async () => {
    const built = await buildGuardGraph({ opening: 100n, rows: [{ fn: 'assertFloor', value: 150n }] });
    expect(built.closing).toBe(100n);
    expect(failingInput(built.builder)).toBe(built.vaultInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('4. guard liveness: the same one-row route with a true expectation settles', async () => {
    const built = await buildGuardGraph({ opening: 100n, rows: [{ fn: 'assertFloor', value: 50n }] });
    expect(built.closing).toBe(100n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('5. reader FIRST: the pre-state IS the correct value in that order, so it still settles', async () => {
    // The guard runs before any write, so 100 >= 50 is the sequentially correct observation.
    const built = await buildGuardGraph({ opening: 100n, rows: [
      { fn: 'assertFloor', value: 50n }, { fn: 'withdraw', value: 80n },
    ] });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);
});

/**
 * X104 - a persisted read of a NON-EMPTY chunk-backed value on the bus route.
 *
 * S3 measured this as failing at the participant master in all six assemblies it tried, with no diagnostic,
 * while the identical read settled on the direct route. Its recorded lead was the route ABI publishing
 * `dynamicReads: undefined` for a read-only handler.
 *
 * That lead was one layer above the cause. The cause is the SAME classifier as X105: a read-only handler was
 * dropped from the journal closure, so its dynamic read was emitted INSIDE an OP_INVOKE subroutine, which has
 * no trailing-region context to resolve the chunk run against. Journalling the handler hoists the read into
 * the `__scb1` wrapper - `preAllocateDynamicWrite` reads the persisted value there, where the region base is
 * known - and the handler picks the value out of its frame.
 *
 * So X104 needed no separate repair and no new diagnostic: the shape is supportable, and the fix that makes a
 * later row see an earlier row's write also makes a persisted chunk read work at all. It is still fail-closed
 * on a wrong expectation, which is what distinguishes "now reads" from "now ignores".
 */
const NOTEBOOK = `pragma solidcash >=0.8.0;
    contract Notebook() {
      bytes note;
      function setNote(bytes t) public {
        this.note = t;
        require(true);
      }
      function checkNote(bytes expected) public {
        require(this.note == expected);
      }
    }`;

const CHUNK = 120;

interface ChunkSpec {
  rows: { fn: 'setNote' | 'checkNote'; value: Uint8Array }[];
  /** Persisted pre-transaction value, split into chunk UTXOs. */
  persisted: Uint8Array;
  /** Post-state value; defaults to the last `setNote` row, else the persisted value. */
  settled?: Uint8Array;
}

async function buildChunkReadGraph(spec: ChunkSpec): Promise<Built> {
  const provider = createTestProvider();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const controllerCategory = genesis.categoryId as string;
  const options = {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  };
  const noteArtifact = compileString(NOTEBOOK, options);
  const noteBase = new Contract(noteArtifact, [], { provider });
  const noteSetup = await setupStatefulUtxos(
    provider, noteBase, noteArtifact.stateLayout!, { note: spec.persisted },
  );
  const notebook = noteBase.withCategory(hexToBin(noteSetup.categoryId));
  const chunkAddress = getDynamicChunkAddress(notebook, noteSetup.categoryId, 'note', 'bytes');
  const oldChunks: any[] = [];
  for (let i = 0; i < Math.ceil(spec.persisted.length / CHUNK); i++) {
    const utxo = randomUtxo({
      satoshis: 1200n,
      token: {
        category: noteSetup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable' as const,
          commitment: buildChunkCommitment(i, spec.persisted.slice(i * CHUNK, (i + 1) * CHUNK)),
        },
      },
    });
    await provider.addUtxo(chunkAddress, utxo);
    oldChunks.push(utxo);
  }

  const calls = spec.rows.map((row, index) => `        INotebook(note).${row.fn}(v${index});`).join('\n');
  const params = spec.rows.map((_row, index) => `bytes v${index}`).join(', ');
  const iface = [...new Set(spec.rows.map((row) => row.fn))]
    .map((fn) => `function ${fn}(bytes t);`).join(' ');
  const routerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface INotebook { ${iface} }
    contract NoteRouter(int brand, address note) {
      function route(${params}) public {
${calls}
        require(true);
      }
    }`, options);
  const routerBase = new Contract(routerArtifact, [1n, notebook.lockingBytecode], { provider });
  const routerSetup = await setupStatefulUtxos(provider, routerBase, routerArtifact.stateLayout!, {});
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: routerArtifact, lockingBytecode: router.lockingBytecode },
    { artifact: noteArtifact, lockingBytecode: notebook.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'route', args: spec.rows.map((row) => row.value) },
    ...spec.rows.map((row) => ({ parent: 0, callee: 1, function: row.fn, args: [row.value] })),
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const seedFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, seedFee);
  const seedTx = new TransactionBuilder({ provider });
  seedTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  seedTx.addInput(seedFee, p2pkh.unlock.spend(alicePub, signature()));
  seedTx.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  seedTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(seedTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const projectionUtxos = plan.participants.map(() => randomUtxo({ satoshis: 1000n }));
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  const fee = randomUtxo({ satoshis: 400_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const written = spec.rows.filter((row) => row.fn === 'setNote').pop();
  const settled = spec.settled ?? written?.value ?? spec.persisted;
  const routeUnlocker = (contract: Contract<any, any>, artifact: any): any =>
    contract.createCompilerRouteUnlocker(artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector));

  const builder = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  builder.addInput(routerSetup.masterUtxo, routeUnlocker(router, routerArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as FunctionArgument[] as any,
  ));
  const region = layout.trailingRegions.find((entry) => entry.participant === 1)!;
  builder.addInput(noteSetup.masterUtxo, routeUnlocker(notebook, noteArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as FunctionArgument[] as any,
  ));
  builder.addInput(
    noteSetup.dataNftUtxos[0],
    createDataNftUnlocker(notebook, layout.participantInputs[1], noteSetup.categoryId),
  );
  for (const chunk of oldChunks) {
    builder.addInput(chunk, createDynamicChunkUnlocker(
      notebook, layout.participantInputs[1], noteSetup.categoryId, 'note', 'bytes',
    ));
  }
  for (let i = oldChunks.length; i < region.capacity; i++) {
    const funder = randomUtxo({ satoshis: 1500n });
    await provider.addUtxo(p2pkh.address, funder);
    builder.addInput(funder, p2pkh.unlock.spend(alicePub, signature()));
  }
  projectionUtxos.forEach((proof, participant) =>
    builder.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  builder.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  builder.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  builder.addOutput({
    to: router.tokenAddress, amount: routerSetup.masterUtxo.satoshis,
    token: { category: routerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({
    to: notebook.tokenAddress, amount: noteSetup.masterUtxo.satoshis,
    token: { category: noteSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({
    to: getDataNftAddress(notebook, noteSetup.categoryId), amount: noteSetup.dataNftUtxos[0].satoshis,
    token: {
      category: noteSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(noteArtifact.stateLayout!, { note: settled })[0],
      },
    },
  });
  const pieces = Math.ceil(settled.length / CHUNK);
  for (let i = 0; i < pieces; i++) {
    builder.addOutput({
      to: chunkAddress, amount: 1200n,
      token: {
        category: noteSetup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildChunkCommitment(i, settled.slice(i * CHUNK, (i + 1) * CHUNK)),
        },
      },
    });
  }
  for (let i = pieces; i < region.capacity; i++) builder.addOutput({ to: p2pkh.address, amount: 1000n });
  for (let i = 0; i < plan.participants.length; i++) {
    builder.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  builder.addOutput({ to: p2pkh.address, amount: 1000n });
  builder.addOutput({ to: p2pkh.address, amount: 20_000n });
  return {
    provider, builder, transaction: raw(builder), closing: 0n, vaultInput: layout.participantInputs[1],
  };
}

const filled = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);

describe('X104 - a persisted chunk-backed read on the bus route', () => {
  it('6. a one-row read of a NON-EMPTY persisted chunk value settles', async () => {
    const built = await buildChunkReadGraph({
      rows: [{ fn: 'checkNote', value: filled(40, 0x4a) }], persisted: filled(40, 0x4a),
    });
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('7. the same read with a wrong expectation is still refused, so 6 is not a bypass', async () => {
    const built = await buildChunkReadGraph({
      rows: [{ fn: 'checkNote', value: filled(40, 0x4b) }], persisted: filled(40, 0x4a),
      settled: filled(40, 0x4a),
    });
    expect(failingInput(built.builder)).toBe(built.vaultInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('8. a later row reads the chunk value an earlier row wrote', async () => {
    const built = await buildChunkReadGraph({
      rows: [{ fn: 'setNote', value: filled(40, 0x48) }, { fn: 'checkNote', value: filled(40, 0x48) }],
      persisted: new Uint8Array(),
    });
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('9. HOSTILE: the same later row asserting the PRE-transaction (empty) value is refused', async () => {
    const built = await buildChunkReadGraph({
      rows: [{ fn: 'setNote', value: filled(40, 0x48) }, { fn: 'checkNote', value: new Uint8Array() }],
      persisted: new Uint8Array(), settled: filled(40, 0x48),
    });
    expect(failingInput(built.builder)).toBe(built.vaultInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);
});
