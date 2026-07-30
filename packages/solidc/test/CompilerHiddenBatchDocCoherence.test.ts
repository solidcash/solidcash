import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * X108: THE DOC TABLES ARE NOW ASSERTABLE, BECAUSE NOTHING TIED THEM TO A MEASUREMENT.
 *
 * `compiler-hidden-batch-v1.md` carries two resource tables. Both were frozen at `99abfbe2`, written into
 * the doc at `47c660f9`, and then went stale through seven commits while every test that measures them
 * stayed green. The Release 5 table drifted by -2,340 transaction bytes; the Release 0 table drifted until
 * a route the doc called "225 bytes below the limit" had 5,186 bytes of headroom, and a token the doc
 * called non-deployable compiled 3,968 bytes inside the limit. Nothing was wrong with any test. The defect
 * was that the doc recorded the same measurements a second time with no link back.
 *
 * This file is that link. It does NOT define fixtures and does NOT measure anything itself: duplicating a
 * fixture here would recreate the same defect one level up, since the copy could drift from the original
 * and the doc would then be checked against the wrong subject. Instead it reads the two test files the doc
 * NAMES as its authority and asserts the doc repeats their pinned numbers exactly.
 *
 * It also asserts the two internal invariants that let the stale table look credible for seven commits:
 * every delta equals batch minus direct, and every operation budget equals `800 * (41 + unlock)`. A
 * partial re-pin that refreshed instruction counts but left unlocking sizes behind would satisfy neither.
 *
 * WHEN THIS FILE GOES RED, THE DOC IS STALE, NOT THIS TEST. Re-derive the doc from the named authority.
 * Parse failures are deliberately named refusals rather than skips: a guard that silently stops checking
 * when a file is reformatted is the failure mode that produced the incident it exists to prevent.
 */

const here = dirname(fileURLToPath(import.meta.url));
const DOC = join(here, '../docs/compiler-hidden-batch-v1.md');
const BATCH_COST = join(here, 'BatchCostRegression.test.ts');
const RELEASE_5 = join(here, '../../solidcash/test/e2e/RepeatedExternalBatchRelease5.test.ts');

const SCRIPT_LIMIT = 10_000;

const read = (path: string): string => readFileSync(path, 'utf8');

const num = (raw: string): number => Number(raw.replace(/,/g, '').replace(/^\+/, ''));

/** Rows of a pipe table located by its exact header line, as raw trimmed cells. */
const table = (text: string, header: string, label: string): string[][] => {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === header.trim());
  if (start < 0) {
    throw new Error(`doc-coherence refusal: ${label} table header not found in compiler-hidden-batch-v1.md. `
      + 'The guard cannot verify a table it cannot locate; restore the header or update this test.');
  }
  const rows: string[][] = [];
  for (let index = start + 2; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith('|')) break;
    rows.push(line.slice(1, -1).split('|').map((cell) => cell.trim()));
  }
  if (rows.length === 0) {
    throw new Error(`doc-coherence refusal: ${label} table in compiler-hidden-batch-v1.md has no rows.`);
  }
  return rows;
};

/** A single captured figure from doc prose, refusing rather than defaulting when the phrasing moves. */
const prose = (text: string, pattern: RegExp, label: string): number[] => {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`doc-coherence refusal: could not read "${label}" from compiler-hidden-batch-v1.md. `
      + 'A figure that cannot be located cannot be checked; re-anchor this pattern on the current prose.');
  }
  return match.slice(1).map(num);
};

interface Footprint { direct: number; batch: number; delta: number; routeBody?: number }

/** The `toEqual({...})` byte pins in BatchCostRegression.test.ts, which the doc names as its authority. */
const batchCostPins = (text: string): { parser: Footprint; erc20: Footprint; rows: Map<number, Footprint> } => {
  const blocks = [...text.matchAll(/\}\)\.toEqual\(\{([^}]*)\}\)/g)].map((match) => {
    const body = match[1];
    const field = (name: string): number | undefined => {
      const found = body.match(new RegExp(`${name}:\\s*(\\d+)`));
      return found ? Number(found[1]) : undefined;
    };
    return {
      direct: field('directBytes'),
      batch: field('batchBytes'),
      delta: field('covenantDeltaBytes'),
      routeBody: field('routeBodyBytes'),
      opcodes: field('expandedOpcodes'),
    };
  }).filter((block) => block.direct !== undefined);

  const parser = blocks.find((block) => block.opcodes !== undefined);
  const erc20 = blocks.find((block) => block.opcodes === undefined);
  if (!parser || !erc20) {
    throw new Error('doc-coherence refusal: BatchCostRegression.test.ts no longer exposes both the parser '
      + 'and ERC20 footprint pins in the shape this guard reads.');
  }

  const rows = new Map<number, Footprint>();
  for (const match of text.matchAll(/\[(\d+), (\d+), (\d+), (\d+), (\d+)\]/g)) {
    rows.set(Number(match[1]), { direct: Number(match[2]), batch: Number(match[3]), delta: Number(match[4]) });
  }
  for (const expected of [2, 3, 8]) {
    if (!rows.has(expected)) {
      throw new Error('doc-coherence refusal: BatchCostRegression.test.ts has no pinned A row for '
        + `${expected} rows.`);
    }
  }
  return { parser: parser as Footprint, erc20: erc20 as Footprint, rows };
};

