import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import ts from 'typescript';

interface Row {
  corpus: 'eacc' | 'mistswap' | 'sbe';
  rel: string;
  name: string;
  before: string[];
  after: string[];
}

interface Handler {
  key: string;
  corpus: Row['corpus'];
  rel: string;
  contract: string;
  handler: string;
  sourceSha256: string;
  attributionDigest: string;
}

const partitionPath = new URL('./MessageBusRecoveredPartitionX160.test.ts', import.meta.url).pathname;
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
if (!partitionArray) throw new Error('X236 refusal: PARTITION array not found');

const stringOf = (node: ts.Expression | undefined, field: string): string => {
  if (!node || !ts.isStringLiteral(node)) throw new Error(`X236 refusal: ${field} is not a string literal`);
  return node.text;
};
const stringsOf = (node: ts.Expression | undefined, field: string): string[] => {
  if (!node || !ts.isArrayLiteralExpression(node)) throw new Error(`X236 refusal: ${field} is not an array literal`);
  return node.elements.map((element) => stringOf(element as ts.Expression, field));
};
const rows: Row[] = partitionArray.elements.map((element, index) => {
  if (!ts.isObjectLiteralExpression(element)) throw new Error(`X236 refusal: row ${index} is not an object`);
  const fields = new Map(element.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property)) return [];
    return [[property.name.getText(source).replace(/^['"]|['"]$/g, ''), property.initializer] as const];
  }));
  const corpus = stringOf(fields.get('corpus'), `row ${index}.corpus`);
  if (!['eacc', 'mistswap', 'sbe'].includes(corpus)) throw new Error(`X236 refusal: bad corpus ${corpus}`);
  return {
    corpus: corpus as Row['corpus'],
    rel: stringOf(fields.get('rel'), `row ${index}.rel`),
    name: stringOf(fields.get('name'), `row ${index}.name`),
    before: stringsOf(fields.get('before'), `row ${index}.before`),
    after: stringsOf(fields.get('after'), `row ${index}.after`),
  };
});

const roots: Record<Row['corpus'], string> = {
  eacc: process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts',
  mistswap: process.env.MISTSWAP_ROOT ?? '/Code/mistswap/mistswap/contracts',
  sbe: `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`,
};
const sourceCache = new Map<string, { full: string; short: string }>();
const digestFor = (corpus: Row['corpus'], rel: string): { full: string; short: string } => {
  const sourceKey = `${corpus}:${rel}`;
  const cached = sourceCache.get(sourceKey);
  if (cached) return cached;
  const full = createHash('sha256').update(readFileSync(`${roots[corpus]}/${rel}`)).digest('hex');
  const digest = { full, short: full.slice(0, 24) };
  sourceCache.set(sourceKey, digest);
  return digest;
};

const gained: Handler[] = rows.flatMap((row) => row.after.filter((handler) => !row.before.includes(handler))
  .map((handler) => {
    const digest = digestFor(row.corpus, row.rel);
    return {
      key: `${row.corpus}:${row.rel}::${row.name}.${handler}`,
      corpus: row.corpus,
      rel: row.rel,
      contract: row.name,
      handler,
      sourceSha256: digest.full,
      attributionDigest: digest.short,
    };
  }));
const lost = rows.flatMap((row) => row.before.filter((handler) => !row.after.includes(handler)));
if (rows.length !== 135 || gained.length !== 206 || lost.length !== 0) {
  throw new Error(`X236 partition self-check failed: rows=${rows.length} gained=${gained.length} lost=${lost.length}`);
}
if (new Set(gained.map(({ key }) => key)).size !== gained.length) {
  throw new Error('X236 refusal: gained handler identities are not unique');
}

const proofPath = process.argv[2];
if (!proofPath) throw new Error('usage: message-bus-x236-backlog-shards.ts X235_RESULT_JSON [SHARD_ID]');
const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as any;
if (proof.partition?.rows !== 135 || proof.partition?.gained !== 206 || proof.partition?.lost !== 0
  || proof.proved !== 82 || proof.observation?.records !== 1255 || proof.observation?.settlements !== 627
  || proof.observation?.routes !== 108 || proof.observation?.files !== 18) {
  throw new Error('X236 refusal: proof result does not reproduce X235 observation and partition totals');
}
if (!Array.isArray(proof.handlers) || proof.handlers.length !== 82
  || new Set(proof.handlers).size !== proof.handlers.length
  || (proof.unresolved?.length ?? -1) !== 0 || (proof.unmatched?.length ?? -1) !== 0) {
  throw new Error('X236 refusal: proof result is duplicate, unresolved, unmatched, or not exactly 82');
}
const gainedKeys = new Set(gained.map(({ key }) => key));
const foreignProofs = proof.handlers.filter((key: string) => !gainedKeys.has(key));
if (foreignProofs.length > 0) throw new Error(`X236 refusal: proofs outside gained set: ${foreignProofs.join(', ')}`);
const proved = new Set<string>(proof.handlers);
const remaining = gained.filter(({ key }) => !proved.has(key));
if (remaining.length !== 124) throw new Error(`X236 arithmetic refusal: remaining=${remaining.length}, expected 124`);

const bySource = new Map<string, Handler[]>();
for (const handler of remaining) {
  const sourceKey = `${handler.sourceSha256}:${handler.corpus}:${handler.rel}`;
  bySource.set(sourceKey, [...(bySource.get(sourceKey) ?? []), handler]);
}
const shards = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, handlers: [] as Handler[] }));
for (const handlers of [...bySource.values()].sort((a, b) => b.length - a.length || a[0].key.localeCompare(b[0].key))) {
  const shard = [...shards].sort((a, b) => a.handlers.length - b.handlers.length || a.id - b.id)[0];
  shard.handlers.push(...handlers.sort((a, b) => a.key.localeCompare(b.key)));
}
const flattened = shards.flatMap(({ handlers }) => handlers.map(({ key }) => key));
if (flattened.length !== 124 || new Set(flattened).size !== 124
  || flattened.some((key) => proved.has(key) || !gainedKeys.has(key))) {
  throw new Error('X236 refusal: shard union is not the exact unproved complement');
}
const sourceOwners = new Map<string, number>();
for (const shard of shards) for (const handler of shard.handlers) {
  const prior = sourceOwners.get(handler.sourceSha256);
  if (prior !== undefined && prior !== shard.id) throw new Error(`X236 refusal: source split across shards: ${handler.rel}`);
  sourceOwners.set(handler.sourceSha256, shard.id);
}

const requested = process.argv[3] === undefined ? undefined : Number(process.argv[3]);
if (requested !== undefined && (!Number.isInteger(requested) || requested < 1 || requested > shards.length)) {
  throw new Error('X236 refusal: shard id must be an integer from 1 through 8');
}
const selected = requested === undefined ? shards : shards.filter(({ id }) => id === requested);
console.log(JSON.stringify({
  evidence: {
    x235ResultSha256: createHash('sha256').update(readFileSync(proofPath)).digest('hex'),
    partition: { rows: rows.length, gained: gained.length, lost: lost.length },
    proved: proved.size,
    remaining: remaining.length,
  },
  shards: selected.map((shard) => ({
    id: shard.id,
    handlerCount: shard.handlers.length,
    sourceCount: new Set(shard.handlers.map(({ sourceSha256 }) => sourceSha256)).size,
    handlers: shard.handlers,
  })),
}, null, 2));
