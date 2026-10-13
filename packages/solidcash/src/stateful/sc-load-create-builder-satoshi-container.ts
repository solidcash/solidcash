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
 * When the active function transfers satoshis (or reserves a satoshiContainer
 * layout slot), fetch the on-chain satoshi-container UTXO and build its lock.
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
  const needsSatoshiContainer = selectedContainer ?? (transferCount > 0
    || abiFunction?.blockLayout?.slots.some((slot) => slot.kind === 'satoshiContainer') === true);
  let satoshiContainerUtxo: UnlockableUtxo | undefined;
  let satoshiContainerLockingBytecode: Uint8Array | undefined;

  if (needsSatoshiContainer) {
    const satoshiContainerAddress = getSatoshiContainerAddress(host.inner as any, host.categoryId);
    const containerUtxos = await host.inner.provider.getUtxos(satoshiContainerAddress);
    const containerUtxo = containerUtxos.find((u) => !u.token);
    if (!containerUtxo) {
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
    );
    satoshiContainerLockingBytecode = scriptToLockingBytecode(
      covenantScript, host.inner.addressType,
    );
  }

  return { satoshiContainerUtxo, satoshiContainerLockingBytecode };
}
