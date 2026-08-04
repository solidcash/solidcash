import {
  Contract,
  SignatureTemplate,
  FailedRequireError,
  TransactionBuilder,
} from '../../src/index.js';
import {
  alicePriv,
  alicePub,
} from '../fixture/vars.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
import { randomUtxo } from '../../src/utils.js';
import { computeFunctionSignature, computeFunctionSelector } from '@solidcash/utils';
import artifact from '../fixture/type_introspection.artifact.js';

describe('TypeIntrospection', () => {
  const provider = createTestProvider();

  const contract = new Contract(artifact, [], { provider });

  beforeAll(async () => {
    console.log(contract.address);
    await provider.addUtxo(contract.address, randomUtxo());
  });

  const expectSuccessfulSend = async (txPromise: ReturnType<TransactionBuilder['send']>): Promise<void> => {
    const sent = await txPromise;
    expect(sent.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(sent.hex).not.toHaveLength(0);
  };

  describe('checkIntBounds', () => {
    it('should succeed when value is within int8 range', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkIntBounds(0n, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expectSuccessfulSend(txPromise);
    });

    it('should succeed at int8 boundary values (-128 and 127)', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkIntBounds(-128n, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expectSuccessfulSend(txPromise);
    });

    it('should fail when value is below int8 min (-129)', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkIntBounds(-129n, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail when value exceeds int8 max (128)', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkIntBounds(128n, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('checkUintBounds', () => {
    it('should succeed when value is within uint8 range', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkUintBounds(100n, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expectSuccessfulSend(txPromise);
    });

    it('should fail when value is negative (below uint8 min)', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkUintBounds(-1n, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('checkEnumBounds', () => {
    it('should succeed when value is within enum range (0-2)', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkEnumBounds(1n, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expectSuccessfulSend(txPromise);
    });

    it('should fail when value exceeds enum range', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkEnumBounds(3n, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('checkInterfaceId', () => {
    it('should succeed when providing the correct interfaceId', async () => {
      // Compute expected interfaceId: XOR of all function selectors
      const mintSig = computeFunctionSignature('mint', ['int']);
      const burnSig = computeFunctionSignature('burn', ['int']);
      const mintSelector = computeFunctionSelector(mintSig);
      const burnSelector = computeFunctionSelector(burnSig);
      const expectedId = new Uint8Array(4);
      for (let i = 0; i < 4; i++) {
        expectedId[i] = mintSelector[i] ^ burnSelector[i];
      }

      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkInterfaceId(expectedId, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expectSuccessfulSend(txPromise);
    });

    it('should fail when providing incorrect interfaceId', async () => {
      const wrongId = new Uint8Array([0x00, 0x00, 0x00, 0x00]);

      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkInterfaceId(wrongId, alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('checkContractName', () => {
    it('should succeed when providing the correct contract name', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkContractName('TypeIntrospection', alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expectSuccessfulSend(txPromise);
    });

    it('should fail when providing incorrect contract name', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.checkContractName('WrongName', alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });
});
