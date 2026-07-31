import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import ts from 'typescript';

const EVIDENCE_COMMIT = '5ef312b5';
const TEST_ROOTS = ['packages/solidcash/test/', 'packages/solidc/test/'];

interface Site {
  key: string;
  file: string;
  fileSha256: string;
  line: number;
  column: number;
  start: number;
  end: number;
  title: string;
  selector: {
    strategy: 'direct-title' | 'parameterized-title' | 'shared-helper-caller';
    fileLine: string;
    titleRegex: string;
    expectedTitleDefinitions: number;
  };
  subject: string;
  subjectSha256: string;
  matcherArguments: string;
  examined: boolean;
}

// These are the 24 non-Layer3 sites named and mutation-proved in X195's
// authoritative report. The other 25 are the complete executable Layer3 set.
const EXAMINED_NON_LAYER3 = new Set([
  'packages/solidcash/test/AddressCompare.test.ts:23',
  'packages/solidcash/test/AddressCompare.test.ts:30',
  'packages/solidcash/test/AddressCompare.test.ts:33',
  'packages/solidcash/test/Contract.test.ts:249',
  'packages/solidcash/test/Payable.test.ts:13',
  'packages/solidcash/test/Payable.test.ts:18',
  'packages/solidcash/test/StatefulTransactionBuilder.test.ts:110',
  'packages/solidcash/test/debugging-old-artifacts.test.ts:41',
  'packages/solidcash/test/e2e/SplitLayoutAgreementX162.test.ts:101',
  'packages/solidcash/test/e2e/Threading.test.ts:257',
  'packages/solidcash/test/util.test.ts:101',
  'packages/solidcash/test/util.test.ts:129',
  'packages/solidcash/test/util.test.ts:146',
  'packages/solidc/test/AddressPayable.test.ts:9',
  'packages/solidc/test/AddressPayable.test.ts:35',
  'packages/solidc/test/CorpusGapFixes.test.ts:2620',
  'packages/solidc/test/CorpusGapFixes.test.ts:2858',
  'packages/solidc/test/LargeContractSplitting.test.ts:238',
  'packages/solidc/test/MixedJournalBoundaryReviewB11.test.ts:115',
  'packages/solidc/test/MixedJournalBoundaryReviewB11.test.ts:123',
  'packages/solidc/test/MixedJournalBoundaryReviewB11.test.ts:130',
  'packages/solidc/test/MixedJournalBoundaryReviewB11.test.ts:137',
  'packages/solidc/test/MixedJournalBoundaryS2.test.ts:349',
  'packages/solidc/test/imports/imports.test.ts:44',
]);

