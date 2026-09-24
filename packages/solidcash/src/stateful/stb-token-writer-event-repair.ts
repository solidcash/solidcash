/**
 * phase-boundary extract: STB class-body extract — swapped-token funder-slot restore and
 * transferFrom Approval/Transfer event commitment synthesis.
 */

import {
  type AbiFunction,
  buildEventNftCovenantScript,
  computeEventNameHash,
  encodeEventCommitment,
} from '@solidcash/utils';
import { binToHex, binsAreEqual, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import { addressToLockScript, scriptToLockingBytecode } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { keyToSlotMulti } from './SortedList.js';

export interface TokenWriterEventRepairHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  findMintingInputIndex(categoryId: string): number;
  getExternalCallMasterInputIndex(index: number): number;
}

/**
 * A relocated token writer can leave exact mutable block copies in the funder cells immediately after its
 * fixed block. Those cells are not sorted-batch predecessor outputs: their corresponding inputs are plain
 * funders, and retaining the copies makes the writer's address-cardinality covenant count the same entry
 * twice. Restore only plain-input cells whose token shape exactly duplicates an output in the fixed block.
 */
export function restoreSwappedTokenFunderSlots(
  host: TokenWriterEventRepairHost,
  builder: TransactionBuilder,
): void {
  for (const [groupIndex, group] of host.externalCallUtxoGroups.entries()) {
    if (group.sharedGroupIndex !== undefined || !group.categoryId) continue;
    let master = host.findMintingInputIndex(group.categoryId);
    if (master < 0) master = host.getExternalCallMasterInputIndex(groupIndex);
    const blockSize = group.blockLayout?.blockSize;
    if (master < 0 || !blockSize) continue;
    const blockEnd = master + blockSize;
    const signature = (output: Output | undefined): string | undefined => {
      const token = output?.token;
      if (!output || !token || token.category !== group.categoryId
        || token.nft?.capability !== 'mutable') return undefined;
      const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
      return `${binToHex(lock)}:${String(token.nft.commitment ?? '')}`;
    };
    const fixed = new Set(builder.outputs.slice(master, blockEnd).map(signature).filter(
      (value): value is string => value !== undefined,
    ));
    if (fixed.size === 0) continue;
    for (let index = blockEnd; index < Math.min(builder.outputs.length, host.allInputs.length); index++) {
      const input = host.allInputs[index];
      if (!input || input.token || !('unlocker' in input) || !input.unlocker) continue;
      const duplicate = signature(builder.outputs[index]);
      if (!duplicate || !fixed.has(duplicate)) continue;
      builder.outputs[index] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
      };
    }
  }
}

/**
 * transferFrom probes often fail on entry pins before event commitments appear on-stack.
 * Synthesize Approval/Transfer from the known call args + post-debit allowance output.
 */
