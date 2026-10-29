import { sha256 as sha256Instance } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToHex, hexToBin, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { ElectrumClient, type ElectrumClientEvents } from '@electrum-cash/network';
import { HDSigner, signersFromMnemonic } from '../HDSigner.js';
import type Signer from '../Signer.js';
import { Network, type TokenDetails, type Utxo } from '../interfaces.js';
import { addressToLockScript, randomUtxo } from '../utils.js';

/** The HRE's account branch, duplicated here so this module does not import the testing package. */
const HARDHAT_ACCOUNT_BRANCH = "m/44'/60'/0'/0";
import type NetworkProvider from './NetworkProvider.js';
import type { ConsensusLimits, LedgerOutput, NetworkPolicy, PreparedTransaction } from './NetworkProvider.js';
import { runMockNetworkProviderResetHooks } from './mock-reset.js';
import { TokenWebSocket } from './TokenWebSocket.js';

/** The Hardhat test phrase, so a zero-config provider matches a zero-config node. */
export const MEM_CASH_DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';

export interface MemCashProviderOptions {
  /** ws://host:port[/] or wss://host:port[/]. Default ws://127.0.0.1:8545. A non-root path is rejected. */
  readonly url?: string;
  readonly hostname?: string;
  readonly port?: number;
  readonly encrypted?: boolean;
  /** Passed to TokenWebSocket as `?token=`; required when the URL is not loopback. */
  readonly token?: string;
  readonly mnemonic?: string;
  /** Defaults to the node's advertised `accounts.path`. */
  readonly derivationPath?: string;
  readonly initialIndex?: number;
  readonly requestTimeoutMs?: number;
  readonly connectTimeoutMs?: number;
  /** Forward `evm_setAutomine`/`evm_setIntervalMining` to the shared node. Default false (no-op). */
  readonly controlMining?: boolean;
  /** Forward `hardhat_reset` to the shared node. Default false (no-op). */
  readonly controlChain?: boolean;
  readonly blockOracleCategory?: Uint8Array;
}

export interface SignerOptions {
  readonly mnemonic?: string;
  readonly path?: string;
  readonly initialIndex?: number;
  /** Accepted for interface parity with MockNetworkProvider; the node prepays, so it is ignored. */
  readonly satoshis?: bigint;
  readonly fundingUtxos?: number;
  readonly genesisFundingUtxos?: number;
}

/** The snapshot handle `takeSnapshot()` returns; `restore()` is repeatable. */
export interface SnapshotRestorer {
  readonly snapshotId: string;
  restore(): Promise<void>;
}

interface TipCache {
  height: number;
  hex: string;
  timestamp: number;
  /** Median time past: the node's nLocktime time basis, as `RegtestNetworkProvider` tracks it. */
  medianTimePast: number;
}

interface DevnetFeatures {
  api_version?: number;
  path?: string;
  accounts?: { path?: string; count?: number; initial_index?: number };
  block_oracle?: { lock: string; category: string; outpoint: { txid: string; vout: number } } | null;
  evm_rpc?: boolean;
  consensus?: Record<string, unknown>;
  policy?: { enforce_dust?: boolean };
}

/** Parse `0x`-prefixed or decimal quantities used by EVM-shaped calls. */
function quantity(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string') {
    const parsed = /^0x[0-9a-fA-F]+$/.test(value)
      ? Number.parseInt(value.slice(2), 16)
      : /^\d+$/.test(value) ? Number.parseInt(value, 10) : Number.NaN;
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new Error(`Expected a hexadecimal or decimal quantity, received ${String(value)}`);
}

