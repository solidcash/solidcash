import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import {
  buildChunkCommitment, buildInitialStateCommitments, encodePushdataValue,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createEntryNftUnlocker,
  getDataNftAddress, getDynamicChunkAddress, getEntryNftAddress,
} from '../../src/stateful/covenant-helpers.js';
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract EventSubscription() {
  mapping(address => bool) public subscribers;
  address[] public subscriberList;
  function subscribe() public {
    require(!subscribers[msg.sender]);
    subscribers[msg.sender] = true;
    subscriberList.push(msg.sender);
  }
}`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

type Tamper = 'none' | 'mapping' | 'header' | 'chunk';

async function build(tamper: Tamper = 'none'): Promise<{
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  finalArrayBlob: Uint8Array;
}> {
  const provider = createTestProvider();
  const projectionArtifact = compileString(layer3.generateGraphProjectionVerifier());
  const projection = new Contract(projectionArtifact, [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const controllerCategory = genesis.categoryId as string;
  const artifact = compileString(SOURCE, {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const originHex = `76a914${binToHex(alicePkh as unknown as Uint8Array)}88ac`;
  const origin = hexToBin(originHex);
  const entrySlot = keyToSlot(origin);
  const setup = await setupStatefulUtxos(
    provider, base, artifact.stateLayout!, { subscriberList: [] }, {
      extraOutputs: (categoryId) => [{
        address: getEntryNftAddress(base, categoryId, 'subscribers'),
        satoshis: 10_000n,
        token: {
          amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: binToHex(encodeEntryCommitment(
              entrySlot, new Uint8Array(32), new Uint8Array(),
            )),
          },
        },
      }],
    },
  );
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const entry = setup.extraUtxos?.[0];
  if (!entry) throw new Error('EventSubscription fixture did not seed the subscriber entry');

  const plan = layer3.planCompiledGraph(
    [{ artifact, lockingBytecode: contract.lockingBytecode }],
    [{ parent: null, callee: 0, function: 'subscribe', logicalCaller: origin }],
  );
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );

  const initFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, initFee);
  const initialize = new TransactionBuilder({ provider });
  initialize.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
  initialize.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(initialize));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
  if (!rootedController) throw new Error('EventSubscription graph authority was not initialized');

  const proof = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 300_000n });
  await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(aliceAddress, fee);
  const finalArrayBlob = encodePushdataValue([origin], 'address[]');
  const finalHeader = buildInitialStateCommitments(
    artifact.stateLayout!, { subscriberList: finalArrayBlob },
  )[0];
  const initialHeader = buildInitialStateCommitments(
    artifact.stateLayout!, { subscriberList: [] },
  )[0];
  const finalEntry = encodeEntryCommitment(
    entrySlot, new Uint8Array(32), tamper === 'mapping' ? new Uint8Array() : bigIntToVmNumber(1n),
  );
  const chunkData = new Uint8Array(finalArrayBlob);
  if (tamper === 'chunk') chunkData[chunkData.length - 1] ^= 1;

  const builder = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  const region = layout.trailingRegions.find((candidate) => candidate.participant === 0)!;
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  builder.addInput(
    setup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  builder.addInput(
    setup.dataNftUtxos[0], createDataNftUnlocker(contract, 0, setup.categoryId),
  );
  builder.addInput(entry, createEntryNftUnlocker(contract, 0, setup.categoryId, 'subscribers'));
  for (let index = 0; index < region.capacity; index += 1) {
    const funder = randomUtxo({ satoshis: 1500n });
    await provider.addUtxo(p2pkh.address, funder);
    builder.addInput(funder, p2pkh.unlock.spend(alicePub, signature()));
  }
  builder.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  builder.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  builder.addInput(fee, signature().unlockP2PKH());

  builder.addOutput({
    to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
    token: {
      category: setup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  });
  builder.addOutput({
    to: getDataNftAddress(contract, setup.categoryId), amount: setup.dataNftUtxos[0].satoshis,
    token: {
      category: setup.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: tamper === 'header' ? initialHeader : finalHeader },
    },
  });
  builder.addOutput({
    to: getEntryNftAddress(contract, setup.categoryId, 'subscribers'), amount: entry.satoshis,
    token: {
      category: setup.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: binToHex(finalEntry) },
    },
  });
  builder.addOutput({
    to: getDynamicChunkAddress(contract, setup.categoryId, 'subscriberList', 'address[]'),
    amount: 1200n,
    token: {
      category: setup.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: buildChunkCommitment(0, chunkData) },
    },
  });
  for (let index = 1; index < region.capacity; index += 1) {
    builder.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  builder.addOutput({ to: p2pkh.address, amount: 1000n });
  builder.addOutput({ to: p2pkh.address, amount: 1000n });
  builder.addOutput({ to: aliceAddress, amount: 100_000n });
  return { provider, builder, finalArrayBlob };
}

async function expectInputZero(tamper: Exclude<Tamper, 'none'>): Promise<void> {
  const { provider, builder } = await build(tamper);
  const outcome = await provider.sendRawTransaction(raw(builder))
    .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  expect(outcome).toContain('error in evaluating input index 0');
  expect(outcome).toContain('Program failed an OP_VERIFY operation');
}

describe('EventSubscription exact controller graph', () => {
  it('settles msg.sender mapping insertion plus dynamic-array push under BCH-2026', async () => {
    const { provider, builder, finalArrayBlob } = await build();
    expect(finalArrayBlob.length).toBeGreaterThan(0);
    await expect(provider.sendRawTransaction(raw(builder))).resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 180_000);

  it('refuses a false mapping post-state at participant input 0', async () => {
    await expectInputZero('mapping');
  }, 180_000);

  it('refuses a stale dynamic-array header at participant input 0', async () => {
    await expectInputZero('header');
  }, 180_000);

  it('refuses a forged dynamic-array chunk at participant input 0', async () => {
    await expectInputZero('chunk');
  }, 180_000);
});
