/**
 * Filling a master's deployment-time constants.
 *
 * A compiled master reserves a zero-filled slot for its state category and one for its contract address, and
 * publishes where they sit. Deployment knows both: the category its genesis mints, and the address `addrV(category)`
 * the contract presents. Filling them leaves every other program byte untouched, and the master lock is then the
 * P2SH32 of the filled program.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  applyBlockOracleLock,
  asmToScript,
  bytesEqual,
  hash256,
  scriptToBytecode,
  type Artifact,
  type CompositionPlaceholders,
  chainCategory,
  validatorAddress,
  validatorTemplateHash,
} from '@solidcash/utils';
import { blockOracleLockFor } from '../../oracle/block-oracle-lock.js';
import { compositionPlaceholders } from '@solidcash/solidc/runtime';

const {
  ADDRESS_SLOT_LENGTH,
  CATEGORY_SLOT_LENGTH,
  TEMPLATE_HASH_SLOT_LENGTH,
  assertPlaceholders,
  declaredSlots,
  fillPlaceholders,
  placeholderPrefixLength,
  readPlaceholders,
} = compositionPlaceholders;

/** Raised when an artifact cannot serve as a framed master. */
export class FramedDeploymentError extends Error {
  public readonly name = 'FramedDeploymentError';

  public constructor(message: string) {
    super(message);
  }
}

/** A master program with its deployment-time constants filled, and the two locks derived from them. */
export interface DeployedMaster {
  /** The master program (`code_X`) with both slots filled. */
  readonly script: Uint8Array;
  /** The contract's address, `addrV(category)`: a 35-byte P2SH32 locking bytecode. */
  readonly address: Uint8Array;
  /** The master lock, `lockX = P2SH32(hash256(script))`: where the master UTXOs sit. */
  readonly lockingBytecode: Uint8Array;
}

/** Reads the placeholder descriptor an artifact must publish to be deployable. */
function requirePlaceholders(artifact: Artifact): CompositionPlaceholders {
  const composition = artifact.composition;
  if (composition === undefined || composition.placeholders === undefined) {
    throw new FramedDeploymentError(
      `artifact "${artifact.contractName}" was not compiled framed, so it publishes no placeholder descriptor`,
    );
  }
  return composition.placeholders;
}

/** The master lock of a filled program: the P2SH32 of `hash256(program)`. */
function masterLock(program: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(program));
}

/** The byte range a slot's payload occupies: after its push opcode and length field. */
function slotPayloadRange(offset: number, length: number): { start: number; end: number } {
  const start = offset + placeholderPrefixLength(length);
  return { start, end: start + length };
}

/**
 * Programs by artifact, assembled once while the artifact publishes the bytecode they came from. Assembly is a pure
 * function of that bytecode, the bytes never leave this module, and a fill copies them before writing.
 */
const assembledPrograms = new WeakMap<Artifact, { readonly bytecode: string; readonly program: Uint8Array }>();

/**
 * Fills both slots with the category and the address derived from it, and derives the master lock.
 *
 * The address is `addrV(category)`, computed through the same rule the validator sits at, so a deployment and a
 * validator can never disagree about the address. A wrong descriptor or a wrong-length category is refused by the
 * shared placeholder and identity checks before any byte is written.
 */
/**
 * The artifact's program as script bytes.
 *
 * An artifact publishes its program as assembly, so it has to be assembled before any byte offset into it means
 * anything. A bytecode published in another form fails here rather than being filled at offsets that do not describe
 * it.
 */
function programBytes(artifact: Artifact): Uint8Array {
  const assembled = assembledPrograms.get(artifact);
  if (assembled !== undefined && assembled.bytecode === artifact.bytecode) return assembled.program;
  let script: ReturnType<typeof asmToScript>;
  try {
    script = asmToScript(artifact.bytecode);
  } catch (error) {
    throw new FramedDeploymentError(
      "the artifact's program is not assembly, so its published slot offsets cannot apply: "
      + (error as Error).message,
    );
  }
  const program = scriptToBytecode(script);
  assembledPrograms.set(artifact, { bytecode: artifact.bytecode, program });
  return program;
}

/**
 * Filled masters, by the artifact's published bytecode, the category buffer and the validator program buffer.
 *
 * Filling walks the program's declared slots, copies the whole program and hashes it for the master lock: about
 * 85 us for a six-kilobyte program, most of it the hash. A deployment fills the same master again for every runtime
 * instance it creates, so the answer is remembered. The entry is only used while the artifact publishes the bytecode
 * it was filled from, the rule this file's program cache already follows.
 *
 * Keyed on the two buffers the caller passes, which a deployment reuses, so the lookup does no work of its own: a
 * caller that builds an equal category or program afresh misses and pays the fill again.
 */
interface FilledMasters {
  bytecode: string;
  byLock: Map<string, WeakMap<Uint8Array, WeakMap<Uint8Array, DeployedMaster>>>;
}
const filledMasters = new WeakMap<Artifact, FilledMasters>();

