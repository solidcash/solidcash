import type { Transaction as LibauthTransaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import { TransactionBuilder } from '../TransactionBuilder.js';

/**
 * TransactionBuilder for covenant (stateful) transactions. Inside the SDK this builder is a probe or a frame whose
 * funding comes later, so its fee means nothing yet, and StatefulTransactionBuilder validates the fee of what it
 * sends itself. Everything else (burn checks, building, signing, txid verification) is inherited unchanged.
 */
export class CovenantTransactionBuilder extends TransactionBuilder {
  /**
   * Set on the builder a call's `build()` hands back. Its caller sends that builder itself, so the call's fee
   * caps hold there as they do in the call's own `send()`: a coin added by hand cannot go to the miner whole.
   */
  enforceFeeCaps = false;

  protected override checkMaxFee(transaction: LibauthTransaction): void {
    if (this.enforceFeeCaps) super.checkMaxFee(transaction);
  }
}
