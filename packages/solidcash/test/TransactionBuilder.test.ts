import { decodeTransactionUnsafe, hexToBin, stringify } from '@bitauth/libauth';
import { Contract, SignatureTemplate, placeholderP2PKHUnlocker, placeholderPublicKey, placeholderSignature } from '../src/index.js';
import {
  bobAddress,
  bobPub,
  bobPriv,
  carolPkh,
  carolPub,
  carolAddress,
  carolPriv,
  bobTokenAddress,
  aliceAddress,
  alicePriv,
} from './fixture/vars.js';
import { utxoComparator, calculateDust, randomUtxo, randomToken, randomNFT, isNonTokenUtxo, isFungibleTokenUtxo } from '../src/utils.js';
import p2pkhArtifact from './fixture/p2pkh.artifact.js';
import twtArtifact from './fixture/transfer_with_timeout.artifact.js';
import { TransactionBuilder } from '../src/TransactionBuilder.js';
import { createTestProvider, getTxOutputs } from './test-util.js';
import { generateWcTransactionObjectFixture } from './fixture/walletconnect/fixtures.js';

describe('Transaction Builder', () => {
  const provider = createTestProvider();

  let p2pkhInstance: Contract<typeof p2pkhArtifact>;
  let twtInstance: Contract<typeof twtArtifact>;

  beforeAll(async () => {
    // Note: We instantiate the contract with carolPkh to avoid mempool conflicts with other (P2PKH) tests
    p2pkhInstance = new Contract(p2pkhArtifact, [carolPkh], { provider });
    twtInstance = new Contract(twtArtifact, [bobPub, carolPub, 100000n], { provider });
    console.log(p2pkhInstance.tokenAddress);
    console.log(twtInstance.tokenAddress);
    await provider.addUtxo(p2pkhInstance.address, randomUtxo());
    await provider.addUtxo(p2pkhInstance.address, randomUtxo());
    await provider.addUtxo(p2pkhInstance.address, randomUtxo({ token: randomToken() }));
    await provider.addUtxo(twtInstance.address, randomUtxo());
    await provider.addUtxo(twtInstance.address, randomUtxo());
    await provider.addUtxo(aliceAddress, randomUtxo());
    await provider.addUtxo(aliceAddress, randomUtxo());
    await provider.addUtxo(bobAddress, randomUtxo());
    await provider.addUtxo(bobAddress, randomUtxo());
    await provider.addUtxo(carolAddress, randomUtxo());
    await provider.addUtxo(carolAddress, randomUtxo());
  });

  describe('test TransactionBuilder.build', () => {
    it('should build a transaction that can spend from 2 different contracts and P2PKH + OP_RETURN', async () => {
      const fee = 1000n;

      const carolUtxos = (await provider.getUtxos(carolAddress)).filter(isNonTokenUtxo).sort(utxoComparator).reverse();
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();
      const twtUtxos = (await twtInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      const change = carolUtxos[0].satoshis - fee;
      const dustAmount = calculateDust({ to: carolAddress, amount: change });

      const outputs = [
        { to: p2pkhInstance.address, amount: p2pkhUtxos[0].satoshis },
        { to: twtInstance.address, amount: twtUtxos[0].satoshis },
        ...(change > dustAmount ? [{ to: carolAddress, amount: change }] : []),
      ];

      if (change < 0) {
        throw new Error('Not enough funds to send transaction');
      }

      const tx = new TransactionBuilder({ provider })
        .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
        .addInput(twtUtxos[0], twtInstance.unlock.transfer(new SignatureTemplate(carolPriv)))
        .addInput(carolUtxos[0], new SignatureTemplate(carolPriv).unlockP2PKH())
        .addOpReturnOutput(['Hello new transaction builder'])
        .addOutputs(outputs)
        .build();

      const txOutputs = getTxOutputs(decodeTransactionUnsafe(hexToBin(tx)));
      expect(txOutputs).toEqual(expect.arrayContaining(outputs));
    });

    it('should fail when fee is higher than maximumFeeSatoshis', async () => {
      const fee = 2000n;
      const maximumFeeSatoshis = 1000n;
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      const amount = p2pkhUtxos[0].satoshis - fee;
      const dustAmount = calculateDust({ to: p2pkhInstance.address, amount });

      if (amount < dustAmount) {
        throw new Error('Not enough funds to send transaction');
      }

      expect(() => {
        new TransactionBuilder({ provider, maximumFeeSatoshis })
          .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: p2pkhInstance.address, amount })
          .build();
      }).toThrow(`Transaction fee of ${fee} is higher than max fee of ${maximumFeeSatoshis}`);
    });

    it('should succeed when fee is lower than maximumFeeSatoshis', async () => {
      const fee = 1000n;
      const maximumFeeSatoshis = 2000n;
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      const amount = p2pkhUtxos[0].satoshis - fee;
      const dustAmount = calculateDust({ to: p2pkhInstance.address, amount });

      if (amount < dustAmount) {
        throw new Error('Not enough funds to send transaction');
      }

      const tx = new TransactionBuilder({ provider, maximumFeeSatoshis })
        .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
        .addOutput({ to: p2pkhInstance.address, amount })
        .build();

      expect(tx).toBeDefined();
    });

    it('should fail when fee per byte is higher than maximumFeeSatsPerByte', async () => {
      const fee = 2000n;
      const maximumFeeSatsPerByte = 1.0;
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      const amount = p2pkhUtxos[0].satoshis - fee;
      const dustAmount = calculateDust({ to: p2pkhInstance.address, amount });

      if (amount < dustAmount) {
        throw new Error('Not enough funds to send transaction');
      }

      expect(() => {
        new TransactionBuilder({ provider, maximumFeeSatsPerByte })
          .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: p2pkhInstance.address, amount })
          .build();
      }).toThrow('Transaction fee per byte of');
    });

    it('should succeed when fee per byte is lower than maximumFeeSatsPerByte', async () => {
      const fee = 1000n;
      const maximumFeeSatsPerByte = 10.0;
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      const amount = p2pkhUtxos[0].satoshis - fee;
      const dustAmount = calculateDust({ to: p2pkhInstance.address, amount });

      if (amount < dustAmount) {
        throw new Error('Not enough funds to send transaction');
      }

      const tx = new TransactionBuilder({ provider, maximumFeeSatsPerByte })
        .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
        .addOutput({ to: p2pkhInstance.address, amount })
        .build();

      expect(tx).toBeDefined();
    });

    // TODO: Consider improving error messages checked below to also include the input/output index

    it('should fail when trying to send to invalid address', async () => {
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobAddress.slice(0, -1), amount: 1000n })
          .build();
      }).toThrow('CashAddress decoding error');
    });

    it('should fail when trying to send tokens to non-token address', async () => {
      const tokenUtxo = (await p2pkhInstance.getUtxos()).find(isFungibleTokenUtxo)!;

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(tokenUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobAddress, amount: 1000n, token: tokenUtxo.token })
          .build();
      }).toThrow('Tried to send tokens to an address without token support');
    });

    it('should fail when trying to send negative BCH amount or token amount', async () => {
      const tokenUtxo = (await p2pkhInstance.getUtxos()).find(isFungibleTokenUtxo)!;

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(tokenUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobTokenAddress, amount: -1000n, token: tokenUtxo.token })
          .build();
      }).toThrow('Tried to add an output with -1000 satoshis, which is less than the required minimum for this output-type');

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(tokenUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobTokenAddress, amount: 1000n, token: { amount: -1000n, category: tokenUtxo.token!.category } })
          .build();
      }).toThrow('Tried to add an output with -1000 tokens, which is invalid');
    });

    it('should fail when adding undefined input', async () => {
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();
      const undefinedUtxo = p2pkhUtxos[1000];

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(undefinedUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobAddress, amount: 1000n })
          .build();
      }).toThrow('Input is undefined');
    });

    it('should fail when implicitly burning an immutable NFT', async () => {
      const nftToken = randomNFT();
      const nftUtxo = randomUtxo({ token: nftToken });
      await provider.addUtxo(p2pkhInstance.tokenAddress, nftUtxo);

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(nftUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobTokenAddress, amount: nftUtxo.satoshis - 1000n })
          .build();
      }).toThrow('Implicit burning of NFT');
    });

    it('should fail when implicitly burning a mutable NFT', async () => {
      const nftToken = randomNFT({ nft: { capability: 'mutable', commitment: 'aabb' } });
      const nftUtxo = randomUtxo({ token: nftToken });
      await provider.addUtxo(p2pkhInstance.tokenAddress, nftUtxo);

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(nftUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobTokenAddress, amount: nftUtxo.satoshis - 1000n })
          .build();
      }).toThrow('Implicit burning of NFT');
    });

    it('should fail when implicitly burning a minting NFT', async () => {
      const nftToken = randomNFT({ nft: { capability: 'minting', commitment: '' } });
      const nftUtxo = randomUtxo({ token: nftToken });
      await provider.addUtxo(p2pkhInstance.tokenAddress, nftUtxo);

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(nftUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobTokenAddress, amount: nftUtxo.satoshis - 1000n })
          .build();
      }).toThrow('Implicit burning of NFT');
    });

    it('should succeed when NFT is preserved in output', async () => {
      const nftUtxo = randomUtxo({ token: randomNFT() });
      await provider.addUtxo(p2pkhInstance.tokenAddress, nftUtxo);

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(nftUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          // use the real (post-addUtxo) token so the preserved category matches on regtest
          .addOutput({ to: bobTokenAddress, amount: nftUtxo.satoshis - 1000n, token: nftUtxo.token })
          .build();
      }).not.toThrow();
    });

    it('should succeed when mutable NFT commitment changes in output', async () => {
      const nftUtxo = randomUtxo({ token: randomNFT({ nft: { capability: 'mutable', commitment: 'aabb' } }) });
      await provider.addUtxo(p2pkhInstance.tokenAddress, nftUtxo);

      // use the real (post-addUtxo) category so only the commitment changes on regtest
      const updatedToken = {
        ...nftUtxo.token,
        nft: { capability: 'mutable' as const, commitment: 'ccdd' },
      };

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(nftUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobTokenAddress, amount: nftUtxo.satoshis - 1000n, token: updatedToken })
          .build();
      }).not.toThrow();
    });

    it('should succeed when allowImplicitNftBurn is true', async () => {
      const nftToken = randomNFT();
      const nftUtxo = randomUtxo({ token: nftToken });
      await provider.addUtxo(p2pkhInstance.tokenAddress, nftUtxo);

      expect(() => {
        new TransactionBuilder({ provider, allowImplicitNftBurn: true })
          .addInput(nftUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobTokenAddress, amount: nftUtxo.satoshis - 1000n })
          .build();
      }).not.toThrow();
    });

    it('should fail when adding a duplicate input (same txid:vout)', async () => {
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();
      const utxo = p2pkhUtxos[0];

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(utxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addInput(utxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobAddress, amount: 1000n })
          .build();
      }).toThrow('Duplicate input detected');
    });

    it('should fail when adding an input with invalid txid', () => {
      const invalidUtxo = { txid: 'not-hex', vout: 0, satoshis: 1000n };

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(invalidUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)));
      }).toThrow('Invalid input txid');
    });

    it('should fail when adding an input with negative vout', () => {
      const invalidUtxo = { txid: 'aa'.repeat(32), vout: -1, satoshis: 1000n };

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(invalidUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)));
      }).toThrow('Invalid input vout');
    });

    it('should fail when adding an input with negative satoshis', () => {
      const invalidUtxo = { txid: 'aa'.repeat(32), vout: 0, satoshis: -1n };

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(invalidUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)));
      }).toThrow('Invalid input satoshis');
    });

    it('should fail when adding an input with invalid token category', () => {
      const invalidUtxo = {
        txid: 'aa'.repeat(32), vout: 0, satoshis: 1000n,
        token: { category: 'not-hex', amount: 0n },
      };

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(invalidUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)));
      }).toThrow('Invalid input token category');
    });

    it('should validate bytecode outputs for negative amount', async () => {
      const p2pkhUtxos = [randomUtxo()];
      await provider.addUtxo(p2pkhInstance.address, p2pkhUtxos[0]);

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: new Uint8Array([0x76, 0xa9]), amount: -100n });
      }).toThrow('Tried to add an output with -100 satoshis');
    });

    it('should validate bytecode outputs for negative token amount', async () => {
      const p2pkhUtxos = [randomUtxo()];
      await provider.addUtxo(p2pkhInstance.address, p2pkhUtxos[0]);

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: new Uint8Array([0x76, 0xa9]), amount: 1000n, token: { category: 'aa'.repeat(32), amount: -1n } });
      }).toThrow('Tried to add an output with -1 tokens, which is invalid');
    });

    it('should fail when immutable NFT commitment differs in output', async () => {
      const nftToken = randomNFT({ nft: { capability: 'none', commitment: 'aabb' } });
      const nftUtxo = randomUtxo({ token: nftToken });
      await provider.addUtxo(p2pkhInstance.tokenAddress, nftUtxo);

      const differentToken = {
        ...nftToken,
        nft: { capability: 'none' as const, commitment: 'ccdd' },
      };

      expect(() => {
        new TransactionBuilder({ provider })
          .addInput(nftUtxo, p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
          .addOutput({ to: bobTokenAddress, amount: nftUtxo.satoshis - 1000n, token: differentToken })
          .build();
      }).toThrow('Implicit burning of NFT');
    });
  });

  describe('test TransactionBuilder.generateWcTransactionObject', () => {
    it('should match the generateWcTransactionObjectFixture ', async () => {
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();
      const contractUtxo = p2pkhUtxos[0];
      const bobUtxos = await provider.getUtxos(bobAddress);

      const placeholderUnlocker = placeholderP2PKHUnlocker(bobAddress);
      const placeholderPubKey = placeholderPublicKey();
      const placeholderSig = placeholderSignature();

      // use the SolidCash SDK to construct a transaction
      const transactionBuilder = new TransactionBuilder({ provider })
        .addInput(contractUtxo, p2pkhInstance.unlock.spend(placeholderPubKey, placeholderSig))
        .addInput(bobUtxos[0], placeholderUnlocker)
        .addOutput({ to: bobAddress, amount: 100_000n });

      // Generate WalletConnect transaction object with custom 'broadcast' and 'userPrompt' options
      const wcTransactionObj = transactionBuilder.generateWcTransactionObject({
        broadcast: true,
        userPrompt: 'Example Contract transaction',
      });

      const expectedResult = generateWcTransactionObjectFixture;
      expect(JSON.parse(stringify(wcTransactionObj))).toEqual(expectedResult);
    });
  });

  it('should not fail when validly spending from only P2PKH inputs', async () => {
    const aliceUtxos = (await provider.getUtxos(aliceAddress)).filter(isNonTokenUtxo);
    const sigTemplate = new SignatureTemplate(alicePriv);

    // shared regtest node may have extra UTXOs at the reused fixture address; need at least 2
    expect(aliceUtxos.length).toBeGreaterThanOrEqual(2);

    const change = aliceUtxos[0].satoshis + aliceUtxos[1].satoshis - 1000n;

    const transaction = new TransactionBuilder({ provider })
      .addInput(aliceUtxos[0], sigTemplate.unlockP2PKH())
      .addInput(aliceUtxos[1], sigTemplate.unlockP2PKH())
      .addOutput({ to: aliceAddress, amount: change });

    // X195: this establishes only that the send did not REJECT. The `not.toThrow()` clause is a measured
    // no-op (the resolved TransactionDetails is not a function), so `.resolves` carries the whole claim.
    await expect(transaction.send()).resolves.not.toThrow();
  });

  // TODO: Currently, P2PKH inputs are not evaluated at all
  it.skip('should fail when invalidly spending from only P2PKH inputs', async () => {
    const aliceUtxos = (await provider.getUtxos(aliceAddress)).filter(isNonTokenUtxo);
    const incorrectSigTemplate = new SignatureTemplate(bobPriv);

    expect(aliceUtxos.length).toBeGreaterThan(2);

    const change = aliceUtxos[0].satoshis + aliceUtxos[1].satoshis - 1000n;

    const transaction = new TransactionBuilder({ provider })
      .addInput(aliceUtxos[0], incorrectSigTemplate.unlockP2PKH())
      .addInput(aliceUtxos[1], incorrectSigTemplate.unlockP2PKH())
      .addOutput({ to: aliceAddress, amount: change });

    await expect(transaction.send()).rejects.toThrow();
  });

  // TODO: Currently, P2PKH inputs are not evaluated at all
  it.skip('should fail when invalidly spending from P2PKH and correctly from contract inputs', async () => {
    const aliceUtxos = (await provider.getUtxos(aliceAddress)).filter(isNonTokenUtxo);
    const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();
    const incorrectSigTemplate = new SignatureTemplate(bobPriv);

    expect(aliceUtxos.length).toBeGreaterThan(2);

    const change = aliceUtxos[0].satoshis + aliceUtxos[1].satoshis - 1000n;

    const transaction = new TransactionBuilder({ provider })
      .addInput(aliceUtxos[0], incorrectSigTemplate.unlockP2PKH())
      .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
      .addOutput({ to: aliceAddress, amount: change });

    await expect(transaction.send()).rejects.toThrow();
  });
});
