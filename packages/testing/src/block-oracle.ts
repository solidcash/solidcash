/**
 * Server-side block-info oracle lifecycle for a running devnet.
 *
 * Every contract that reads block.* owns its oracle, coins of its own category its genesis mints (one per master
 * under the direct convention). `solidhat node` keeps current every oracle that names the devnet's fixed owner key
 * (`DEVNET_BLOCK_ORACLE_OWNER_KEY`): it notes them in each mined block and rewrites the commitment of each of their
 * coins on every tip change, so compiled `block.timestamp` and `block.number` reads see the live chain. Each oracle
 * holds the block the next transaction is mined into, as Hardhat executes a transaction in its own block: a swap's
 * `block.timestamp` is its receipt block's.
 * `server.features.devnet.block_oracle` advertises that the feature is on. Per-snapshot outpoints travel with the
 * chain, so a reader spend that moved an oracle does not strand a later refresh.
 */
import { secp256k1, sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { Indexer } from '@mem-cash/electrum';
import type { BlockHeader } from '@mem-cash/types';
import {
  blockOracleLockingBytecode,
  DEVNET_BLOCK_ORACLE_OWNER_KEY,
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
  /** The block the next mine produces (mem-cash `TipChange.next`). */
  readonly next: { readonly height: number; readonly timestamp: number };
  readonly snapshotId?: string;
}

/** The block a transaction accepted now is mined into. */
interface PendingBlock {
  readonly height: number;
  readonly timestamp: number;
}

export interface BlockOracleRuntime {
  /** Start keeping oracles (prepare hook) and advertise the feature. */
  install(): void;
  /** Current advertisement, or null when disabled. */
  advertisement(): BlockOracleAdvertisement | null;
  onSnapshot(id: string): void;
  onDropSnapshot(id: string): void;
  onTipChange(change: TipChangeLike): void;
  /** Re-advertise after a refresh. */
  readonly subscribeAdvertisement: (listener: (advertisement: BlockOracleAdvertisement) => void) => void;
}

/**
 * The feature flag the node advertises. The shape is the server's; no oracle is shared, so the owner's P2PKH lock
 * stands in the lock field and the rest is empty.
 */
function featureAdvertisement(ownerPublicKey: Uint8Array): BlockOracleAdvertisement {
  return {
    lock: binToHex(Uint8Array.from([0x76, 0xa9, 0x14, ...hash160(ownerPublicKey), 0x88, 0xac])),
    category: '',
    outpoint: { txid: '00'.repeat(32), vout: 0 },
  };
}

function fieldsFor(block: PendingBlock): BlockOracleCommitmentFields {
  return {
    number: BigInt(block.height),
    timestamp: BigInt(block.timestamp),
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
  const ownerPublicKey = secp256k1.derivePublicKeyCompressed(DEVNET_BLOCK_ORACLE_OWNER_KEY);
  if (typeof ownerPublicKey === 'string') throw new Error(`block oracle owner key is invalid: ${ownerPublicKey}`);
  const ownerPkh = binToHex(hash160(ownerPublicKey));

  /** Each kept oracle's category and the outpoint it was last written or seen at. */
  let oracles = new Map<string, Outpoint>();
  /** The highest block scanned for new oracles. */
  let scanned = 0;
  const perSnapshot = new Map<string, Map<string, Outpoint>>();
  const advertisementListeners: ((advertisement: BlockOracleAdvertisement) => void)[] = [];

  function advertisement(): BlockOracleAdvertisement | null {
    return params.enabled ? featureAdvertisement(ownerPublicKey as Uint8Array) : null;
  }

  function announce(): void {
    const value = advertisement();
    if (value === null) return;
    for (const listener of advertisementListeners) listener(value);
  }

  /** Keep the oracles a block at `height` minted that name the owner key. */
  function noteBlock(height: number): void {
    for (const txid of indexer.storage.getTxidsAtHeight(height) ?? []) {
      const raw = indexer.storage.getRawTx(txid);
      const tx = raw === undefined ? undefined : decodeTransaction(hexToBin(raw));
      if (typeof tx !== 'object') continue;
      for (const [vout, output] of tx.outputs.entries()) {
        const nft = output.token?.nft;
        if (nft?.capability !== 'mutable') continue;
        const category = binToHex(output.token!.category);
        if (oracles.has(category)) continue;
        if (binToHex(output.lockingBytecode) !== binToHex(blockOracleLockingBytecode(hexToBin(category)))) continue;
        if (binToHex(nft.commitment.slice(0, 20)) !== ownerPkh) continue;
        oracles.set(category, { txid, vout });
      }
    }
  }

  /** The oracle's coins: a direct deployment mints one per master. */
  function liveOutpoints(category: string): Outpoint[] {
    const lockScriptHash = binToHex(sha256.hash(blockOracleLockingBytecode(hexToBin(category))));
    return indexer.getUtxos(lockScriptHash)
      .filter((utxo) => utxo.tokenData?.nft?.capability === 'mutable'
        && utxo.tokenData.category.toLowerCase() === category.toLowerCase())
      .map((entry) => ({ txid: entry.outpoint.txid, vout: entry.outpoint.vout }));
  }

  function write(category: string, outpoint: Outpoint, block: PendingBlock): void {
    const lock = blockOracleLockingBytecode(hexToBin(category));
    const live = indexer.storage.getUtxoByOutpoint(`${outpoint.txid}:${outpoint.vout}`);
    if (live === undefined) return;
    const commitment = encodeBlockOracleCommitment(hexToBin(ownerPkh), fieldsFor(block));
    indexer.storage._test.utxo.remove({ txid: outpoint.txid, vout: outpoint.vout });
    indexer.addUtxo({
      txid: outpoint.txid,
      vout: outpoint.vout,
      satoshis: live.satoshis,
      scriptHash: binToHex(sha256.hash(lock)),
      // The coin stays confirmed where it was; its commitment describes the block after the tip.
      height: live.height,
      lockingBytecode: lock,
      tokenData: {
        category,
        amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(commitment) },
      },
    });
    oracles.set(category, outpoint);
  }

  function refresh(block: PendingBlock): void {
    if (!params.enabled) return;
    for (const category of [...oracles.keys()]) {
      for (const target of liveOutpoints(category)) write(category, target, block);
    }
    announce();
  }

  return {
    install() {
      if (!params.enabled) return;
      const tip = indexer.getTip();
      if (tip === undefined) throw new Error('block oracle: the chain has no tip yet');
      scanned = tip.height;
      announce();
    },
    advertisement,
    onSnapshot(id) {
      if (!params.enabled) return;
      perSnapshot.set(id, new Map(oracles));
    },
    onDropSnapshot(id) {
      perSnapshot.delete(id);
    },
    onTipChange(change) {
      if (!params.enabled) return;
      if (change.kind === 'reset') {
        // The reset baseline restored the chain the node started from, which holds no reader yet.
        perSnapshot.clear();
        oracles = new Map();
        scanned = change.tip.height;
        refresh(change.next);
        return;
      }
      if (change.kind === 'revert' && change.snapshotId !== undefined) {
        const recorded = perSnapshot.get(change.snapshotId);
        if (recorded !== undefined) {
          oracles = new Map(recorded);
          scanned = Math.min(scanned, change.tip.height);
          refresh(change.next);
          return;
        }
      }
      if (change.kind === 'mine') {
        for (let height = scanned + 1; height <= change.tip.height; height += 1) noteBlock(height);
        scanned = change.tip.height;
      }
      refresh(change.next);
    },
    subscribeAdvertisement(listener) {
      advertisementListeners.push(listener);
    },
  };
}
