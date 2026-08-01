import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * X125: THE RELEASE 0 FIGURES LEAK OUT OF THE DOC THAT OWNS THEM.
 *
 * `CompilerHiddenBatchDocCoherence.test.ts` ties `compiler-hidden-batch-v1.md` to the tests it names. It
 * cannot see the second half of the defect: the SAME figures were copied into six OTHER documents, which
 * name no authority at all. X108 re-derived the owning table; the copies stayed at their 99abfbe2 values
 * through every commit since, and one of them had INVERTED - a token recorded as non-deployable at 10,600
 * bytes compiles at 6,032 with 3,968 to spare.
 *
 * This file is the link for the copies. Like its sibling it defines no fixture and measures nothing: it
 * reads the pins out of the test files that own them and asserts the downstream prose repeats them.
 *
 * TWO LAYERS, because one is not enough:
 *
 *  1. ANCHORED CHECKS. Every live figure in the six documents is located by a pattern anchored on its own
 *     sentence and compared against the pin. A figure that moves fails; a sentence that is reworded so the
 *     pattern no longer matches is a NAMED REFUSAL, never a skip. That is the difference between this guard
 *     and no guard: the incident it exists to prevent was a check that silently stopped applying.
 *
 *  2. RETIRED-FIGURE SCAN. Layer 1 only sees figures someone thought to anchor. A NEW sentence carrying an
 *     old number would pass it. So every retired value is also banned outright, except in a paragraph that
 *     says it is superseded or states the value that replaced it. That is exactly the shape a correction
 *     takes ("X, not Y" / "was Y, is X"), so the rule costs a correct author nothing and stops a copy.
 *
 * The authority document is exempt from layer 2 and only from layer 2: recording old -> new is its whole
 * purpose. The exemption is asserted, not assumed - its history table must exist, so "exempt" cannot decay
 * into "uncovered".
 *
 * WHEN THIS FILE GOES RED, THE DOCS ARE STALE, NOT THIS TEST.
 */

const here = dirname(fileURLToPath(import.meta.url));
const DOCS = join(here, '../docs');
const BATCH_COST = join(here, 'BatchCostRegression.test.ts');
const COMPILED_GRAPH = join(here, '../../solidcash/test/Layer3CompiledGraph.test.ts');

const SCRIPT_LIMIT = 10_000;

const read = (path: string): string => readFileSync(path, 'utf8');

const num = (raw: string): number => Number(raw.replace(/,/g, '').replace(/_/g, '').replace(/^\+/, ''));

/** Captured figures from one anchored sentence, refusing by name rather than defaulting when it moves. */
const prose = (text: string, pattern: RegExp, doc: string, label: string): number[] => {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`doc-coherence refusal: could not read "${label}" from ${doc}. A figure that cannot `
      + 'be located cannot be checked; re-anchor this pattern on the current prose.');
  }
  return match.slice(1).map(num);
};

interface Pins {
  direct: number; batch: number; delta: number; routeBody: number;
  verifier: number; controller: number;
}

/**
 * The pins, read from the two test files that own them. The ERC-20 block is the one `toEqual` in
 * BatchCostRegression with a `routeBodyBytes` and no `expandedOpcodes`; the parser/dispatcher block has both.
 */
const pins = (batchCostText: string, compiledGraphText: string): Pins => {
  const blocks = [...batchCostText.matchAll(/\}\)\.toEqual\(\{([^}]*)\}\)/g)].map((match) => {
    const field = (name: string): number | undefined => {
      const found = match[1].match(new RegExp(`${name}:\\s*(\\d+)`));
      return found ? Number(found[1]) : undefined;
    };
    return {
      direct: field('directBytes'),
      batch: field('batchBytes'),
      delta: field('covenantDeltaBytes'),
      routeBody: field('routeBodyBytes'),
      opcodes: field('expandedOpcodes'),
    };
  });
  const erc20 = blocks.find((block) => block.direct !== undefined && block.routeBody !== undefined
    && block.opcodes === undefined);
  if (!erc20) {
    throw new Error('doc-coherence refusal: BatchCostRegression.test.ts no longer exposes the two-row '
      + 'ERC-20 footprint pin in the shape this guard reads. Six documents quote it; none may be checked '
      + 'against a pin that cannot be found.');
  }

  const covenant = (name: string): number => {
    const found = compiledGraphText.match(
      new RegExp(`${name}Artifact\\.debug\\.bytecode\\.length / 2\\)\\.toBe\\(([\\d_]+)\\)`),
    );
    if (!found) {
      throw new Error(`doc-coherence refusal: Layer3CompiledGraph.test.ts no longer pins the ${name} `
        + 'covenant size in the shape this guard reads.');
    }
    return num(found[1]);
  };

  return {
    direct: erc20.direct!,
    batch: erc20.batch!,
    delta: erc20.delta!,
    routeBody: erc20.routeBody!,
    verifier: covenant('projection'),
    controller: covenant('controller'),
  };
};

