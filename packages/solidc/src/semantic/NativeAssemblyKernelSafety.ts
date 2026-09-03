import { asmToScript, Op } from '@solidcash/utils';
import { AssemblyStatementNode } from '../ast/AST.js';
import { getStackEffect } from '../asmStackEffects.js';

// Native assembly is safe to run inside a kernel handler only when it is a closed computation: it may use
// literal data, pure BCH operators, and read-only transaction inspection, but it may not borrow values from the
// compiler-managed main/alt stacks or change signature evaluation context. Keep this an allow-list so newly
// activated opcodes fail closed.
const LOCAL_OPCODES = new Set<number>([
  Op.OP_0, Op.OP_1NEGATE,
  Op.OP_1, Op.OP_2, Op.OP_3, Op.OP_4, Op.OP_5, Op.OP_6, Op.OP_7, Op.OP_8,
  Op.OP_9, Op.OP_10, Op.OP_11, Op.OP_12, Op.OP_13, Op.OP_14, Op.OP_15, Op.OP_16,
  Op.OP_NOP, Op.OP_NOP1, Op.OP_NOP4, Op.OP_NOP5, Op.OP_NOP6, Op.OP_NOP7, Op.OP_NOP8, Op.OP_NOP9, Op.OP_NOP10,
  Op.OP_VERIFY,
  Op.OP_TOALTSTACK, Op.OP_FROMALTSTACK,
  Op.OP_2DROP, Op.OP_2DUP, Op.OP_3DUP, Op.OP_2OVER, Op.OP_2ROT, Op.OP_2SWAP,
  Op.OP_DROP, Op.OP_DUP, Op.OP_NIP, Op.OP_OVER, Op.OP_PICK, Op.OP_ROT, Op.OP_SWAP, Op.OP_TUCK,
  Op.OP_CAT, Op.OP_SPLIT, Op.OP_NUM2BIN, Op.OP_BIN2NUM, Op.OP_SIZE, Op.OP_REVERSEBYTES,
  Op.OP_AND, Op.OP_OR, Op.OP_XOR, Op.OP_EQUAL, Op.OP_EQUALVERIFY,
  Op.OP_1ADD, Op.OP_1SUB, Op.OP_NEGATE, Op.OP_ABS, Op.OP_NOT, Op.OP_0NOTEQUAL,
  Op.OP_ADD, Op.OP_SUB, Op.OP_MUL, Op.OP_DIV, Op.OP_MOD, Op.OP_BOOLAND, Op.OP_BOOLOR,
  Op.OP_NUMEQUAL, Op.OP_NUMEQUALVERIFY, Op.OP_NUMNOTEQUAL, Op.OP_LESSTHAN,
  Op.OP_GREATERTHAN, Op.OP_LESSTHANOREQUAL, Op.OP_GREATERTHANOREQUAL, Op.OP_MIN, Op.OP_MAX, Op.OP_WITHIN,
  Op.OP_RIPEMD160, Op.OP_SHA1, Op.OP_SHA256, Op.OP_HASH160, Op.OP_HASH256,
  // Data signatures do not commit to this transaction, so a locally self-contained check is a pure computation.
  Op.OP_CHECKDATASIG, Op.OP_CHECKDATASIGVERIFY,
  // These opcodes only constrain or inspect the transaction. Their operands (including inspection indices and
  // locktime thresholds) must still be values produced inside this assembly block, as enforced below.
  Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_CHECKSEQUENCEVERIFY,
  Op.OP_INPUTINDEX,
  Op.OP_TXVERSION, Op.OP_TXINPUTCOUNT, Op.OP_TXOUTPUTCOUNT, Op.OP_TXLOCKTIME,
  Op.OP_UTXOVALUE, Op.OP_UTXOBYTECODE, Op.OP_OUTPOINTTXHASH, Op.OP_OUTPOINTINDEX,
  Op.OP_INPUTBYTECODE, Op.OP_INPUTSEQUENCENUMBER,
  Op.OP_OUTPUTVALUE, Op.OP_OUTPUTBYTECODE,
  Op.OP_UTXOTOKENCATEGORY, Op.OP_UTXOTOKENCOMMITMENT, Op.OP_UTXOTOKENAMOUNT,
  Op.OP_OUTPUTTOKENCATEGORY, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_OUTPUTTOKENAMOUNT,
]);

