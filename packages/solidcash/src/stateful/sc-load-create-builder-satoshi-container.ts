/**
 * phase-boundary extract: SC _createBuilder extract — discover satoshi-container UTXO when transfers need it.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { buildSatoshiContainerCovenantScript, type AbiFunction } from '@solidcash/utils';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import { scriptToLockingBytecode } from '../utils.js';
import {
  createSatoshiContainerUnlocker,
  directContainerOptions,
  directConventionMasterLock,
  getSatoshiContainerAddress,
} from './covenant-helpers.js';

export type LoadCreateBuilderSatoshiContainerHost = {
  readonly categoryId: string;
  readonly inner: {
    addressType: any;
    provider: { getUtxos(address: string): Promise<Utxo[]> };
  };
};

export type LoadCreateBuilderSatoshiContainerResult = {
  satoshiContainerUtxo: UnlockableUtxo | undefined;
  satoshiContainerLockingBytecode: Uint8Array | undefined;
};

/**
 * Load the container used by the active function's transfers or layout slot.
 * A slot reserved only to read the balance may be empty before the first deposit.
 */
export async function loadCreateBuilderSatoshiContainer(
  host: LoadCreateBuilderSatoshiContainerHost,
  params: {
    abiFunction: AbiFunction | undefined;
    overrides: { blockBase?: number } | undefined;
  },
): Promise<LoadCreateBuilderSatoshiContainerResult> {
  const { abiFunction, overrides } = params;
  const transferCount = abiFunction?.transferCount ?? 0;
  const selectedContainer = (abiFunction as MessageBusRuntimeAbiFunction | undefined)
    ?.messageBusActiveSatoshiContainer;
  const containerSlot = abiFunction?.blockLayout?.slots.find((slot) => slot.kind === 'satoshiContainer');
  const needsSatoshiContainer = selectedContainer ?? (transferCount > 0 || containerSlot !== undefined);
  let satoshiContainerUtxo: UnlockableUtxo | undefined;
  let satoshiContainerLockingBytecode: Uint8Array | undefined;

  if (needsSatoshiContainer) {
    const satoshiContainerAddress = getSatoshiContainerAddress(host.inner as any, host.categoryId);
    const containerUtxos = await host.inner.provider.getUtxos(satoshiContainerAddress);
    // Anyone can pay a small coin to this address, so the call takes the coin most able to cover its transfer and
    // fee rather than whichever is listed first; this is the choice the single-container pragma path already makes.
    const containerUtxo = containerUtxos.filter((u) => !u.token)
      .sort((left, right) => (left.satoshis > right.satoshis ? -1 : left.satoshis < right.satoshis ? 1 : 0))[0];
    if (!containerUtxo) {
      if (containerSlot?.conditional === true) return { satoshiContainerUtxo, satoshiContainerLockingBytecode };
      throw new Error(
        'Satoshi container UTXO not found. Deploy the contract with initialBalance or '
        + `fund the satoshi container at ${satoshiContainerAddress}`,
      );
    }

    const satoshiContainerUnlocker = createSatoshiContainerUnlocker(
      host.inner as any, overrides?.blockBase ?? 0, host.categoryId,
    );
    satoshiContainerUtxo = { ...containerUtxo, unlocker: satoshiContainerUnlocker };

    const covenantScript = buildSatoshiContainerCovenantScript(
      hexToBin(host.categoryId), directConventionMasterLock(host.inner as any),
      directContainerOptions(host.inner as any, 'satoshiContainer'),
    );
    satoshiContainerLockingBytecode = scriptToLockingBytecode(
      covenantScript, host.inner.addressType,
    );
  }

  return { satoshiContainerUtxo, satoshiContainerLockingBytecode };
}
