import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate,
  TransactionBuilder, FailedRequireError,
} from '../../src/index.js';
import {
  alicePriv, alicePub,
} from '../fixture/vars.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
import { randomUtxo } from '../../src/utils.js';

// Recursive free and internal functions
const RECURSION_CONTRACT = `
function factorial(int n) returns (int) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

contract Recursion(pubkey owner) {
    function countdown(int n) internal returns (int) {
        if (n <= 0) {
            return 0;
        }
        return 1 + countdown(n - 1);
    }

    function testFactorial(sig s, int n, int expected) {
        require(checkSig(s, owner));
        require(factorial(n) == expected);
    }

    function testCountdown(sig s, int n, int expected) {
        require(checkSig(s, owner));
        require(countdown(n) == expected);
    }
}
`;

// Unbounded loops with runtime-determined iteration count
const UNBOUNDED_LOOP_CONTRACT = `
contract UnboundedLoop(pubkey owner) {
    function fibonacci(sig s, int n, int expected) {
        require(checkSig(s, owner));
        int a = 0;
        int b = 1;
        int i = 0;
        do {
            int temp = b;
            b = a + b;
            a = temp;
            i = i + 1;
        } while (i < n);
        require(a == expected);
    }

    function sumTo(sig s, int n, int expected) {
        require(checkSig(s, owner));
        int total = 0;
        for (int i = 1; i <= n; i = i + 1) {
            total = total + i;
        }
        require(total == expected);
    }
}
`;

describe('Recursion', () => {
  const provider = createTestProvider();
  const artifact = compileString(RECURSION_CONTRACT);
  const contract = new Contract(artifact, [alicePub], { provider });

  beforeAll(async () => {
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000000n }));
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000000n }));
  });

  describe('factorial (recursive free function)', () => {
    it('should compute factorial(1) == 1', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.testFactorial(new SignatureTemplate(alicePriv), 1n, 1n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should compute factorial(5) == 120', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.testFactorial(new SignatureTemplate(alicePriv), 5n, 120n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should fail with wrong expected value for factorial', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.testFactorial(new SignatureTemplate(alicePriv), 5n, 119n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('countdown (recursive internal function)', () => {
    it('should compute countdown(10) == 10', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.testCountdown(new SignatureTemplate(alicePriv), 10n, 10n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should compute countdown(0) == 0', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.testCountdown(new SignatureTemplate(alicePriv), 0n, 0n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });
  });
});

describe('UnboundedLoop', () => {
  const provider = createTestProvider();
  const artifact = compileString(UNBOUNDED_LOOP_CONTRACT);
  const contract = new Contract(artifact, [alicePub], { provider });

  beforeAll(async () => {
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000000n }));
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000000n }));
  });

  describe('fibonacci (do-while loop)', () => {
    it('should compute fibonacci(10) == 55', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.fibonacci(new SignatureTemplate(alicePriv), 10n, 55n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should compute fibonacci(20) == 6765', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.fibonacci(new SignatureTemplate(alicePriv), 20n, 6765n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  describe('sumTo (for loop)', () => {
    it('should compute sumTo(50) == 1275', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.sumTo(new SignatureTemplate(alicePriv), 50n, 1275n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should fail with wrong expected sum', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.sumTo(new SignatureTemplate(alicePriv), 50n, 1200n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });
});

describe('Dynamic Dispatch', () => {
  describe('multi-function dispatch with OP_INVOKE', () => {
    it('should correctly dispatch to each entry-point function', async () => {
      const provider = createTestProvider();
      const artifact = compileString(UNBOUNDED_LOOP_CONTRACT);
      const contract = new Contract(artifact, [alicePub], { provider });

      // Verify the artifact has multiple ABI functions (i.e., uses the OP_INVOKE dispatcher)
      expect(artifact.abi.length).toBe(2);

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000000n }));

      // Call first function (fibonacci, selector=0)
      const to = contract.address;
      const amount = 1000n;
      const { utxos: utxos1, changeAmount: change1 } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx1 = await new TransactionBuilder({ provider })
        .addInputs(utxos1, contract.unlock.fibonacci(new SignatureTemplate(alicePriv), 10n, 55n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: change1 })
        .send();
      expect(tx1.txid).toBeDefined();

      // Call second function (sumTo, selector=1)
      const { utxos: utxos2, changeAmount: change2 } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx2 = await new TransactionBuilder({ provider })
        .addInputs(utxos2, contract.unlock.sumTo(new SignatureTemplate(alicePriv), 10n, 55n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: change2 })
        .send();
      expect(tx2.txid).toBeDefined();
    });
  });

  describe('multi-function error reporting', () => {
    it('should provide correct error messages for multi-function contracts', async () => {
      const provider = createTestProvider();
      const artifact = compileString(RECURSION_CONTRACT);
      const contract = new Contract(artifact, [alicePub], { provider });

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000000n }));

      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.testFactorial(new SignatureTemplate(alicePriv), 5n, 999n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      // Should throw FailedRequireError with source info
      await expect(txPromise).rejects.toThrow(FailedRequireError);
      await expect(txPromise).rejects.toThrow('require(factorial(n) == expected)');
    });
  });
});
