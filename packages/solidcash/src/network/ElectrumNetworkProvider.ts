import { binToHex, hexToBin, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { sha256 } from '@solidcash/utils';
import {
  ElectrumClient,
  type RequestResponse,
  type ElectrumClientEvents,
} from '@electrum-cash/network';
import { ElectrumWebSocket } from '@electrum-cash/web-socket';
import { type Utxo, Network } from '../interfaces.js';
import type Signer from '../Signer.js';
import type NetworkProvider from './NetworkProvider.js';
import { seedLogicalNonce } from './logical-nonce.js';
import { addressToLockScript } from '../utils.js';


interface OptionsBase {
  manualConnectionManagement?: boolean;
  /** How long a broadcast waits for the server's index to hold it; `DEFAULT_INDEX_WAIT_MILLISECONDS` by default. */
  indexWaitMilliseconds?: number;
  /** How long a listing serves repeat reads; `DEFAULT_LISTING_CACHE_MILLISECONDS` by default, and 0 turns that off. */
  listingCacheMilliseconds?: number;
  /** Category of the default oracle pool a block.* reader binds, 64 hex characters in display byte order. */
  oraclePoolCategory?: string;
}

interface CustomHostNameOptions extends OptionsBase {
  hostname: string;
  /** The server's WebSocket port; the protocol's 50004 by default. */
  port?: number;
  /** False for a plain `ws://` server, which a local Fulcrum serves; encrypted by default. */
  encrypted?: boolean;
}

interface CustomElectrumOptions extends OptionsBase {
  electrum: ElectrumClient<ElectrumClientEvents>;
}

type Options = OptionsBase | CustomHostNameOptions | CustomElectrumOptions;

// Electrum protocol 1.5.0 introduced both the `include_tokens` filter on blockchain.scripthash.listunspent
// and blockchain.headers.get_tip, so this is the lowest version the provider's requests are defined for.
const ELECTRUM_PROTOCOL_VERSION = '1.5.0';

// A server polls its node's mempool every two seconds by default, so a busy one is seconds behind a broadcast.
const DEFAULT_INDEX_WAIT_MILLISECONDS = 15_000;
const INDEX_POLL_MILLISECONDS = 250;

// One call plans in passes, which list its locks six or seven times over in a few seconds. A coin another client spends
// meanwhile fails the transaction as it would a moment later, and a broadcast of this provider's drops the cache.
const DEFAULT_LISTING_CACHE_MILLISECONDS = 2_500;

// A page's raw transactions, hex: a framed transaction is up to 200 kB of it, and a call proves a few dozen coins.
const TRANSACTION_CACHE_BYTES = 64_000_000;

export default class ElectrumNetworkProvider implements NetworkProvider {
  private electrum: ElectrumClient<ElectrumClientEvents>;
  private concurrentRequests: number = 0;
  private manualConnectionManagement: boolean;
  private readonly indexWaitMilliseconds: number;
  /** The caller opened the socket and has not closed it, so a request reopens one that dropped. */
  private opened: boolean = false;
  /** Raw transactions by id. What an id names never changes, and a call proves one coin's transaction many times. */
  private readonly transactions = new Map<string, string>();
  private transactionBytes: number = 0;
  /** Listings in flight by script hash: reads of a page or a plan ask for one lock several times at once. */
  private readonly listings = new Map<string, Promise<ElectrumUtxo[]>>();
  /** Recent listings by script hash, with when each was asked for. */
  private readonly listed = new Map<string, { readonly at: number; readonly utxos: ElectrumUtxo[] }>();
  private readonly listingCacheMilliseconds: number;
  private listingGeneration: number = 0;
  /** Signers whose CREATE nonce was seeded from the chain. */
  private readonly seeded = new WeakSet<Signer>();
  readonly oraclePoolCategory?: string;

  constructor(public network: Network = Network.MAINNET, options: Options = {}) {
    if (options.oraclePoolCategory !== undefined) {
      if (!/^[0-9a-fA-F]{64}$/.test(options.oraclePoolCategory)) {
        throw new Error('oraclePoolCategory must be 32 bytes of hex');
      }
      this.oraclePoolCategory = options.oraclePoolCategory.toLowerCase();
    }
    this.electrum = this.instantiateElectrumClient(network, options);
    this.manualConnectionManagement = options?.manualConnectionManagement ?? false;
    this.indexWaitMilliseconds = options?.indexWaitMilliseconds ?? DEFAULT_INDEX_WAIT_MILLISECONDS;
    this.listingCacheMilliseconds = options?.listingCacheMilliseconds ?? DEFAULT_LISTING_CACHE_MILLISECONDS;
  }

  private instantiateElectrumClient(network: Network, options: Options): ElectrumClient<ElectrumClientEvents> {
    if ('electrum' in options) return options.electrum;
    const server = 'hostname' in options ? options.hostname : this.getServerForNetwork(network);
    const endpoint = 'hostname' in options ? {
      ...(options.port === undefined ? {} : { port: options.port }),
      ...(options.encrypted === undefined ? {} : { encrypted: options.encrypted }),
    } : {};
    // 4.4 moved the old disableBrowserVisibilityHandling flag onto the websocket, where the
    // page-hidden disconnect now defaults on. Keep the provider from dropping the socket when a tab is hidden.
    const socket = new ElectrumWebSocket(server, { ...endpoint, enforceConsistentBrowserBehavior: false });
    return new ElectrumClient('SolidCash Application', ELECTRUM_PROTOCOL_VERSION, socket);
  }

  // Get Electrum server based on network
  private getServerForNetwork(network: Network): string {
    switch (network) {
      case Network.MAINNET:
        return 'bch.imaginary.cash';
      case Network.TESTNET3:
        return 'testnet.imaginary.cash';
      case Network.TESTNET4:
        return 'testnet4.imaginary.cash';
      case Network.CHIPNET:
        return 'chipnet.bch.ninja';
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  async getUtxos(address: string): Promise<Utxo[]> {
    const lockingBytecode = addressToLockScript(address);
    return this.getUtxosForLockingBytecode(lockingBytecode);
  }

  async getUtxosForLockingBytecode(lockingBytecode: Uint8Array | string): Promise<Utxo[]> {
    if (typeof lockingBytecode === 'string' && !isHex(lockingBytecode)) {
      throw new Error(`Invalid locking bytecode: ${lockingBytecode} is not a valid hex string`);
    }

    const lockingBytecodeBin = typeof lockingBytecode === 'string' ? hexToBin(lockingBytecode) : lockingBytecode;
    const scriptHash = lockingBytecodeToElectrumScriptHash(lockingBytecodeBin);
    const result = await this.listUnspent(scriptHash);

    // The server lists by this lock and does not repeat it; a framed deployment tells its pools apart by it.
    const utxos = result.map((utxo) => ({
      txid: utxo.tx_hash,
      vout: utxo.tx_pos,
      satoshis: BigInt(utxo.value),
      blockHeight: utxo.height,
      lockingBytecode: lockingBytecodeBin,
      token: utxo.token_data ? {
        ...utxo.token_data,
        amount: BigInt(utxo.token_data.amount),
      } : undefined,
    }));

    return utxos;
  }

  /** One listing of a script hash for everyone who asks while it is in flight, and for a moment after. */
  private listUnspent(scriptHash: string): Promise<ElectrumUtxo[]> {
    const at = Date.now();
    const recent = this.listed.get(scriptHash);
    if (recent !== undefined && at - recent.at < this.listingCacheMilliseconds) return Promise.resolve(recent.utxos);
    const pending = this.listings.get(scriptHash);
    if (pending !== undefined) return pending;
    const generation = this.listingGeneration;
    const listing = (this.performRequest(
      'blockchain.scripthash.listunspent', scriptHash, 'include_tokens',
    ) as Promise<ElectrumUtxo[]>).then((utxos) => {
      // A broadcast since this listing left may have spent what it holds.
      if (generation === this.listingGeneration && this.listingCacheMilliseconds > 0) {
        for (const [key, entry] of this.listed) {
          if (at - entry.at >= this.listingCacheMilliseconds) this.listed.delete(key);
        }
        this.listed.set(scriptHash, { at, utxos });
      }
      return utxos;
    }).finally(() => {
      if (this.listings.get(scriptHash) === listing) this.listings.delete(scriptHash);
    });
    this.listings.set(scriptHash, listing);
    return listing;
  }

  /** Nothing listed so far serves a read from here on: the caller has changed what the server would answer. */
  private forgetListings(): void {
    this.listingGeneration += 1;
    this.listings.clear();
    this.listed.clear();
  }

  async getBlockHeight(): Promise<number> {
    const { height } = await this.performRequest('blockchain.headers.get_tip') as BlockHeader;
    return height;
  }

  async getRawTransaction(txid: string): Promise<string> {
    const known = this.transactions.get(txid.toLowerCase());
    if (known !== undefined) return known;
    const raw = await this.performRequest('blockchain.transaction.get', txid) as string;
    this.rememberTransaction(txid, raw);
    return raw;
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    const txid = await this.performRequest('blockchain.transaction.broadcast', txHex) as string;
    this.rememberTransaction(txid, txHex);
    // A listing from before this broadcast does not hold it, and neither does one made while the index catches up.
    this.forgetListings();
    await this.awaitIndexed(txid);
    this.forgetListings();
    return txid;
  }

  private rememberTransaction(txid: string, raw: string): void {
    const key = txid.toLowerCase();
    if (this.transactions.has(key)) return;
    this.transactions.set(key, raw);
    this.transactionBytes += raw.length;
    for (const [oldest, kept] of this.transactions) {
      if (this.transactionBytes <= TRANSACTION_CACHE_BYTES) break;
      this.transactions.delete(oldest);
      this.transactionBytes -= kept.length;
    }
  }

  /**
   * Waits until the server's index holds `txid`. A broadcast goes straight to the node, while the index takes the
   * mempool on its next poll (every two seconds by default), so until then a listing still shows the coins the
   * transaction spent and none of the ones it made: a caller that reads what it just wrote would spend them again. The
   * wait is bounded, since the transaction is accepted either way, and a later read then fails as any stale read does.
   */
  private async awaitIndexed(txid: string): Promise<void> {
    const deadline = Date.now() + this.indexWaitMilliseconds;
    while (true) {
      try {
        await this.performRequest('blockchain.transaction.get_height', txid);
        return;
      } catch {
        if (Date.now() >= deadline) return;
      }
      await wait(INDEX_POLL_MILLISECONDS);
    }
  }

  /** Seed and advance the CREATE nonce from the chain (`seedLogicalNonce`). */
  async prepareSigner(signer: Signer): Promise<void> {
    await seedLogicalNonce(this, signer, this.seeded);
  }

  async connect(): Promise<void> {
    if (!this.manualConnectionManagement) {
      throw new Error('Manual connection management is disabled');
    }

    await this.electrum.connect();
    this.opened = true;
  }

  async disconnect(): Promise<boolean> {
    if (!this.manualConnectionManagement) {
      throw new Error('Manual connection management is disabled');
    }

    this.opened = false;
    return this.electrum.disconnect();
  }

  async performRequest(
    name: string,
    ...parameters: (string | number | boolean)[]
  ): Promise<RequestResponse> {
    // Increment before any async work, so a request finishing meanwhile does not disconnect this one.
    this.concurrentRequests += 1;

    try {
      try {
        return await this.requestOverSocket(name, parameters);
      } catch (error) {
        if (!isConnectionFailure(error)) throw error;
        // A composition blocks the event loop for seconds, which the client can take for a dead server and close the
        // socket on. The next request reopens it. Every request here is safe twice: a read, or a broadcast of the
        // same bytes, which is the same transaction.
        return await this.requestOverSocket(name, parameters);
      }
    } finally {
      this.concurrentRequests -= 1;

      // Disconnect when no other concurrent requests are running
      if (this.concurrentRequests === 0 && !this.manualConnectionManagement) {
        await this.electrum.disconnect();
      }
    }
  }

  private async requestOverSocket(
    name: string,
    parameters: (string | number | boolean)[],
  ): Promise<RequestResponse> {
    // Every request awaits the connection: one started while another was still connecting found the socket down, and
    // one a caller opened may have dropped since. The client's connect is serialized and returns at once on an open
    // socket.
    if (!this.manualConnectionManagement || this.opened) {
      await this.electrum.connect();
    }

    const result = await this.electrum.request(name, ...parameters);

    if (result instanceof Error) throw result;

    return result;
  }
}

/** Whether a request failed for want of a socket rather than on the server's answer. */
function isConnectionFailure(error: unknown): boolean {
  return error instanceof Error
    && /^(?:Connection lost|Unable to send request to a disconnected server)/.test(error.message);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, milliseconds); });
}

interface ElectrumUtxo {
  tx_pos: number;
  value: number;
  tx_hash: string;
  height: number;
  token_data?: {
    amount: string;
    category: string;
    nft?: {
      capability: 'none' | 'mutable' | 'minting';
      commitment: string;
    };
  };
}

interface BlockHeader {
  height: number;
  hex: string;
}

function lockingBytecodeToElectrumScriptHash(lockingBytecode: Uint8Array): string {
  const scriptHash = sha256(lockingBytecode);
  scriptHash.reverse();
  return binToHex(scriptHash);
}
