import { asmToBytecode } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { compileString, type CompileStringOptions } from '../src/index.js';

// The subroutine-use probe compiles every invoked body to count helper sites. A body reading a constructor
// parameter the probe does not capture throws it into the define-all fallback, which costs every body its helper
// extraction. Each pair below differs only in that read, so the read must cost its own bytes and no more.

// `scaled` stays an invoked body: it touches no state, so no helper inliner takes it.
const internalReader = (factor: string): string => `pragma solidcash ^0.14.0;
contract Ledger(int rate) {
  int total;
  int count;
  function scaled(int x) internal view returns (int) { return x * ${factor} + 1; }
  function add(int x) public { require(x > 0); this.total = this.total + scaled(x); this.count = this.count + 1; }
  function sub(int x) public { require(x > 0); this.total = this.total - scaled(x); this.count = this.count + 1; }
}`;

// A message-bus build runs `add` as a handler clone, an invoked body that captures what `add` reads.
const handlerReader = (factor: string): string => `pragma solidcash ^0.14.0;
contract Meter(int rate) {
  int total;
  int count;
  function add(int x) public { require(x > 0); this.total = this.total + x * ${factor}; this.count = this.count + 1; }
  function sub(int x) public { require(x > 0); this.total = this.total - x; this.count = this.count + 1; }
}`;

interface Probed { bytes: number; probes: number; fallbacks: string[] }

/** Compile with the SOLIDC_PROFILE probe report on: the script size and each probe's fallback reason. */
function compileProbed(source: string, options: CompileStringOptions): Probed {
  const previous = process.env.SOLIDC_PROFILE;
  process.env.SOLIDC_PROFILE = '1';
  const profile = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const artifact = compileString(source, { ...options, __artifactCache: false });
    const reports = profile.mock.calls
      .filter((call) => call[0] === '[solidc-profile]')
      .map((call) => JSON.parse(String(call[1])) as { label: string; fallback?: string })
      .filter((report) => report.label === 'codegen:probe');
    return {
      bytes: asmToBytecode(artifact.bytecode).length,
      probes: reports.length,
      fallbacks: reports.flatMap((report) => (report.fallback === undefined ? [] : [report.fallback])),
    };
  } finally {
    profile.mockRestore();
    if (previous === undefined) delete process.env.SOLIDC_PROFILE;
    else process.env.SOLIDC_PROFILE = previous;
  }
}

describe('subroutine-use probe captures constructor parameters', () => {
  it('gives an internal function reading a constructor parameter the extraction of one reading a literal', () => {
    const reads = compileProbed(internalReader('rate'), { messageBus: false });
    const literal = compileProbed(internalReader('3'), { messageBus: false });
    expect(reads.probes).toBeGreaterThan(0);
    expect(reads.fallbacks).toEqual([]);
    // Measured 1,477 B against 1,472 B; before the probe captured `rate` it fell back and the reader was 1,700 B.
    expect(reads.bytes - literal.bytes).toBeLessThanOrEqual(16);
  });

  it('gives a message-bus handler clone reading a constructor parameter the extraction of one reading a literal', () => {
    const reads = compileProbed(handlerReader('rate'), { messageBus: true });
    const literal = compileProbed(handlerReader('3'), { messageBus: true });
    expect(reads.probes).toBeGreaterThan(0);
    expect(reads.fallbacks).toEqual([]);
    // Measured 2,696 B against 2,689 B; before the probe captured `rate` it fell back and the reader was 3,298 B.
    expect(reads.bytes - literal.bytes).toBeLessThanOrEqual(16);
  });
});
