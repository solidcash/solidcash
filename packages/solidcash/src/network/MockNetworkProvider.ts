import { binToHex, hexToBin, isHex } from '@bitauth/libauth';
import { ConsensusCommon } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/consensus.js';
import { sha256 } from '@solidcash/utils';
import { createIndexer, type Indexer } from '@mem-cash/electrum';
import { createTxVerifier } from '@mem-cash/validation';
import { Utxo, Network, VmTarget, TokenDetails } from '../interfaces.js';
import NetworkProvider, { ConsensusLimits, NetworkPolicy } from './NetworkProvider.js';
import { addressToLockScript, randomUtxo } from '../utils.js';
import { DEFAULT_VM_TARGET } from '../libauth-template/utils.js';
import { HDSigner, signersFromMnemonic } from '../HDSigner.js';

export interface TokenGenesisOutput {
  address: string;
  satoshis: bigint;
  token?: Omit<TokenDetails, 'category'>;
}

export interface MockNetworkProviderOptions {
  updateUtxoSet: boolean;
  vmTarget?: VmTarget;
  /** Relaxed by default for test harnesses; override individual limits to test production boundaries. */
  consensusLimits: ConsensusLimits;
  policy: NetworkPolicy;
}

export type MockNetworkProviderOverrides = Partial<Omit<MockNetworkProviderOptions, 'consensusLimits' | 'policy'>> & {
  consensusLimits?: Partial<ConsensusLimits>;
  policy?: Partial<NetworkPolicy>;
};

export const MOCK_CONSENSUS_LIMITS: ConsensusLimits = {
  maximumInputBytes: 1_000_000,
  maximumStackItemBytes: 1_000_000,
  maximumTransactionBytes: 10_000_000,
  maximumNftCommitmentBytes: 1_000_000,
  operationCostBudgetPerByte: 10_000_000,
  hashDigestIterationsPerByte: 10_000_000,
};

// Default simulated block timestamp (unix seconds). Mutable via the time-travel helpers below.
export const MOCK_DEFAULT_BLOCK_TIME = 1700000000;

/** An opaque snapshot handle mirroring hardhat's SnapshotRestorer. */
export interface SnapshotRestorer {
  /** Restore the chain to the state captured when this snapshot was taken. Repeatable. */
  restore(): Promise<void>;
  /** Opaque snapshot id. */
  snapshotId: string;
}

export default class MockNetworkProvider implements NetworkProvider {
  public indexer: Indexer;
  public network: Network = Network.MOCKNET;
  public blockHeight: number = 133700;
  public options: MockNetworkProviderOptions;
  public vmTarget: VmTarget;
  public consensusLimits: ConsensusLimits;
  public policy: NetworkPolicy;

  // The default hardhat dev mnemonic (a valid BIP-39 phrase); its accounts are the ones getSigners funds.
  static readonly DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';

  private fundingNonce = 0x1000;
  private snapshotNonce = 0;
  private snapshotRestorers = new Map<string, SnapshotRestorer>();
  private signerCache = new Map<string, HDSigner>();
  private fundedSignerKeys = new Set<string>();

  constructor(options?: MockNetworkProviderOverrides) {
    this.options = {
      updateUtxoSet: true,
      ...options,
      consensusLimits: { ...MOCK_CONSENSUS_LIMITS, ...options?.consensusLimits },
      policy: { enforceDust: false, ...options?.policy },
    };
    this.vmTarget = this.options.vmTarget ?? DEFAULT_VM_TARGET;
    this.consensusLimits = this.options.consensusLimits;
    this.policy = this.options.policy;

    const overrides = {
      maximumBytecodeLength: this.consensusLimits.maximumInputBytes,
      maximumStackItemLength: this.consensusLimits.maximumStackItemBytes,
      maximumStandardUnlockingBytecodeLength: this.consensusLimits.maximumInputBytes,
      maximumStandardLockingBytecodeLength: this.consensusLimits.maximumInputBytes,
      maximumTransactionLengthBytes: this.consensusLimits.maximumTransactionBytes,
      maximumStandardTransactionSize: this.consensusLimits.maximumTransactionBytes,
      maximumTokenCommitmentLength: this.consensusLimits.maximumNftCommitmentBytes,
      operationCostBudgetPerByte: this.consensusLimits.operationCostBudgetPerByte,
      // Both regimes, mirroring createVirtualMachine.ts: each falls back to the shared value when unset.
      // mem-cash builds its primary VM with `standard = policy.enforceDust` (and a second consensus VM
      // alongside it), so writing only the nonstandard field left a dust-enforcing mock on libauth's real
      // 0.5/byte standard allowance regardless of its profile. mem-cash rejects non-integer overrides, so the
      // real fractional allowances (0.5 and 3.5) cannot be expressed here - it throws rather than round.
      hashDigestIterationsPerByteStandard:
        this.consensusLimits.hashDigestIterationsPerByteStandard ?? this.consensusLimits.hashDigestIterationsPerByte,
      hashDigestIterationsPerByteNonstandard:
        this.consensusLimits.hashDigestIterationsPerByteNonstandard ?? this.consensusLimits.hashDigestIterationsPerByte,
    };
    const verifier = createTxVerifier({
      // Libauth's standard VM applies its own fixed dust policy after mem-cash's configurable check. Use the
      // consensus VM when dust is disabled; mem-cash still applies fee/value/finality validation and every
      // configured consensus override. Opting back into dust also restores the full production policy VM.
      vmVersion: this.vmTarget, standard: this.policy.enforceDust, minRelayFeePerKb: 1000n, maxFee: 10_000_000n,
      dustRelayFeePerKb: this.policy.enforceDust ? undefined : 0n,
      consensus: overrides,
    } as Parameters<typeof createTxVerifier>[0] & { consensus: typeof overrides });
    this.indexer = createIndexer({ verifier });
    this.indexer.setChainTip(this.blockHeight, MOCK_DEFAULT_BLOCK_TIME);
  }