function isLoopback(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

/**
 * A client for a running `solidhat node` devnet.
 *
 * One persistent WebSocket, profile discovery at connect, local signer derivation mirrored from the node's
 * `accounts.path`, client-side `send()` translation, and the test helpers `network-helpers` uses.
 */
export default class MemCashNetworkProvider implements NetworkProvider {
  readonly network: Network;
  consensusLimits: ConsensusLimits = {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 520,
    maximumTransactionBytes: 1_000_000,
    maximumNftCommitmentBytes: 40,
    operationCostBudgetPerByte: 800,
    hashDigestIterationsPerByte: 1,
  };
  policy: NetworkPolicy = { enforceDust: true };
  readonly simulator = true;
  /** Informational mirror of `server.features.devnet.evm_rpc`; `send()` never branches on it. */
  evmRpc = false;
  blockOracleCategory?: Uint8Array;
  blockOracleLock?: Uint8Array;

  /** The mock's constant EVM-shaped surface, read directly by ported suites. */
  readonly _network: { readonly chainId: number; readonly name: string } = { chainId: 1, name: 'chipnet' };

  private readonly options: MemCashProviderOptions;
  private readonly mnemonic: string;
  private client?: ElectrumClient<ElectrumClientEvents>;
  private connected?: Promise<void>;
  private tip?: TipCache;
  private nodeAccountsPath?: string;
  private readonly signers = new Map<number, HDSigner>();
  private readonly restorers = new Map<string, SnapshotRestorer>();
  /** Signers whose nonce has been seeded from the chain in this process. */
  private readonly seeded = new WeakSet<Signer>();
  private disconnected = false;

  constructor(network?: Network, options: MemCashProviderOptions = {}) {
    this.network = network ?? Network.MOCKNET;
    this.options = options;
    this.mnemonic = options.mnemonic ?? MEM_CASH_DEFAULT_MNEMONIC;
    if (options.blockOracleCategory !== undefined) this.blockOracleCategory = options.blockOracleCategory;
  }

  get _internalBlockNumber(): { respTime: number; blockNumber: number } {
    return { respTime: this.getBlockTime(), blockNumber: this.tip?.height ?? 0 };
  }

  /** The negotiated endpoint, from `url` or the host/port options. */
  get endpoint(): { hostname: string; port: number; encrypted: boolean } {
    const url = this.options.url;
    if (url !== undefined) {
      const parsed = new URL(url);
      if (parsed.pathname !== '/' && parsed.pathname !== '') {
        throw new Error(`MemCashNetworkProvider: the devnet serves WebSocket at "/", not "${parsed.pathname}"`);
      }
      return {
        hostname: parsed.hostname,
        port: parsed.port === '' ? (parsed.protocol === 'wss:' ? 443 : 80) : Number(parsed.port),
        encrypted: parsed.protocol === 'wss:',
      };
    }
    return {
      hostname: this.options.hostname ?? '127.0.0.1',
      port: this.options.port ?? 8545,
      encrypted: this.options.encrypted ?? false,
    };
  }

  /** Open the socket, negotiate the protocol, and verify the node's account branch. */
  async connect(): Promise<void> {
    if (this.connected !== undefined) return this.connected;
    this.connected = this.doConnect();
    try {
      await this.connected;
    } catch (error) {
      this.connected = undefined;
      this.client = undefined;
      throw error;
    }
    return this.connected;
  }

  private async doConnect(): Promise<void> {
    const { hostname, port, encrypted } = this.endpoint;
    if (!isLoopback(hostname) && (this.options.token === undefined || this.options.token === '')) {
      throw new Error('this devnet is not on loopback and no token was configured (memCash.token / --token)');
    }
    const endpoint = `ws://${hostname}:${port}`;
    const socket = new TokenWebSocket(hostname, {
      port,
      encrypted,
      timeoutInMilliSeconds: this.options.connectTimeoutMs ?? 5_000,
      ...(this.options.token === undefined ? {} : { token: this.options.token }),
    });
    const client = new ElectrumClient<ElectrumClientEvents>('SolidCash Application', '1.5.0', socket as never);
    this.client = client;
    try {
      await client.connect();
    } catch (error) {
      this.client = undefined;
      throw new Error(
        `Network "${this.network}": unable to reach the mem-cash devnet at ${endpoint} `
        + `(${error instanceof Error ? error.message : String(error)}). `
        + 'Is `solidhat node` running? Configure memCash.url / memCash.port, and memCash.token for an exposed node.',
      );
    }

    const features = await this.call<{ devnet?: DevnetFeatures }>('server.features');
    if (features.devnet === undefined) {
      throw new Error(
        `The endpoint at ${hostname}:${port} is not a mem-cash devnet (no devnet capability in server.features). `
        + 'Start one with `solidhat node`.',
      );
    }
    this.applyProfile(features.devnet);

    // Path-then-mnemonic verification, so a deploy-only script gets the diagnostic before it builds.
    const first = await this.call<{ path: string; address: string }[]>('devnet.accounts', 0, 1);
    const advertisedPath = features.devnet.accounts?.path;
    if (advertisedPath !== undefined) this.nodeAccountsPath = advertisedPath;
    const expectedPath = this.options.derivationPath ?? advertisedPath;
    const account = first[0];
    if (account !== undefined && expectedPath !== undefined && !this.samePath(account.path, expectedPath, 0)) {
      throw new Error(this.pathMismatchMessage(account.path, expectedPath));
    }
    if (account !== undefined) {
      const local = signersFromMnemonic(this.mnemonic, this, {
        path: expectedPath ?? HARDHAT_ACCOUNT_BRANCH,
        count: 1,
      })[0];
      if (local !== undefined && local.getAddress() !== account.address) {
        throw new Error(this.mnemonicMismatchMessage(account.path, account.address, local.getAddress()));
      }
    }

    // Seed the synchronous tip cache, then keep it current from block notifications.
    const tip = await this.call<{ height: number; hex: string }>('blockchain.headers.get_tip');
    const info = await this.call<{ medianTimePast: number }>('devnet.info');
    this.tip = {
      height: tip.height,
      hex: tip.hex,
      timestamp: this.headerTimestamp(tip.hex),
      medianTimePast: info.medianTimePast,
    };
    client.on('notification', (notification: { method?: string; params?: unknown[] }) => {
      if (notification.method !== 'blockchain.headers.subscribe') return;
      const header = notification.params?.[0] as { height?: number; hex?: string } | undefined;
      if (header?.hex === undefined || header.height === undefined) return;
      this.observeHeader(header.height, header.hex);
    });
    await client.subscribe('blockchain.headers.subscribe');

    this.disconnected = false;
  }

  private applyProfile(devnet: DevnetFeatures): void {
    if ((devnet.api_version ?? 0) < 1) {
      throw new Error(`The devnet speaks api_version ${devnet.api_version}; this client requires >= 1.`);
    }
    this.evmRpc = devnet.evm_rpc === true;
    if (devnet.accounts?.path !== undefined) this.nodeAccountsPath = devnet.accounts.path;
    if (devnet.consensus !== undefined) {
      const consensus = devnet.consensus;
      this.consensusLimits = {
        maximumInputBytes: Number(consensus.maximum_input_bytes ?? this.consensusLimits.maximumInputBytes),
        maximumStackItemBytes: Number(consensus.maximum_stack_item_bytes ?? this.consensusLimits.maximumStackItemBytes),
        maximumTransactionBytes: Number(consensus.maximum_transaction_bytes ?? this.consensusLimits.maximumTransactionBytes),
        maximumNftCommitmentBytes: Number(
          consensus.maximum_nft_commitment_bytes ?? this.consensusLimits.maximumNftCommitmentBytes,
        ),
        operationCostBudgetPerByte: Number(
          consensus.operation_cost_budget_per_byte ?? this.consensusLimits.operationCostBudgetPerByte,
        ),
        hashDigestIterationsPerByte: Number(
          consensus.hash_digest_iterations_per_byte ?? this.consensusLimits.hashDigestIterationsPerByte,
        ),
        ...(consensus.hash_digest_iterations_per_byte_standard === undefined ? {} : {
          hashDigestIterationsPerByteStandard: Number(consensus.hash_digest_iterations_per_byte_standard),
        }),
        ...(consensus.hash_digest_iterations_per_byte_nonstandard === undefined ? {} : {
          hashDigestIterationsPerByteNonstandard: Number(consensus.hash_digest_iterations_per_byte_nonstandard),
        }),
      };
    }
    if (devnet.policy !== undefined) {
      this.policy = { enforceDust: devnet.policy.enforce_dust ?? this.policy.enforceDust };
    }
    const oracle = devnet.block_oracle ?? null;
    if (oracle !== null) {
      this.blockOracleLock = hexToBin(oracle.lock);
      this.blockOracleCategory = hexToBin(oracle.category);
    }
  }

  private headerTimestamp(hex: string): number {
    const bytes = hexToBin(hex);
    if (bytes.length < 72) return 0;
    return new DataView(bytes.buffer, bytes.byteOffset + 68, 4).getUint32(0, true);
  }

  /** Track the tip; a notification that does not extend the cached tip is a rewind. */
  private observeHeader(height: number, hex: string): void {
    const previous = this.tip;
    const isRewind = previous !== undefined && height < previous.height;
    this.tip = {
      height,
      hex,
      timestamp: this.headerTimestamp(hex),
      // MTP is non-decreasing across a healthy chain; keep the last known value until an explicit refresh.
      medianTimePast: previous?.medianTimePast ?? this.headerTimestamp(hex),
    };
    if (isRewind) {
      for (const signer of this.signers.values()) this.seeded.delete(signer);
      runMockNetworkProviderResetHooks();
    }
  }

  /** Idempotent: resolves once the socket is closed. */
  async disconnect(): Promise<void> {
    if (this.disconnected && this.client === undefined) return;
    this.disconnected = true;
    const client = this.client;
    this.client = undefined;
    this.connected = undefined;
    this.tip = undefined;
    if (client !== undefined) {
      try {
        await client.disconnect(false, false);
      } catch {
        // A socket that is already closed is the desired state.
      }
    }
    this.restorers.clear();
    this.signers.clear();
  }

  /** A request with a 10 s timeout; a timeout closes the socket so the next call reconnects. */
  private async request<T>(method: string, ...params: unknown[]): Promise<T> {
    await this.connect();
    return this.call<T>(method, ...params);
  }

  /** A request on the current connection, without the connect guard (used by `connect()` itself). */
  private async call<T>(method: string, ...params: unknown[]): Promise<T> {
    const client = this.client;
    if (client === undefined) throw new Error('MemCashNetworkProvider: not connected');
    return this.withTimeout<T>(method, client.request(method, ...(params as never[])) as Promise<Error | T>);
  }

  private async withTimeout<T>(method: string, pending: Promise<Error | T>): Promise<T> {
    const timeoutMs = this.options.requestTimeoutMs ?? 10_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        void this.client?.disconnect(false, false);
        this.client = undefined;
        this.connected = undefined;
        reject(new Error(
          `MemCashNetworkProvider: ${method} timed out after ${timeoutMs}ms `
          + `(endpoint ${this.endpoint.hostname}:${this.endpoint.port})`,
        ));
      }, timeoutMs);
      if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') (timer as unknown as { unref: () => void }).unref();
    });
    try {
      const result = await Promise.race([pending, timeout]);
      if (result instanceof Error) throw result;
      return result as T;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  // --- NetworkProvider ---

  async getUtxos(address: string): Promise<Utxo[]> {
    return this.getUtxosForLockingBytecode(addressToLockScript(address));
  }

  async getUtxosForLockingBytecode(lockingBytecode: Uint8Array | string): Promise<Utxo[]> {
    if (typeof lockingBytecode === 'string' && !isHex(lockingBytecode)) {
      throw new Error(`Invalid locking bytecode: ${lockingBytecode} is not a valid hex string`);
    }
    const bin = typeof lockingBytecode === 'string' ? hexToBin(lockingBytecode) : lockingBytecode;
    const scriptHash = this.scriptHash(bin);
    const utxos = await this.request<ElectrumUtxo[]>('blockchain.scripthash.listunspent', scriptHash, 'include_tokens');
    return utxos.map(toUtxo);
  }

  async getUtxosByTokenCategory(categoryId: string): Promise<Utxo[]> {
    const utxos = await this.request<WireUtxo[]>('devnet.utxosByCategory', categoryId);
    return utxos.map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      satoshis: BigInt(utxo.satoshis),
      blockHeight: utxo.blockHeight,
      lockingBytecode: hexToBin(utxo.lockingBytecode),
      ...(utxo.token === undefined ? {} : {
        token: {
          ...utxo.token,
          amount: BigInt(utxo.token.amount),
          ...(utxo.token.nft === undefined ? {} : {
            nft: {
              capability: utxo.token.nft.capability as TokenDetails['nft'] extends undefined ? never : 'none' | 'mutable' | 'minting',
              commitment: utxo.token.nft.commitment,
            },
          }),
        } as TokenDetails,
      }),
    }));
  }

  async getBlockHeight(): Promise<number> {
    return (await this.request<{ height: number }>('devnet.info')).height;
  }

  async getRawTransaction(txid: string): Promise<string> {
    return this.request<string>('blockchain.transaction.get', txid);
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    return this.request<string>('blockchain.transaction.broadcast', txHex);
  }

  async sendPreparedTransaction(prepared: PreparedTransaction): Promise<string> {
    return this.sendRawTransaction(prepared.rawHex);
  }

  async getLedgerOutput(txid: string, vout: number): Promise<LedgerOutput | undefined> {
    const entry = await this.request<WireLedgerOutput | null>('devnet.utxo', txid, vout);
    if (entry === null) return undefined;
    return {
      lockingBytecode: hexToBin(entry.lockingBytecode),
      satoshis: BigInt(entry.satoshis),
      ...(entry.token === undefined ? {} : {
        token: {
          ...entry.token,
          amount: BigInt(entry.token.amount),
          nft: entry.token.nft,
        } as TokenDetails,
      }),
    };
  }

  // --- Test helpers ---

  /**
   * The node's time basis for nLocktime finality: median time past, not the newest header's wall-clock time.
   *
   * The SDK stamps every stateful send with `getBlockTime() - 1`; a tip timestamp would leave that locktime above the
   * node's median-time-past threshold and every such transaction would be rejected as non-final.
   */
  getBlockTime(): number {
    if (this.tip === undefined) {
      throw new Error('MemCashNetworkProvider: chain tip not seeded; await connect() first.');
    }
    return this.tip.medianTimePast;
  }

  async getBlockHash(height: number): Promise<string> {
    const hex = await this.request<string>('blockchain.block.header', height);
    const { hashBlockHeader } = await import('@mem-cash/types');
    return hashBlockHeader(hexToBin(hex));
  }

  async getBlockNumber(): Promise<number> {
    return this.getBlockHeight();
  }

  async getBlock(tag?: string | number): Promise<{ number: number; timestamp: number; hash?: string }> {
    const height = tag === undefined ? await this.getBlockHeight() : quantity(tag);
    const hex = await this.request<string>('blockchain.block.header', height);
    const { hashBlockHeader } = await import('@mem-cash/types');
    return {
      number: height,
      timestamp: this.headerTimestamp(hex),
      hash: hashBlockHeader(hexToBin(hex)),
    };
  }

  async mine(count = 1): Promise<void> {
    if (count <= 0) return;
    await this.request('devnet.mine', count);
    await this.refreshTip();
  }

  async mineUpTo(height: number): Promise<void> {
    await this.request('devnet.mineTo', height);
    await this.refreshTip();
  }

  async increaseTime(seconds: number | bigint): Promise<number> {
    const result = await this.request<{ timestamp: number }>('devnet.increaseTime', Number(seconds));
    await this.refreshTip();
    return result.timestamp;
  }

  async setNextBlockTimestamp(timestamp: number | bigint): Promise<void> {
    await this.request('devnet.setNextBlockTimestamp', Number(timestamp));
  }

  async takeSnapshot(): Promise<SnapshotRestorer> {
    const handle = await this.request<{ id: string; height: number }>('devnet.snapshot');
    const signerNonces = new Map(
      [...this.signers].map(([index, signer]) => [index, signer._getTransactionNonceState()]),
    );
    const tip = this.tip === undefined ? undefined : { ...this.tip };
    const restorer: SnapshotRestorer = {
      snapshotId: handle.id,
      restore: async () => {
        await this.request('devnet.revert', handle.id);
        for (const [index, nonce] of signerNonces) this.signers.get(index)?._setTransactionNonceState(nonce);
        runMockNetworkProviderResetHooks();
        await this.refreshTip();
        this.tip = tip ?? this.tip;
      },
    };
    this.restorers.set(handle.id, restorer);
    return restorer;
  }

  /** The shared block-info oracle is owned by the node; a client cannot rewrite it. */
  refreshBlockOracle(): void {
    // Intentionally a no-op: the node refreshes the oracle on every tip change, and a second writer would race it.
  }

  async addUtxo(addressOrLockingBytecode: string, utxo: Utxo): Promise<Utxo> {
    const target = isHex(addressOrLockingBytecode) && addressOrLockingBytecode.length % 2 === 0
      ? { lockingBytecode: addressOrLockingBytecode }
      : { address: addressOrLockingBytecode };
    const injected = await this.request<{ txid: string }>('devnet.injectUtxo', addressOrLockingBytecode, {
      ...target,
      txid: utxo.txid ?? randomUtxo().txid,
      vout: utxo.vout ?? 0,
      satoshis: String(utxo.satoshis),
      ...(utxo.blockHeight === undefined ? {} : { height: utxo.blockHeight }),
      ...(utxo.token === undefined ? {} : {
        token: {
          category: utxo.token.category,
          amount: String(utxo.token.amount),
          ...(utxo.token.nft === undefined ? {} : { nft: utxo.token.nft }),
        },
      }),
    });
    return { ...utxo, txid: injected.txid };
  }

  async addTokenUtxos(outputs: { address: string; satoshis: bigint; token?: Omit<TokenDetails, 'category'> }[]): Promise<{
    categoryId: string;
    utxos: Utxo[];
  }> {
    const categoryId = randomUtxo().txid;
    const utxos: Utxo[] = [];
    for (const [index, output] of outputs.entries()) {
      const utxo: Utxo = {
        txid: categoryId,
        vout: index,
        satoshis: output.satoshis,
        ...(output.token === undefined ? {} : {
          token: { ...output.token, category: categoryId },
        }),
      };
      utxos.push(await this.addUtxo(output.address, utxo));
    }
    return { categoryId, utxos };
  }

  async addTokenUtxosDynamic(
    factory: (categoryId: string) => { address: string; satoshis: bigint; token?: Omit<TokenDetails, 'category'> }[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    const categoryId = randomUtxo().txid;
    const utxos: Utxo[] = [];
    for (const [index, output] of factory(categoryId).entries()) {
      utxos.push(await this.addUtxo(output.address, {
        txid: categoryId,
        vout: index,
        satoshis: output.satoshis,
        ...(output.token === undefined ? {} : { token: { ...output.token, category: categoryId } }),
      }));
    }
    return { categoryId, utxos };
  }

  /** Client-side JSON-RPC translation; no EVM name ever reaches the wire. */
  async send(method: string, params: unknown[] = []): Promise<unknown> {
    switch (method) {
      case 'evm_snapshot': {
        const restorer = await this.takeSnapshot();
        return restorer.snapshotId;
      }
      case 'evm_revert': {
        const id = String(params[0]);
        const restorer = this.restorers.get(id);
        if (restorer === undefined) return false;
        await restorer.restore();
        return true;
      }
      case 'evm_mine':
        await this.mine(1);
        return '0x0';
      case 'hardhat_mine': {
        const blocks = params[0] === undefined ? 1 : Math.max(1, quantity(params[0]));
        await this.mine(blocks);
        return '0x0';
      }
      case 'evm_increaseTime':
        return this.increaseTime(quantity(params[0]));
      case 'evm_setNextBlockTimestamp':
        await this.setNextBlockTimestamp(quantity(params[0]));
        return null;
      case 'evm_setAutomine':
        if (this.options.controlMining === true) await this.request('devnet.setAutomine', Boolean(params[0]));
        return null;
      case 'evm_setIntervalMining':
        if (this.options.controlMining === true) await this.request('devnet.setIntervalMining', quantity(params[0]));
        return null;
      case 'hardhat_reset':
        if (this.options.controlChain === true) {
          await this.request('devnet.reset');
          await this.refreshTip();
        }
        return null;
      case 'eth_blockNumber':
        return `0x${(await this.getBlockHeight()).toString(16)}`;
      case 'eth_chainId':
      case 'net_version':
        return '0x0';
      default:
        throw new Error(`MemCashNetworkProvider.send: unsupported JSON-RPC method '${method}'.`);
    }
  }

  // --- Signers and cross-process CREATE nonces ---

  getSigners(count?: number, opts: SignerOptions = {}): Promise<HDSigner[]> {
    return this.loadSigners(count ?? 20, opts);
  }

  async getSigner(index = 0, opts: SignerOptions = {}): Promise<HDSigner> {
    const signers = await this.loadSigners(index + 1, opts);
    const signer = signers[index];
    if (signer === undefined) throw new Error(`MemCashNetworkProvider: no signer at index ${index}`);
    return signer;
  }

  getCachedSigner(index = 0, opts: SignerOptions = {}): HDSigner {
    const cached = this.signers.get(index);
    if (cached !== undefined) return cached;
    const deriver = this.signerDeriver(opts);
    return deriver(index);
  }

  private async loadSigners(count: number, opts: SignerOptions): Promise<HDSigner[]> {
    await this.connect();
    const path = this.effectivePath(opts);
    const initialIndex = opts.initialIndex ?? this.options.initialIndex ?? 0;
    const deriver = this.signerDeriver(opts, path);
    const signers = Array.from({ length: count }, (_unused, offset) => {
      const index = initialIndex + offset;
      const existing = this.signers.get(index);
      if (existing !== undefined) return existing;
      const signer = deriver(index);
      this.signers.set(index, signer);
      return signer;
    });

    const accounts = await this.request<{ path: string; address: string }[]>(
      'devnet.accounts',
      initialIndex,
      count,
    );
    for (const [offset, account] of accounts.entries()) {
      const signer = signers[offset];
      if (signer === undefined) continue;
      if (!this.samePath(account.path, path, initialIndex + offset)) {
        throw new Error(this.pathMismatchMessage(account.path, path));
      }
      if (signer.getAddress() !== account.address) {
        throw new Error(this.mnemonicMismatchMessage(account.path, account.address, signer.getAddress()));
      }
    }
    return signers;
  }

  private effectivePath(opts: SignerOptions = {}): string {
    return opts.path ?? this.options.derivationPath ?? this.nodeAccountsPath ?? HARDHAT_ACCOUNT_BRANCH;
  }

  private signerDeriver(opts: SignerOptions = {}, path = this.effectivePath(opts)): (index: number) => HDSigner {
    return (index: number) => {
      const signer = signersFromMnemonic(opts.mnemonic ?? this.mnemonic, this, {
        path,
        initialIndex: index,
        count: 1,
      })[0];
      if (signer === undefined) throw new Error(`MemCashNetworkProvider: unable to derive signer ${index}`);
      return signer;
    };
  }

  private samePath(advertised: string, expected: string, index: number): boolean {
    return advertised === expected || advertised === `${expected}/${index}`;
  }

  private pathMismatchMessage(advertised: string, expected: string): string {
    const networkName = this.network === Network.REGTEST ? 'regtest' : 'localhost';
    return `Network "${networkName}": the node funds accounts at ${expected}, but this provider derives at `
      + `${advertised.replace(/\/\d+$/, '')}. Start the node with --path "${advertised.replace(/\/\d+$/, '')}" `
      + '(or set networks.localhost.devnet.accounts.path), or set the top-level accounts.path to '
      + `"${expected}" so the provider follows the node.`;
  }

  private mnemonicMismatchMessage(path: string, advertised: string, local: string): string {
    const networkName = this.network === Network.REGTEST ? 'regtest' : 'localhost';
    return `Network "${networkName}": the node derived ${advertised} at ${path}, but this mnemonic derives ${local}. `
      + 'The node was started with a different mnemonic. Pass --mnemonic to `solidhat node`, or set '
      + '`networks.localhost.mnemonic` in solidcash.config.ts.';
  }

  /**
   * Seed and advance the CREATE nonce from the chain.
   *
   * A no-op while the signer holds an active reservation; never lowers the local nonce; probes forward from the local
   * nonce (or from 0 on the first call) to the smallest logical address with no identity anchor. A long-lived node
   * keeps every earlier run's anchors, so the probe runs until it finds a free address.
   */
  async prepareSigner(signer: Signer): Promise<void> {
    if (signer.transactionNonceReserved) return;
    const local = signer._getTransactionNonceState();
    const firstSeed = !this.seeded.has(signer);
    this.seeded.add(signer);
    const { deriveLogicalCreateAddress, resolveLogicalIdentity } = await import('../stateful/logical-identity.js');
    const deployer = signer.getAddress();
    let candidate = firstSeed ? 0n : local;
    while (await this.logicalAddressOccupied(deriveLogicalCreateAddress(deployer, candidate), resolveLogicalIdentity)) {
      candidate += 1n;
    }
    if (candidate > local) signer._setTransactionNonceState(candidate);
  }

  private async logicalAddressOccupied(
    address: string,
    resolve: (provider: NetworkProvider, address: string) => Promise<unknown>,
  ): Promise<boolean> {
    try {
      await resolve(this, address);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/ambiguous/.test(message)) return true;
      if (/missing or invalid/.test(message)) return false;
      throw error;
    }
  }

  private async refreshTip(): Promise<void> {
    try {
      const tip = await this.call<{ height: number; hex: string }>('blockchain.headers.get_tip');
      const info = await this.call<{ medianTimePast: number }>('devnet.info');
      this.tip = {
        height: tip.height,
        hex: tip.hex,
        timestamp: this.headerTimestamp(tip.hex),
        medianTimePast: info.medianTimePast,
      };
    } catch {
      // A tip refresh must never mask the mutation's own outcome.
    }
  }

  private scriptHash(lockingBytecode: Uint8Array): string {
    // The Electrum protocol's script hash, as Fulcrum names it: SHA-256 of the locking bytecode in reversed byte order.
    return binToHex(sha256Instance.hash(lockingBytecode).slice().reverse());
  }
}

