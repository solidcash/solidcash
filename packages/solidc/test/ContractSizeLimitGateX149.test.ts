import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileString } from '../src/compiler.js';
import { MAX_INPUT_BYTESIZE } from '../src/constants.js';

/**
 * X149. THE SIZE GATE IS A DIAGNOSTIC NOTHING READ, AND THE POPULATION IS NOT NEAR THE CEILING.
 *
 * `compiler.ts` records `artifact.diagnostics = [{severity: 'error', code: 'contract-size-limit'}]` when the
 * compiled script exceeds the 10,000-byte per-input limit. It did not throw, it did not print, and no SDK path
 * reads the field - so a contract that can never be spent compiled clean and silent. X136 fixed its BASIS
 * (`Math.max` of the debug script and the published one, closing a 498.5 to 1,448-byte band in which the
 * published script was over and the gate was still quiet); this file pins the basis, the band, and the fact
 * that the compiler now says so out loud.
 *
 * WHAT A HARD COMPILE-TIME REFUSAL WOULD COST, measured in DIRECT mode at this commit - the mode every bench
 * compiles in, so the count is the count of bench rows a throw would turn red:
 *
 *      eacc/MarketplaceV1        32,432 B   22,432 OVER
 *      eacc/MarketplaceV2        26,987 B   16,987 OVER
 *      eacc/MarketplaceV3        26,959 B   16,959 OVER
 *      eacc/EACCToken            15,772 B    5,772 OVER
 *      mistswap/UniswapV2Factory 42,908.5 B 32,908.5 OVER
 *      mistswap/UniswapV2Pair    13,664.5 B  3,664.5 OVER
 *
 * NONE OF THAT IS A MESSAGE-BUS COST. Those are ORDINARY compiles with no route, no controller and no batch;
 * the bus adds a further 2,478 to 16,381.5 bytes on top. So a compile-time throw does not gate the bus, it
 * deletes six rows from the compile benches and, worse, deletes the ability to MEASURE the gap - the numbers
 * above exist only because `compileFile` returns an artifact for a contract that cannot be deployed. The
 * refusal belongs at the spend boundary, where a script length is fatal rather than merely measurable. What
 * belongs here is that the compiler stops being the quietest thing in the chain.
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

const sizes = (artifact: {
  bytecode: string; debug: { bytecode: string };
}): { published: number; gateBasis: number } => ({
  published: artifact.bytecode.length / 2,
  gateBasis: artifact.debug.bytecode.length / 2,
});

const sizeDiagnostics = (artifact: { diagnostics?: readonly { code: string }[] }): readonly {
  code: string; severity?: string; message?: string;
}[] => (artifact.diagnostics ?? []).filter((entry) => entry.code === 'contract-size-limit');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('X149: the over-limit contract is diagnosed and announced', () => {
  /**
   * THE BAND X136 CLOSED, held open on purpose. 260 guards puts the PUBLISHED script over the limit while the
   * `debug.bytecode` the gate used to measure is still under it. That is the exact shape the old basis was
   * blind to, and it is asserted as a PREMISE first: if a compiler change ever moves the two lengths together,
   * this row stops being a band row and the test says so instead of passing vacuously.
   */
  it('MEASURED: a row whose published script is over while the debug script is under is diagnosed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const artifact = compileString(bulk(260), {});
    const { published, gateBasis } = sizes(artifact);

    expect(published, 'premise: the published script must be OVER the limit').toBeGreaterThan(MAX_INPUT_BYTESIZE);
    expect(gateBasis, 'premise: the OLD gate basis must be UNDER it, or this is not a band row')
      .toBeLessThan(MAX_INPUT_BYTESIZE);

    const found = sizeDiagnostics(artifact);
    expect(found, 'the band row carries no size diagnostic').toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].message).toContain(`${published} bytes`);
    expect(found[0].message, 'the diagnostic does not state the overage')
      .toContain(`${published - MAX_INPUT_BYTESIZE} over`);

    expect(warn, 'the compiler compiled an unspendable contract without printing anything').toHaveBeenCalled();
    const printed = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(printed).toContain("Contract 'Bulk'");
    expect(printed).toContain(`${MAX_INPUT_BYTESIZE}-byte input-script limit`);
  }, 120_000);

  /**
   * THE GUARD NEGATIVE CONTROL, differing from the case above in ONE field: the guard count, i.e. the size.
   * 200 guards is under the limit on BOTH bases. No diagnostic and no print - so the test above is measuring
   * the size and not merely the presence of the contract.
   */
  it('CONTROL: an under-limit contract carries no size diagnostic and prints nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const artifact = compileString(bulk(200), {});
    const { published, gateBasis } = sizes(artifact);

    expect(published, 'premise: the control must be UNDER the limit').toBeLessThan(MAX_INPUT_BYTESIZE);
    expect(gateBasis).toBeLessThan(MAX_INPUT_BYTESIZE);
    expect(sizeDiagnostics(artifact)).toHaveLength(0);
    const printed = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(printed).not.toContain('input-script limit');
  }, 120_000);

  /**
   * THE SAME ROW WITH BOTH LENGTHS OVER. Nothing about the gate may depend on which of the two is the larger,
   * so the deep row is asserted separately rather than assumed to follow from the band row.
   */
  it('MEASURED: a row over on BOTH bases is diagnosed once, not twice', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const artifact = compileString(bulk(300), {});
    const { published, gateBasis } = sizes(artifact);
    expect(gateBasis, 'premise: this row must be over on the OLD basis too').toBeGreaterThan(MAX_INPUT_BYTESIZE);
    expect(published).toBeGreaterThan(gateBasis);

    const found = sizeDiagnostics(artifact);
    expect(found).toHaveLength(1);
    // The LONGER length is what a spender pays for, so that is what the message has to state.
    expect(found[0].message).toContain(`${published} bytes`);
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
    const artifact = compileString(bulk(300, 'unsafe '), { forceStateful: true, experimentalHiddenBatch: true });
    const codes = (artifact.diagnostics ?? []).map((entry) => entry.code).sort();
    expect(codes).toEqual(['contract-size-limit', 'hidden-batch-route-not-synthesized']);
  }, 120_000);
});
