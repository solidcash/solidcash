/**
 * A direct split keeps one block-info oracle coin per master: it co-spends one coin of its reader's oracle, recreates
 * it at its index and mints one copy of it per new master. The split's masters refuse a copy with another commitment
 * and a copy past the n the split adds.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { blockOracleLockingBytecode, blockOracleReadUnlocking } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { SignatureTemplate } from '../../src/index.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import { randomUtxo } from '../../src/utils.js';
import { expectScriptRejection } from '../test-util.js';
import { aliceAddress, alicePriv } from '../fixture/vars.js';

const SOURCE = `contract Clock() {
  function at(int t) { require(block.timestamp == t); }
  function fork(bigint n) split(n) { require(n >= 1); }
}`;

// The split is permissionless and its funding anyone-can-spend, so a tampered transaction meets the masters' covenant
// and no signature.
const PERMISSIONLESS = { allowUnsafeOperations: true } as const;
const OP_TRUE = '51';
const anyoneCanSpend: Unlocker = {
  generateLockingBytecode: (): Uint8Array => hexToBin(OP_TRUE),
  generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
};

type Deployed = Awaited<ReturnType<typeof StatefulContract.deploy>>;
type Transaction = ReturnType<typeof decodeTransactionUnsafe>;

async function deploy(provider: MockNetworkProvider): Promise<Deployed> {
  const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
  return StatefulContract.deploy(compileString(SOURCE, PERMISSIONLESS), [], {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
  });
}

const fund = (provider: MockNetworkProvider): Promise<Utxo> => provider.addUtxo(
  OP_TRUE, randomUtxo({ satoshis: 50_000n }),
);

async function oracleCoins(provider: MockNetworkProvider, categoryId: string): Promise<Utxo[]> {
  const utxos = await provider.getUtxosForLockingBytecode(blockOracleLockingBytecode(hexToBin(categoryId)));
  return utxos.filter((utxo) => utxo.token?.category === categoryId && utxo.token.nft?.capability === 'mutable');
}

const commitments = (coins: readonly Utxo[]): Set<string> => new Set(coins.map((coin) => coin.token!.nft!.commitment));

const broadcast = (provider: MockNetworkProvider, tx: Transaction): Promise<string> => provider
  .sendRawTransaction(binToHex(encodeTransaction(tx))).then(() => 'ACCEPTED').catch((error: Error) => error.message);

/** A split adding two masters, built by the SDK and not sent, with the inputs of its oracle coin and its master. */
async function builtSplit(): Promise<{
  provider: MockNetworkProvider; raw: string; tx: Transaction; copies: number[]; masterInput: number;
}> {
  const provider = new MockNetworkProvider();
  const { contract, categoryId } = await deploy(provider);
  const builder = await contract.call.fork(2n)
    .withSplitFunding([await fund(provider)], anyoneCanSpend, aliceAddress).build();
  const raw = builder.build();
  const tx = decodeTransactionUnsafe(hexToBin(raw));
  const category = hexToBin(categoryId);
  const lock = binToHex(blockOracleLockingBytecode(category));
  const read = binToHex(blockOracleReadUnlocking(category));
  const oracleInput = tx.inputs.findIndex((input) => binToHex(input.unlockingBytecode) === read);
  const masterInput = tx.inputs.findIndex((input, index) => index !== oracleInput && input.unlockingBytecode.length > 0);
  const copies = tx.outputs.flatMap((output, index) => (
    binToHex(output.lockingBytecode) === lock && index !== oracleInput ? [index] : []));
  expect(binToHex(tx.outputs[oracleInput]!.lockingBytecode)).toBe(lock);
  expect(copies).toHaveLength(2);
  return { provider, raw, tx, copies, masterInput };
}

describe('a direct split keeps one block-info oracle coin per master', () => {
  it('splits a reader deployed with one master into three masters and three oracle coins of one commitment', async () => {
    const provider = new MockNetworkProvider();
    const { contract, categoryId } = await deploy(provider);
    const before = await oracleCoins(provider, categoryId);
    expect(before).toHaveLength(1);
    await StatefulContract.split({
      provider, contract, splitFunctionName: 'fork', splitFunctionArgs: [2n],
      funder: anyoneCanSpend, fundingUtxos: [await fund(provider)], changeAddress: aliceAddress,
    });
    const masters = (await provider.getUtxos(contract.inner.tokenAddress)).filter((utxo) => (
      utxo.token?.category === categoryId && utxo.token.nft?.capability === 'minting'));
    expect(masters).toHaveLength(3);
    const after = await oracleCoins(provider, categoryId);
    expect(after).toHaveLength(3);
    expect(commitments(after)).toEqual(commitments(before));
    // The mock keeps the copies current with the coin they copy.
    await provider.mine(1);
    const mined = await oracleCoins(provider, categoryId);
    expect(mined).toHaveLength(3);
    expect(commitments(mined).size).toBe(1);
    expect(commitments(mined)).not.toEqual(commitments(before));
  });

  it('refuses a split whose copy carries another commitment', async () => {
    const { provider, raw, tx, copies, masterInput } = await builtSplit();
    const output = tx.outputs[copies[0]!]!;
    const commitment = output.token!.nft!.commitment.slice();
    commitment[commitment.length - 1] ^= 1;
    tx.outputs[copies[0]!] = { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } } };
    expectScriptRejection(await broadcast(provider, tx), masterInput);
    await expect(provider.sendRawTransaction(raw)).resolves.toBeTypeOf('string');
  });

  it('refuses a split that mints an extra copy', async () => {
    const { provider, tx, copies, masterInput } = await builtSplit();
    const copy = tx.outputs[copies[0]!]!;
    tx.outputs.splice(copies[1]! + 1, 0, { ...copy, token: { ...copy.token!, nft: { ...copy.token!.nft! } } });
    // The change pays for the extra copy and a larger fee, so no relay rule masks the covenant's refusal.
    tx.outputs.at(-1)!.valueSatoshis -= copy.valueSatoshis + 1_000n;
    expectScriptRejection(await broadcast(provider, tx), masterInput);
  });
});
