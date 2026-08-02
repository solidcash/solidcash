import { describe, expect, it } from 'vitest';
import {
  binToHex, encodeTransaction, hexToBin, sha256,
} from '@bitauth/libauth';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, TransactionBuilder, layer3,
} from '../../src/index.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import { createFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';

const source = (name: string): string => `contract ${name}() {
  int counter;
  function add(int amount) public {
    this.counter = this.counter + amount;
    require(amount > 0);
  }
}`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const reverseCategory = (category: string): string =>
  (category.match(/../g) as string[]).reverse().join('');

type Mutation = 'honest' | 'substitute' | 'gap' | 'suffix-row' | 'selector' | 'arguments'
| 'parent' | 'caller' | 'target' | 'completion';

async function attempt(mutation: Mutation): Promise<string> {
  const provider = createLayer3SemanticTestProvider();
  const artifacts = [compileString(source('Left'), { forceStateful: true }),
    compileString(source('Right'), { forceStateful: true })];
  const bases = artifacts.map((artifact) => new Contract(artifact, [], { provider }));
  const setups = await Promise.all(bases.map((contract, index) =>
    setupStatefulUtxos(provider, contract, artifacts[index].stateLayout!, { counter: 0n })));
  const contracts = bases.map((contract, index) => contract.withCategory(hexToBin(setups[index].categoryId)));
  const batches = artifacts.map((artifact, index) =>
    layer3.encodeHiddenBatch(artifact, [{ function: 'add', args: [BigInt(index + 1)] }]));
  const blockSizes = artifacts.map((artifact) => artifact.hiddenBatch!.route.blockLayout!.blockSize);
  expect(blockSizes).toEqual([2, 2]);
  const layout = layer3.singleTxBusPhysicalLayout(blockSizes);
  const participants = contracts.map((contract, index) => ({
    lockingBytecode: contract.lockingBytecode,
    masterCategory: reverseCategory(setups[index].categoryId),
    base: layout.participantInputs[index] + (mutation === 'gap' && index === 1 ? 1 : 0),
    blockSize: blockSizes[index],
    policyHash: binToHex(sha256.hash(hexToBin(contract.lockingBytecode))),
    trailingCapacity: 0,
  }));
  if (mutation === 'substitute') participants[1].lockingBytecode = '51';
  const rows: layer3.SingleTxRow[] = artifacts.map((artifact, index) => ({
    kind: 0, owner: index === 0 ? 0 : 0, consumer: index, slot: index === 0 ? 0xffff : 0,
    mode: 0, sourceSlot: index === 0 ? 0xffff : layout.participantInputs[0],
    targetSlot: layout.participantInputs[index], selectorHex: artifact.hiddenBatch!.handlers[0].selector,
    position: 2, parent: index === 0 ? 0xffff : 0, depth: index, subtreeEnd: 1,
    subjectHex: index === 0 ? '' : contracts[0].lockingBytecode,
    argsHex: batches[index].rows[0].argsHex, resultHex: '', effectHex: '',
  }));
  if (mutation === 'suffix-row') rows.push({ ...rows[1], slot: 1 });
  if (mutation === 'selector') rows[1] = { ...rows[1], selectorHex: 'ffffffff' };
  if (mutation === 'arguments') rows[1] = { ...rows[1], argsHex: '03' };
  if (mutation === 'parent') rows[1] = { ...rows[1], parent: 1 };
  if (mutation === 'caller') rows[1] = { ...rows[1], subjectHex: contracts[1].lockingBytecode };
  if (mutation === 'target') rows[1] = { ...rows[1], targetSlot: 0 };
  if (mutation === 'completion') rows[1] = { ...rows[1], position: 1 };
  const transcript: layer3.SingleTxBusTranscript = { participants, rows };

  const fee = await createFeeFunder(provider, 100_000n);
  const tx = new TransactionBuilder({ provider });
  for (let participant = 0; participant < contracts.length; participant += 1) {
    const contract = contracts[participant];
    const artifact = artifacts[participant];
    const setup = setups[participant];
    const route = artifact.hiddenBatch!.route;
    const routeUnlocker = contract.createCompilerRouteUnlocker(
      route, hexToBin(artifact.hiddenBatch!.selector),
    )(batches[participant].blob, ...batches[participant].routeWitnesses);
    tx.addInput(
      setup.masterUtxo,
      participant === 0 ? layer3.withSingleTxCarrier(routeUnlocker, transcript) : routeUnlocker,
    );
    tx.addOutput({
      to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
      token: {
        category: setup.categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: setup.masterUtxo.token?.nft?.commitment ?? '' },
      },
    });
    const data = setup.dataNftUtxos[0];
    tx.addInput(data, createDataNftUnlocker(contract, layout.participantInputs[participant], setup.categoryId));
    tx.addOutput({
      to: getDataNftAddress(contract, setup.categoryId), amount: data.satoshis,
      token: {
        category: setup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildInitialStateCommitments(
            artifact.stateLayout!, { counter: BigInt(participant + 1) },
          )[0],
        },
      },
    });
  }
  tx.addInput(fee.utxo, fee.unlocker);
  tx.addOutput({ to: fee.unlocker.generateLockingBytecode(), amount: 90_000n });
  return provider.sendRawTransaction(raw(tx));
}

describe('controllerless participant mutual structural verifier', () => {
  it('settles two independently compiled participants in one transaction', async () => {
    await expect(attempt('honest')).resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 120_000);

  it.each([
    'substitute', 'gap', 'suffix-row', 'selector', 'arguments', 'parent', 'caller', 'target', 'completion',
  ] as const)(
    'rejects hostile %s transcripts', async (mutation) => {
      await expect(attempt(mutation)).rejects.toThrow();
    }, 120_000,
  );
});
