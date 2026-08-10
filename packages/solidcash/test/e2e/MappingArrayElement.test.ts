import { compileString as _csRawSolidc } from 'solidc';

// Asserts fixed-array element surgery through the mandatory vmap entry layout.
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> =>
  _csRawSolidc(s, o);
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider,
  StatefulContract,
  decodeEntryCommitment, encodeEntryCommitment, getDataNftAddress, getEntryNftAddress, keyToSlot, slotValueToBytes,
  type ConnectedStatefulContract,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  decodePushdataValue,
  encodePushdataValue,
} from '@solidcash/utils';
import { alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';

// Regression test for emitMappingArrayElementAssign codegen.
// Exercises `this.scores[user][index] = newValue` where the mapping value is
// a fixed-size array. Earlier codegen emitted two spurious OP_ROT instructions
// before the intended ROT+SWAP, corrupting the runtime stack so array surgery
// operated on the wrong slots. Tests compiled bytecode against a real VM.
const CONTRACT_SOURCE = `
pragma solidcash >=0.8.0;

contract ArrayMappingValue() {
    bigint counter;
    mapping(bytes20 => bigint[3]) scores;

    function setOneScore(bytes20 user, bigint index, bigint newValue) {
        this.scores[user][index] = newValue;
        this.counter = this.counter + 1;
    }
}
`;

describe('Mapping array-element assignment', () => {
  const artifact = compileString(CONTRACT_SOURCE);
  const stateLayout = artifact.stateLayout!;
  // Assigned per-bootstrap to the real genesis category; readScoresFromTx filters by it.
  let categoryId: string;

  // Genesis master + data NFT + the scores entry NFT in ONE real category so the entry
  // NFT shares the contract's category (Electrum is address+category indexed).
  async function bootstrapWithEntry(initialScores: bigint[]): Promise<{
    provider: MockNetworkProvider;
    sc: ConnectedStatefulContract;
  }> {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });
    const slot = keyToSlot(alicePkh);
    const zero = slotValueToBytes(0n);
    const value = encodePushdataValue(initialScores, 'bigint[3]');
    const valueTail = new Uint8Array(4 + value.length);
    new DataView(valueTail.buffer).setUint32(0, value.length, true);
    valueTail.set(value, 4);

    const { categoryId: cat } = await provider.addTokenUtxosDynamic((c) => {
      const salted = contract.withCategory(hexToBin(c));
      return [
        { address: salted.tokenAddress, satoshis: 100000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getDataNftAddress(salted, c), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: initialCommitments[0] } } },
        { address: getEntryNftAddress(salted, c, 'scores'), satoshis: 1200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, slot)) } } },
        { address: getEntryNftAddress(salted, c, 'scores'), satoshis: 1200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(slot, zero, valueTail)) } } },
      ];
    });
    categoryId = cat;

    const sc = StatefulContract.withCategory(contract, categoryId);
    return { provider, sc };
  }

  function readScoresFromTx(tx: Awaited<ReturnType<ConnectedStatefulContract['send']>>): bigint[] {
    const txOutputs = getTxOutputs(tx);
    const entryOutput = [...txOutputs].reverse().find(
      (o) => o.token?.nft?.capability === 'mutable'
        && o.token?.category === categoryId
        && o.token?.nft?.commitment
        && o.token.nft.commitment.length > 0
        // skip data NFT (vout 1 has shorter commitment since counter is small)
        && o !== txOutputs[1],
    );
    expect(entryOutput).toBeDefined();
    const parsed = decodeEntryCommitment(hexToBin(entryOutput!.token!.nft!.commitment));
    expect(parsed.slot).toEqual(keyToSlot(alicePkh));
    const size = new DataView(parsed.value.buffer, parsed.value.byteOffset, 4).getUint32(0, true);
    const decoded = decodePushdataValue(parsed.value.subarray(4, 4 + size), 0, 'bigint[3]');
    return decoded.value as bigint[];
  }

  it('updates the middle element: [10,20,30] with index=1 newValue=99 -> [10,99,30]', async () => {
    const { sc } = await bootstrapWithEntry([10n, 20n, 30n]);
    const tx = await sc.setOneScore(alicePkh, 1n, 99n).send();
    expect(tx.txid).toBeDefined();
    expect(readScoresFromTx(tx)).toEqual([10n, 99n, 30n]);
  });

  it('updates the first element: [10,20,30] with index=0 newValue=7 -> [7,20,30]', async () => {
    const { sc } = await bootstrapWithEntry([10n, 20n, 30n]);
    const tx = await sc.setOneScore(alicePkh, 0n, 7n).send();
    expect(tx.txid).toBeDefined();
    expect(readScoresFromTx(tx)).toEqual([7n, 20n, 30n]);
  });

  it('updates the last element: [10,20,30] with index=2 newValue=42 -> [10,20,42]', async () => {
    const { sc } = await bootstrapWithEntry([10n, 20n, 30n]);
    const tx = await sc.setOneScore(alicePkh, 2n, 42n).send();
    expect(tx.txid).toBeDefined();
    expect(readScoresFromTx(tx)).toEqual([10n, 20n, 42n]);
  });
});
