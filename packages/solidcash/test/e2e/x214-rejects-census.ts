import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import ts from 'typescript';

/**
 * X214 static census. Unlike the earlier text grep, this walks the TypeScript AST, so prose and
 * commented examples cannot inflate the executable population.
 *
 * Run from the repository root:
 *   npx tsx packages/solidcash/test/e2e/x214-rejects-census.ts
 */
const files = execFileSync('rg', [
  '--files', 'packages/solidc', 'packages/solidcash', '-g', '*.ts', '-g', '*.tsx', '-g', '*.js',
], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

const sites: Array<{ file: string; line: number }> = [];
for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && node.arguments.length === 0
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'toThrow'
      && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.name.text === 'rejects'
    ) {
      sites.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const partition = sites.reduce<Record<string, number>>((counts, site) => {
  const key = site.file.includes('/test/e2e/') ? 'solidcash/e2e'
    : site.file.includes('/test/') ? 'solidcash/unit' : 'other';
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

// Self-check against the source population measured on 2026-07-31. Fail loudly when it moves.
if (sites.length !== 0 || Object.keys(partition).length !== 0) {
  throw new Error(`X214 census drift: ${sites.length} sites ${JSON.stringify(partition)}`);
}
console.log(JSON.stringify({ total: sites.length, partition, sites }, null, 2));
