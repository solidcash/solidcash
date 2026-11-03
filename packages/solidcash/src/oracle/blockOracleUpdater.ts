import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { hexToBin, binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { BchnRpcClient } from '@mr-zwets/bchn-api-wrapper';
import {
  type Artifact, blockhashOracleLockingBytecode, blockhashOracleRedeemScript, blockhashSlotRetireUnlocking,
  blockhashSlotUpdateUnlocking, buildBlockhashSlotCommitment, decodeBlockhashSlotCommitment,
  blockOracleLockingBytecode, blockOracleRedeemScript, blockOracleUpdateUnlocking, encodeBlockOracleCommitment,
  blockOracleFieldValue, type BlockhashSlotFields,
  buildPushdataCommitment, bytesEqual, hash160, hash256, type StateVariableInfo,
} from '@solidcash/utils';
import type { Contract } from '../Contract.js';
import type { Utxo, Unlocker, GenerateUnlockingBytecodeOptions } from '../interfaces.js';
import { calculateDust, createSighashPreimage, toSigningSerializationType } from '../utils.js';
import { readFramedState, type FramedState } from '../framed/deploy/records.js';
import SignatureTemplate from '../SignatureTemplate.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { blockOracleCoins } from './block-oracle-lock.js';

/**
 * Off-chain keeper for a contract's block.* oracles (docs/block-and-transaction-properties.md). It subscribes to Fulcrum
 * block-header notifications and, on each new tip, maintains only the oracle(s) the contract actually uses:
 *
 *  - block-info oracle (block.number/timestamp/...): present iff the artifact stamps usesBlockOracle. Reads
 *    the block from a BCHN JSON-RPC and spends the contract's own oracle covenant (utils/block-oracle.ts) with a
 *    signed update: a height update when the chain is ahead of its number, then a timestamp update when the
 *    last final second (median time past - 1) is ahead of its timestamp.
 *  - blockhash ring (blockhash(n)): present iff the artifact stamps usesBlockhash. The genesis mints `depth` slots
 *    of the master category at one lock, and the keeper writes the tip's (n, hash) into the slot whose n is
 *    congruent to it modulo the depth, through the slot covenant's owner-signed update.
 *
 * The keeper/operator private key signs both: its hash is the owner in the block-info commitment and in every slot.
 * Its P2PKH pays the update fees.
 */

// Any JSON-RPC client exposing `request(method, ...params)` (BchnRpcClient satisfies this).
export interface RpcLike {
  request: (method: string, ...params: any[]) => Promise<any>;
}

export interface BlockOracleFields {
  number: bigint; // height
  timestamp: bigint; // header time (unix seconds)
  difficulty: bigint; // nBits as uint32
  size: bigint; // block size in bytes
  totalFees: bigint; // sum of tx fees, satoshis
  coinbase: Uint8Array; // coinbase output 0 locking bytecode
  medianTime?: bigint; // median time past at this block, when the rpc reports it
}

// EVM-parity blockhash window.
export const BLOCKHASH_WINDOW = 256;

// Relay fee of one block-info update, paid by a coin at the keeper's P2PKH. The oracle keeps its value.
const UPDATE_FEE = 2_000n;

// User-land defaults: mainnet -> public BCHN, regtest -> the docker stack (see docker-compose.regtest.yml).
export const DEFAULT_RPC_URL: Record<string, string> = {
  mainnet: 'https://bchn.pat.mn',
  regtest: 'http://localhost:18443',
};

export function createRpcClient(
  network: keyof typeof DEFAULT_RPC_URL,
  opts: { url?: string; rpcUser?: string; rpcPassword?: string } = {},
): BchnRpcClient {
  const url = opts.url ?? DEFAULT_RPC_URL[network];
  return new BchnRpcClient({ url, rpcUser: opts.rpcUser ?? '', rpcPassword: opts.rpcPassword ?? '' });
}

// BCH/BTC block subsidy in sats: 50 BCH halving every 210000 blocks (0 after 64 halvings).
function blockSubsidySats(height: number): bigint {
  const halvings = Math.floor(height / 210000);
  return halvings >= 64 ? 0n : 5_000_000_000n >> BigInt(halvings);
}

// Convert a BCH amount (RPC returns a JSON number) to sats without float drift.
function bchToSats(bch: number): bigint {
  return BigInt(bch.toFixed(8).replace('.', ''));
}

/**
 * Read a block's oracle fields from BCHN in a single `getblock` verbosity-2 call: it inlines the full
 * coinbase tx, so the payout script is `tx[0].vout[0].scriptPubKey.hex` and the total fee is
 * `sum(coinbase outputs) - subsidy(height)` (= the miner-claimed fee; equals the realized fee unless a
 * miner under-claims). This drops the separate `getblockstats` + coinbase `getrawtransaction` calls.
 * (Verbosity 3 would give a per-tx `fee` directly, but it is a Bitcoin Core 25 feature BCHN may lack.)
 */
export async function fetchBlockOracleFields(rpc: RpcLike, hash: string): Promise<BlockOracleFields> {
  const block = await rpc.request('getblock', hash, 2);
  const coinbase = block.tx[0];
  const coinbaseSum = coinbase.vout.reduce((sum: bigint, out: any) => sum + bchToSats(out.value), 0n);
  return {
    number: BigInt(block.height),
    timestamp: BigInt(block.time),
    difficulty: BigInt(Number.parseInt(block.bits, 16)),
    size: BigInt(block.size),
    totalFees: coinbaseSum - blockSubsidySats(block.height),
    coinbase: hexToBin(coinbase.vout[0].scriptPubKey.hex),
    ...(block.mediantime !== undefined && { medianTime: BigInt(block.mediantime) }),
  };
}

/**
 * A timestamp update CLTVs its timestamp under a time-type locktime, and that locktime is final only below the
 * median time past. Publish at most the last final second.
 */
function finalTimestamp(fields: BlockOracleFields): bigint {
  if (fields.medianTime === undefined) return fields.timestamp;
  const last = fields.medianTime - 1n;
  return fields.timestamp < last ? fields.timestamp : last;
}

export interface BlockOracleUpdaterConfig {
  contract: Contract;
  categoryId: string;
  // Operator/keeper private key. Signs the block-info oracle update and the blockhash slot updates: its hash is
  // the owner in both commitments.
  keeperKey: Uint8Array;
  rpc: RpcLike;
  electrumHost?: string; // Fulcrum host for blockchain.headers.subscribe
  // The category whose blockhash ring the keeper writes; `categoryId` when unset.
  blockhashOracleCategory?: string;
}

/** Unlocks the block-info oracle update path: the keeper signs, and `newCommitment` replaces the record. */
export function blockOracleUpdateUnlocker(
  categoryId: Uint8Array, lock: Uint8Array, keeperKey: Uint8Array, newCommitment: Uint8Array,
): Unlocker {
  const pubkey = secp256k1.derivePublicKeyCompressed(keeperKey) as Uint8Array;
  const redeem = blockOracleRedeemScript(categoryId);
  return {
    generateLockingBytecode: (): Uint8Array => lock,
    generateUnlockingBytecode: ({ transaction, sourceOutputs, inputIndex }: GenerateUnlockingBytecodeOptions)
    : Uint8Array => {
      // SIGHASH_ALL | SIGHASH_UTXOS. The preimage and the signature byte both include the fork-id flag.
      const sighashType = 0x21;
      const signature = secp256k1.signMessageHashSchnorr(keeperKey, hash256(
        createSighashPreimage(transaction, sourceOutputs, inputIndex, redeem, sighashType),
      )) as Uint8Array;
      const signed = Uint8Array.from([...signature, toSigningSerializationType(sighashType)]);
      return blockOracleUpdateUnlocking(categoryId, pubkey, signed, newCommitment);
    },
  };
}

/** A slot unlocker that signs the slot covenant with `keeperKey` and pushes what `unlocking` builds. */
function blockhashSlotOwnerUnlocker(
  categoryId: Uint8Array, keeperKey: Uint8Array,
  unlocking: (pubkey: Uint8Array, signature: Uint8Array) => Uint8Array,
): Unlocker {
  const keeper = new SignatureTemplate(keeperKey);
  const redeem = blockhashOracleRedeemScript(categoryId);
  const lock = blockhashOracleLockingBytecode(categoryId);
  return {
    generateLockingBytecode: (): Uint8Array => lock,
    generateUnlockingBytecode: ({ transaction, sourceOutputs, inputIndex }: GenerateUnlockingBytecodeOptions)
    : Uint8Array => {
      const preimage = createSighashPreimage(transaction, sourceOutputs, inputIndex, redeem, keeper.sighashType);
      return unlocking(keeper.publicKey, keeper.generateSignature(hash256(preimage)));
    },
  };
}

/** Unlocks a blockhash slot's update path: the owner signs, and `newCommitment` replaces the slot's. */
export function blockhashSlotUpdateUnlocker(
  categoryId: Uint8Array, keeperKey: Uint8Array, newCommitment: Uint8Array,
): Unlocker {
  return blockhashSlotOwnerUnlocker(categoryId, keeperKey, (pubkey, signature) => blockhashSlotUpdateUnlocking(
    categoryId, pubkey, signature, newCommitment,
  ));
}

/** Unlocks a blockhash slot's retire path: the owner signs, and the slot's NFT burns. */
export function blockhashSlotRetireUnlocker(categoryId: Uint8Array, keeperKey: Uint8Array): Unlocker {
  return blockhashSlotOwnerUnlocker(categoryId, keeperKey, (pubkey, signature) => blockhashSlotRetireUnlocking(
    categoryId, pubkey, signature,
  ));
}

export class BlockOracleUpdater {
  constructor(private readonly cfg: BlockOracleUpdaterConfig) {}

  /** The contract slices the block-info oracle commitment (block.number/timestamp/...). */
  static usesBlockInfo(artifact: Artifact): boolean {
    return artifact.usesBlockOracle === true;
  }

  /**
   * The contract reads blockhash(n), so its genesis minted a ring of blockhash slots. The compiler stamps this
   * marker on the artifact when blockhash() is referenced (see docs/block-and-transaction-properties.md).
   */
  static usesBlockhash(artifact: Artifact): boolean {
    return artifact.usesBlockhash === true;
  }

  /** Current block-info oracle height from the oracle commitment (0 if absent). */
  async oracleHeight(): Promise<bigint> {
    return blockOracleFieldValue(await this.currentCommitment(), 'number');
  }

  /** Current block-info oracle timestamp from the oracle commitment (0 if absent). */
  async oracleTimestamp(): Promise<bigint> {
    return blockOracleFieldValue(await this.currentCommitment(), 'timestamp');
  }

  /**
   * Push a signed update to every coin of the oracle, one transaction each, and return the last txid. The owner hash
   * already in a coin must match `keeperKey`. `locktime` defaults to the new block number: a height-type locktime
   * CLTVs the number and keeps the stored timestamp, a time-type one CLTVs the timestamp and keeps the stored number
   * (audit CRYPTO-5/6). The oracle keeps its value: a coin at the keeper's P2PKH pays the fees and takes the change.
   */
  async pushUpdate(fields: BlockOracleFields, locktime = Number(fields.number)): Promise<string> {
    const listed = await this.oracleCoins();
    if (listed.length === 0) throw new Error('block oracle UTXO is not available');
    let txid: string | undefined;
    let funding: Utxo | undefined;
    for (const { txid: at, vout } of listed) {
      const coin = await this.liveCoin(at, vout);
      if (coin === undefined) continue;
      funding = await this.chainedFeeCoin(funding);
      ({ txid, funding } = await this.updateCoin(coin, fields, locktime, funding));
    }
    if (txid === undefined) throw new Error('block oracle UTXO is not available');
    return txid;
  }

  /** One signed update of `coin`: output 0 recreates it with `fields`, output 1 is the fee coin's change. */
  private async updateCoin(
    coin: Utxo, fields: BlockOracleFields, locktime: number, funding: Utxo,
  ): Promise<{ txid: string; oracle: Utxo; funding: Utxo }> {
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const { lock, category } = this.oracleCovenant();
    const pubkey = secp256k1.derivePublicKeyCompressed(this.cfg.keeperKey) as Uint8Array;
    const newCommitment = encodeBlockOracleCommitment(hash160(pubkey), fields);
    const token = {
      category: coin.token!.category,
      amount: coin.token!.amount,
      nft: { capability: 'mutable' as const, commitment: binToHex(newCommitment) },
    };
    const change = funding.satoshis - UPDATE_FEE;
    const { txid } = await new TransactionBuilder({ provider: this.cfg.contract.provider })
      .addInput(coin, blockOracleUpdateUnlocker(category, lock, this.cfg.keeperKey, newCommitment))
      .addInput(funding, new SignatureTemplate(this.cfg.keeperKey).unlockP2PKH())
      .addOutput({ to: lock, amount: coin.satoshis, token })
      .addOutput({ to: this.keeperP2pkh(), amount: change })
      .setLocktime(locktime)
      .send();
    return { txid, oracle: { txid, vout: 0, satoshis: coin.satoshis, token }, funding: { txid, vout: 1, satoshis: change } };
  }

  // The previous update's change when it pays another fee above dust, else a coin `feeCoin` picks.
  private async chainedFeeCoin(change: Utxo | undefined): Promise<Utxo> {
    const to = this.keeperP2pkh();
    if (change !== undefined
      && change.satoshis - UPDATE_FEE >= BigInt(calculateDust({ to, amount: change.satoshis }))) return change;
    return this.feeCoin(UPDATE_FEE);
  }

  // The largest token-free coin at the keeper's P2PKH, when it pays `fee` and leaves change above dust.
  private async feeCoin(fee: bigint): Promise<Utxo> {
    const to = this.keeperP2pkh();
    const [coin] = (await this.cfg.contract.provider.getUtxosForLockingBytecode(to))
      .filter((utxo) => utxo.token === undefined)
      .sort((a, b) => Number(b.satoshis - a.satoshis));
    if (coin === undefined || coin.satoshis - fee < BigInt(calculateDust({ to, amount: coin.satoshis }))) {
      throw new Error(`the keeper's P2PKH holds no coin that pays the ${fee}-satoshi oracle update fee`);
    }
    return coin;
  }

  /** The contract's own block-info oracle: mutable NFTs of its category at the lock that category gives. */
  private oracleCovenant(): { lock: Uint8Array; category: Uint8Array } {
    const category = hexToBin(this.cfg.categoryId);
    return { lock: blockOracleLockingBytecode(category), category };
  }

  /** The oracle's coins, one per master of a direct deployment. */
  private async oracleCoins(): Promise<Utxo[]> {
    const { lock } = this.oracleCovenant();
    return blockOracleCoins(await this.cfg.contract.provider.getUtxosForLockingBytecode(lock), lock);
  }

  /** The coin still at `txid:vout`, read again: an update signs the record it spends, which can change in place. */
  private async liveCoin(txid: string, vout: number): Promise<Utxo | undefined> {
    return (await this.oracleCoins()).find((utxo) => utxo.txid === txid && utxo.vout === vout);
  }

  private async currentCommitment(): Promise<Uint8Array> {
    const commitment = (await this.oracleCoins())[0]?.token?.nft?.commitment;
    return commitment === undefined ? new Uint8Array() : hexToBin(commitment);
  }

  /**
   * Write block n's hash into the ring: the slot whose n is congruent to `n` modulo its depth, and lower, takes
   * (n, hash) through its owner-signed update under nLockTime n. A coin at the keeper's P2PKH pays the fee and takes
   * the change. Returns the txid.
   */
  async writeBlockhashSlot(n: bigint, hash: Uint8Array): Promise<string> {
    const { category, lock } = this.blockhashRing();
    const slot = await this.blockhashSlotFor(n);
    if (slot === undefined) throw new Error(`no blockhash slot at ${binToHex(lock)} takes block ${n}`);
    if (slot.fields.n >= n) throw new Error(`the blockhash slot for block ${n} already holds block ${slot.fields.n}`);
    const commitment = buildBlockhashSlotCommitment(n, hash, slot.fields.ownerPkh, slot.fields.depth);
    const token = {
      category: slot.utxo.token!.category,
      amount: slot.utxo.token!.amount,
      nft: { capability: 'mutable' as const, commitment: binToHex(commitment) },
    };
    const funding = await this.feeCoin(UPDATE_FEE);
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const { txid } = await new TransactionBuilder({ provider: this.cfg.contract.provider })
      .addInput(slot.utxo, blockhashSlotUpdateUnlocker(category, this.cfg.keeperKey, commitment))
      .addInput(funding, new SignatureTemplate(this.cfg.keeperKey).unlockP2PKH())
      .addOutput({ to: lock, amount: slot.utxo.satoshis, token })
      .addOutput({ to: this.keeperP2pkh(), amount: funding.satoshis - UPDATE_FEE })
      .setLocktime(Number(n))
      .send();
    return txid;
  }

  /**
   * Retire the slot that holds block n: the owner-signed retire burns its NFT, and its satoshis go with a fee coin's
   * to the keeper's P2PKH. Nothing mints a slot again. Returns the txid.
   */
  async retireBlockhashSlot(n: bigint): Promise<string> {
    const { category } = this.blockhashRing();
    const slot = (await this.blockhashSlots()).find(({ fields }) => fields.n === n);
    if (slot === undefined) throw new Error(`no blockhash slot holds block ${n}`);
    const funding = await this.feeCoin(UPDATE_FEE);
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const { txid } = await new TransactionBuilder({ provider: this.cfg.contract.provider, allowImplicitNftBurn: true })
      .addInput(slot.utxo, blockhashSlotRetireUnlocker(category, this.cfg.keeperKey))
      .addInput(funding, new SignatureTemplate(this.cfg.keeperKey).unlockP2PKH())
      .addOutput({ to: this.keeperP2pkh(), amount: slot.utxo.satoshis + funding.satoshis - UPDATE_FEE })
      .send();
    return txid;
  }

  /** The ring's category and its one slot lock. */
  private blockhashRing(): { category: Uint8Array; lock: Uint8Array } {
    const category = hexToBin(this.cfg.blockhashOracleCategory ?? this.cfg.categoryId);
    return { category, lock: blockhashOracleLockingBytecode(category) };
  }

  /** The ring's slots this keeper owns: mutable NFTs of its category at the slot lock. */
  private async blockhashSlots(): Promise<Array<{ utxo: Utxo; fields: BlockhashSlotFields }>> {
    const { category, lock } = this.blockhashRing();
    const wanted = binToHex(category);
    const owner = hash160(secp256k1.derivePublicKeyCompressed(this.cfg.keeperKey) as Uint8Array);
    return (await this.cfg.contract.provider.getUtxosForLockingBytecode(lock)).flatMap((utxo) => {
      const nft = utxo.token?.nft;
      if (utxo.token?.category.toLowerCase() !== wanted || nft?.capability !== 'mutable') return [];
      const fields = decodeBlockhashSlotCommitment(hexToBin(nft.commitment));
      return fields !== undefined && bytesEqual(fields.ownerPkh, owner) ? [{ utxo, fields }] : [];
    });
  }

  /** The slot whose n is congruent to `n` modulo its depth. */
  private async blockhashSlotFor(n: bigint): Promise<{ utxo: Utxo; fields: BlockhashSlotFields } | undefined> {
    return (await this.blockhashSlots()).find(({ fields }) => (n - fields.n) % BigInt(fields.depth) === 0n);
  }

  // The keeper's own P2PKH locking bytecode: it pays the update fees and takes their change.
  private keeperP2pkh(): Uint8Array {
    const pub = secp256k1.derivePublicKeyCompressed(this.cfg.keeperKey);
    if (typeof pub === 'string') throw new Error(`invalid keeper key: ${pub}`);
    return Uint8Array.from([0x76, 0xa9, 0x14, ...hash160(pub), 0x88, 0xac]);
  }

  /** Write the tip's hash into the ring on a new tip, unless its slot holds the tip already. */
  private async maintainBlockhashWindow(tip: number): Promise<void> {
    const slot = await this.blockhashSlotFor(BigInt(tip));
    if (slot !== undefined && slot.fields.n >= BigInt(tip)) return;
    const hashHex: string = await this.cfg.rpc.request('getblockhash', tip);
    await this.writeBlockhashSlot(BigInt(tip), hexToBin(hashHex));
  }

  /**
   * Fetch the tip and maintain whichever oracle(s) this contract uses. Returns the last block-info update txid
   * (or null if the block-info oracle is absent or already current).
   */
  async syncOnce(): Promise<string | null> {
    const tip = Number(await this.cfg.rpc.request('getblockcount'));
    const { artifact } = this.cfg.contract;

    let blockInfoTxid: string | null = null;
    if (BlockOracleUpdater.usesBlockInfo(artifact)) {
      const hash: string = await this.cfg.rpc.request('getblockhash', tip);
      const fields = await fetchBlockOracleFields(this.cfg.rpc, hash);
      // A timestamp is final only below the median time past, so it needs the rpc to report one.
      const timestamp = finalTimestamp(fields);
      let funding: Utxo | undefined;
      // Each coin moves from its own record.
      for (const { txid: at, vout } of await this.oracleCoins()) {
        let coin = await this.liveCoin(at, vout);
        if (coin === undefined) continue;
        const commitment = hexToBin(coin.token!.nft!.commitment);
        const storedTimestamp = blockOracleFieldValue(commitment, 'timestamp');
        let number = blockOracleFieldValue(commitment, 'number');
        // nLockTime is a height or a time, so the number and the timestamp move in separate updates.
        if (fields.number > number) {
          funding = await this.chainedFeeCoin(funding);
          ({ txid: blockInfoTxid, oracle: coin, funding } = await this.updateCoin(
            coin, { ...fields, timestamp: storedTimestamp }, Number(fields.number), funding,
          ));
          number = fields.number;
        }
        if (fields.medianTime !== undefined && timestamp > storedTimestamp) {
          funding = await this.chainedFeeCoin(funding);
          ({ txid: blockInfoTxid, funding } = await this.updateCoin(
            coin, { ...fields, number, timestamp }, Number(timestamp), funding,
          ));
        }
      }
    }
    if (BlockOracleUpdater.usesBlockhash(artifact)) {
      await this.maintainBlockhashWindow(tip);
    }
    return blockInfoTxid;
  }

  /**
   * Subscribe to Fulcrum header notifications and sync on every new tip. Returns a stop() that
   * unsubscribes and disconnects. Does an initial sync before returning.
   */
  async start(): Promise<() => Promise<void>> {
    if (!this.cfg.electrumHost) throw new Error('electrumHost is required to subscribe to headers');
    // Load the Electrum client lazily: it is only needed for header subscriptions, not for one-shot syncs.
    const { ElectrumClient } = await import('@electrum-cash/network');
    const electrum = new ElectrumClient('SolidCash BlockOracleUpdater', '1.4.1', this.cfg.electrumHost);
    await electrum.connect();
    await electrum.subscribe('blockchain.headers.subscribe');
    electrum.on('notification', () => {
      // blockchain.headers.subscribe fires on every new tip; re-sync (errors are logged, not thrown).
      this.syncOnce().catch((err) => console.error('[block-oracle-updater] sync failed:', err?.message ?? err));
    });
    await this.syncOnce();
    return async () => {
      await electrum.unsubscribe('blockchain.headers.subscribe');
      await electrum.disconnect();
    };
  }
}

/** Block-info registers the mock tip can refresh without a signed `__updateBlockOracle` spend. */
const MOCK_ORACLE_REGISTERS = [
  '__block_number',
  '__block_timestamp',
  '__block_difficulty',
  '__block_size',
  '__block_totalFees',
  '__block_coinbase',
] as const;

/**
 * Map a mock provider's height/time onto the same field record `fetchBlockOracleFields` returns.
 * Used when `evm_increaseTime` / `mine` must advance `__block_timestamp` without a keeper key.
 */
export function mockProviderBlockFields(provider: {
  getBlockHeight(): Promise<number>;
  getBlockTime(): number;
}): Promise<BlockOracleFields> {
  const coinbase = hexToBin(`76a914${'00'.repeat(20)}88ac`);
  return provider.getBlockHeight().then((height) => ({
    number: BigInt(height),
    timestamp: BigInt(provider.getBlockTime()),
    difficulty: 0n,
    size: 1000n,
    totalFees: 0n,
    coinbase,
  }));
}

type MockUtxoStorage = {
  getUtxoByOutpoint: (key: string) => {
    outpoint: { txid: string; vout: number };
    satoshis: bigint;
    scriptHash: string;
    height: number;
    lockingBytecode: Uint8Array;
    isCoinbase?: boolean;
    tokenData?: {
      category: string;
      amount: bigint;
      nft?: { commitment: string; capability: 'none' | 'mutable' | 'minting' };
    };
  } | undefined;
  _test?: {
    utxo: {
      add: (params: {
        txid: string; vout: number; satoshis: bigint; scriptHash: string; height: number;
        lockingBytecode?: Uint8Array; isCoinbase?: boolean;
        tokenData?: {
          category: string; amount: bigint;
          nft?: { commitment: string; capability: 'none' | 'mutable' | 'minting' };
        };
      }) => void;
      remove: (params: { txid: string; vout: number }) => void;
    };
  };
};

type OracleTarget = {
  categoryId: string;
  layout: NonNullable<Artifact['stateLayout']>;
  /** The direct convention's handle; a framed target has none, its records are found by category. */
  contract?: Contract;
};

function oracleTargetsFromDeployment(deployment: { contract: unknown }): OracleTarget[] {
  const found: OracleTarget[] = [];
  const seen = new Set<string>();
  const addTarget = (categoryId: string | undefined, layout: Artifact['stateLayout'], contract?: Contract): void => {
    if (!categoryId || !layout) return;
    if (!layout.variables.some((variable) => (
      (MOCK_ORACLE_REGISTERS as readonly string[]).includes(variable.name)
    ))) return;
    const key = `${categoryId}:${layout.variables.map((variable) => variable.name).join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ categoryId, layout, ...(contract === undefined ? {} : { contract }) });
  };
  // A direct target is read through its handle.
  const push = (
    contract: Contract | undefined, categoryId: string | undefined, layout: Artifact['stateLayout'],
  ): void => {
    if (contract) addTarget(categoryId, layout, contract);
  };
  const wrapped = deployment.contract as {
    inner?: Contract;
    categoryId?: string;
    implementation?: { inner?: Contract; categoryId?: string };
    proxy?: { inner?: Contract; categoryId?: string };
    framedProxy?: unknown;
  };
  // Per-call: a proxy registers the implementation's artifact beside the proxy's category, whose records hold the
  // application state (the registers included) under the implementation's layout; a plain deployment registers its
  // stateful handle.
  const innerArtifact = wrapped.inner?.artifact;
  if (innerArtifact?.composition?.convention === 'framed') {
    const categoryId = wrapped.framedProxy === undefined ? wrapped.categoryId : wrapped.proxy?.categoryId;
    addTarget(categoryId, innerArtifact.stateLayout);
    return found;
  }
  const implArtifact = wrapped.implementation?.inner?.artifact;
  // OZ proxy: application state (including __block_timestamp) lives on the proxy category
  // under the implementation layout. The implementation artifact owns `__updateBlockOracle`.
  if (implArtifact && BlockOracleUpdater.usesBlockInfo(implArtifact)) {
    push(wrapped.proxy?.inner, wrapped.proxy?.categoryId, implArtifact.stateLayout);
    push(wrapped.implementation?.inner, wrapped.implementation?.categoryId, implArtifact.stateLayout);
  }
  push(wrapped.inner, wrapped.categoryId, wrapped.inner?.artifact.stateLayout);
  return found;
}

function replaceMockNftCommitment(
  storage: MockUtxoStorage, utxo: Utxo, commitment: string,
): boolean {
  const key = `${utxo.txid}:${utxo.vout}`;
  // A full storage snapshot clones every chain and mempool entry. The indexed outpoint reader returns the
  // same confirmed NFT as an isolated copy, without cloning the whole chain for each oracle register.
  const entry = storage.getUtxoByOutpoint(key);
  if (!entry?.tokenData?.nft || entry.height <= 0 || !storage._test) return false;
  if (entry.tokenData.nft.commitment === commitment) return false;
  storage._test.utxo.remove({ txid: utxo.txid, vout: utxo.vout });
  storage._test.utxo.add({
    txid: utxo.txid,
    vout: utxo.vout,
    satoshis: entry.satoshis,
    scriptHash: entry.scriptHash,
    height: entry.height,
    lockingBytecode: entry.lockingBytecode,
    isCoinbase: entry.isCoinbase,
    tokenData: {
      category: entry.tokenData.category,
      amount: entry.tokenData.amount,
      nft: { capability: entry.tokenData.nft.capability, commitment },
    },
  });
  return true;
}

/**
 * Rewrites a framed deployment's register records in place: read by category and decoded as its entries read
 * them, re-encoded with the shipped pushdata encoder. A deployment whose records do not classify is left alone.
 */
async function syncFramedRegisters(
  provider: NetworkProvider,
  storage: MockUtxoStorage,
  target: OracleTarget,
  touched: readonly StateVariableInfo[],
  byRegister: Readonly<Record<string, bigint | Uint8Array>>,
): Promise<number> {
  const { categoryId, layout } = target;
  let onChain: FramedState;
  try {
    onChain = await readFramedState(provider, categoryId, layout);
  } catch {
    return 0;
  }
  let updated = 0;
  for (const nftIndex of new Set(touched.map((variable) => variable.nftIndex))) {
    const next = { ...onChain.byNft[nftIndex] };
    for (const variable of touched) {
      if (variable.nftIndex === nftIndex) next[variable.name] = byRegister[variable.name]!;
    }
    const commitment = buildPushdataCommitment(layout, next, nftIndex);
    if (replaceMockNftCommitment(storage, onChain.records[nftIndex]!, commitment)) updated += 1;
  }
  return updated;
}

/**
 * Hardhat `evm_increaseTime` / `mine` analogue: write the mock tip into every deployed
 * contract's `__block_*` registers. Official `syncOnce()` needs a keeper signature the
 * unmodified suites never start; this uses the same field mapping and the live data-NFT
 * commitments the covenant actually reads.
 */
async function syncMockBlockOracleDeployments(
  provider: NetworkProvider,
  deployments: Iterable<{ contract: unknown }>,
  keeperRule = false,
): Promise<number> {
  const storage = (provider as { indexer?: { storage?: MockUtxoStorage } }).indexer?.storage;
  if (!storage?._test) return 0;
  const { getContractState, getDataNftAddress } = await import('../stateful/covenant-helpers.js');
  const { StateReader } = await import('../stateful/StateReader.js');
  const fields = await mockProviderBlockFields({
    getBlockHeight: () => provider.getBlockHeight(),
    getBlockTime: () => (provider as unknown as { getBlockTime: () => number }).getBlockTime(),
  });
  const byRegister: Record<string, bigint | Uint8Array> = {
    __block_number: fields.number,
    __block_timestamp: fields.timestamp,
    __block_difficulty: fields.difficulty,
    __block_size: fields.size,
    __block_totalFees: fields.totalFees,
    __block_coinbase: fields.coinbase,
  };
  let updated = 0;
  for (const deployment of deployments) {
    for (const target of oracleTargetsFromDeployment(deployment)) {
      const { contract, categoryId, layout } = target;
      const touched = layout.variables.filter((variable) => (
        (MOCK_ORACLE_REGISTERS as readonly string[]).includes(variable.name)
      ));
      if (touched.length === 0) continue;
      if (contract === undefined) {
        updated += await syncFramedRegisters(provider, storage, target, touched, byRegister);
        continue;
      }
      let onChain;
      try {
        const dataNftAddr = getDataNftAddress(contract, categoryId);
        const addresses = [contract.tokenAddress, dataNftAddr];
        onChain = await new StateReader(layout).readStateFromChain(
          contract.provider, categoryId, addresses, addresses,
        );
      } catch {
        try {
          onChain = await getContractState(contract, categoryId);
        } catch {
          continue;
        }
      }
      // The production keeper (`syncOnce`) pushes only when the chain is ahead of the oracle, and an implicit
      // refresh follows the same rule. A register at or past the tip height stands as it would on chain: state
      // seeded for a fixed block, or a signed owner update the covenant admitted (it requires tx.time >= number).
      // Without this the refresh before every call replaced an owner's update with the mock tip's fields. A layout
      // without a height register carries no freshness and is always refreshed, and an explicit tip move (mine,
      // evm_increaseTime) refreshes unconditionally.
      if (keeperRule) {
        const recorded = onChain.state.__block_number;
        if (typeof recorded === 'bigint' && recorded >= fields.number) continue;
      }
      const next = { ...onChain.state };
      for (const variable of touched) {
        next[variable.name] = byRegister[variable.name];
      }
      const nftIndices = new Set(touched.map((variable) => variable.nftIndex));
      for (const nftIndex of nftIndices) {
        const utxo = onChain.dataNftUtxos[nftIndex];
        if (!utxo?.token?.nft) continue;
        const commitment = buildPushdataCommitment(layout, next, nftIndex);
        if (replaceMockNftCommitment(storage, utxo, commitment)) updated += 1;
      }
    }
  }
  return updated;
}

/**
 * Refresh only one contract graph (including proxy/implementation pairs), as the keeper would: a direct contract
 * whose height register is already at or past the tip is left alone.
 */
export async function syncMockBlockOracleDeployment(
  provider: NetworkProvider,
  deployment: { contract: unknown },
): Promise<number> {
  return syncMockBlockOracleDeployments(provider, [deployment], true);
}

export async function syncMockBlockOracles(provider: NetworkProvider): Promise<number> {
  const refresh = (provider as { refreshBlockOracle?: () => void }).refreshBlockOracle;
  if (refresh !== undefined) refresh.call(provider);
  const { listDeployments } = await import('../stateful/deployment-registry.js');
  return syncMockBlockOracleDeployments(provider, listDeployments(provider));
}