  async getUtxos(address: string): Promise<Utxo[]> {
    const lockingBytecode = addressToLockScript(address);
    return this.getUtxosForLockingBytecode(lockingBytecode);
  }

  async getUtxosForLockingBytecode(lockingBytecode: Uint8Array | string): Promise<Utxo[]> {
    const bin = typeof lockingBytecode === 'string' ? hexToBin(lockingBytecode) : lockingBytecode;
    const scriptHash = binToHex(sha256(bin));
    return this.indexer.getUtxos(scriptHash).map((entry) => ({
      txid: entry.outpoint.txid,
      vout: entry.outpoint.vout,
      satoshis: entry.satoshis,
      token: entry.tokenData ? {
        amount: entry.tokenData.amount,
        category: entry.tokenData.category,
        nft: entry.tokenData.nft,
      } : undefined,
    }));
  }

  setBlockHeight(newBlockHeight: number): void {
    const time = this.getBlockTime();
    this.blockHeight = newBlockHeight;
    this.indexer.setChainTip(newBlockHeight, time); // preserve the current timestamp when jumping height
  }

  async getBlockHeight(): Promise<number> {
    return this.blockHeight;
  }

  // Test helper mirroring RegtestNetworkProvider: advance the simulated chain tip so height-mode locktimes
  // become final and each mined height is fresh.
  async mine(count: number = 1): Promise<void> {
    this.setBlockHeight(this.blockHeight + count);
  }

  /** hardhat-network-helpers `mineUpTo`: mine until the tip height equals `height` (no-op if already past). */
  async mineUpTo(height: number): Promise<void> {
    if (height > this.blockHeight) this.setBlockHeight(height);
  }

  /** Current simulated block timestamp (unix seconds), read from the chain tip. hardhat `time.latest()`. */
  getBlockTime(): number {
    return this.indexer.getTip()?.timestamp ?? MOCK_DEFAULT_BLOCK_TIME;
  }

  /**
   * hardhat-network-helpers `time.setNextBlockTimestamp`: set the NEXT block's timestamp WITHOUT mining (the
   * mem-cash node holds it pending; the next mined/auto-mined block consumes it). The current tip is unchanged.
   */
  setNextBlockTimestamp(timestamp: number | bigint): void {
    this.indexer.setNextBlockTimestamp(Number(timestamp));
  }

  /** Advance the current chain-tip timestamp by `seconds` immediately (effective for reads now). Returns new ts. */
  increaseTime(seconds: number | bigint): number {
    // Use the REAL indexer tip height (auto-mine-on-send climbs it above this.blockHeight); setChainTip only
    // becomes the tip when its height >= the current tip, otherwise the timestamp change is silently ignored.
    const tipHeight = this.indexer.getTip()?.height ?? this.blockHeight;
    const ts = this.getBlockTime() + Number(seconds);
    this.indexer.setChainTip(tipHeight, ts);
    return ts;
  }

