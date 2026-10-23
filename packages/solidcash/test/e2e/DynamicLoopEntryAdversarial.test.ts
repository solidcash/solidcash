import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '@solidcash/solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import {
  hexToBin, binToHex, decodeTransactionUnsafe, encodeTransaction, hash256,
} from '@bitauth/libauth';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Adversarial soundness: a loop mapping write mints one new entry NFT per iteration at a runtime-counter-indexed
// trailing output. The per-iteration covenant verify (commitment + address + category) plus the output-count pin
// must reject any tampering: wrong commitment, redirected address, or an extra (orphan) entry output. We capture
// the honest fully built raw tx at the provider boundary, then re-submit tampered copies and require rejection.
const SRC = `contract C() {
  mapping(int => int) bal;
  function setAll(int[] ks, int[] vs) {
    for (uint i = 0; i < ks.length; i = i + 1) { bal[ks[i]] = vs[i]; }
  }
}`;

describe('dynamic loop mapping write - adversarial soundness', () => {
  const provider = createTestProvider();

  it('honest tx broadcasts; tampered commitment / address / orphan output are rejected', async () => {
    const art = compileString(SRC);
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);

    // Capture the fully-funded raw tx at the provider boundary without consuming its inputs. The fixture
    // deliberately has no signature guard: post-signature output mutation would otherwise exercise NULLFAIL
    // before the mapping covenant, making the claimed per-iteration assertions unreachable.
    // Hostile variants must execute against live UTXOs; broadcasting the control first would make every
    // later replay pass for the unrelated `bad-txns-inputs-missingorspent` reason.
    let capturedHex = '';
    const origSend = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      capturedHex = hex;
      return binToHex(hash256(hexToBin(hex)).reverse());
    };
    let honestTxid: string;
    try {
      honestTxid = (await sc.setAll([10n, 20n], [111n, 222n]).send()).txid;
    } finally {
      (provider as any).sendRawTransaction = origSend;
    }
    expect(honestTxid).toBeDefined();
    expect(capturedHex).not.toBe('');

    // The honest tx has master output [0] plus two entry outputs [1],[2] at the collection address.
    const honest = decodeTransactionUnsafe(hexToBin(capturedHex));
    expect(honest.outputs.length).toBeGreaterThanOrEqual(3);

    // The covenant refuses these three tampers, but the two backends name the refusal differently: the mock
    // reports OP_VERIFY at input 0, while BCHN reports `Script failed an OP_EQUALVERIFY operation (code 16)`
    // and does not name an input for that form. Require a script-verify refusal either way, and the stronger
    // opcode-and-index form wherever the backend reports one.
    const COVENANT_REFUSAL = new RegExp(
      'mandatory-script-verify-flag-failed(?:'
      + '[\\s\\S]*evaluating input index 0: Program failed an OP_VERIFY operation'
      + '|[\\s\\S]*OP_EQUALVERIFY)',
    );

    const submitTampered = async (mutate: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(capturedHex));
      mutate(tx);
      await origSend(binToHex(encodeTransaction(tx)));
    };

    // (1) Wrong commitment on an entry output -> per-iteration OP_OUTPUTTOKENCOMMITMENT verify rejects.
    await expect(submitTampered((tx) => {
      tx.outputs[1].token!.nft!.commitment = hexToBin('deadbeef');
    })).rejects.toThrow(
      COVENANT_REFUSAL,
    );

    // (2) Redirect an entry output to a p2pkh address -> OP_OUTPUTBYTECODE verify rejects.
    await expect(submitTampered((tx) => {
      tx.outputs[1].lockingBytecode = hexToBin(`76a914${'00'.repeat(20)}88ac`);
    })).rejects.toThrow(
      COVENANT_REFUSAL,
    );

    // (3) Orphan: append a zero-value duplicate entry output so the tx has N+1 entry outputs while the counter
    // is N. Pay for the additional serialized bytes from the non-token change output: otherwise relay-fee policy
    // rejects the larger transaction before input 0 executes, which would not prove the output-count pin.
    await expect(submitTampered((tx) => {
      const originalSize = encodeTransaction(tx).length;
      const orphan = {
        ...tx.outputs[2],
        valueSatoshis: 0n,
        token: { ...tx.outputs[2].token!, nft: { ...tx.outputs[2].token!.nft! } },
      };
      tx.outputs.push(orphan);
      const additionalRelayFee = BigInt(encodeTransaction(tx).length - originalSize);
      const feeOutput = tx.outputs.find((output) => output.token === undefined);
      if (feeOutput === undefined || feeOutput.valueSatoshis < additionalRelayFee) {
        throw new Error(`fixture cannot fund the ${additionalRelayFee}-satoshi orphan-output relay fee`);
      }
      feeOutput.valueSatoshis -= additionalRelayFee;
    })).rejects.toThrow(
      COVENANT_REFUSAL,
    );

    // The same still-unspent inputs settle when no hostile mutation is applied.
    await expect(origSend(capturedHex)).resolves.toBeTypeOf('string');
  });
});
