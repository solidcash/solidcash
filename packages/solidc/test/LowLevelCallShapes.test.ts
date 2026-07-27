import { describe, expect, it } from 'vitest';
import { compileString, parseCode } from '../src/compiler.js';
import { LowLevelCallShapeError, validateLowLevelCallShapes } from '../src/semantic/LowLevelCallShapes.js';
import { Ast } from '../src/ast/AST.js';

/**
 * X6 - stable diagnostics for unadmitted low-level call shapes.
 *
 * Each case here pairs the leaked internal message a user sees TODAY with the named diagnostic the new module
 * produces for the same source. The pairing is the point: without it, "the module throws something" would not
 * show that it replaces a specific leak.
 *
 * The module is NOT wired into the compiler pipeline - the message-bus route lives entirely inside
 * `compiler.ts`, a single-writer collision file - so `compileString` below still shows the leak.
 */

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
const leakedMessage = (code: string): string => {
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
      expect(leakedMessage(valueOption)).toBe('Block slot not found: lowLevelCall[0]');
      expect(namedDiagnostic(valueOption)).toMatch(
        /Message-bus low-level call shape is not admitted: function 'run' issues a low-level 'call' carrying/,
      );
      expect(namedDiagnostic(valueOption)).toContain("the call option(s) 'value'");
    });

    it('replaces the leaked block-slot error for a gas option', () => {
      expect(leakedMessage(gasOption)).toBe('Block slot not found: lowLevelCall[0]');
      expect(namedDiagnostic(gasOption)).toContain("carrying the call option(s) 'gas'");
    });

    it('replaces the leaked block-slot error for a staticcall gas option', () => {
      expect(leakedMessage(staticGasOption)).toBe('Block slot not found: lowLevelCall[0]');
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
      expect(leakedMessage(returningLoop))
        .toBe("Runtime graph handler '__scb_graph_run' requires void calls with parameter- or state-pinned targets");
      expect(namedDiagnostic(returningLoop))
        .toContain("function 'run' issues a low-level 'call' inside a loop");
    });

    it('replaces the leaked block-slot error for a void loop callsite', () => {
      expect(leakedMessage(voidLoop)).toBe('Block slot not found: lowLevelCall[0]');
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
      expect(leakedMessage(returningBranch))
        .toBe("Runtime graph handler '__scb_graph_run' requires void calls with parameter- or state-pinned targets");
      expect(namedDiagnostic(returningBranch))
        .toContain("function 'run' issues a low-level 'call' inside a branch");
    });

    it('replaces the leaked block-slot error for a void branch callsite', () => {
      expect(leakedMessage(voidBranch)).toBe('Block slot not found: lowLevelCall[0]');
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
      expect(leakedMessage(singular)).toBe('COMPILED');
      expect(namedDiagnostic(singular)).toBe('ADMITTED');
    });

    it('admits one unconditional option-free staticcall', () => {
      expect(leakedMessage(singularStatic)).toBe('COMPILED');
      expect(namedDiagnostic(singularStatic)).toBe('ADMITTED');
    });

    it('admits one unconditional void call', () => {
      expect(namedDiagnostic(voidSingular)).toBe('ADMITTED');
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
});
