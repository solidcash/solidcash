import { describe, expect, it } from 'vitest';
import {
  binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, encodeDataPush, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildDataNftCovenantScript, scriptToBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * A data record's covenant self-authorizes on any master spend (its write path needs only the minting NFT), so a
 * function that writes a sorted mapping -- which co-spends the master and skips the C3 own-category count because it
 * has entry access -- could carry an extra data NFT co-spent and rewritten through that write path, read back later
 * as genuine scalar state. (A pure read cannot: it co-spends no minting NFT, so the data covenant's write path and
 * consensus token validation both refuse the extra mutable node.) The direct convention now pins the data-NFT
 * address to the data NFTs the function names.
 *
 * set(k,v) writes m and names no data NFT, so the honest spend co-spends none and the smuggled rewrite is refused at
 * the master. readBoth reads the scalar and m (one named data NFT) and settles, so the pin is not over-tight.
 */

const SOURCE = `contract DataCensus {
  int x;
  mapping(int => int) m;
  function setX(int v) external { x = v; require(true); }
  function set(int k, int v) external { m[k] = v; require(true); }
  function readBoth(int k, int kv, int xv) external { require(m[k] == kv); require(x == xv); }
  function readScalar(int expected) external { require(x == expected); }
}`;

type Provider = ReturnType<typeof createTestProvider>;
const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';

async function deploy(): Promise<{ provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string }> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, { x: 5n },
    { saltContract: true });
  const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  return { provider, sc: StatefulContract.withCategory(contract, categoryId), pinned, cat: categoryId };
}

async function capture(provider: Provider, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return captured;
}

describe('direct convention: a collection write co-spends only the data NFTs it names', () => {
  it('refuses an extra rewritten data NFT beside a mapping write, then settles honestly', async () => {
    const { provider, sc, pinned, cat } = await deploy();
    await sc.getFunction('set')(7n, 50n).send();

    // set(8, 60) writes m and co-spends the master (minting). It names no data NFT.
    const hex = await capture(provider, () => sc.getFunction('set')(8n, 60n).send());
    const tx = decodeTransactionUnsafe(hexToBin(hex));
    const address = getDataNftAddress(pinned, cat);
    const lock = (cashAddressToLockingBytecode(address) as { bytecode: Uint8Array }).bytecode;
    const [node] = await provider.getUtxos(address);
    expect(node).toBeDefined();
    const redeem = scriptToBytecode(buildDataNftCovenantScript(hexToBin(cat)));
    const template = tx.outputs.find((o) => o.token?.nft?.capability === 'mutable')!;

    const txid = (0x9000 + Math.floor(Math.random() * 0x6fff)).toString(16).padStart(64, '0');
    await (provider as any).addUtxo(FUNDER, { txid, vout: 0, satoshis: 40000n });
    tx.inputs.push({
      outpointTransactionHash: hexToBin(txid), outpointIndex: 0, sequenceNumber: 0xffffffff,
      unlockingBytecode: Uint8Array.from([0x01, 0x51]),
    });
    // Data NFT 0 co-spent via its write path (flag=1, master minting at input 0), with a rewritten commitment.
    tx.inputs.push({
      outpointTransactionHash: hexToBin(node.txid), outpointIndex: node.vout, sequenceNumber: 0xffffffff,
      unlockingBytecode: Uint8Array.from([0x00, 0x51, ...encodeDataPush(redeem)]),
    });
    const forged = hexToBin(node.token!.nft!.commitment).slice();
    forged[0] = 0x09;
    tx.outputs.push({
      lockingBytecode: lock, valueSatoshis: node.satoshis,
      token: { amount: 0n, category: template.token!.category.slice(),
        nft: { capability: 'mutable', commitment: forged } },
    } as any);
    tx.outputs.push({ lockingBytecode: hexToBin(FUNDER), valueSatoshis: 25000n });

    const outcome = await provider.sendRawTransaction(binToHex(encodeTransaction(tx)))
      .then(() => 'ACCEPTED').catch((e: Error) => e.message);
    expectScriptRejection(outcome, 0);

    // The honest write settles, and the scalar it does not touch keeps its value.
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
    await expect(sc.getFunction('readScalar')(5n).send()).resolves.toBeDefined();
  }, 300_000);

  it('settles a read of the scalar beside the mapping, so the data-NFT pin is not over-tight', async () => {
    const { sc } = await deploy();
    await sc.getFunction('set')(7n, 50n).send();
    await expect(sc.getFunction('readBoth')(7n, 50n, 5n).send()).resolves.toBeDefined();
  }, 300_000);
});
