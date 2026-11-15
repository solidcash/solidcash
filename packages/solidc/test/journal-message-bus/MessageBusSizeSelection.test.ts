import { describe, expect, it } from 'vitest';
import { asmToBytecode, type Artifact } from '@solidcash/utils';
import { compileString } from '../../src/compiler.js';

/**
 * Automatic message-bus selection takes the bus only to help, so a default compile whose bus build is over the
 * per-input limit and whose direct build fits is the direct build. An explicit `messageBus: true` compile keeps its bus
 * build with the `contract-size-limit` diagnostic, and the SDK refuses to deploy it where the limit is enforced.
 *
 * TokenPayout's 3-turn token loop unrolls in a message-bus compile, a site per turn, which takes its bus build over
 * 10,000 bytes. It calls no contract, so `messageBusGraphContext` keeps automatic selection on the bus.
 *
 * The limit is not lowered to make a build over it: a lower `maximumInputBytes` also bounds the verifier covenant, and
 * once that does not fit, route synthesis fails and the admission ladder falls back to a direct build of its own.
 */
const TOKEN_PAYOUT = `contract TokenPayout {
    int sent;
    function run(bytes32 series, bytes20[] to) public {
        for (int i = 0; i < 3; i++) { this.tokens[series].transfer(new LockingBytecodeP2PKH(to[i]), 5 + i); }
        this.sent = this.sent + 1;
    }
}`;
const AUTOMATIC = { messageBusGraphContext: true, suppressWarnings: true } as const;

const bytes = (artifact: Artifact): number => asmToBytecode(artifact.bytecode).length;
const sizeDiagnostics = (artifact: Artifact): readonly { code: string }[] =>
  (artifact.diagnostics ?? []).filter((entry) => entry.code === 'contract-size-limit');

describe('automatic message-bus selection and the per-input limit', () => {
  it('keeps an explicit message-bus build over the limit, with its diagnostic', () => {
    const explicit = compileString(TOKEN_PAYOUT, { messageBus: true, suppressWarnings: true });
    expect(explicit.compiler.options?.messageBus).toBe(true);
    expect(bytes(explicit)).toBeGreaterThan(10_000);
    expect(sizeDiagnostics(explicit)).toHaveLength(1);
  }, 600_000);

  it('takes the bus build where the limit admits it', () => {
    const roomy = compileString(TOKEN_PAYOUT, { ...AUTOMATIC, maximumInputBytes: 1_000_000 });
    expect(roomy.compiler.options?.messageBus).toBe(true);
    expect(roomy.messageBus).toBeDefined();
    // The premise of the next row: at BCH's limit this build is over it.
    expect(bytes(roomy)).toBeGreaterThan(10_000);
    expect(sizeDiagnostics(roomy)).toHaveLength(0);
  }, 600_000);

  it('takes the direct build where the bus build is over the limit and the direct build fits', () => {
    const direct = compileString(TOKEN_PAYOUT, { ...AUTOMATIC, messageBus: false });
    const chosen = compileString(TOKEN_PAYOUT, AUTOMATIC);
    expect(chosen.compiler.options?.messageBus).toBe(false);
    expect(chosen.messageBus).toBeUndefined();
    // The direct build of the same options, not the admission ladder's fallback (which keeps the kernel options).
    expect(chosen.bytecode).toBe(direct.bytecode);
    expect(bytes(chosen)).toBeLessThanOrEqual(10_000);
    expect(sizeDiagnostics(chosen)).toHaveLength(0);
  }, 600_000);
});
