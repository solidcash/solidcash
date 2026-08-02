import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileString, parseCode } from '../src/compiler.js';
import { compileFile } from '../src/compileFile.js';
import { LowLevelCallShapeError, validateLowLevelCallShapes } from '../src/semantic/LowLevelCallShapes.js';
import { Ast } from '../src/ast/AST.js';

/**
 * X6 - stable diagnostics for unadmitted low-level call shapes.
 *
 * WIRED. `compileString` calls `validateLowLevelCallShapes` in message-bus graph mode, immediately after that
 * mode is computed and before any bus lowering. Each case below pairs the internal message the same source
 * leaked BEFORE the wiring with the named diagnostic `compileString` produces now. The pairing is the point:
 * without it, "the compiler throws something" would not show that a specific leak was replaced.
 *
 * The leaked messages are recorded as `WAS` constants rather than asserted, because they no longer occur; the
 * assertion is that the compiler no longer produces them.
 */
const WAS_BLOCK_SLOT = 'Block slot not found: lowLevelCall[0]';
const WAS_RUNTIME_GRAPH_HANDLER =
  "Runtime graph handler '__scb_graph_run' requires void calls with parameter- or state-pinned targets";

const busOptions = {
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
};

const source = (body: string, extraParameters = ''): string => `pragma solidcash >=0.8.0;
contract X6Case() {
  function run(address target, bytes payload${extraParameters}) public {
${body}
    require(payload.length > 0);
  }
}`;

/** What the user sees today, straight from `compileString`. */
const compilerMessage = (code: string): string => {
  try {
    compileString(code, busOptions);
    return 'COMPILED';
  } catch (error) {
    return (error as Error).message;
  }
};

/** What the new module says about the same source. */
const namedDiagnostic = (code: string): string => {
  const ast = parseCode(code) as Ast;
  try {
    validateLowLevelCallShapes(ast.contract);
    return 'ADMITTED';
  } catch (error) {
    expect(error).toBeInstanceOf(LowLevelCallShapeError);
    return (error as Error).message;
  }
};

