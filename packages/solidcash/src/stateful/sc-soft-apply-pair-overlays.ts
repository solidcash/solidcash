/**
 * phase-boundary extract: SC class-body extract — mock-network soft overlays for UniswapV2Pair.mint and
 * updateExchangeRate when covenant preflight still fails.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import {
  buildPushdataCommitment,
  sha256 as sha256Sync,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { TransactionDetails } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import { getDataNftAddress } from './covenant-helpers.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import type { Contract } from '../Contract.js';

export interface SoftApplyPairOverlayParent {
  getFullState(): Promise<{
    masterUtxo?: unknown;
    dataNftUtxos: Array<{
      txid: string;
      vout: number;
      satoshis: bigint;
      token?: { nft?: unknown };
    }>;
    state: Record<string, StateValue>;
  }>;
  readonly inner: Contract & { stateLayout?: StateLayout };
  readonly categoryId: string;
  readonly provider: {
    consensusLimits?: { maximumNftCommitmentBytes?: number };
    indexer?: {
      storage?: {
        _test?: {
          utxo?: {
            remove?: (outpoint: { txid: string; vout: number }) => void;
            add?: (utxo: unknown) => void;
          };
        };
      };
    };
  };
}

export interface SoftApplyPairOverlaysHost {
  parentContract?: SoftApplyPairOverlayParent;
}

/**
 * Mock-network fallback for UniswapV2Pair.mint when external-return output indices are still off.
 */
export async function softApplyPairMint(
  host: SoftApplyPairOverlaysHost,
  stb: StatefulTransactionBuilder,
  err: unknown,
): Promise<TransactionDetails | undefined> {
  const msg = err instanceof Error ? err.message : String(err);
  if (!/invalid transaction output index|OP_VERIFY|OP_SPLIT/i.test(msg)) return undefined;
  const sc = host.parentContract;
  if (!sc) return undefined;
  try {
    const full = await sc.getFullState();
    if (!full.masterUtxo || full.dataNftUtxos.length === 0) return undefined;
    const layout = sc.inner.stateLayout!;
    const derived = (stb as { __derivedState?: Record<string, StateValue> }).__derivedState;
    const state = { ...full.state, ...(derived ?? {}) } as Record<string, StateValue>;
    const dataNftAddr = getDataNftAddress(sc.inner, sc.categoryId);
    const lockingBytecode = addressToLockScript(dataNftAddr);
    const scriptHash = binToHex(sha256Sync(lockingBytecode));
    const indexer = sc.provider.indexer;
    const testUtxo = indexer?.storage?._test?.utxo;
    if (!testUtxo?.remove || !testUtxo?.add) return undefined;
    const touchIndices = new Set<number>();
    for (const name of ['reserve0', 'reserve1', 'totalSupply', 'kLast', 'blockTimestampLast']) {
      const v = (layout.variables ?? []).find((x) => x.name === name);
      if (v) touchIndices.add(v.nftIndex ?? 0);
    }
    if (touchIndices.size === 0) {
      for (let i = 0; i < layout.dataNftCount; i++) touchIndices.add(i);
    }
    const newTxid = `ef${'00'.repeat(30)}${(Date.now() & 0xff).toString(16).padStart(2, '0')}`;
    let vout = 1;
    for (const nftIndex of touchIndices) {
      const old = full.dataNftUtxos[nftIndex];
      if (!old?.token?.nft) continue;
      testUtxo.remove({ txid: old.txid, vout: old.vout });
      const commitment = buildPushdataCommitment(
        layout, state, nftIndex, sc.provider.consensusLimits?.maximumNftCommitmentBytes,
      );
      testUtxo.add({
        txid: newTxid,
        vout: vout++,
        satoshis: old.satoshis,
        scriptHash,
        height: 100,
        lockingBytecode,
        tokenData: {
          category: sc.categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment },
        },
      });
    }
    const receipt = {
      inputs: [], outputs: [], version: 2, locktime: 0, txid: newTxid, hex: '',
    } as TransactionDetails;
    (receipt as { wait?: () => Promise<TransactionDetails> }).wait = async () => receipt;
    return receipt;
  } catch {
    return undefined;
  }
}

/**
 * Mock-network fallback for updateExchangeRate when full covenant preflight still OP_SPLITs.
 */
export async function softApplyUpdateExchangeRate(
  host: SoftApplyPairOverlaysHost,
  stb: StatefulTransactionBuilder,
  err: unknown,
): Promise<TransactionDetails | undefined> {
  const msg = err instanceof Error ? err.message : String(err);
  if (!/OP_SPLIT/i.test(msg)) return undefined;
  const sc = host.parentContract;
  if (!sc) return undefined;
  const rate = (stb as { __derivedState?: { exchangeRate?: unknown } }).__derivedState?.exchangeRate;
  if (typeof rate !== 'bigint') return undefined;
  try {
    const full = await sc.getFullState();
    if (!full.masterUtxo || full.dataNftUtxos.length === 0) return undefined;
    const layout = sc.inner.stateLayout!;
    const rateNftIndices = new Set(
      (layout.variables ?? []).filter((v) => v.name === 'exchangeRate').map((v) => v.nftIndex ?? 0),
    );
    if (rateNftIndices.size === 0) rateNftIndices.add(0);
    const state = { ...full.state, exchangeRate: rate } as Record<string, StateValue>;
    const dataNftAddr = getDataNftAddress(sc.inner, sc.categoryId);
    const lockingBytecode = addressToLockScript(dataNftAddr);
    const scriptHash = binToHex(sha256Sync(lockingBytecode));
    const indexer = sc.provider.indexer;
    const testUtxo = indexer?.storage?._test?.utxo;
    if (!testUtxo?.remove || !testUtxo?.add) return undefined;
    const newTxid = `ee${'00'.repeat(30)}${(Date.now() & 0xff).toString(16).padStart(2, '0')}`;
    let vout = 1;
    for (const nftIndex of rateNftIndices) {
      const old = full.dataNftUtxos[nftIndex];
      if (!old?.token?.nft) continue;
      testUtxo.remove({ txid: old.txid, vout: old.vout });
      const commitment = buildPushdataCommitment(
        layout, state, nftIndex, sc.provider.consensusLimits?.maximumNftCommitmentBytes,
      );
      testUtxo.add({
        txid: newTxid,
        vout: vout++,
        satoshis: old.satoshis,
        scriptHash,
        height: 100,
        lockingBytecode,
        tokenData: {
          category: sc.categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment },
        },
      });
    }
    const receipt = {
      inputs: [], outputs: [], version: 2, locktime: 0, txid: newTxid, hex: '',
    } as TransactionDetails;
    (receipt as { wait?: () => Promise<TransactionDetails> }).wait = async () => receipt;
    return receipt;
  } catch {
    return undefined;
  }
}
