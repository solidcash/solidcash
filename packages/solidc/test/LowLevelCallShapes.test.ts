import { describe, expect, it } from 'vitest';
import { compileString, parseCode } from '../src/compiler.js';
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
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
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

    it('replaces the leaked block-slot error for a value option', () => {
      expect(compilerMessage(valueOption)).not.toBe(WAS_BLOCK_SLOT);
      expect(compilerMessage(valueOption)).toMatch(
        /Message-bus low-level call shape is not admitted: function 'run' issues a low-level 'call' carrying/,
      );
      expect(namedDiagnostic(valueOption)).toMatch(
        /Message-bus low-level call shape is not admitted: function 'run' issues a low-level 'call' carrying/,
      );
      expect(namedDiagnostic(valueOption)).toContain("the call option(s) 'value'");
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

    it('names the transcript row as the reason, not a compiler data structure', () => {
      expect(namedDiagnostic(valueOption))
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

    it('replaces the leaked runtime-graph-handler error for a returning loop callsite', () => {
      expect(compilerMessage(returningLoop)).not.toBe(WAS_RUNTIME_GRAPH_HANDLER);
      expect(compilerMessage(returningLoop))
        .toContain("function 'run' issues a low-level 'call' inside a loop");
      expect(namedDiagnostic(returningLoop))
        .toContain("function 'run' issues a low-level 'call' inside a loop");
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
        .toEqual([{ callMode: 'call' }]);
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
