import { describe, expect, it } from 'vitest';
import { lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { hash256 } from '@solidcash/utils';
import RegtestNetworkProvider from '../../src/network/RegtestNetworkProvider.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { randomUtxo } from '../../src/utils.js';

const enabled = process.env.TESTS_USE_REGTEST === 'true'
  && process.env.BCHN_RELAXED === 'true'
  && typeof process.env.BCHN_STOCK_RPC_URL === 'string';
const describeRelaxed = enabled ? describe : describe.skip;

const RELAXED_LIMITS = {
  maximumInputBytes: 10_000_000,
  maximumStackItemBytes: 10_000_000,
  maximumTransactionBytes: 100_000_000,
  maximumNftCommitmentBytes: 10_000_000,
  operationCostBudgetPerByte: 1_000_000,
  hashDigestIterationsPerByte: 10_000_000,
};

function oversizedRedeemScript(): Uint8Array {
  // OP_TRUE plus 10,000 NOPs. The script, its push, and the resulting stack item are all above the
  // production 10,000-byte script/element limits.
  return Uint8Array.from([0x51, ...new Uint8Array(10_000).fill(0x61)]);
}

async function buildOversizedSpend(provider: RegtestNetworkProvider): Promise<string> {
  const redeem = oversizedRedeemScript();
  const lock = Uint8Array.from([0xaa, 0x20, ...hash256(redeem), 0x87]);
  const addressResult = lockingBytecodeToCashAddress({ bytecode: lock, prefix: 'bchreg' });
  const address = typeof addressResult === 'string' ? addressResult : addressResult.address;

  const utxo = await provider.addUtxo(address, {
    ...randomUtxo({ satoshis: 20_000n }),
    lockingBytecode: lock,
  });
  const unlocker = {
    generateLockingBytecode: (): Uint8Array => lock,
    generateUnlockingBytecode: (): Uint8Array => encodeDataPush(redeem),
  };

  return new TransactionBuilder({ provider })
    .addInput(utxo, unlocker as never)
    .addOutput({ to: lock, amount: utxo.satoshis - 1_000n })
    .build();
}

describeRelaxed('relaxed regtest consensus limits', () => {
  it('accepts a script above the production limit only on the relaxed node', async () => {
    const relaxed = new RegtestNetworkProvider({
      rpcUrl: process.env.REGTEST_RPC_URL ?? 'http://127.0.0.1:18443',
      rpcUser: process.env.REGTEST_RPC_USER ?? 'user',
      rpcPassword: process.env.REGTEST_RPC_PASSWORD ?? 'password',
      consensusLimits: RELAXED_LIMITS,
    });
    const stock = new RegtestNetworkProvider({
      rpcUrl: process.env.BCHN_STOCK_RPC_URL!,
      rpcUser: process.env.REGTEST_RPC_USER ?? 'user',
      rpcPassword: process.env.REGTEST_RPC_PASSWORD ?? 'password',
    });

    const relaxedHex = await buildOversizedSpend(relaxed);
    const stockHex = await buildOversizedSpend(stock);

    await expect(relaxed.sendRawTransaction(relaxedHex)).resolves.toMatch(/^[0-9a-f]{64}$/);

    let stockError = '';
    try {
      await stock.sendRawTransaction(stockHex);
    } catch (error) {
      stockError = String(error);
    }
    expect(stockError).not.toBe('');
    expect(stockError).toMatch(/script|size|push|mandatory/i);
    console.info(`stock node rejection: ${stockError}`);
  }, 180_000);
});
