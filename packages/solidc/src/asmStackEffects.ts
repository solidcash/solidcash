import { Op } from '@solidcash/utils';

/**
 * Net stack effect of an opcode, used to keep the assembly-block stack tracker in sync.
 * Opcodes with data-dependent effects (OP_ROLL, OP_IFDUP, OP_CHECKMULTISIG) are absent and rejected.
 * The OP_IF and OP_BEGIN families are analyzed structurally by analyzeAssemblyStack rather than listed here.
 * Reordering opcodes pop their touched slots and push the same count of anonymous slots (depth exact, names dropped).
 */
export interface StackEffect {
  pops: number;
  pushes: number;
}

export interface AssemblyStackAnalysis {
  /** Minimum number of values which must already exist when the block begins. */
  requiredDepth: number;
  /** Net stack-height change on every successful path through the block. */
  delta: number;
  /** Minimum number of alt-stack values which must already exist when the block begins. */
  requiredAltDepth: number;
  /** Net alt-stack-height change on every successful path through the block. */
  altDelta: number;
}

export interface AssemblyStackAnalysisError {
  error: string;
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
  [Op.OP_INVERT]: { pops: 1, pushes: 1 },
  [Op.OP_LSHIFTNUM]: { pops: 2, pushes: 1 },
  [Op.OP_RSHIFTNUM]: { pops: 2, pushes: 1 },
  [Op.OP_LSHIFTBIN]: { pops: 2, pushes: 1 },
  [Op.OP_RSHIFTBIN]: { pops: 2, pushes: 1 },
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

interface ConditionalFrame {
  kind: 'conditional';
  entryState: AssemblyStackAnalysis;
  thenState?: AssemblyStackAnalysis;
}

interface LoopFrame {
  kind: 'loop';
  entryState: AssemblyStackAnalysis;
}

type ControlFrame = ConditionalFrame | LoopFrame;

const isConditionalStart = (opcode: number): boolean => opcode === Op.OP_IF || opcode === Op.OP_NOTIF;

/**
 * Analyze a native assembly block without assuming a particular compiler-managed input stack.
 *
 * Raw IF/ELSE arms are safe for the surrounding compiler only when every arm converges to the same stack
 * height. OP_BEGIN/OP_UNTIL loops obey the analogous invariant: after OP_UNTIL consumes the condition, the
 * body must restore both stacks to their loop-entry heights. This analysis also computes the number of values
 * the block borrows from its caller.
 */
export function analyzeAssemblyStack(
  script: readonly (number | Uint8Array)[],
): AssemblyStackAnalysis | AssemblyStackAnalysisError {
  let state: AssemblyStackAnalysis = {
    requiredDepth: 0, delta: 0, requiredAltDepth: 0, altDelta: 0,
  };
  const frames: ControlFrame[] = [];

  const apply = (effect: StackEffect): void => {
    state.requiredDepth = Math.max(state.requiredDepth, effect.pops - state.delta);
    state.delta += effect.pushes - effect.pops;
  };
  const applyAlt = (pops: number, pushes: number): void => {
    state.requiredAltDepth = Math.max(state.requiredAltDepth, pops - state.altDelta);
    state.altDelta += pushes - pops;
  };

  for (const element of script) {
    if (element instanceof Uint8Array) {
      state.delta += 1;
      continue;
    }
    if (isConditionalStart(element)) {
      apply({ pops: 1, pushes: 0 });
      frames.push({ kind: 'conditional', entryState: { ...state } });
      continue;
    }
    if (element === Op.OP_ELSE) {
      const frame = frames.at(-1);
      if (!frame || frame.kind !== 'conditional') return { error: 'OP_ELSE has no matching OP_IF/OP_NOTIF' };
      if (frame.thenState) return { error: 'an assembly conditional may contain only one OP_ELSE' };
      frame.thenState = { ...state };
      state = { ...frame.entryState };
      continue;
    }
    if (element === Op.OP_ENDIF) {
      const frame = frames.pop();
      if (!frame || frame.kind !== 'conditional') {
        return { error: 'OP_ENDIF has no matching OP_IF/OP_NOTIF' };
      }
      const thenState = frame.thenState ?? state;
      const elseState = frame.thenState
        ? state : frame.entryState;
      if (thenState.delta !== elseState.delta || thenState.altDelta !== elseState.altDelta) {
        return {
          error: 'assembly conditional stack-height mismatch '
            + `(main ${thenState.delta}/${elseState.delta}, alt ${thenState.altDelta}/${elseState.altDelta})`,
        };
      }
      state = {
        requiredDepth: Math.max(thenState.requiredDepth, elseState.requiredDepth),
        delta: thenState.delta,
        requiredAltDepth: Math.max(thenState.requiredAltDepth, elseState.requiredAltDepth),
        altDelta: thenState.altDelta,
      };
      continue;
    }
    if (element === Op.OP_BEGIN) {
      frames.push({ kind: 'loop', entryState: { ...state } });
      continue;
    }
    if (element === Op.OP_UNTIL) {
      const frame = frames.pop();
      if (!frame || frame.kind !== 'loop') return { error: 'OP_UNTIL has no matching OP_BEGIN' };
      apply({ pops: 1, pushes: 0 });
      if (state.delta !== frame.entryState.delta || state.altDelta !== frame.entryState.altDelta) {
        return {
          error: 'assembly loop stack-height mismatch '
            + `(main ${frame.entryState.delta}/${state.delta}, `
            + `alt ${frame.entryState.altDelta}/${state.altDelta})`,
        };
      }
      state = {
        requiredDepth: Math.max(frame.entryState.requiredDepth, state.requiredDepth),
        delta: frame.entryState.delta,
        requiredAltDepth: Math.max(frame.entryState.requiredAltDepth, state.requiredAltDepth),
        altDelta: frame.entryState.altDelta,
      };
      continue;
    }
    const effect = getStackEffect(element);
    if (!effect) return { error: `opcode ${element} has no statically trackable stack effect` };
    if (element === Op.OP_TOALTSTACK) {
      apply(effect);
      applyAlt(0, 1);
    } else if (element === Op.OP_FROMALTSTACK) {
      applyAlt(1, 0);
      apply(effect);
    } else {
      apply(effect);
    }
  }

  const open = frames.at(-1);
  if (open?.kind === 'conditional') return { error: 'assembly conditional is missing OP_ENDIF' };
  if (open?.kind === 'loop') return { error: 'assembly loop is missing OP_UNTIL' };
  return state;
}
