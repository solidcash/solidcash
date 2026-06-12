import { Transaction as LibauthTransaction } from '@bitauth/libauth';
import { TransactionBuilder } from '../TransactionBuilder.js';

/**
 * TransactionBuilder for covenant (stateful) transactions. Covenant-managed outputs make the
 * base fee heuristic meaningless, so fee validation is delegated to StatefulTransactionBuilder,
 * which validates fees itself before broadcast. Everything else (burn checks, building, signing,
 * txid verification) is inherited unchanged.
 */
export class CovenantTransactionBuilder extends TransactionBuilder {
  protected override checkMaxFee(_transaction: LibauthTransaction): void {
    // No-op: covenant fee validation is performed by StatefulTransactionBuilder.
  }
}