describe('X6 low-level call shape diagnostics', () => {
  describe('call options', () => {
    const valueOption = source('    (bool ok, bytes result) = target.call{value: amount}(payload);\n'
      + '    require(ok && result.length >= 0);', ', int amount');
    const gasOption = source('    (bool ok, bytes result) = target.call{gas: g}(payload);\n'
      + '    require(ok && result.length >= 0);', ', int g');
    const staticGasOption = source('    (bool ok, bytes result) = target.staticcall{gas: g}(payload);\n'
      + '    require(ok && result.length >= 0);', ', int g');
    const staticValueOption = source(
      '    (bool ok, bytes result) = target.staticcall{value: amount}(payload);\n'
      + '    require(ok && result.length >= 0);', ', int amount',
    );

    it('admits the singular unconditional value option without the former block-slot leak', () => {
      expect(compilerMessage(valueOption)).toBe('COMPILED');
      expect(namedDiagnostic(valueOption)).toBe('ADMITTED');
    });

    it('publishes the raw value option as one bound transfer effect', () => {
      const artifact = compileString(valueOption, busOptions);
      const run = artifact.abi.find((candidate) => candidate.name === 'run')!;
      expect(run.transfers).toEqual([{
        transferIndex: 0,
        recipient: { kind: 'forward', paramIndex: 0 },
        amount: { kind: 'forward', paramIndex: 2 },
        callOption: 'value',
      }]);
      expect(artifact.hiddenBatch!.handlers.find((candidate) => candidate.name === 'run')!.transfers)
        .toEqual(run.transfers);
      expect(artifact.hiddenBatch!.route.blockLayout!.slots.map((slot) => slot.kind))
        .toEqual(['master', 'satoshiContainer', ...new Array(8).fill('transfer')]);
    });

    it('replaces the leaked block-slot error for a gas option', () => {
      expect(compilerMessage(gasOption)).not.toBe(WAS_BLOCK_SLOT);
      expect(compilerMessage(gasOption)).toContain("carrying the call option(s) 'gas'");
      expect(namedDiagnostic(gasOption)).toContain("carrying the call option(s) 'gas'");
    });

    it('replaces the leaked block-slot error for a staticcall gas option', () => {
      expect(compilerMessage(staticGasOption)).not.toBe(WAS_BLOCK_SLOT);
      expect(compilerMessage(staticGasOption)).toContain("issues a low-level 'staticcall' carrying the call");
      expect(namedDiagnostic(staticGasOption)).toContain("issues a low-level 'staticcall' carrying the call");
    });

    it('keeps staticcall with value fail-closed', () => {
      expect(compilerMessage(staticValueOption)).toContain(
        "issues a low-level 'staticcall' carrying the call option(s) 'value'",
      );
      expect(namedDiagnostic(staticValueOption)).toContain(
        "issues a low-level 'staticcall' carrying the call option(s) 'value'",
      );
    });

    it('names the transcript row as the reason, not a compiler data structure', () => {
      expect(namedDiagnostic(gasOption))
        .toContain('has no field for a call option, so the option would execute unbound');
    });
  });

  describe('iterated callsites', () => {
    const returningLoop = source(
      '    for (int i = 0; i < 2; i = i + 1) {\n'
      + '      (bool ok, bytes result) = target.call(payload);\n'
      + '      require(ok && result.length >= 0);\n'
      + '    }',
    );
    const voidLoop = source('    for (int i = 0; i < 2; i = i + 1) { target.call(payload); }');
    const whileLoop = source(
      '    int i = 0;\n'
      + '    while (i < 2) { target.call(payload); i = i + 1; }',
    );

    it('admits an exact two-occurrence returning literal loop and publishes its exact bound', () => {
      expect(namedDiagnostic(returningLoop)).toBe('ADMITTED');
      const artifact = compileString(returningLoop, busOptions);
      expect(artifact.abi.find((fn) => fn.name === 'run')!.externalCalls).toEqual([
        expect.objectContaining({
          occurrence: 'loop', maximumOccurrences: 2, minimumOccurrences: 2,
          occurrenceBoundSource: 'literal', opaqueReturn: true,
        }),
      ]);
    });

    it('replaces the leaked block-slot error for a void loop callsite', () => {
      expect(compilerMessage(voidLoop)).not.toBe(WAS_BLOCK_SLOT);
      expect(compilerMessage(voidLoop)).toContain("issues a low-level 'call' inside a loop");
      expect(namedDiagnostic(voidLoop)).toContain("issues a low-level 'call' inside a loop");
    });

    it('reaches a while loop as well as a desugared for loop', () => {
      expect(namedDiagnostic(whileLoop)).toContain("issues a low-level 'call' inside a loop");
    });

    it('names the missing occurrence bound as the reason', () => {
      expect(namedDiagnostic(voidLoop)).toContain('publishes no occurrence bound');
    });

    it.each([
      ['zero', 0, 'zero occurrences'],
      ['over the transcript ceiling', 25, 'transcript v1 limit of 24'],
    ])('refuses a %s literal bound by name', (_label, count, message) => {
      const candidate = returningLoop.replace('i < 2', `i < ${count}`);
      expect(namedDiagnostic(candidate)).toContain(message);
    });

    it('refuses a noncanonical/unbounded returning loop by name', () => {
      const candidate = source(
        '    int i = 0;\n'
        + '    while (i < payload.length) {\n'
        + '      (bool ok, bytes result) = target.call(payload);\n'
        + '      require(ok && result.length >= 0);\n'
        + '      i = i + 1;\n'
        + '    }',
      );
      expect(namedDiagnostic(candidate)).toContain('publishes no occurrence bound');
    });

    it('refuses a returning call nested in a conditional inside the literal loop', () => {
      const candidate = source(
        '    for (int i = 0; i < 2; i = i + 1) {\n'
        + '      if (payload.length > 0) {\n'
        + '        (bool ok, bytes result) = target.call(payload);\n'
        + '        require(ok && result.length >= 0);\n'
        + '      }\n'
        + '    }',
      );
      expect(namedDiagnostic(candidate)).toContain('inside a loop');
    });

    it('refuses options and void calls inside the otherwise canonical literal loop', () => {
      const optioned = returningLoop.replace('target.call(payload)', 'target.call{gas: 1}(payload)');
      expect(namedDiagnostic(optioned)).toContain('call option(s) \'gas\'');
      expect(namedDiagnostic(voidLoop)).toContain('inside a loop');
    });
  });

  describe('conditional callsites', () => {
    const returningBranch = source(
      '    if (payload.length > 4) {\n'
      + '      (bool ok, bytes result) = target.call(payload);\n'
      + '      require(ok && result.length >= 0);\n'
      + '    }',
    );
    const voidBranch = source('    if (payload.length > 4) { target.call(payload); }');
    const elseBranch = source(
      '    if (payload.length > 4) { require(true); } else { target.call(payload); }',
    );

    it('replaces the leaked runtime-graph-handler error for a returning branch callsite', () => {
      expect(compilerMessage(returningBranch)).not.toBe(WAS_RUNTIME_GRAPH_HANDLER);
      expect(compilerMessage(returningBranch))
        .toContain("function 'run' issues a low-level 'call' inside a branch");
      expect(namedDiagnostic(returningBranch))
        .toContain("function 'run' issues a low-level 'call' inside a branch");
    });

    it('replaces the leaked block-slot error for a void branch callsite', () => {
      expect(compilerMessage(voidBranch)).not.toBe(WAS_BLOCK_SLOT);
      expect(compilerMessage(voidBranch)).toContain("issues a low-level 'call' inside a branch");
      expect(namedDiagnostic(voidBranch)).toContain("issues a low-level 'call' inside a branch");
    });

    it('reaches an else arm as well as an if arm', () => {
      expect(namedDiagnostic(elseBranch)).toContain("issues a low-level 'call' inside a branch");
    });

    it('names the absent "not taken" row as the reason', () => {
      expect(namedDiagnostic(voidBranch))
        .toContain('has no row that means "not taken"');
    });
  });

  describe('the admitted class still passes', () => {
    const singular = source('    (bool ok, bytes result) = target.call(payload);\n'
      + '    require(ok && result.length >= 0);');
    const singularStatic = singular.replace('.call(payload)', '.staticcall(payload)');
    const voidSingular = source('    target.call(payload);');

    it('admits one unconditional option-free call', () => {
      expect(compilerMessage(singular)).toBe('COMPILED');
      expect(namedDiagnostic(singular)).toBe('ADMITTED');
    });

    it('admits one unconditional option-free staticcall', () => {
      expect(compilerMessage(singularStatic)).toBe('COMPILED');
      expect(namedDiagnostic(singularStatic)).toBe('ADMITTED');
    });

    /**
     * X18 (was OPEN): the module called the unconditional VOID form ADMITTED while the bus route leaked
     * `Block slot not found: lowLevelCall[0]` for it - the module asserted a class the compiler did not admit.
     * The void form now lowers to the same opaque `__raw__` graph edge as the returning form, so both
     * spellings of the callsite reach a transcript row. The direct route is unchanged: its own fire-and-forget
     * block-slot form stays.
     */
    it('admits one unconditional void call, which the bus route now compiles', () => {
      expect(namedDiagnostic(voidSingular)).toBe('ADMITTED');
      expect(compilerMessage(voidSingular)).not.toBe(WAS_BLOCK_SLOT);
      expect(compilerMessage(voidSingular)).toBe('COMPILED');
      expect(compileString(voidSingular, { forceStateful: true }).bytecode.length).toBeGreaterThan(0);
    });

    /** The void staticcall is the same member of the class and leaked the same internal message. */
    it('admits one unconditional void staticcall, which the bus route now compiles', () => {
      const voidStatic = source('    target.staticcall(payload);');
      expect(namedDiagnostic(voidStatic)).toBe('ADMITTED');
      expect(compilerMessage(voidStatic)).toBe('COMPILED');
    });

    /**
     * The void form must reach the same authenticated edge the returning form does, not merely stop throwing:
     * a published graph row with the raw callsite, and no `lowLevelCall` block slot standing in for it.
     */
    it('publishes the void call as a raw graph edge, not a low-level block slot', () => {
      const artifact = compileString(voidSingular, busOptions);
      const run = artifact.abi.find((fn) => fn.name === 'run')!;
      expect(run.lowLevelCalls).toBeUndefined();
      expect(run.externalCalls?.length).toBe(1);
      expect(run.blockLayout?.slots.some((slot) => slot.kind === 'lowLevelCall')).toBe(false);
      // The DIRECT route keeps its fire-and-forget block-slot form for the same source.
      const direct = compileString(voidSingular, { forceStateful: true });
      expect(direct.abi.find((fn) => fn.name === 'run')!.lowLevelCalls)
        .toEqual([{ callMode: 'call', target: { kind: 'parameter', name: 'target' } }]);
    });

    it('admits a contract with no low-level call at all', () => {
      expect(namedDiagnostic(`pragma solidcash >=0.8.0;
contract X6None() {
  function run(int value) public { require(value >= 0); }
}`)).toBe('ADMITTED');
    });

    /**
     * A `delegatecall` is a delegate participant edge with its own class enumeration and its own authority
     * argument, so this module must leave it alone rather than fold it into the low-level row class.
     */
    it('leaves delegatecall to the delegate-participant classes', () => {
      expect(namedDiagnostic(`pragma solidcash >=0.8.0;
contract X6Delegate(address impl) {
  bigint counter;
  function run(bytes payload) external {
    if (payload.length > 4) { impl.delegatecall(payload); }
    require(payload.length > 0);
  }
}`)).toBe('ADMITTED');
    });
  });

  describe('more than one low-level callsite', () => {
    /**
     * The compiler already refuses two RETURNING callsites by name. Two VOID callsites reach the same
     * block-slot leak, so the module covers them.
     */
    it('names the one-per-handler rule for two void callsites', () => {
      expect(namedDiagnostic(`pragma solidcash >=0.8.0;
contract X6Twice() {
  function run(address first, address second, bytes payload) public {
    first.call(payload);
    second.call(payload);
    require(payload.length > 0);
  }
}`)).toContain("function 'run' issues 2 low-level calls");
    });
  });

  /**
   * A callsite written in a MODIFIER body is not in any function body until modifier expansion, so the
   * source-shape pass cannot see it. The compiler runs the same check a second time on the expanded bodies;
   * these cases leaked `Block slot not found: lowLevelCall[0]` with only the first pass wired.
   */
  /**
   * X132. THE OPTION SET IS NOT WHAT DECIDES UnicrowClaim, AND NO OPTION IS.
   *
   * The board recorded two disagreeing measurements of `eacc/unicrow/UnicrowClaim.sol` and attributed the
   * disagreement to the option set, `ecrecover: 'p2pkh'` in particular: compiles under the F3 walk's options,
   * raises a named `LowLevelCallShapeError` on `refund` under a narrower set. Measured here, that is not the
   * mechanism. THE TWO MEASUREMENTS HAVE DIFFERENT SUBJECTS:
   *
   *   - `UnicrowClaim.sol` compiles in bus mode under every option set that parses at all, and it has no
   *     function named `refund`;
   *   - `refund` is `Unicrow.sol:218`, whose `escrow.buyer.call{value: escrow.amount}("")` at `:262` is what
   *     raises the refusal. `Unicrow.sol` is a SEPARATE FILE in the same corpus directory.
   *
   * `ecrecover` decides neither: both files give the same answer with and without it, and `UnicrowClaim`
   * compiles to the same byte count either way. The only option that changes anything is
   * `solidityImportCompat`, without which neither file gets past its `pragma solidity` line.
   *
   * The name in the retired bare error is the corroboration: `__extaddr_unicrow` is the external-address
   * variable for `UnicrowClaim.sol:21`'s `Unicrow public immutable unicrow`, so that error was about
   * UnicrowClaim's REFERENCE to Unicrow and is genuinely gone. The `refund` refusal was never the same defect.
   *
   * So the empty compile-failure pin in `Layer3CorpusFitF3.test.ts` is correct, but not for the reason
   * recorded beside it. `Unicrow.sol` cannot appear in that pin at all: it lists APPLICATION rows, and a file
   * that fails bus compilation never becomes one. The failure is not invisible, it is unattributed - it is the
   * single `LowLevelCallShapeError` in the eacc column of `F3_CENSUS_BUS_FAILURES`, recorded as an anonymized
   * histogram key with no filename.
   *
   * WHETHER THE REFUSAL IS CORRECT IS A SEPARATE QUESTION AND THE ANSWER IS YES: `refund` really does carry a
   * `value` option, and a transcript row has no field to bind it. No admission is requested.
   */
  describe('X132 the Unicrow refusal is a property of one file, not of an option', () => {
    const busWithImports = { ...busOptions, solidityImportCompat: true };
    const EACC = process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts';

    /**
     * The shape itself, self-contained, so this pin does not depend on an external checkout. This is
     * `Unicrow.refund` reduced to what the refusal is about: a `call` carrying `value` in a handler.
     */
    const refundShape = `pragma solidcash >=0.8.0;
contract X132Refund() {
  function refund(address buyer, bytes payload, int amount) public {
    buyer.call{value: amount}(payload);
    require(amount > 0);
  }
}`;

    it('keeps the void refund spelling fail-closed', () => {
      expect(namedDiagnostic(refundShape))
        .toContain("function 'refund' issues a low-level 'call' carrying the call option(s) 'value'");
      expect(compilerMessage(refundShape))
        .toContain("function 'refund' issues a low-level 'call' carrying the call option(s) 'value'");
    });

    /** Negative control differing only in the attacked field: drop the option and the same call is admitted. */
    it('admits the same callsite once the value option is removed', () => {
      expect(namedDiagnostic(refundShape.replace('.call{value: amount}', '.call'))).toBe('ADMITTED');
      expect(compilerMessage(refundShape.replace('.call{value: amount}', '.call'))).toBe('COMPILED');
    });

    /**
     * Every corpus compile below is several seconds, and the same (file, options) pair is asked for by more
     * than one case, so each is compiled once. Caching results rather than sharing one artifact keeps each
     * case reading its own outcome string.
     */
    const OUTCOMES = new Map<string, string>();

    /**
     * The corpus attribution. Absence is a NAMED REFUSAL rather than a skip: this test exists to say which
     * file raises the refusal, and a version of it that quietly passes when the corpus is gone would restate
     * the mistake it was written to correct.
     */
    const eaccFile = (name: string): string => {
      const path = join(EACC, 'unicrow', name);
      if (!existsSync(path)) {
        throw new Error(`X132 refusal: the eacc corpus file ${name} is absent at ${path}, so which of the two `
          + 'Unicrow files raises the refund refusal cannot be measured. Set EACC_CONTRACTS_DIR. This must not '
          + 'be softened into a skip: the finding IS the attribution.');
      }
      return path;
    };

    const outcome = (path: string, options: object): string => {
      const key = `${path}|${JSON.stringify(options)}`;
      const cached = OUTCOMES.get(key);
      if (cached !== undefined) return cached;
      let result: string;
      try {
        result = `COMPILED ${compileFile(path, options as never).debug!.bytecode.length / 2}`;
      } catch (error) {
        result = `${(error as Error).constructor.name}: ${(error as Error).message.split('.')[0]}`;
      }
      OUTCOMES.set(key, result);
      return result;
    };

    /**
     * Six distinct (file, options) compiles back these cases and each is several seconds, so they are taken
     * once here rather than per case. The budget is a hang guard for six real compiles, not a performance
     * assertion: nothing below measures time.
     */
    beforeAll(() => {
      for (const name of ['Unicrow.sol', 'UnicrowClaim.sol']) {
        const path = eaccFile(name);
        for (const options of [busOptions, busWithImports, { ...busWithImports, ecrecover: 'p2pkh' }]) {
          outcome(path, options);
        }
      }
    }, 180_000);

    it('raises the refund refusal from Unicrow.sol, which has the function and the value option', () => {
      const result = outcome(eaccFile('Unicrow.sol'), busWithImports);
      expect(result).toContain('LowLevelCallShapeError');
      // The corpus function remains conditional, which is outside the singular unconditional class.
      expect(result).toMatch(/function 'refund' issues a low-level 'call' inside a branch/);
    });

    it('compiles UnicrowClaim.sol in bus mode, which has no refund at all', () => {
      expect(outcome(eaccFile('UnicrowClaim.sol'), busWithImports)).toMatch(/^COMPILED \d+$/);
    });

    /**
     * THE CONTROL THAT SETTLES THE DIAGNOSIS. If the option set decided this, adding or removing
     * `ecrecover: 'p2pkh'` would move at least one of the two outcomes. It moves neither, and UnicrowClaim
     * compiles to the identical byte count both ways.
     */
    it('gives the same answer for both files with and without ecrecover', () => {
      for (const name of ['Unicrow.sol', 'UnicrowClaim.sol']) {
        const path = eaccFile(name);
        expect(outcome(path, busWithImports), `${name} without ecrecover`)
          .toBe(outcome(path, { ...busWithImports, ecrecover: 'p2pkh' }));
      }
    });

    /**
     * The one option that does change the outcome, recorded so "no option decides it" is not overstated:
     * without `solidityImportCompat` neither file parses, so neither reaches the shape check.
     */
    it('names solidityImportCompat as the only option that changes either outcome', () => {
      for (const name of ['Unicrow.sol', 'UnicrowClaim.sol']) {
        expect(outcome(eaccFile(name), busOptions), `${name} without solidityImportCompat`)
          .toContain("Unsupported pragma 'solidity'");
      }
    });
  });

  describe('callsites inlined from a modifier', () => {
    const modifierSource = (modifierBody: string): string => `pragma solidcash >=0.8.0;
contract X6Modifier(address sink) {
  modifier notify(bytes payload) { ${modifierBody} _; }
  function run(bytes payload) public notify(payload) { require(payload.length > 0); }
}`;

    it('names a call option carried by a modifier callsite', () => {
      expect(compilerMessage(modifierSource('sink.call{value: 1}(payload);')))
        .toContain("issues a low-level 'call' carrying the call option(s) 'value'");
    });

    it('names a conditional modifier callsite', () => {
      expect(compilerMessage(modifierSource('if (payload.length > 4) { sink.call(payload); }')))
        .toContain("issues a low-level 'call' inside a branch");
    });

    it('is not reached by the source-shape pass, which sees no callsite in the function body', () => {
      expect(namedDiagnostic(modifierSource('sink.call{value: 1}(payload);'))).toBe('ADMITTED');
    });
  });
});
