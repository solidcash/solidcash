/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * Invocation-transcript-v1 section 3.3 makes a proxy/delegate pair ONE participant: the proxy master is the
 * owner and the immutable implementation input is its executor. This is intentionally a red end-to-end
 * publication fixture. It starts from compiler output and the production worklist, then stops at the first
 * boundary which prevents constructing the normative transaction. The legacy adjacent lowLevelCall slot is
 * not accepted as evidence for the missing participant-row fields.
 *
 * Remove `it.fails` only when all three cases reach BCH-2026: honest settles, executor substitution rejects,
 * and a forged final proxy commitment rejects. Until then a green legacy delegate transaction must not turn
 * the v1 row into a completion claim.
 */

const CONTROLLER = `aa20${'11'.repeat(32)}87`;
const CATEGORY = '22'.repeat(32);
const OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: CONTROLLER,
  experimentalMessageBusControllerCategory: CATEGORY,
};

const IMPLEMENTATION = `pragma solidcash >=0.8.0;
contract V1PinnedDelegate() {
  bigint counter;
  function increment() delegate {
    this.counter = this.counter + 1;
    require(true);
  }
}`;

const FOREIGN_IMPLEMENTATION = IMPLEMENTATION.replace('V1PinnedDelegate', 'V1ForeignDelegate');

const PROXY = `pragma solidcash >=0.8.0;
contract V1DelegateProxy(address implementation) {
  bigint counter;
  function increment(bytes input) public {
    implementation.delegatecall(input);
    require(input.length == 4);
  }
}`;

const raw = (builder: TransactionBuilder) => binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = () => new SignatureTemplate(alicePriv);

async function createAuthority(provider: ReturnType<typeof createTestProvider>) {
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress, satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  return { projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0] };
}

async function initializeAuthority(
  provider: ReturnType<typeof createTestProvider>, controller: Contract, genesisUtxo: any,
  categoryId: string, root: string, p2pkh: Contract,
) {
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
  return (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root)!;
}

const prepareNormativeTransaction = async (mode: 'honest' | 'foreign-executor' | 'forged-proxy-state') => {
  const provider = createTestProvider();
  const { projection, controller, categoryId: controllerCategory, genesisUtxo } = await createAuthority(provider);
  const options = { ...OPTIONS, experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory };
  const implementationArtifact = compileString(IMPLEMENTATION, options);
  const foreignArtifact = compileString(FOREIGN_IMPLEMENTATION, options);
  const implementationBase = new Contract(implementationArtifact, [], { provider });
  const implementationSetup = await setupStatefulUtxos(
    provider, implementationBase, implementationArtifact.stateLayout!, { counter: 0n },
  );
  const implementation = implementationBase.withCategory(hexToBin(implementationSetup.categoryId));
  const foreignBase = new Contract(foreignArtifact, [], { provider });
  const foreignSetup = await setupStatefulUtxos(
    provider, foreignBase, foreignArtifact.stateLayout!, { counter: 0n },
  );
  const foreign = foreignBase.withCategory(hexToBin(foreignSetup.categoryId));
  const proxyArtifact = compileString(PROXY, options);
  const proxyBase = new Contract(proxyArtifact, [implementation.lockingBytecode], { provider });
  const proxySetup = await setupStatefulUtxos(provider, proxyBase, proxyArtifact.stateLayout!, { counter: 0n });
  const proxy = proxyBase.withCategory(hexToBin(proxySetup.categoryId));
  const selector = implementationArtifact.abi.find(({ name }) => name === 'increment')!.selector!;
  const requestedExecutor = mode === 'foreign-executor'
    ? foreign.lockingBytecode : implementation.lockingBytecode;
  const plan = layer3.deriveCompiledGraphPlan({
    root: {
      artifact: proxyArtifact,
      lockingBytecode: proxy.lockingBytecode,
      executionKind: 'delegate',
      executorLockingBytecode: requestedExecutor,
    },
    function: 'increment',
    args: [hexToBin(selector)],
    targets: {},
  });
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );

  expect(plan.participants).toHaveLength(1);
  expect(plan.participants[0].blockLayout.slots)
    .toContainEqual({ kind: 'lowLevelCall', offset: 2, slotIndex: 0 });

  const participant = plan.participants[0];
  expect(participant.executionKind).toBe(1);
  expect(participant.executorInputIndex).toBe(2);
  expect(participant.executorLockingBytecode).toBe(requestedExecutor);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const proof = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50_000n });
  await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const route = proxy.createCompilerRouteUnlocker(
    proxyArtifact.hiddenBatch!.route, hexToBin(proxyArtifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(proxySetup.masterUtxo,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any));
  tx.addInput(proxySetup.dataNftUtxos[0],
    createDataNftUnlocker(proxy, layout.participantInputs[0], proxySetup.categoryId));
  tx.addInput(implementationSetup.masterUtxo, (implementation.unlock as any).increment(0n));
  tx.addInput(proof, projection.unlock.verify(new Uint8Array(), BigInt(layout.controllerInput), 0n));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: proxy.tokenAddress, amount: proxySetup.masterUtxo.satoshis,
    token: { category: proxySetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(proxy, proxySetup.categoryId), amount: proxySetup.dataNftUtxos[0].satoshis,
    token: { category: proxySetup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment:
      buildInitialStateCommitments(proxyArtifact.stateLayout!, {
        counter: mode === 'forged-proxy-state' ? 2n : 1n,
      })[0] } },
  });
  tx.addOutput({
    to: implementation.tokenAddress, amount: implementationSetup.masterUtxo.satoshis,
    token: { category: implementationSetup.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return { provider, transaction: raw(tx), plan };
};

describe('invocation-transcript-v1 pinned one-hop delegate participant', () => {
  it('settles one exact delegate executor and one final proxy-state flush', async () => {
    const { provider, transaction } = await prepareNormativeTransaction('honest');
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('rejects a locking-bytecode substitution for the pinned delegate executor', async () => {
    const { provider, transaction } = await prepareNormativeTransaction('foreign-executor');
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(/input index 3/);
  });

  it('rejects a forged final proxy state under the delegate settlement authority', async () => {
    const { provider, transaction } = await prepareNormativeTransaction('forged-proxy-state');
    await expect(provider.sendRawTransaction(transaction)).rejects.toThrow(/input index 2/);
  });
});