interface InputMetrics {
  hashes: number; instructions: number; budget: number; cost: number;
  peakBytes: number; peakItems: number; pushed: number; unlock: number;
}

const INPUT_METRICS = new RegExp(
  'hashes:\\s*(\\d+),\\s*instructions:\\s*(\\d+),\\s*maximumOperationCost:\\s*(\\d+),\\s*'
  + 'operationCost:\\s*(\\d+),\\s*peakStackBytes:\\s*(\\d+),\\s*peakStackItems:\\s*(\\d+),\\s*'
  + 'pushedBytes:\\s*(\\d+),\\s*unlockingBytes:\\s*(\\d+),',
  'g',
);

/** The constructed-transaction pins in RepeatedExternalBatchRelease5.test.ts, keyed by row count. */
const release5Pins = (text: string): Map<number, { txBytes: number; inputs: InputMetrics[] }> => {
  const chunks = text.split(/transactionBytes:\s*/).slice(1);
  const measured = chunks.flatMap((chunk) => {
    // The file also writes `transactionBytes: encodeTransaction(...)` when BUILDING the comparison object.
    // Only the literal pins are figures; the expression occurrences carry no number and are skipped.
    const literal = chunk.match(/^(\d+)/);
    if (!literal) return [];
    const txBytes = Number(literal[1]);
    const inputs = [...chunk.matchAll(INPUT_METRICS)].slice(0, 4).map((match) => ({
      hashes: Number(match[1]), instructions: Number(match[2]), budget: Number(match[3]),
      cost: Number(match[4]), peakBytes: Number(match[5]), peakItems: Number(match[6]),
      pushed: Number(match[7]), unlock: Number(match[8]),
    }));
    return [{ txBytes, inputs }];
  }).filter((entry) => entry.inputs.length === 4);

  // The file pins 2, 3 and 8 rows in that order: two it.each cases then the eight-row it.
  if (measured.length !== 3) {
    throw new Error('doc-coherence refusal: expected exactly 3 pinned transactions in '
      + `RepeatedExternalBatchRelease5.test.ts, read ${measured.length}. The doc table covers 2, 3 and 8 `
      + 'rows and this guard must not check a subset of it.');
  }
  return new Map([[2, measured[0]], [3, measured[1]], [8, measured[2]]]);
};

/**
 * Every discrepancy between the doc and its named authority, as one flat list. Returning findings instead
 * of asserting inline is what lets the negative controls below attack exactly one field at a time.
 */
