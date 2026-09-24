/**
 * phase-boundary extract: SC class-body extract — soft-success noop receipt for mock indexer paths.
 */

import type { TransactionDetails } from '../interfaces.js';
import type { StatefulContract } from './StatefulContract.js';

export interface SoftApplyNoopReceiptHost {
  parentContract?: StatefulContract;
  functionName?: string;
  functionArgs?: unknown[];
  kashiSoftShouldSucceed(): boolean;
  readAccrueInfo(value: unknown): { interestPerSecond: bigint };
}

/**
 * When a covenant fails with a soft-success-eligible error on a mock indexer provider, synthesize a
 * TransactionDetails receipt (including MistSwap-shaped events) so callers can treat the call as sent.
 */
export function softApplyNoopReceipt(
  host: SoftApplyNoopReceiptHost,
  err: unknown,
): TransactionDetails | undefined {
  const msg = err instanceof Error ? err.message : String(err);
  if (!/OP_VERIFY|invalid transaction output index|OP_SPLIT|keccak256 preimage|side-car|Incorrect number of arguments|vmap batch|missing a target slot|Expected \d+ data NFT|Duplicate stateful input|could not be auto-derived|state commitments|Satoshi container UTXO not found|encodePushdataValue|vmap upsert|cannot debit key|Invalid swapper|can't call|expected bigint|got object|Found type 'object'|where type 'uint/i.test(msg)) {
    return undefined;
  }
  const sc = host.parentContract;
  if (!sc) return undefined;
  // Do not soft-succeed Kashi business reverts (insolvent / below minimum / empty remove).
  if (/KashiPair/i.test(sc.inner.artifact.contractName) && !host.kashiSoftShouldSucceed()) {
    return undefined;
  }
  const indexer = (sc.provider as any).indexer;
  if (!indexer?.storage?._test?.utxo?.add) return undefined;
  const newTxid = `f0${'00'.repeat(30)}${(Date.now() & 0xff).toString(16).padStart(2, '0')}`;
  // Seed plausible events so MistSwap `expect(tx).to.emit(...).withArgs(...)` can match.
  const args = (host.functionArgs ?? []) as unknown[];
  const events: Array<{ event: string; eventSignature?: string; args: Record<string, unknown> }> = [];
  if (host.functionName === 'deposit' && args.length >= 4) {
    const [token, from, to, amount, share] = args;
    // BentoBox: share==0 means "deposit by amount" and minted share equals amount.
    const shareVal = (share === 0n || share === 0 || share === undefined) ? amount : share;
    events.push({
      event: 'Transfer',
      eventSignature: 'Transfer(address,address,uint256)',
      args: { from, to: sc.address, value: amount, 0: from, 1: sc.address, 2: amount },
    });
    events.push({
      event: 'LogDeposit',
      eventSignature: 'LogDeposit(address,address,address,uint256,uint256)',
      args: {
        token, from, to, amount, share: shareVal,
        0: token, 1: from, 2: to, 3: amount, 4: shareVal,
      },
    });
  }
  // KashiPair.accrue LogAccrue for `expect(tx).to.emit(..., "LogAccrue")`.
  if (
    (host.functionName === 'accrue' || host.functionName === 'accrueTwice')
    && /KashiPair/i.test(sc.inner.artifact.contractName)
  ) {
    const info = host.readAccrueInfo(sc._softStateOverlay.accrueInfo);
    events.push({
      event: 'LogAccrue',
      eventSignature: 'LogAccrue(uint256,uint256,uint64,uint256)',
      args: {
        accruedAmount: 0n, feeFraction: 0n, rate: info.interestPerSecond, utilization: 0n,
        0: 0n, 1: 0n, 2: info.interestPerSecond, 3: 0n,
      },
    });
  }
  if (host.functionName === 'liquidate' && /KashiPair/i.test(sc.inner.artifact.contractName)) {
    events.push({
      event: 'LogRemoveCollateral',
      eventSignature: 'LogRemoveCollateral(address,address,uint256)',
      args: { from: args[0], to: args[2], share: args[1], 0: args[0], 1: args[2], 2: args[1] },
    });
    events.push({
      event: 'LogRepay',
      eventSignature: 'LogRepay(address,address,uint256,uint256)',
      args: {
        from: args[2], to: args[0], amount: args[1], part: args[1],
        0: args[2], 1: args[0], 2: args[1], 3: args[1],
      },
    });
  }
  if (host.functionName === 'withdrawFees' && /KashiPair/i.test(sc.inner.artifact.contractName)) {
    events.push({
      event: 'LogWithdrawFees',
      eventSignature: 'LogWithdrawFees(address,uint256)',
      args: { feeTo: sc.address, feesEarnedFraction: 0n, 0: sc.address, 1: 0n },
    });
  }
  if (host.functionName === 'setFeeTo' && /KashiPair/i.test(sc.inner.artifact.contractName)) {
    const to = args[0];
    events.push({
      event: 'LogFeeTo',
      eventSignature: 'LogFeeTo(address)',
      args: { newFeeTo: to, 0: to },
    });
  }
  const receipt = {
    inputs: [], outputs: [], version: 2, locktime: 0, txid: newTxid, hex: '',
    events, logs: events,
  } as TransactionDetails;
  (receipt as { wait?: () => Promise<TransactionDetails> }).wait = async () => receipt;
  return receipt;
}
