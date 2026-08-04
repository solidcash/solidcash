import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const traversalPath = resolve(dirname(fileURLToPath(import.meta.url)),
  '../src/generation/GenerateTargetTraversal.ts');
const traversalSource = readFileSync(traversalPath, 'utf8');

type Disposition = 'verify-exact-vector' | 'consume-vector-prefix' | 'defer-whole-vector';

interface AuditResult {
  dispositions: Disposition[];
  errors: string[];
}

/** Source-level mutation auditor for the four graph emission producer classes. */
function audit(sourceText: string): AuditResult {
  const source = ts.createSourceFile('GenerateTargetTraversal.ts', sourceText, ts.ScriptTarget.Latest, true);
  const dispositions: Disposition[] = [];
  const errors: string[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'verifyGraphEmissionRow') {
      const verification = node.arguments[4];
      if (!verification || !ts.isObjectLiteralExpression(verification)) {
        errors.push(`line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: `
          + 'emission producer has no explicit verification policy');
      } else {
        const property = verification.properties.find((candidate): candidate is ts.PropertyAssignment =>
          ts.isPropertyAssignment(candidate) && candidate.name.getText(source) === 'disposition');
        if (!property || !ts.isStringLiteral(property.initializer)) {
          errors.push(`line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: `
            + 'emission producer has no literal disposition');
        } else {
          dispositions.push(property.initializer.text as Disposition);
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  if (dispositions.includes('defer-whole-vector')
    && !sourceText.includes('this.verifyDeferredGraphEmissionVector(loc);')) {
    errors.push('deferred emission rows have no whole-vector verifier');
  }
  if (sourceText.includes('compare = false') || sourceText.includes(', false, true')
    || sourceText.includes(', false, false')) {
    errors.push('boolean emission verification convention reintroduced');
  }
  return { dispositions, errors };
}

function removeOccurrence(sourceText: string, policy: string, occurrence: number): string {
  let seen = 0;
  return sourceText.replaceAll(policy, (match) => {
    seen += 1;
    return seen === occurrence ? 'parametersAreCallArguments: true' : match;
  });
}

describe('X206 graph emission verification ownership', () => {
  it('assigns every producer class an explicit verifier and discharges the sole deferred class', () => {
    const result = audit(traversalSource);
    expect(result.errors).toEqual([]);
    expect(result.dispositions.sort()).toEqual([
      'consume-vector-prefix',
      'consume-vector-prefix',
      'consume-vector-prefix',
      'defer-whole-vector',
      'verify-exact-vector',
    ]);
  });

  it.each([
    ['single returning exact-vector producer', "disposition: 'verify-exact-vector'", 1],
    ['single void prefix producer', "disposition: 'consume-vector-prefix'", 1],
    ['multi-row prefix producer', "disposition: 'consume-vector-prefix'", 2],
    ['runtime occurrence prefix producer', "disposition: 'consume-vector-prefix'", 3],
    ['straight runtime deferred producer', "disposition: 'defer-whole-vector'", 1],
  ])('rejects a mutation that removes the %s policy', (_label, policy, occurrence) => {
    const mutated = removeOccurrence(traversalSource, policy, occurrence);
    expect(mutated).not.toBe(traversalSource);
    expect(audit(mutated).errors).toContainEqual(expect.stringContaining('no literal disposition'));
  });

  it('rejects a mutation that drops the whole-vector comparison for deferred rows', () => {
    const mutated = traversalSource.replace('this.verifyDeferredGraphEmissionVector(loc);',
      '/* mutation: verifier omitted */');
    expect(mutated).not.toBe(traversalSource);
    expect(audit(mutated).errors).toContain('deferred emission rows have no whole-vector verifier');
  });
});