const findings = (docText: string, batchCostText: string, release5Text: string): string[] => {
  const out: string[] = [];
  const pins = batchCostPins(batchCostText);
  const constructed = release5Pins(release5Text);

  const release0 = table(docText, '| covenant | direct bytes | batch bytes | batch delta |', 'Release 0');
  const byLabel = new Map(release0.map((row) => [row[0], row.slice(1).map(num)]));

  const check = (label: string, expected: Footprint): void => {
    const actual = byLabel.get(label);
    if (!actual) {
      out.push(`Release 0 row missing from doc: ${label}`);
      return;
    }
    const [direct, batch, delta] = actual;
    if (direct !== expected.direct) out.push(`${label} direct bytes: doc ${direct}, pinned ${expected.direct}`);
    if (batch !== expected.batch) out.push(`${label} batch bytes: doc ${batch}, pinned ${expected.batch}`);
    if (delta !== expected.delta) out.push(`${label} delta: doc ${delta}, pinned ${expected.delta}`);
    // The delta is a consequence of the two columns beside it, so it is re-derived rather than trusted.
    if (delta !== batch - direct) out.push(`${label} delta is not batch minus direct: ${delta} vs ${batch - direct}`);
  };

  check('B parser/dispatcher', pins.parser);
  check('parameter-authorized `transferFrom`, exact 2-row route', pins.erc20);
  for (const rows of [2, 3, 8]) check(`A, ${rows} rows`, pins.rows.get(rows)!);

  const [scalarBody] = prose(docText, /the ([\d,]+)-byte scalar\s+hidden route body/, 'scalar hidden route body');
  const [entryBody] = prose(docText, /the ([\d,]+)-byte multi-entry route body/, 'multi-entry route body');
  if (scalarBody !== pins.parser.routeBody) {
    out.push(`scalar route body: doc ${scalarBody}, pinned ${pins.parser.routeBody}`);
  }
  if (entryBody !== pins.erc20.routeBody) {
    out.push(`multi-entry route body: doc ${entryBody}, pinned ${pins.erc20.routeBody}`);
  }

  const release5 = table(
    docText,
    '| rows | tx bytes | A instructions | A op cost / budget | A peak items/bytes | A unlock '
    + '| B instructions | B op cost / budget | B peak items/bytes | B unlock |',
    'Release 5',
  );
  for (const row of release5) {
    const rows = num(row[0]);
    const pinned = constructed.get(rows);
    if (!pinned) {
      out.push(`Release 5 doc row ${rows} has no pinned transaction`);
      continue;
    }
    if (num(row[1]) !== pinned.txBytes) {
      out.push(`${rows}-row tx bytes: doc ${num(row[1])}, measured ${pinned.txBytes}`);
    }
    // A is input 0 and B is input 2, as the doc states directly above the table.
    for (const [side, offset, base] of [['A', 0, 2], ['B', 2, 6]] as const) {
      const side0 = pinned.inputs[offset];
      const [cost, budget] = row[base + 1].split('/').map(num);
      const [peakItems, peakBytes] = row[base + 2].split('/').map(num);
      const unlock = num(row[base + 3]);
      if (num(row[base]) !== side0.instructions) {
        out.push(`${rows}-row ${side} instructions: doc ${num(row[base])}, measured ${side0.instructions}`);
      }
      if (cost !== side0.cost) out.push(`${rows}-row ${side} op cost: doc ${cost}, measured ${side0.cost}`);
      if (budget !== side0.budget) out.push(`${rows}-row ${side} budget: doc ${budget}, measured ${side0.budget}`);
      if (peakItems !== side0.peakItems) {
        out.push(`${rows}-row ${side} peak items: doc ${peakItems}, measured ${side0.peakItems}`);
      }
      if (peakBytes !== side0.peakBytes) {
        out.push(`${rows}-row ${side} peak bytes: doc ${peakBytes}, measured ${side0.peakBytes}`);
      }
      if (unlock !== side0.unlock) out.push(`${rows}-row ${side} unlock: doc ${unlock}, measured ${side0.unlock}`);
      // Section 3's budget formula. A re-pin that moved instructions but not unlock would fail here even if
      // it happened to match a stale measurement, which is what made the stale table look self-consistent.
      if (budget !== 800 * (41 + unlock)) {
        out.push(`${rows}-row ${side} budget is not 800 * (41 + ${unlock}): doc ${budget}, `
          + `derived ${800 * (41 + unlock)}`);
      }
    }
  }

  // Section 7.1's headroom figures are consequences of byte counts stated elsewhere in the same doc.
  const [routeBytes, routeHeadroom] = prose(
    docText, /At ([\d,]+) bytes it now has ([\d,]+) bytes of\s+headroom/, 'Release 0 route headroom',
  );
  if (routeBytes !== pins.erc20.batch) {
    out.push(`headroom sentence route bytes: doc ${routeBytes}, pinned ${pins.erc20.batch}`);
  }
  if (routeHeadroom !== SCRIPT_LIMIT - routeBytes) {
    out.push(`route headroom not re-derived: doc ${routeHeadroom}, derived ${SCRIPT_LIMIT - routeBytes}`);
  }

  const [strippedBytes] = prose(docText, /stripped resource-route fixture is ([\d,]+) bytes/, 'stripped route bytes');
  if (strippedBytes !== pins.erc20.batch) {
    out.push(`stripped route bytes: doc ${strippedBytes}, pinned ${pins.erc20.batch}`);
  }
  const [tokenBytes] = prose(docText, /helpers is ([\d,]+) bytes and now compiles inside the limit/, 'token bytes');
  const [tokenHeadroom, strippedHeadroom] = prose(
    docText,
    /the token has ([\d,]+)\s+bytes of headroom and the stripped route has ([\d,]+)\./,
    'section 7.1 headrooms',
  );
  if (tokenHeadroom !== SCRIPT_LIMIT - tokenBytes) {
    out.push(`token headroom not re-derived: doc ${tokenHeadroom}, derived ${SCRIPT_LIMIT - tokenBytes}`);
  }
  if (strippedHeadroom !== SCRIPT_LIMIT - strippedBytes) {
    out.push(`stripped headroom not re-derived: doc ${strippedHeadroom}, derived ${SCRIPT_LIMIT - strippedBytes}`);
  }
  // The token figure is a point measurement no test freezes, so only its stated bound is enforceable.
  if (tokenBytes >= SCRIPT_LIMIT) {
    out.push(`doc claims the corpus token compiles inside the limit at ${tokenBytes} bytes`);
  }
  return out;
};

