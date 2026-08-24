import { binToHex, hexToBin } from '@bitauth/libauth';
import { Op } from '@solidcash/utils';
import { isScidIdentityCommitment } from './logical-identity.js';
import { isEmptyValueEntryCommitment } from './SortedList.js';

type VmInstruction = { opcode: number; data?: Uint8Array };

/** VM observers run before libauth's conditional-operation wrapper, including for opcodes in untaken branches. */
export function isActiveVmControlBranch(controlStack: readonly boolean[]): boolean {
  return controlStack.every((frame) => frame);
}

/**
 * Recognize the compiler's exact mutable-NFT guard following an authenticated output-lock comparison:
 * `DUP OUTPUTTOKENCATEGORY DUP 32 SPLIT NIP 1 EQUALVERIFY`.
 *
 * This guard is sufficient authority to materialize a missing token shell: later VM passes still authenticate
 * the owner category and exact commitment, so no contract/function/collection knowledge is required here.
 */
export function followsMutableNftOutputGuard(
  instructions: readonly VmInstruction[], equalVerifyIp: number,
): boolean {
  const tail = instructions.slice(equalVerifyIp + 1, equalVerifyIp + 9);
  const pushes = (instruction: VmInstruction | undefined, byte: number): boolean => (
    instruction?.data?.length === 1 && instruction.data[0] === byte
  );
  return tail[0]?.opcode === Op.OP_DUP
    && tail[1]?.opcode === Op.OP_OUTPUTTOKENCATEGORY
    && tail[2]?.opcode === Op.OP_DUP
    && pushes(tail[3], 32)
    && tail[4]?.opcode === Op.OP_SPLIT
    && tail[5]?.opcode === Op.OP_NIP
    && (tail[6]?.opcode === Op.OP_1 || pushes(tail[6], 1))
    && tail[7]?.opcode === Op.OP_EQUALVERIFY;
}

/**
 * Whether a probe-observed NFT output may replace the builder's current commitment.
 * Event NFTs use capability `none` and can exceed the 40/128-byte relay default when the
 * mock provider advertises a higher `maximumNftCommitmentBytes`.
 */
export function isRepairableNftOutput(
  capability: string | undefined,
  commitmentBytes: number,
  maxCommitmentBytes: number,
): boolean {
  if (capability !== 'mutable' && capability !== 'none') return false;
  return commitmentBytes >= 3 && commitmentBytes <= maxCommitmentBytes;
}

/** Four-byte `SCID` tag on an empty none-cap p2sh32. Not a v1 identity (`SCID` + version + lock). */
export function isScidPlaceholderCommitment(commitment: string | Uint8Array | undefined): boolean {
  if (commitment === undefined) return false;
  const hex = typeof commitment === 'string' ? commitment : binToHex(commitment);
  return hex.toLowerCase() === '53434944';
}

export type RepairedNftApply = 'skip' | 'apply-lock-and-commit' | 'apply-commit';

/**
 * An explicitly owned data NFT, mutable NFT, or exactly preserved NFT identity
 * is physical state lineage. It wins over output-only slots from a union of
 * possible routes, even when participant metadata no longer retains the UTXO.
 */
export function isFixedStateRepairSlot(args: {
  explicitlyOwned: boolean;
  inputCapability: string | undefined;
  preservesNftIdentity: boolean;
}): boolean {
  return args.explicitlyOwned || args.inputCapability === 'mutable'
    || args.preservesNftIdentity;
}

/**
 * Send-time output-only repair authority is limited to the evaluating input's
 * forward output band. Earlier coordinates belong to predecessor inputs/state,
 * and physical state lineage outranks route-union event/return metadata.
 */
export function isForwardOutputOnlyRepairSlot(args: {
  inputIndex: number;
  outputIndex: number;
  fixedStateSlot: boolean;
}): boolean {
  return !args.fixedStateSlot && args.outputIndex >= args.inputIndex;
}

/** State repairs may mutate physical lineage, but never predecessor outputs. */
export function isForwardStateRepairCoordinate(args: {
  inputIndex: number;
  outputIndex: number;
}): boolean {
  return args.outputIndex >= args.inputIndex;
}

/**
 * A delegate executes against its proxy's physical state, which can precede the implementation input in the
 * composed block. The caller must authenticate both fixed lineage and category ownership before setting
 * `delegateOwnedFixedState`; ordinary participants retain the forward-only rule.
 */