  /**
   * hardhat-network-helpers `takeSnapshot`: capture the full chain + mempool state (via the mem-cash indexer
   * snapshot) plus the simulated height/timestamp. The returned handle's `restore()` rewinds to this point and
   * may be called repeatedly.
   */
  async takeSnapshot(): Promise<SnapshotRestorer> {
    const snap = this.indexer.snapshot(); // captures headers => tip height + timestamp
    const height = this.blockHeight;
    const fundingNonce = this.fundingNonce;
    const signerNonces = new Map(
      [...this.signerCache].map(([key, signer]) => [key, signer._getTransactionNonceState()]),
    );
    const snapshotId = `0x${(this.snapshotNonce++).toString(16)}`;
    const restore = async (): Promise<void> => {
      this.indexer.restore(snap);
      this.blockHeight = height;
      this.fundingNonce = fundingNonce;
      for (const [key, nonce] of signerNonces) this.signerCache.get(key)?._setTransactionNonceState(nonce);
    };
    return { snapshotId, restore };
  }

  /**
   * hardhat/ethers raw JSON-RPC surface: `network.provider.send("evm_*", params)`. Suites that reach for the raw
   * provider instead of hardhat-network-helpers still work. Maps the common evm_/eth_ methods to this provider's
   * snapshot/time/mine primitives; auto-mining knobs are accepted as no-ops (this provider mines on every send).
   */
  async send(method: string, params: unknown[] = []): Promise<unknown> {
    switch (method) {
      case 'evm_snapshot': {
        const restorer = await this.takeSnapshot();
        this.snapshotRestorers.set(restorer.snapshotId, restorer);
        return restorer.snapshotId;
      }
      case 'evm_revert': {
        const id = String(params[0]);
        const restorer = this.snapshotRestorers.get(id);
        if (!restorer) return false;
        await restorer.restore();
        return true;
      }
      case 'evm_mine':
        await this.mine(1);
        return '0x0';
      case 'hardhat_mine': {
        // hardhat_mine([blocks?, interval?]) - hex quantities; default 1 block. Interval (spacing) is a no-op here.
        const blocks = params[0] === undefined ? 1 : Number(params[0]);
        await this.mine(Math.max(1, blocks));
        return '0x0';
      }
      case 'evm_increaseTime':
        return this.increaseTime(Number(params[0]));
      case 'evm_setNextBlockTimestamp':
        this.setNextBlockTimestamp(Number(params[0]));
        return null;
      case 'evm_setAutomine':
      case 'evm_setIntervalMining':
        return null; // no-op: this provider confirms every transaction immediately
      case 'eth_blockNumber':
        return `0x${(await this.getBlockHeight()).toString(16)}`;
      case 'eth_chainId':
      case 'net_version':
        return '0x0'; // BCH has no EVM chain id; a stable placeholder for suites that read it
      default:
        throw new Error(`MockNetworkProvider.send: unsupported JSON-RPC method '${method}'.`);
    }
  }