/**
 * Retired values, with the figure that replaced each. `225` is matched only in a byte or table-cell
 * context: bare "225" is an ordinary number and banning it outright would be a guard nobody could satisfy.
 */
const RETIRED: readonly { pattern: RegExp; was: string; now: string }[] = [
  { pattern: /9,775/, was: '9,775', now: '4,900' },
  { pattern: /10,600/, was: '10,600', now: '6,032' },
  { pattern: /6,532/, was: '6,532', now: '1,562' },
  { pattern: /1,477/, was: '1,477', now: '1,037' },
  { pattern: /3,047/, was: '3,047', now: '3,157' },
  { pattern: /1,020/, was: '1,020', now: '325' },
  { pattern: /6,728/, was: '+6,728', now: '+1,743' },
  { pattern: /1,108/, was: '+1,108', now: '+668' },
  { pattern: /4,098/, was: '4,098', now: '5,820' },
  { pattern: /4,814/, was: '4,814', now: '4,900' },
  { pattern: /1,554/, was: '1,554', now: '1,562' },
  { pattern: /1,657/, was: '+1,657', now: '+1,743' },
  { pattern: /4,121/, was: '4,121', now: '5,820' },
  { pattern: /1,459/, was: '1,459', now: '2,810' },
  { pattern: /5,186/, was: '5,186', now: '5,100' },
  { pattern: /225[- ]byte|225 bytes|\| 225 \|/, was: '225', now: '5,100' },
];