export function isOwnedStateRepairCoordinate(args: {
  inputIndex: number;
  outputIndex: number;
  delegateOwnedFixedState: boolean;
}): boolean {
  return isForwardStateRepairCoordinate(args) || args.delegateOwnedFixedState;
}

/**
 * A covenant-authenticated continuation may materialize onto an unowned
 * alignment pad. This is deliberately narrower than commitment repair: it
 * creates a new token output, so an existing token, physical state slot, real
 * payment script, or malformed chunk witness must always win.
 */
export function canMaterializeRepairedValueChunk(args: {
  fixedStateSlot: boolean;
  currentHasToken: boolean;
  currentLockingBytecode: Uint8Array;
  proposedLockingBytecode: Uint8Array;
  proposedCommitment: Uint8Array;
  categoryId: string | undefined;
}): boolean {
  const {
    fixedStateSlot, currentHasToken, currentLockingBytecode,
    proposedLockingBytecode, proposedCommitment, categoryId,
  } = args;
  const disposablePad = currentLockingBytecode.length === 1 && currentLockingBytecode[0] === 0x51;
  const p2sh32 = proposedLockingBytecode.length === 35
    && proposedLockingBytecode[0] === 0xaa
    && proposedLockingBytecode[1] === 0x20
    && proposedLockingBytecode[34] === 0x87;
  return !fixedStateSlot && !currentHasToken && disposablePad && p2sh32
    && proposedCommitment.length >= 3 && proposedCommitment.length <= 128
    && categoryId !== undefined && categoryId.length > 0;
}

/**
 * Send-time OTC / OUTPUTBYTECODE repair: write the covenant's authenticated
 * commitment onto the output. Mutable value-chunks/entries keep the previous
 * 128-byte collapse guard. A direct OTC equality pin may also update a short
 * commitment when the coordinate is known physical state lineage; unlike an
 * inferred entry/chunk, that value is authenticated by the owning covenant.
 * None-cap event slots may only replace empty or the four-byte SCID stub —
 * never a real `SCID` v1 identity.
 */
export function canApplyRepairedNftCommitment(args: {
  capability: string | undefined;
  currentCommitmentHex: string;
  proposed: Uint8Array;
  hasLockingBytecode: boolean;
  fixedStateSlot: boolean;
  authenticatedMutableSlot?: boolean;
  maximumCommitmentBytes?: number;
}): RepairedNftApply {
  const {
    capability, currentCommitmentHex, proposed, hasLockingBytecode, fixedStateSlot,
    authenticatedMutableSlot = false,
    maximumCommitmentBytes = 128,
  } = args;
  if (capability !== 'mutable' && capability !== 'none') return 'skip';
  if (isScidIdentityCommitment(currentCommitmentHex) || isScidIdentityCommitment(proposed)) {
    return 'skip';
  }
  // Entry/chunk discovery needs a structured (at least 3-byte) commitment before it may rewrite an inferred
  // coordinate. A compiler-owned mutable data NFT is different: its exact physical lineage and
  // OUTPUTTOKENCOMMITMENT equality authenticate the coordinate, and scalar state legitimately encodes to one or
  // two bytes (for example 0 -> 00 and 100 -> 0164). Do not impose the entry/chunk shape floor on that state.
  const authenticatedScalarState = capability === 'mutable'
    && (fixedStateSlot || authenticatedMutableSlot) && proposed.length > 0;
  if ((!authenticatedScalarState && proposed.length < 3)
    || proposed.length > maximumCommitmentBytes) return 'skip';
  const proposedHex = binToHex(proposed);
  if (capability === 'mutable') {
    const currentLen = currentCommitmentHex.length === 0 ? 0 : hexToBin(currentCommitmentHex).length;
    if (isEmptyValueEntryCommitment(proposed) && currentLen > 128) return 'skip';
    if (hasLockingBytecode) return 'apply-lock-and-commit';
    if ((fixedStateSlot || authenticatedMutableSlot || proposed.length >= 32)
      && proposedHex !== currentCommitmentHex) {
      return 'apply-commit';
    }
    return 'skip';
  }
  const currentEmpty = currentCommitmentHex === ''
    || /^(00)+$/.test(currentCommitmentHex)
    || isScidPlaceholderCommitment(currentCommitmentHex);
  if (!currentEmpty || proposedHex === currentCommitmentHex) return 'skip';
  return hasLockingBytecode ? 'apply-lock-and-commit' : 'apply-commit';
}