export function deployMaster(
  artifact: Artifact,
  category: Uint8Array,
  validatorProgram: Uint8Array,
): DeployedMaster {
  const oracleLock = blockOracleLockFor(artifact);
  const lockKey = oracleLock === undefined ? '' : binToHex(oracleLock);
  const filled = filledMasters.get(artifact);
  const cached = filled?.bytecode === artifact.bytecode
    ? filled.byLock.get(lockKey)?.get(category)?.get(validatorProgram)
    : undefined;
  if (cached !== undefined) return cached;
  const placeholders = requirePlaceholders(artifact);
  const address = validatorAddress(category, validatorProgram);
  const assembled = programBytes(artifact);
  const original = oracleLock !== undefined && artifact.blockOracleLockSlots !== undefined
    ? applyBlockOracleLock(assembled, oracleLock, artifact.blockOracleLockSlots)
    : assembled;
  assertPlaceholders(original, placeholders);
  // The hash is only filled where the descriptor reserves a slot for it: a master that cannot be reached through a
  // call never reads it, and passing it to a script with no slot is refused.
  const templateHash = placeholders.templateHashOffset === undefined
    ? undefined
    : validatorTemplateHash(validatorProgram);
  const script = fillPlaceholders(original, placeholders, {
    // The slot is compared with OP_UTXOTOKENCATEGORY, which answers in the chain's order.
    category: chainCategory(category),
    contractAddress: address,
    ...(templateHash === undefined ? {} : { templateHash }),
  });
  const deployed = { script, address, lockingBytecode: masterLock(script) };
  let remembered = filledMasters.get(artifact);
  if (remembered === undefined || remembered.bytecode !== artifact.bytecode) {
    remembered = { bytecode: artifact.bytecode, byLock: new Map() };
    filledMasters.set(artifact, remembered);
  }
  let byCategory = remembered.byLock.get(lockKey);
  if (byCategory === undefined) {
    byCategory = new WeakMap();
    remembered.byLock.set(lockKey, byCategory);
  }
  let byProgram = byCategory.get(category);
  if (byProgram === undefined) {
    byProgram = new WeakMap();
    byCategory.set(category, byProgram);
  }
  byProgram.set(validatorProgram, deployed);
  return deployed;
}

/**
 * Checks a deployment against the artifact and the address rule. Every declared slot must read back as the value that
 * was filled, every byte outside the slots must be the artifact's original byte, the address must equal
 * `addrV(category)`, the master lock must be the P2SH32 of the filled program, and where the descriptor reserves a
 * slot for the validator program's hash it must hold that program's hash.
 */
export function verifyMasterDeployment(
  deployed: DeployedMaster,
  artifact: Artifact,
  category: Uint8Array,
  validatorProgram: Uint8Array,
): void {
  const placeholders = requirePlaceholders(artifact);
  const original = programBytes(artifact);

  const expectedAddress = validatorAddress(category, validatorProgram);
  if (!bytesEqual(deployed.address, expectedAddress)) {
    throw new FramedDeploymentError('the deployed address is not addrV(category)');
  }
  if (deployed.script.length !== original.length) {
    throw new FramedDeploymentError(
      `the deployed script is ${deployed.script.length} bytes, not the artifact's ${original.length}`,
    );
  }

  const readBack = readPlaceholders(deployed.script, placeholders);
  if (readBack.category.length !== CATEGORY_SLOT_LENGTH || !bytesEqual(readBack.category, chainCategory(category))) {
    throw new FramedDeploymentError('the category slot does not read back as the filled category');
  }
  if (placeholders.templateHashOffset !== undefined) {
    const expected = validatorTemplateHash(validatorProgram);
    const read = readBack.templateHash;
    if (read === undefined || read.length !== TEMPLATE_HASH_SLOT_LENGTH || !bytesEqual(read, expected)) {
      throw new FramedDeploymentError(
        "the validator program hash slot does not read back as the program's hash",
      );
    }
  }
  if (readBack.contractAddress.length !== ADDRESS_SLOT_LENGTH
    || !bytesEqual(readBack.contractAddress, deployed.address)) {
    throw new FramedDeploymentError('the address slot does not read back as the filled address');
  }

  // Every slot the descriptor declares is where a fill may land, and nowhere else.
  const ranges = declaredSlots(placeholders).map((slot) => slotPayloadRange(slot.offset, slot.length));
  const inSlot = (index: number): boolean =>
    ranges.some((range) => index >= range.start && index < range.end);
  for (let index = 0; index < original.length; index += 1) {
    if (inSlot(index)) continue;
    if (deployed.script[index] !== original[index]) {
      throw new FramedDeploymentError(`byte ${index} outside the slots changed`);
    }
  }

  if (!bytesEqual(deployed.lockingBytecode, masterLock(deployed.script))) {
    throw new FramedDeploymentError('the master lock is not the P2SH32 of the filled program');
  }
}
