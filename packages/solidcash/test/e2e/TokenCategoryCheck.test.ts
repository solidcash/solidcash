import { randomUtxo, isFungibleTokenUtxo, isNonTokenUtxo, utxoComparator } from '../../src/utils.js';
import {
  Contract, FailedRequireError,
  TransactionBuilder,
} from '../../src/index.js';
import artifact from '../fixture/token_category_comparison.artifact.js';
import { createTestProvider } from '../test-util.js';

describe('TokenCategoryCheck', () => {
  const provider = createTestProvider();

  const checkTokenCategoryContract = new Contract(artifact, [], { provider });

  beforeAll(async () => {
    console.log(checkTokenCategoryContract.tokenAddress);
    // Real FT genesis at the contract's token address (synthetic categories do not exist on regtest)
    await (provider as any).addTokenUtxosDynamic(() => [
      { address: checkTokenCategoryContract.tokenAddress, satoshis: 1000n, token: { amount: 1000n } },
    ]);
    await provider.addUtxo(checkTokenCategoryContract.address, randomUtxo());
    await provider.addUtxo(checkTokenCategoryContract.address, randomUtxo());
    await provider.addUtxo(checkTokenCategoryContract.address, randomUtxo());
  });

  describe('send', () => {
    it('cannot send if the input at index 1 contains tokens', async () => {
      const contractUtxos = await checkTokenCategoryContract.getUtxos();
      const tokenUtxo = contractUtxos.find(isFungibleTokenUtxo);
      const nonTokenUtxos = contractUtxos.filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      if (!tokenUtxo) {
        throw new Error('No token UTXO found with fungible tokens');
      }

      if (nonTokenUtxos.length < 1) {
        throw new Error('Less than one non-token UTXO found');
      }

      const to = checkTokenCategoryContract.tokenAddress;
      const amount = 1000n;
      const { token } = tokenUtxo;
      const changeAmount = tokenUtxo.satoshis + nonTokenUtxos[0].satoshis - amount - 1000n;

      const txPromise = new TransactionBuilder({ provider })
        .addInput(nonTokenUtxos[0], checkTokenCategoryContract.unlock.send())
        .addInput(tokenUtxo, checkTokenCategoryContract.unlock.send())
        .addOutput({ to, amount, token })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
      await expect(txPromise).rejects.toThrow('Test.scash:3 Require statement failed at input 0 in contract Test.scash at line 3.');
      await expect(txPromise).rejects.toThrow('Failing statement: require(tx.inputs[1].tokenCategory == 0x)');
    });

    it('can send if the input at index 1 does not contain tokens', async () => {
      const contractUtxos = await checkTokenCategoryContract.getUtxos();
      const nonTokenUtxos = contractUtxos.filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      if (nonTokenUtxos.length < 2) {
        throw new Error('Less than two non-token UTXOs found');
      }

      const to = checkTokenCategoryContract.tokenAddress;
      const amount = 1000n;
      const changeAmount = nonTokenUtxos[0].satoshis + nonTokenUtxos[1].satoshis - amount - 1000n;

      const txPromise = new TransactionBuilder({ provider })
        .addInput(nonTokenUtxos[0], checkTokenCategoryContract.unlock.send())
        .addInput(nonTokenUtxos[1], checkTokenCategoryContract.unlock.send())
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).resolves.toBeTruthy();
    });
  });
});

