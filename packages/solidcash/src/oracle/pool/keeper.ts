import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  POOL_COIN_SATS, POOL_FLAG_NUMBER_STOPPED, POOL_FLAG_SLOT, POOL_FLAG_SLOT_STOPPED, POOL_FLAG_TIMESTAMP_STOPPED,
  POOL_MAX_DEPTH, encodePoolBatonCommitment, encodePoolInfoCommitment, encodePoolSlotCommitment,
  poolBatonMintUnlocking, poolBatonSweepUnlocking, poolBatonUpdateUnlocking, poolInfoReadUnlocking,
  poolInfoRotateUnlocking, poolInfoStopUnlocking, poolInfoSweepUnlocking, poolInfoUpdateUnlocking,
  poolSlotRotateUnlocking, poolSlotStopUnlocking, poolSlotSweepUnlocking, poolSlotWriteUnlocking,
  type PoolBatonFields, type PoolInfoFields, type PoolSlotFields,
} from '@solidcash/utils';
import type { LibauthOutput, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  LOCKTIME_THRESHOLD, type AssembledPoolTransaction, type PoolBlock, type PoolBlockFields, type PoolCoin,
  type PoolLocks, type PoolSpend, assemblePoolTransaction, assembledUtxo, checkPoolCategory, p2pkhLockOf,
  p2pkhSpend, poolBatonCoin, poolCoinKind, poolInfoCoin, poolLocks, poolOutput, poolOwnerOf, poolSlotCoin,
  publicKeyOf, purseCoin,
} from './coins.js';
import { simulatorPoolFields } from './genesis.js';

export interface PoolKeeperOptions {
  readonly provider: NetworkProvider;
  /** The pool category, display order. */
  readonly category: string;
  /** Signs every owner path; its P2PKH pays each transaction's fee and takes the change. */
  readonly ownerKey: Uint8Array;
  /**
   * The fields `start` publishes for the tip at `height`. A simulator's are its height and the second before its
   * block time, the newest a time-type locktime admits; a live network needs this.
   */
  readonly fields?: (height: number) => Promise<PoolBlockFields>;
  /** The hash of block n in display order, which `start` writes to its slot. Defaults to the provider's. */
  readonly blockHash?: (n: bigint) => Promise<Uint8Array>;
}

/** How often `start` looks for a new block by default, in milliseconds. */
export const POOL_KEEPER_INTERVAL_MS = 1_000;

export interface PoolKeeperStartOptions {
  /** Called with a step's failure; the next new block tries again. Default: logged. */
  readonly onError?: (error: unknown) => void;
  /** Called after each step with the height it published. */
  readonly onStep?: (height: number) => void;
}

/** Most pool coins one stop, sweep or rotate transaction spends, so a large pool's stays standard-size. */
export const POOL_COINS_PER_TRANSACTION = 64;

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean => binToHex(left) === binToHex(right);

/** The fields a height update writes. */
const sameBlock = (coin: PoolInfoFields, fields: PoolBlockFields): boolean => coin.number === fields.number
  && coin.difficulty === fields.difficulty && coin.size === fields.size && coin.totalFees === fields.totalFees
  && sameBytes(coin.coinbase, fields.coinbase);

function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let at = 0; at < items.length; at += POOL_COINS_PER_TRANSACTION) {
    out.push(items.slice(at, at + POOL_COINS_PER_TRANSACTION));
  }
  return out;
}

/** One pool coin's input and the output at its index; a sweep has no output. */
interface CoinStep { readonly spend: PoolSpend; readonly output?: LibauthOutput }

/**
 * The owner's operator for a pool: refreshes the info coins, writes ring slots, grows the pool through the baton,
 * and stops, sweeps and rotates its coins. It reads the coins at the pool's locks; each transaction is an ordinary
 * one that the pool covenants admit, paid by the owner's P2PKH.
 */
export class PoolKeeper {
  readonly provider: NetworkProvider;
  readonly category: string;
  private key: Uint8Array;
  private readonly locks: PoolLocks;
  private readonly fields?: (height: number) => Promise<PoolBlockFields>;
  private readonly blockHash?: (n: bigint) => Promise<Uint8Array>;
  /** Blocks this keeper's own sends mined, on a simulator that mines each send. */
  private ownBlocks = 0;

  constructor(options: PoolKeeperOptions) {
    this.provider = options.provider;
    this.category = checkPoolCategory(options.category);
    this.locks = poolLocks(this.category);
    publicKeyOf(options.ownerKey);
    this.key = options.ownerKey;
    this.fields = options.fields;
    this.blockHash = options.blockHash;
  }