// The code generator's StackEffect describes the net tracker update. Duplicating/inspecting operators consume no
// slots in that model, but still require values to exist. These minima prove they cannot reach beneath values the
// assembly block itself produced.
const MINIMUM_MAIN_DEPTH = new Map<number, number>([
  [Op.OP_2DUP, 2],
  [Op.OP_3DUP, 3],
  [Op.OP_2OVER, 4],
  [Op.OP_DUP, 1],
  [Op.OP_OVER, 2],
  [Op.OP_SIZE, 1],
  // CLTV/CSV inspect rather than pop their threshold, so their net stack effect alone cannot prove isolation.
  [Op.OP_CHECKLOCKTIMEVERIFY, 1],
  [Op.OP_CHECKSEQUENCEVERIFY, 1],
]);

const SMALL_INTEGER_OPCODE_VALUES = new Map<number, bigint>([
  [Op.OP_0, 0n], [Op.OP_1NEGATE, -1n],
  [Op.OP_1, 1n], [Op.OP_2, 2n], [Op.OP_3, 3n], [Op.OP_4, 4n],
  [Op.OP_5, 5n], [Op.OP_6, 6n], [Op.OP_7, 7n], [Op.OP_8, 8n],
  [Op.OP_9, 9n], [Op.OP_10, 10n], [Op.OP_11, 11n], [Op.OP_12, 12n],
  [Op.OP_13, 13n], [Op.OP_14, 14n], [Op.OP_15, 15n], [Op.OP_16, 16n],
]);

/** Decode a pushed byte vector as BCH's little-endian sign-magnitude script number. */
const pushedScriptNumber = (bytes: Uint8Array): bigint => {
  if (bytes.length === 0) return 0n;
  let magnitude = 0n;
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = index === bytes.length - 1 ? bytes[index] & 0x7f : bytes[index];
    magnitude |= BigInt(byte) << BigInt(index * 8);
  }
  return (bytes[bytes.length - 1] & 0x80) === 0 ? magnitude : -magnitude;
};

export function isKernelSafeNativeAssembly(node: AssemblyStatementNode): boolean {
  if (node.yulBlock !== undefined) return false;

  let script;
  try {
    script = asmToScript(node.assemblyBody);
  } catch {
    return false;
  }

  // Values are tracked only where their exact script number is statically known. This is enough to prove a
  // local OP_PICK without interpreting arbitrary assembly computations or trusting a runtime-selected depth.
  const main: Array<bigint | undefined> = [];
  const alt: Array<bigint | undefined> = [];
  for (const element of script) {
    if (element instanceof Uint8Array) {
      main.push(pushedScriptNumber(element));
      continue;
    }
    if (!LOCAL_OPCODES.has(element)) return false;
    const effect = getStackEffect(element);
    if (!effect) return false;

    const fromAlt = element === Op.OP_FROMALTSTACK ? alt.at(-1) : undefined;
    if (element === Op.OP_FROMALTSTACK && alt.length === 0) return false;

    let picked: bigint | undefined;
    if (element === Op.OP_PICK) {
      const depth = main.at(-1);
      // After OP_PICK consumes its depth, every selectable item must still have been produced by this block.
      if (depth === undefined || depth < 0n || depth >= BigInt(main.length - 1)) return false;
      picked = main[main.length - 2 - Number(depth)];
    }

    const minimumDepth = MINIMUM_MAIN_DEPTH.get(element) ?? effect.pops;
    if (main.length < minimumDepth) return false;
    const popped = effect.pops === 0 ? [] : main.splice(main.length - effect.pops, effect.pops);
    const pushed = Array<bigint | undefined>(effect.pushes).fill(undefined);
    if (effect.pushes === 1 && SMALL_INTEGER_OPCODE_VALUES.has(element)) {
      pushed[0] = SMALL_INTEGER_OPCODE_VALUES.get(element);
    } else if (element === Op.OP_FROMALTSTACK) {
      alt.pop();
      pushed[0] = fromAlt;
    } else if (element === Op.OP_PICK) {
      pushed[0] = picked;
    }
    main.push(...pushed);

    if (element === Op.OP_TOALTSTACK) alt.push(popped[0]);
  }

  return main.length === 0 && alt.length === 0;
}
