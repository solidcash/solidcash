import { describe, it, expect } from 'vitest';
import { AuthenticationErrorBch2025Additions } from '@bitauth/libauth';
import type { ElectrumClient, ElectrumClientEvents } from '@electrum-cash/network';
import {
  Contract,
  FailedRequireError,
  FailedTransactionEvaluationError,
  HashType,
  Network,
  OutputTokenCommitmentTooLongError,
  SighashType,
  SignatureAlgorithm,
  SignatureTemplate,
  TransactionBuilder,
  TransactionFeeTooHighError,
  TransactionInputsRequiredError,
  TransactionOutputsRequiredError,
  UnlockerLockingBytecodeMismatchError,
} from '../src/index.js';
import { MockNetworkProvider } from '../src/network/mock/index.js';
import ElectrumNetworkProvider from '../src/network/ElectrumNetworkProvider.js';
import { encodeFunctionArgument } from '../src/Argument.js';
import { addressToLockScript, randomUtxo } from '../src/utils.js';
import { placeholderP2PKHUnlocker } from '../src/walletconnect-utils.js';
import { aliceAddress, alicePriv, alicePub, aliceTokenAddress, bobAddress } from './fixture/vars.js';
import { compileString } from './direct-compile.js';

// Behaviour ported from CashScript 0.14.0.

const alice = new SignatureTemplate(alicePriv);

const p2pkhTransaction = (provider: MockNetworkProvider): TransactionBuilder => new TransactionBuilder({ provider })
  .addInput(randomUtxo({ satoshis: 10_000n }), alice.unlockP2PKH())
  .addOutput({ to: bobAddress, amount: 9_000n });

const lineOf = (source: string, text: string): number => source.split('\n').findIndex((line) => line.includes(text)) + 1;

describe('TransactionBuilder', () => {
  const provider = new MockNetworkProvider();

  it('calculateTransactionFee reports the fee and the fee per byte at the reported size', () => {
    const transaction = p2pkhTransaction(provider);
    const size = transaction.getTransactionSize();

    expect(transaction.calculateTransactionFee()).toEqual({
      feeSats: 1_000n,
      feeSatsPerByte: Number((1000 / Number(size)).toFixed(2)),
    });
  });

  it('counts a placeholder P2PKH input at its signed size', () => {
    const utxo = randomUtxo();
    const output = { to: bobAddress, amount: 1_000n };
    const signed = new TransactionBuilder({ provider }).addInput(utxo, alice.unlockP2PKH()).addOutput(output);
    const placeholder = new TransactionBuilder({ provider })
      .addInput(utxo, placeholderP2PKHUnlocker(aliceAddress)).addOutput(output);

    expect(placeholder.getTransactionSize()).toBe(signed.getTransactionSize());
  });

  it('setLocktime only accepts an unsigned 32-bit integer', () => {
    const transaction = new TransactionBuilder({ provider });
    for (const invalid of [-1, 1.5, 0x1_0000_0000, Number.NaN]) {
      expect(() => transaction.setLocktime(invalid)).toThrow('should be an integer between 0 and 4294967295');
    }
    expect(transaction.setLocktime(0).locktime).toBe(0);
    expect(transaction.setLocktime(0xffffffff).locktime).toBe(0xffffffff);
  });

  it('refuses a transaction without inputs or outputs with typed errors', () => {
    expect(() => new TransactionBuilder({ provider }).addOutput({ to: bobAddress, amount: 1_000n }).build())
      .toThrow(TransactionInputsRequiredError);
    expect(() => new TransactionBuilder({ provider }).addInput(randomUtxo(), alice.unlockP2PKH()).build())
      .toThrow(TransactionOutputsRequiredError);
  });

  it('refuses a fee over maximumFeeSatoshis with a typed error', () => {
    const transaction = new TransactionBuilder({ provider, maximumFeeSatoshis: 999n })
      .addInput(randomUtxo({ satoshis: 10_000n }), alice.unlockP2PKH())
      .addOutput({ to: bobAddress, amount: 9_000n });

    expect(() => transaction.build()).toThrow(TransactionFeeTooHighError);
    expect(() => transaction.build()).toThrow('Transaction fee of 1000 is higher than max fee of 999');
  });

  it('refuses an NFT commitment longer than the provider allows', () => {
    const limited = new MockNetworkProvider({ consensusLimits: { maximumNftCommitmentBytes: 128 } });
    const output = (bytes: number): Parameters<TransactionBuilder['addOutput']>[0] => ({
      to: aliceTokenAddress,
      amount: 2_000n,
      token: { category: 'ab'.repeat(31) + '54', amount: 0n, nft: { capability: 'none', commitment: 'cd'.repeat(bytes) } },
    });

    expect(() => new TransactionBuilder({ provider: limited }).addOutput(output(128))).not.toThrow();
    expect(() => new TransactionBuilder({ provider: limited }).addOutput(output(129)))
      .toThrow(OutputTokenCommitmentTooLongError);
    // The default mock publishes a relaxed commitment limit
    expect(() => new TransactionBuilder({ provider }).addOutput(output(129))).not.toThrow();
  });

  it('refuses an input whose stated locking bytecode is not the one its unlocker spends', () => {
    const build = (lockingBytecode: Uint8Array): string => new TransactionBuilder({ provider })
      .addInput(randomUtxo({ lockingBytecode }), alice.unlockP2PKH())
      .addOutput({ to: bobAddress, amount: 1_000n })
      .build();

    expect(() => build(addressToLockScript(bobAddress))).toThrow(UnlockerLockingBytecodeMismatchError);
    expect(() => build(addressToLockScript(bobAddress))).toThrow(`Input #0 is locked by address ${bobAddress}`);
    expect(() => build(addressToLockScript(aliceAddress))).not.toThrow();
  });
});

