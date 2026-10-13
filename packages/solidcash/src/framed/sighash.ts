import { isP2PKHUnlocker, SighashType, type Unlocker } from '../interfaces.js';
import SignatureTemplate from '../SignatureTemplate.js';

/**
 * A framed spend signs the caller's coin with SIGHASH_ALL or SIGHASH_ALL|SIGHASH_UTXOS.
 * NONE, SINGLE, and ANYONECANPAY leave a signature that can be replayed onto other outputs.
 */
export function requireFramedFunderSighash(funder: Unlocker | SignatureTemplate): void {
  const hashType = funder instanceof SignatureTemplate
    ? funder.sighashType
    : isP2PKHUnlocker(funder) ? funder.template.sighashType : undefined;
  if (hashType === undefined) return;
  const anyoneCanPay = (hashType & SighashType.SIGHASH_ANYONECANPAY) !== 0;
  const base = hashType & 0x1f;
  if (base !== SighashType.SIGHASH_ALL || anyoneCanPay) {
    throw new Error(
      `a framed funder must sign with SIGHASH_ALL or SIGHASH_ALL|SIGHASH_UTXOS, not 0x${hashType.toString(16)}`,
    );
  }
}
