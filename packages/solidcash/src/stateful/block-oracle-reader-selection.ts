import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import { isPoolInfoInput } from '../oracle/pool/reader.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import { cloneToken } from './stb-output-utils.js';
import type { AbiFunction } from '@solidcash/utils';

/** A block oracle reader must publish both the effect and its physical witness slot. */
export function hasPublishedBlockOracleSlot(fn: AbiFunction | undefined): boolean {
  return fn?.usesBlockOracle === true
    && fn.blockLayout?.slots.some((slot) => slot.kind === 'blockInfoOracle') === true;
}

/** Select the final root-side oracle band from published effects and physical ownership. */
export function selectRootBlockOracleReader<T>(
  root: T,
  rootAbi: AbiFunction | undefined,
  delegates: readonly { reader: T; callMode?: string; abiFunction?: AbiFunction; rootOwned?: boolean }[],
): { reader: T; delegateIndex?: number } | undefined {
  if (hasPublishedBlockOracleSlot(rootAbi)) return { reader: root };
  const delegateIndex = delegates.findIndex((delegate) => delegate.rootOwned !== false
    && delegate.callMode === 'delegatecall' && hasPublishedBlockOracleSlot(delegate.abiFunction));
  return delegateIndex < 0 ? undefined : { reader: delegates[delegateIndex].reader, delegateIndex };
}

/** Move one already-selected nested pool coin to the root band without changing any participant width. */
export function takeNestedBlockOracleInput(
  externalGroups: readonly ExternalCallUtxoGroup[],
  lowLevelGroups: readonly ExternalCallUtxoGroup[],
  pool: string,
  takeFunder: () => UnlockableUtxo,
): UnlockableUtxo | undefined {
  const embedded = new Set(externalGroups.flatMap((group) => group.delegateEmbeddedInBlock
    && group.delegateCallGroupIndex !== undefined ? [group.delegateCallGroupIndex] : []));
  const physicalGroups = [
    ...externalGroups.filter((group) => group.sharedGroupIndex === undefined),
    ...lowLevelGroups.filter((_group, index) => !embedded.has(index)),
  ];
  const matches = physicalGroups.flatMap((group) => (group.blockInputs ?? [])
    .filter((input) => isPoolInfoInput(input, pool)));
  if (matches.length === 0) return undefined;
  if (matches.length !== 1) throw new Error('Block oracle reader has multiple physical authority inputs');
  const [oracle] = matches;
  const lockHex = binToHex(oracle.unlocker.generateLockingBytecode());
  const sameOutpoint = (input: UnlockableUtxo): boolean => input.txid.toLowerCase() === oracle.txid.toLowerCase()
    && input.vout === oracle.vout;
  const occurrences = [...externalGroups, ...lowLevelGroups].flatMap((group) =>
    (group.blockInputs ?? []).filter(sameOutpoint));
  for (const input of occurrences) {
    if (binToHex(input.unlocker.generateLockingBytecode()) !== lockHex
      || input.satoshis !== oracle.satoshis || input.token?.amount !== oracle.token?.amount
      || input.token?.category.toLowerCase() !== oracle.token?.category.toLowerCase()
      || input.token?.nft?.capability !== oracle.token?.nft?.capability
      || input.token?.nft?.commitment !== oracle.token?.nft?.commitment) {
      throw new Error('Nested block oracle aliases disagree on authenticated input');
    }
  }
  const funder = takeFunder();
  if (funder.token !== undefined || sameOutpoint(funder)) {
    throw new Error('Nested block oracle replacement requires a distinct token-free funding input');
  }
  for (const group of [...externalGroups, ...lowLevelGroups]) {
    group.blockInputs = group.blockInputs?.map((input) => sameOutpoint(input) ? funder : input);
  }
  return oracle;
}

/**
 * Co-spend the pool coins a function-pointer target finds by category and flags, which no block slot places. Each is
 * the last input, recreated at its own index: outputs short of it are neutral pads, and an output-only tail past it
 * moves up one. A coin already spent, or an info coin of a pool whose live info coin the transaction spends, is left
 * out.
 */
export function appendUnslottedPoolCoSpends(
  coSpends: readonly UnlockableUtxo[], builder: { inputs: UnlockableUtxo[]; outputs: Output[] },
): void {
  for (const coin of coSpends) {
    const category = coin.token?.category;
    if (category === undefined) continue;
    if (builder.inputs.some((input) => input.txid.toLowerCase() === coin.txid.toLowerCase()
      && input.vout === coin.vout)) continue;
    if (isPoolInfoInput(coin, category) && builder.inputs.some((input) => isPoolInfoInput(input, category))) continue;
    const index = builder.inputs.length;
    while (builder.outputs.length < index) builder.outputs.push({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    builder.outputs.splice(index, 0, {
      to: coin.unlocker.generateLockingBytecode(), amount: coin.satoshis, token: cloneToken(coin.token),
    });
    builder.inputs.push(coin);
  }
}