describe('function arguments', () => {
  it('refuses a hex string argument that is not valid hex', () => {
    expect(() => encodeFunctionArgument('0x123', 'bytes')).toThrow('should be a valid hex string');
    expect(() => encodeFunctionArgument('zz', 'bytes2')).toThrow('should be a valid hex string');
    expect(encodeFunctionArgument('0x1234', 'bytes2')).toEqual(Uint8Array.from([0x12, 0x34]));
  });

  it('refuses a pubkey that is not 33 or 65 bytes', () => {
    expect(() => encodeFunctionArgument(new Uint8Array(20), 'pubkey')).toThrow("Found type 'bytes20'");
    expect(encodeFunctionArgument(alicePub, 'pubkey')).toEqual(alicePub);
  });
});

describe('SignatureTemplate', () => {
  it('exposes its sighash type, algorithm and public key as properties, with the old getters as aliases', () => {
    const template = new SignatureTemplate(alicePriv, SighashType.SIGHASH_ALL, SignatureAlgorithm.ECDSA);

    expect(template.sighashType).toBe(SighashType.SIGHASH_ALL);
    expect(template.signatureAlgorithm).toBe(SignatureAlgorithm.ECDSA);
    expect(template.publicKey).toEqual(alicePub);
    expect(template.getHashType()).toBe(SighashType.SIGHASH_ALL | 0x40);
    expect(template.getHashType(false)).toBe(SighashType.SIGHASH_ALL);
    expect(template.getSignatureAlgorithm()).toBe(SignatureAlgorithm.ECDSA);
    expect(template.getPublicKey()).toEqual(alicePub);
    expect(HashType.SIGHASH_UTXOS).toBe(SighashType.SIGHASH_UTXOS);
  });

  it('always appends the fork id flag to the sighash type of a signature', () => {
    const signature = alice.generateSignature(new Uint8Array(32).fill(7));
    expect(signature.at(-1)).toBe(SighashType.SIGHASH_ALL | SighashType.SIGHASH_UTXOS | 0x40);
  });
});

