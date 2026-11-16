/**
 * phase-boundary extract: SC _createBuilder extract — discover and unlock token-container UTXOs.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { buildTokenContainerCovenantScript, type AbiFunction, type TokenContainerAccessAbi } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Utxo } from '../interfaces.js';
import { calculateDust, scriptToLockingBytecode } from '../utils.js';
import {
  createTokenContainerUnlocker,
  directContainerOptions,
  directConventionMasterLock,
  getTokenContainerAddress,
} from './covenant-helpers.js';
import type { TokenContainerInfo } from './external-call-utxo-group.js';

/** The largest fungible amount a coin can hold, which takes the most bytes to encode. */
const MOST_TOKENS = (1n << 63n) - 1n;

/** The coin holding the most fungible tokens. */
const largest = (utxos: readonly Utxo[]): Utxo | undefined => utxos.reduce<Utxo | undefined>(
  (best, utxo) => (best === undefined || utxo.token!.amount > best.token!.amount ? utxo : best),
  undefined,
);

/**
 * Whether a call can keep using a coin. A coin keeps its satoshis and the dust floor rises with the amount's encoded
 * size, so one under the floor of the largest amount is a coin a call may fail to recreate. A coin with an NFT a
 * script can see is one nothing but a stranger made: no call hangs one on a container, and a minting one cannot pay.
 * An immutable NFT with an empty commitment no script can see, so the deployment's own coin can hold one.
 */
const usable = (utxo: Utxo, lockingBytecode: Uint8Array): boolean => {
  const nft = utxo.token!.nft;
  if (nft !== undefined && (nft.capability !== 'none' || nft.commitment.length > 0)) return false;
  return utxo.satoshis >= BigInt(calculateDust({
    to: lockingBytecode, amount: utxo.satoshis, token: { ...utxo.token!, amount: MOST_TOKENS },
  }));
};

export type LoadCreateBuilderTokenContainersHost = {
  readonly categoryId: string;
  readonly inner: {
    addressType: any;
    provider: { getUtxos(address: string): Promise<Utxo[]> };
    /** The direct contract's creation parameters and the values its handle was built with. */
    artifact: { readonly constructorInputs: readonly { readonly name: string }[] };
    constructorArgs: readonly unknown[];
  };
};

export type LoadCreateBuilderTokenContainersResult = {
  tokenContainers: TokenContainerInfo[];
  tokenContainerLockingBytecodes: Map<string, Uint8Array>;
};

/**
 * The category a token-container access names: the contract's own, an argument, or the immutable state variable the
 * artifact publishes for it, read from the state the call loaded.
 */
export function tokenContainerKeyValue(
  access: TokenContainerAccessAbi, categoryId: string, args: readonly unknown[], keyParamIndex: number,
  stateValues: Readonly<Record<string, unknown>> | undefined,
): unknown {
  if (access.keySource === 'own') return hexToBin(categoryId);
  if (access.keySource !== 'state') return keyParamIndex >= 0 ? args[keyParamIndex] : undefined;
  const value = access.keyStateVariable === undefined ? undefined : stateValues?.[access.keyStateVariable];
  if (value === undefined) {
    throw new Error(
      `Token container category '${access.keyStateVariable}' is a state variable the call did not load`,
    );
  }
  return value;
}

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
    /** The state the call loaded, for a container keyed by an immutable state variable. */
    stateValues?: Readonly<Record<string, unknown>>;
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
      // A key the contract declares at creation time is not a function input; its value is in the handle.
      const creationIndex = keyParamIndex < 0 && access.keySource !== 'own' && access.keySource !== 'state'
        ? host.inner.artifact.constructorInputs.findIndex((input) => input.name === access.keyParam)
        : -1;
      if (keyParamIndex < 0 && creationIndex < 0
        && access.keySource !== 'own' && access.keySource !== 'state') {
        throw new Error(
          `Token container key parameter '${access.keyParam}' not found in function inputs or contract creation inputs`,
        );
      }
      const tokenContainerCategoryValue = creationIndex >= 0
        ? host.inner.constructorArgs[creationIndex]
        : tokenContainerKeyValue(access, host.categoryId, args, keyParamIndex, params.stateValues);
      const tokenContainerCategoryId = tokenContainerCategoryValue instanceof Uint8Array
        ? binToHex(tokenContainerCategoryValue) : String(tokenContainerCategoryValue);

      const covenantScript = buildTokenContainerCovenantScript(
        hexToBin(host.categoryId), hexToBin(tokenContainerCategoryId),
        directConventionMasterLock(host.inner as any), directContainerOptions(host.inner as any, 'tokenContainer'),
      );
      const lockingBytecode = scriptToLockingBytecode(covenantScript, host.inner.addressType);
      tokenContainerLockingBytecodes.set(tokenContainerCategoryId, lockingBytecode);

      const containerAddress = getTokenContainerAddress(
        host.inner as any, host.categoryId, tokenContainerCategoryId,
      );
      let containerUtxo: Utxo | undefined;
      try {
        const containerUtxos = (await host.inner.provider.getUtxos(containerAddress))
          .filter((u) => u.token?.category === tokenContainerCategoryId);
        // Anyone can pay a coin to this address, so a contract keeping one coin takes the largest it can use. A coin
        // it cannot is what one paid in to stop every call would be, and the covenant keeps the deployment's coin usable.
        // The largest coin a call can use, with or without the single-container pragma: anyone may pay a small
        // coin to this address, and a call spending it instead of the usable one would strand every later call.
        containerUtxo = largest(containerUtxos.filter((utxo) => usable(utxo, lockingBytecode))) ?? largest(containerUtxos);
      } catch {
        // Container doesn't exist yet
      }

      const exists = !!containerUtxo;
      if (!exists && abiFunction?.blockLayout?.singleTokenContainer === true) {
        throw new Error(
          `Token container for ${tokenContainerCategoryId} not found. Under pragma tokencontainer single a call cannot `
          + 'open one: deploy the contract with tokenContainers.',
        );
      }
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
