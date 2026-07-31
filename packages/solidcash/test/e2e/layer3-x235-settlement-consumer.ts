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
const gainedEntries = gained.map((entry) => {
  const digest = digestOf(readFileSync(`${roots[entry.corpus]}/${entry.rel}`, 'utf8'));
  return {
    id: `${entry.corpus}:${entry.rel}::${entry.name}.${entry.handler}`,
    key: `${digest}:${entry.name}.${entry.handler}`,
  };
});
const eligibleIds = new Set(gainedEntries.map(({ id }) => id));
const attributionKeys = new Set(gainedEntries.map(({ key }) => key));
if (eligibleIds.size !== gained.length || attributionKeys.size !== gained.length) {
  throw new Error(
    `X235 refuses ambiguous gained population: gained=${gained.length} canonicalIds=${eligibleIds.size} `
      + `attributionKeys=${attributionKeys.size}`,
  );
}
const gainedKeys = new Map(gainedEntries.map(({ key, id }) => [key, id]));

const requireComplete = process.argv.includes('--require-complete');
const recordPaths = process.argv.slice(2).filter((argument) => argument !== '--require-complete');
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
const malformedSettlements = settlements.flatMap((record, index) => {
  if (!Array.isArray(record.drove)) return [`settlement-${index}:drove-not-array`];
  return record.drove.flatMap((route: any, routeIndex: number) => {
    const errors: string[] = [];
    if (typeof route?.contract !== 'string') errors.push(`settlement-${index}.route-${routeIndex}:contract-not-string`);
    if (typeof route?.sourceDigest !== 'string') errors.push(`settlement-${index}.route-${routeIndex}:sourceDigest-not-string`);
    if (!Array.isArray(route?.handlers) || route.handlers.some((handler: unknown) => typeof handler !== 'string')) {
      errors.push(`settlement-${index}.route-${routeIndex}:handlers-not-string-array`);
    }
    return errors;
  });
});
if (malformedSettlements.length > 0) {
  throw new Error(`X235 refuses malformed settlement evidence: ${malformedSettlements.join(',')}`);
}
const drove = settlements.flatMap((record) => record.drove);
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
  for (const handler of route.handlers) {
    const key = `${route.sourceDigest}:${route.contract}.${handler}`;
    const row = gainedKeys.get(key);
    if (row) proved.add(row);
    else if (gainedByName.has(`${route.contract}.${handler}`)) {
      unmatched.push(`${key} candidates=${gainedByName.get(`${route.contract}.${handler}`)!.join(',')}`);
    }
  }
}

const uniqueUnresolved = [...new Set(unresolved)].sort();
const uniqueUnmatched = [...new Set(unmatched)].sort();
const provedHandlers = [...proved].sort();
const unprovedHandlers = [...eligibleIds].filter((id) => !proved.has(id)).sort();
if (proved.size + unprovedHandlers.length !== eligibleIds.size
  || provedHandlers.some((id) => !eligibleIds.has(id))) {
  throw new Error('X235 settlement population accounting invariant failed');
}

const report = {
  population: { rows: rows.length, gained: gained.length, lost: lost.length },
  observation: {
    files: recordPaths.length,
    records: records.length,
    settlements: settlements.length,
    routes: drove.length,
    collisions: collisions.length,
  },
  settlementProof: {
    eligible: eligibleIds.size,
    proved: proved.size,
    unproved: unprovedHandlers.length,
    eligibleHandlers: [...eligibleIds].sort(),
    provedHandlers,
    unprovedHandlers,
  },
  unresolved: uniqueUnresolved,
  unmatched: uniqueUnmatched,
};
console.log(JSON.stringify(report, null, 2));
if (unresolved.length > 0 || unmatched.length > 0) {
  throw new Error(
    `X235 refuses unresolved settlement attribution: unresolved=${[...new Set(unresolved)].length} `
      + `unmatched=${[...new Set(unmatched)].length}`,
  );
}
if (requireComplete && unprovedHandlers.length > 0) {
  throw new Error(
    `X235 settlement proof incomplete: proved=${proved.size} eligible=${eligibleIds.size} `
      + `unproved=${unprovedHandlers.length}`,
  );
}
