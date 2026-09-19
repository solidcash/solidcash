/**
 * Bridge from the harness mock chain to Solidity `block.*` (HARDHAT-PARITY.md WS6). SolidCash contracts read
 * `block.timestamp` / `block.number` from oracle-backed state registers maintained off-chain by a
 * BlockOracleUpdater. `mockBlockOracleRpc(provider)` is an RpcLike whose height/time come from the mock provider,
 * so after `time.increase(...)` / `mine(...)` a `updater.syncOnce()` pushes the advanced block.timestamp/number
 * into the contract - the same way Hardhat's `time.increase` moves `block.timestamp` for ported contracts.
 */
import type { RpcLike } from 'solidcash';
interface BlockTimeProvider {
    getBlockHeight(): Promise<number>;
    getBlockTime(): number;
}
/** Build a BCHN-JSON-RPC-shaped stub whose block height/timestamp track the mock provider's simulated chain. */
export declare function mockBlockOracleRpc(provider: BlockTimeProvider): RpcLike;
export { BlockOracleUpdater, fetchBlockOracleFields } from 'solidcash';
export type { RpcLike, BlockOracleFields } from 'solidcash';
