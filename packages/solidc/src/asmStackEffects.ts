import { Op } from '@solidcash/utils';

/**
 * Net stack effect of an opcode, used to keep the assembly-block stack tracker in sync.
 * Opcodes with data-dependent (OP_ROLL, OP_IFDUP, OP_CHECKMULTISIG) or control-flow
 * (OP_IF family) effects are absent and rejected. Reordering opcodes pop their touched
 * slots and push the same count of anonymous slots (depth exact, names dropped).
 */
export interface StackEffect {
  pops: number;
  pushes: number;
}

const EFFECTS: Record<number, StackEffect> = {
  // --- Constants (push one value) ---
  [Op.OP_0]: { pops: 0, pushes: 1 },
  [Op.OP_1NEGATE]: { pops: 0, pushes: 1 },
  [Op.OP_1]: { pops: 0, pushes: 1 },
  [Op.OP_2]: { pops: 0, pushes: 1 },
  [Op.OP_3]: { pops: 0, pushes: 1 },
  [Op.OP_4]: { pops: 0, pushes: 1 },
  [Op.OP_5]: { pops: 0, pushes: 1 },
  [Op.OP_6]: { pops: 0, pushes: 1 },
  [Op.OP_7]: { pops: 0, pushes: 1 },
  [Op.OP_8]: { pops: 0, pushes: 1 },
  [Op.OP_9]: { pops: 0, pushes: 1 },
  [Op.OP_10]: { pops: 0, pushes: 1 },
  [Op.OP_11]: { pops: 0, pushes: 1 },
  [Op.OP_12]: { pops: 0, pushes: 1 },
  [Op.OP_13]: { pops: 0, pushes: 1 },
  [Op.OP_14]: { pops: 0, pushes: 1 },
  [Op.OP_15]: { pops: 0, pushes: 1 },
  [Op.OP_16]: { pops: 0, pushes: 1 },

  // --- No-ops (no stack effect) ---
  [Op.OP_NOP]: { pops: 0, pushes: 0 },
  [Op.OP_NOP1]: { pops: 0, pushes: 0 },
  [Op.OP_NOP4]: { pops: 0, pushes: 0 },
  [Op.OP_NOP5]: { pops: 0, pushes: 0 },
  [Op.OP_NOP6]: { pops: 0, pushes: 0 },
  [Op.OP_NOP7]: { pops: 0, pushes: 0 },
  [Op.OP_NOP8]: { pops: 0, pushes: 0 },
  [Op.OP_NOP9]: { pops: 0, pushes: 0 },
  [Op.OP_NOP10]: { pops: 0, pushes: 0 },

  // --- Flow / verification ---
  [Op.OP_VERIFY]: { pops: 1, pushes: 0 },

  // --- Altstack (main-stack depth effect) ---
  [Op.OP_TOALTSTACK]: { pops: 1, pushes: 0 },
  [Op.OP_FROMALTSTACK]: { pops: 0, pushes: 1 },

  // --- Stack manipulation ---
  [Op.OP_2DROP]: { pops: 2, pushes: 0 },
  [Op.OP_2DUP]: { pops: 0, pushes: 2 },
  [Op.OP_3DUP]: { pops: 0, pushes: 3 },
  [Op.OP_2OVER]: { pops: 0, pushes: 2 },
  [Op.OP_2ROT]: { pops: 6, pushes: 6 },
  [Op.OP_2SWAP]: { pops: 4, pushes: 4 },
  [Op.OP_DEPTH]: { pops: 0, pushes: 1 },
  [Op.OP_DROP]: { pops: 1, pushes: 0 },
  [Op.OP_DUP]: { pops: 0, pushes: 1 },
  [Op.OP_NIP]: { pops: 2, pushes: 1 },
  [Op.OP_OVER]: { pops: 0, pushes: 1 },
  [Op.OP_PICK]: { pops: 1, pushes: 1 },
  [Op.OP_ROT]: { pops: 3, pushes: 3 },
  [Op.OP_SWAP]: { pops: 2, pushes: 2 },
  [Op.OP_TUCK]: { pops: 2, pushes: 3 },

  // --- Splice ---
  [Op.OP_CAT]: { pops: 2, pushes: 1 },
  [Op.OP_SPLIT]: { pops: 2, pushes: 2 },
  [Op.OP_NUM2BIN]: { pops: 2, pushes: 1 },
  [Op.OP_BIN2NUM]: { pops: 1, pushes: 1 },
  [Op.OP_SIZE]: { pops: 0, pushes: 1 },
  [Op.OP_REVERSEBYTES]: { pops: 1, pushes: 1 },

  // --- Bitwise / comparison ---
  [Op.OP_AND]: { pops: 2, pushes: 1 },
  [Op.OP_OR]: { pops: 2, pushes: 1 },
  [Op.OP_XOR]: { pops: 2, pushes: 1 },
  [Op.OP_EQUAL]: { pops: 2, pushes: 1 },
  [Op.OP_EQUALVERIFY]: { pops: 2, pushes: 0 },

  // --- Arithmetic ---
  [Op.OP_1ADD]: { pops: 1, pushes: 1 },
  [Op.OP_1SUB]: { pops: 1, pushes: 1 },
  [Op.OP_NEGATE]: { pops: 1, pushes: 1 },
  [Op.OP_ABS]: { pops: 1, pushes: 1 },
  [Op.OP_NOT]: { pops: 1, pushes: 1 },
  [Op.OP_0NOTEQUAL]: { pops: 1, pushes: 1 },
  [Op.OP_ADD]: { pops: 2, pushes: 1 },
  [Op.OP_SUB]: { pops: 2, pushes: 1 },
  [Op.OP_MUL]: { pops: 2, pushes: 1 },
  [Op.OP_DIV]: { pops: 2, pushes: 1 },
  [Op.OP_MOD]: { pops: 2, pushes: 1 },
  [Op.OP_BOOLAND]: { pops: 2, pushes: 1 },
  [Op.OP_BOOLOR]: { pops: 2, pushes: 1 },
  [Op.OP_NUMEQUAL]: { pops: 2, pushes: 1 },
  [Op.OP_NUMEQUALVERIFY]: { pops: 2, pushes: 0 },
  [Op.OP_NUMNOTEQUAL]: { pops: 2, pushes: 1 },
  [Op.OP_LESSTHAN]: { pops: 2, pushes: 1 },
  [Op.OP_GREATERTHAN]: { pops: 2, pushes: 1 },
  [Op.OP_LESSTHANOREQUAL]: { pops: 2, pushes: 1 },
  [Op.OP_GREATERTHANOREQUAL]: { pops: 2, pushes: 1 },
  [Op.OP_MIN]: { pops: 2, pushes: 1 },
  [Op.OP_MAX]: { pops: 2, pushes: 1 },
  [Op.OP_WITHIN]: { pops: 3, pushes: 1 },

  // --- Crypto ---
  [Op.OP_RIPEMD160]: { pops: 1, pushes: 1 },
  [Op.OP_SHA1]: { pops: 1, pushes: 1 },
  [Op.OP_SHA256]: { pops: 1, pushes: 1 },
  [Op.OP_HASH160]: { pops: 1, pushes: 1 },
  [Op.OP_HASH256]: { pops: 1, pushes: 1 },
  [Op.OP_CHECKSIG]: { pops: 2, pushes: 1 },
  [Op.OP_CHECKSIGVERIFY]: { pops: 2, pushes: 0 },
  [Op.OP_CHECKDATASIG]: { pops: 3, pushes: 1 },
  [Op.OP_CHECKDATASIGVERIFY]: { pops: 3, pushes: 0 },

  // --- Locktime (inspect top, leave it) ---
  [Op.OP_CHECKLOCKTIMEVERIFY]: { pops: 0, pushes: 0 },
  [Op.OP_CHECKSEQUENCEVERIFY]: { pops: 0, pushes: 0 },

  // --- Introspection: no input ---
  [Op.OP_INPUTINDEX]: { pops: 0, pushes: 1 },
  [Op.OP_ACTIVEBYTECODE]: { pops: 0, pushes: 1 },
  [Op.OP_TXVERSION]: { pops: 0, pushes: 1 },
  [Op.OP_TXINPUTCOUNT]: { pops: 0, pushes: 1 },
  [Op.OP_TXOUTPUTCOUNT]: { pops: 0, pushes: 1 },
  [Op.OP_TXLOCKTIME]: { pops: 0, pushes: 1 },

  // --- Introspection: index in, value out ---
  [Op.OP_UTXOVALUE]: { pops: 1, pushes: 1 },
  [Op.OP_UTXOBYTECODE]: { pops: 1, pushes: 1 },
  [Op.OP_OUTPOINTTXHASH]: { pops: 1, pushes: 1 },
  [Op.OP_OUTPOINTINDEX]: { pops: 1, pushes: 1 },
  [Op.OP_INPUTBYTECODE]: { pops: 1, pushes: 1 },
  [Op.OP_INPUTSEQUENCENUMBER]: { pops: 1, pushes: 1 },
  [Op.OP_OUTPUTVALUE]: { pops: 1, pushes: 1 },
  [Op.OP_OUTPUTBYTECODE]: { pops: 1, pushes: 1 },
  [Op.OP_UTXOTOKENCATEGORY]: { pops: 1, pushes: 1 },
  [Op.OP_UTXOTOKENCOMMITMENT]: { pops: 1, pushes: 1 },
  [Op.OP_UTXOTOKENAMOUNT]: { pops: 1, pushes: 1 },
  [Op.OP_OUTPUTTOKENCATEGORY]: { pops: 1, pushes: 1 },
  [Op.OP_OUTPUTTOKENCOMMITMENT]: { pops: 1, pushes: 1 },
  [Op.OP_OUTPUTTOKENAMOUNT]: { pops: 1, pushes: 1 },
};

/** Static stack effect of an opcode, or undefined if it cannot be statically tracked. */
export function getStackEffect(opcode: number): StackEffect | undefined {
  return EFFECTS[opcode];
}