interface ElectrumUtxo {
  tx_hash: string;
  tx_pos: number;
  value: number;
  height: number;
  token_data?: { category: string; amount: string; nft?: { capability: string; commitment: string } };
}

interface WireUtxo {
  txid: string;
  vout: number;
  satoshis: string;
  token?: { category: string; amount: string; nft?: { capability: string; commitment: string } };
  blockHeight: number;
  lockingBytecode: string;
}

interface WireLedgerOutput {
  lockingBytecode: string;
  satoshis: string;
  token?: { category: string; amount: string; nft?: { capability: string; commitment: string } };
  height: number;
}

function toUtxo(utxo: ElectrumUtxo): Utxo {
  return {
    txid: utxo.tx_hash,
    vout: utxo.tx_pos,
    satoshis: BigInt(utxo.value),
    blockHeight: utxo.height,
    ...(utxo.token_data === undefined ? {} : {
      token: {
        ...utxo.token_data,
        amount: BigInt(utxo.token_data.amount),
        ...(utxo.token_data.nft === undefined ? {} : {
          nft: {
            capability: utxo.token_data.nft.capability as 'none' | 'mutable' | 'minting',
            commitment: utxo.token_data.nft.commitment,
          },
        }),
      } as TokenDetails,
    }),
  };
}

