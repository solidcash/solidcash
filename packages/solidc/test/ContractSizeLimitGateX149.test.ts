import { asmToBytecode } from '@solidcash/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileString } from '../src/compiler.js';
import { MAX_INPUT_BYTESIZE } from '../src/constants.js';

/**
 * X149. `artifact.bytecode` IS NOT BYTES, AND THE SIZE GATE WAS MEASURING IT.
 *
 * `generateArtifact` publishes `bytecode: scriptToAsm(script)` - the human-readable listing, in which one
 * 1-byte opcode occupies `OP_CHECKSIGVERIFY `. So `artifact.bytecode.length / 2` is half a CHARACTER count and
 * overstates the script on every contract, by a factor that depends on the opcode/data mix:
 *
 *      small stateful contract     1,332  listed   ->     283  real   (4.71x)
 *      eacc/MarketplaceV1 direct  32,432  listed   ->  30,981  real   (1.047x)
 *
 * X136 read that overstatement as a SILENT BAND - "`debug.bytecode` is the shorter of the two on every row
 * measured, 498.5 B on FakeToken up to 1,448 B on MarketplaceV1" - and closed it by taking `Math.max` of the
 * two. THERE IS NO BAND. `debug.bytecode` is `binToHex(scriptToBytecode(optimisationResult.script))` of the
 * SAME script the ASM lists; it was the exact byte count all along, and the max made the gate measure the
 * listing on every contract that reached it. The direction is the false-positive one: a contract whose real
 * script is 8,921 bytes was diagnosed `contract-size-limit` because its LISTING is 11,820.5 half-characters.
 *
 * THE FIGURES THIS ROW WAS OPENED WITH ARE IN THAT UNIT AND ARE THEREFORE HIGH. In real bytes, in ORDINARY
 * DIRECT MODE with no route, no controller and no batch:
 *
 *      eacc/MarketplaceV1   30,981 B   20,981 over   (reported as 32,432 / 22,432)
 *
 * The conclusion survives the correction and the arithmetic does not, which is the whole reason to state both.
 */

/**
 * A contract whose size is a parameter. Each `require` compares the argument against a DISTINCT 32-byte
 * literal, so the spans are not byte-identical and the cross-function outliner cannot share them away - the
 * size is a property of the source, not of an optimisation that might change under it.
 */
const bulk = (guards: number, modifiers = ''): string => {
  const lines: string[] = [];
  for (let index = 0; index < guards; index += 1) {
    lines.push(`    require(seed != 0x${(index + 1).toString(16).padStart(64, '0')});`);
  }
  return `pragma solidcash >=0.8.0;
contract Bulk {
  function guard(bytes32 seed) public ${modifiers}{
${lines.join('\n')}
    require(seed != 0x${'ff'.repeat(32)});
  }
}`;
};

interface Compiled {
  bytecode: string;
  debug: { bytecode: string };
  diagnostics?: readonly { code: string; severity?: string; message?: string }[];
}

/** The two numbers this file is about: what the script weighs, and what its listing weighs. */
const lengths = (artifact: Compiled): { scriptBytes: number; listingHalfChars: number } => ({
  scriptBytes: asmToBytecode(artifact.bytecode).length,
  listingHalfChars: artifact.bytecode.length / 2,
});

