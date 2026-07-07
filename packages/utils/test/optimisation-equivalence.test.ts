import { describe, it, expect } from 'vitest';
import { evaluateCashAssembly, binToHex } from '@bitauth/libauth';
import { optimisationReplacements } from '../src/optimisations.js';

// MD2: the compiler's optimiser cross-check only asserts the two ENGINES agree, not that a REPLACEMENT rule is
// SEMANTICALLY sound - a shared unsound rule would pass. This is the missing per-rule VM-equivalence check: for
// each `[pattern, replacement]`, run both fragments on the BCH VM over a deep, distinct stack and require the
// resulting stacks to be identical. (The compiler-side cross-check was also extended to referenced contracts.)

// 20 distinct single-byte pushes (0x21..0x34) - all valid positive minimal script numbers AND arbitrary bytes,
// so the same prefix exercises arithmetic, bitwise, stack and byte (SIZE/SPLIT/CAT/hash) rules. Deep enough for
// the OP_16 OP_PICK rules (need 17 items).
const PREFIX = Array.from({ length: 20 }, (_v, i) => `OP_PUSHBYTES_1 0x${(0x21 + i).toString(16)}`).join(' ');

// Rules whose operands must be valid signatures / pubkeys can't be exercised with arbitrary bytes; their
// OP_VERIFY-merge soundness is self-evident (X OP_VERIFY == XVERIFY) and covered by the compiler cross-check.
const SIG_RULE = /CHECKSIG|CHECKDATASIG|CHECKMULTISIG/;

// A fragment with an unbalanced OP_IF/OP_NOTIF needs a body + OP_ENDIF to evaluate.
function balanceIf(asm: string): string {
  const opens = (asm.match(/\bOP_(IF|NOTIF)\b/g) ?? []).length;
  const closes = (asm.match(/\bOP_ENDIF\b/g) ?? []).length;
  return opens > closes ? `${asm} OP_1 ${'OP_ENDIF '.repeat(opens - closes).trim()}` : asm;
}

function finalStack(asm: string): string | undefined {
  const result = evaluateCashAssembly(balanceIf(`${PREFIX} ${asm}`).trim());
  // A real opcode failure (stack underflow, disabled op) leaves no stack; the benign "clean stack" verify
  // complaint still populates .stack. Only the former is a skip.
  if (!Array.isArray(result.stack)) return undefined;
  return result.stack.map((item: Uint8Array) => binToHex(item)).join('|');
}

describe('MD2: optimiser replacement rules are VM-equivalent', () => {
  const testable = optimisationReplacements.filter(([pattern]) => !SIG_RULE.test(pattern));

  it('covers every non-signature rule (no rule silently skipped)', () => {
    // Only the OP_VERIFY-merge rules over sig ops are excluded; everything else is VM-checked below.
    const skipped = [...new Set(optimisationReplacements.filter(([p]) => SIG_RULE.test(p)).map(([p]) => p))].sort();
    expect(skipped).toEqual([
      'OP_CHECKDATASIG OP_VERIFY',
      'OP_CHECKMULTISIG OP_VERIFY',
      'OP_CHECKSIG OP_VERIFY',
    ]);
    expect(testable.length).toBeGreaterThan(50);
  });

  it.each(testable)('rule %s -> %s leaves an identical stack', (pattern, replacement) => {
    const patternStack = finalStack(pattern);
    const replacementStack = finalStack(replacement);
    expect(patternStack).toBeDefined();
    expect(replacementStack).toBeDefined();
    expect(patternStack).toBe(replacementStack);
  });
});
