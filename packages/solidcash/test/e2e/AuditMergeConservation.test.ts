import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider } from '../test-util.js';

import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * MERGE-1 (docs/security/security-audit-2026-10-16.md): the merge covenant verified the survivors' category, locking
 * bytecode and commitment, and each tail's own fungible amount against the survivor, but never that the survivor
 * received the consumed masters' satoshis or surplus fungible amount. A merge could recreate the survivor at its
 * own value and send the consumed masters' value/FT anywhere (including the caller's change output).
 *
 * The fix sums those amounts over the consumed tail and pins the total to the survivor output on both the direct
 * covenant and the message-bus mode-2 lifecycle. This test builds a genuine merge through `StatefulContract.merge`
 * (captured before broadcast), asserts the survivor carries the summed totals, then rewrites the captured
 * transaction to redirect the value and the surplus FT and submits both rewrites.
 */
const SOURCE = `contract MergeAudit(pubkey admin) {
    bigint counter;

    function fork(bigint n, sig s) split(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }

    function consolidate(bigint n, sig s) merge(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type DecodedTransaction = ReturnType<typeof decodeTransactionUnsafe>;

/** Capture the exact bytes the SDK broadcasts instead of settling them, then restore the provider. */
async function capture(provider: Provider, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  expect(captured).toBe('');
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return captured;
}

/** Re-decode a copy so a rewrite cannot mutate the honest transaction the assertions inspect. */
function replayOf(hex: string): DecodedTransaction {
  return decodeTransactionUnsafe(hexToBin(hex)) as DecodedTransaction;
}

describe('MERGE-1: a merge pins consumed masters\' value and fungible amount to the survivor', () => {
  it('conserves the totals on an honest merge and refuses value/FT redirects', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const signer = new SignatureTemplate(alicePriv);

    const deployFunding: Utxo = { txid: 'a1'.repeat(32), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(artifact, [alicePub], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, signer),
      initialState: { counter: 0n },
      changeAddress: p2pkh.address,
    });
    const contract = deployed.contract;
    const categoryId = deployed.categoryId;

    const splitFunding: Utxo = { txid: 'a2'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, splitFunding);
    await StatefulContract.split({
      provider,
      contract,
      splitFunctionName: 'fork',
      splitFunctionArgs: [2n, signer],
      funder: p2pkh.unlock.spend(alicePub, signer),
      fundingUtxos: [splitFunding],
      changeAddress: p2pkh.address,
      newMintingAmount: 1200n,
    });

    // Two consumed masters carrying a surplus fungible amount of the contract's own category. They are ordinary
    // UTXOs at the contract address, so the covenant's consumed-master path accepts them and the merge must bring
    // their FT to the survivor.
    const ftMasters: Utxo[] = [
      {
        txid: 'b1'.repeat(32), vout: 0, satoshis: 1200n,
        token: { category: categoryId, amount: 100n, nft: { capability: 'minting', commitment: '' } },
      },
      {
        txid: 'b2'.repeat(32), vout: 1, satoshis: 1200n,
        token: { category: categoryId, amount: 250n, nft: { capability: 'minting', commitment: '' } },
      },
    ];
    for (const utxo of ftMasters) await provider.addUtxo(contract.inner.tokenAddress, utxo);

    const funding: Utxo = { txid: 'c1'.repeat(32), vout: 0, satoshis: 50_000n };
    await provider.addUtxo(p2pkh.address, funding);

    // Record the candidate survivor masters before the merge settles so the expected totals come from real UTXOs.
    const mintingBefore = (await provider.getUtxos(contract.inner.tokenAddress)).filter(
      (utxo) => utxo.token?.category === categoryId && utxo.token?.nft?.capability === 'minting',
    );
    const outpoint = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}`;
    const consumedOutpoints = new Set(ftMasters.map(outpoint));
    const survivorCandidates = mintingBefore.filter((utxo) => !consumedOutpoints.has(outpoint(utxo)));
    expect(survivorCandidates.length).toBe(3);

    const mergeOptions = {
      provider,
      contract,
      mergeFunctionName: 'consolidate',
      mergeFunctionArgs: [2n, signer],
      funder: p2pkh.unlock.spend(alicePub, signer),
      consumedMasterUtxos: ftMasters,
      fundingUtxos: [funding],
      changeAddress: p2pkh.address,
    };

    const honestHex = await capture(provider, () => StatefulContract.merge({ ...mergeOptions }));
    const honest = replayOf(honestHex);

    // Layout: [survivor, consumed_1, consumed_2, funding] -> [survivor, change].
    expect(honest.inputs.length).toBe(4);
    expect(honest.outputs.length).toBe(2);

    const byOutpoint = new Map(mintingBefore.map((utxo) => [outpoint(utxo), utxo]));
    const satoshisOf = (inputIndex: number): bigint => {
      const input = honest.inputs[inputIndex]!;
      const utxo = byOutpoint.get(`${binToHex(input.outpointTransactionHash)}:${Number(input.outpointIndex)}`);
      expect(utxo).toBeDefined();
      return utxo!.satoshis;
    };
    const ftOf = (inputIndex: number): bigint => {
      const input = honest.inputs[inputIndex]!;
      const utxo = byOutpoint.get(`${binToHex(input.outpointTransactionHash)}:${Number(input.outpointIndex)}`);
      return utxo!.token?.amount ?? 0n;
    };
    const mergeInputs = [0, 1, 2];
    const expectedValue = mergeInputs.reduce((sum, index) => sum + satoshisOf(index), 0n);
    const expectedFt = mergeInputs.reduce((sum, index) => sum + ftOf(index), 0n);
    expect(expectedFt).toBe(350n);

    // Honest conservation: the survivor carries its own value/FT plus the consumed masters'.
    expect(honest.outputs[0]!.valueSatoshis).toBe(expectedValue);
    expect(honest.outputs[0]!.token?.amount).toBe(expectedFt);
    expect(honest.outputs[1]!.token).toBeUndefined();

    // Redirect 1: the survivor keeps only its own satoshis; the consumed masters' satoshis move to change.
    const valueRedirect = replayOf(honestHex);
    const ownValue = satoshisOf(0);
    const valueSurplus = valueRedirect.outputs[0]!.valueSatoshis - ownValue;
    expect(valueSurplus).toBeGreaterThan(0n);
    valueRedirect.outputs[0]!.valueSatoshis = ownValue;
    valueRedirect.outputs[1]!.valueSatoshis += valueSurplus;
    const valueOutcome = await provider.sendRawTransaction(binToHex(encodeTransaction(valueRedirect)))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(valueOutcome).toContain('mandatory-script-verify-flag-failed');
    expect(valueOutcome).toContain('input index 0');

    // Redirect 2: the survivor keeps only its own FT; the surplus FT moves to the change output.
    const ftRedirect = replayOf(honestHex);
    const ownFt = ftOf(0);
    const ftSurplus = ftRedirect.outputs[0]!.token!.amount - ownFt;
    expect(ftSurplus).toBe(350n - ownFt);
    ftRedirect.outputs[0]!.token!.amount = ownFt;
    ftRedirect.outputs[1]!.token = {
      category: hexToBin(categoryId),
      amount: ftSurplus,
    };
    // The token prefix makes the transaction a few bytes larger; keep it above the 1 sat/byte relay floor so
    // the covenant, not the mempool, is what refuses this redirect.
    ftRedirect.outputs[1]!.valueSatoshis -= 2_000n;
    const ftOutcome = await provider.sendRawTransaction(binToHex(encodeTransaction(ftRedirect)))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(ftOutcome).toContain('mandatory-script-verify-flag-failed');
    expect(ftOutcome).toContain('input index 0');

    // The untouched merge settles, so the pin is not over-tight.
    const honestTxid = await provider.sendRawTransaction(honestHex);
    expect(honestTxid).toMatch(/^[0-9a-f]{64}$/);

    const after = await provider.getUtxos(contract.inner.tokenAddress);
    const survivorOutput = after.find((utxo) => `${utxo.txid}:${utxo.vout}` === `${honestTxid}:0`);
    expect(survivorOutput).toBeDefined();
    expect(survivorOutput!.satoshis).toBe(expectedValue);
    expect(survivorOutput!.token?.amount).toBe(expectedFt);
    for (const consumed of ftMasters) {
      expect(after.some((utxo) => outpoint(utxo) === outpoint(consumed))).toBe(false);
    }
  }, 300_000);
});