  async getBlockHash(height: number): Promise<string> {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, height >>> 0, true);
    return binToHex(sha256(buf)); // deterministic synthetic hash - the mock chain has no real blocks
  }

  async getRawTransaction(txid: string): Promise<string> {
    return this.indexer.getRawTx(txid)!;
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    if (!this.options.updateUtxoSet) {
      const bin = hexToBin(txHex);
      const txid = binToHex(sha256(sha256(bin)).reverse());
      this.indexer.storage.storeRawTx(txid, txHex);
      return txid;
    }

    // libauth's CashToken introspection operations in current releases call the common checked-push helper rather
    // than the selected BCH instruction set's stack-item limit. mem-cash overrides those operations natively in
    // its next release; keep 0.0.8 compatible by scoping the legacy common value to this synchronous mock check.
    const commonConsensus = ConsensusCommon as unknown as { maximumStackItemLength: number };
    const previousStackItemLength = commonConsensus.maximumStackItemLength;
    commonConsensus.maximumStackItemLength = this.consensusLimits.maximumStackItemBytes;
    let result;
    try {
      result = this.indexer.submitTransaction(txHex);
    } finally {
      commonConsensus.maximumStackItemLength = previousStackItemLength;
    }
    if (!result.success) {
      throw new Error(result.debugMessage ? `${result.error}: ${result.debugMessage}` : result.error);
    }

    // Mine a block to confirm the transaction immediately. This moves outputs
    // from the mempool to the confirmed UTXO set and clears mempool spend
    // tracking, matching the old MockNetworkProvider's simple UTXO-array behavior.
    this.indexer.mine();

    return result.txid;
  }

  async addUtxo(addressOrLockingBytecode: string, utxo: Utxo): Promise<Utxo> {
    const lockingBytecodeBin = isHex(addressOrLockingBytecode)
      ? hexToBin(addressOrLockingBytecode)
      : addressToLockScript(addressOrLockingBytecode);

    const scriptHash = binToHex(sha256(lockingBytecodeBin));

    this.indexer.addUtxo({
      txid: utxo.txid,
      vout: utxo.vout,
      satoshis: utxo.satoshis,
      scriptHash,
      height: 100,
      lockingBytecode: lockingBytecodeBin,
      tokenData: utxo.token ? {
        category: utxo.token.category,
        amount: utxo.token.amount,
        nft: utxo.token.nft,
      } : undefined,
    });

    return utxo;
  }

  async addTokenUtxos(
    outputs: TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    return this.addTokenUtxosDynamic(() => outputs);
  }

  async addTokenUtxosDynamic(
    outputsFactory: (categoryId: string) => TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    // Generate a random non-palindrome category ID (simulates a real genesis txid)
    const categoryId = randomUtxo().txid;
    const outputs = outputsFactory(categoryId);

    const utxos: Utxo[] = [];
    for (let i = 0; i < outputs.length; i++) {
      const out = outputs[i];
      const utxo: Utxo = {
        txid: categoryId,
        vout: i,
        satoshis: out.satoshis,
        token: out.token ? {
          category: categoryId,
          amount: out.token.amount ?? 0n,
          nft: out.token.nft,
        } : undefined,
      };
      await this.addUtxo(out.address, utxo);
      utxos.push(utxo);
    }

    return { categoryId, utxos };
  }

  reset(): void {
    this.indexer.reset();
    this.signerCache.clear();
    this.fundedSignerKeys.clear();
    this.fundingNonce = 0x1000;
    this.indexer.setChainTip(this.blockHeight, MOCK_DEFAULT_BLOCK_TIME);
  }

  private nextFundingTxid(): string {
    return (this.fundingNonce++).toString(16).padStart(64, '0');
  }

  private signerKey(mnemonic: string, path: string | undefined, index: number): string {
    return `${mnemonic}\u0000${path ?? ''}\u0000${index}`;
  }

  /** Return the stable signer object for an account, creating but not funding it if necessary. */
  getCachedSigner(index = 0, opts: { mnemonic?: string; path?: string } = {}): HDSigner {
    const mnemonic = opts.mnemonic ?? MockNetworkProvider.DEFAULT_MNEMONIC;
    const key = this.signerKey(mnemonic, opts.path, index);
    let signer = this.signerCache.get(key);
    if (!signer) {
      [signer] = signersFromMnemonic(mnemonic, this, { initialIndex: index, count: 1, path: opts.path });
      this.signerCache.set(key, signer);
    }
    return signer;
  }

  /**
   * The hardhat `ethers.getSigners()` analogue: `count` HD signers derived from {@link DEFAULT_MNEMONIC}
   * (m/44'/145'/0'/0/i), each pre-funded with a genesis-valid UTXO on this provider. Destructure the famous
   * way: `const [owner, addr1] = await provider.getSigners();`. Each is an HDSigner - a drop-in ContractFactory
   * runner. `fundingUtxos > 1` gives every account multiple funding UTXOs (for accounts that deploy repeatedly).
   */
  async getSigners(
    count = 20,
    opts: { satoshis?: bigint; mnemonic?: string; fundingUtxos?: number; path?: string } = {},
  ): Promise<HDSigner[]> {
    const satoshis = opts.satoshis ?? 1_000_000n;
    const fundingUtxos = opts.fundingUtxos ?? 1;
    const mnemonic = opts.mnemonic ?? MockNetworkProvider.DEFAULT_MNEMONIC;
    const signers = Array.from({ length: count }, (_, index) => this.getCachedSigner(index, { mnemonic, path: opts.path }));
    for (let index = 0; index < signers.length; index++) {
      const signer = signers[index];
      const key = this.signerKey(mnemonic, opts.path, index);
      if (this.fundedSignerKeys.has(key)) continue;
      // Model prefunding as a fan-out transaction. Only vout 0 is a CashTokens genesis candidate; sibling
      // outputs are category-neutral and can safely fill C2/output-only block slots.
      const fundingTxid = this.nextFundingTxid();
      for (let i = 0; i < fundingUtxos; i++) {
        await this.addUtxo(signer.getAddress(), { txid: fundingTxid, vout: i, satoshis });
      }
      this.fundedSignerKeys.add(key);
    }
    return signers;
  }

  /** A single pre-funded HD signer at `index` (hardhat `ethers.getSigner`). */
  async getSigner(index = 0, opts: { satoshis?: bigint; mnemonic?: string; path?: string } = {}): Promise<HDSigner> {
    await this.getSigners(index + 1, opts);
    return this.getCachedSigner(index, opts);
  }
}

// Test helper: a MockNetworkProvider whose sendRawTransaction always fails.
export class FailingMockNetworkProvider extends MockNetworkProvider {
  async sendRawTransaction(_txHex: string): Promise<string> {
    throw new Error('broadcast failed');
  }
}