/** Every stale-figure discrepancy across the downstream documents, as one flat list. */
const findings = (docs: Map<string, string>, pin: Pins): string[] => {
  const out: string[] = [];
  const at = (name: string): string => {
    const text = docs.get(name);
    if (text === undefined) throw new Error(`doc-coherence refusal: ${name} is not loaded.`);
    return text;
  };
  const eq = (label: string, actual: number, expected: number): void => {
    if (actual !== expected) out.push(`${label}: doc ${actual}, pinned ${expected}`);
  };
  const headroom = (label: string, size: number, stated: number): void => {
    if (stated !== SCRIPT_LIMIT - size) {
      out.push(`${label} headroom not re-derived: doc ${stated}, derived ${SCRIPT_LIMIT - size}`);
    }
    if (size >= SCRIPT_LIMIT) out.push(`${label} is claimed inside the limit at ${size} bytes`);
  };

  // --- compiler-hidden-batch-v1-audit.md: the X125 re-derivation table and its three consequences.
  const audit = at('compiler-hidden-batch-v1-audit.md');
  const auditLines = audit.split('\n');
  const header = auditLines.findIndex((line) => line.trim() === '| figure | as audited | at HEAD | how measured |');
  if (header < 0) {
    throw new Error('doc-coherence refusal: the X125 re-derivation table is gone from '
      + 'compiler-hidden-batch-v1-audit.md. F4 was the row that went stale; without this table its figures '
      + 'have no authority again.');
  }
  const headRow = new Map<string, number>();
  for (let index = header + 2; index < auditLines.length; index += 1) {
    const line = auditLines[index].trim();
    if (!line.startsWith('|')) break;
    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
    headRow.set(cells[0], num(cells[2]));
  }
  eq('audit F4 route batch bytes', headRow.get('route batch bytes')!, pin.batch);
  eq('audit F4 route body', headRow.get('SCB1 route body')!, pin.routeBody);
  eq('audit F4 direct token bytes', headRow.get('direct token bytes')!, pin.direct);
  eq('audit F4 batch delta', headRow.get('batch delta')!, pin.delta);
  eq('audit F4 headroom', headRow.get('headroom under 10,000')!, SCRIPT_LIMIT - pin.batch);
  // The delta is a consequence of the two columns beside it, so it is re-derived rather than trusted.
  if (pin.delta !== pin.batch - pin.direct) {
    out.push(`audit F4 delta is not batch minus direct: ${pin.delta} vs ${pin.batch - pin.direct}`);
  }

  const [wasBatch, wasDirect, wasRatio, isBatch, isDirect, isRatio] = prose(
    audit,
    /It was ([\d,]+)\/([\d,]+) = ([\d.]+)x; it is ([\d,]+)\/([\d,]+) = ([\d.]+)x\./,
    'compiler-hidden-batch-v1-audit.md', 'F4 size-growth multiple',
  );
  eq('audit F4 growth numerator', isBatch, pin.batch);
  eq('audit F4 growth denominator', isDirect, pin.direct);
  for (const [label, batch, direct, ratio] of [
    ['audit F4 retired growth multiple', wasBatch, wasDirect, wasRatio],
    ['audit F4 growth multiple', isBatch, isDirect, isRatio],
  ] as const) {
    const derived = Number((batch / direct).toFixed(2));
    if (ratio !== derived) out.push(`${label} not re-derived: doc ${ratio}, derived ${derived}`);
  }

  const [corpusToken, corpusSpare] = prose(
    audit, /compiles to ([\d,]+) bytes with ([\d,]+) to\s+spare/,
    'compiler-hidden-batch-v1-audit.md', 'F4 corpus token headroom',
  );
  headroom('audit F4 corpus token', corpusToken, corpusSpare);
  const [marginalToken, marginalSpare] = prose(
    audit, /([\d,]+) batch bytes, ([\d,]+) of\s+headroom/,
    'compiler-hidden-batch-v1-audit.md', 'F4 marginally-larger-token counter-example',
  );
  headroom('audit F4 marginal token', marginalToken, marginalSpare);

  // --- compiler-hidden-batch-v1-review-handoff.md
  const handoff = at('compiler-hidden-batch-v1-review-handoff.md');
  const [handoffRoute, handoffHead] = prose(
    handoff, /fixture compiles to ([\d,]+) bytes, leaving ([\d,]+) bytes below the covenant limit/,
    'compiler-hidden-batch-v1-review-handoff.md', 'stripped route headroom',
  );
  eq('handoff route bytes', handoffRoute, pin.batch);
  headroom('handoff route', handoffRoute, handoffHead);
  const [handoffToken, handoffTokenHead] = prose(
    handoff, /helpers is ([\d,]+) bytes[\s\S]{0,120}?has ([\d,]+) bytes of headroom/,
    'compiler-hidden-batch-v1-review-handoff.md', 'corpus token headroom',
  );
  headroom('handoff corpus token', handoffToken, handoffTokenHead);
  const [checklistDirect, checklistBatch] = prose(
    handoff, /size regression reproduces at ([\d,]+)\/([\d,]+) bytes/,
    'compiler-hidden-batch-v1-review-handoff.md', 'reviewer checklist size regression',
  );
  eq('handoff checklist direct bytes', checklistDirect, pin.direct);
  eq('handoff checklist batch bytes', checklistBatch, pin.batch);

  // --- buffered-state-and-message-bus-research.md
  const research = at('buffered-state-and-message-bus-research.md');
  const [researchRoute, researchHead] = prose(
    research, /fixture is ([\d,]+) bytes, leaving ([\d,]+) bytes below the covenant limit/,
    'buffered-state-and-message-bus-research.md', 'compiled fixture headroom',
  );
  eq('research route bytes', researchRoute, pin.batch);
  headroom('research route', researchRoute, researchHead);

  // --- journal-bus-implementation-status.md: both sides of the size comparison, and the margin between.
  const status = at('journal-bus-implementation-status.md');
  const [statusRoute, statusHead] = prose(
    status, /route already compiles to ([\d,]+) bytes\s+\(([\d,]+) under the 10,000 limit\)/,
    'journal-bus-implementation-status.md', 'ERC-20 route headroom',
  );
  eq('status route bytes', statusRoute, pin.batch);
  headroom('status route', statusRoute, statusHead);
  const [statusVerifier] = prose(
    status, /verifier compiles to \*\*([\d,]+) bytes\*\*/,
    'journal-bus-implementation-status.md', 'graph projection verifier',
  );
  eq('status projection verifier bytes', statusVerifier, pin.verifier);
  const [statusPlaceholder] = prose(
    status, /\(([\d,]+) with a 1-byte placeholder\)/,
    'journal-bus-implementation-status.md', 'graph root controller placeholder size',
  );
  eq('status controller placeholder bytes', statusPlaceholder, pin.controller);
  const [margin, marginVerifier, marginBatch] = prose(
    status, /by \*\*([\d,]+) bytes\*\* \(([\d,]+) - ([\d,]+)\)/,
    'journal-bus-implementation-status.md', 'graph-versus-route margin',
  );
  eq('status margin batch operand', marginBatch, pin.batch);
  eq('status margin verifier operand', marginVerifier, pin.verifier);
  if (margin !== marginVerifier - marginBatch) {
    out.push(`status margin not re-derived: doc ${margin}, derived ${marginVerifier - marginBatch}`);
  }

  // --- state-journal-audit.md
  const journalAudit = at('state-journal-audit.md');
  const [auditIndexHead] = prose(
    journalAudit, /the route has ([\d,]+)\s+bytes of headroom/,
    'state-journal-audit.md', 'F4 index headroom',
  );
  eq('state-journal-audit headroom', auditIndexHead, SCRIPT_LIMIT - pin.batch);

  // --- layer3-erc20-continuation-handoff.md: the outlining note, whose claim survived its figure.
  const continuation = at('layer3-erc20-continuation-handoff.md');
  const [stayedAt] = prose(
    continuation, /stayed at ([\d,]+) bytes for exactly this reason/,
    'layer3-erc20-continuation-handoff.md', 'single-function direct compile',
  );
  eq('continuation direct compile bytes', stayedAt, pin.direct);
  const [twoFunction, fall] = prose(
    continuation, /to\s+([\d,]+) bytes, a ([\d,]+)-byte fall/,
    'layer3-erc20-continuation-handoff.md', 'two-function outlining control',
  );
  if (fall !== stayedAt - twoFunction) {
    out.push(`continuation outlining fall not re-derived: doc ${fall}, derived ${stayedAt - twoFunction}`);
  }

  return out;
};

