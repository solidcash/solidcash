import { compileString as rawCompileString } from 'solidc';
import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { Contract } from '../../src/index.js';
import {
  StatefulContract,
  bytesToSlotValue,
  encodeEntryCommitment,
  getDataNftAddress,
  getEntryNftAddress,
  keyToSlot,
  slotValueToBytes,
} from '../../src/stateful/index.js';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { createTestProvider } from '../test-util.js';

const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof rawCompileString> =>
  rawCompileString(s, o);

const vmapEntries = (address: string, entries: Array<[Uint8Array, bigint]>): any[] => {
  const zero = slotValueToBytes(0n);
  const sorted = entries.map(([key, value]) => ({ slot: keyToSlot(key), value }))
    .sort((a, b) => bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1);
  const commitment = (slot: Uint8Array, next: Uint8Array, value?: bigint): string => binToHex(
    encodeEntryCommitment(slot, next, value === undefined ? new Uint8Array() : bigIntToVmNumber(value)),
  );
  return [
    { address, satoshis: 10000n, token: { nft: { capability: 'mutable', commitment: commitment(zero, sorted[0]?.slot ?? zero) } } },
    ...sorted.map((entry, i) => ({
      address, satoshis: 10000n,
      token: { nft: { capability: 'mutable', commitment: commitment(entry.slot, sorted[i + 1]?.slot ?? zero, entry.value) } },
    })),
  ];
};

const bytes32Key = (tag: number): Uint8Array => {
  const k = new Uint8Array(32);
  k[31] = tag;
  return k;
};

const WINDOW_CONTRACT = `
pragma solidcash >=0.8.0;

contract Window() {
    bytes32 cursor;
    int total;
    enumerable mapping(bytes32 => int) values;

    function page() public {
        for (int v of this.values.window(cursor, 2)) {
            this.total = this.total + v;
        }
        require(true);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('Windowed (paginated) sorted-mapping iteration', () => {
  const artifact = compileString(WINDOW_CONTRACT, { messageBus: false, suppressWarnings: true });
  const stateLayout = artifact.stateLayout!;

  // Four keys with values 100/200/300/400; the sorted chain orders them by H(key), so the values the walk
  // sees follow the slot order, not the key order.
  const keys = [bytes32Key(1), bytes32Key(2), bytes32Key(3), bytes32Key(4)];
  const chain = keys.map((k, i) => ({ slot: keyToSlot(k), value: BigInt((i + 1) * 100) }))
    .sort((a, b) => bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1);

  const seed = async (provider: any, cursor = new Uint8Array(32)): Promise<string> => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await provider.addTokenUtxosDynamic((cat: string) => {
      const salted = contract.withCategory(hexToBin(cat));
      const commitments = buildInitialStateCommitments(stateLayout, { cursor, total: 0n });
      return [
        { address: salted.tokenAddress, satoshis: 10000n,
          token: { nft: { capability: 'minting', commitment: '' } } },
        { address: getDataNftAddress(salted, cat), satoshis: 10000n,
          token: { nft: { capability: 'mutable', commitment: commitments[0] } } },
        ...vmapEntries(getEntryNftAddress(salted, cat, 'values'),
          keys.map((k, i) => [k, BigInt((i + 1) * 100)])),
      ];
    });
    return categoryId;
  };

  it('compiles and publishes the window cursor/bound metadata', () => {
    const page = artifact.abi.find((f) => f.name === 'page')!;
    expect(page.collectionIterations).toHaveLength(1);
    expect(page.collectionIterations![0]).toMatchObject({
      collection: 'values', mode: 'values', windowCursor: 'cursor', windowBound: 2,
    });
  });

  it('walks two disjoint pages that together visit every entry and persist the cursor', async () => {
    const provider = createTestProvider();
    const categoryId = await seed(provider);
    const sc = StatefulContract.withCategory(new Contract(artifact, [], { provider }), categoryId);

    // Page 1 (cursor 0 -> HEAD): walks the first two entries in slot order.
    await sc.page().send();
    let state = await sc.getState();
    expect(state.total).toBe(chain[0].value + chain[1].value);
    expect(binToHex(state.cursor as Uint8Array)).toBe(binToHex(chain[1].slot));

    // Page 2 resumes at chain[1].slot: walks the remaining two entries.
    await sc.page().send();
    state = await sc.getState();
    expect(state.total).toBe(chain.reduce((sum, e) => sum + e.value, 0n));
    expect(binToHex(state.cursor as Uint8Array)).toBe(binToHex(chain[3].slot));
  });

  it('fails closed when the persisted cursor names a non-present anchor', async () => {
    const provider = createTestProvider();
    const corrupt = new Uint8Array(32);
    corrupt[0] = 0xee;
    const categoryId = await seed(provider, corrupt);
    const sc = StatefulContract.withCategory(new Contract(artifact, [], { provider }), categoryId);
    await expect(sc.page().send()).rejects.toThrow(/not a present entry/);
  });

  it('fails closed when the in-window chain is broken (an omitted entry)', async () => {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await provider.addTokenUtxosDynamic((cat: string) => {
      const salted = contract.withCategory(hexToBin(cat));
      const commitments = buildInitialStateCommitments(stateLayout, { cursor: new Uint8Array(32), total: 0n });
      const entryAddress = getEntryNftAddress(salted, cat, 'values');
      const chainUtxos = vmapEntries(entryAddress, keys.map((k, i) => [k, BigInt((i + 1) * 100)]));
      // Break the FIRST entry's nextKey so the K=2 window walk reaches a missing successor.
      const missing = new Uint8Array(32); missing[31] = 0x7f;
      const first = chainUtxos[1]; // chainUtxos = [HEAD, e1, e2, e3, e4]
      first.token.nft.commitment = binToHex(
        encodeEntryCommitment(chain[0].slot, missing, bigIntToVmNumber(chain[0].value)),
      );
      return [
        { address: salted.tokenAddress, satoshis: 10000n,
          token: { nft: { capability: 'minting', commitment: '' } } },
        { address: getDataNftAddress(salted, cat), satoshis: 10000n,
          token: { nft: { capability: 'mutable', commitment: commitments[0] } } },
        ...chainUtxos,
      ];
    });
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.page().send()).rejects.toThrow(/chain is broken/);
  });
});
