/**
 * phase-boundary extract: SC _createBuilder extract — resolve master + filtered data NFT UTXOs after state load.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import type { Utxo } from '../interfaces.js';
import type { OnChainState } from './StateReader.js';

export interface ResolveCreateBuilderMasterAndDataNftsInput {
  functionName: string;
  categoryId: string;
  requiredNftIndices: readonly number[];
  onChainState: OnChainState;
  overrides?: {
    masterUtxo?: Utxo;
    dataNftUtxos?: Utxo[];
    omitLocalFeeTail?: boolean;
    blockBase?: number;
  };
}

export interface ResolveCreateBuilderMasterAndDataNftsResult {
  masterUtxo: Utxo;
  /** Probe-safe master copy with vout 0xffffffff when omitLocalFeeTail is set. */
  derivationMasterUtxo: Utxo;
  allDataNftUtxos: Utxo[];
  filteredDataNftUtxos: Utxo[];
}

/**
 * Pick the master UTXO (override or on-chain), optionally rewrite its vout for local VM probes,
 * and filter data NFT UTXOs to the ABI-required indices.
 */
export function resolveCreateBuilderMasterAndDataNfts(
  input: ResolveCreateBuilderMasterAndDataNftsInput,
): ResolveCreateBuilderMasterAndDataNftsResult {
  const { functionName, categoryId, requiredNftIndices, onChainState, overrides } = input;

  if (!overrides?.masterUtxo && !onChainState.masterUtxo) {
    throw new Error('Master UTXO not found on-chain');
  }

  const masterUtxo = overrides?.masterUtxo ?? onChainState.masterUtxo!;
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER === '1') {
    const state = onChainState.state as Record<string, unknown> | undefined;
    console.error('dynamic-chunk-master-state', JSON.stringify({
      functionName,
      blockBase: overrides?.blockBase ?? 0,
      categoryId,
      master: `${masterUtxo.txid.slice(0, 12)}:${masterUtxo.vout}`,
      commitment: masterUtxo.token?.nft?.commitment,
      dynamicValues: Object.fromEntries(Object.entries(state ?? {})
        .filter(([key]) => ['_name', '_symbol', 'name', 'symbol'].includes(key))
        .map(([key, value]) => [key, value instanceof Uint8Array
          ? `${value.length}:${binToHex(value).slice(0, 40)}` : String(value)])),
    }));
  }
  // Atomic local VM probes run before the canonical verifier region is assembled. An output index of
  // 0xffffffff cannot identify a real UTXO, so generated message-bus code may bypass only its final binding
  // check during these probes; the real outpoint is restored before the participant block leaves this builder.
  const derivationMasterUtxo = overrides?.omitLocalFeeTail
    ? { ...masterUtxo, vout: 0xffffffff }
    : masterUtxo;
  const allDataNftUtxos = overrides?.dataNftUtxos ?? onChainState.dataNftUtxos;

  const filteredDataNftUtxos = requiredNftIndices.map((idx) => allDataNftUtxos[idx]);
  if (filteredDataNftUtxos.some((u) => u === undefined)) {
    throw new Error(
      `Missing required data NFTs on-chain. Expected indices: [${requiredNftIndices.join(', ')}], `
      + `but only ${allDataNftUtxos.length} data NFTs found.`,
    );
  }

  return {
    masterUtxo,
    derivationMasterUtxo,
    allDataNftUtxos,
    filteredDataNftUtxos: filteredDataNftUtxos as Utxo[],
  };
}