/** Paragraphs (blank-line separated) carrying a retired figure without saying what replaced it. */
const retiredLeaks = (docs: Map<string, string>): string[] => {
  const out: string[] = [];
  for (const [name, text] of docs) {
    for (const paragraph of text.split(/\n\s*\n/)) {
      for (const { pattern, was, now } of RETIRED) {
        if (!pattern.test(paragraph)) continue;
        if (paragraph.includes('supersed') || paragraph.includes(now)) continue;
        const line = paragraph.split('\n').find((entry) => pattern.test(entry))!.trim();
        out.push(`${name}: retired figure ${was} (now ${now}) with no supersession in its paragraph: `
          + `${line.slice(0, 90)}`);
      }
    }
  }
  return out;
};

const DOWNSTREAM = [
  'compiler-hidden-batch-v1-audit.md',
  'compiler-hidden-batch-v1-review-handoff.md',
  'buffered-state-and-message-bus-research.md',
  'journal-bus-implementation-status.md',
  'state-journal-audit.md',
  'layer3-erc20-continuation-handoff.md',
];

describe('the Release 0 figures copied out of compiler-hidden-batch-v1.md agree with their pins', () => {
  const docs = new Map(DOWNSTREAM.map((name) => [name, read(join(DOCS, name))]));
  const pin = pins(read(BATCH_COST), read(COMPILED_GRAPH));

  it('repeats every pinned figure and re-derives every consequence', () => {
    expect(findings(docs, pin)).toEqual([]);
  });

  it('carries no retired figure without saying what replaced it', () => {
    expect(retiredLeaks(docs)).toEqual([]);
  });

  /**
   * The authority document is exempt from the retired-figure scan because recording old -> new is what it
   * is for. Assert the exemption is earned: its history table must be present. If that table is deleted the
   * exemption silently becomes "this document is not checked at all", which is the original defect.
   */
  it('exempts the authority document only while its history table exists', () => {
    const authority = read(join(DOCS, 'compiler-hidden-batch-v1.md'));
    expect(DOWNSTREAM).not.toContain('compiler-hidden-batch-v1.md');
    expect(authority).toContain('| figure | was (99abfbe2) | is (HEAD) | moved by |');
  });

  /**
   * DISCRIMINATING SET. Each control edits exactly one field of one document, so a guard that passed by not
   * looking would fail these. The last three attack derived columns and the retired-figure scan
   * specifically: a consequence left un-re-derived after its input moved is the defect that produced X125,
   * and a guard checking only primary figures stays green through it.
   */
  it.each([
    ['a stale route byte count', 'compiler-hidden-batch-v1-review-handoff.md',
      'fixture compiles to 4,900 bytes', 'fixture compiles to 4,901 bytes',
      /handoff route bytes: doc 4901, pinned 4900/],
    ['a stale projection verifier', 'journal-bus-implementation-status.md',
      'verifier compiles to **5,820 bytes**', 'verifier compiles to **4,098 bytes**',
      /status projection verifier bytes: doc 4098, pinned 5820/],
    ['a stale reviewer checklist', 'compiler-hidden-batch-v1-review-handoff.md',
      'reproduces at 3,157/4,900 bytes', 'reproduces at 3,047/4,900 bytes',
      /handoff checklist direct bytes: doc 3047, pinned 3157/],
    ['a headroom left un-re-derived', 'buffered-state-and-message-bus-research.md',
      'leaving 5,100 bytes below', 'leaving 5,200 bytes below',
      /research route headroom not re-derived: doc 5200, derived 5100/],
    ['a growth multiple left un-re-derived', 'compiler-hidden-batch-v1-audit.md',
      'it is 4,900/3,157 = 1.55x', 'it is 4,900/3,157 = 1.65x',
      /audit F4 growth multiple not re-derived: doc 1.65, derived 1.55/],
    ['a margin left un-re-derived', 'journal-bus-implementation-status.md',
      'by **920 bytes** (5,820 - 4,900)', 'by **1,020 bytes** (5,820 - 4,900)',
      /status margin not re-derived: doc 1020, derived 920/],
  ])('detects %s', (_name, doc, from, to, expected) => {
    const mutated = new Map(docs);
    const before = docs.get(doc)!;
    // A literal string replaces the first literal occurrence, so each control edits exactly one field.
    const after = before.replace(from, to);
    expect(after).not.toBe(before);
    mutated.set(doc, after);
    expect(findings(mutated, pin)).toContainEqual(expect.stringMatching(expected));
  });

  it('detects a retired figure re-seeded into a fresh sentence', () => {
    const mutated = new Map(docs);
    mutated.set('state-journal-audit.md', `${docs.get('state-journal-audit.md')!}\n\nThe stripped route `
      + 'fixture is 9,775 bytes and that is the ceiling for this shape.\n');
    expect(retiredLeaks(mutated)).toContainEqual(
      expect.stringMatching(/state-journal-audit\.md: retired figure 9,775 \(now 4,900\)/),
    );
  });

  /**
   * NEGATIVE CONTROL for the scan itself, differing from the case above only in the supersession clause.
   * Without this, a scan that flagged every paragraph would pass the test above while being useless.
   */
  it('permits a retired figure in a paragraph that states what replaced it', () => {
    const mutated = new Map(docs);
    mutated.set('state-journal-audit.md', `${docs.get('state-journal-audit.md')!}\n\nThe stripped route `
      + 'fixture was 9,775 bytes and is 4,900 bytes.\n');
    expect(retiredLeaks(mutated)).toEqual([]);
  });

  /**
   * Absence must be a named refusal rather than a skip: the failure this guard exists to prevent was a
   * check that quietly stopped applying when its subject moved.
   */
  it('refuses by name when an anchored figure cannot be located', () => {
    const mutated = new Map(docs);
    mutated.set('journal-bus-implementation-status.md',
      docs.get('journal-bus-implementation-status.md')!.replace(/verifier compiles to \*\*[\d,]+ bytes\*\*/,
        'verifier is small'));
    expect(() => findings(mutated, pin))
      .toThrow(/doc-coherence refusal: could not read "graph projection verifier"/);
  });

  it('refuses by name when the X125 re-derivation table is removed', () => {
    const mutated = new Map(docs);
    mutated.set('compiler-hidden-batch-v1-audit.md',
      docs.get('compiler-hidden-batch-v1-audit.md')!
        .replace('| figure | as audited | at HEAD | how measured |', '| gone |'));
    expect(() => findings(mutated, pin))
      .toThrow(/doc-coherence refusal: the X125 re-derivation table is gone/);
  });

  it('refuses by name when a pin it must read changes shape', () => {
    const renamed = read(BATCH_COST).replace(/routeBodyBytes: 1562/, 'routeBodySize: 1562');
    expect(renamed).not.toBe(read(BATCH_COST));
    expect(() => pins(renamed, read(COMPILED_GRAPH)))
      .toThrow(/no longer exposes the two-row ERC-20 footprint pin/);
  });
});
