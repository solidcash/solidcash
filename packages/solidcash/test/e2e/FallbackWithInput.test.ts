import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import {
  alicePkh,
  alicePriv,
  alicePub,
  aliceAddress,
} from '../fixture/vars.js';
import { createTestProvider, getLargestUtxo, getTxOutputs, verifyTransaction } from '../test-util.js';
import { randomUtxo, createUnlockingBytecode, addressToLockScript } from '../../src/utils.js';
import { ContractUnlocker } from '../../src/interfaces.js';

// Contract with fallback(bytes input) - the `input` parameter is equivalent to msg.data
const FALLBACK_WITH_INPUT_SOURCE = `
pragma solidcash ^0.13.0;

contract FallbackWithInput(bytes20 owner) {
    function transfer(pubkey pk, sig s) {
        require(hash160(pk) == owner);
        require(checkSig(s, pk));
    }

    fallback(bytes input) external {
        require(input.length > 0);
    }
}
`;

/**
 * Create an unlocker that pushes a custom selector to the contract.
 * The dispatcher won't recognize it and routes to fallback.
 * msg.data will contain this custom selector bytes.
 */
function createCustomSelectorUnlocker(contract: Contract, selector: Uint8Array): ContractUnlocker {
  const fallbackAbi = contract.artifact.abi.find((f) => f.isFallback)!;
  return {
    generateUnlockingBytecode: () => createUnlockingBytecode(
      contract.addressType, hexToBin(contract.bytecode), [], selector,
    ),
    generateLockingBytecode: () => addressToLockScript(contract.address),
    contract,
    params: [],
    abiFunction: fallbackAbi,
  };
}

describe('FallbackWithInput', () => {
  const artifact = compileString(FALLBACK_WITH_INPUT_SOURCE);
  const provider = createTestProvider();
  const contract = new Contract(artifact, [alicePkh], { provider });

  beforeAll(async () => {
    await provider.addUtxo(contract.address, randomUtxo());
    await provider.addUtxo(contract.address, randomUtxo());
    await provider.addUtxo(contract.address, randomUtxo());
  });

  describe('contract creation', () => {
    it('should create contract with transfer and fallback unlockers', () => {
      expect(typeof contract.address).toBe('string');
      expect(typeof contract.unlock.transfer).toBe('function');
      expect(typeof contract.unlock.fallback).toBe('function');
    });

    it('should have correct ABI entries', () => {
      const abi = contract.artifact.abi;
      expect(abi).toHaveLength(2);

      const transferFn = abi.find((f) => f.name === 'transfer');
      expect(transferFn).toBeDefined();
      expect(transferFn!.inputs).toHaveLength(2);

      const fallbackFn = abi.find((f) => f.name === '__fallback');
      expect(fallbackFn).toBeDefined();
      expect(fallbackFn!.isFallback).toBe(true);
      // The bytes input parameter is synthetic (computed inline), not in ABI inputs
      expect(fallbackFn!.inputs).toHaveLength(0);
    });
  });

  describe('transfer (regular function)', () => {
    it('should succeed with correct args', async () => {
      const contractUtxo = getLargestUtxo(await contract.getUtxos());

      const tx = await new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.transfer(alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to: aliceAddress, amount: 1000n })
        .addOutput({ to: contract.address, amount: contractUtxo.satoshis - 2000n })
        .send();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([{ to: aliceAddress, amount: 1000n }]));
    });
  });

  describe('fallback with input parameter', () => {
    it('should succeed when called via unlock.fallback() - input contains fallback selector', async () => {
      const contractUtxo = getLargestUtxo(await contract.getUtxos());

      // unlock.fallback() pushes the fallback's own selector.
      // msg.data = [fallback_selector] (4 bytes), so input.length > 0 passes.
      const builder = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.fallback())
        .addOutput({ to: aliceAddress, amount: 1000n })
        .addOutput({ to: contract.address, amount: contractUtxo.satoshis - 2000n });

      verifyTransaction(builder);

      const tx = await builder.send();
      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([{ to: aliceAddress, amount: 1000n }]));
    });

    it('should succeed with a custom selector - dispatcher routes unknown selector to fallback', async () => {
      const contractUtxo = getLargestUtxo(await contract.getUtxos());

      // Push an arbitrary 4-byte selector that doesn't match any known function.
      // The dispatcher drops it and routes to fallback. msg.data = [custom_selector].
      const customSelector = hexToBin('deadbeef');
      const builder = new TransactionBuilder({ provider })
        .addInput(contractUtxo, createCustomSelectorUnlocker(contract, customSelector))
        .addOutput({ to: aliceAddress, amount: 1000n })
        .addOutput({ to: contract.address, amount: contractUtxo.satoshis - 2000n });

      verifyTransaction(builder);

      const tx = await builder.send();
      expect(tx.txid).toBeDefined();
    });

    it('should verify that different custom selectors all route to fallback', async () => {
      const contractUtxo = getLargestUtxo(await contract.getUtxos());

      // Any 4-byte selector that doesn't match 'transfer' or '__fallback'
      // will be routed to fallback by the dispatcher. Verify with a second
      // distinct selector to prove this works generically.
      const anotherSelector = hexToBin('12345678');
      const builder = new TransactionBuilder({ provider })
        .addInput(contractUtxo, createCustomSelectorUnlocker(contract, anotherSelector))
        .addOutput({ to: aliceAddress, amount: 1000n })
        .addOutput({ to: contract.address, amount: contractUtxo.satoshis - 2000n });

      verifyTransaction(builder);

      const tx = await builder.send();
      expect(tx.txid).toBeDefined();
    });
  });
});