describe('network providers', () => {
  it('accepts a resubmitted transaction without an error', async () => {
    const provider = new MockNetworkProvider();
    const utxo = randomUtxo({ satoshis: 10_000n });
    await provider.addUtxo(aliceAddress, utxo);
    const hex = new TransactionBuilder({ provider })
      .addInput(utxo, alice.unlockP2PKH())
      .addOutput({ to: bobAddress, amount: 9_000n })
      .build();

    const first = await provider.sendRawTransaction(hex);
    await expect(provider.sendRawTransaction(hex)).resolves.toBe(first);
  });

  it('the mock spends a UTXO that was added with an uppercase txid', async () => {
    const provider = new MockNetworkProvider();
    const utxo = randomUtxo({ satoshis: 10_000n });
    const uppercase = { ...utxo, txid: utxo.txid.toUpperCase() };
    await provider.addUtxo(aliceAddress, uppercase);

    const transaction = new TransactionBuilder({ provider })
      .addInput(uppercase, alice.unlockP2PKH())
      .addOutput({ to: bobAddress, amount: 9_000n });

    await expect(transaction.send()).resolves.toBeDefined();
  });

  it('the Electrum provider reads the block height with headers.get_tip, not a subscription', async () => {
    const requests: string[] = [];
    const electrum = {
      connect: async (): Promise<void> => undefined,
      disconnect: async (): Promise<boolean> => true,
      request: async (name: string): Promise<unknown> => {
        requests.push(name);
        return { height: 1234, hex: '' };
      },
    } as unknown as ElectrumClient<ElectrumClientEvents>;
    const provider = new ElectrumNetworkProvider(Network.CHIPNET, { electrum });

    expect(await provider.getBlockHeight()).toBe(1234);
    expect(requests).toEqual(['blockchain.headers.get_tip']);
  });
});

