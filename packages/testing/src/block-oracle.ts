/**
 * Server-side block-info oracle lifecycle for a running devnet.
 *
 * `solidhat node` installs one mutable NFT at the oracle lock during `prepare`, advertises it in
 * `server.features.devnet.block_oracle`, and rewrites its commitment on every tip change so compiled
 * `block.timestamp`/`block.number` reads see the live chain. Per-snapshot outpoints travel with the chain, so a reader
 * spend that moved the oracle does not strand a later refresh.
 */
import { secp256k1, sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Indexer } from '@mem-cash/electrum';
import type { BlockHeader } from '@mem-cash/types';
import {
  blockOracleLockingBytecode,
  encodeBlockOracleCommitment,
  hash160,
  type BlockOracleCommitmentFields,
} from '@solidcash/utils';

/** The wire shape `server.features.devnet.block_oracle` carries. */
export interface BlockOracleAdvertisement {
  readonly lock: string;
  readonly category: string;
  readonly outpoint: { readonly txid: string; readonly vout: number };
}

interface Outpoint {
  readonly txid: string;
  readonly vout: number;
}

export interface TipChangeLike {
  readonly kind: 'mine' | 'time' | 'revert' | 'reset';
  readonly tip: BlockHeader;
  readonly snapshotId?: string;
}

export interface BlockOracleRuntime {
  /** Install the oracle (prepare hook) and advertise it. */
  install(): void;
  /** Current advertisement, or null when disabled. */
  advertisement(): BlockOracleAdvertisement | null;
  onSnapshot(id: string): void;
  onDropSnapshot(id: string): void;
  onTipChange(change: TipChangeLike): void;
  /** Re-advertise the live outpoint after a refresh. */
  readonly subscribeAdvertisement: (listener: (advertisement: BlockOracleAdvertisement) => void) => void;
}

/** A fixed devnet oracle mint outpoint; every devnet starts empty, so this never collides with a real coin. */
const INITIAL_OUTPOINT: Outpoint = { txid: `${'b0'.repeat(31)}c1`, vout: 0 };

/** Fixed owner key for the devnet oracle commitment (never used to sign). */
const OWNER_KEY = Uint8Array.from({ length: 32 }, (_byte, index) => (index === 31 ? 0x44 : 0x22));

function fieldsFor(header: BlockHeader): BlockOracleCommitmentFields {
  return {
    number: BigInt(header.height),
    timestamp: BigInt(header.timestamp),
    difficulty: 0n,
    size: 1000n,
    totalFees: 0n,
    coinbase: hexToBin(`76a914${'00'.repeat(20)}88ac`),
  };
}

export function createBlockOracleRuntime(params: {
  readonly indexer: Indexer;
  readonly enabled: boolean;
}): BlockOracleRuntime {
  const { indexer } = params;
  const category = sha256.hash(new TextEncoder().encode('solidcash-block-info-oracle-v1'));
  const lock = blockOracleLockingBytecode(category);
  const lockScriptHash = binToHex(sha256.hash(lock));
  const ownerPublicKey = secp256k1.derivePublicKeyCompressed(OWNER_KEY);
  if (typeof ownerPublicKey === 'string') throw new Error(`block oracle owner key is invalid: ${ownerPublicKey}`);
  const ownerPkh = hash160(ownerPublicKey);

  let liveOutpoint: Outpoint = INITIAL_OUTPOINT;
  const perSnapshot = new Map<string, Outpoint>();
  const advertisementListeners: ((advertisement: BlockOracleAdvertisement) => void)[] = [];

  function advertisement(): BlockOracleAdvertisement | null {
    if (!params.enabled) return null;
    return {
      lock: binToHex(lock),
      category: binToHex(category),
      outpoint: { txid: liveOutpoint.txid, vout: liveOutpoint.vout },
    };
  }

  function announce(): void {
    const value = advertisement();
    if (value === null) return;
    for (const listener of advertisementListeners) listener(value);
  }

  function liveOracleOutpoint(): Outpoint | undefined {
    const utxos = indexer.getUtxos(lockScriptHash);
    const entry = utxos.find((utxo) => utxo.tokenData?.nft?.capability === 'mutable');
    return entry === undefined ? undefined : { txid: entry.outpoint.txid, vout: entry.outpoint.vout };
  }

  function write(outpoint: Outpoint, header: BlockHeader): void {
    const commitment = encodeBlockOracleCommitment(ownerPkh, fieldsFor(header));
    indexer.storage._test.utxo.remove({ txid: outpoint.txid, vout: outpoint.vout });
    indexer.addUtxo({
      txid: outpoint.txid,
      vout: outpoint.vout,
      satoshis: 10_000n,
      scriptHash: lockScriptHash,
      height: header.height,
      lockingBytecode: lock,
      tokenData: {
        category: binToHex(category),
        amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(commitment) },
      },
    });
    liveOutpoint = outpoint;
  }

  function refresh(header: BlockHeader): void {
    if (!params.enabled) return;
    const target = liveOracleOutpoint() ?? liveOutpoint;
    write(target, header);
    announce();
  }

  return {
    install() {
      if (!params.enabled) return;
      const header = indexer.getTip();
      if (header === undefined) throw new Error('block oracle: the chain has no tip yet');
      write(INITIAL_OUTPOINT, header);
      announce();
    },
    advertisement,
    onSnapshot(id) {
      if (!params.enabled) return;
      perSnapshot.set(id, { ...liveOutpoint });
    },
    onDropSnapshot(id) {
      perSnapshot.delete(id);
    },
    onTipChange(change) {
      if (!params.enabled) return;
      if (change.kind === 'reset') {
        // The reset baseline restored the chain the oracle was installed on; adopt whatever it holds now.
        perSnapshot.clear();
        liveOutpoint = liveOracleOutpoint() ?? INITIAL_OUTPOINT;
        refresh(change.tip);
        return;
      }
      if (change.kind === 'revert' && change.snapshotId !== undefined) {
        const recorded = perSnapshot.get(change.snapshotId);
        if (recorded !== undefined) {
          liveOutpoint = recorded;
          refresh(change.tip);
          return;
        }
      }
      refresh(change.tip);
    },
    subscribeAdvertisement(listener) {
      advertisementListeners.push(listener);
    },
  };
}
