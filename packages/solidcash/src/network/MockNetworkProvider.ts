import { binToHex, hexToBin, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransaction, encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import { ConsensusCommon } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/consensus.js';
import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import {
  encodeBlockOracleCommitment, blockOracleLockingBytecode, blockOracleReadUnlocking, hash160, hash256, sha256,
  type BlockOracleCommitmentFields,
} from '@solidcash/utils';
import { createIndexer, type Indexer } from '@mem-cash/electrum';
import { createTxVerifier } from '@mem-cash/validation';
import { type Utxo, Network, VmTarget, type TokenDetails } from '../interfaces.js';
import type NetworkProvider from './NetworkProvider.js';
import type { ConsensusLimits, LedgerOutput, NetworkPolicy, PreparedTransaction } from './NetworkProvider.js';
import { addressToLockScript, publicKeyToP2PKHLockingBytecode, randomUtxo } from '../utils.js';
import { DEFAULT_VM_TARGET } from '../libauth-template/utils.js';
import { BCH_ACCOUNT_BRANCH, HDSigner, signersFromMnemonic } from '../HDSigner.js';
import { createPreparedBch2026TxVerifier } from './createPreparedTxVerifier.js';
import { runMockNetworkProviderResetHooks } from './mock-reset.js';

export { onMockNetworkProviderReset } from './mock-reset.js';

export interface TokenGenesisOutput {
  address: string;
  satoshis: bigint;
  token?: Omit<TokenDetails, 'category'>;
}

export interface MockNetworkProviderOptions {
  updateUtxoSet: boolean;
  vmTarget?: VmTarget;
  /**
   * Explicit opt-in for corpus-only stateful SDK simulations which can turn selected covenant failures into
   * synthetic receipts. Omitted by default: ordinary mock providers preserve real send/error semantics.
   */
  statefulSimulation?: 'legacy-mistswap-v1';
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
 * `@mem-cash/validation` 0.0.8 and later declare `TxVerifierConfig.consensus` and thread it into every VM they build.
 * 0.0.7 has neither the field nor any read of it: `createVmFacade(version, standard)` takes no third argument
 * and the whole object is dropped. On 0.0.7 the decider therefore runs libauth's stock limits while the
 * preflight reads the published ones, and the gate is FAIL-OPEN in the direction that matters - `decrement(24)`
 * builds against a published 10,000,000 and is then refused at broadcast by a stock 800.
 *
 * `packages/solidcash/package.json` declares `^0.0.10`, which for a `0.0.x` range means exactly 0.0.10, and
 * `yarn.lock` resolves it. A stale `node_modules` is the only way to reach 0.0.7 - and a failing test is not a
 * runtime guard. This measures the behaviour once and refuses to construct a provider that cannot decide.
 *
 * BEHAVIOURAL, NOT A VERSION STRING. A version string can be right while the build on disk is not (a patched
 * tarball, a linked working copy, a renamed channel), and a version string can fail a `===` check against a
 * build that honours overrides perfectly. This measures the only thing that matters: hand the real `createTxVerifier` a
 * limit and see whether its verdict moves.
 *
 * CONTROLLED AND MULTI-FIELD, both deliberate.
 *  - A single strict point cannot distinguish "the override was applied" from "the probe transaction is
 *    broken", so a RELAXED control that must ACCEPT runs first. If the control fails, the message says the
 *    probe is inconclusive rather than blaming the install.
 *  - The strict points cover the channels this provider actually depends on, including
 *    `operationCostBudgetPerByte`, the field the recursive-preflight decision turns on.
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
        + `"${strict.reason}". Run \`yarn install\` - packages/solidcash/package.json requires exactly 0.0.10 `
        + '(`^0.0.10` on a 0.0.x range) and 0.0.7 silently ignores published consensus limits, which makes '
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

type LiveUtxoEntry = ReturnType<Indexer['storage']['snapshot']>['utxos'] extends Map<string, infer E> ? E : never;

interface Outpoint { readonly txid: string; readonly vout: number }

/** Where a fresh mock chain mints its block oracle. */
const MOCK_BLOCK_ORACLE_OUTPOINT: Outpoint = { txid: `${'b0'.repeat(31)}b1`, vout: 0 };

/** The coin a fresh mock chain gives the oracle owner's P2PKH, which pays its keeper's update fees. */
const MOCK_BLOCK_ORACLE_FEE_COIN: Outpoint = { txid: `${'b0'.repeat(31)}b2`, vout: 0 };

/**
 * Write counters for indexer stores. mem-cash calls its storage by property lookup, so wrapping the writer methods
 * and the `_test` helpers (which edit the internals directly) sees every change to the UTXO set.
 */
const storeGenerations = new WeakMap<object, { value: number }>();
const STORE_WRITERS = ['applyBlock', 'undoBlock', 'addMempoolTx', 'removeMempoolTx', 'clearMempool', 'addMempoolUtxo',
  'restore', 'storeRawTx'];

function storeGeneration(storage: object): { value: number } {
  const known = storeGenerations.get(storage);
  if (known !== undefined) return known;
  const counter = { value: 0 };
  storeGenerations.set(storage, counter);
  type Writer = (...args: unknown[]) => unknown;
  const counted = (fn: Writer): Writer => function countedWrite(this: unknown, ...args: unknown[]): unknown {
    counter.value += 1;
    return fn.apply(this, args);
  };
  const store = storage as Record<string, unknown>;
  for (const name of STORE_WRITERS) {
    const fn = store[name];
    if (typeof fn === 'function') store[name] = counted(fn as Writer);
  }
  const countTree = (node: Record<string, unknown>): void => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'function') node[key] = counted(value as Writer);
      else if (value !== null && typeof value === 'object') countTree(value as Record<string, unknown>);
    }
  };
  if (store._test !== null && typeof store._test === 'object') countTree(store._test as Record<string, unknown>);
  return counter;
}

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
  /** Selects the SDK's fast VM paths at any configured limits; each enforces `consensusLimits`. */
  public readonly simulator = true;
  public readonly statefulSimulation?: 'legacy-mistswap-v1';

  // The default hardhat dev mnemonic (a valid BIP-39 phrase); its accounts are the ones getSigners funds.
  static readonly DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';

  // Every isolated mock fixture uses this public Hardhat mnemonic. BIP-39's deliberately expensive
  // PBKDF2 dominates short e2e tests when each fresh provider derives the same account again, so retain
  // only these well-known test nodes for the module lifetime and cheaply bind them to each provider.
  private static defaultSignerNodes: HDSigner['node'][] = [];
  private fundingNonce = 0x1000;
  private snapshotNonce = 0;
  private snapshotRestorers = new Map<string, SnapshotRestorer>();
  /** The live UTXO set as of one store write count; see `liveUtxoEntries`. */
  private liveUtxoView?: {
    storage: object;
    generation: number;
    entries: readonly LiveUtxoEntry[];
    /** Positions in `entries` by category hex, and by its 64-character prefix when a capability byte follows. */
    byCategory: ReadonlyMap<string, readonly number[]>;
  };

  /** Txids this provider has already accepted. A resubmit returns the id and does not throw. */
  private acceptedTransactions = new Set<string>();
  private signerCache = new Map<string, HDSigner>();
  private fundedSignerKeys = new Set<string>();
  private preparedTransaction?: PreparedTransaction;
  /**
   * ethers-v5 `provider._network.chainId` surface used by MistSwap digests
   * (`user.provider._network.chainId` in setMasterContractApproval).
   */
  readonly _network: { chainId: number; name: string } = { chainId: 1, name: 'chipnet' };

  /**
   * Hardhat/ethers internal block surface used by MistSwap permit deadlines:
   * `(await alice.provider._internalBlockNumber).respTime + 10000`.
   */
  get _internalBlockNumber(): { respTime: number; blockNumber: number } {
    const t = typeof this.getBlockTime === 'function' ? this.getBlockTime() : Math.floor(Date.now() / 1000);
    return { respTime: Number(t), blockNumber: this.blockHeight };
  }

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
    this.statefulSimulation = this.options.statefulSimulation;

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
    const verifierConfig = {
      // Libauth's standard VM applies its own fixed dust policy after mem-cash's configurable check. Use the
      // consensus VM when dust is disabled; mem-cash still applies fee/value/finality validation and every
      // configured consensus override. Opting back into dust also restores the full production policy VM.
      vmVersion: this.vmTarget, standard: this.policy.enforceDust, minRelayFeePerKb: 1000n, maxFee: 10_000_000n,
      dustRelayFeePerKb: this.policy.enforceDust ? undefined : 0n,
      consensus: overrides,
    } as Parameters<typeof createTxVerifier>[0] & { consensus: typeof overrides };
    const stockVerifier = createTxVerifier(verifierConfig);
    const verifier = this.vmTarget === VmTarget.BCH_2026_05
      ? createPreparedBch2026TxVerifier(
        this, verifierConfig, () => this.preparedTransaction, stockVerifier,
      )
      : stockVerifier;
    this.indexer = createIndexer({ verifier });
    storeGeneration(this.indexer.storage);
    this.indexer.setChainTip(this.blockHeight, MOCK_DEFAULT_BLOCK_TIME);
    this.installBlockOracle();
  }

  /** Compressed key the mock oracle's commitment names. Tests sign updates with it, and its P2PKH pays their fees. */
  readonly blockOracleOwnerKey = Uint8Array.from({ length: 32 }, (_byte, index) => (index === 31 ? 0x44 : 0x11));
  blockOracleLock!: Uint8Array;
  blockOracleCategory!: Uint8Array;
  /** The outpoint the mock last wrote the oracle at. */
  private blockOracleOutpoint: Outpoint = MOCK_BLOCK_ORACLE_OUTPOINT;

  /** Mint the one block-info NFT this provider's readers slice, and fund its owner's update fees. */
  private installBlockOracle(): void {
    this.blockOracleCategory = sha256(new TextEncoder().encode('solidcash-block-info-oracle-v1'));
    this.blockOracleLock = blockOracleLockingBytecode(this.blockOracleCategory);
    this.writeBlockOracle(MOCK_BLOCK_ORACLE_OUTPOINT, this.tipBlockOracleFields());
    const owner = publicKeyToP2PKHLockingBytecode(
      secp256k1.derivePublicKeyCompressed(this.blockOracleOwnerKey) as Uint8Array,
    );
    this.indexer.addUtxo({
      ...MOCK_BLOCK_ORACLE_FEE_COIN, satoshis: 100_000_000n, scriptHash: binToHex(sha256(owner)), height: 100,
      lockingBytecode: owner,
    });
  }

  private tipBlockOracleFields(): BlockOracleCommitmentFields {
    return {
      number: BigInt(this.blockHeight),
      timestamp: BigInt(this.getBlockTime()),
      difficulty: 0n,
      size: 1000n,
      totalFees: 0n,
      coinbase: hexToBin(`76a914${'00'.repeat(20)}88ac`),
    };
  }

  /**
   * Write the provider's current height and time into the live oracle. An oracle an owner's signed update
   * recreated keeps the owner's fields, as on chain; one only readers recreated is still the mock's.
   */
  refreshBlockOracle(): void {
    const live = this.liveBlockOracle();
    if (live === undefined || !this.onlyReadSince(live)) return;
    this.writeBlockOracle(live, this.tipBlockOracleFields());
  }

  /** Replace the block fields of the live oracle in place. The commitment names the mock owner's key. */
  setBlockOracleFields(fields: BlockOracleCommitmentFields): void {
    this.writeBlockOracle(this.liveBlockOracle() ?? this.blockOracleOutpoint, fields);
  }

  /** The oracle a reader co-spends: the first mutable NFT at the oracle lock. */
  private liveBlockOracle(): Outpoint | undefined {
    const entry = this.indexer.getUtxos(binToHex(sha256(this.blockOracleLock)))
      .find((utxo) => utxo.tokenData?.nft?.capability === 'mutable');
    return entry === undefined ? undefined : { txid: entry.outpoint.txid, vout: entry.outpoint.vout };
  }

  /** Whether only read-path spends, which recreate it unchanged, moved the oracle since the mock wrote it. */
  private onlyReadSince(outpoint: Outpoint): boolean {
    let read: string | undefined;
    let at = outpoint;
    while (at.txid !== this.blockOracleOutpoint.txid || at.vout !== this.blockOracleOutpoint.vout) {
      read ??= binToHex(blockOracleReadUnlocking(this.blockOracleCategory));
      const raw = this.indexer.getRawTx(at.txid);
      const decoded = raw === undefined ? undefined : decodeTransaction(hexToBin(raw));
      // The read path recreates the oracle at its own input index.
      const input = typeof decoded === 'object' ? decoded.inputs[at.vout] : undefined;
      if (input === undefined || binToHex(input.unlockingBytecode) !== read) return false;
      at = { txid: binToHex(input.outpointTransactionHash), vout: input.outpointIndex };
    }
    return true;
  }

  /** Rewrite the oracle NFT at `outpoint` in place, keeping its value and height. */
  private writeBlockOracle(outpoint: Outpoint, fields: BlockOracleCommitmentFields): void {
    const pubkey = secp256k1.derivePublicKeyCompressed(this.blockOracleOwnerKey) as Uint8Array;
    const commitment = encodeBlockOracleCommitment(hash160(pubkey), fields);
    const { txid, vout } = outpoint;
    const { storage } = this.indexer;
    const live = storage.getUtxoByOutpoint(`${txid}:${vout}`);
    storage._test.utxo.remove({ txid, vout });
    this.indexer.addUtxo({
      txid, vout, satoshis: live?.satoshis ?? 10_000n,
      scriptHash: binToHex(sha256(this.blockOracleLock)),
      height: live?.height ?? 100,
      lockingBytecode: this.blockOracleLock,
      tokenData: {
        category: live?.tokenData?.category ?? binToHex(this.blockOracleCategory),
        amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(commitment) },
      },
    });
    this.blockOracleOutpoint = { txid, vout };
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

  async getUtxosByTokenCategory(categoryId: string): Promise<Utxo[]> {
    const wanted = new Set([categoryId.toLowerCase()]);
    try {
      const reversed = binToHex(hexToBin(categoryId).reverse());
      wanted.add(reversed.toLowerCase());
    } catch { /* not hex */ }
    const entries = this.liveUtxoEntries();
    const byCategory = this.liveUtxoView?.byCategory;
    const positions = new Set<number>();
    for (const key of wanted) {
      for (const at of byCategory?.get(key) ?? []) positions.add(at);
    }
    const found: Utxo[] = [];
    // The answer keeps the set's own order, so the matches are walked by their position rather than by category.
    for (const at of [...positions].sort((left, right) => left - right)) {
      const entry = entries[at]!;
      // Every read shares the view until the next write, so each match is a fresh copy.
      found.push({
        txid: entry.outpoint.txid,
        vout: entry.outpoint.vout,
        satoshis: entry.satoshis,
        lockingBytecode: entry.lockingBytecode.slice(),
        token: entry.tokenData ? {
          amount: entry.tokenData.amount,
          category: entry.tokenData.category,
          nft: entry.tokenData.nft && { ...entry.tokenData.nft },
        } : undefined,
      });
    }
    return found;
  }

  /**
   * The live UTXO set (confirmed minus mempool spends, plus mempool outputs). The store only enumerates through a
   * whole-store snapshot, so the set is rebuilt once per store write count rather than once per read.
   */
  private liveUtxoEntries(): readonly LiveUtxoEntry[] {
    const { storage } = this.indexer;
    const generation = storeGeneration(storage).value;
    const view = this.liveUtxoView;
    if (view !== undefined && view.storage === storage && view.generation === generation) return view.entries;
    const snap = storage.snapshot();
    const live: typeof snap.utxos = new Map(snap.utxos);
    for (const key of snap.mempoolSpends.keys()) live.delete(key);
    for (const [key, entry] of snap.mempoolUtxos) live.set(key, entry);
    const entries = [...live.values()];
    // A read by category walks the whole set otherwise, and a composed transaction carries tens of thousands of
    // entries. One pass here indexes each entry under its category, and under its 64-character prefix as well when
    // a capability byte follows it, which is what the read matches on.
    const byCategory = new Map<string, number[]>();
    entries.forEach((entry, at) => {
      const category = entry.tokenData?.category?.toLowerCase() ?? '';
      if (category === '') return;
      for (const key of category.length > 64 ? [category, category.slice(0, 64)] : [category]) {
        const list = byCategory.get(key);
        if (list === undefined) byCategory.set(key, [at]);
        else list.push(at);
      }
    });
    this.liveUtxoView = { storage, generation, entries, byCategory };
    return this.liveUtxoView.entries;
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
    const { syncMockBlockOracles } = await import('../oracle/blockOracleUpdater.js');
    await syncMockBlockOracles(this);
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
    const oracleOutpoint = this.blockOracleOutpoint;
    const signerNonces = new Map(
      [...this.signerCache].map(([key, signer]) => [key, signer._getTransactionNonceState()]),
    );
    // A transaction accepted after the snapshot is rewound with the chain, so a resubmit of it applies again.
    const accepted = new Set(this.acceptedTransactions);
    const snapshotId = `0x${(this.snapshotNonce++).toString(16)}`;
    const restore = async (): Promise<void> => {
      this.indexer.restore(snap);
      this.acceptedTransactions = new Set(accepted);
      this.blockHeight = height;
      this.fundingNonce = fundingNonce;
      this.blockOracleOutpoint = oracleOutpoint;
      for (const [key, nonce] of signerNonces) this.signerCache.get(key)?._setTransactionNonceState(nonce);
      // Snapshot restoration can abandon transactions just as completely as reset(). Any process-local cache
      // derived from the prior chain tip is stale after this point and must be rebuilt from the restored UTXO set.
      runMockNetworkProviderResetHooks();
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
      case 'evm_increaseTime': {
        const timestamp = this.increaseTime(Number(params[0]));
        const { syncMockBlockOracles } = await import('../oracle/blockOracleUpdater.js');
        await syncMockBlockOracles(this);
        return timestamp;
      }
      case 'hardhat_mine': {
        // hardhat_mine([blocks?, interval?]) - hex quantities; default 1 block. Interval (spacing) is a no-op here.
        const blocks = params[0] === undefined ? 1 : Number(params[0]);
        await this.mine(Math.max(1, blocks));
        return '0x0';
      }
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

  /** The live output at `txid:vout` in this simulator's own ledger: `addUtxo` coins carry no transaction. */
  async getLedgerOutput(txid: string, vout: number): Promise<LedgerOutput | undefined> {
    const entry = this.indexer.storage.getUtxoByOutpoint(`${txid.toLowerCase()}:${vout}`);
    if (entry === undefined) return undefined;
    const token = entry.tokenData;
    return {
      lockingBytecode: entry.lockingBytecode,
      satoshis: entry.satoshis,
      ...(token === undefined ? {} : {
        token: {
          amount: token.amount,
          category: token.category,
          ...(token.nft === undefined ? {} : { nft: { ...token.nft } }),
        },
      }),
    };
  }

  async sendPreparedTransaction(prepared: PreparedTransaction): Promise<string> {
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1') {
      console.error('mock-prepared-transaction', {
        inputs: prepared.transaction.inputs.length,
        outputs: prepared.transaction.outputs.map((output, index) => ({
          index,
          lockingBytecode: binToHex(output.lockingBytecode),
          category: output.token?.category && binToHex(output.token.category),
          capability: output.token?.nft?.capability,
          commitment: output.token?.nft?.commitment && binToHex(output.token.nft.commitment),
        })),
      });
    }
    this.preparedTransaction = prepared;
    try {
      return await this.sendRawTransaction(prepared.rawHex);
    } finally {
      if (this.preparedTransaction === prepared) this.preparedTransaction = undefined;
    }
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    // A node returns the txid with no error when sendrawtransaction is given a transaction it already
    // accepted. Record the id before the oracle await so a second call during that await takes the same path.
    const txid = binToHex(sha256(sha256(hexToBin(txHex))).reverse());
    if (this.acceptedTransactions.has(txid)) return txid;

    if (!this.options.updateUtxoSet) {
      this.indexer.storage.storeRawTx(txid, txHex);
      this.acceptedTransactions.add(txid);
      return txid;
    }

    // libauth's CashToken introspection operations call the common checked-push helper rather than the selected
    // BCH instruction set's stack-item limit. `@mem-cash/validation` 0.0.8 has that defect, so the published
    // limit is scoped to the common value for this synchronous mock check; 0.0.10 - the version this package
    // declares - overrides those operations natively in its own verifier, which leaves this scoping as a 0.0.8
    // compatibility layer. It is a candidate for removal once nothing supports 0.0.8.
    const commonConsensus = ConsensusCommon as unknown as { maximumStackItemLength: number };
    const previousStackItemLength = commonConsensus.maximumStackItemLength;
    commonConsensus.maximumStackItemLength = this.consensusLimits.maximumStackItemBytes;
    const debugTiming = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_PREFLIGHT_TIMING === '1';
    const submitStartedAt = debugTiming ? Date.now() : 0;
    let result;
    try {
      result = this.indexer.submitTransaction(txHex);
    } finally {
      commonConsensus.maximumStackItemLength = previousStackItemLength;
    }
    if (debugTiming) console.error('mock-provider-timing', {
      stage: 'submit-transaction', ms: Date.now() - submitStartedAt, success: result.success,
    });
    if (!result.success) {
      // The winning call may have recorded the txid while this one was waiting on the indexer.
      if (this.acceptedTransactions.has(txid)) return txid;
      throw new Error(result.debugMessage ? `${result.error}: ${result.debugMessage}` : result.error);
    }
    this.acceptedTransactions.add(txid);
    this.acceptedTransactions.add(result.txid);

    // Mine a block to confirm the transaction immediately. This moves outputs
    // from the mempool to the confirmed UTXO set and clears mempool spend
    // tracking, matching the old MockNetworkProvider's simple UTXO-array behavior.
    const mineStartedAt = debugTiming ? Date.now() : 0;
    this.indexer.mine();
    // A contract that reads `block.timestamp` holds the value in a register a block oracle updates; a mined block
    // is when that value moves, so the chain's time reaches the register before the next transaction is built.
    const { syncMockBlockOracles } = await import('../oracle/blockOracleUpdater.js');
    await syncMockBlockOracles(this);
    if (debugTiming) console.error('mock-provider-timing', {
      stage: 'mine', ms: Date.now() - mineStartedAt,
    });

    return result.txid;
  }

  async addUtxo(addressOrLockingBytecode: string, utxo: Utxo): Promise<Utxo> {
    const lockingBytecodeBin = isHex(addressOrLockingBytecode)
      ? hexToBin(addressOrLockingBytecode)
      : addressToLockScript(addressOrLockingBytecode);

    const scriptHash = binToHex(sha256(lockingBytecodeBin));

    this.indexer.addUtxo({
      // Outpoints are matched as lowercase hex, which is how a spending transaction's input names them
      txid: utxo.txid.toLowerCase(),
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
    this.acceptedTransactions.clear();
    this.signerCache.clear();
    this.fundedSignerKeys.clear();
    this.fundingNonce = 0x1000;
    this.indexer.setChainTip(this.blockHeight, MOCK_DEFAULT_BLOCK_TIME);
    // The wipe took the oracle with it, and a fresh chain has one.
    this.installBlockOracle();
    runMockNetworkProviderResetHooks();
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
      if (mnemonic === MockNetworkProvider.DEFAULT_MNEMONIC && opts.path === undefined) {
        if (MockNetworkProvider.defaultSignerNodes.length <= index) {
          MockNetworkProvider.defaultSignerNodes = signersFromMnemonic(mnemonic, this, {
            count: Math.max(20, index + 1),
          }).map((derived) => derived.node);
        }
        signer = HDSigner._fromNode(
          MockNetworkProvider.defaultSignerNodes[index], this, `${BCH_ACCOUNT_BRANCH}/${index}`, mnemonic,
        );
      } else {
        [signer] = signersFromMnemonic(mnemonic, this, { initialIndex: index, count: 1, path: opts.path });
      }
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
      // outputs are category-neutral and can safely fill vmap/output-only block slots. The raw transaction
      // is what genesis selection checks, so the txid has to be the hash of outputs that pay this signer.
      const lockingBytecode = signer.getLockingBytecode();
      const raw = encodeTransaction({
        version: 2,
        locktime: 0,
        inputs: [{
          outpointIndex: 0,
          outpointTransactionHash: hexToBin(this.nextFundingTxid()),
          sequenceNumber: 0xffffffff,
          unlockingBytecode: Uint8Array.of(0x51),
        }],
        outputs: Array.from({ length: fundingUtxos }, () => ({ lockingBytecode, valueSatoshis: satoshis })),
      });
      const fundingTxid = binToHex(hash256(raw).reverse());
      this.indexer.storage.storeRawTx(fundingTxid, binToHex(raw));
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
