import type { TransactionBuilder } from '../../src/TransactionBuilder.js';

/** A derivation probe bypasses the binder and therefore cannot serve as VM security evidence. */
export const assertAuthenticatingVmEvidence = (builder: TransactionBuilder): void => {
  if (builder.inputs.some((input) => input.vout === 0xffffffff)) {
    throw new Error('VM evidence cannot use an internal derivation-probe outpoint');
  }
};