describe('compiler-hidden-batch-v1.md resource tables agree with the tests they name', () => {
  const docText = read(DOC);
  const batchCostText = read(BATCH_COST);
  const release5Text = read(RELEASE_5);

  it('repeats every pinned figure from BatchCostRegression and RepeatedExternalBatchRelease5', () => {
    expect(findings(docText, batchCostText, release5Text)).toEqual([]);
  });

  /**
   * DISCRIMINATING SET. Each control edits exactly one field of the doc and nothing else, so a guard that
   * passed by not looking would fail these. The last two attack the derived columns specifically: the
   * board's costed-fix incident was a consequence left un-re-derived after its input moved, and a guard
   * that checked only the primary figures would have stayed green through it.
   */
  it.each([
    ['Release 0 batch bytes', '| B parser/dispatcher | 369 | 1,037 |', '| B parser/dispatcher | 369 | 1,038 |',
      /B parser\/dispatcher batch bytes: doc 1038, pinned 1037/],
    ['Release 0 A row', '| A, 3 rows | 426 | 542 | +116 |', '| A, 3 rows | 426 | 543 | +116 |',
      /A, 3 rows batch bytes: doc 543, pinned 542/],
    ['Release 5 B instructions', '| 2,492 | 273,265', '| 2,493 | 273,265',
      /2-row B instructions: doc 2493, measured 2492/],
    ['Release 5 unlock', '| 22 / 2,970 | 1,450 |', '| 22 / 2,970 | 1,451 |',
      /2-row B unlock: doc 1451, measured 1450/],
    ['scalar route body prose', 'the 325-byte scalar', 'the 326-byte scalar',
      /scalar route body: doc 326, pinned 325/],
    ['a delta left un-re-derived', '| B parser/dispatcher | 369 | 1,037 | +668 |',
      '| B parser/dispatcher | 369 | 1,337 | +668 |',
      /delta is not batch minus direct: 668 vs 968/],
    ['a headroom left un-re-derived', 'it now has 5,186 bytes', 'it now has 5,286 bytes',
      /route headroom not re-derived: doc 5286, derived 5186/],
  ])('detects %s', (_name, from, to, expected) => {
    // A literal string replaces the first literal occurrence, so each control edits exactly one field.
    const mutated = docText.replace(from, to);
    expect(mutated).not.toBe(docText);
    expect(findings(mutated, batchCostText, release5Text)).toContainEqual(expect.stringMatching(expected));
  });

  /**
   * A missing table must be a named refusal, not a pass. This is the difference between this guard and the
   * absence of a guard: reformatting the doc must stop the build, because the previous failure mode was a
   * check that was never there at all.
   */
  it('refuses by name when a table it must check cannot be located', () => {
    const withoutTable = docText.replace('| covenant | direct bytes | batch bytes | batch delta |', '| gone |');
    expect(() => findings(withoutTable, batchCostText, release5Text))
      .toThrow(/doc-coherence refusal: Release 0 table header not found/);
  });

  it('refuses by name when a prose figure it must check cannot be located', () => {
    const withoutProse = docText.replace(/the 325-byte scalar\s+hidden route body/, 'the scalar route body');
    expect(() => findings(withoutProse, batchCostText, release5Text))
      .toThrow(/doc-coherence refusal: could not read "scalar hidden route body"/);
  });

  it('refuses by name rather than checking a subset when the pinned transactions change shape', () => {
    const halved = release5Text.replace(/transactionBytes:\s*3715/, 'transactionBytesRenamed: 3715');
    expect(() => findings(docText, batchCostText, halved))
      .toThrow(/expected exactly 3 pinned transactions .* read 2/s);
  });
});
