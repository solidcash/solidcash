import { asmToScript, hexToBytes, scriptToAsm, scriptToBytecode, type Artifact } from '@solidcash/utils';

/**
 * A hand-built artifact carrying the published composition surface.
 *
 * The program is a master skeleton: three live bytes, a reserved 32-byte category push, a reserved 35-byte address
 * push, then two live bytes. The offsets the descriptor publishes are those pushes, derived by hand from the
 * layout, so the fixture does not depend on the compiler.
 */

/** The live bytes before the first slot: `OP_1 OP_DROP OP_DUP`. */
const HEAD_HEX = '517576';

/** The live bytes after the last slot: `OP_EQUAL OP_1`. */
const TAIL_HEX = '8751';

/** Offset of the category slot: the head's three bytes. */
export const CATEGORY_OFFSET = 3;

/** Offset of the address slot: the head, then the category's push (`20` + 32 bytes). */
export const ADDRESS_OFFSET = 3 + 1 + 32;

/** Byte range the category payload occupies, after its `20` push opcode. */
export const CATEGORY_PAYLOAD = { start: CATEGORY_OFFSET + 1, end: CATEGORY_OFFSET + 1 + 32 } as const;

/** Byte range the address payload occupies, after its `23` push opcode. */
export const ADDRESS_PAYLOAD = { start: ADDRESS_OFFSET + 1, end: ADDRESS_OFFSET + 1 + 35 } as const;

const zeros = (count: number): string => '00'.repeat(count);

/** The master program with both slots still zero-filled. */
export const SLOT_SCRIPT_HEX = `${HEAD_HEX}20${zeros(32)}23${zeros(35)}${TAIL_HEX}`;

/** The program as bytes, for expectations. */
export const slotScriptBytes = (): Uint8Array => hexToBytes(SLOT_SCRIPT_HEX);

/**
 * The program the way an artifact publishes it: as assembly. Deployment has to assemble it before a byte offset into
 * it means anything, and a fixture that skipped that step would let a deployment that reads the program as raw bytes
 * pass its tests while failing on every real artifact.
 */
export const SLOT_SCRIPT_ASM = scriptToAsm(slotScriptBytes());

/** Assembles an artifact's program the way deployment does. */
export const programBytesOf = (artifact: Artifact): Uint8Array => scriptToBytecode(asmToScript(artifact.bytecode));

/** A minimal artifact carrying `composition`, overridable for a negative case. */
export function artifactFixture(overrides: Partial<Artifact> = {}): Artifact {
  return {
    contractName: 'Ledger',
    constructorInputs: [],
    abi: [],
    bytecode: SLOT_SCRIPT_ASM,
    source: 'contract Ledger {}',
    composition: {
      convention: 'per-call',
      placeholders: { version: 1, categoryOffset: CATEGORY_OFFSET, addressOffset: ADDRESS_OFFSET },
    },
    ...overrides,
  };
}
