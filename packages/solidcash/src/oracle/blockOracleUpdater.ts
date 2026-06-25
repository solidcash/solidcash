import { hexToBin, binToHex, secp256k1 } from '@bitauth/libauth';
import { ElectrumClient } from '@electrum-cash/network';
import { BchnRpcClient } from '@mr-zwets/bchn-api-wrapper';
import {
  Artifact, blockhashOracleLockingBytecode, buildBlockhashCommitment, buildBlockhashOracleCovenantScript,
  scriptToBytecode, encodeInt, hash160,
} from '@solidcash/utils';
import { Contract } from '../Contract.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { Utxo, Unlocker } from '../interfaces.js';
import { StatefulContract } from '../stateful/StatefulContract.js';
import SignatureTemplate from '../SignatureTemplate.js';

/**
 * Off-chain keeper for a contract's block.* oracles (docs/block-oracle.md). It subscribes to Fulcrum
 * block-header notifications and, on each new tip, maintains only the oracle(s) the contract actually uses:
 *
 *  - block-info register (block.number/timestamp/...): present iff the artifact has `__updateBlockOracle`.
 *    Reads the block from a BCHN JSON-RPC and pushes a signed + freshness-bound `__updateBlockOracle` when
 *    the chain is ahead of the on-chain register.
 *  - n->hash oracle (blockhash(n)): present iff the artifact stamps usesBlockhash. Mints the per-block
 *    (n->hash) UTXO under the project-global oracle category. (Sweeping the one that aged out of the
 *    256-block window is a keeper follow-up; the covenant's permissionless tx.time>=n+256 wipe is in place.)
 *
 * The keeper/operator private key signs both (the contract's baked `__blockOracleOwner` for block-info,
 * and the n->hash mint).
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

// EVM-parity blockhash window.
export const BLOCKHASH_WINDOW = 256;

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
  // Operator/keeper private key. Signs the block-info `__updateBlockOracle` (vs the baked
  // `__blockOracleOwner`) and the n->hash oracle mints.
  keeperKey: Uint8Array;
  rpc: RpcLike;
  electrumHost?: string; // Fulcrum host for blockchain.headers.subscribe
  // Project-global blockhash (n->hash) oracle token category. Required only for blockhash() consumers.
  blockhashOracleCategory?: string;
  // The keeper's C_oracle minting NFT (master), used to mint the per-block (n->hash) oracle UTXOs.
  blockhashOracleMaster?: { utxo: Utxo; unlocker: Unlocker };
}

export class BlockOracleUpdater {
  constructor(private readonly cfg: BlockOracleUpdaterConfig) {}

  /** The contract writes a current-block register set (block.number/timestamp/...). */
  static usesBlockInfo(artifact: Artifact): boolean {
    return artifact.abi.some((fn) => fn.name === '__updateBlockOracle');
  }

  /**
   * The contract reads blockhash(n), so it needs the project-global (n->hash) oracle. The compiler stamps
   * this marker on the artifact when blockhash() is referenced (see docs/block-oracle.md).
   */
  static usesBlockhash(artifact: Artifact): boolean {
    return artifact.usesBlockhash === true;
  }

  /** Current block-info oracle height from the on-chain __block_number register (0 if absent). */
  async oracleHeight(): Promise<bigint> {
    const sc = StatefulContract.withCategory(this.cfg.contract, this.cfg.categoryId);
    const state = await sc.getState();
    return BigInt((state.__block_number as bigint | undefined) ?? 0n);
  }

  /** Push a signed + freshness-bound block-info update for the given block fields. Returns the txid. */
  async pushUpdate(fields: BlockOracleFields): Promise<string> {
    const { args, state } = buildUpdate(this.cfg.contract, fields);
    const sc = StatefulContract.withCategory(this.cfg.contract, this.cfg.categoryId);
    const call = (sc as any).__updateBlockOracle(new SignatureTemplate(this.cfg.keeperKey), ...args)
      .setState(state)
      .setLocktime(Number(fields.number)); // freshness: require(tx.time >= number)
    const tx = await call.send();
    return tx.txid;
  }

  /**
   * Mint the (n -> hash) oracle UTXO at addr(n) under the oracle category, spending + recreating the
   * keeper's C_oracle minting master. Returns the mint txid.
   */
  async mintBlockhashPair(n: bigint, hash: Uint8Array): Promise<string> {
    const catHex = this.cfg.blockhashOracleCategory;
    const master = this.cfg.blockhashOracleMaster;
    if (!catHex || !master) {
      throw new Error('blockhashOracleCategory + blockhashOracleMaster are required to mint (n->hash) pairs');
    }
    const addrN = blockhashOracleLockingBytecode(hexToBin(catHex), n);
    const commitment = binToHex(buildBlockhashCommitment(n, hash));
    const mintSats = 1000n;
    const fee = 1000n;
    const tx = await new TransactionBuilder({ provider: this.cfg.contract.provider })
      .addInput(master.utxo, master.unlocker)
      .addOutput({
        to: master.unlocker.generateLockingBytecode(),
        amount: master.utxo.satoshis - mintSats - fee,
        token: master.utxo.token,
      }) // recreate the minting master
      .addOutput({
        to: addrN,
        amount: mintSats,
        token: { category: catHex, amount: 0n, nft: { capability: 'none', commitment } },
      }) // mint the (n,hash) oracle NFT
      .send();
    return tx.txid;
  }

  /**
   * Sweep (burn) the (n->hash) oracle UTXO that aged out of the 256-block window, reclaiming its dust to
   * the keeper's P2PKH. Best-effort: returns null if nothing sits at addr(n). Spends the covenant wipe
   * path (flag 1) under tx.time >= n+256 - mineable once the chain reaches n+256. The covenant also lets
   * anyone wipe, so this is a keeper convenience (reclaim dust), not a liveness dependency.
   */
  async sweepBlockhashPair(n: bigint): Promise<string | null> {
    const catHex = this.cfg.blockhashOracleCategory;
    if (!catHex) throw new Error('blockhashOracleCategory is required to sweep (n->hash) pairs');
    const cat = hexToBin(catHex);
    const addrN = blockhashOracleLockingBytecode(cat, n);
    const utxos = await this.cfg.contract.provider.getUtxosForLockingBytecode(addrN);
    if (utxos.length === 0) return null;

    const redeem = scriptToBytecode(buildBlockhashOracleCovenantScript(cat, n));
    const wipeUnlock = scriptToBytecode([encodeInt(1n), redeem]); // flag 1 = wipe branch
    const unlocker = { generateLockingBytecode: (): Uint8Array => addrN, generateUnlockingBytecode: (): Uint8Array => wipeUnlock };

    const builder = new TransactionBuilder({ provider: this.cfg.contract.provider, allowImplicitNftBurn: true });
    let reclaimed = 0n;
    for (const utxo of utxos) {
      builder.addInput(utxo, unlocker);
      reclaimed += utxo.satoshis;
    }
    const fee = 1000n;
    const tx = await builder
      .addOutput({ to: this.keeperP2pkh(), amount: reclaimed - fee })
      .setLocktime(Number(n + BigInt(BLOCKHASH_WINDOW)))
      .send();
    return tx.txid;
  }

  // The keeper's own P2PKH locking bytecode (reclaim destination for swept dust).
  private keeperP2pkh(): Uint8Array {
    const pub = secp256k1.derivePublicKeyCompressed(this.cfg.keeperKey);
    if (typeof pub === 'string') throw new Error(`invalid keeper key: ${pub}`);
    return Uint8Array.from([0x76, 0xa9, 0x14, ...hash160(pub), 0x88, 0xac]);
  }

  /**
   * Maintain the project-global (n->hash) oracle on a new tip: mint the tip's (n, hash) pair and sweep the
   * pair that just aged out of the 256-block window (best-effort dust reclaim).
   */
  private async maintainBlockhashWindow(tip: number): Promise<void> {
    const hashHex: string = await this.cfg.rpc.request('getblockhash', tip);
    await this.mintBlockhashPair(BigInt(tip), hexToBin(hashHex));
    if (tip > BLOCKHASH_WINDOW) await this.sweepBlockhashPair(BigInt(tip - BLOCKHASH_WINDOW));
  }

  /**
   * Fetch the tip and maintain whichever oracle(s) this contract uses. Returns the block-info update txid
   * (or null if the block-info oracle is absent or already current).
   */
  async syncOnce(): Promise<string | null> {
    const tip = Number(await this.cfg.rpc.request('getblockcount'));
    const { artifact } = this.cfg.contract;

    let blockInfoTxid: string | null = null;
    if (BlockOracleUpdater.usesBlockInfo(artifact) && BigInt(tip) > (await this.oracleHeight())) {
      const hash: string = await this.cfg.rpc.request('getblockhash', tip);
      blockInfoTxid = await this.pushUpdate(await fetchBlockOracleFields(this.cfg.rpc, hash));
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