  /**
   * Keeps the pool current until the returned stop is called: at once, then on each tick that finds a new block, it
   * publishes the tip's fields with `refreshInfo` and writes the slot of each block since its last step, the newest
   * included. A block its own transactions mine, as a simulator's do, is no new block. A step's failure goes to
   * `onError`, and the next new block tries again. Stop resolves once the running step ends.
   */
  start(intervalMs = POOL_KEEPER_INTERVAL_MS, options: PoolKeeperStartOptions = {}): () => Promise<void> {
    const report = options.onError ?? ((error: unknown): void => {
      console.error(`[oracle pool ${this.category}] keeper step failed:`, error instanceof Error ? error.message : error);
    });
    let stopped = false;
    let seen: number | undefined;
    let written: number | undefined;
    let running: Promise<void> = Promise.resolve();
    const step = async (): Promise<void> => {
      const height = await this.provider.getBlockHeight();
      if (stopped || height === seen) return;
      const own = this.ownBlocks;
      const fields = await (this.fields === undefined ? this.simulatorFields(height) : this.fields(height));
      await this.refreshInfo(fields);
      const first = Math.max(0, height - POOL_MAX_DEPTH + 1, written === undefined ? height : written + 1);
      const blocks: PoolBlock[] = [];
      for (let n = first; n <= height; n += 1) blocks.push({ n: BigInt(n), hash: await this.hashOf(BigInt(n)) });
      if (blocks.length > 0) await this.writeSlots(blocks);
      written = height;
      seen = height + this.ownBlocks - own;
      options.onStep?.(height);
    };
    let busy = false;
    // A tick while a step runs is dropped: the next one looks again.
    const tick = (): void => {
      if (busy) return;
      busy = true;
      running = step().catch(report).finally(() => {
        busy = false;
      });
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    return async () => {
      stopped = true;
      clearInterval(timer);
      await running;
    };
  }

  /** Sets the baton's depth, 1 to 256, through its update path: slots it mints later take it. Returns the txid. */
  async setDepth(depth: number): Promise<string> {
    if (!Number.isInteger(depth) || depth < 1 || depth > POOL_MAX_DEPTH) {
      throw new Error(`oracle pool depth ${depth} is not an integer from 1 to ${POOL_MAX_DEPTH}`);
    }
    const baton = await this.ownBaton();
    const commitment = encodePoolBatonCommitment({ owner: baton.fields.owner, depth });
    const pubkey = publicKeyOf(this.key);
    return (await this.send([{
      spend: {
        utxo: baton.utxo,
        lockingBytecode: this.locks.baton,
        unlock: (sign) => poolBatonUpdateUnlocking(
          this.locks.category, pubkey, sign(this.key, this.locks.batonRedeem), commitment,
        ),
      },
      output: poolOutput(this.locks.baton, baton.utxo.satoshis, this.category, 'minting', commitment),
    }], [], 0)).txid;
  }

  /** The key the pool's commitments name; `rotate` replaces it. */
  get ownerKey(): Uint8Array {
    return this.key;
  }

  /** Every info coin at the pool's info lock, stopped ones included. */
  async infoCoins(): Promise<PoolCoin<PoolInfoFields>[]> {
    return (await this.provider.getUtxosForLockingBytecode(this.locks.info))
      .map((utxo) => poolInfoCoin({ ...utxo, lockingBytecode: this.locks.info }, this.category))
      .filter((coin): coin is PoolCoin<PoolInfoFields> => coin !== undefined);
  }

  /** Every slot at the pool's slot lock, stopped ones included. */
  async slots(): Promise<PoolCoin<PoolSlotFields>[]> {
    return (await this.provider.getUtxosForLockingBytecode(this.locks.slot))
      .map((utxo) => poolSlotCoin({ ...utxo, lockingBytecode: this.locks.slot }, this.category))
      .filter((coin): coin is PoolCoin<PoolSlotFields> => coin !== undefined);
  }

  async baton(): Promise<PoolCoin<PoolBatonFields> | undefined> {
    return (await this.provider.getUtxosForLockingBytecode(this.locks.baton))
      .map((utxo) => poolBatonCoin({ ...utxo, lockingBytecode: this.locks.baton }, this.category))
      .find((coin) => coin !== undefined);
  }

  /**
   * Publishes `fields` into every live info coin this key owns: one height-locked transaction raises `number` and
   * writes the block's other fields, then one time-locked transaction raises `timestamp`, so every coin reads one
   * clock. A step already published, or one that would rewind a coin, is skipped. A time-type locktime is final only
   * below the median time past, so `fields.timestamp` is at most its last second. Returns the txids sent.
   */
  async refreshInfo(fields: PoolBlockFields): Promise<string[]> {
    if (fields.number < 0n || fields.number >= LOCKTIME_THRESHOLD) {
      throw new Error(`oracle pool block number ${fields.number} is not a height`);
    }
    if (fields.timestamp < LOCKTIME_THRESHOLD) throw new Error(`oracle pool timestamp ${fields.timestamp} is not a time`);
    const owner = this.owner();
    let coins = (await this.infoCoins()).filter((coin) => coin.fields.flags === 0 && sameBytes(coin.fields.owner, owner));
    let purse: Utxo | undefined;
    const txids: string[] = [];
    if (coins.some((coin) => !sameBlock(coin.fields, fields))
      && coins.every((coin) => coin.fields.number <= fields.number)) {
      const sent = await this.updateInfo(coins, (info) => ({
        ...info, number: fields.number, difficulty: fields.difficulty, size: fields.size, totalFees: fields.totalFees,
        coinbase: fields.coinbase,
      }), Number(fields.number));
      txids.push(sent.txid);
      ({ coins, purse } = sent);
    }
    if (coins.some((coin) => coin.fields.timestamp !== fields.timestamp)
      && coins.every((coin) => coin.fields.timestamp <= fields.timestamp)) {
      const sent = await this.updateInfo(coins, (info) => ({ ...info, timestamp: fields.timestamp }),
        Number(fields.timestamp), purse);
      txids.push(sent.txid);
    }
    return txids;
  }

  /**
   * Moves every live slot of n's residue that this key owns forward to block n, in one transaction locked at height
   * n. Returns its txid, or undefined when no slot of that residue holds an older block.
   */
  async writeNewestSlot(n: bigint, hash: Uint8Array): Promise<string | undefined> {
    if (hash.length !== 32) throw new Error('oracle pool slot hash is 32 bytes');
    const owner = this.owner();
    const behind = (await this.slots()).filter(({ fields }) => fields.flags === POOL_FLAG_SLOT
      && sameBytes(fields.owner, owner) && fields.depth > 0 && fields.n < n && (n - fields.n) % BigInt(fields.depth) === 0n);
    if (behind.length === 0) return undefined;
    const pubkey = publicKeyOf(this.key);
    const steps = behind.map(({ utxo, fields }): CoinStep => ({
      spend: {
        utxo,
        lockingBytecode: this.locks.slot,
        unlock: (sign) => poolSlotWriteUnlocking(
          this.locks.category, pubkey, sign(this.key, this.locks.slotRedeem), n, hash,
        ),
      },
      output: poolOutput(this.locks.slot, utxo.satoshis, this.category, 'mutable', encodePoolSlotCommitment({
        ...fields, flags: POOL_FLAG_SLOT, n, hash,
      })),
    }));
    return (await this.send(steps, [], Number(n))).txid;
  }

  /**
   * Moves every live slot this key owns forward to the newest of `blocks` of its residue, if that is newer than the
   * block it holds, in transactions of at most POOL_COINS_PER_TRANSACTION slots, each locked at its newest height.
   * Returns the txids sent.
   */
  async writeSlots(blocks: readonly PoolBlock[]): Promise<string[]> {
    for (const { n, hash } of blocks) {
      if (n < 0n || n >= LOCKTIME_THRESHOLD) throw new Error(`oracle pool slot block ${n} is not a height`);
      if (hash.length !== 32) throw new Error('oracle pool slot hash is 32 bytes');
    }
    const owner = this.owner();
    const pubkey = publicKeyOf(this.key);
    const writes = (await this.slots()).flatMap(({ utxo, fields }) => {
      if (fields.flags !== POOL_FLAG_SLOT || !sameBytes(fields.owner, owner) || fields.depth < 1) return [];
      const next = blocks.reduce<PoolBlock | undefined>((best, block) => (block.n > fields.n
        && (block.n - fields.n) % BigInt(fields.depth) === 0n && (best === undefined || block.n > best.n)
        ? block : best), undefined);
      if (next === undefined) return [];
      const step: CoinStep = {
        spend: {
          utxo,
          lockingBytecode: this.locks.slot,
          unlock: (sign) => poolSlotWriteUnlocking(
            this.locks.category, pubkey, sign(this.key, this.locks.slotRedeem), next.n, next.hash,
          ),
        },
        output: poolOutput(this.locks.slot, utxo.satoshis, this.category, 'mutable', encodePoolSlotCommitment({
          ...fields, flags: POOL_FLAG_SLOT, n: next.n, hash: next.hash,
        })),
      };
      return [{ step, n: next.n }];
    });
    const txids: string[] = [];
    let purse: Utxo | undefined;
    for (const part of chunks(writes)) {
      const locktime = part.reduce((max, { n }) => (n > max ? n : max), 0n);
      const sent = await this.send(part.map(({ step }) => step), [], Number(locktime), purse);
      txids.push(sent.txid);
      purse = assembledUtxo(sent, sent.transaction.outputs.length - 1);
    }
    return txids;
  }

  /** Mints `k` exact copies of a live info coin through the baton, which co-spends that coin by its read path. */
  async growInfo(k: number): Promise<string> {
    if (!Number.isSafeInteger(k) || k < 1) throw new Error(`oracle pool growInfo needs a positive count, not ${k}`);
    const baton = await this.ownBaton();
    const template = (await this.infoCoins()).find((coin) => coin.fields.flags === 0);
    if (template === undefined) throw new Error('the oracle pool has no live info coin to copy');
    const commitment = hexToBin(template.utxo.token!.nft!.commitment);
    const read: CoinStep = {
      spend: {
        utxo: template.utxo, lockingBytecode: this.locks.info, unlock: () => poolInfoReadUnlocking(this.locks.category),
      },
      output: poolOutput(this.locks.info, template.utxo.satoshis, this.category, 'mutable', commitment),
    };
    const copies = Array.from({ length: k }, () => (
      poolOutput(this.locks.info, POOL_COIN_SATS, this.category, 'mutable', commitment)));
    return (await this.send([this.batonMint(baton, 1), read], copies, 0)).txid;
  }

  /** Mints a slot for each block through the baton, with the baton's owner and depth, locked at the newest height. */
  async growSlots(blocks: readonly PoolBlock[]): Promise<string> {
    if (blocks.length === 0) throw new Error('oracle pool growSlots needs a block');
    const baton = await this.ownBaton();
    let locktime = 0n;
    const slots = blocks.map(({ n, hash }) => {
      if (n < 0n || n >= LOCKTIME_THRESHOLD) throw new Error(`oracle pool slot block ${n} is not a height`);
      if (n > locktime) locktime = n;
      return poolOutput(this.locks.slot, POOL_COIN_SATS, this.category, 'mutable', encodePoolSlotCommitment({
        flags: POOL_FLAG_SLOT, n, hash, owner: baton.fields.owner, depth: baton.fields.depth,
      }));
    });
    return (await this.send([this.batonMint(baton, 0)], slots, Number(locktime))).txid;
  }

  /** Sets the stop bits of each info coin or slot, so no reader matches it; nothing else changes. */
  async stop(coins: readonly Utxo[]): Promise<string[]> {
    const pubkey = publicKeyOf(this.key);
    const steps = coins.map((utxo): CoinStep => {
      const kind = this.kindOf(utxo);
      if (kind === 'baton') throw new Error('the oracle pool baton has no stop');
      const lock = this.locks[kind];
      const commitment = hexToBin(utxo.token!.nft!.commitment);
      const mask = kind === 'info' ? POOL_FLAG_NUMBER_STOPPED | POOL_FLAG_TIMESTAMP_STOPPED : POOL_FLAG_SLOT_STOPPED;
      commitment[0] = (commitment[0] ?? 0) | mask;
      return {
        spend: {
          utxo: { ...utxo, lockingBytecode: lock },
          lockingBytecode: lock,
          unlock: (sign) => (kind === 'info'
            ? poolInfoStopUnlocking(this.locks.category, pubkey, sign(this.key, this.locks.infoRedeem))
            : poolSlotStopUnlocking(this.locks.category, pubkey, sign(this.key, this.locks.slotRedeem))),
        },
        output: poolOutput(lock, utxo.satoshis, this.category, 'mutable', commitment),
      };
    });
    return this.sendChunks(steps);
  }

  /** Burns each pool coin, the baton included. No output carries the pool category; the owner takes the satoshis. */
  async sweep(coins: readonly Utxo[]): Promise<string[]> {
    const pubkey = publicKeyOf(this.key);
    const steps = coins.map((utxo): CoinStep => {
      const kind = this.kindOf(utxo);
      const lock = this.locks[kind];
      const redeem = { info: this.locks.infoRedeem, slot: this.locks.slotRedeem, baton: this.locks.batonRedeem }[kind];
      const unlocking = { info: poolInfoSweepUnlocking, slot: poolSlotSweepUnlocking, baton: poolBatonSweepUnlocking }[kind];
      return {
        spend: {
          utxo: { ...utxo, lockingBytecode: lock },
          lockingBytecode: lock,
          unlock: (sign) => unlocking(this.locks.category, pubkey, sign(this.key, redeem)),
        },
      };
    });
    return this.sendChunks(steps);
  }

  /**
   * Names `newKey` as the owner of every coin this key owns, the baton included, which keeps its depth. The last
   * transaction's change goes to the new owner's P2PKH, which pays the keeper's later fees; this keeper then signs
   * with `newKey`.
   */
  async rotate(newKey: Uint8Array): Promise<string[]> {
    const owner = this.owner();
    const next = poolOwnerOf(newKey);
    const pubkey = publicKeyOf(this.key);
    const rotated = <F extends { owner: Uint8Array }>(
      coins: readonly PoolCoin<F>[], encode: (fields: F) => Uint8Array,
    ): { coin: PoolCoin<F>; commitment: Uint8Array }[] => {
      const owned = coins.filter(({ fields }) => sameBytes(fields.owner, owner));
      return owned.map((coin) => ({ coin, commitment: encode({ ...coin.fields, owner: next }) }));
    };
    const steps: CoinStep[] = [
      ...rotated(await this.infoCoins(), encodePoolInfoCommitment).map(({ coin, commitment }): CoinStep => ({
        spend: {
          utxo: coin.utxo,
          lockingBytecode: this.locks.info,
          unlock: (sign) => poolInfoRotateUnlocking(
            this.locks.category, pubkey, sign(this.key, this.locks.infoRedeem), next,
          ),
        },
        output: poolOutput(this.locks.info, coin.utxo.satoshis, this.category, 'mutable', commitment),
      })),
      ...rotated(await this.slots(), encodePoolSlotCommitment).map(({ coin, commitment }): CoinStep => ({
        spend: {
          utxo: coin.utxo,
          lockingBytecode: this.locks.slot,
          unlock: (sign) => poolSlotRotateUnlocking(
            this.locks.category, pubkey, sign(this.key, this.locks.slotRedeem), next,
          ),
        },
        output: poolOutput(this.locks.slot, coin.utxo.satoshis, this.category, 'mutable', commitment),
      })),
    ];
    const baton = await this.baton();
    if (baton !== undefined && sameBytes(baton.fields.owner, owner)) {
      const commitment = encodePoolBatonCommitment({ owner: next, depth: baton.fields.depth });
      steps.push({
        spend: {
          utxo: baton.utxo,
          lockingBytecode: this.locks.baton,
          unlock: (sign) => poolBatonUpdateUnlocking(
            this.locks.category, pubkey, sign(this.key, this.locks.batonRedeem), commitment,
          ),
        },
        output: poolOutput(this.locks.baton, baton.utxo.satoshis, this.category, 'minting', commitment),
      });
    }
    const txids = await this.sendChunks(steps, newKey);
    this.key = newKey;
    return txids;
  }

  private owner(): Uint8Array {
    return poolOwnerOf(this.key);
  }

  private simulatorFields(height: number): Promise<PoolBlockFields> {
    const { getBlockTime } = this.provider as { getBlockTime?: () => number };
    if (this.provider.simulator !== true || getBlockTime === undefined) {
      throw new Error('PoolKeeper.start needs `fields` on a live network: only a simulator supplies its own');
    }
    return Promise.resolve(simulatorPoolFields(height, getBlockTime.call(this.provider) - 1));
  }

  private async hashOf(n: bigint): Promise<Uint8Array> {
    if (this.blockHash !== undefined) return this.blockHash(n);
    const { getBlockHash } = this.provider as { getBlockHash?: (height: number) => Promise<string> };
    if (getBlockHash === undefined) throw new Error('PoolKeeper.start needs `blockHash`: the provider has no getBlockHash');
    return hexToBin(await getBlockHash.call(this.provider, Number(n)));
  }

  private kindOf(utxo: Utxo): 'info' | 'slot' | 'baton' {
    const kind = poolCoinKind(utxo, this.category);
    if (kind === undefined) throw new Error(`${utxo.txid}:${utxo.vout} is not a coin of oracle pool ${this.category}`);
    return kind;
  }

  private async ownBaton(): Promise<PoolCoin<PoolBatonFields>> {
    const baton = await this.baton();
    if (baton === undefined) throw new Error(`oracle pool ${this.category} has no baton`);
    if (!sameBytes(baton.fields.owner, this.owner())) throw new Error('the oracle pool baton names another owner');
    return baton;
  }

  /** The baton's mint path, recreated unchanged at its index; `template` is the info coin a mint copies. */
  private batonMint(baton: PoolCoin<PoolBatonFields>, template: number): CoinStep {
    const pubkey = publicKeyOf(this.key);
    return {
      spend: {
        utxo: baton.utxo,
        lockingBytecode: this.locks.baton,
        unlock: (sign) => poolBatonMintUnlocking(
          this.locks.category, pubkey, sign(this.key, this.locks.batonRedeem), template,
        ),
      },
      output: poolOutput(this.locks.baton, baton.utxo.satoshis, this.category, 'minting', hexToBin(
        baton.utxo.token!.nft!.commitment,
      )),
    };
  }

  /** Updates each coin to `next` of its fields in one transaction; returns the recreated coins and the change. */
  private async updateInfo(
    coins: readonly PoolCoin<PoolInfoFields>[], next: (fields: PoolInfoFields) => PoolInfoFields, locktime: number,
    purse?: Utxo,
  ): Promise<{ txid: string; coins: PoolCoin<PoolInfoFields>[]; purse: Utxo }> {
    const pubkey = publicKeyOf(this.key);
    const updated = coins.map(({ fields }) => next(fields));
    const steps = coins.map(({ utxo }, index): CoinStep => {
      const commitment = encodePoolInfoCommitment(updated[index]!);
      return {
        spend: {
          utxo,
          lockingBytecode: this.locks.info,
          unlock: (sign) => poolInfoUpdateUnlocking(
            this.locks.category, pubkey, sign(this.key, this.locks.infoRedeem), commitment, locktime,
          ),
        },
        output: poolOutput(this.locks.info, utxo.satoshis, this.category, 'mutable', commitment),
      };
    });
    const sent = await this.send(steps, [], locktime, purse);
    return {
      txid: sent.txid,
      coins: updated.map((fields, index) => ({ utxo: assembledUtxo(sent, index), fields })),
      purse: assembledUtxo(sent, sent.transaction.outputs.length - 1),
    };
  }

  private async sendChunks(steps: readonly CoinStep[], lastChangeKey = this.key): Promise<string[]> {
    const txids: string[] = [];
    let purse: Utxo | undefined;
    const parts = chunks(steps);
    for (const [index, part] of parts.entries()) {
      const changeKey = index === parts.length - 1 ? lastChangeKey : this.key;
      const sent = await this.send(part, [], 0, purse, changeKey);
      txids.push(sent.txid);
      purse = assembledUtxo(sent, sent.transaction.outputs.length - 1);
    }
    return txids;
  }

  /**
   * Sends the steps' inputs with their outputs at the same indices, then `extra` outputs, with the owner's purse coin
   * as the last input and the change as the last output. Every step recreates its coin, or none does (a sweep).
   */
  private async send(
    steps: readonly CoinStep[], extra: readonly LibauthOutput[], locktime: number, purse?: Utxo,
    changeKey = this.key,
  ): Promise<AssembledPoolTransaction> {
    const outputs = steps.flatMap((step) => (step.output === undefined ? [] : [step.output]));
    if (outputs.length !== 0 && outputs.length !== steps.length) {
      throw new Error('an oracle pool transaction recreates every coin it spends, or none');
    }
    const payer = purse ?? await purseCoin(this.provider, this.key);
    const assembled = assemblePoolTransaction(
      [...steps.map((step) => step.spend), p2pkhSpend(payer, this.key)],
      [...outputs, ...extra],
      locktime,
      p2pkhLockOf(changeKey),
    );
    const before = this.provider.simulator === true ? await this.provider.getBlockHeight() : undefined;
    await this.provider.sendRawTransaction(assembled.hex);
    if (before !== undefined && await this.provider.getBlockHeight() === before + 1) this.ownBlocks += 1;
    return assembled;
  }
}
