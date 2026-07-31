import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments } from '@solidcash/utils';
import {
  Contract, StatefulContract, bytesToSlotValue, encodeEntryCommitment,
  getDataNftAddress, getEntryNftAddress, keyToSlot, slotValueToBytes,
} from '../../src/index.js';
import { alicePkh, bobPkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract X102() {
  enumerable mapping(bytes20 => bigint) observed;
  enumerable mapping(bytes20 => bigint) balances;
  bytes tag;
  function run(bytes20 who, bigint amount, bytes value) {
    bigint sum = 0;
    for (bigint existing of this.observed) { sum = sum + existing; }
    this.tag = value;
    this.balances[who] = this.balances[who] + amount;
    require(sum >= 0);
  }
  function check(bytes20 who, bigint amount, bytes value) {
    require(this.balances[who] == amount);
    require(this.tag == value);
  }
}`;

const c2Entries = (address: string, entries: Array<[Uint8Array, bigint]>): any[] => {
  const zero = slotValueToBytes(0n);
  const sorted = entries.map(([key, value]) => ({ slot: keyToSlot(key), value }))
    .sort((a, b) => bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1);
  const commitment = (slot: Uint8Array, next: Uint8Array, value?: bigint): string => binToHex(
    encodeEntryCommitment(slot, next, value === undefined ? new Uint8Array() : bigIntToVmNumber(value)),
  );
  return [
    { address, satoshis: 10_000n,
      token: { nft: { capability: 'mutable', commitment: commitment(zero, sorted[0]?.slot ?? zero) } } },
    ...sorted.map((entry, index) => ({
      address, satoshis: 10_000n,
      token: { nft: { capability: 'mutable',
        commitment: commitment(entry.slot, sorted[index + 1]?.slot ?? zero, entry.value) } },
    })),
  ];
};

const deploy = async (): Promise<{ provider: ReturnType<typeof createTestProvider>;
  contract: StatefulContract<any> }> => {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const inner = new Contract(artifact, [], { provider });
  const { categoryId } = await (provider as any).addTokenUtxosDynamic((category: string) => {
    const salted = inner.withCategory(hexToBin(category));
    const commitments = buildInitialStateCommitments(artifact.stateLayout!, { tag: new Uint8Array() });
    return [
      { address: salted.tokenAddress, satoshis: 10_000n,
        token: { nft: { capability: 'minting', commitment: '' } } },
      { address: getDataNftAddress(salted, category), satoshis: 10_000n,
        token: { nft: { capability: 'mutable', commitment: commitments[0] } } },
      ...c2Entries(getEntryNftAddress(salted, category, 'observed'), [[alicePkh, 2n]]),
      ...c2Entries(getEntryNftAddress(salted, category, 'balances'), []),
    ];
  });
  return { provider, contract: StatefulContract.withCategory(inner, categoryId) };
};

describe('X102 collection-iteration depth at the C2 insert arm', () => {
  it('settles an iteration plus a two-chunk write plus a new sorted entry', async () => {
    const { contract } = await deploy();
    const value = new Uint8Array(200).fill(0xab);
    await contract.run(bobPkh, 7n, value).send();
    await contract.check(bobPkh, 7n, value).send();
  }, 180_000);

  it('rejects a forged chunk while the iteration and inserted entry remain honest', async () => {
    const { provider, contract } = await deploy();
    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      throw new Error('capture-only');
    };
    await expect(contract.run(bobPkh, 7n, new Uint8Array(200).fill(0xab)).send())
      .rejects.toThrow('capture-only');
    (provider as any).sendRawTransaction = send;
    expect(captured).not.toBe('');

    const tx = decodeTransactionUnsafe(hexToBin(captured));
    const chunk = tx.outputs.findIndex((output) =>
      output.token?.nft?.commitment && binToHex(output.token.nft.commitment).startsWith('004c78'));
    expect(chunk).toBeGreaterThanOrEqual(0);
    tx.outputs[chunk].token!.nft!.commitment = hexToBin('004c7800');
    const outcome = await provider.sendRawTransaction(binToHex(encodeTransaction(tx)))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toContain('error in evaluating input index 0');
  }, 180_000);
});
