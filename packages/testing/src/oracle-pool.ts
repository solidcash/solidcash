/**
 * The oracle pool `solidhat node` keeps on its devnet.
 *
 * During `prepare` the node mints one pool by ordinary transactions (`createOraclePool`): two block-info coins at the
 * tip's height and the second before its median time past, one ring slot for each of the last 256 blocks, and the
 * baton, owned by a fixed key whose P2PKH holds a coin the node adds. After each tip change a `PoolKeeper` moves the
 * info coins to the new tip and puts each recent block in its ring slot, minting through the baton the slots of a
 * chain younger than the ring. Its transactions wait in the mempool for the next block.
 * `server.features.devnet.oracle_pool` names the pool's category.
 */
import { secp256k1, sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { computeMedianTimePast, type StorageReader, type UtxoEntry } from '@mem-cash/types';
import type { NetworkProvider, Utxo } from '@solidcash/solidcash';
import { Network } from '@solidcash/solidcash/dist/interfaces.js';
import { addressToLockScript, publicKeyToP2PKHLockingBytecode } from '@solidcash/solidcash/dist/utils.js';
import { PoolKeeper, createOraclePool, simulatorPoolFields, type PoolBlock } from '@solidcash/solidcash/oracle';
import { POOL_MAX_DEPTH } from '@solidcash/utils';

/** The in-process node the `prepare` hook hands the task. */
interface DevnetNode extends StorageReader {
  submitTransaction(rawHex: string): { success: true; txid: string } | { success: false; error: string };
  addUtxo(params: {
    txid: string; vout: number; satoshis: bigint; scriptHash: string; height: number; lockingBytecode: Uint8Array;
  }): void;
}

export interface PoolPrepareHandle {
  readonly indexer: unknown;
  readonly devnet: { readonly consensus: { readonly vmVersion: string } };
  readonly onTipChange: (listener: () => void) => () => void;
}

/** Signs the pool's updates; its P2PKH pays them. Never a funded account's key. */
const OWNER_KEY = Uint8Array.from({ length: 32 }, (_byte, index) => (index === 31 ? 0x66 : 0x22));

/** The coin the node adds at the owner's P2PKH. Every devnet starts empty, so it collides with no real coin. */
const FUNDING = { txid: `${'b0'.repeat(31)}c2`, vout: 0, satoshis: 100_000_000_000n };

/** The pool covenants loop, which the 2026 VM brought. */
const POOL_VMS = new Set(['BCH_2026_05', 'BCH_SPEC']);

const RING = BigInt(POOL_MAX_DEPTH);

function toUtxo(entry: UtxoEntry): Utxo {
  return {
    txid: entry.outpoint.txid,
    vout: entry.outpoint.vout,
    satoshis: entry.satoshis,
    lockingBytecode: entry.lockingBytecode,
    ...(entry.tokenData === undefined ? {} : {
      token: { amount: entry.tokenData.amount, category: entry.tokenData.category, nft: entry.tokenData.nft },
    }),
  };
}

/** The node as the pool's genesis and keeper see it: a send enters the mempool and mines nothing. */
function keeperView(node: DevnetNode, network: Network): NetworkProvider {
  const byLock = async (lock: Uint8Array): Promise<Utxo[]> => node.getUtxos(binToHex(sha256.hash(lock))).map(toUtxo);
  return {
    network,
    getUtxos: (address) => byLock(addressToLockScript(address)),
    getUtxosForLockingBytecode: (lock) => byLock(typeof lock === 'string' ? hexToBin(lock) : lock),
    getBlockHeight: async () => node.getTip()?.height ?? 0,
    getRawTransaction: async (txid) => {
      const raw = node.getRawTx(txid);
      if (raw === undefined) throw new Error(`devnet transaction ${txid} not found`);
      return raw;
    },
    sendRawTransaction: async (txHex) => {
      const result = node.submitTransaction(txHex);
      if (!result.success) throw new Error(result.error);
      return result.txid;
    },
  };
}

/** The blocks the ring holds at `height`: the last 256, in display order. */
function ringBlocks(node: DevnetNode, height: number): PoolBlock[] {
  const blocks: PoolBlock[] = [];
  for (let n = Math.max(0, height - POOL_MAX_DEPTH + 1); n <= height; n += 1) {
    const header = node.getHeader(n);
    if (header !== undefined) blocks.push({ n: BigInt(n), hash: hexToBin(header.hash) });
  }
  return blocks;
}

function warn(what: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[solidhat node] oracle pool ${what} failed: ${message}\n`);
}

export interface DevnetOraclePool {
  /** The pool category (display order), once minted. */
  readonly category: string | undefined;
  /** A server extension that serves no method and advertises the pool in `server.features.devnet`. */
  readonly extension: { readonly name: string; bind(): { methods: ReadonlyMap<string, unknown>; features: object } };
  /** Mint the pool and keep it current; a profile whose rules refuse its covenants has none. */
  install(prepared: PoolPrepareHandle): Promise<void>;
  close(): void;
}

export function createDevnetOraclePool(network: 'mocknet' | 'regtest'): DevnetOraclePool {
  let category: string | undefined;
  let unsubscribe: (() => void) | undefined;
  let step: Promise<void> = Promise.resolve();
  // The server serializes its features per request, so the advertisement names the pool once it exists.
  const advertisement = { toJSON: (): { category: string } | null => (category === undefined ? null : { category }) };

  const refresh = async (node: DevnetNode, view: NetworkProvider, pool: string): Promise<void> => {
    const tip = node.getTip();
    if (tip === undefined) return;
    try {
      const keeper = new PoolKeeper({ provider: view, category: pool, ownerKey: OWNER_KEY });
      await keeper.refreshInfo(simulatorPoolFields(tip.height, computeMedianTimePast(node, tip.height) - 1));
      const blocks = ringBlocks(node, tip.height);
      const held = new Set((await keeper.slots()).map(({ fields }) => fields.n % RING));
      const missing = blocks.filter(({ n }) => !held.has(n % RING));
      if (missing.length > 0) await keeper.growSlots(missing);
      await keeper.writeSlots(blocks);
    } catch (error) {
      warn('refresh', error);
    }
  };

  return {
    get category() {
      return category;
    },
    extension: {
      name: 'solidcash-oracle-pool',
      bind: () => ({ methods: new Map(), features: { oracle_pool: advertisement } }),
    },
    async install(prepared) {
      if (!POOL_VMS.has(prepared.devnet.consensus.vmVersion)) return;
      const node = prepared.indexer as DevnetNode;
      const tip = node.getTip();
      if (tip === undefined) return;
      const ownerPublicKey = secp256k1.derivePublicKeyCompressed(OWNER_KEY);
      if (typeof ownerPublicKey === 'string') throw new Error(`oracle pool owner key is invalid: ${ownerPublicKey}`);
      const purse = publicKeyToP2PKHLockingBytecode(ownerPublicKey);
      node.addUtxo({ ...FUNDING, scriptHash: binToHex(sha256.hash(purse)), height: tip.height, lockingBytecode: purse });
      const view = keeperView(node, network === 'regtest' ? Network.REGTEST : Network.MOCKNET);
      try {
        const pool = await createOraclePool(view, {
          ownerKey: OWNER_KEY, funder: OWNER_KEY, infoCoins: 2, ringDepth: POOL_MAX_DEPTH,
          // A time-type locktime is final below the median time past, so an update publishes the second before it.
          tip: simulatorPoolFields(tip.height, computeMedianTimePast(node, tip.height) - 1),
          blockHash: async (n) => hexToBin(node.getHeader(Number(n))!.hash),
        });
        category = pool.category;
      } catch (error) {
        warn('genesis', error);
        return;
      }
      const pool = category;
      unsubscribe = prepared.onTipChange(() => {
        step = step.then(() => refresh(node, view, pool));
      });
    },
    close() {
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
}
