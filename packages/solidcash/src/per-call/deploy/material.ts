/**
 * Filling a master's deployment-time constants.
 *
 * A compiled master reserves a zero-filled slot for its state category and one for its contract address, and
 * publishes where they sit. Deployment knows both: the category its genesis mints, and the address `addrV(category)`
 * the contract presents. Filling them leaves every other program byte untouched, and the master lock is then the
 * P2SH32 of the filled program.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import {
  asmToScript,
  bytesEqual,
  hash256,
  scriptToBytecode,
  type Artifact,
  type CompositionPlaceholders,
  validatorAddress,
  validatorTemplateHash,
} from '@solidcash/utils';
import { compositionPlaceholders } from 'solidc';

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

/** Raised when an artifact cannot serve as a per-call master. */
export class PerCallDeploymentError extends Error {
  public readonly name = 'PerCallDeploymentError';

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
    throw new PerCallDeploymentError(
      `artifact "${artifact.contractName}" was not compiled per-call, so it publishes no placeholder descriptor`,
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
  let script: ReturnType<typeof asmToScript>;
  try {
    script = asmToScript(artifact.bytecode);
  } catch (error) {
    throw new PerCallDeploymentError(
      "the artifact's program is not assembly, so its published slot offsets cannot apply: "
      + (error as Error).message,
    );
  }
  return scriptToBytecode(script);
}

export function deployMaster(
  artifact: Artifact,
  category: Uint8Array,
  validatorProgram: Uint8Array,
): DeployedMaster {
  const placeholders = requirePlaceholders(artifact);
  const address = validatorAddress(category, validatorProgram);
  const original = programBytes(artifact);
  assertPlaceholders(original, placeholders);
  // The hash is only filled where the descriptor reserves a slot for it: a master that cannot be reached through a
  // call never reads it, and passing it to a script with no slot is refused.
  const templateHash = placeholders.templateHashOffset === undefined
    ? undefined
    : validatorTemplateHash(validatorProgram);
  const script = fillPlaceholders(original, placeholders, {
    category,
    contractAddress: address,
    ...(templateHash === undefined ? {} : { templateHash }),
  });
  return { script, address, lockingBytecode: masterLock(script) };
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
    throw new PerCallDeploymentError('the deployed address is not addrV(category)');
  }
  if (deployed.script.length !== original.length) {
    throw new PerCallDeploymentError(
      `the deployed script is ${deployed.script.length} bytes, not the artifact's ${original.length}`,
    );
  }

  const readBack = readPlaceholders(deployed.script, placeholders);
  if (readBack.category.length !== CATEGORY_SLOT_LENGTH || !bytesEqual(readBack.category, category)) {
    throw new PerCallDeploymentError('the category slot does not read back as the filled category');
  }
  if (placeholders.templateHashOffset !== undefined) {
    const expected = validatorTemplateHash(validatorProgram);
    const read = readBack.templateHash;
    if (read === undefined || read.length !== TEMPLATE_HASH_SLOT_LENGTH || !bytesEqual(read, expected)) {
      throw new PerCallDeploymentError(
        "the validator program hash slot does not read back as the program's hash",
      );
    }
  }
  if (readBack.contractAddress.length !== ADDRESS_SLOT_LENGTH
    || !bytesEqual(readBack.contractAddress, deployed.address)) {
    throw new PerCallDeploymentError('the address slot does not read back as the filled address');
  }

  // Every slot the descriptor declares is where a fill may land, and nowhere else.
  const ranges = declaredSlots(placeholders).map((slot) => slotPayloadRange(slot.offset, slot.length));
  const inSlot = (index: number): boolean =>
    ranges.some((range) => index >= range.start && index < range.end);
  for (let index = 0; index < original.length; index += 1) {
    if (inSlot(index)) continue;
    if (deployed.script[index] !== original[index]) {
      throw new PerCallDeploymentError(`byte ${index} outside the slots changed`);
    }
  }

  if (!bytesEqual(deployed.lockingBytecode, masterLock(deployed.script))) {
    throw new PerCallDeploymentError('the master lock is not the P2SH32 of the filled program');
  }
}