const sizeDiagnostics = (artifact: Compiled): readonly { code: string; severity?: string; message?: string }[] =>
  (artifact.diagnostics ?? []).filter((entry) => entry.code === 'contract-size-limit');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('X149: the size gate measures the script, not its listing', () => {
  /**
   * THE ROOT FACT, asserted before anything that depends on it. `debug.bytecode` and `bytecode` are two
   * renderings of ONE script, and only one of them is bytes. If this ever fails, every other assertion in this
   * file is measuring something else.
   */
  it('MEASURED: debug.bytecode is the exact byte count and bytecode is a longer listing', () => {
    const artifact = compileString(bulk(40), {}) as Compiled;
    const { scriptBytes, listingHalfChars } = lengths(artifact);
    expect(scriptBytes, 'debug.bytecode is not the same script as bytecode')
      .toBe(artifact.debug.bytecode.length / 2);
    expect(listingHalfChars, 'the ASM listing is no longer longer than the script it lists')
      .toBeGreaterThan(scriptBytes);
  }, 120_000);

  /**
   * THE FALSE POSITIVE THE `Math.max` BASIS PRODUCED, and the reason the basis had to change rather than the
   * message. 240 guards is a contract whose LISTING is over the limit and whose SCRIPT is comfortably under
   * it. Both halves of that are asserted as premises, so the row cannot quietly stop being the case it is.
   */
  it('REGRESSION: a contract whose listing is over and whose script is under is NOT diagnosed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const artifact = compileString(bulk(240), {}) as Compiled;
    const { scriptBytes, listingHalfChars } = lengths(artifact);

    expect(listingHalfChars, 'premise: the LISTING must be over the limit, or this is not the false-positive row')
      .toBeGreaterThan(MAX_INPUT_BYTESIZE);
    expect(scriptBytes, 'premise: the SCRIPT must be under the limit').toBeLessThan(MAX_INPUT_BYTESIZE);

    expect(sizeDiagnostics(artifact), 'a deployable contract is diagnosed as over the limit').toHaveLength(0);
    const printed = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(printed).not.toContain('input-script limit');
  }, 120_000);

  /**
   * THE GENUINE CASE, differing from the control above in exactly ONE field: the guard count, i.e. the size.
   * Over on the SCRIPT, so the diagnostic fires, states the real length and the real overage, and prints.
   */
  it('MEASURED: a contract over the limit in real bytes is diagnosed and announced', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const artifact = compileString(bulk(300), {}) as Compiled;
    const { scriptBytes } = lengths(artifact);

    expect(scriptBytes, 'premise: the SCRIPT must be over the limit').toBeGreaterThan(MAX_INPUT_BYTESIZE);

    const found = sizeDiagnostics(artifact);
    expect(found, 'the over-limit row carries no size diagnostic').toHaveLength(1);
    expect(found[0].severity).toBe('error');
    // The number in the message is the SCRIPT length, not the listing length.
    expect(found[0].message).toContain(`${scriptBytes} bytes`);
    expect(found[0].message, 'the diagnostic does not state the overage')
      .toContain(`${scriptBytes - MAX_INPUT_BYTESIZE} over`);
    expect(found[0].message).not.toContain(`${lengths(artifact).listingHalfChars} bytes`);

    expect(warn, 'the compiler compiled an unspendable contract without printing anything').toHaveBeenCalled();
    const printed = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(printed).toContain("Contract 'Bulk'");
    expect(printed).toContain(`${MAX_INPUT_BYTESIZE}-byte input-script limit`);
  }, 120_000);

  /**
   * THE SECOND CONTROL: under the limit on BOTH renderings. Neither the diagnostic nor the print appears, so
   * the case above is measuring the size and not merely the presence of a contract.
   */
  it('CONTROL: a contract under the limit on both renderings is silent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const artifact = compileString(bulk(150), {}) as Compiled;
    const { scriptBytes, listingHalfChars } = lengths(artifact);
    expect(scriptBytes).toBeLessThan(MAX_INPUT_BYTESIZE);
    expect(listingHalfChars, 'premise: this control must be under on the LISTING too')
      .toBeLessThan(MAX_INPUT_BYTESIZE);
    expect(sizeDiagnostics(artifact)).toHaveLength(0);
    expect(warn.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain('input-script limit');
  }, 120_000);

  /**
   * THE SIZE DIAGNOSTIC APPENDS. It is the only site on this path that used to ASSIGN `artifact.diagnostics`,
   * which meant the contract most in need of its other diagnostics was the one that would lose them. The
   * absence channel (`hidden-batch-route-not-synthesized`) is published after it, so an over-limit contract
   * with no route must carry BOTH - and the assertion is on the SET, not on either one's index. `unsafe` is
   * what denies this contract a route (`lifecycle-or-unsafe-handler`); without it the sole entry point is
   * admitted and there is no second diagnostic to lose.
   */
  it('MEASURED: an over-limit contract with no route keeps both diagnostics', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const artifact = compileString(
      bulk(300, 'unsafe '), { forceStateful: true, experimentalHiddenBatch: true },
    ) as Compiled;
    const codes = (artifact.diagnostics ?? []).map((entry) => entry.code).sort();
    expect(codes).toEqual(['contract-size-limit', 'hidden-batch-route-not-synthesized']);
  }, 120_000);
});