const git = (...args: string[]): string => execFileSync('git', args, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const regexEscape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compact = (text: string): string => text.replace(/\s+/g, ' ').trim();

const files = git('ls-tree', '-r', '--name-only', EVIDENCE_COMMIT, ...TEST_ROOTS)
  .trim().split('\n').filter((file) => /\.test\.ts$/.test(file)).sort();
if (files.length === 0) throw new Error('X237 refusal: authoritative git tree yielded no test files');

const sites: Site[] = [];
for (const file of files) {
  const text = git('show', `${EVIDENCE_COMMIT}:${file}`);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const titleCounts = new Map<string, number>();

  const titleSelector = (node: ts.Node): { title: string; regex: string; strategy: Site['selector']['strategy'] }
  | undefined => {
    for (let current: ts.Node | undefined = node; current; current = current.parent) {
      if (!ts.isCallExpression(current)) continue;
      const callee = current.expression;
      const isTest = ts.isIdentifier(callee) && ['it', 'test'].includes(callee.text);
      const isEach = ts.isCallExpression(callee)
        && ts.isPropertyAccessExpression(callee.expression)
        && ['it', 'test'].includes(callee.expression.expression.getText(source));
      if (!isTest && !isEach) continue;
      const title = current.arguments[0];
      if (title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) {
        return { title: title.text, regex: `^${regexEscape(title.text)}$`, strategy: 'direct-title' };
      }
      if (title && ts.isTemplateExpression(title)) {
        const parts = [regexEscape(title.head.text), ...title.templateSpans.map((span) =>
          `.+${regexEscape(span.literal.text)}`)];
        return {
          title: compact(title.getText(source)),
          regex: `^${parts.join('')}$`,
          strategy: 'parameterized-title',
        };
      }
      return undefined;
    }
    return undefined;
  };
  const helperSelector = (node: ts.Node): { title: string; regex: string; strategy: Site['selector']['strategy'] }
  | undefined => {
    let declaration: ts.VariableDeclaration | undefined;
    let scope: ts.Node | undefined;
    for (let current: ts.Node | undefined = node; current; current = current.parent) {
      if (!declaration && ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) declaration = current;
      if (ts.isCallExpression(current) && ts.isIdentifier(current.expression)
        && current.expression.text === 'describe') {
        scope = current;
        break;
      }
    }
    if (!declaration || !ts.isIdentifier(declaration.name)) return undefined;
    scope ??= source;
    let selected: { title: string; regex: string } | undefined;
    const findCaller = (candidate: ts.Node): void => {
      if (selected) return;
      if (ts.isCallExpression(candidate) && ts.isIdentifier(candidate.expression)
        && candidate.expression.text === declaration!.name.getText(source)
        && candidate.pos > declaration!.end) selected = titleSelector(candidate);
      ts.forEachChild(candidate, findCaller);
    };
    findCaller(scope);
    return selected && { ...selected, strategy: 'shared-helper-caller' };
  };
  const countTitles = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isTest = ts.isIdentifier(callee) && ['it', 'test'].includes(callee.text);
      const isEach = ts.isCallExpression(callee)
        && ts.isPropertyAccessExpression(callee.expression)
        && ['it', 'test'].includes(callee.expression.expression.getText(source));
      const title = node.arguments[0];
      if ((isTest || isEach) && title
        && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) {
        titleCounts.set(title.text, (titleCounts.get(title.text) ?? 0) + 1);
      }
    }
    ts.forEachChild(node, countTitles);
  };
  countTitles(source);

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'toThrow'
      && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.name.text === 'not') {
      // X195's published anchors point at the matcher token (not the beginning
      // of a potentially multi-line expect expression).
      const position = source.getLineAndCharacterOfPosition(node.expression.name.getStart(source));
      const line = position.line + 1;
      const column = position.character + 1;
      const selectedTitle = titleSelector(node) ?? helperSelector(node);
      if (!selectedTitle) throw new Error(`X237 refusal: no runnable selector for ${file}:${line}`);
      const title = selectedTitle.title;
      const expectChain = node.expression.expression.expression;
      let subject: ts.Expression | undefined;
      const findExpect = (candidate: ts.Expression): void => {
        if (ts.isCallExpression(candidate)) {
          if (ts.isIdentifier(candidate.expression) && candidate.expression.text === 'expect') {
            subject = candidate.arguments[0];
            return;
          }
          findExpect(candidate.expression);
        } else if (ts.isPropertyAccessExpression(candidate)) findExpect(candidate.expression);
      };
      findExpect(expectChain);
      if (!subject) throw new Error(`X237 refusal: matcher has no expect subject at ${file}:${line}`);
      const subjectText = compact(subject.getText(source));
      const key = `${file}:${line}:${column}:${sha256(subjectText).slice(0, 16)}`;
      const anchor = `${file}:${line}`;
      sites.push({
        key,
        file,
        fileSha256: sha256(text),
        line,
        column,
        start: node.getStart(source),
        end: node.end,
        title,
        selector: {
          strategy: selectedTitle.strategy,
          fileLine: `${file}:${line}`,
          titleRegex: selectedTitle.regex,
          expectedTitleDefinitions: titleCounts.get(title) ?? 1,
        },
        subject: subjectText,
        subjectSha256: sha256(subjectText),
        matcherArguments: compact(node.arguments.map((argument) => argument.getText(source)).join(', ')),
        examined: file.includes('Layer3') || EXAMINED_NON_LAYER3.has(anchor),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const examined = sites.filter((site) => site.examined);
const remaining = sites.filter((site) => !site.examined);
const observedNonLayer3 = new Set(examined.filter(({ file }) => !file.includes('Layer3'))
  .map(({ file, line }) => `${file}:${line}`));
const missingEvidence = [...EXAMINED_NON_LAYER3].filter((anchor) => !observedNonLayer3.has(anchor));
if (sites.length !== 283 || examined.length !== 49 || remaining.length !== 234 || missingEvidence.length > 0) {
  throw new Error(`X237 census refusal: population=${sites.length} examined=${examined.length} `
    + `remaining=${remaining.length} missingEvidence=${missingEvidence.join(',')}`);
}
if (new Set(sites.map(({ key }) => key)).size !== sites.length) {
  throw new Error('X237 refusal: AST site identities are not unique');
}
for (const site of sites) {
  if (site.selector.expectedTitleDefinitions < 1 || site.selector.titleRegex.length === 0
    || site.selector.titleRegex === '(?!)') {
    throw new Error(`X237 refusal: selector matches no test definition: ${site.key}`);
  }
}

const byFile = new Map<string, Site[]>();
for (const site of remaining) byFile.set(site.file, [...(byFile.get(site.file) ?? []), site]);
const shards = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, sites: [] as Site[] }));
for (const fileSites of [...byFile.values()].sort((a, b) => b.length - a.length || a[0].file.localeCompare(b[0].file))) {
  const shard = [...shards].sort((a, b) => a.sites.length - b.sites.length || a.id - b.id)[0];
  shard.sites.push(...fileSites.sort((a, b) => a.key.localeCompare(b.key)));
}
const flattened = shards.flatMap((shard) => shard.sites);
if (flattened.length !== 234 || new Set(flattened.map(({ key }) => key)).size !== 234
  || flattened.some(({ examined: isExamined }) => isExamined)) {
  throw new Error('X237 refusal: shard union is not the exact unexamined complement');
}
const fileOwners = new Map<string, number>();
for (const shard of shards) for (const site of shard.sites) {
  const prior = fileOwners.get(site.file);
  if (prior !== undefined && prior !== shard.id) throw new Error(`X237 refusal: file split: ${site.file}`);
  fileOwners.set(site.file, shard.id);
}

const requested = process.argv[2] === undefined ? undefined : Number(process.argv[2]);
if (requested !== undefined && (!Number.isInteger(requested) || requested < 1 || requested > 8)) {
  throw new Error('X237 refusal: shard id must be an integer from 1 through 8');
}
console.log(JSON.stringify({
  evidence: {
    commit: git('rev-parse', EVIDENCE_COMMIT).trim(),
    population: sites.length,
    examined: examined.length,
    remaining: remaining.length,
    examinedDigest: sha256(examined.map(({ key }) => key).sort().join('\n')),
    complementDigest: sha256(remaining.map(({ key }) => key).sort().join('\n')),
  },
  shards: shards.filter(({ id }) => requested === undefined || id === requested).map((shard) => ({
    id: shard.id,
    siteCount: shard.sites.length,
    fileCount: new Set(shard.sites.map(({ file }) => file)).size,
    sites: shard.sites,
  })),
}, null, 2));
