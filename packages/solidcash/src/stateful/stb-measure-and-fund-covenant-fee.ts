/**
 * phase-boundary extract: STB send-phase extract — measure covenant size and optionally mint a fee funder.
 */

import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { getDustThreshold } from '@mem-cash/validation';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { isP2PKHUnlocker } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';

export interface MeasureAndFundCovenantFeeHost {
  allInputs: UnlockableUtxo[];
  funderUtxos: UnlockableUtxo[];
  funderChangeAddress?: Uint8Array;
  readonly sidecarUtxo?: UnlockableUtxo;
  readonly lateValueChunkOutputs: readonly unknown[];
  readonly checkMinRelayFee: boolean;
  accountingFunderUtxos(): readonly UnlockableUtxo[];
  computeMinFee(size: bigint): bigint;
}

export type MeasureAndFundCovenantFeeResult = {
  neededFee: bigint;
  dustMinimum: bigint;
};

// A mock provider can fund several sends before their UTXOs are consumed by a composed transaction. Their
// outpoints must be distinct just like real funding outputs; reusing one fixed fe:0 outpoint makes that later
// transaction invalid even though each fee funder was individually provisioned.
let mockFeeFunderNonce = 0n;

/**
 * Measure the covenant-only transaction size, estimate fee overhead for one funder + change,
 * and when underfunded register a P2SH32 OP_TRUE dummy funder on mock providers.
 */
export async function measureAndFundCovenantFee(
  host: MeasureAndFundCovenantFeeHost,
  covenantBuilder: TransactionBuilder,
  provider: NetworkProvider,
): Promise<MeasureAndFundCovenantFeeResult> {
  // Build the covenant-only tx to measure its byte size.
  const covenantTx = covenantBuilder.buildLibauthTransaction();
  const covenantSize = BigInt(encodeTransaction(covenantTx).byteLength);

  // Estimate the overhead of adding 1 fee input + 1 change output.
  // Fee input: 32 (txid) + 4 (vout) + 1 (scriptLen varint) + unlockingScript + 4 (sequence)
  // For P2SH32 OP_TRUE: unlocking = 2 bytes -> input overhead = 32+4+1+2+4 = 43
  // For P2PKH sig: unlocking ~ 107 bytes -> input overhead = 32+4+1+107+4 = 148
  // Change output: 8 (value) + 1 (scriptLen varint) + scriptLen
  const accountingFundersAtMeasurement = host.accountingFunderUtxos();
  const funderUnlockSize = accountingFundersAtMeasurement.length > 0
    // A native P2PKH funder (msg.sender / tx.origin sender input) signs over the source outputs, which are not
    // assembled yet at this fee-estimation point, so use the fixed sig+pubkey size (~107 B) instead of signing.
    ? (isP2PKHUnlocker(accountingFundersAtMeasurement[0].unlocker)
      ? 107
      : accountingFundersAtMeasurement[0].unlocker.generateUnlockingBytecode(
        { transaction: covenantTx, sourceOutputs: [], inputIndex: 0 },
      ).length)
    : 2; // P2SH32 OP_TRUE default for mocknet
  const feeInputOverhead = 32 + 4 + 1 + funderUnlockSize + 4;
  const changeLockingSize = host.funderChangeAddress?.length ?? 35; // P2SH32 default
  const changeOutputOverhead = 8 + (changeLockingSize < 253 ? 1 : 3) + changeLockingSize;

  // With late chunks, build() already includes the terminal sidecar recreation (or OP_RETURN anchor). Without
  // late chunks, the sidecar recreation is still appended below and must be included in the estimate.
  const sidecarOutputOverhead = host.sidecarUtxo && host.lateValueChunkOutputs.length === 0 ? 50n : 0n;
  const totalEstimatedSize = covenantSize + BigInt(feeInputOverhead) + BigInt(changeOutputOverhead)
    + sidecarOutputOverhead;
  // The first pass estimates P2PKH signatures before source outputs exist. DER lengths can grow when the final
  // transaction is signed, so reserve a small byte margin rather than creating an exact-dust funder that cannot
  // cover the final one-to-few-byte serialization delta.
  const neededFee = host.computeMinFee(totalEstimatedSize + 32n);

  // Create a fee funder if the covenant transaction doesn't already cover
  // the minimum relay fee. Block-layout funders pass through to outputs
  // (input.satoshis -> output.amount), so any surplus they contribute is
  // incidental. A dedicated fee funder ensures the fee is always covered.
  // P2SH32 OP_TRUE funder; its change output uses the same script, so the dust threshold is exact.
  const DUMMY_LBC = new Uint8Array([
    0xaa, 0x20,
    0x95, 0x3c, 0xcf, 0xa5, 0x96, 0xa6, 0xc6, 0xd3, 0x9e, 0x59, 0x80, 0x19, 0x45, 0x39, 0x12, 0x4f,
    0xdc, 0xff, 0x11, 0x6a, 0x57, 0x14, 0x55, 0xa2, 0x12, 0xba, 0xed, 0x81, 0x1f, 0x58, 0x5e, 0xe0,
    0x87,
  ]);
  const DUMMY_UNLOCK = new Uint8Array([0x01, 0x51]);
  const DUST_MINIMUM = getDustThreshold({ lockingBytecode: DUMMY_LBC });

  // Check whether existing inputs already cover the fee
  const existingInputSats = host.allInputs.reduce((sum, inp) => sum + inp.satoshis, 0n);
  const existingOutputSats = covenantBuilder.outputs.reduce((sum, o) => sum + o.amount, 0n);
  const existingFee = existingInputSats - existingOutputSats;
  const alreadyFunded = existingFee >= neededFee;

  if (!alreadyFunded && host.checkMinRelayFee) {
    // When covenant outputs exceed covenant inputs (e.g. return event outputs
    // adding 800 sats each without corresponding inputs), the funder must cover
    // the deficit in addition to the fee and change dust.
    const outputDeficit = existingFee < 0n ? -existingFee : 0n;
    const funderSats = neededFee + DUST_MINIMUM + outputDeficit; // fee + change + deficit
    if (mockFeeFunderNonce >= 0xffff_ffff_ffff_ffffn) {
      throw new Error('Mock fee-funder outpoint space exhausted');
    }
    mockFeeFunderNonce += 1n;
    const dummyTxid = `${'00'.repeat(23)}fe${mockFeeFunderNonce.toString(16).padStart(16, '0')}`;
    const dummyUtxo = { txid: dummyTxid, vout: 0, satoshis: funderSats };

    // Register with mocknet provider
    if ((provider as any).addUtxo) {
      await (provider as any).addUtxo(binToHex(DUMMY_LBC), dummyUtxo);
      const funder: UnlockableUtxo = {
        ...dummyUtxo,
        unlocker: {
          generateLockingBytecode: () => DUMMY_LBC,
          generateUnlockingBytecode: () => DUMMY_UNLOCK,
        },
      };
      host.funderUtxos.push(funder);
      host.allInputs.push(funder);
      host.funderChangeAddress = DUMMY_LBC;
    }
  }

  return { neededFee, dustMinimum: DUST_MINIMUM };
}
