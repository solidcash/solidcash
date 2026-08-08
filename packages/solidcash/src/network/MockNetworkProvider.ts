import { binToHex, encodeTransaction, hexToBin, isHex } from '@bitauth/libauth';
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

/**
 * `operationCostBudgetPerByte` is REAL here while every other limit stays relaxed, and that asymmetry is
 * deliberate. The other fields bound how big a thing may be, so relaxing them lets a harness exercise shapes
 * larger than a production transaction would carry - useful, and visibly artificial. The operation-cost budget
 * bounds how DENSE a script may be, and density does not announce itself: a contract that passes at a relaxed
 * budget and fails at the real one looks identical in every artifact the SDK produces. Relaxing it therefore
 * made a green mocknet suite mean nothing about on-chain validity, which is how several over-budget shapes
 * reached a live node before anyone noticed. See RELEASE_READINESS.md, "operation-cost budget".
 *
 * A harness that genuinely wants the old behaviour asks for it by name:
 *   new MockNetworkProvider({ consensusLimits: { operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST } })
 */
export const MOCK_CONSENSUS_LIMITS: ConsensusLimits = {
  maximumInputBytes: 1_000_000,
  maximumStackItemBytes: 1_000_000,
  maximumTransactionBytes: 10_000_000,
  maximumNftCommitmentBytes: 1_000_000,
  operationCostBudgetPerByte: 800,
  hashDigestIterationsPerByte: 10_000_000,
};

/** The pre-2026-08 relaxed budget, for harnesses that are testing the relaxed profile itself. */
export const MOCK_RELAXED_OPERATION_COST = 10_000_000;

// Default simulated block timestamp (unix seconds). Mutable via the time-travel helpers below.
export const MOCK_DEFAULT_BLOCK_TIME = 1700000000;

/* ------------------------------------------------------------------------------------------------------ */
/* The consensus-override probe                                                                             */
/* ------------------------------------------------------------------------------------------------------ */

/**
 * WHY THIS EXISTS. This provider publishes `consensusLimits` and then depends on the installed
 * `@mem-cash/validation` applying them. `_strictRecursiveVmPreflight` reads the SAME limits, so the build-time
 * gate and the broadcast-time decider agree only while that override channel works.
 *
 * `@mem-cash/validation` 0.0.8 declares `TxVerifierConfig.consensus` and threads it into every VM it builds.
 * 0.0.7 has neither the field nor any read of it: `createVmFacade(version, standard)` takes no third argument
 * and the whole object is dropped. On 0.0.7 the decider therefore runs libauth's stock limits while the
 * preflight reads the published ones, and the gate is FAIL-OPEN in the direction that matters - `decrement(24)`
 * builds against a published 10,000,000 and is then refused at broadcast by a stock 800.
 *
 * `packages/solidcash/package.json` declares `^0.0.8`, which for a `0.0.x` range means exactly 0.0.8, and
 * `yarn.lock` resolves it. A stale `node_modules` is the only way to reach 0.0.7 - and a failing test is not a
 * runtime guard. This measures the behaviour once and refuses to construct a provider that cannot decide.
 *
 * BEHAVIOURAL, NOT A VERSION STRING. A version string can be right while the build on disk is not (a patched
 * tarball, a linked working copy, a renamed channel), and a future 0.0.9 would fail a `=== '0.0.8'` check while
 * honouring overrides perfectly. This measures the only thing that matters: hand the real `createTxVerifier` a
 * limit and see whether its verdict moves.
 *
 * CONTROLLED AND MULTI-FIELD, both deliberate.
 *  - A single strict point cannot distinguish "the override was applied" from "the probe transaction is
 *    broken", so a RELAXED control that must ACCEPT runs first. If the control fails, the message says the
 *    probe is inconclusive rather than blaming the install.
 *  - The strict points cover the channels this provider actually depends on, including
 *    `operationCostBudgetPerByte`, which 0.0.8 does not even declare in `ConsensusOverrides` and which is the
 *    field the recursive-preflight decision turns on.
 *
 * SCOPE. It establishes that the installed build applies published consensus overrides, demonstrated on two or
 * three fields depending on the VM version. It is not a claim that every field in `MOCK_CONSENSUS_LIMITS` is
 * honoured individually.
 */

/** The probe's source output: `OP_DROP OP_1`, so the input's pushed item is consumed and one truthy item remains. */
export const CONSENSUS_PROBE_SOURCE_OUTPUT = {
  lockingBytecode: Uint8Array.from([0x75, 0x51]), valueSatoshis: 100_000n,
};

/**
 * A 69-byte 1-in 1-out transaction, deliberately the smallest shape that clears every pre-VM rule: a non-null
 * prevout, 69 bytes against the 65-byte minimum, a 100,000-satoshi fee against the default caps, and an
 * OP_RETURN output so no dust rule applies in either regime. Its only script work is one 2-byte push.
 */
export const consensusProbeTransactionHex = (): string => binToHex(encodeTransaction({
  inputs: [{
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(0x11),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x02, 0xaa, 0xbb]),
  }],
  locktime: 0,
  outputs: [{ lockingBytecode: Uint8Array.from([0x6a, 0x04, 0, 0, 0, 0]), valueSatoshis: 0n }],
  version: 2,
}));

