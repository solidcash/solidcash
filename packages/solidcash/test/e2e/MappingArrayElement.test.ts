import { compileString as _csRawSolidc } from 'solidc';

// Asserts the DEFAULT (entry-model) fixed-array byte format via buildEntryCommitment seeding. Fixed arrays are now
// C2 by default (SortedMappingFixedArrayValue covers that); opt out so this keeps testing the default entry model.
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> =>
  _csRawSolidc(s, o);
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider,
  StatefulContract,
  getDataNftAddress, getEntryNftAddress,
  type ConnectedStatefulContract,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  buildEntryCommitment,
  parseEntryCommitment,
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
    const entryCommitment = buildEntryCommitment(alicePkh, 'bytes20', initialScores, 'bigint[3]');

    const { categoryId: cat } = await provider.addTokenUtxosDynamic((c) => {
      const salted = contract.withCategory(hexToBin(c));
      return [
        { address: salted.tokenAddress, satoshis: 100000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getDataNftAddress(salted, c), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: initialCommitments[0] } } },
        { address: getEntryNftAddress(salted, c, 'scores'), satoshis: 1200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: entryCommitment } } },
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
    const parsed = parseEntryCommitment(
      entryOutput!.token!.nft!.commitment, 'bytes20', 'bigint[3]',
    );
    expect(parsed.key).toEqual(alicePkh);
    return parsed.value as bigint[];
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
