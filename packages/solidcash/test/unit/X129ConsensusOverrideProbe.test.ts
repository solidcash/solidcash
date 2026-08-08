import { existsSync, readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { createTxVerifier } from '@mem-cash/validation';
import MockNetworkProvider, {
  resetConsensusProbeCacheForTests, assertConsensusOverridesHonoured, consensusProbeTransactionHex,
  probeConsensusOverrides, CONSENSUS_PROBE_SOURCE_OUTPUT, type TxVerifierFactory,
} from '../../src/network/MockNetworkProvider.js';

/**
 * X129 - the SDK must fail CLOSED when the installed `@mem-cash/validation` ignores published consensus limits.
 *
 * THE HOLE THIS CLOSES. `_strictRecursiveVmPreflight` reads `provider.consensusLimits`, which is correct at
 * `@mem-cash/validation` 0.0.8 and FAIL-OPEN at 0.0.7. At 0.0.7 `TxVerifierConfig` has no `consensus` field and
 * `createVmFacade(version, standard)` takes no third argument, so MockNetworkProvider's overrides are silently
 * dropped: the decider runs libauth's stock 800-per-byte budget and refuses `decrement(24)`/`(40)` while the
 * repaired preflight reads the published 10,000,000 and admits them. A build-time refusal becomes a
 * broadcast-time one. `packages/solidcash/package.json` declares `^0.0.8` (exactly 0.0.8 on a 0.0.x range) and
 * `yarn.lock` resolves it, so only a stale `node_modules` reaches 0.0.7 - and X121 row 0 is a TEST, which is not
 * a runtime guard. This is the runtime guard.
 *
 * WHY BEHAVIOURAL AND NOT A VERSION STRING. A version string is a claim about a name, not about the build on
 * disk: a patched tarball, a `yarn link`ed working copy or a renamed channel all read "0.0.8" while behaving
 * otherwise, and a future 0.0.9 that honours overrides perfectly would fail `=== '0.0.8'`. The probe hands the
 * real `createTxVerifier` a limit and watches whether the verdict moves. Nothing else is decisive.
 *
 * MEASURED, both directions, on this box (2026-07-30):
 *
 *   installed 0.0.8  -> relaxed ACCEPT, `operationCostBudgetPerByte: 1` REFUSED
 *                       "Maximum operation cost: 44 (density control length: 44)"  [1 x 44 = 44]
 *                       `maximumStackItemLength: 1`     REFUSED
 *                       "Maximum stack item length: 1 bytes. Item length: 2 bytes."
 *   real 0.0.7       -> relaxed ACCEPT, BOTH strict points ACCEPT. Overrides dropped, probe throws.
 *
 * The 0.0.7 measurement is reproduced below in two independent ways, because each covers what the other cannot:
 * row 2 drives a REAL 0.0.7 build resolved from an ancestor `node_modules` when the tree provides one, and row 1
 * drives a stand-in that reproduces 0.0.7's defect at the same seam - `createTxVerifier` with `consensus`
 * dropped - which is precisely and only what 0.0.7 does with it. The stand-in never rots and always runs; the
 * real build is the evidence that the stand-in is faithful.
 *
 * COST, measured off `dist/` (100k iterations for the cached path, 200 for construction):
 *   uncached probe                    0.803 ms   once per VM version per process
 *   cold MockNetworkProvider ctor     1.496 ms   the one construction that pays for it
 *   warm MockNetworkProvider ctor     0.148 ms   unchanged
 *   cached assert alone               0.055 us   0.04% of a warm construction
 *
 * NOT A SECURITY BOUNDARY, and it widens nothing. The probe only ever refuses to construct a provider; it
 * cannot make a transaction valid, cannot admit a shape the covenants reject, and makes nothing newly
 * buildable. It is a correctness aid that stops `consensusLimits` from being decorative.
 */

/** 0.0.7's whole defect at the seam: `createTxVerifier` receives the config with `consensus` dropped. */
const asIfZeroZeroSeven: TxVerifierFactory = ((config) => createTxVerifier(
  { ...config, consensus: undefined } as Parameters<typeof createTxVerifier>[0],
)) as TxVerifierFactory;

/** The guard's other half: forwards the config untouched, so it differs from the stand-in in nothing else. */
const passThrough: TxVerifierFactory = ((config) => createTxVerifier(config)) as TxVerifierFactory;

const PROBE_CHAIN_STATE = { height: 1, medianTimePast: 0 };

const VM_VERSIONS = ['BCH_2026_05', 'BCH_2025_05', 'BCH_2023_05', 'BCH_SPEC'] as const;

/**
 * Find a REAL `@mem-cash/validation` at `wanted` in an ancestor `node_modules`, walking up from this file. A
 * worktree under a repo whose own tree is stale is exactly how 0.0.7 becomes reachable, so this is the natural
 * place to look. Returns undefined when the tree has no such copy.
 */
function resolveRealValidation(wanted: string): string | undefined {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 12; depth += 1) {
    const candidate = join(dir, 'node_modules', '@mem-cash', 'validation');
    const manifest = join(candidate, 'package.json');
    if (existsSync(manifest)) {
      const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as { version: string };
      if (version === wanted) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

const REAL_007_PATH = resolveRealValidation('0.0.7');

describe('X129 - MockNetworkProvider fails closed when the installed decider ignores consensus limits', () => {
  it('0. the probe ADMITS the installed tree, on every VM version it can be pointed at', () => {
    // The first requirement of a probe: it must not refuse a good install. If this row ever goes red on a
    // freshly installed workspace the probe is wrong, not the tree.
    for (const vmVersion of VM_VERSIONS) {
      expect(
        probeConsensusOverrides(vmVersion),
        `the installed @mem-cash/validation was judged not to honour consensus overrides on ${vmVersion}`,
      ).toBeUndefined();
    }
    // And the constructor that calls it builds a provider rather than throwing. The default operation-cost
    // budget is the REAL 800 (see MOCK_CONSENSUS_LIMITS): density is the one limit a relaxed harness cannot
    // safely hide, because an over-budget contract is indistinguishable from a valid one until it reaches a node.
    expect(new MockNetworkProvider().consensusLimits.operationCostBudgetPerByte).toBe(800);
    // The other limits stay relaxed, so this is a targeted change rather than "the mock is production now".
    expect(new MockNetworkProvider().consensusLimits.maximumInputBytes).toBe(1_000_000);
  });

  it('0b. the arithmetic behind each strict point, and which point is a rule on which VM version', () => {
    // A refusal is only attributable if the number that produced it is the published one. Measured here off
    // the decider directly rather than inferred from the probe's verdict.
    //
    // THE MATRIX, measured (`ACCEPT` = the version has no such rule, so the point cannot be probed there):
    //                                 2023      2025      2026      SPEC
    //   operationCostBudgetPerByte    ACCEPT    refuse    refuse    ACCEPT
    //   maximumStackItemLength        refuse    refuse    refuse    refuse
    //   maximumBytecodeLength         refuse    refuse    refuse    refuse
    // `ConsensusBch2023.operationCostBudgetPerByte` and `ConsensusBchSpec.operationCostBudgetPerByte` are
    // BOTH published as 800 while neither instruction set enforces density - so the presence of the constant
    // is not evidence that the rule exists, and the probe's applicability had to be measured. Encoding it
    // from the constants would have refused two good installs.
    const hex = consensusProbeTransactionHex();
    const decide = (vmVersion: string, consensus: Record<string, number>): string => {
      const result = createTxVerifier(
        { vmVersion, standard: false, consensus } as Parameters<typeof createTxVerifier>[0],
      ).verify(hex, [CONSENSUS_PROBE_SOURCE_OUTPUT], PROBE_CHAIN_STATE);
      return result.success ? 'ACCEPT' : (result as { error: string }).error;
    };
    const RELAXED = {
      operationCostBudgetPerByte: 800, maximumStackItemLength: 520, maximumBytecodeLength: 10_000,
    };
    for (const vmVersion of VM_VERSIONS) {
      // GUARD, run first: at the relaxed limits these exact bytes are ACCEPTED on every version, so no
      // refusal below is the transaction being broken.
      expect(decide(vmVersion, RELAXED), `${vmVersion} refused the probe transaction at relaxed limits`)
        .toBe('ACCEPT');
      // The unlocking bytecode is 3 bytes, so density control length = 41 + 3 = 44 and a budget of 1 per
      // byte gives a ceiling of 1 x 44 = 44, which one 2-byte push (cost 102) cannot clear.
      const dense = decide(vmVersion, { ...RELAXED, operationCostBudgetPerByte: 1 });
      if (vmVersion === 'BCH_2025_05' || vmVersion === 'BCH_2026_05') {
        expect(dense).toMatch(/Maximum operation cost: 44 \(density control length: 44\)/);
      } else {
        expect(dense, `${vmVersion} unexpectedly enforces operation-cost density`).toBe('ACCEPT');
      }
      expect(decide(vmVersion, { ...RELAXED, maximumStackItemLength: 1 }))
        .toMatch(/Maximum stack item length: 1 bytes\. Item length: 2 bytes/);
      expect(decide(vmVersion, { ...RELAXED, maximumBytecodeLength: 1 }))
        .toMatch(/Maximum bytecode length: 1 bytes\. Unlocking bytecode length: 3 bytes/);
    }
  });

  it('1. HOSTILE: a decider that drops `consensus` is refused by name, with the remedy', () => {
    for (const vmVersion of VM_VERSIONS) {
      const verdict = probeConsensusOverrides(vmVersion, asIfZeroZeroSeven);
      expect(verdict, `${vmVersion}: the probe admitted a decider that drops consensus overrides`)
        .toBeDefined();
      // Names the problem...
      expect(verdict).toMatch(/does NOT honour published consensus limits/);
      // Names the FIRST channel that is a rule on this version: density on 2025/2026, stack-item elsewhere.
      expect(verdict).toMatch(
        vmVersion === 'BCH_2025_05' || vmVersion === 'BCH_2026_05'
          ? /must be refused at `operationCostBudgetPerByte: 1`/
          : /must be refused at `maximumStackItemLength: 1`/,
      );
      expect(verdict).toMatch(/the decider answered "ACCEPT"/);
      // ...and the remedy, including why the version matters.
      expect(verdict).toMatch(/Run `yarn install`/);
      expect(verdict).toMatch(/requires exactly 0\.0\.8/);
      expect(verdict).toMatch(/0\.0\.7 silently ignores published consensus limits/);
      // The INCONCLUSIVE branch must not be what fired: the control accepted, so this is evidence about the
      // decider and not about the probe.
      expect(verdict).not.toMatch(/INCONCLUSIVE/);
    }
  });

  it('1b. GUARD: the same factory forwarding `consensus` untouched is ADMITTED', () => {
    // Differs from row 1 in one expression - whether `consensus` reaches `createTxVerifier` - so row 1 cannot
    // be passing because any wrapped factory is refused.
    for (const vmVersion of VM_VERSIONS) {
      expect(probeConsensusOverrides(vmVersion, passThrough)).toBeUndefined();
    }
  });

  it.skipIf(REAL_007_PATH === undefined)(
    '2. the stand-in is FAITHFUL: a real 0.0.7 build behaves identically',
    async () => {
      // Resolved from an ancestor node_modules; skipped only on a tree that has no 0.0.7 anywhere, in which
      // case row 1 still runs and the header records this measurement.
      const real = await import(pathToFileURL(join(REAL_007_PATH!, 'dist', 'index.js')).href) as {
        createTxVerifier: TxVerifierFactory;
      };
      const verdict = probeConsensusOverrides('BCH_2026_05', real.createTxVerifier);
      expect(verdict, `real 0.0.7 at ${REAL_007_PATH} was admitted by the probe`).toBeDefined();
      expect(verdict).toMatch(/does NOT honour published consensus limits/);
      expect(verdict).toMatch(/the decider answered "ACCEPT"/);
      expect(verdict).not.toMatch(/INCONCLUSIVE/);
      // Byte-identical to the stand-in's verdict: the stand-in models 0.0.7 exactly, not approximately.
      expect(verdict).toBe(probeConsensusOverrides('BCH_2026_05', asIfZeroZeroSeven));
      // GUARD: that same real 0.0.7 build ACCEPTS the probe transaction at relaxed limits, so the refusal
      // above is the override being dropped and not 0.0.7 refusing this shape outright.
      const relaxed = real.createTxVerifier({ vmVersion: 'BCH_2026_05', standard: false } as never)
        .verify(consensusProbeTransactionHex(), [CONSENSUS_PROBE_SOURCE_OUTPUT], PROBE_CHAIN_STATE);
      expect(relaxed.success).toBe(true);
    },
  );

  it('3. the CONSTRUCTOR is wired to the verdict, and a bad verdict refuses EVERY construction', () => {
    resetConsensusProbeCacheForTests();
    try {
      // Seed the cache from the 0.0.7-shaped decider, exactly as the constructor would on a stale tree.
      expect(() => assertConsensusOverridesHonoured('BCH_2026_05', asIfZeroZeroSeven))
        .toThrow(/does NOT honour published consensus limits/);
      // Not just the first: the cached verdict is re-thrown, so nothing constructs while the tree is stale.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        expect(() => new MockNetworkProvider()).toThrow(/does NOT honour published consensus limits/);
      }
      expect(() => new MockNetworkProvider()).toThrow(/Run `yarn install`/);
    } finally {
      resetConsensusProbeCacheForTests();
    }
    // GUARD: with the cache cleared and the real factory in force, the same construction succeeds. The
    // difference between refusing and admitting is the decider, nothing about the provider options.
    expect(new MockNetworkProvider().vmTarget).toBe('BCH_2026_05');
  });

  it('4. PROBE ONCE: the decider is measured once per VM version, then cached', () => {
    resetConsensusProbeCacheForTests();
    try {
      let calls = 0;
      const counting: TxVerifierFactory = ((config) => {
        calls += 1;
        return createTxVerifier(config);
      }) as TxVerifierFactory;

      assertConsensusOverridesHonoured('BCH_2026_05', counting);
      // One relaxed control plus one strict point per field that is a rule on this version: 1 + 3 on 2026.
      expect(calls).toBe(4);
      for (let attempt = 0; attempt < 25; attempt += 1) {
        assertConsensusOverridesHonoured('BCH_2026_05', counting);
      }
      expect(calls, 'the probe re-measured a version it had already decided').toBe(4);
      // And a construction after the verdict is cached pays nothing more.
      for (let attempt = 0; attempt < 25; attempt += 1) new MockNetworkProvider();
      expect(calls).toBe(4);

      // A DIFFERENT VM version is a different decider and is measured on its own. BCH_2023 has no
      // operation-cost-density rule, so it costs 1 control + 2 points.
      assertConsensusOverridesHonoured('BCH_2023_05', counting);
      expect(calls).toBe(7);
    } finally {
      resetConsensusProbeCacheForTests();
    }
  });

  it('4b. the cached path costs a Map lookup, not a measurement', () => {
    // Regression bound on requirement 3: if the cache is ever removed, a construction pays ~0.8 ms and this
    // fails by three orders of magnitude. Measured at 0.055 us per call; the bound is 50 us.
    new MockNetworkProvider(); // warm the verdict for the default target
    const iterations = 20_000;
    const started = process.hrtime.bigint();
    for (let index = 0; index < iterations; index += 1) assertConsensusOverridesHonoured('BCH_2026_05');
    const perCallMicroseconds = Number(process.hrtime.bigint() - started) / iterations / 1_000;
    expect(perCallMicroseconds, `cached assert cost ${perCallMicroseconds.toFixed(3)} us per call`)
      .toBeLessThan(50);
  });
});

