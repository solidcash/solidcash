import { readFileSync } from 'fs';
import { binToHex, sha256, utf8ToBin } from '@bitauth/libauth';
import ts from 'typescript';

/** X235 containment-only consumer. Run after the union manifest under vitest.x204.config.ts. */
interface Row {
  corpus: 'eacc' | 'mistswap' | 'sbe';
  rel: string;
  name: string;
  before: string[];
  after: string[];
}

const partitionPath = new URL('./Layer3RecoveredPartitionX160.test.ts', import.meta.url).pathname;
const sourceText = readFileSync(partitionPath, 'utf8');
const source = ts.createSourceFile(partitionPath, sourceText, ts.ScriptTarget.Latest, true);
let partitionArray: ts.ArrayLiteralExpression | undefined;
source.forEachChild((node) => {
  if (!ts.isVariableStatement(node)) return;
  for (const declaration of node.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name) && declaration.name.text === 'PARTITION'
      && declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer)) {
      partitionArray = declaration.initializer;
    }
  }
});
if (!partitionArray) throw new Error('X235: PARTITION array not found');

const stringOf = (node: ts.Expression | undefined, field: string): string => {
  if (!node || !ts.isStringLiteral(node)) throw new Error(`X235: ${field} is not a string literal`);
  return node.text;
};
const stringsOf = (node: ts.Expression | undefined, field: string): string[] => {
  if (!node || !ts.isArrayLiteralExpression(node)) throw new Error(`X235: ${field} is not an array literal`);
  return node.elements.map((element) => stringOf(element as ts.Expression, field));
};
const rows: Row[] = partitionArray.elements.map((element, index) => {
  if (!ts.isObjectLiteralExpression(element)) throw new Error(`X235: row ${index} is not an object literal`);
  const fields = new Map(element.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property)) return [];
    const name = property.name.getText(source).replace(/^['"]|['"]$/g, '');
    return [[name, property.initializer] as const];
  }));
  const corpus = stringOf(fields.get('corpus'), `row ${index}.corpus`);
  if (!['eacc', 'mistswap', 'sbe'].includes(corpus)) throw new Error(`X235: bad corpus '${corpus}'`);
  return {
    corpus: corpus as Row['corpus'],
    rel: stringOf(fields.get('rel'), `row ${index}.rel`),
    name: stringOf(fields.get('name'), `row ${index}.name`),
    before: stringsOf(fields.get('before'), `row ${index}.before`),
    after: stringsOf(fields.get('after'), `row ${index}.after`),
  };
});

const gained = rows.flatMap((row) => row.after
  .filter((handler) => !row.before.includes(handler))
  .map((handler) => ({ ...row, handler })));
const lost = rows.flatMap((row) => row.before.filter((handler) => !row.after.includes(handler)));
if (rows.length !== 135 || gained.length !== 206 || lost.length !== 0) {
  throw new Error(`X235 partition self-check failed: rows=${rows.length} gained=${gained.length} lost=${lost.length}`);
}

const roots: Record<Row['corpus'], string> = {
  eacc: process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts',
  mistswap: process.env.MISTSWAP_ROOT ?? '/Code/mistswap/mistswap/contracts',
  sbe: `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`,
};
const digestOf = (text: string): string => binToHex(sha256.hash(utf8ToBin(text))).slice(0, 24);
const gainedKeys = new Map(gained.map((entry) => {
  const digest = digestOf(readFileSync(`${roots[entry.corpus]}/${entry.rel}`, 'utf8'));
  return [`${digest}:${entry.name}.${entry.handler}`, `${entry.corpus}:${entry.rel}::${entry.name}.${entry.handler}`];
}));

const recordPaths = process.argv.slice(2);
if (recordPaths.length === 1 && recordPaths[0] === '--self-check') {
  console.log(JSON.stringify({ rows: rows.length, gained: gained.length, lost: lost.length }));
  process.exit(0);
}
if (recordPaths.length === 0) throw new Error('X235 refuses an empty record-file list');
const records = recordPaths.flatMap((path) => readFileSync(path, 'utf8').split('\n').filter(Boolean)
  .map((line, index) => {
    try { return JSON.parse(line) as any; } catch { throw new Error(`X235: invalid JSON ${path}:${index + 1}`); }
  }));
const settlements = records.filter((record) => record.kind === 'settled');
if (settlements.length === 0) throw new Error('X235 refuses a run with zero settled transactions');
if (settlements.some((record) => !Array.isArray(record.collisionResolutions))) {
  throw new Error('X235 refuses settlement records without collision-resolution evidence');
}
const badCollisions = settlements.flatMap((record) => record.collisionResolutions ?? [])
  .filter((resolution: any) => resolution.resolutionCardinality !== 1);
if (badCollisions.length > 0) {
  throw new Error(`X235 refuses ambiguous blob collisions: ${JSON.stringify(badCollisions)}`);
}
const drove = settlements.flatMap((record) => record.drove ?? []);
const collisions = settlements.flatMap((record) => record.collisionResolutions);
if (drove.length === 0) throw new Error('X235 refuses a run with zero contained route blobs');

const proved = new Set<string>();
const unresolved: string[] = [];
const unmatched: string[] = [];
const gainedByName = new Map<string, string[]>();
for (const [key, row] of gainedKeys) {
  const name = key.slice(key.indexOf(':') + 1);
  gainedByName.set(name, [...(gainedByName.get(name) ?? []), row]);
}
for (const route of drove) {
  if (typeof route.sourceDigest !== 'string') {
    unresolved.push(`${route.contract}:missing-source-digest`);
    continue;
  }
  for (const handler of route.handlers ?? []) {
    const key = `${route.sourceDigest}:${route.contract}.${handler}`;
    const row = gainedKeys.get(key);
    if (row) proved.add(row);
    else if (gainedByName.has(`${route.contract}.${handler}`)) {
      unmatched.push(`${key} candidates=${gainedByName.get(`${route.contract}.${handler}`)!.join(',')}`);
    }
  }
}

console.log(JSON.stringify({
  partition: { rows: rows.length, gained: gained.length, lost: lost.length },
  observation: {
    files: recordPaths.length,
    records: records.length,
    settlements: settlements.length,
    routes: drove.length,
    collisions: collisions.length,
  },
  proved: proved.size,
  handlers: [...proved].sort(),
  unresolved: [...new Set(unresolved)].sort(),
  unmatched: [...new Set(unmatched)].sort(),
}, null, 2));
