import { hexToBin } from '@bitauth/libauth';
import { ElectrumClient } from '@electrum-cash/network';
import { BchnRpcClient } from '@mr-zwets/bchn-api-wrapper';
import { Contract } from '../Contract.js';
import { StatefulContract } from '../stateful/StatefulContract.js';
import SignatureTemplate from '../SignatureTemplate.js';

/**
 * Off-chain keeper that keeps a per-contract block.* oracle register fresh (docs/block-oracle.md). It
 * subscribes to Fulcrum block-header notifications and, on each new tip, reads the block from a BCHN
 * JSON-RPC, compares its height with the oracle's current height, and pushes a signed + freshness-bound
 * `__updateBlockOracle` if the chain is ahead. The owner key is the contract's baked `__blockOracleOwner`.
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
}

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
  };
}

// Map fetched fields to the contract's injected registers, in the ABI order of __updateBlockOracle. Only
// the registers the contract actually references are written (a contract may use a subset of block.*).
function buildUpdate(
  contract: Contract,
  fields: BlockOracleFields,
): { args: Array<bigint | Uint8Array>; state: Record<string, bigint | Uint8Array> } {
  const byRegister: Record<string, bigint | Uint8Array> = {
    __block_number: fields.number,
    __block_timestamp: fields.timestamp,
    __block_difficulty: fields.difficulty,
    __block_size: fields.size,
    __block_totalFees: fields.totalFees,
    __block_coinbase: fields.coinbase,
  };
  const updateAbi = contract.artifact.abi.find((fn) => fn.name === '__updateBlockOracle');
  if (!updateAbi) throw new Error('contract does not use block.* (no __updateBlockOracle in the ABI)');

  const args: Array<bigint | Uint8Array> = [];
  const state: Record<string, bigint | Uint8Array> = {};
  for (const input of updateAbi.inputs) {
    if (input.name === '__blockOracleSig') continue; // signature supplied separately
    const register = `__block_${input.name.slice('__set_'.length)}`;
    const value = byRegister[register];
    if (value === undefined) throw new Error(`unexpected oracle setter param: ${input.name}`);
    args.push(value);
    state[register] = value;
  }
  return { args, state };
}

export interface BlockOracleUpdaterConfig {
  contract: Contract;
  categoryId: string;
  ownerKey: Uint8Array; // private key of the baked __blockOracleOwner
  rpc: RpcLike;
  electrumHost?: string; // Fulcrum host for blockchain.headers.subscribe
}

export class BlockOracleUpdater {
  constructor(private readonly cfg: BlockOracleUpdaterConfig) {}

  /** Current oracle height from the on-chain __block_number register (0 if absent). */
  async oracleHeight(): Promise<bigint> {
    const sc = StatefulContract.withCategory(this.cfg.contract, this.cfg.categoryId);
    const state = await sc.getState();
    return BigInt((state.__block_number as bigint | undefined) ?? 0n);
  }

  /** Push a signed + freshness-bound update for the given block fields. Returns the txid. */
  async pushUpdate(fields: BlockOracleFields): Promise<string> {
    const { args, state } = buildUpdate(this.cfg.contract, fields);
    const sc = StatefulContract.withCategory(this.cfg.contract, this.cfg.categoryId);
    const call = (sc as any).__updateBlockOracle(new SignatureTemplate(this.cfg.ownerKey), ...args)
      .setState(state)
      .setLocktime(Number(fields.number)); // freshness: require(tx.time >= number)
    const tx = await call.send();
    return tx.txid;
  }

  /** Fetch the tip; if ahead of the oracle, push an update. Returns the update txid or null if up to date. */
  async syncOnce(): Promise<string | null> {
    const tip = Number(await this.cfg.rpc.request('getblockcount'));
    if (BigInt(tip) <= (await this.oracleHeight())) return null;
    const hash: string = await this.cfg.rpc.request('getblockhash', tip);
    return this.pushUpdate(await fetchBlockOracleFields(this.cfg.rpc, hash));
  }

  /**
   * Subscribe to Fulcrum header notifications and sync on every new tip. Returns a stop() that
   * unsubscribes and disconnects. Does an initial sync before returning.
   */
  async start(): Promise<() => Promise<void>> {
    if (!this.cfg.electrumHost) throw new Error('electrumHost is required to subscribe to headers');
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
