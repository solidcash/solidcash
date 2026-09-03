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
  Op.OP_DROP, Op.OP_DUP, Op.OP_NIP, Op.OP_OVER, Op.OP_ROT, Op.OP_SWAP, Op.OP_TUCK,
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

export function isKernelSafeNativeAssembly(node: AssemblyStatementNode): boolean {
  if (node.yulBlock !== undefined) return false;

  let script;
  try {
    script = asmToScript(node.assemblyBody);
  } catch {
    return false;
  }

  let mainDepth = 0;
  let altDepth = 0;
  for (const element of script) {
    if (element instanceof Uint8Array) {
      mainDepth += 1;
      continue;
    }
    if (!LOCAL_OPCODES.has(element)) return false;
    const effect = getStackEffect(element);
    if (!effect) return false;

    if (element === Op.OP_FROMALTSTACK) {
      if (altDepth === 0) return false;
      altDepth -= 1;
    }

    const minimumDepth = MINIMUM_MAIN_DEPTH.get(element) ?? effect.pops;
    if (mainDepth < minimumDepth) return false;
    mainDepth += effect.pushes - effect.pops;

    if (element === Op.OP_TOALTSTACK) altDepth += 1;
  }

  return mainDepth === 0 && altDepth === 0;
}
