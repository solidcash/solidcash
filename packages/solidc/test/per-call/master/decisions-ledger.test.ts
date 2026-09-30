import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The per-call documents' decision ledger, held to its own rules.
 *
 * `docs/per-call/DECISIONS.md` is the one place an item's current status and its authorization live, and the other
 * per-call documents point at its rows instead of restating a decision. That convention is what stops a
 * contradiction from surviving an edit, and it is checkable rather than a promise: a line outside the ledger that
 * names PW3 may not carry a status phrasing the ledger has superseded, each item has exactly one live row, and
 * every `SUPERSEDED-by` names a row that exists.
 *
 * Two exemptions are deliberate. A Log row is dated history by the section's own title, so the Log table
 * (`PLAN_MARKETPLACE_66.md`'s section 7) is not scanned. And a line that quotes a phrasing as a search key -
 * `git log -S "outside PW3"` - is evidence about what the documents used to say rather than a claim about what they
 * say now, so it is left alone.
 */

const DOCS = new URL('../../../../../docs/per-call/', import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, DOCS), 'utf8');
const LEDGER = 'DECISIONS.md';
const CHECKED = ['HANDOFF_PARALLEL.md', 'PLAN_MARKETPLACE_66.md'];
/** Status phrasings the ledger superseded; a line naming PW3 may not carry one outside a pointer. */
const SUPERSEDED = ['stays unticked', 'stays in PW3', 'keeps it in PW3', 'outside PW3', 'stays open for this shape'];

interface LedgerRow {
  readonly id: string;
  readonly item: string;
  readonly status: string;
}

/** The ledger's table rows, in order. */
function ledgerRows(): readonly LedgerRow[] {
  return read(LEDGER).split('\n')
    .filter((line) => /^\| [A-Z]+\d+ \|/.test(line))
    .map((line): LedgerRow => {
      const cells = line.split('|').map((cell) => cell.trim());
      return { id: cells[1]!, item: cells[3]!, status: cells[7] ?? '' };
    });
}

describe('the per-call decision ledger', () => {
  it('gives every item exactly one live row, and every supersession a row that exists', () => {
    const rows = ledgerRows();
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of rows) {
      const superseded = /SUPERSEDED-by ([A-Z]+\d+)/.exec(row.status);
      if (superseded !== null) expect(ids, `${row.id}'s supersession`).toContain(superseded[1]!);
      else expect(row.status, `${row.id}'s status`).toBe('live');
    }
    for (const item of ['PW3', 'PW7']) {
      const live = rows.filter((row) => row.item.includes(item) && row.status === 'live');
      expect(live.map((row) => row.id), `${item}'s live rows`).toHaveLength(1);
    }
    // A live row has to be checkable: provenance is where the answer came from.
    const ledger = read(LEDGER);
    for (const row of rows.filter((candidate) => candidate.status === 'live')) {
      const line = ledger.split('\n').find((candidate) => candidate.startsWith(`| ${row.id} |`))!;
      expect(line.split('|')[6]!.trim(), `${row.id}'s provenance`).not.toBe('');
    }
  });

  it('leaves no superseded status phrasing outside the ledger or a pointer line', () => {
    const offenders: string[] = [];
    for (const name of CHECKED) {
      read(name).split('\n').forEach((line, index) => {
        if (line.startsWith('| ')) return; // the Log is dated history
        if (!line.includes('PW3')) return;
        if (line.includes(LEDGER)) return; // a pointer, not a claim
        if (line.includes('git log -S')) return; // a quoted search key
        const found = SUPERSEDED.filter((phrase) => line.includes(phrase));
        if (found.length > 0) offenders.push(`${name}:${index + 1} ${found.join(', ')}`);
      });
    }
    expect(offenders).toStrictEqual([]);
  });

  it('points every current PW3 status line at a row the ledger carries', () => {
    const ids = new Set(ledgerRows().map((row) => row.id));
    const pointers = CHECKED.flatMap((name) => read(name).split('\n')
      .filter((line) => line.includes('PW3') && line.includes(LEDGER))
      .map((line) => ({ name, line })));
    expect(pointers.length).toBeGreaterThanOrEqual(2);
    for (const pointer of pointers) {
      const cited = [...pointer.line.matchAll(/\b([A-Z]+\d+)\b/g)].map((match) => match[1]!);
      expect(cited.filter((id) => ids.has(id)).length, `${pointer.name}: ${pointer.line.trim()}`)
        .toBeGreaterThanOrEqual(1);
    }
  });
});
