import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertCorpusPinsOrRefuse, assertRecordedSamplingOrRefuse, censusFiles, corpusRoot, digestOf, loadCorpusManifest,
  stridesConsistentWith,
  verifyCorpus, verifyCorpusPins,
} from './layer3-corpus-pins.js';
import { F3_CENSUS_CORPORA, F3_CENSUS_GATES, F3_CENSUS_SAMPLING } from './layer3-corpus-census-f3.js';

/**
 * ROW R3-16. The F3 census reads four external checkouts that were pinned to nothing, so its denominators were
 * not reproducible. These tests prove the manifest covers exactly the corpora the census names, that a drifted
 * or absent corpus becomes a NAMED refusal rather than a silent partial census, and that the pins match the
 * checkouts on this box right now.
 *
 * WHAT THIS FILE WILL NOT DO IS PASS QUIETLY WHEN THE CORPUS IS GONE. A guard whose subject can disappear while
 * it stays green is the failure this row exists to close, so absence is asserted to produce a refusal naming
 * the corpus, and the live-state test reports drift as a failure rather than skipping.
 */
describe('F3 corpus checkouts are pinned and drift is detectable', () => {
  const manifest = loadCorpusManifest();

  it('pins exactly the four corpora the census module enumerates', () => {
    expect(manifest.corpora.map((pin) => pin.name).sort())
      .toEqual([...F3_CENSUS_CORPORA].sort());
    // A pin with no commit or no digest would verify nothing while looking present.
    for (const pin of manifest.corpora) {
      expect(pin.commit, `${pin.name} commit`).toMatch(/^[0-9a-f]{40}$/);
      expect(pin.fileSetDigest, `${pin.name} digest`).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(pin.fileCount, `${pin.name} fileCount`).toBeGreaterThan(0);
      expect(pin.inScopeCount, `${pin.name} inScopeCount`).toBeGreaterThan(0);
      expect(pin.inScopeCount, `${pin.name} inScopeCount <= fileCount`).toBeLessThanOrEqual(pin.fileCount);
      expect(pin.recreate.join(' '), `${pin.name} recreate`).toContain(pin.upstream);
    }
  });

  /**
   * The live state, reported as a result rather than assumed. If a corpus has really drifted this fails, and
   * per the standing constraint that IS the finding - it must not be softened into a skip.
   */
  it('reports every corpus on this box as at its pinned commit', () => {
    const result = verifyCorpusPins(manifest);
    expect(result.refusals).toEqual([]);
    expect(result.statuses.map((status) => [status.name, status.verdict])).toEqual(
      manifest.corpora.map((pin) => [pin.name, 'verified']),
    );
    expect(result.ok).toBe(true);
  });

  it('records the census denominator, not just the commit', () => {
    // An upstream commit does not pin the denominator: the harness's own exclusion sets move it too. So the
    // recorded in-scope count must be re-derived from the checkout, not trusted.
    for (const pin of manifest.corpora) {
      const root = corpusRoot(pin);
      const files = censusFiles(pin, root);
      expect(files.length, `${pin.name} file count`).toBe(pin.fileCount);
      expect(digestOf(root, files), `${pin.name} digest`).toBe(pin.fileSetDigest);
    }
  });

  /**
   * DISCRIMINATING SET. Each control attacks exactly one pinned field and leaves the rest of the manifest
   * intact, so a verifier that merely checked existence, or that checked the commit alone, would fail them.
   */
  it('refuses by name when the pinned commit does not match the checkout', () => {
    const pin = manifest.corpora.find((entry) => entry.name === 'solc-corpus')!;
    const attacked = { ...pin, commit: 'f'.repeat(40) };
    const status = verifyCorpus(attacked);
    expect(status.verdict).toBe('drifted');
    expect(status.refusals.join('\n')).toMatch(
      /corpus-pin refusal: 'solc-corpus' is at [0-9a-f]{40}, pinned f{40}/,
    );
    // Negative control differing only in the attacked field: the real commit verifies.
    expect(verifyCorpus(pin).verdict).toBe('verified');
  });

  it('refuses by name when the file count moved, which is the census denominator', () => {
    const pin = manifest.corpora.find((entry) => entry.name === 'mistswap')!;
    const attacked = { ...pin, fileCount: pin.fileCount - 1 };
    const status = verifyCorpus(attacked);
    expect(status.verdict).toBe('drifted');
    expect(status.refusals.join('\n')).toMatch(
      /corpus-pin refusal: 'mistswap' file count moved, pinned 15 and measured 16/,
    );
    expect(verifyCorpus(pin).verdict).toBe('verified');
  });

  it('refuses by name when content moved under a matching commit', () => {
    // A dirty working tree leaves the commit correct while the files the census reads have changed. The commit
    // check alone cannot see this, which is why the digest exists.
    const pin = manifest.corpora.find((entry) => entry.name === 'eacc')!;
    const attacked = { ...pin, fileSetDigest: `sha256:${'0'.repeat(64)}` };
    const status = verifyCorpus(attacked);
    expect(status.verdict).toBe('drifted');
    expect(status.refusals.join('\n')).toMatch(/'eacc' content digest moved, pinned sha256:0{64}/);
    expect(status.measured.head).toBe(pin.commit);
    expect(verifyCorpus(pin).verdict).toBe('verified');
  });

  it('refuses by name when a corpus is absent instead of censusing zero files from it', () => {
    const pin = manifest.corpora.find((entry) => entry.name === 'solidity-by-example')!;
    const status = verifyCorpus(pin, { [pin.envVar]: '/nonexistent/corpus/path' });
    expect(status.verdict).toBe('absent');
    expect(status.measured.present).toBe(false);
    expect(status.refusals.join('\n')).toMatch(
      /corpus-pin refusal: 'solidity-by-example' is absent at \/nonexistent\/corpus\/path\/contracts\/src/,
    );
    // The refusal must state what is lost, so a reader cannot mistake it for a benign skip.
    expect(status.refusals.join('\n')).toMatch(/141 in-scope files cannot contribute/);
    expect(status.refusals.join('\n')).toMatch(/would silently measure zero files/);
    // Negative control differing only in the env override: the real root verifies.
    expect(verifyCorpus(pin).verdict).toBe('verified');
  });

  it('honours the same env override the probe honours, per corpus', () => {
    for (const pin of manifest.corpora) {
      const status = verifyCorpus(pin, { [pin.envVar]: '/nonexistent/corpus/path' });
      expect(status.verdict, `${pin.name} must follow ${pin.envVar}`).toBe('absent');
      expect(status.refusals.join('\n')).toContain(pin.envVar);
    }
  });

  /** What a censusing run must call. It has to throw, not warn, or the partial census still gets published. */
  it('assertCorpusPinsOrRefuse throws a named refusal listing every finding', () => {
    const drifted = {
      ...manifest,
      corpora: manifest.corpora.map((pin) =>
        (pin.name === 'eacc' ? { ...pin, commit: 'a'.repeat(40) } : pin)),
    };
    expect(() => assertCorpusPinsOrRefuse(drifted)).toThrow(
      /corpus-pin refusal: the F3 corpus is not at its pinned commits.*1 finding\(s\)/s,
    );
    expect(() => assertCorpusPinsOrRefuse(drifted)).toThrow(/'eacc' is at cea03ed0.*pinned a{40}/s);
    // Negative control: the unmodified manifest does not throw and reports ok.
    expect(assertCorpusPinsOrRefuse(manifest).ok).toBe(true);
  });

  /**
   * The sampling that produced the recorded census is the OTHER unpinned reproducibility parameter, and it
   * moves the same denominators. The recorded census reports a solc-corpus 'files' of 407 against an in-scope
   * population of 4,876, so that row is a sample and must not be quoted as a full census.
   */
  it('reconciles the recorded census file counts with the pinned populations and sampling', () => {
    const { byCorpus } = manifest.samplingOfTheRecordedCensus;
    for (const pin of manifest.corpora) {
      const sampling = byCorpus[pin.name];
      expect(sampling, `${pin.name} sampling`).toBeDefined();
      expect(sampling.population, `${pin.name} population`).toBe(pin.inScopeCount);
      // The probe keeps files where (inScope - 1) % stride === 0.
      expect(sampling.sampled, `${pin.name} sampled`).toBe(Math.ceil(sampling.population / sampling.stride));
      expect(sampling.sampled, `${pin.name} vs recorded census`).toBe(F3_CENSUS_GATES[pin.name]!.files);
    }
    // Exactly one corpus is sampled rather than censused in full, and it is the one the board quotes percentages
    // over most freely.
    expect(Object.entries(byCorpus).filter(([, value]) => value.stride !== 1).map(([name]) => name))
      .toEqual(['solc-corpus']);
  });

  /**
   * X125. THE STRIDE IS DERIVED HERE, NOT READ FROM THE PIN.
   *
   * It was recorded as `strideIsInferred: true` on two corroborations, and neither was proof: `ceil(4876/12) =
   * 407` shows 12 is CONSISTENT with the counts, and the probe's "at stride 12: 29 minutes" note is prose. This
   * searches every stride the counts admit and requires exactly one. If several fit, the counts do not determine
   * the stride and the pin is a guess again - which is the failure this test must be able to report.
   */
  it('derives each stride from the recorded counts and finds exactly one that fits', () => {
    const { byCorpus } = manifest.samplingOfTheRecordedCensus;
    for (const pin of manifest.corpora) {
      const sampling = byCorpus[pin.name]!;
      const fits = stridesConsistentWith(sampling.population, sampling.sampled);
      expect(fits, `${pin.name} strides consistent with ${sampling.sampled}/${sampling.population}`)
        .toEqual([sampling.stride]);
      expect(sampling.strideIsInferred, `${pin.name} stride is derived`).toBe(false);
    }
    // The three full corpora are the control that the search discriminates at all: it returns [1] for them and
    // 12 for solc-corpus from the same code path, so a single-element result is not an artefact of the method.
    expect(stridesConsistentWith(4876, 407)).toEqual([12]);
    expect(Math.ceil(4876 / 11)).toBe(444);
    expect(Math.ceil(4876 / 13)).toBe(376);
  });

  /**
   * A truncated run has a DIFFERENT relation between counts and stride, so ruling it out is a separate step: a
   * `F3_LIMIT` run stops mid-corpus, giving `sampled == (population - 1) / stride + 1` with `population - 1`
   * divisible by the stride. No divisor of 4,875 produces 407, so no truncated run reproduces these counts.
   */
  it('rules out a truncated run as an alternative explanation of the same counts', () => {
    const { population, sampled } = manifest.samplingOfTheRecordedCensus.byCorpus['solc-corpus']!;
    const truncated: number[] = [];
    for (let stride = 1; stride <= population; stride += 1) {
      if ((population - 1) % stride === 0 && (population - 1) / stride + 1 === sampled) truncated.push(stride);
    }
    expect(truncated).toEqual([]);
    // Control: the relation is not vacuous. A run truncated at 326 sampled files IS expressible this way.
    expect((population - 1) % 15).toBe(0);
    expect((population - 1) / 15 + 1).toBe(326);
  });

  /**
   * THE DERIVATION HAS TWO PREMISES IN THE PROBE, AND A PREMISE THAT VANISHES SILENTLY IS THE DEFECT.
   *
   * The uniqueness argument holds only while the probe samples by `(inScope - 1) % stride` and only while it
   * refuses to write the committed census from a partial or merged run. Rewrite either and the recorded counts
   * stop determining the stride, with nothing to say so. Both are asserted by name.
   */
  it('refuses by name if the probe stops backing the derivation', () => {
    const probe = readFileSync(join(dirname(fileURLToPath(import.meta.url)),
      'layer3-corpus-probe-f3.mjs'), 'utf8');
    expect(probe, 'the probe no longer samples by (inScope - 1) % stride, so ceil(population / stride) is not '
      + 'the sampling relation and the derived stride is unverifiable')
      .toContain('if ((inScope - 1) % stride !== 0) {');
    expect(probe, 'the probe no longer refuses to write the committed census from a partial run, so the '
      + 'recorded counts may be a truncation or a merge of two strides and no single stride is derivable')
      .toContain('refusing to overwrite the committed census from a PARTIAL run');
    for (const flag of ['F3_LIMIT', 'F3_CORPORA', 'F3_MERGE']) {
      expect(probe, `${flag} is no longer part of the partial-run refusal`)
        .toContain(`process.env.${flag} !== undefined`);
    }
    expect(probe).toContain('export const F3_CENSUS_SAMPLING');
    expect(probe).toContain('refusing to overwrite the committed census without F3_STRIDES');
    for (const sampling of Object.values(manifest.samplingOfTheRecordedCensus.byCorpus)) {
      expect(sampling.strideRecordedByProbe).toBe(true);
    }
  });

  it('validates emitted sampling metadata and names stride mutation', () => {
    expect(() => assertRecordedSamplingOrRefuse(manifest, F3_CENSUS_SAMPLING, F3_CENSUS_GATES)).not.toThrow();
    const mutated = structuredClone(F3_CENSUS_SAMPLING);
    mutated['solc-corpus']!.stride = 11;
    expect(() => assertRecordedSamplingOrRefuse(manifest, mutated, F3_CENSUS_GATES))
      .toThrow(/corpus-sampling refusal:.*'solc-corpus' stride is 11, pinned 12/s);

    const movedDenominator = structuredClone(F3_CENSUS_SAMPLING);
    movedDenominator['solc-corpus']!.sampled = 444;
    expect(() => assertRecordedSamplingOrRefuse(manifest, movedDenominator, F3_CENSUS_GATES))
      .toThrow(/'solc-corpus' sampling records 444 files but its census gate records 407/s);
  });

  /**
   * The live coupling, asserted so it cannot surprise anyone: this file's denominators come from the pins and the
   * census module's come from a probe run. A re-take at a different stride moves `F3_CENSUS_GATES.files`, the
   * derivation above then yields the NEW stride, and the pin no longer matches. That failure is correct - it is
   * the whole point - but it must name the coupling rather than read as a broken test.
   */
  it('names the census module as the other end of the sampling coupling', () => {
    const { byCorpus } = manifest.samplingOfTheRecordedCensus;
    for (const pin of manifest.corpora) {
      const sampling = byCorpus[pin.name]!;
      expect(sampling.sampled, `${pin.name}: layer3-corpus-pins.json records ${sampling.sampled} sampled files `
        + `at stride ${sampling.stride}, and layer3-corpus-census-f3.ts records `
        + `${F3_CENSUS_GATES[pin.name]!.files}. A re-taken census must re-pin this manifest in the same change.`)
        .toBe(F3_CENSUS_GATES[pin.name]!.files);
    }
    // NOT-IN-SAMPLE is the census's own record of what the stride discarded, so it reconciles the two counts.
    const solc = F3_CENSUS_GATES['solc-corpus']!;
    expect(solc.files + (solc.skipped['NOT-IN-SAMPLE'] ?? 0))
      .toBe(byCorpus['solc-corpus']!.population);
  });

  it('refuses by name when the manifest itself is missing', () => {
    expect(() => loadCorpusManifest('/nonexistent/layer3-corpus-pins.json'))
      .toThrow(/corpus-pin refusal: the pin manifest is missing at/);
  });

  /**
   * The mistswap corpus is recorded as NOT reproducible from upstream, and that record must survive. Asserting
   * it keeps a later pin refresh from quietly upgrading the claim: re-recording the commit is not the same as
   * making the corpus publicly recreatable.
   */
  it('keeps the mistswap irreproducibility on the record', () => {
    const pin = manifest.corpora.find((entry) => entry.name === 'mistswap')!;
    expect(pin.commitReachableFromUpstream).toBe(false);
    expect(pin.nearestUpstreamAncestor).toMatch(/^[0-9a-f]{40}$/);
    expect(pin.notes.join(' ')).toMatch(/NOT REPRODUCIBLE FROM UPSTREAM/);
    expect(pin.recreate.join(' ')).toMatch(/No public commit reproduces this corpus exactly/);
    // The other three are reachable, so this is a property of one corpus and not of the manifest's phrasing.
    for (const other of manifest.corpora.filter((entry) => entry.name !== 'mistswap')) {
      expect(other.commitReachableFromUpstream, other.name).toBe(true);
    }
  });
});
