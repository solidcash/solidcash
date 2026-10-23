import {
  BchnRpcClient,
  type GenerateToAddress,
  type GetBlockCount,
  type GetBlockHash,
  type GetNewAddress,
  type SignRawTransactionWithWallet,
  type SendRawTransaction,
  type GetRawTransactionVerbosity0,
  type GetTxOut,
  type ListUnspent,
  type ListUnspentItem,
  type ImportAddress,
} from '@mr-zwets/bchn-api-wrapper';
import { cashAddressToLockingBytecode, lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { hexToBin, binToHex, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransactionUnsafe, encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import {
  blockOracleFieldValue, blockOracleLockingBytecode, encodeBlockOracleCommitment, hash160,
  type BlockOracleCommitmentFields,
} from '@solidcash/utils';
import { type Utxo, Network, type TokenDetails } from '../interfaces.js';
import type NetworkProvider from './NetworkProvider.js';
import type { ConsensusLimits, NetworkPolicy } from './NetworkProvider.js';
import type { SnapshotRestorer } from './MockNetworkProvider.js';
import { getNetworkPrefix, publicKeyToP2PKHLockingBytecode, randomUtxo } from '../utils.js';
import { runMockNetworkProviderResetHooks } from './mock-reset.js';

export interface RegtestProviderOptions {
  rpcUrl?: string;
  rpcUser?: string;
  rpcPassword?: string;
  /** Published SDK limits for preflight. The node's limits must be configured to match. */
  consensusLimits?: ConsensusLimits;
  policy?: NetworkPolicy;
}

interface GetBlockHeaderTime {
  method: 'getblockheader';
  params: [hashOrHeight: string | number, verbosity: true];
  // `mediantime` is BCHN's median-time-past, the value `LOCKTIME_MEDIAN_TIME_PAST` checks against.
  response: { hash: string; height: number; time: number; mediantime: number };
}

interface ClearMempool {
  method: 'clearmempool';
  params: [];
  response: boolean;
}

interface SetMockTime {
  method: 'setmocktime';
  params: [timestamp: number];
  response: null;
}

interface InvalidateBlock {
  method: 'invalidateblock';
  params: [blockhash: string];
  response: null;
}

interface GetRawMempoolVerbose {
  method: 'getrawmempool';
  params: [verbose: true];
  response: Record<string, unknown>;
}

interface RescanBlockchain {
  method: 'rescanblockchain';
  params: [startHeight?: number];
  response: { start_height: number; stop_height: number };
}

interface ListTransactions {
  method: 'listtransactions';
  params: [account?: string, count?: number, skip?: number, includeWatchonly?: boolean];
  response: Array<{ txid: string; confirmations: number; abandoned?: boolean }>;
}

interface AbandonTransaction {
  method: 'abandontransaction';
  params: [txid: string];
  response: null;
}

interface RegtestSnapshotState {
  height: number;
  hash: string;
  mockTime: number;
  tipTime: number;
  pendingBlockTimestamp: number | undefined;
  retainedMinting: Map<string, { txid: string; vout: number; satoshis: bigint }>;
  categoryOfLabel: Map<string, string>;
  importedAddresses: Set<string>;
  tokenUtxos: Map<string, Map<string, Utxo>>;
  broadcastUtxos: Map<string, Utxo>;
  lastMinedTimestamp: number;
}

export interface TokenGenesisOutput {
  address: string;
  satoshis: bigint;
  token?: Omit<TokenDetails, 'category'>;
}

export default class RegtestNetworkProvider implements NetworkProvider {
  public network: Network = Network.REGTEST;
  public consensusLimits?: ConsensusLimits;
  public policy?: NetworkPolicy;
  public blockOracleLock?: Uint8Array;
  public blockOracleCategory?: Uint8Array;

  /** Deterministic owner key; its P2PKH pays the oracle update fee. */
  private readonly blockOracleOwnerKey = Uint8Array.from(
    { length: 32 }, (_byte, index) => (index === 31 ? 0x44 : 0x11),
  );

  private blockOracleOwnerAddress = '';
  private blockOracleInstalled = false;
  private blockOracleRefreshing = false;
  /** Serializes wallet funding and contract broadcasts: concurrent sends otherwise race one wallet coin. */
  private sendQueue: Promise<void> = Promise.resolve();
  /** Strict FIFO around UTXO selection + wallet funding; see `withFundingLock`. */
  private fundingQueue: Promise<void> = Promise.resolve();
  /** Wallet coins selected as funding inputs; hidden from caller-coin reads until their tx is mined. */
  private reservedFunding = new Set<string>();

  private rpc: BchnRpcClient;
  private readRpc: BchnRpcClient;
  private probeRpc: BchnRpcClient;
  private miningAddress: string = '';
  private ready: Promise<void> | undefined;
  private importedAddresses = new Set<string>();
  private snapshotNonce = 0;
  private snapshotRestorers = new Map<string, SnapshotRestorer>();
  /** Local mock time; zero means the node's system clock is in use. */
  private mockTime = 0;
  /** Latest known tip timestamp, used while mock time is unset. */
  private tipTime = 0;
  /** Timestamp applied to the next mined block by `evm_setNextBlockTimestamp`. */
  private pendingBlockTimestamp: number | undefined;
  /** Time of the newest mined block; a restore rewinds it with the chain, as the mock chain rewinds its clock. */
  private lastMinedTimestamp = 0;
  /** Nonzero while `increaseTime` holds the clock across its median window and oracle update. */
  private holdMockTime = 0;
  /** True while an oracle update is broadcast for the caller's pending block, so that send does not mine. */
  private deferredOracleMine = false;
  /** True when an oracle update is in the mempool; the next mined block confirms it. */
  private pendingOracleUpdate = false;

  // X74. Category bookkeeping. A CashTokens category exists only where a transaction spent its own genesis
  // outpoint, so the provider cannot conjure one on request; what it CAN do is keep the category's minting NFT
  // and co-spend it later. `retainedMinting` holds that NFT per real on-chain category, and `categoryOfLabel`
  // maps every category the caller has ASKED for to the real category serving it (identity for real ones).
  // Together they give one invariant: the provider never serves two different real categories for one
  // requested category, and never substitutes for a category it can actually mint into.
  private retainedMinting = new Map<string, { txid: string; vout: number; satoshis: bigint }>();
  private categoryOfLabel = new Map<string, string>();
  // BCHN's wallet cannot enumerate UTXOs by token category. Track the category-bearing outputs this
  // process broadcasts; that is the set framed deployments use to tell masters, validators and records apart.
  private tokenUtxos = new Map<string, Map<string, Utxo>>();
  // Every output this process broadcasts, so a validator/facet output mined before its address is imported is
  // still visible through getUtxosForLockingBytecode (the wallet cannot rescan history for imported addresses).
  private broadcastUtxos = new Map<string, Utxo>();
  /** Every transaction this provider has broadcast; a restore abandons the ones the restored chain lacks. */
  private broadcastTxids = new Set<string>();
  private retainAddress: string = '';
  private retainLockingBytecode: Uint8Array = new Uint8Array();
  private static readonly RETAINED_MINT_SATOSHIS = 2_000n;
  /**
   * The timestamp a fresh regtest volume starts from. The mock chain begins at this same epoch, so a suite run
   * is reproducible instead of depending on the wall clock the container happened to start at.
   */
  private static readonly DEFAULT_BLOCK_TIME = 1_700_000_000;
  // Comfortably above the `minimumAmount: 1` BCH filter in `pickLiveFundingInput`.
  private static readonly VOUT0_FUNDING_SATOSHIS = 200_000_000n;
  // Below BCHN's default RPC work queue (16 queued beside 4 worker threads), so a burst never meets HTTP 503.
  private static readonly MAX_RPC_IN_FLIGHT = 8;

  constructor(options: RegtestProviderOptions = {}) {
    const {
      rpcUrl = 'http://localhost:18443',
      rpcUser = 'user',
      rpcPassword = 'password',
    } = options;

    this.consensusLimits = options.consensusLimits;
    this.policy = options.policy;

    // 60s (vs the wrapper's 5s default): resource-heavy live transactions can occasionally keep one BCHN RPC
    // request active for slightly more than 30s. This remains below the 180s per-test regtest budget.
    this.rpc = new BchnRpcClient({
      url: rpcUrl, rpcUser, rpcPassword, timeoutMs: 60_000,
    });
    // Read requests are idempotent and state derivation can issue many of them, so they retry a transient
    // failure (in the request wrapper below). Mutation requests deliberately stay non-retrying.
    this.readRpc = new BchnRpcClient({
      url: rpcUrl, rpcUser, rpcPassword, timeoutMs: 60_000,
    });
    // A second client for probes whose FAILURE is the answer. The wrapper logs every failed request through
    // its logger, and `categoryExistsOnChain` misses once per seeded placeholder UTXO, so those misses would
    // otherwise print an error line each. Same endpoint, same timeout, silent.
    const quiet = {
      error: (): void => {}, warn: (): void => {}, log: (): void => {},
      info: (): void => {}, debug: (): void => {},
    };
    this.probeRpc = new BchnRpcClient({
      url: rpcUrl, rpcUser, rpcPassword, timeoutMs: 30_000, logger: quiet as never,
    });
    // A ported suite may replace `globalThis.fetch` with an in-memory IPFS stub. That stub assumes every POST
    // carries an IPFS upload body and fails on a JSON-RPC request, so the node's RPC calls use the native fetch.
    // The client looks `fetch` up synchronously when an attempt starts, so the native function is in place only
    // for that call and the stub is back before anything else runs: held for the whole request, a suite's IPFS
    // read during a node request reached the real network. Each attempt (a read's retry included) swaps here;
    // the client's own retry ran after the stub was back. Requests are capped in flight: one `gettxout` per UTXO
    // of a large category overflowed BCHN's RPC work queue.
    const nativeFetch = globalThis.fetch;
    type RpcRequest = (method: string, ...params: unknown[]) => Promise<unknown>;
    let inFlight = 0;
    const waiting: Array<() => void> = [];
    const acquire = async (): Promise<void> => {
      if (inFlight < RegtestNetworkProvider.MAX_RPC_IN_FLIGHT) {
        inFlight += 1;
        return;
      }
      await new Promise<void>((resolve) => { waiting.push(resolve); });
    };
    const release = (): void => {
      const next = waiting.shift();
      if (next) next();
      else inFlight -= 1;
    };
    const underNativeFetch = (original: RpcRequest, method: string, params: unknown[]): Promise<unknown> => {
      const current = globalThis.fetch;
      if (current === nativeFetch) return original(method, ...params);
      globalThis.fetch = nativeFetch;
      try {
        return original(method, ...params);
      } finally {
        globalThis.fetch = current;
      }
    };
    const pause = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
    const guarded = (original: RpcRequest, retries: number): RpcRequest => async (
      method: string, ...params: unknown[]
    ): Promise<unknown> => {
      await acquire();
      try {
        for (let attempt = 0; ; attempt += 1) {
          try {
            return await underNativeFetch(original, method, params);
          } catch (error) {
            if (attempt >= retries) throw error;
            await pause(250);
          }
        }
      } finally {
        release();
      }
    };
    const clients: Array<[BchnRpcClient, number]> = [[this.rpc, 0], [this.readRpc, 2], [this.probeRpc, 0]];
    for (const [client, retries] of clients) {
      const target = client as unknown as { request: RpcRequest };
      target.request = guarded(target.request.bind(client), retries);
    }
  }

  // ---------------------------------------------------------------------------
  // NetworkProvider interface - all via BCHN RPC
  // ---------------------------------------------------------------------------

  async getUtxos(address: string): Promise<Utxo[]> {
    await this.ensureReady();
    await this.importAddressIfNeeded(address);
    // Always request token UTXOs. The CashAddress token-support flag describes the ADDRESS ENCODING, not what
    // the script underneath may hold: a p2sh32 covenant is addressable in both forms and the locking bytecode is
    // identical, so gating the query on that flag hid real token UTXOs. `deriveLogicalCreateAddress` encodes
    // `type: 'p2sh'`, so every logical CREATE anchor - which is an immutable NFT - was invisible here and
    // `resolveLogicalIdentity` reported "found 0" for an anchor that existed on chain. MockNetworkProvider
    // returns token UTXOs regardless, which is why this only ever failed against a live node.
    const result = await this.readRpc.request<ListUnspent>(
      'listunspent', 0, 9999999, [address], false, { includeTokens: true },
    );
    const entries = result.map((u): [string, Utxo] => {
      const utxo = this.listUnspentItemToUtxo(u);
      return [`${utxo.txid}:${utxo.vout}`, utxo];
    }).filter(([key]) => !this.reservedFunding.has(key));
    const merged = new Map<string, Utxo>(entries);
    // The wallet cannot rescan history for an address imported after its outputs were mined. Serve the
    // category-bearing outputs this provider already broadcast for that lock.
    for (const utxo of await this.trackedAt(binToHex(this.toLockingBytecode(address)))) {
      const key = `${utxo.txid}:${utxo.vout}`;
      if (!merged.has(key)) merged.set(key, utxo);
    }
    // A fixture restore disconnects a block, and BCHN's wallet can keep listing outputs of transactions from
    // that branch even after the rescan/abandon pass. Never serve an outpoint the node's UTXO view lacks: a
    // caller that funds or anchors a transaction with one can only fail with "Missing inputs".
    return this.liveOnly([...merged.values()]);
  }

  async getUtxosByTokenCategory(categoryId: string): Promise<Utxo[]> {
    await this.ensureReady();
    const wanted = new Set([categoryId.toLowerCase()]);
    try {
      wanted.add(binToHex(hexToBin(categoryId).reverse()).toLowerCase());
    } catch { /* not a byte string; exact match only */ }
    // The wallet knows every imported data/proxy address; a tracked-only answer loses records that a
    // fixture restore recreated without replaying the process's own broadcast history.
    const wallet = await this.readRpc.request<ListUnspent>(
      'listunspent', 0, 9999999, [], true, { includeTokens: true },
    );
    const merged = new Map<string, Utxo>();
    for (const item of wallet) {
      const utxo = this.listUnspentItemToUtxo(item);
      merged.set(`${utxo.txid}:${utxo.vout}`, utxo);
    }
    for (const [category, bucket] of this.tokenUtxos) {
      if (!wanted.has(category.toLowerCase())) continue;
      for (const utxo of bucket.values()) merged.set(`${utxo.txid}:${utxo.vout}`, utxo);
    }
    const found = [...merged.values()].filter((utxo) => (
      utxo.token !== undefined && wanted.has(utxo.token.category.toLowerCase())
    ));
    return this.liveOnly(found);
  }

  async getUtxosForLockingBytecode(lockingBytecode: Uint8Array | string): Promise<Utxo[]> {
    const bin = typeof lockingBytecode === 'string' ? hexToBin(lockingBytecode) : lockingBytecode;
    const prefix = getNetworkPrefix(this.network);
    // Try both token and non-token address variants
    const addresses: string[] = [];
    for (const tokenSupport of [false, true]) {
      const result = lockingBytecodeToCashAddress({ bytecode: bin, prefix, tokenSupport });
      if (typeof result !== 'string') addresses.push(result.address);
    }
    if (addresses.length === 0) {
      // Non-standard script - the wallet cannot list it, but a broadcast output can still be tracked.
      return this.trackedAt(binToHex(bin));
    }
    const utxos: Utxo[] = [];
    for (const addr of addresses) {
      utxos.push(...await this.getUtxos(addr));
    }
    // Token-aware and ordinary CashAddresses encode the same locking bytecode. BCHN's wallet therefore returns
    // the same outpoint for both queries; expose a UTXO set, not a duplicated concatenation of those two views.
    return [...new Map(utxos.map((utxo) => [`${utxo.txid}:${utxo.vout}`, utxo])).values()];
  }

  private async trackedAt(lockingBytecodeHex: string): Promise<Utxo[]> {
    return this.liveOnly([...this.broadcastUtxos.values()].filter((utxo) => (
      utxo.lockingBytecode !== undefined && binToHex(utxo.lockingBytecode) === lockingBytecodeHex
    )));
  }

  private async liveOnly(utxos: Utxo[]): Promise<Utxo[]> {
    const live = await Promise.all(utxos.map(async (utxo) => (
      await this.isLiveOutpoint(utxo.txid, utxo.vout) ? utxo : undefined
    )));
    return live.filter((utxo): utxo is Utxo => utxo !== undefined);
  }

  async getBlockHeight(): Promise<number> {
    await this.ensureReady();
    return this.readRpc.request<GetBlockCount>('getblockcount');
  }

  async getBlockHash(height: number): Promise<string> {
    await this.ensureReady();
    return this.readRpc.request<GetBlockHash>('getblockhash', height);
  }

  async getRawTransaction(txid: string): Promise<string> {
    await this.ensureReady();
    return this.readRpc.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, false);
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    const txid = await this.serializeSend(async () => {
      await this.ensureReady();
      const sent = await this.rpc.request<SendRawTransaction>('sendrawtransaction', txHex);
      this.trackBroadcastOutputs(txHex, sent);
      // An oracle update is published for inclusion in the block the caller is about to mine; mining here would
      // confirm it alone and add a block beyond the caller's `mine(count)`.
      if (!this.deferredOracleMine) await this.mineBlocks(1, false);
      return sent;
    });
    await this.publishOracleIfDue();
    return txid;
  }

  private async serializeSend<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.sendQueue.then(operation, operation);
    this.sendQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  /** Let every in-flight funding selection and broadcast settle before reading or rewinding the chain. */
  private async quiesceSends(): Promise<void> {
    await this.fundingQueue;
    await this.sendQueue;
  }

  // ---------------------------------------------------------------------------
  // Test helper: addUtxo
  // ---------------------------------------------------------------------------

  // Keyed by requested value: the caller's fee funder size is part of what it asked for, so a pool serving one
  // fixed size would silently over-fund it. See `addUtxo`.
  private feeFunderPool = new Map<bigint, Utxo[]>();
  private feeFunderRefill = new Map<bigint, Promise<void>>();
  /** The pooled funder each requested outpoint was served, so a repeated request gets the same live coin. */
  private feeFunderByRequest = new Map<string, Utxo>();
  private feeFunderSizeRequests = new Map<bigint, number>();
  // Cached `listunspent` candidates for `pickLiveFundingInput`; `undefined` forces a re-list.
  private fundingCandidates: ListUnspentItem[] | undefined;
  private static readonly DUMMY_FUNDER_LBC = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';

  async addUtxo(address: string, utxo: Utxo): Promise<Utxo> {
    // Initialization can itself seed UTXOs (the block oracle), so it has to finish before this operation queues:
    // nesting it inside the queue would make that seeding wait on its own caller.
    await this.ensureReady();
    return this.withFundingLock(() => this.addUtxoUnlocked(address, utxo));
  }

  /**
   * Serialize funding operations FIFO. Independent callers must never overlap: two selections that both pass
   * `gettxout` before either reserves the coin select the same outpoint, and the second genesis then spends a
   * dead anchor. Reentrancy is avoided structurally - `ensureReady` runs before this lock and the only internal
   * retry calls `addUtxoUnlocked` directly - so no caller can already hold the queue while reaching it.
   */
  private async withFundingLock<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.fundingQueue.then(operation, operation);
    this.fundingQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async addUtxoUnlocked(address: string, utxo: Utxo): Promise<Utxo> {
    // Fast path: serve pre-created fee funders for the STB dummy pattern
    if (address === RegtestNetworkProvider.DUMMY_FUNDER_LBC && !utxo.token) {
      // Serve the size the CALLER asked for. Serving one fixed size instead handed a 100,000-satoshi coin to a
      // builder that requested 5,000; where the covenant cannot emit a change output the excess becomes fee, and
      // a co-spend then failed with "fee of 99000 satoshis exceeds the maximum fee cap of 50000".
      const wanted = utxo.satoshis < 546n ? 546n : utxo.satoshis;
      // A builder names each funder by a seeded outpoint, and a mock provider keeps one UTXO per outpoint, so a
      // re-planned transaction asks for the same funders again. Serve the same coin while it is live: a fresh
      // pooled coin per request made every re-plan differ, and the refills that fed them mined blocks.
      const requested = `${utxo.txid.toLowerCase()}:${utxo.vout}`;
      const prior = this.feeFunderByRequest.get(requested);
      if (prior !== undefined && prior.satoshis === wanted && await this.isLiveOutpoint(prior.txid, prior.vout)) {
        Object.assign(utxo, {
          txid: prior.txid, vout: prior.vout, satoshis: prior.satoshis,
          lockingBytecode: prior.lockingBytecode, confirmations: prior.confirmations,
        });
        return utxo;
      }
      if ((this.feeFunderPool.get(wanted)?.length ?? 0) === 0) {
        if (!this.feeFunderRefill.has(wanted)) {
          this.feeFunderRefill.set(wanted, this.refillFeeFunderPool(wanted).finally(() => {
            this.feeFunderRefill.delete(wanted);
          }));
        }
        await this.feeFunderRefill.get(wanted);
      }
      const pool = this.feeFunderPool.get(wanted) ?? [];
      const takeLive = async (): Promise<Utxo | undefined> => {
        while (pool.length > 0) {
          const pooled = pool.pop()!;
          // A fixture restore can race an in-flight refill and leave an entry at a disconnected height.
          if (await this.isLiveOutpoint(pooled.txid, pooled.vout)) return pooled;
        }
        return undefined;
      };
      let pooled = await takeLive();
      if (pooled === undefined) {
        await this.refillFeeFunderPool(wanted);
        pooled = await takeLive();
      }
      if (pooled === undefined) throw new Error(`no live fee funder for ${wanted} satoshis`);
      this.feeFunderByRequest.set(requested, pooled);
      utxo.txid = pooled.txid;
      utxo.vout = pooled.vout;
      utxo.satoshis = pooled.satoshis;
      utxo.lockingBytecode = pooled.lockingBytecode;
      utxo.confirmations = pooled.confirmations;
      return utxo;
    }

    if (!isHex(address)) await this.importAddressIfNeeded(address);

    const satoshis = utxo.satoshis < 546n ? 546n : utxo.satoshis;
    const lbc = this.toLockingBytecode(address);

    // X74. A requested category is HONOURED, never quietly swapped. If the provider already serves that
    // category it mints into it by co-spending the retained minting NFT; if it serves it but has lost the
    // minting NFT, or the request needs a fungible amount that only a genesis can create, it THROWS.
    const requested = utxo.token ? RegtestNetworkProvider.normalizeCategory(utxo.token.category) : '';
    if (requested && this.categoryOfLabel.has(requested)) {
      return this.mintIntoExistingCategory(lbc, utxo, this.categoryOfLabel.get(requested)!, satoshis);
    }
    // A category this instance did not create, but which EXISTS on this chain - the second run against a
    // chain the first run already seeded. The index of retained minting NFTs is in-memory, so this instance
    // cannot mint into it, and genesising a replacement would be exactly the substitution X74 exists to kill.
    if (requested && await this.categoryExistsOnChain(requested)) {
      throw new Error(
        `RegtestNetworkProvider.addUtxo cannot mint into category ${requested}: it exists on this chain but `
        + 'was not created by this provider instance, so no minting NFT is retained for it. It is NOT served '
        + 'with a different category. Create the category in this run (addTokenUtxosDynamic / '
        + 'setupStatefulUtxos) and request the category it returns.',
      );
    }

    let fundingInput: ListUnspentItem;
    try {
      fundingInput = await this.pickLiveFundingInput(!!utxo.token);
    } catch (e) {
      if (utxo.token) { await this.createVout0Utxo(); return this.addUtxoUnlocked(address, utxo); }
      throw e;
    }
    let txid: string;
    try {
      if (utxo.token) {
        // No such category exists on this chain, so there is nothing to mint into and nothing being displaced:
        // this is a genesis. Its real category is reported back on the returned UTXO, and both it and the
        // requested label are recorded so every later request for the same label lands in this same category.
        const category = fundingInput.txid;
        const unsignedTx = this.buildLibauthTx(fundingInput, [{
          lockingBytecode: lbc,
          valueSatoshis: satoshis,
          token: {
            category: hexToBin(category),
            amount: utxo.token.amount,
            nft: utxo.token.nft ? {
              capability: utxo.token.nft.capability,
              commitment: hexToBin(utxo.token.nft.commitment),
            } : undefined,
          },
        }, this.retainedMintingOutput(category)]);
        txid = await this.fundSignSend(unsignedTx);
        await this.mineBlocks(1, false);
        this.recordCategory(category, txid, 1, requested);
      } else {
        const unsignedTx = this.buildLibauthTx(fundingInput, [{
          lockingBytecode: lbc, valueSatoshis: satoshis,
        }]);
        txid = await this.fundSignSend(unsignedTx);
        await this.mineBlocks(1, false);
      }

      const result = await this.decodeOutputAt(txid, 0);
      utxo.txid = result.txid;
      utxo.vout = result.vout;
      utxo.satoshis = result.satoshis;
      if (result.token) utxo.token = result.token;
      return result;
    } finally {
      this.releaseFunding(fundingInput);
    }
  }

  /**
   * X74. Mint one NFT into a category that already exists on this chain, by co-spending the minting NFT the
   * provider retained when it created that category. The minting NFT is recreated at the provider's own
   * address in the same transaction, so the capability survives for the next request.
   *
   * Fungible amounts are deliberately NOT served here: CashTokens fixes a category's fungible supply at
   * genesis, so a request for one is refused by name rather than rounded down to zero.
   */
  private async mintIntoExistingCategory(
    lockingBytecode: Uint8Array, utxo: Utxo, category: string, satoshis: bigint,
  ): Promise<Utxo> {
    const token = utxo.token!;
    if (!token.nft) {
      throw new Error(
        'RegtestNetworkProvider.addUtxo cannot serve a fungible-only output in the existing category '
        + `${category}: CashTokens fixes fungible supply at genesis. Seed it in the genesis transaction `
        + '(addTokenUtxosDynamic) instead.',
      );
    }
    if (token.amount !== 0n) {
      throw new Error(
        `RegtestNetworkProvider.addUtxo cannot add ${token.amount} fungible tokens to the existing category `
        + `${category}: a minting NFT creates NFTs only, never new fungible supply. Seed the amount in the `
        + 'genesis transaction (addTokenUtxosDynamic) instead.',
      );
    }
    let retained = this.retainedMinting.get(category);
    if (!retained) {
      throw new Error(
        `RegtestNetworkProvider.addUtxo cannot mint into category ${category}: no minting NFT is retained for `
        + 'it, so the request cannot be satisfied. It is NOT served with a different category.',
      );
    }
    if (!(await this.isLiveOutpoint(retained.txid, retained.vout))) {
      // A restore or an interleaved mint can leave the in-memory pointer one hop behind. Follow the live
      // minting NFT at the provider's retain address instead of spending a dead outpoint.
      const live = (await this.getUtxosByTokenCategory(category)).find((candidate) => (
        candidate.token?.nft?.capability === 'minting'
        && candidate.lockingBytecode !== undefined
        && binToHex(candidate.lockingBytecode) === binToHex(this.retainLockingBytecode)
      ));
      if (live === undefined) {
        throw new Error(
          `RegtestNetworkProvider.addUtxo cannot mint into category ${category}: its minting NFT is not live.`,
        );
      }
      retained = { txid: live.txid, vout: live.vout, satoshis: live.satoshis };
      this.retainedMinting.set(category, retained);
    }

    const unsignedTx = this.buildLibauthTx(retained, [{
      lockingBytecode,
      valueSatoshis: satoshis,
      token: {
        category: hexToBin(category),
        amount: 0n,
        nft: {
          capability: token.nft.capability,
          commitment: hexToBin(token.nft.commitment),
        },
      },
    }, this.retainedMintingOutput(category)]);
    const txid = await this.fundSignSend(unsignedTx);
    await this.mineBlocks(1, false);
    this.recordCategory(category, txid, 1);

    const result = await this.decodeOutputAt(txid, 0);
    utxo.txid = result.txid;
    utxo.vout = result.vout;
    utxo.satoshis = result.satoshis;
    if (result.token) utxo.token = result.token;
    return result;
  }

  /** The minting NFT this provider keeps for `category`, at its own wallet address. */
  private retainedMintingOutput(category: string): {
    lockingBytecode: Uint8Array; valueSatoshis: bigint; token: any;
  } {
    return {
      lockingBytecode: this.retainLockingBytecode,
      valueSatoshis: RegtestNetworkProvider.RETAINED_MINT_SATOSHIS,
      token: {
        category: hexToBin(category),
        amount: 0n,
        nft: { capability: 'minting' as const, commitment: new Uint8Array() },
      },
    };
  }

  private recordCategory(category: string, txid: string, vout: number, requestedLabel?: string): void {
    this.retainedMinting.set(category, {
      txid, vout, satoshis: RegtestNetworkProvider.RETAINED_MINT_SATOSHIS,
    });
    this.categoryOfLabel.set(category, category);
    if (requestedLabel) this.categoryOfLabel.set(requestedLabel, category);
  }

  /**
   * Does this category exist on this chain? Answerable EXACTLY, because a CashTokens category id is the txid
   * of the transaction whose output 0 the genesis spent - so every real category id is a real txid, and a
   * placeholder label like `'77'.repeat(32)` is not. A node without `txindex` answers "no" for old
   * transactions, which degrades to the pre-X74 genesis path rather than to a wrong mint.
   */
  private async categoryExistsOnChain(category: string): Promise<boolean> {
    try {
      await this.probeRpc.request<GetRawTransactionVerbosity0>('getrawtransaction', category, false);
      return true;
    } catch {
      return false;
    }
  }

  private static normalizeCategory(category: string | undefined): string {
    if (typeof category !== 'string') return '';
    const lower = category.toLowerCase();
    return lower.length === 64 && isHex(lower) ? lower : '';
  }

  // ---------------------------------------------------------------------------
  // Test helper: addTokenUtxos / addTokenUtxosDynamic
  // ---------------------------------------------------------------------------

  async addTokenUtxos(
    outputs: TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    return this.addTokenUtxosDynamic(() => outputs);
  }

  async addTokenUtxosDynamic(
    outputsFactory: (categoryId: string) => TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    await this.ensureReady();
    return this.withFundingLock(() => this.addTokenUtxosDynamicUnlocked(outputsFactory));
  }

  private async addTokenUtxosDynamicUnlocked(
    outputsFactory: (categoryId: string) => TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    await this.rpc.request<GenerateToAddress>('generatetoaddress', 1, this.miningAddress);

    // The genesis input must be VALIDATED LIVE, not merely listed. `listunspent` on this shared wallet reports
    // coins it still believes unspent, so taking the first one produced two different failures on two
    // consecutive runs - `Input not found or already spent` when signing, and `txn-mempool-conflict` when a
    // rapid second genesis reached for the same coin. `pickLiveFundingInput` confirms each candidate with
    // `gettxout` including the mempool, which is the same rule the funding path already follows.
    let genesisInput: ListUnspentItem;
    try {
      genesisInput = await this.pickLiveFundingInput(true);
    } catch {
      await this.createVout0Utxo();
      genesisInput = await this.pickLiveFundingInput(true);
    }
    const categoryId = genesisInput.txid;
    const outputs = outputsFactory(categoryId);
    for (const out of outputs) await this.importAddressIfNeeded(out.address);

    const categoryBin = hexToBin(categoryId);
    const libauthOutputs = outputs.map((out) => ({
      lockingBytecode: this.toLockingBytecode(out.address),
      valueSatoshis: out.satoshis < 546n ? 546n : out.satoshis,
      token: out.token ? {
        category: categoryBin,
        amount: out.token.amount,
        nft: out.token.nft ? {
          capability: out.token.nft.capability,
          commitment: hexToBin(out.token.nft.commitment),
        } : undefined,
      } : undefined,
    }));

    // X74. The genesis keeps a minting NFT for this category at the provider's own address, so a later
    // addUtxo can mint INTO the category instead of substituting a fresh one. It is appended after every
    // requested output, so the caller's vouts are unchanged; `collectCreatedUtxos` skips it by vout.
    const retainedVout = libauthOutputs.length;
    const unsignedTx = this.buildLibauthTx(
      genesisInput, [...libauthOutputs, this.retainedMintingOutput(categoryId)],
    );
    try {
      const txid = await this.fundSignSend(unsignedTx);
      await this.mineBlocks(1, false);
      this.recordCategory(categoryId, txid, retainedVout);
      return await this.collectCreatedUtxos(txid, categoryId, outputs, retainedVout);
    } finally {
      this.releaseFunding(genesisInput);
    }
  }

  // ---------------------------------------------------------------------------
  // Test helper: real block-info oracle
  // ---------------------------------------------------------------------------

  /**
   * Deploy a real block-info oracle at a genesis category. The mock provider installs an in-memory oracle; on a
   * live chain the NFT must have a real CashTokens category, so this creates a vout-0 genesis and publishes its
   * p2sh32 covenant as `blockOracleLock`.
   */
  private async installBlockOracle(): Promise<void> {
    const ownerPubkey = secp256k1.derivePublicKeyCompressed(this.blockOracleOwnerKey) as Uint8Array;
    const ownerPkh = hash160(ownerPubkey);
    const ownerAddressResult = lockingBytecodeToCashAddress({
      bytecode: publicKeyToP2PKHLockingBytecode(ownerPubkey),
      prefix: getNetworkPrefix(this.network),
    });
    const ownerAddress = typeof ownerAddressResult === 'string'
      ? ownerAddressResult
      : ownerAddressResult.address;
    this.blockOracleOwnerAddress = ownerAddress;
    await this.addUtxo(ownerAddress, randomUtxo({ satoshis: 100_000_000n }));

    const commitment = encodeBlockOracleCommitment(ownerPkh, await this.oracleFields());
    const { categoryId } = await this.addTokenUtxosDynamic((category) => {
      const lock = blockOracleLockingBytecode(hexToBin(category));
      const addressResult = lockingBytecodeToCashAddress({
        bytecode: lock,
        prefix: getNetworkPrefix(this.network),
        tokenSupport: true,
      });
      const address = typeof addressResult === 'string' ? addressResult : addressResult.address;
      return [{
        address,
        satoshis: 10_000n,
        token: {
          amount: 0n,
          nft: { capability: 'mutable' as const, commitment: binToHex(commitment) },
        },
      }];
    });
    this.blockOracleCategory = hexToBin(categoryId);
    this.blockOracleLock = blockOracleLockingBytecode(this.blockOracleCategory);
  }

  private async oracleFields(number?: bigint): Promise<BlockOracleCommitmentFields> {
    return {
      number: number ?? BigInt(await this.getBlockHeight()),
      // A final update can publish at most the last second below median-time-past.
      timestamp: BigInt(Math.max(0, this.getBlockTime() - 1)),
      difficulty: 0n,
      size: 1000n,
      totalFees: 0n,
      coinbase: hexToBin(`76a914${'00'.repeat(20)}88ac`),
    };
  }

  /**
   * Push the node's current height and time into the oracle through its signed update path. The mock provider
   * rewrites its in-memory NFT; a real node admits only a covenant spend, so this pays the keeper fee and
   * CLTV-anchors the new timestamp.
   */
  async refreshBlockOracle(): Promise<void> {
    await this.refreshBlockOracleUpdate(false);
  }

  /** Publish the next update without confirming it; the block the caller mines next includes it. */
  private async publishBlockOracleUpdate(): Promise<void> {
    await this.refreshBlockOracleUpdate(true);
  }

  private async refreshBlockOracleUpdate(deferred: boolean): Promise<void> {
    const lock = this.blockOracleLock;
    const category = this.blockOracleCategory;
    if (lock === undefined || category === undefined || this.blockOracleRefreshing) return;
    const oracle = (await this.getUtxosForLockingBytecode(lock))
      .find((utxo) => utxo.token?.nft?.capability === 'mutable');
    if (oracle?.token?.nft === undefined) return;
    const current = hexToBin(oracle.token.nft.commitment);
    const currentTimestamp = current.length >= 30 ? blockOracleFieldValue(current, 'timestamp') : 0n;
    const desired = await this.oracleFields();
    if (desired.timestamp <= currentTimestamp) return;

    const fields = {
      ...desired,
      number: current.length >= 30 ? blockOracleFieldValue(current, 'number') : desired.number,
    };
    const commitment = encodeBlockOracleCommitment(
      hash160(secp256k1.derivePublicKeyCompressed(this.blockOracleOwnerKey) as Uint8Array), fields,
    );
    const funding = await this.pickOracleFeeCoin();
    this.blockOracleRefreshing = true;
    this.deferredOracleMine = deferred;
    try {
      const [{ TransactionBuilder }, signatureModule, { blockOracleUpdateUnlocker }] = await Promise.all([
        import('../TransactionBuilder.js'),
        import('../SignatureTemplate.js'),
        import('../oracle/blockOracleUpdater.js'),
      ]);
      const SignatureTemplate = signatureModule.default;
      await new TransactionBuilder({ provider: this })
        .addInput(oracle, blockOracleUpdateUnlocker(
          category, lock, this.blockOracleOwnerKey, commitment,
        ))
        .addInput(funding, new SignatureTemplate(this.blockOracleOwnerKey).unlockP2PKH())
        .addOutput({
          to: lock,
          amount: oracle.satoshis,
          token: {
            category: oracle.token.category,
            amount: 0n,
            nft: { capability: 'mutable', commitment: binToHex(commitment) },
          },
        })
        .addOutput({ to: this.blockOracleOwnerAddress, amount: funding.satoshis - 1000n })
        .setLocktime(Number(desired.timestamp))
        .send();
      if (deferred) this.pendingOracleUpdate = true;
    } finally {
      this.deferredOracleMine = false;
      this.blockOracleRefreshing = false;
    }
  }

  /** A failed read throws: reporting it as spent dropped live records from a caller's view of the chain. */
  private async isLiveOutpoint(txid: string, vout: number): Promise<boolean> {
    return await this.readRpc.request<GetTxOut>('gettxout', txid, vout, true) !== null;
  }

  private async pickOracleFeeCoin(): Promise<Utxo> {
    const ownerPubkey = secp256k1.derivePublicKeyCompressed(this.blockOracleOwnerKey) as Uint8Array;
    const coin = (await this.getUtxosForLockingBytecode(publicKeyToP2PKHLockingBytecode(ownerPubkey)))
      .filter((utxo) => utxo.token === undefined)
      .sort((left, right) => Number(right.satoshis - left.satoshis))[0];
    if (coin === undefined || coin.satoshis < 2000n) {
      throw new Error('the block oracle owner has no coin to pay an update fee');
    }
    return coin;
  }

  // ---------------------------------------------------------------------------
  // Test helper: mine / reset / snapshots / time travel
  // ---------------------------------------------------------------------------

  async mine(count: number = 1): Promise<void> {
    await this.mineBlocks(count, true);
  }

  private async mineBlocks(count: number, publishOracle: boolean): Promise<void> {
    await this.ensureReady();
    if (this.pendingBlockTimestamp !== undefined) {
      await this.setMockTime(this.pendingBlockTimestamp);
      this.mockTime = this.pendingBlockTimestamp;
      this.tipTime = this.pendingBlockTimestamp;
      this.lastMinedTimestamp = this.pendingBlockTimestamp;
      this.pendingBlockTimestamp = undefined;
    } else if (this.holdMockTime === 0) {
      // Every ordinary mine moves the mock clock forward by at least one second. A fixture restore disconnects
      // blocks BCHN keeps marked invalid; re-mining one at its old time would repeat its hash, so a restore pays
      // later blocks to a fresh address instead of keeping the clock ahead of every block ever mined. Kept ahead,
      // the clock ran 75 hours past the fixture in a kernel cell and entries with a 120-second window had expired.
      const timestamp = Math.max(this.tipTime + 1, this.lastMinedTimestamp + 1);
      await this.setMockTime(timestamp);
      this.mockTime = timestamp;
      this.lastMinedTimestamp = timestamp;
    }
    await this.rpc.request<GenerateToAddress>('generatetoaddress', count, this.miningAddress);
    // The generated block includes whichever oracle update was in the mempool.
    this.pendingOracleUpdate = false;
    // BCHN admits an nLocktime only below median-time-past, and the SDK stamps one second behind
    // `getBlockTime()`. Track the node's MTP rather than the newest header's wall-clock time.
    this.tipTime = await this.readTipTime();
    this.fundingCandidates = undefined;
    // Every mined block moves the block oracle one second forward (the mock chain rewrites it in place when a
    // block is mined). Publish the update now, unmined, so a `block.timestamp` reader built from this point
    // co-spends the newer oracle UTXO and the caller's next block confirms both. Sends that run inside the
    // broadcast queue skip this and publish after their queue entry settles, since publishing is a send itself.
    if (publishOracle) await this.publishOracleIfDue();
  }

  /** Publish the next oracle update into the mempool when nothing prevents it. */
  private async publishOracleIfDue(): Promise<void> {
    if (this.blockOracleCategory === undefined || this.holdMockTime !== 0
      || this.blockOracleRefreshing || this.deferredOracleMine) return;
    await this.publishBlockOracleUpdate();
  }

  /**
   * Clear provider caches without rewinding the chain. Fixture snapshots own chain rewinds; a reset that
   * invalidated blocks would also invalidate those snapshots, so the chain is left alone here.
   */
  async reset(): Promise<void> {
    this.fundingCandidates = undefined;
    this.feeFunderPool.clear();
    this.feeFunderRefill.clear();
    this.feeFunderSizeRequests.clear();
    this.feeFunderByRequest.clear();
    runMockNetworkProviderResetHooks();
    this.pendingBlockTimestamp = undefined;
    this.mockTime = 0;
    await this.setMockTime(0);
    this.tipTime = await this.readTipTime();
  }

  /** Median-time-past of the tip, which is the node's time basis for nLocktime finality. */
  getBlockTime(): number {
    return this.tipTime || Math.floor(Date.now() / 1000);
  }

  /** Apply a timestamp to the next mined block. The node is only changed when that block is mined. */
  setNextBlockTimestamp(timestamp: number | bigint): void {
    this.pendingBlockTimestamp = Number(timestamp);
  }

  /**
   * Advance the node's mock clock. Median-time-past only moves after several blocks, so mine a full
   * median window (11 blocks) at the new time; the SDK's stamp and the node's finality check then agree.
   */
  async increaseTime(seconds: number | bigint): Promise<number> {
    const base = Math.max(this.tipTime, this.lastMinedTimestamp);
    // One extra second lets the oracle publish `MTP - 1` at the requested timestamp; the oracle covenant
    // cannot publish the current MTP because its own nLocktime must stay below MTP.
    const timestamp = Math.max(0, base + Number(seconds) + 1);
    await this.setMockTime(timestamp);
    this.mockTime = timestamp;
    this.lastMinedTimestamp = timestamp;
    // Ten blocks move the median window to `timestamp`; the signed oracle update is the eleventh block.
    this.holdMockTime = timestamp;
    try {
      await this.mine(10);
      await this.refreshBlockOracle();
    } finally {
      this.holdMockTime = 0;
    }
    return timestamp;
  }

  async takeSnapshot(): Promise<SnapshotRestorer> {
    await this.ensureReady();
    await this.quiesceSends();
    // A snapshot must not leave the oracle update in the mempool: the rewind clears the mempool, and the
    // restored chain would then have a confirmed oracle outpoint this provider no longer tracks (the wallet
    // cannot rediscover a watch-only output it did not see mined). Confirm it first.
    if (this.pendingOracleUpdate) await this.mineBlocks(1, false);
    const height = await this.readRpc.request<GetBlockCount>('getblockcount');
    const hash = await this.readRpc.request<GetBlockHash>('getblockhash', height);
    const snapshotId = `regtest-${this.snapshotNonce++}`;
    const state: RegtestSnapshotState = {
      height,
      hash,
      mockTime: this.mockTime,
      tipTime: this.tipTime,
      pendingBlockTimestamp: this.pendingBlockTimestamp,
      retainedMinting: new Map(this.retainedMinting),
      categoryOfLabel: new Map(this.categoryOfLabel),
      importedAddresses: new Set(this.importedAddresses),
      tokenUtxos: new Map([...this.tokenUtxos].map(([category, bucket]) => [category, new Map(bucket)])),
      broadcastUtxos: new Map(this.broadcastUtxos),
      lastMinedTimestamp: this.lastMinedTimestamp,
    };
    return {
      snapshotId,
      restore: async (): Promise<void> => {
        await this.restoreSnapshot(state);
      },
    };
  }

  /**
   * Hardhat's raw JSON-RPC surface. The EVM time helpers map to BCHN's regtest mock clock; snapshot and mine
   * map to the same primitives `loadFixture` uses.
   */
  async send(method: string, params: unknown[] = []): Promise<unknown> {
    switch (method) {
      case 'evm_snapshot': {
        const restorer = await this.takeSnapshot();
        this.snapshotRestorers.set(restorer.snapshotId, restorer);
        return restorer.snapshotId;
      }
      case 'evm_revert': {
        const restorer = this.snapshotRestorers.get(String(params[0]));
        if (!restorer) return false;
        await restorer.restore();
        return true;
      }
      case 'evm_mine':
        await this.mine(1);
        return '0x0';
      case 'evm_increaseTime':
        return this.increaseTime(Number(params[0]));
      case 'evm_setNextBlockTimestamp':
        this.setNextBlockTimestamp(Number(params[0]));
        return null;
      case 'evm_setAutomine':
      case 'evm_setIntervalMining':
        return null; // every broadcast already mines one block
      case 'eth_blockNumber':
        return `0x${(await this.getBlockHeight()).toString(16)}`;
      case 'eth_chainId':
      case 'net_version':
        return '0x0';
      default:
        throw new Error(`RegtestNetworkProvider.send: unsupported JSON-RPC method '${method}'.`);
    }
  }

  /**
   * Rewind to a snapshot by invalidating the first block above it. BCHN returns the disconnected
   * transactions to the mempool, so `clearmempool` drops them before the next test starts.
   */
  private async restoreSnapshot(state: RegtestSnapshotState): Promise<void> {
    // A restore must not interleave with a broadcast that is still mining: that send would land above the
    // rewind and leave wallet entries the restored chain cannot explain.
    await this.quiesceSends();
    const height = await this.readRpc.request<GetBlockCount>('getblockcount');
    if (height < state.height) {
      // An earlier fixture snapshot already rewound the chain below this one, so this snapshot's chain state
      // and clock are not present any more. Keep the earlier chain and its provider view untouched: applying
      // the later clock would stamp future locktimes on transactions the restored chain refuses as non-final.
      return;
    }
    if (height > state.height) {
      const firstAbove = await this.readRpc.request<GetBlockHash>('getblockhash', state.height + 1);
      await this.rpc.request<InvalidateBlock>('invalidateblock', firstAbove);
    }
    const restoredHash = await this.readRpc.request<GetBlockHash>('getblockhash', state.height);
    if (restoredHash !== state.hash) {
      throw new Error(
        `regtest snapshot restore: block ${state.height} is ${restoredHash}, expected ${state.hash}`,
      );
    }
    await this.rpc.request<ClearMempool>('clearmempool');
    // Invalidateblock leaves wallet entries from the disconnected branch looking spendable. Rescan first so
    // those entries lose their stale confirmations, abandon the txs that are no longer in the mempool, then
    // rescan once more so the wallet's coin set matches the restored UTXO set.
    await this.rpc.request<RescanBlockchain>('rescanblockchain', 0);
    const mempool = new Set(Object.keys(await this.readRpc.request<GetRawMempoolVerbose>('getrawmempool', true)));
    // Abandon every transaction this provider broadcast that the restored chain and mempool lack, not only the
    // ones since the snapshot: once a later conflicting spend was mined, the wallet replaced an earlier abandon
    // with that block, and rewinding the block brought the earlier spender back as unconfirmed, so coins leaked
    // restore by restore. The node refuses the ones confirmed in the restored chain. This needs a node whose
    // `clearmempool` notifies the wallet (bitcoin-cash-node 0be3cfcf3); with a bare clear the wallet kept them
    // flagged in-mempool and an abandon failed a node assertion. The listing covers other processes' sends.
    const stale = new Set(this.broadcastTxids);
    const walletTxs = await this.readRpc.request<ListTransactions>('listtransactions', '*', 1000, 0, true);
    for (const tx of walletTxs) {
      if (tx.confirmations === 0 && !tx.abandoned) stale.add(tx.txid);
    }
    for (const txid of stale) {
      if (mempool.has(txid)) continue;
      try {
        await this.probeRpc.request<AbandonTransaction>('abandontransaction', txid);
      } catch { /* confirmed in the restored chain, conflicted, or already abandoned */ }
    }
    await this.rpc.request<RescanBlockchain>('rescanblockchain', 0);

    this.retainedMinting = new Map(state.retainedMinting);
    this.categoryOfLabel = new Map(state.categoryOfLabel);
    this.importedAddresses = new Set(state.importedAddresses);
    this.tokenUtxos = new Map(
      [...state.tokenUtxos].map(([category, bucket]) => [category, new Map(bucket)]),
    );
    this.broadcastUtxos = new Map(state.broadcastUtxos);
    this.fundingCandidates = undefined;
    this.feeFunderPool.clear();
    this.feeFunderRefill.clear();
    this.feeFunderSizeRequests.clear();
    this.feeFunderByRequest.clear();
    // SDK caches derived from chain state (signer coin snapshots, genesis reservations, job events) describe
    // the branch this rewind disconnected; the mock provider clears them on every restore, and so must this.
    runMockNetworkProviderResetHooks();
    this.pendingBlockTimestamp = state.pendingBlockTimestamp;
    this.mockTime = state.mockTime;
    this.tipTime = state.tipTime;
    this.lastMinedTimestamp = state.lastMinedTimestamp;
    // A fresh coinbase address keeps every block mined from here different from the disconnected ones.
    this.miningAddress = await this.rpc.request<GetNewAddress>('getnewaddress', 'mining');
    this.pendingOracleUpdate = false;
    await this.setMockTime(state.mockTime);
  }

  private async readTipTime(): Promise<number> {
    const height = await this.readRpc.request<GetBlockCount>('getblockcount');
    const hash = await this.readRpc.request<GetBlockHash>('getblockhash', height);
    const header = await this.readRpc.request<GetBlockHeaderTime>('getblockheader', hash, true);
    return header.mediantime;
  }

  private async setMockTime(timestamp: number): Promise<void> {
    await this.rpc.request<SetMockTime>('setmocktime', timestamp);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private trackBroadcastOutputs(txHex: string, txid: string): void {
    this.broadcastTxids.add(txid);
    const tx = decodeTransactionUnsafe(hexToBin(txHex));
    for (const input of tx.inputs) {
      const key = `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`;
      this.broadcastUtxos.delete(key);
      for (const bucket of this.tokenUtxos.values()) bucket.delete(key);
    }
    tx.outputs.forEach((output, vout) => {
      const key = `${txid}:${vout}`;
      const utxo: Utxo = {
        txid,
        vout,
        satoshis: output.valueSatoshis,
        lockingBytecode: output.lockingBytecode.slice(),
        confirmations: 1,
        token: output.token === undefined ? undefined : {
          amount: output.token.amount,
          category: binToHex(output.token.category),
          nft: output.token.nft ? {
            capability: output.token.nft.capability,
            commitment: binToHex(output.token.nft.commitment),
          } : undefined,
        },
      };
      this.broadcastUtxos.set(key, utxo);
      if (utxo.token === undefined) return;
      let bucket = this.tokenUtxos.get(utxo.token.category);
      if (!bucket) {
        bucket = new Map();
        this.tokenUtxos.set(utxo.token.category, bucket);
      }
      bucket.set(key, utxo);
    });
  }

  private buildLibauthTx(
    input: { txid: string; vout: number },
    outputs: Array<{ lockingBytecode: Uint8Array; valueSatoshis: bigint; token?: any }>,
  ): string {
    return binToHex(encodeTransaction({
      version: 2,
      inputs: [{
        outpointTransactionHash: hexToBin(input.txid),
        outpointIndex: input.vout,
        unlockingBytecode: new Uint8Array(),
        sequenceNumber: 0xfffffffe,
      }],
      outputs,
      locktime: 0,
    }));
  }

  // Query only large coins (mature coinbases): the shared wallet can list spent small coins as
  // spendable, which fundrawtransaction then picks, breaking broadcast with "Missing inputs".
  //
  // `listunspent` scans the WHOLE wallet, and a long suite grows it without bound: measured at 18 ms on a fresh
  // chain and 4,690 ms once the wallet reached about 20,000 UTXOs, called at every genesis and every funder
  // refill. Cache the candidate list instead and re-list only when it runs out. Correctness does not rest on the
  // cache being fresh: every candidate is still confirmed live with `gettxout` before use, and a stale entry is
  // simply dropped, which is the same check this function always made.
  private async pickLiveFundingInput(vout0Only: boolean): Promise<ListUnspentItem> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (this.fundingCandidates === undefined) {
        this.fundingCandidates = (await this.readRpc.request<ListUnspent>(
          'listunspent', 1, 9999999, [], true, { minimumAmount: 1 },
        ))
          .filter((u) => u.spendable)
          .sort((a, b) => (a.amount < b.amount ? 1 : -1));
      }
      const pool = this.fundingCandidates;
      for (let i = 0; i < pool.length; i += 1) {
        const u = pool[i];
        if (vout0Only && u.vout !== 0) continue;
        if (this.reservedFunding.has(`${u.txid}:${u.vout}`)) continue;
        // eslint-disable-next-line no-await-in-loop
        const out = await this.readRpc.request<GetTxOut>('gettxout', u.txid, u.vout, true) as
          GetTxOut['response'] | null;
        pool.splice(i, 1);
        if (out) {
          this.reservedFunding.add(`${u.txid}:${u.vout}`);
          return u;
        }
        i -= 1;
      }
      // Nothing usable left in the cache. Re-list once; a second miss is a real exhaustion.
      this.fundingCandidates = undefined;
    }
    throw new Error('No live wallet UTXOs available (>=1 BCH). Mine more blocks.');
  }

  private releaseFunding(item: { txid: string; vout: number }): void {
    this.reservedFunding.delete(`${item.txid}:${item.vout}`);
  }

  // Funding is test plumbing: on the mock chain it mines nothing and the block oracle stays put. Its blocks here
  // publish no oracle update, so a composition that reads `block.timestamp` keeps one oracle while it funds its
  // own slots; the next send or explicit mine catches the oracle up.
  private async fundSignSend(unsignedHex: string): Promise<string> {
    const txid = await this.serializeSend(async () => {
      const tx = decodeTransactionUnsafe(hexToBin(unsignedHex));
      const sats = (value: number): bigint => BigInt(Math.round(value * 1e8));
      const inputValue = async (inputTxid: string, vout: number): Promise<bigint> => {
        const out = await this.readRpc.request<GetTxOut>('gettxout', inputTxid, vout, true) as
          GetTxOut['response'] | null;
        if (out === null) throw new Error(`funding input ${inputTxid}:${vout} is not live`);
        return sats(out.value);
      };

      let valueIn = 0n;
      const retainedKeys = new Set([...this.retainedMinting.values()]
        .map((utxo) => `${utxo.txid}:${utxo.vout}`));
      const tokenCategories = new Set(tx.outputs
        .filter((output) => output.token !== undefined)
        .map((output) => binToHex(output.token!.category)));
      const liveInputs: typeof tx.inputs = [];
      for (const input of tx.inputs) {
        const inputTxid = binToHex(input.outpointTransactionHash);
        const key = `${inputTxid}:${input.outpointIndex}`;
        try {
          valueIn += await inputValue(inputTxid, input.outpointIndex);
          liveInputs.push(input);
        } catch (error) {
          // A dead tokenless funding input can be replaced below. A genesis/category anchor or the retained
          // minting NFT cannot: its outpoint is part of the transaction's consensus meaning.
          if (retainedKeys.has(key) || tokenCategories.has(inputTxid)) throw error;
        }
      }
      tx.inputs = liveInputs;
      const valueOut = tx.outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
      // One satoshi per byte, the stock relay floor, sized from the unsigned encoding plus a P2PKH signature per
      // input and a change output: a refill of many funders outgrows a flat fee.
      const feeFor = (): bigint => BigInt(Math.max(1000, encodeTransaction(tx).length + 110 * tx.inputs.length + 34));
      const added: ListUnspentItem[] = [];
      let needed = valueOut + feeFor() - valueIn;
      try {
        while (needed > 0n) {
          const funding = await this.pickLiveFundingInput(false);
          const value = await inputValue(funding.txid, funding.vout);
          tx.inputs.push({
            outpointTransactionHash: hexToBin(funding.txid),
            outpointIndex: funding.vout,
            sequenceNumber: 0xfffffffe,
            unlockingBytecode: new Uint8Array(),
          });
          added.push(funding);
          valueIn += value;
          needed = valueOut + feeFor() - valueIn;
        }
        const change = valueIn - valueOut - feeFor();
        if (change > 546n) {
          tx.outputs.push({
            lockingBytecode: this.toLockingBytecode(this.miningAddress),
            valueSatoshis: change,
          });
        }
        const signed = await this.rpc.request<SignRawTransactionWithWallet>(
          'signrawtransactionwithwallet', binToHex(encodeTransaction(tx)),
        );
        if (!signed.complete) {
          throw new Error(`Failed to sign: ${signed.errors?.map((e) => e.error).join(', ')}`);
        }
        const sent = await this.rpc.request<SendRawTransaction>('sendrawtransaction', signed.hex);
        this.trackBroadcastOutputs(signed.hex, sent);
        // Confirm before returning: callers mine as well, but a second funding selection must never see a
        // just-spent coin while it is still unconfirmed.
        await this.mineBlocks(1, false);
        return sent;
      } finally {
        for (const funding of added) this.releaseFunding(funding);
      }
    });
    return txid;
  }

  // The requested output is always built first and `fundSignSend` appends change AFTER every output it was
  // given, so the caller's output is at a known vout rather than one searched for by satoshi value.
  private async decodeOutputAt(txid: string, vout: number): Promise<Utxo> {
    const rawHex = await this.readRpc.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, false);
    const decoded = decodeTransactionUnsafe(hexToBin(rawHex));
    const match = decoded.outputs[vout];
    return {
      txid, vout,
      satoshis: match.valueSatoshis,
      token: match.token ? {
        amount: match.token.amount,
        category: binToHex(match.token.category),
        nft: match.token.nft ? {
          capability: match.token.nft.capability as 'none' | 'mutable' | 'minting',
          commitment: binToHex(match.token.nft.commitment),
        } : undefined,
      } : undefined,
    };
  }

  private async collectCreatedUtxos(
    txid: string, categoryId: string, outputs: TokenGenesisOutput[], retainedVout?: number,
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    const rawHex = await this.readRpc.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, false);
    const decoded = decodeTransactionUnsafe(hexToBin(rawHex));

    const tokenOutputs = decoded.outputs
      .map((o, i) => ({ output: o, vout: i }))
      .filter(({ vout }) => vout !== retainedVout)
      .filter(({ output }) => output.token && binToHex(output.token.category) === categoryId)
      .map(({ output, vout }) => ({
        txid, vout,
        satoshis: output.valueSatoshis,
        token: output.token ? {
          amount: output.token.amount,
          category: binToHex(output.token.category),
          nft: output.token.nft ? {
            capability: output.token.nft.capability as 'none' | 'mutable' | 'minting',
            commitment: binToHex(output.token.nft.commitment),
          } : undefined,
        } : undefined,
      }));

    const utxos: Utxo[] = [];
    const used = new Set<number>();
    for (let i = 0; i < outputs.length; i++) {
      const m = tokenOutputs.find((u) => !used.has(u.vout));
      if (!m) throw new Error(`Token UTXO not found (txid=${txid}, cat=${categoryId}, ${tokenOutputs.length}/${outputs.length})`);
      used.add(m.vout);
      utxos.push(m);
    }
    return { categoryId, utxos };
  }

  // CashTokens genesis must spend an outpoint at index 0, so the wallet needs coins at vout 0 worth at least
  // the `minimumAmount: 1` that `pickLiveFundingInput` filters on. Mining cannot supply them: regtest halves the
  // subsidy every 150 blocks, so past roughly height 2,500 every coinbase is worth zero. `sendtoaddress` cannot
  // either - it picks the change position itself, and on this fragmented wallet it puts small change at vout 0
  // and the payment at vout 1, satisfying neither filter. Build the transaction explicitly instead: the
  // requested output takes vout 0 and `fundSignSend` appends change after it.
  private async createVout0Utxo(): Promise<void> {
    const addr = await this.rpc.request<GetNewAddress>('getnewaddress', 'vout0');
    await this.importAddressIfNeeded(addr);
    const fundingInput = await this.pickLiveFundingInput(false);
    const unsignedHex = this.buildLibauthTx(fundingInput, [{
      lockingBytecode: this.toLockingBytecode(addr),
      valueSatoshis: RegtestNetworkProvider.VOUT0_FUNDING_SATOSHIS,
    }]);
    try {
      await this.fundSignSend(unsignedHex);
      await this.mineBlocks(1, false);
    } finally {
      this.releaseFunding(fundingInput);
    }
    // The coin just minted is not in the cached list, and the caller is about to ask for exactly it.
    this.fundingCandidates = undefined;
  }

  // One builder path asks for `neededFee + DUST + deficit`, which differs almost every call, so batching coins
  // for every distinct value would mint many to spend 1 and bloat the wallet - and `pickLiveFundingInput` is
  // already O(wallet). Batch only values that have been asked for before; mint exactly one the first time. A
  // repeated value (the 5,000-satoshi layout funders) comes in batches of 100: every refill mines, and with 20 a
  // re-planned kernel composition spent most of its time refilling.
  private async refillFeeFunderPool(satoshis: bigint): Promise<void> {
    const seen = (this.feeFunderSizeRequests.get(satoshis) ?? 0) + 1;
    this.feeFunderSizeRequests.set(satoshis, seen);
    const POOL_SIZE = seen > 1 ? 100 : 1;
    const pool = this.feeFunderPool.get(satoshis) ?? [];
    if (pool.length >= POOL_SIZE) return;
    const needed = POOL_SIZE - pool.length;
    const lbc = hexToBin(RegtestNetworkProvider.DUMMY_FUNDER_LBC);

    // Seed with one validated-live coin so fundrawtransaction never reaches for stale
    // small coins. Funders land at vouts 0..needed-1; fundSignSend appends change after them.
    const fundingInput = await this.pickLiveFundingInput(false);
    const unsignedHex = this.buildLibauthTx(
      fundingInput,
      Array.from({ length: needed }, () => ({ lockingBytecode: lbc, valueSatoshis: satoshis })),
    );
    try {
      const txid = await this.fundSignSend(unsignedHex);
      await this.mineBlocks(1, false);
      for (let i = 0; i < needed; i++) {
        pool.push({ txid, vout: i, satoshis, lockingBytecode: lbc, confirmations: 1 });
      }
      this.feeFunderPool.set(satoshis, pool);
    } finally {
      this.releaseFunding(fundingInput);
    }
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.initialize();
    await this.ready;
    // Install after the base ready promise resolves: oracle setup itself uses addUtxo/addTokenUtxos, which call
    // back into ensureReady.
    if (!this.blockOracleInstalled) {
      this.blockOracleInstalled = true;
      try {
        await this.installBlockOracle();
      } catch (error) {
        this.blockOracleInstalled = false;
        throw error;
      }
    }
  }

  private async initialize(): Promise<void> {
    this.miningAddress = await this.rpc.request<GetNewAddress>('getnewaddress', 'mining');
    // X74. A dedicated wallet address holds the retained minting NFTs. It is never mined to and never handed
    // out as a funding coin (`pickLiveFundingInput` and `fundrawtransaction` both skip token UTXOs), so the
    // capability survives for the life of the provider.
    this.retainAddress = await this.rpc.request<GetNewAddress>('getnewaddress', 'retained-minting');
    this.retainLockingBytecode = this.toLockingBytecode(this.retainAddress);
    const height = await this.readRpc.request<GetBlockCount>('getblockcount');
    if (height === 0) {
      // Pin the node's clock before its first block so every mined timestamp is derived from this epoch.
      await this.setMockTime(RegtestNetworkProvider.DEFAULT_BLOCK_TIME);
      this.mockTime = RegtestNetworkProvider.DEFAULT_BLOCK_TIME;
      this.lastMinedTimestamp = RegtestNetworkProvider.DEFAULT_BLOCK_TIME;
    }
    if (height < 200) {
      await this.rpc.request<GenerateToAddress>('generatetoaddress', 200 - height, this.miningAddress);
    }
    this.tipTime = await this.readTipTime();
    if (height === 0) this.lastMinedTimestamp = this.tipTime;
  }

  private toLockingBytecode(addressOrHex: string): Uint8Array {
    if (isHex(addressOrHex)) return hexToBin(addressOrHex);
    const result = cashAddressToLockingBytecode(addressOrHex);
    if (typeof result === 'string') throw new Error(`Invalid address: ${addressOrHex}`);
    return result.bytecode;
  }

  private async importAddressIfNeeded(address: string): Promise<void> {
    if (this.importedAddresses.has(address)) return;
    try { await this.rpc.request<ImportAddress>('importaddress', address, '', false); } catch { /* */ }
    this.importedAddresses.add(address);
  }

  private listUnspentItemToUtxo(u: ListUnspentItem): Utxo {
    return {
      txid: u.txid,
      vout: u.vout,
      satoshis: BigInt(u.amount.toFixed(8).replace('.', '')),
      lockingBytecode: hexToBin(u.scriptPubKey),
      confirmations: u.confirmations,
      token: u.tokenData ? {
        amount: BigInt(u.tokenData.amount),
        category: u.tokenData.category,
        nft: u.tokenData.nft,
      } : undefined,
    };
  }
}
