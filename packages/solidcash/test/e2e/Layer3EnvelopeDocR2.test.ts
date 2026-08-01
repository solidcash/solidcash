import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import * as layer3 from '../../src/layer3/index.js';
import {
  PRODUCTION_ENVELOPE_RULES, PRODUCTION_ENVELOPE_RULE_IDS,
} from './layer3-production-envelope-r1.js';

/**
 * R2. THE DOCUMENTATION GUARD.
 *
 * WHY THIS FILE EXISTS. This board has recorded a wrong number six separate times, and every one misled a
 * later worker - most sharply when a costed fix for C3 was priced against a figure that had already moved and
 * nobody re-derived the consequence. The sixth was this file's own subject: X65 cut the projection verifier
 * 4,542 -> 4,098 and the assertion below went red, while the document guard beside it stayed green because it
 * was written as a disjunction the stale literal could satisfy. A guard that can be discharged by the defect
 * it guards against is not a guard; see the comment on that assertion. The single largest instance was
 * structural rather than arithmetic:
 * `docs/layer3-production-envelope.md` published a TWELVE-rule envelope for two rounds after X64 measured the
 * twelfth rule out of existence and it was deleted from the harness at `6ab3bc12`. Nothing failed. A document
 * and a source file drifted apart and the only instrument that could have noticed was a human re-reading both.
 *
 * WHAT IT ASSERTS. That the rule table published in the envelope document is the rule table the harness
 * enforces - the ids, in order, with their regimes, scopes, byte-versus-VM split and evidence labels - plus
 * the prose counts derived from it, plus the covenant sizes the documents quote. It parses the document; it
 * does not restate it. A rule added, removed, relabelled or reworded in `PRODUCTION_ENVELOPE_RULES` fails
 * here until the document is updated, and vice versa.
 *
 * WHAT IT DOES NOT ASSERT. Nothing about whether any rule is CORRECT, and nothing about any shape. It holds
 * no `src/` lease and changes no behaviour. It is a consistency check between two artifacts, which is exactly
 * the class of defect it exists to catch.
 */

const docPath = fileURLToPath(new URL('../../../solidc/docs/layer3-production-envelope.md', import.meta.url));
const corpusFitDocPath = fileURLToPath(new URL('../../../solidc/docs/layer3-corpus-fit-f3.md', import.meta.url));
const envelopeDoc = readFileSync(docPath, 'utf8');
const corpusFitDoc = readFileSync(corpusFitDocPath, 'utf8');

interface DocRule {
  id: string;
  regime: string;
  scope: string;
  cost: string;
  evidence: string;
}

/**
 * The rule table is the first markdown table in the document whose header row names `rule id`. Parsing it
 * rather than hardcoding a copy is the whole point: a copy is another thing that can drift.
 */
function parseRuleTable(markdown: string): DocRule[] {
  const lines = markdown.split('\n');
  const header = lines.findIndex((line) => line.startsWith('| rule id |'));
  expect(header, 'the envelope document must publish a `| rule id |` table').toBeGreaterThan(-1);
  const rows: DocRule[] = [];
  for (let index = header + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    expect(cells, `rule table row ${index + 1} must have six cells`).toHaveLength(6);
    rows.push({
      id: cells[0].replace(/`/g, ''),
      regime: cells[1],
      scope: cells[2],
      cost: cells[3],
      evidence: cells[5].replace(/\*/g, ''),
    });
  }
  return rows;
}

const NUMBER_WORDS: Record<number, string> = {
  1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six',
  7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Eleven', 12: 'Twelve',
};

describe('R2: the envelope document states the envelope the harness enforces', () => {
  const docRules = parseRuleTable(envelopeDoc);

  it('MEASURED: the published rule ids are the enforced rule ids, in order', () => {
    expect(docRules.map((rule) => rule.id)).toEqual([...PRODUCTION_ENVELOPE_RULE_IDS]);
    console.log(`[R2] envelope document publishes ${docRules.length} rules; `
      + `PRODUCTION_ENVELOPE_RULES holds ${PRODUCTION_ENVELOPE_RULE_IDS.length}`);
  });

  it('MEASURED: every published regime, scope, cost class and evidence label matches its rule', () => {
    for (const docRule of docRules) {
      const rule = PRODUCTION_ENVELOPE_RULES.find((candidate) => candidate.id === docRule.id);
      expect(rule, `rule \`${docRule.id}\` is published but not enforced`).toBeDefined();
      expect(docRule.regime, `regime of \`${docRule.id}\``).toBe(rule!.regime);
      expect(docRule.scope, `scope of \`${docRule.id}\``).toBe(rule!.scope);
      expect(docRule.cost, `cost class of \`${docRule.id}\``).toBe(rule!.cost === 'vm' ? 'VM' : 'bytes');
      expect(docRule.evidence, `evidence label of \`${docRule.id}\``).toBe(rule!.evidence);
    }
  });

  /**
   * The prose counts are what a reader actually carries away, and they are what went stale. "Twelve rules"
   * and "Seven of the twelve need no VM" both survived the rule's deletion because no instrument read them.
   */
  it('MEASURED: the prose counts are derived from the same rule set as the table', () => {
    const total = PRODUCTION_ENVELOPE_RULE_IDS.length;
    const byteRules = PRODUCTION_ENVELOPE_RULES.filter((rule) => rule.cost === 'bytes').length;
    expect(envelopeDoc).toContain(`${NUMBER_WORDS[total]} rules.`);
    expect(envelopeDoc).toContain(`therefore ${NUMBER_WORDS[total].toLowerCase()} independent rules`);
    expect(envelopeDoc).toContain(`**${NUMBER_WORDS[byteRules]} of the ${NUMBER_WORDS[total].toLowerCase()} need no VM.**`);
    console.log(`[R2] prose counts agree with the rule set: ${total} rules, ${byteRules} decidable from bytes`);
  });

  /**
   * A removed rule may be DISCUSSED - section 6.1 records why it went - but it may never reappear as a live
   * table row. This is the assertion that would have failed for two rounds.
   */
  it('MEASURED: no rule the harness dropped is published as a live rule', () => {
    const dropped = ['standard-output-template'];
    for (const id of dropped) {
      expect(PRODUCTION_ENVELOPE_RULE_IDS, `\`${id}\` is dropped and must not be enforced`).not.toContain(id);
      expect(docRules.map((rule) => rule.id), `\`${id}\` must not be a live table row`).not.toContain(id);
    }
  });

  it('MEASURED: no rule in the envelope is unmeasured, and the document says so', () => {
    const unmeasured = PRODUCTION_ENVELOPE_RULES.filter(
      (rule) => rule.evidence === 'UNMEASURED_CONSERVATIVE',
    );
    expect(unmeasured.map((rule) => rule.id)).toEqual([]);
    expect(envelopeDoc).toContain('**No rule in this envelope is unmeasured.**');
  });
});

