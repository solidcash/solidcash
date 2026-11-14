/**
 * A8: a payment to a stateful contract's master lock is stuck for good.
 *
 * A master lock spends only a coin that carries its category's minting NFT: a direct master starts with pin(X), and a
 * framed master's prologue makes the same check. A payment carries no such NFT. The compiler routes a payment to a
 * `new` result to the child's container and refuses or warns on a contract-typed recipient, but a lock passed as
 * `bytes` is known only once a transaction is built. This refuses such an output then, and names the satoshi container
 * the payment belongs at when the chain shows which coin that is.
 */
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { buildDataNftCovenantScript, buildSatoshiContainerCovenantScript } from '@solidcash/utils';
import { isContractUnlocker, type Output, type UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { addressToLockScript, getNetworkPrefix, scriptToLockingBytecode } from '../utils.js';
import { getSatoshiContainerAddress } from './covenant-helpers.js';

/** An output that pays a stateful contract's master lock, where the coin could never be spent. */
export class StatefulMasterPaymentError extends Error {
  constructor(
    readonly outputIndex: number,
    readonly masterAddress: string,
    readonly categoryId: string,
    readonly containerAddress: string | undefined,
    tokens: boolean,
  ) {
    super(`Output ${outputIndex} pays ${masterAddress}, the master lock of the stateful contract with category `
      + `${categoryId}: the master spends only a coin that carries its minting NFT, so this one could never be spent. `
      + (tokens ? 'Pay the tokens to its token container for that category'
        : containerAddress !== undefined ? `Pay its satoshi container ${containerAddress}`
          : 'Pay its satoshi container')
      + ', or call one of its payable functions.');
    this.name = 'StatefulMasterPaymentError';
  }
}

/** A P2SH32 lock: a direct master's. */
const isP2sh32 = (lock: Uint8Array): boolean => lock.length === 35 && lock[0] === 0xaa && lock[1] === 0x20
  && lock[34] === 0x87;

/** A P2SH20 lock: a master compiled for that address type binds category-only covenants. */
const isP2sh20 = (lock: Uint8Array): boolean => lock.length === 23 && lock[0] === 0xa9 && lock[1] === 0x14
  && lock[22] === 0x87;

const lockOf = (to: string | Uint8Array): Uint8Array => (typeof to === 'string' ? addressToLockScript(to) : to);

const addressOf = (lock: Uint8Array, network: string): string => {
  const result = lockingBytecodeToCashAddress({ bytecode: lock, prefix: getNetworkPrefix(network), tokenSupport: true });
  return typeof result === 'string' ? binToHex(lock) : result.address;
};

/**
 * Whether `master`, a P2SH lock holding the minting NFT of `categoryId`, is a SolidCash master: a coin sits at a
 * covenant only such a master binds. A direct P2SH32 master binds its data record and satoshi container to its own
 * lock; a framed master, or one compiled for P2SH20, binds them to the category alone. Returns the container lock
 * when exactly one container form holds coins, `null` when the master shows otherwise, else undefined.
 */
async function solidCashMasterEvidence(
  provider: NetworkProvider, master: Uint8Array, categoryId: string,
): Promise<Uint8Array | null | undefined> {
  const category = hexToBin(categoryId);
  const direct = isP2sh32(master) ? master : undefined;
  const records = [
    ...(direct === undefined ? [] : [scriptToLockingBytecode(buildDataNftCovenantScript(category, direct), 'p2sh32')]),
    scriptToLockingBytecode(buildDataNftCovenantScript(category), 'p2sh32'),
    scriptToLockingBytecode(buildDataNftCovenantScript(category), 'p2sh20'),
  ];
  const containers = [
    ...(direct === undefined ? [] : [false, true].flatMap((masterRetires) => [false, true].map((keepsTokenless) =>
      scriptToLockingBytecode(
        buildSatoshiContainerCovenantScript(category, direct, { masterRetires, keepsTokenless }), 'p2sh32',
      )))),
    scriptToLockingBytecode(buildSatoshiContainerCovenantScript(category), 'p2sh32'),
  ];
  const coins = await Promise.all([...records, ...containers].map((lock) => provider.getUtxosForLockingBytecode(lock)));
  const held = containers.filter((_lock, index) => coins[records.length + index]!.length > 0);
  if (held.length === 1) return held[0];
  if (held.length > 1) return null;
  const sameCategory = (coinCategory: string | undefined): boolean =>
    coinCategory?.toLowerCase() === categoryId.toLowerCase();
  return coins.slice(0, records.length).some((atRecord) => atRecord.some((coin) => sameCategory(coin.token?.category)))
    ? null : undefined;
}

/**
 * Refuse a transaction whose output pays a stateful master lock without that master's minting NFT.
 *
 * An output carrying a minting NFT recreates a master, and one carrying an NFT of a category an input holds is a record
 * or event of a contract in the transaction; neither is a payment. A lock a stateful contract in the transaction holds
 * its master at is a master lock as the transaction shows. Any other P2SH lock is looked up: one holding a minting NFT
 * is a master lock only when a coin sits at its data record or satoshi container, so a wallet script holding a minting
 * NFT is still paid.
 */
export async function refusePaymentsToStatefulMasters(
  provider: NetworkProvider, inputs: readonly UnlockableUtxo[], outputs: readonly Output[],
): Promise<void> {
  const inputCategories = new Set(inputs.flatMap((input) => (input.token ? [input.token.category.toLowerCase()] : [])));
  const inputsAt = new Map<string, UnlockableUtxo[]>();
  for (const input of inputs) {
    const key = binToHex(input.unlocker.generateLockingBytecode());
    inputsAt.set(key, [...(inputsAt.get(key) ?? []), input]);
  }
  const checked = new Set<string>();
  for (const [index, output] of outputs.entries()) {
    const nft = output.token?.nft;
    if (nft?.capability === 'minting') continue;
    if (nft !== undefined && inputCategories.has(output.token!.category.toLowerCase())) continue;
    const lock = lockOf(output.to);
    const key = binToHex(lock);
    if ((!isP2sh32(lock) && !isP2sh20(lock)) || checked.has(key)) continue;
    checked.add(key);
    const tokens = output.token !== undefined;
    const spent = inputsAt.get(key) ?? [];
    const master = spent.find((input) => input.token?.nft?.capability === 'minting'
      && isContractUnlocker(input.unlocker) && input.unlocker.contract.artifact?.stateLayout !== undefined
      && input.unlocker.contract.lockingBytecode?.toLowerCase() === key);
    if (master !== undefined && isContractUnlocker(master.unlocker)) {
      const categoryId = master.token!.category;
      throw new StatefulMasterPaymentError(index, addressOf(lock, provider.network), categoryId,
        getSatoshiContainerAddress(master.unlocker.contract, categoryId), tokens);
    }
    // A lock the transaction spends a coin from is one of its own covenants: a container, a record.
    if (spent.length > 0) continue;
    const minting = (await provider.getUtxosForLockingBytecode(lock))
      .find((coin) => coin.token?.nft?.capability === 'minting');
    if (minting === undefined) continue;
    const container = await solidCashMasterEvidence(provider, lock, minting.token!.category);
    if (container === undefined) continue;
    throw new StatefulMasterPaymentError(index, addressOf(lock, provider.network), minting.token!.category,
      container === null ? undefined : addressOf(container, provider.network), tokens);
  }
}