export function synthesizeTransferFromEventCommitments(
  host: TokenWriterEventRepairHost,
  builder: TransactionBuilder,
  group: ExternalCallUtxoGroup,
  master: number,
): NonNullable<ExternalCallUtxoGroup['eventOutputs']> | undefined {
  const fnName = group.logicalFunctionName ?? group.functionName;
  if (fnName !== 'transferFrom' || !group.categoryId) return undefined;
  const artifact = group.externalContract?.inner?.artifact ?? group.externalContract?.artifact;
  const fn = (artifact?.abi as readonly AbiFunction[] | undefined)
    ?.find((candidate) => candidate.name === 'transferFrom');
  const emits = fn?.emits ?? [];
  if (emits.length < 2) return undefined;
  // Prefer the longer visible-arg list: logicalFunctionArgs can be a partial rewrite
  // (e.g. only `from`) while functionArgs still holds [from, to, value].
  const logical = group.logicalFunctionArgs;
  const raw = group.functionArgs;
  const args = (logical && raw && logical.length >= 3) ? logical
    : (raw && raw.length >= 3) ? raw
      : (logical && logical.length >= 3) ? logical
        : (raw ?? logical);
  if (!args || args.length < 3) return undefined;
  const [from, to, valueArg] = args;
  const amount = typeof valueArg === 'bigint' ? valueArg
    : typeof valueArg === 'number' ? BigInt(valueArg)
      : undefined;
  if (from === undefined || to === undefined || amount === undefined) return undefined;

  // Approval spender is msg.sender. For Marketplace, getAddress()/address(this) can differ from the
  // minting-UTXO lock used as transferFrom's `to`. Recover spender by matching the allowance slot.
  const fromBin = from instanceof Uint8Array ? from
    : typeof from === 'string' ? hexToBin(from.replace(/^0x/i, ''))
      : undefined;
  if (!(fromBin instanceof Uint8Array) || fromBin.length === 0) return undefined;
  const slotRaw = group.internalArgs?.__internal__vmapBatchSlot_1
    ?? group.compilerRoute?.internalArgs?.__internal__vmapBatchSlot_1;
  const allowanceSlot = (
    slotRaw instanceof Uint8Array ? binToHex(slotRaw)
      : typeof slotRaw === 'string' ? slotRaw.replace(/^0x/i, '')
        : ''
  ).toLowerCase();
  const asBin = (value: unknown): Uint8Array | undefined => {
    if (value instanceof Uint8Array && value.length > 0) return value;
    if (typeof value === 'string' && value.length > 0) {
      try { return hexToBin(value.replace(/^0x/i, '')); } catch { return undefined; }
    }
    return undefined;
  };
  const candidates: Uint8Array[] = [];
  const pushCandidate = (value: unknown): void => {
    const bin = asBin(value);
    if (!bin) return;
    if (candidates.some((existing) => binsAreEqual(existing, bin))) return;
    candidates.push(bin);
  };
  pushCandidate(to);
  for (const input of host.allInputs) {
    if (input.token?.nft?.capability === 'minting' && 'unlocker' in input && input.unlocker) {
      pushCandidate(input.unlocker.generateLockingBytecode());
    }
  }
  for (const output of builder.outputs) {
    if (output.to instanceof Uint8Array) pushCandidate(output.to);
    const commit = String(output.token?.nft?.commitment ?? '');
    // Proxy/data commitments embed contract addresses as 35-byte aa20..87 blobs.
    for (const match of commit.matchAll(/aa20[0-9a-f]{64}87/gi)) {
      pushCandidate(match[0]);
    }
  }
  let spender: Uint8Array | undefined;
  if (allowanceSlot.length === 64) {
    for (const candidate of candidates) {
      if (binToHex(keyToSlotMulti([fromBin, candidate])).toLowerCase() === allowanceSlot) {
        spender = candidate;
        break;
      }
    }
  }
  if (!spender) spender = asBin(to);
  if (!spender) return undefined;

  // New allowance = old - amount. Prefer debiting the co-spent input so a stale mirrored output
  // cannot publish Approval(oldAllowance) before the UPDATE lands.
  const allowanceOutCommit = String(builder.outputs[master + 3]?.token?.nft?.commitment ?? '');
  const allowanceInCommit = String(host.allInputs[master + 3]?.token?.nft?.commitment ?? '');
  const decodeTail = (commit: string): bigint | undefined => {
    if (commit.length <= 128) return undefined;
    const decoded = vmNumberToBigInt(hexToBin(commit.slice(128)));
    return typeof decoded === 'bigint' ? decoded : undefined;
  };
  const oldAllowance = decodeTail(allowanceInCommit);
  const outAllowance = decodeTail(allowanceOutCommit);
  let newAllowance: bigint;
  if (oldAllowance !== undefined) {
    newAllowance = oldAllowance - amount;
    // Prefer an already-debited output when it matches the expected debit.
    if (outAllowance === newAllowance) newAllowance = outAllowance;
  } else if (outAllowance !== undefined) {
    newAllowance = outAllowance;
  } else {
    return undefined;
  }
  if (newAllowance < 0n) return undefined;

  const parseTypes = (signature: string): Array<{ type: string }> => {
    const inner = signature.slice(signature.indexOf('(') + 1, signature.lastIndexOf(')'));
    return inner.split(',').filter(Boolean).map((type) => ({ type: type.trim() }));
  };
  const addressType = group.externalContract?.inner?.addressType ?? 'p2sh32';
  const structs = artifact?.structs;
  const out: NonNullable<ExternalCallUtxoGroup['eventOutputs']> = [];
  for (let ei = 0; ei < emits.length; ei += 1) {
    const emitInfo = emits[ei]!;
    const params = parseTypes(emitInfo.eventSignature);
    const isApproval = emitInfo.eventName === 'Approval'
      || emitInfo.eventSignature.startsWith('Approval(');
    const isTransfer = emitInfo.eventName === 'Transfer'
      || emitInfo.eventSignature.startsWith('Transfer(');
    if (!isApproval && !isTransfer) continue;
    const eventArgs = isApproval ? [from, spender, newAllowance] : [from, to, amount];
    const lockingBytecode = scriptToLockingBytecode(
      buildEventNftCovenantScript(
        hexToBin(group.categoryId), computeEventNameHash(emitInfo.eventSignature),
      ),
      addressType,
    );
    try {
      out[ei] = {
        eventSignature: emitInfo.eventSignature,
        commitment: binToHex(encodeEventCommitment(
          params,
          eventArgs as never[],
          structs,
        )),
        lockingBytecode,
      };
    } catch {
      return undefined;
    }
  }
  return out.some((entry) => entry !== undefined) ? out : undefined;
}
