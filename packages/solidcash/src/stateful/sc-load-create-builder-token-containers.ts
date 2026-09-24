/**
 * phase-boundary extract: SC _createBuilder extract — discover and unlock token-container UTXOs.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import { buildTokenContainerCovenantScript, type AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Utxo } from '../interfaces.js';
import { scriptToLockingBytecode } from '../utils.js';
import {
  createTokenContainerUnlocker,
  getTokenContainerAddress,
} from './covenant-helpers.js';
import type { TokenContainerInfo } from './external-call-utxo-group.js';

export type LoadCreateBuilderTokenContainersHost = {
  readonly categoryId: string;
  readonly inner: {
    addressType: any;
    provider: { getUtxos(address: string): Promise<Utxo[]> };
  };
};

export type LoadCreateBuilderTokenContainersResult = {
  tokenContainers: TokenContainerInfo[];
  tokenContainerLockingBytecodes: Map<string, Uint8Array>;
};

/**
 * Resolve token-container categories from function args, build covenant locks,
 * and fetch on-chain container UTXOs when present.
 */
export async function loadCreateBuilderTokenContainers(
  host: LoadCreateBuilderTokenContainersHost,
  params: {
    abiFunction: AbiFunction | undefined;
    args: readonly FunctionArgument[];
    overrides: { blockBase?: number } | undefined;
    timing?: (label: string) => void;
  },
): Promise<LoadCreateBuilderTokenContainersResult> {
  const { abiFunction, args, overrides, timing } = params;
  timing?.('token-containers-start');
  const tokenContainerAccesses = abiFunction?.tokenContainerAccesses;
  const tokenContainers: TokenContainerInfo[] = [];
  const tokenContainerLockingBytecodes = new Map<string, Uint8Array>();

  if (tokenContainerAccesses && tokenContainerAccesses.length > 0) {
    for (let slotIndex = 0; slotIndex < tokenContainerAccesses.length; slotIndex++) {
      const access = tokenContainerAccesses[slotIndex];
      const keyParamIndex = abiFunction!.inputs.findIndex((inp) => inp.name === access.keyParam);
      if (keyParamIndex < 0 && access.keySource !== 'own') {
        throw new Error(
          `Token container key parameter '${access.keyParam}' not found in function inputs`,
        );
      }
      const tokenContainerCategoryValue = access.keySource === 'own'
        ? hexToBin(host.categoryId) : args[keyParamIndex];
      const tokenContainerCategoryId = tokenContainerCategoryValue instanceof Uint8Array
        ? binToHex(tokenContainerCategoryValue) : String(tokenContainerCategoryValue);

      const covenantScript = buildTokenContainerCovenantScript(
        hexToBin(host.categoryId), hexToBin(tokenContainerCategoryId),
      );
      const lockingBytecode = scriptToLockingBytecode(covenantScript, host.inner.addressType);
      tokenContainerLockingBytecodes.set(tokenContainerCategoryId, lockingBytecode);

      const containerAddress = getTokenContainerAddress(
        host.inner as any, host.categoryId, tokenContainerCategoryId,
      );
      let containerUtxo: Utxo | undefined;
      try {
        const containerUtxos = await host.inner.provider.getUtxos(containerAddress);
        containerUtxo = containerUtxos.find(
          (u) => u.token?.category === tokenContainerCategoryId,
        );
      } catch {
        // Container doesn't exist yet
      }

      const exists = !!containerUtxo;
      const tokenContainerUnlocker = createTokenContainerUnlocker(
        host.inner as any, overrides?.blockBase ?? 0, host.categoryId, tokenContainerCategoryId,
      );

      tokenContainers.push({
        keyParam: access.keyParam,
        tokenContainerSlotIndex: slotIndex,
        tokenContainerCategoryId,
        exists,
        utxo: containerUtxo ? { ...containerUtxo, unlocker: tokenContainerUnlocker } : undefined,
      });
    }
  }
  timing?.('token-containers-complete');
  return { tokenContainers, tokenContainerLockingBytecodes };
}