describe('R2: the covenant sizes the documents quote are the covenant sizes that compile', () => {
  /**
   * THE LEVERAGED FIGURE. The projection verifier is instantiated once per PARTICIPANT and each proof slot
   * pushes the whole redeem script, so a verifier byte is worth N transaction bytes. That is why F4's
   * 129-byte cut moved C3 by 1,032 and took it from outside the relay ceiling to inside it, and it is why a
   * document quoting a stale value for this number misprices every capstone at once.
   */
  it('MEASURED: the projection verifier compiles to the size both documents publish', () => {
    const artifact = compileString(layer3.generateGraphProjectionVerifier());
    const bytes = artifact.debug.bytecode.length / 2;
    expect(bytes).toBe(5_820);
    // NO DISJUNCTION HERE ANY MORE. This assertion used to read `envelopeDoc.includes(bytes) ||
    // corpusFitDoc.includes('4,542')`, and the second branch is satisfied by the stale literal itself: the
    // guard against a document quoting a superseded size could be discharged by the document quoting the
    // superseded size. X65 cut the verifier 4,542 -> 4,098 and this file went red on the line above while the
    // line below stayed green, which is the wrong way round for a guard. The document must now contain the
    // size that compiles, rendered the way the document renders it.
    const quoted = String(bytes).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    expect(corpusFitDoc, 'layer3-corpus-fit-f3.md must quote the projection verifier size that compiles')
      .toContain(`**${quoted} bytes**`);
    console.log(`[R2] projection verifier redeem script = ${bytes} B, `
      + `quoted as ${quoted} in layer3-corpus-fit-f3.md`);
  });

  /**
   * The controller's size DEPENDS ON ITS ARGUMENT, which is how three different figures for "the controller"
   * came to be in circulation at once. Both are measured here so neither can be quoted without its shape.
   */
  it('MEASURED: the controller size is a function of the target locking bytecode, and both points are pinned', () => {
    const placeholder = compileString(layer3.generateGraphRootController('51'));
    const p2sh32 = compileString(layer3.generateGraphRootController(`aa20${'ab'.repeat(32)}87`));
    const placeholderBytes = placeholder.debug.bytecode.length / 2;
    const p2sh32Bytes = p2sh32.debug.bytecode.length / 2;
    expect(placeholderBytes).toBe(2_810);
    expect(p2sh32Bytes).toBe(2_844);
    // The whole difference is the 34 extra bytes of the p2sh32 locking bytecode over the 1-byte OP_1.
    expect(p2sh32Bytes - placeholderBytes).toBe(35 - 1);
    console.log(`[R2] graph root controller = ${placeholderBytes} B with a 1-byte OP_1 target, `
      + `${p2sh32Bytes} B with a 35-byte p2sh32 target`);
  });
});