describe('debugging', () => {
  const provider = new MockNetworkProvider();

  const NESTED_SOURCE = `
contract Nested {
    function assertPositive(int value) private pure {
        require(value > 0, "value must be positive");
    }

    function validate(int amount) private pure {
        assertPositive(amount);
    }

    function spend(int x) public {
        validate(x);
        require(tx.outputs.length == 1);
    }

    function other(int y) public {
        require(y == 2);
    }
}`;

  it('lists the call stack of a require that fails in a nested function call', async () => {
    const contract = new Contract(compileString(NESTED_SOURCE), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    const transaction = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.spend(0n))
      .addOutput({ to: contract.address, amount: 10_000n });

    const failure = (() => {
      try { transaction.debug(); } catch (error) { return error; }
      return undefined;
    })();
    expect(failure).toBeInstanceOf(FailedRequireError);
    const { message } = failure as FailedRequireError;
    expect(message).toContain('with the following message: value must be positive');
    expect(message).toContain(`  at assertPositive (Nested.scash:${lineOf(NESTED_SOURCE, 'require(value > 0')}) - `);
    expect(message).toContain(
      `  at validate (Nested.scash:${lineOf(NESTED_SOURCE, 'assertPositive(amount);')}) - assertPositive(amount)`,
    );
    expect(message).toContain(`  at Nested.scash:${lineOf(NESTED_SOURCE, 'validate(x);')} - validate(x)`);
  });

  it('attributes a failing final require of a plain variable to that require', async () => {
    const source = `
contract Test() {
  function test_final_require_variable(int x) {
    bool isLarge = x > 5;
    require(isLarge);
  }
}`;
    const contract = new Contract(compileString(source), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    const transaction = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.test_final_require_variable(1n))
      .addOutput({ to: contract.address, amount: 1_000n });

    expect(transaction).toFailRequireWith('Test.scash:5 Require statement failed at input 0 in contract Test.scash at line 5.');
    expect(transaction).toFailRequireWith('Failing statement: require(isLarge)');
  });

  // An operation cost overrun can stop evaluation on any instruction: the one a require statement ends in, or one in
  // a skipped branch, which still costs operations
  it('reports an operation cost overrun as such, never as a failed require statement', async () => {
    const source = `
contract Test() {
  function spend(int rounds, bytes padding) {
    bytes32 digest = sha256(0x00);
    for (int i = 0; i < rounds; i = i + 1) {
      digest = sha256(digest);
    }
    require(tx.outputs[0].lockingBytecode == tx.inputs[0].lockingBytecode, "Output 0 must pay back to the contract");
    require(tx.outputs[0].value >= 1000, "Output 0 must keep 1000 sats");
  }
}`;
    const artifact = compileString(source);
    const contract = new Contract(artifact, [], { provider });
    const requireIps = artifact.debug!.requires.map((statement) => statement.ip);
    const attempt = async (rounds: bigint, padding: number): Promise<unknown> => {
      const utxo = randomUtxo();
      await provider.addUtxo(contract.address, utxo);
      const transaction = new TransactionBuilder({ provider })
        .addInput(utxo, contract.unlock.spend(rounds, new Uint8Array(padding)))
        .addOutput({ to: contract.address, amount: 1_000n });
      try {
        transaction.debug();
        return undefined;
      } catch (error) {
        return error;
      }
    };

    // The first round count that overruns without padding; the rounds spend most of the budget and the padding sets
    // how large it is, so scanning both moves the point where it runs out across the instructions after the loop
    let firstOverrun = 1n;
    while (await attempt(firstOverrun, 0) === undefined) firstOverrun *= 2n;
    let overrunsOnRequires = 0;
    for (let rounds = firstOverrun; rounds < firstOverrun + 9n; rounds++) {
      for (let padding = 0; ; padding++) {
        const failure = await attempt(rounds, padding);
        if (failure === undefined) break;

        // The require conditions all hold, so every failure is the overrun
        expect(failure).toBeInstanceOf(FailedTransactionEvaluationError);
        expect(failure).not.toBeInstanceOf(FailedRequireError);
        const { libauthErrorMessage, failingInstructionPointer } = failure as FailedTransactionEvaluationError;
        expect(libauthErrorMessage).toContain(AuthenticationErrorBch2025Additions.excessiveOperationCost);
        if (requireIps.includes(failingInstructionPointer)) overrunsOnRequires++;
      }
    }

    // The scan has to reach the case the fix is about: the budget running out on a require statement's own instruction
    expect(overrunsOnRequires).toBeGreaterThan(0);
  });
});

describe('compiled contracts', () => {
  // A for-loop init that reassigns an existing variable has to leave its final value in that variable
  it('keeps the value a for-loop init reassigns after the loop', async () => {
    const source = `
contract ForLoopReassignedInit() {
    function spend(int n) {
        int i = 0;
        for (i = 0; i < n; i++) {
            require(tx.outputs[i].value >= 1000);
        }
        require(i == tx.outputs.length);
    }
}`;
    const provider = new MockNetworkProvider();
    const contract = new Contract(compileString(source), [], { provider });
    const transaction = async (n: bigint): Promise<TransactionBuilder> => {
      const utxo = randomUtxo();
      await provider.addUtxo(contract.address, utxo);
      return new TransactionBuilder({ provider })
        .addInput(utxo, contract.unlock.spend(n))
        .addOutput({ to: contract.address, amount: 1_000n })
        .addOutput({ to: contract.address, amount: 1_000n });
    };

    const loopsOverEveryOutput = await transaction(2n);
    expect(() => loopsOverEveryOutput.debug()).not.toThrow();
    const stopsShort = await transaction(1n);
    expect(stopsShort).toFailRequireWith(`ForLoopReassignedInit.scash:${lineOf(source, 'require(i ==')}`);
  });
});
