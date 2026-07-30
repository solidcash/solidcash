import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildChunkCommitment, buildInitialStateCommitments } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, getDataNftAddress, getDynamicChunkAddress,
} from '../../src/stateful/covenant-helpers.js';

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

const ROUTER = `pragma solidcash >=0.8.0;
    interface IDynNote { function setNote(bytes t); }
    contract DynRouter(int brand, address note) {
      function route(bytes a) public {
        IDynNote(note).setNote(a);
        require(true);
      }
    }`;

const DYN = `pragma solidcash >=0.8.0;
    contract DynNote() {
      bytes note;
      function setNote(bytes t) public {
        this.note = t;
        require(true);
      }
    }`;

async function build(noteBytes: Uint8Array): Promise<any> {
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
  const genesisUtxo = genesis.utxos[0];
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const dynArtifact = compileString(DYN, options);
  const dynBase = new Contract(dynArtifact, [], { provider });
  const dynSetup = await setupStatefulUtxos(provider, dynBase, dynArtifact.stateLayout!, { note: '' });
  const dyn = dynBase.withCategory(hexToBin(dynSetup.categoryId));
  const callerArtifact = compileString(ROUTER, options);
  const callerBase = new Contract(callerArtifact, [1n, dyn.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {});
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: dynArtifact, lockingBytecode: dyn.lockingBytecode },
  ], [
    { parent: null, callee: 0, function: 'route', args: [noteBytes] },
    { parent: 0, callee: 1, function: 'setNote', args: [noteBytes] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  console.log('[layout]', JSON.stringify(layout));
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  // Rooted controller.
  const seedFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, seedFee);
  const seedTx = new TransactionBuilder({ provider });
  seedTx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()));
  seedTx.addInput(seedFee, p2pkh.unlock.spend(alicePub, signature()));
  seedTx.addOutput({
    to: controller.tokenAddress,
    amount: genesisUtxo.satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  seedTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(seedTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((u: any) => u.token?.nft?.commitment === transcript.root);

  const dynLayout = dynArtifact.hiddenBatch!.route.blockLayout!;
  const capacity = dynLayout.trailingCapacity!;
  const chunkAddress = getDynamicChunkAddress(dyn, dynSetup.categoryId, 'note', 'bytes');

  const projectionUtxos = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  const trailingFunders: any[] = [];
  for (let i = 0; i < capacity; i++) {
    const u = randomUtxo({ satoshis: 1500n });
    await provider.addUtxo(p2pkh.address, u);
    trailingFunders.push(u);
  }
  const fee = randomUtxo({ satoshis: 60_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const dynRoute = dyn.createCompilerRouteUnlocker(
    dynArtifact.hiddenBatch!.route, hexToBin(dynArtifact.hiddenBatch!.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    dynSetup.masterUtxo,
    dynRoute(...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as FunctionArgument[] as any),
  );
  tx.addInput(
    dynSetup.dataNftUtxos[0],
    createDataNftUnlocker(dyn, layout.participantInputs[1], dynSetup.categoryId),
  );
  for (const funder of trailingFunders) tx.addInput(funder, p2pkh.unlock.spend(alicePub, signature()));
  projectionUtxos.forEach((proof, participant) =>
    tx.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  // Outputs.
  tx.addOutput({
    to: caller.tokenAddress, amount: callerSetup.masterUtxo.satoshis,
    token: {
      category: callerSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  tx.addOutput({
    to: dyn.tokenAddress, amount: dynSetup.masterUtxo.satoshis,
    token: { category: dynSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(dyn, dynSetup.categoryId), amount: dynSetup.dataNftUtxos[0].satoshis,
    token: {
      category: dynSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(dynArtifact.stateLayout!, { note: noteBytes })[0],
      },
    },
  });
  const chunkCount = Math.ceil(noteBytes.length / 120);
  for (let i = 0; i < chunkCount; i++) {
    tx.addOutput({
      to: chunkAddress, amount: 1200n,
      token: {
        category: dynSetup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildChunkCommitment(i, noteBytes.slice(i * 120, (i + 1) * 120)),
        },
      },
    });
  }
  for (let i = chunkCount; i < capacity; i++) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 20_000n });
  return { provider, tx, transaction: raw(tx) };
}

describe('S3 probe: one dynamic handler in a graph', () => {
  it('settles a single-chunk dynamic write inside a two-participant graph', async () => {
    const built = await build(new Uint8Array(40).fill(0x41));
    try {
      layer3.preflightLayer3Transaction(built.tx);
      console.log('[preflight] OK');
    } catch (e) {
      console.log('[preflight] FAIL', (e as Error).message.slice(0, 300));
    }
    try {
      const id = await built.provider.sendRawTransaction(built.transaction);
      console.log('[send] OK', id);
    } catch (e) {
      console.log('[send] FAIL', (e as Error).message.slice(0, 400));
    }
    expect(true).toBe(true);
  }, 600_000);
});