/**
 * The strict points, each paired with the arithmetic that makes its refusal attributable, and each restricted
 * to the VM versions where it was MEASURED to be a rule.
 *
 * `versions: undefined` means every version. `operationCostBudgetPerByte` is the exception and the restriction
 * is not cosmetic: BCH_2023 and BCH_SPEC IGNORE it - their instruction sets have no operation-cost-density
 * rule - while `ConsensusBch2023.operationCostBudgetPerByte` and `ConsensusBchSpec.operationCostBudgetPerByte`
 * are both published as 800. Keying applicability off the presence of the constant would therefore have made
 * the probe refuse two good installs. Measured, not inferred.
 *
 * Every version keeps at least two independent channels, so no version rests on a single field.
 */
const CONSENSUS_PROBE_POINTS: readonly {
  field: string; strict: number; expect: RegExp; versions?: readonly string[];
}[] = [
  {
    // 41 + 3 unlocking bytes = 44 density control length, so `1` yields a 44-unit ceiling that one 2-byte
    // push (cost 102) cannot clear. THE field the recursive-preflight decision turns on.
    field: 'operationCostBudgetPerByte',
    strict: 1,
    expect: /operation cost density limit\. Maximum operation cost: 44 \(density control length: 44\)/,
    versions: [VmTarget.BCH_2025_05, VmTarget.BCH_2026_05],
  },
  {
    field: 'maximumStackItemLength',
    strict: 1,
    expect: /maximum stack item length\. Maximum stack item length: 1 bytes\. Item length: 2 bytes/,
  },
  {
    field: 'maximumBytecodeLength',
    strict: 1,
    expect: /maximum bytecode length\. Maximum bytecode length: 1 bytes\. Unlocking bytecode length: 3 bytes/,
  },
];

/** Relaxed enough that no rule below can bind, so an ACCEPT here means the probe transaction itself is sound. */
const CONSENSUS_PROBE_RELAXED = {
  operationCostBudgetPerByte: 800, maximumStackItemLength: 520, maximumBytecodeLength: 10_000,
};

/** Cached verdict per VM version: `undefined` = honoured, a string = the refusal to re-throw. */
const consensusProbeVerdicts = new Map<string, string | undefined>();

/** The one dependency the probe has on the outside world, injectable so a test can drive a real 0.0.7 build. */
export type TxVerifierFactory = typeof createTxVerifier;

/**
 * Run the probe and return the refusal message, or `undefined` when the installed build honours overrides.
 * Pure and uncached: `assertConsensusOverridesHonoured` is the caching wrapper the constructor uses.
 */
export const probeConsensusOverrides = (
  vmVersion: string, factory: TxVerifierFactory = createTxVerifier,
): string | undefined => {
  const rawHex = consensusProbeTransactionHex();
  const chainState = { height: 1, medianTimePast: 0 };
  const decide = (consensus: Record<string, number>): { ok: boolean; reason: string } => {
    try {
      const verifier = factory({
        vmVersion, standard: false, consensus,
      } as Parameters<typeof createTxVerifier>[0] & { consensus: Record<string, number> });
      const result = verifier.verify(rawHex, [CONSENSUS_PROBE_SOURCE_OUTPUT], chainState);
      return result.success
        ? { ok: true, reason: 'ACCEPT' }
        : { ok: false, reason: `${result.error}${result.debugMessage ? `: ${result.debugMessage}` : ''}` };
    } catch (error) {
      return { ok: false, reason: `threw ${(error as Error).message}` };
    }
  };

  const control = decide(CONSENSUS_PROBE_RELAXED);
  if (!control.ok) {
    return 'MockNetworkProvider: the @mem-cash/validation consensus-override probe is INCONCLUSIVE - its own '
      + `control transaction was refused on ${vmVersion} with relaxed limits (${control.reason}). This is a `
      + 'defect in the probe or a libauth change, NOT evidence about the installed validation package.';
  }
  for (const point of CONSENSUS_PROBE_POINTS) {
    if (point.versions !== undefined && !point.versions.includes(vmVersion)) continue;
    const strict = decide({ ...CONSENSUS_PROBE_RELAXED, [point.field]: point.strict });
    if (strict.ok || !point.expect.test(strict.reason)) {
      return 'MockNetworkProvider: the installed @mem-cash/validation does NOT honour published consensus '
        + `limits. Probed on ${vmVersion}: the identical transaction is accepted at the relaxed limits and `
        + `must be refused at \`${point.field}: ${point.strict}\`, but the decider answered `
        + `"${strict.reason}". Run \`yarn install\` - packages/solidcash/package.json requires exactly 0.0.8 `
        + '(`^0.0.8` on a 0.0.x range) and 0.0.7 silently ignores published consensus limits, which makes '
        + '`consensusLimits` on this provider decorative: the build-time preflight would read them while the '
        + 'broadcast-time decider ran libauth stock values, so shapes would pass `.build()` and fail `.send()`.';
    }
  }
  return undefined;
};

/**
 * Probe ONCE per VM version and cache the verdict, including a failing one - so a bad install refuses every
 * construction, not just the first, without paying for the measurement again.
 */
export const assertConsensusOverridesHonoured = (
  vmVersion: string, factory?: TxVerifierFactory,
): void => {
  if (!consensusProbeVerdicts.has(vmVersion)) {
    consensusProbeVerdicts.set(vmVersion, probeConsensusOverrides(vmVersion, factory));
  }
  const verdict = consensusProbeVerdicts.get(vmVersion);
  if (verdict !== undefined) throw new Error(verdict);
};

/** Testing seam: drop the cached verdicts so a probe can be re-measured. Not part of the provider contract. */
export const resetConsensusProbeCacheForTests = (): void => consensusProbeVerdicts.clear();

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

    // Fail closed: every limit published below is only real if the installed decider reads it. Cached per VM
    // version, so this costs one measurement per process rather than one per provider.
    assertConsensusOverridesHonoured(this.vmTarget);

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
