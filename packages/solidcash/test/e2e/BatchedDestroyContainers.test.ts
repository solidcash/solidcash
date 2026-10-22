import { describe, it, expect } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { buildPushdataCommitment } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import {
  StatefulContract,
  getDataNftAddress,
  getSatoshiContainerAddress,
  getTokenContainerAddress,
  type ConnectedStatefulContract,
} from '../../src/stateful/index.js';
import type { TransactionDetails, Utxo } from '../../src/interfaces.js';
import { alicePub, alicePriv, bobAddress } from '../fixture/vars.js';
import { getTxOutputs } from '../test-util.js';

/**
 * A destroy split into batches spends every container in its final batch. An intermediate batch recreates the
 * master, and a direct container's pin then wants an output at the container's own index, which the batch lacks.
 * Anyone can send coins to a container address, so only a tokenless coin is a satoshi container and only a coin of
 * its own address's category a token container; junk there is left in place and reported, never spent or counted.
 *
 * `maxInputsPerTx: 4` stands in for the default 200: the planner treats both the same, with fewer inputs to evaluate.
 */
const SOURCE = `
pragma solidcash >=0.8.0;

contract BatchedDestroy(pubkey admin) {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function destroy(sig s) selfdestruct {
        require(checkSig(s, admin));
    }
}
`;

const artifact = compileString(SOURCE);
const FOREIGN = 'f00d'.repeat(16);
const OTHER = 'beef'.repeat(16);

const outpoint = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}`;
const spentBy = (tx: TransactionDetails): string[] => tx.inputs.map(
  (input) => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`,
);
const coin = (byte: string, satoshis: bigint, token?: Utxo['token']): Utxo => ({
  txid: byte.repeat(32), vout: 0, satoshis, ...(token !== undefined && { token }),
});

interface Fixture {
  provider: MockNetworkProvider;
  deployed: ConnectedStatefulContract;
  categoryId: string;
  satoshiAddress: string;
  tokenContainerAddress: string;
  containers: Utxo[];
  junk: Array<{ address: string; utxo: Utxo }>;
}

/** A master, five records, two satoshi containers, and junk at both the satoshi and a token container address. */
async function fixture(): Promise<Fixture> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [alicePub], { provider });
  const stateLayout = artifact.stateLayout!;
  const { categoryId } = await provider.addTokenUtxosDynamic((cat: string) => {
    const salted = contract.withCategory(hexToBin(cat));
    return [
      { address: salted.tokenAddress, satoshis: 20_000n,
        token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
      ...[0n, 10n, 11n, 12n, 13n].map((counter) => ({
        address: getDataNftAddress(salted, cat), satoshis: 2_000n,
        token: { amount: 0n, nft: {
          capability: 'mutable' as const, commitment: buildPushdataCommitment(stateLayout, { counter }, 0),
        } },
      })),
    ];
  });
  const deployed = StatefulContract.withCategory(contract, categoryId);
  const satoshiAddress = getSatoshiContainerAddress(deployed.inner, categoryId);
  const tokenContainerAddress = getTokenContainerAddress(deployed.inner, categoryId, FOREIGN);

  const containers = [coin('c1', 30_000n), coin('c2', 20_000n)];
  const junk = [
    { address: satoshiAddress, utxo: coin('d1', 1_000n, { category: FOREIGN, amount: 500n }) },
    { address: satoshiAddress, utxo: coin('d2', 1_000n, {
      category: OTHER, amount: 0n, nft: { capability: 'none', commitment: '' },
    }) },
    { address: tokenContainerAddress, utxo: coin('e1', 1_000n) },
    { address: tokenContainerAddress, utxo: coin('e2', 1_000n, { category: OTHER, amount: 7n }) },
  ];
  for (const utxo of containers) await provider.addUtxo(satoshiAddress, utxo);
  for (const { address, utxo } of junk) await provider.addUtxo(address, utxo);
  return { provider, deployed, categoryId, satoshiAddress, tokenContainerAddress, containers, junk };
}

describe('batched destroy keeps every container in the final batch', () => {
  it('spends the containers beside the master in the last transaction and leaves the junk', async () => {
    const { provider, deployed, categoryId, satoshiAddress, tokenContainerAddress, containers, junk } = await fixture();
    expect((await deployed.getFullState()).dataNftUtxos.length).toBe(5);

    // 1 master + 5 records + 2 containers = 8 inputs over a 4-input limit. In list order the second batch would be
    // [record, record, container]; the junk, counted as containers, would push them further into intermediates.
    const result = await StatefulContract.destroy({
      provider,
      contract: deployed,
      destroyFunctionName: 'destroy',
      destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
      recipient: bobAddress,
      tokenContainerCategoryIds: [FOREIGN],
      maxInputsPerTx: 4,
    });

    // Two intermediate batches of [master + 3 records] and [master + 1 record], then [master, record, c1, c2].
    expect(result.txs.map((tx) => tx.inputs.length)).toEqual([4, 2, 4]);
    const containerOutpoints = containers.map(outpoint);
    const junkOutpoints = junk.map(({ utxo }) => outpoint(utxo));
    const finalTx = result.txs[result.txs.length - 1];
    expect(spentBy(finalTx)).toEqual(expect.arrayContaining(containerOutpoints));
    for (const tx of result.txs) {
      expect(spentBy(tx).filter((spent) => junkOutpoints.includes(spent))).toEqual([]);
      const keepsMaster = getTxOutputs(tx).some(
        (output) => output.token?.category === categoryId && output.token.nft?.capability === 'minting',
      );
      expect(keepsMaster).toBe(tx !== finalTx);
      if (tx !== finalTx) expect(spentBy(tx).filter((spent) => containerOutpoints.includes(spent))).toEqual([]);
    }
    expect(result.totalReclaimed).toBeGreaterThan(50_000n);

    // Each junk coin is reported with its value and token, and is still where it was sent.
    expect(result.leftBehind.map((left) => left.outpoint).sort()).toEqual([...junkOutpoints].sort());
    for (const { address, utxo } of junk) {
      expect(result.leftBehind.find((left) => left.outpoint === outpoint(utxo))).toEqual({
        outpoint: outpoint(utxo), address, satoshis: utxo.satoshis,
        ...(utxo.token !== undefined && { token: utxo.token }),
      });
    }
    const remaining = [
      ...await provider.getUtxos(satoshiAddress), ...await provider.getUtxos(tokenContainerAddress),
    ].map(outpoint);
    expect(remaining.sort()).toEqual([...junkOutpoints].sort());
  });

  it('refuses before broadcasting when the containers do not fit the final transaction', async () => {
    const { provider, deployed, categoryId, satoshiAddress, containers } = await fixture();
    await expect(StatefulContract.destroy({
      provider,
      contract: deployed,
      destroyFunctionName: 'destroy',
      destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
      recipient: bobAddress,
      maxInputsPerTx: 2,
    })).rejects.toThrow(/must spend all 2 container coin\(s\) in its final transaction beside 1 master/);

    const masters = (await provider.getUtxos(deployed.tokenAddress)).filter(
      (utxo) => utxo.token?.category === categoryId && utxo.token.nft?.capability === 'minting',
    );
    expect(masters.length).toBe(1);
    const left = (await provider.getUtxos(satoshiAddress)).map(outpoint);
    expect(left).toEqual(expect.arrayContaining(containers.map(outpoint)));
  });
});
