// Exercises src/extension.js against a stubbed vscode API, so the provider wiring and the rendered
// hover markdown are covered without an Extension Development Host.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { createRequire } from 'node:module';
import path from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

class MarkdownString {
  constructor() { this.value = ''; }

  appendCodeblock(code, language) { this.value += `\`\`\`${language}\n${code}\n\`\`\`\n`; return this; }

  appendMarkdown(markdown) { this.value += markdown; return this; }
}

class Position {
  constructor(line, character) { this.line = line; this.character = character; }
}

class Range {
  constructor(startLine, startCharacter, endLine, endCharacter) {
    this.start = new Position(startLine, startCharacter);
    this.end = new Position(endLine, endCharacter);
  }
}

const stub = {
  MarkdownString,
  Position,
  Range,
  Location: class { constructor(uri, range) { this.uri = uri; this.range = range; } },
  Hover: class { constructor(contents, range) { this.contents = contents; this.range = range; } },
  DocumentLink: class { constructor(range, target) { this.range = range; this.target = target; } },
  DocumentSymbol: class {
    constructor(name, detail, kind, range, selectionRange) {
      Object.assign(this, { name, detail, kind, range, selectionRange, children: [] });
    }
  },
  SymbolInformation: class {
    constructor(name, kind, container, location) {
      Object.assign(this, { name, kind, container, location });
    }
  },
  SymbolKind: {
    Class: 4, Interface: 10, Module: 1, Struct: 22, Enum: 9, EnumMember: 19, TypeParameter: 25,
    Event: 23, Function: 11, Method: 5, Field: 7,
  },
  Uri: { file: (file) => ({ fsPath: file, scheme: 'file' }) },
  workspace: {
    textDocuments: [],
    asRelativePath: (file) => path.basename(file),
    findFiles: async () => [],
    onDidDeleteFiles: () => ({ dispose() {} }),
    onDidRenameFiles: () => ({ dispose() {} }),
  },
  languages: {},
};

const providers = new Map();
for (const [event, name] of [
  ['registerHoverProvider', 'hover'],
  ['registerDefinitionProvider', 'definition'],
  ['registerDocumentLinkProvider', 'link'],
  ['registerDocumentSymbolProvider', 'symbol'],
]) {
  stub.languages[event] = (_selector, provider) => {
    providers.set(name, provider);
    return { dispose() {} };
  };
}
stub.languages.registerWorkspaceSymbolProvider = (provider) => {
  providers.set('workspaceSymbol', provider);
  return { dispose() {} };
};

const load = Module._load;
Module._load = function patched(request, parent, isMain) {
  return request === 'vscode' ? stub : load(request, parent, isMain);
};

const extension = require('../src/extension.js');
const subscriptions = [];
extension.activate({ subscriptions });
assert.equal(subscriptions.length, 7, 'every provider and watcher must be registered for disposal');
for (const name of ['hover', 'definition', 'link', 'symbol', 'workspaceSymbol']) {
  assert.ok(providers.get(name), `${name} provider was not registered`);
}

const makeDocument = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const fileLines = source.split('\n');
  return {
    uri: stub.Uri.file(filePath),
    version: 1,
    getText: () => source,
    offsetAt: (position) => fileLines
      .slice(0, position.line)
      .reduce((sum, line) => sum + line.length + 1, 0) + position.character,
    positionAt: (offset) => {
      let remaining = offset;
      for (let line = 0; line < fileLines.length; line += 1) {
        if (remaining <= fileLines[line].length) return new Position(line, remaining);
        remaining -= fileLines[line].length + 1;
      }
      return new Position(fileLines.length - 1, 0);
    },
  };
};

const file = resolve(root, 'test/fixtures/token.scash');
const text = fs.readFileSync(file, 'utf8');
const document = makeDocument(file);

const positionOf = (snippet, word) => {
  const base = text.indexOf(snippet);
  assert.notEqual(base, -1, `Fixture is missing: ${snippet}`);
  return document.positionAt(base + snippet.indexOf(word) + 1);
};
const hoverAt = (snippet, word) => providers.get('hover').provideHover(document, positionOf(snippet, word));
const definitionAt = (snippet, word) => providers.get('definition')
  .provideDefinition(document, positionOf(snippet, word));

// Builtins, globals and units render the documentation entry with its link.
const checkSig = hoverAt('checkSig(signature, owner)', 'checkSig');
assert.match(checkSig.contents.value, /bool checkSig\(sig s, pubkey pk\)/);
assert.match(checkSig.contents.value, /_builtin function_/);
assert.match(checkSig.contents.value, /NULLFAIL/);
assert.match(
  checkSig.contents.value,
  /\[Documentation\]\(https:\/\/solidcash\.org\/docs\/language\/builtin-functions#checksig\)/,
);
assert.match(hoverAt('tx.outputs[0].value', 'value').contents.value, /int tx\.outputs\[i\]\.value/);
assert.match(hoverAt('msg.sender] = available', 'sender').contents.value, /address msg\.sender/);
assert.match(hoverAt('this.age >= 4', 'age').contents.value, /Relative time lock/);
assert.match(hoverAt('4 weeks', 'weeks').contents.value, /_unit_/);
assert.match(hoverAt('assembly { OP_TXVERSION', 'OP_TXVERSION').contents.value, /_opcode_/);
assert.equal(hoverAt('21_000_000', '21_000_000'), undefined, 'a number literal has no hover');

// Declarations render their signature, what they are, where they live, and their doc comment.
const transfer = hoverAt('function transfer(sig', 'transfer');
assert.match(transfer.contents.value, /function transfer\(sig signature, address to, int amount\) public/);
assert.match(transfer.contents.value, /_function in `Token`_/);
assert.match(transfer.contents.value, /Moves `amount` from the caller to `to`\./);
assert.match(hoverAt('int constant MAX_SUPPLY', 'MAX_SUPPLY').contents.value, /_constant state variable in `Token`_/);
assert.match(hoverAt('pubkey owner) is Base', 'owner').contents.value, /_constructor parameter in `Token`_/);
assert.match(hoverAt('holder.weight', 'weight').contents.value, /_struct field in `Holder`_/);

// The hover range covers exactly the token under the cursor.
const balancesHover = hoverAt('this.balances[msg.sender] = available', 'balances');
assert.equal(text.split('\n')[balancesHover.range.start.line].slice(
  balancesHover.range.start.character,
  balancesHover.range.end.character,
), 'balances');
assert.match(
  hoverAt('enumerable mapping(address holder => int amount) balances', 'mapping').contents.value,
  /Verified mapping \(vmap\)/,
);

// Go to definition lands on the declaration name, in this file and across imports.
const [balancesTarget] = definitionAt('this.balances[msg.sender] = available', 'balances');
assert.equal(balancesTarget.uri.fsPath, file);
assert.equal(text.split('\n')[balancesTarget.range.start.line].includes('balances;'), true);

const [settleTarget] = definitionAt('Book(to).settle(receipt)', 'settle');
assert.equal(path.basename(settleTarget.uri.fsPath), 'ledger.scash');
const ledger = fs.readFileSync(settleTarget.uri.fsPath, 'utf8').split('\n');
assert.match(ledger[settleTarget.range.start.line], /function settle/);

const importTarget = definitionAt('import "./math.scash";', 'math');
assert.equal(path.basename(importTarget.uri.fsPath), 'math.scash');
assert.equal(hoverAt('import "./math.scash";', 'math').contents.value.includes('resolves to'), true);
assert.equal(definitionAt('checkSig(signature, owner)', 'checkSig'), undefined, 'builtins have no definition');

// Import paths are clickable links pointing at the resolved files.
const links = providers.get('link').provideDocumentLinks(document);
assert.deepEqual(links.map((link) => path.basename(link.target.fsPath)), [
  'math.scash', 'ledger.scash', 'oracle.scash',
]);
assert.equal(
  text.split('\n')[links[0].range.start.line].slice(links[0].range.start.character, links[0].range.end.character),
  './math.scash',
);

// The outline nests members under their container.
const symbols = providers.get('symbol').provideDocumentSymbols(document);
assert.deepEqual(symbols.map((symbol) => symbol.name), ['Token', 'Base']);
const names = symbols[0].children.map((child) => child.name);
assert.deepEqual(names, [
  'balances', 'totalSupply', 'MAX_SUPPLY', 'Holder', 'Phase', 'Transfer', 'InsufficientBalance',
  'onlyOwner', 'transfer', 'mint',
]);
const holder = symbols[0].children.find((child) => child.name === 'Holder');
assert.deepEqual(holder.children.map((child) => child.name), ['account', 'weight']);
assert.equal(symbols[0].children.find((child) => child.name === 'balances').detail,
  'mapping(address holder => int amount)');

// --- the constructs the coverage check added -----------------------------------------------------------

// `test/fixtures/coverage.scash` compiles with the shipped compiler and exercises the tokens the coverage
// check added: the newly recognized Yul builtins, mapping iteration in all three spellings, the modifier
// placeholder, the `type(T)` expression, units, casts and member operations.
const coverageFile = resolve(root, 'test/fixtures/coverage.scash');
const coverageDocument = makeDocument(coverageFile);
const coverageText = fs.readFileSync(coverageFile, 'utf8');
const coveragePosition = (snippet, word) => {
  const base = coverageText.indexOf(snippet);
  assert.notEqual(base, -1, `Coverage fixture is missing: ${snippet}`);
  assert.notEqual(snippet.indexOf(word), -1, `Coverage snippet does not contain: ${word}`);
  return coverageDocument.positionAt(base + snippet.indexOf(word) + 1);
};
const coverageHover = (snippet, word) => providers.get('hover')
  .provideHover(coverageDocument, coveragePosition(snippet, word));
const coverageDefinition = (snippet, word) => providers.get('definition')
  .provideDefinition(coverageDocument, coveragePosition(snippet, word));

const newTokens = [
  ['let cursor := msize()', 'msize', /msize\(\)/],
  ['mcopy(cursor, 0, 32)', 'mcopy', /mcopy\(dst, src, l\)/],
  ['codecopy(0, 0, 8)', 'codecopy', /codecopy\(dst, p, l\)/],
  ['pop(mload(cursor))', 'pop', /pop\(x\)/],
  ['signextend(0, 0xff)', 'signextend', /signextend\(b, x\)/],
  ['clz(8)', 'clz', /clz\(x\)/],
  ['erc7201("solidcash.registry")', 'erc7201', /erc7201\(namespace\)/],
  ['first := byte(0, word)', 'byte', /byte\(n, x\)/],
  ['{ invalid() }', 'invalid', /invalid\(\)/],
  ['leave first := 9', 'leave', /Returns early from a local Yul function/],
  ['for (int balance of this.balances)', 'of', /for \(int v of this.values\)/],
  ['for (address holder in this.balances)', 'in', /for \(address key in this.balances\)/],
  ['this.balances.entries', 'entries', /this\.balances\.entries/],
  ['require(checkSig(signature, admin));', 'signature', undefined],
  ['int(type(int16).max)', 'type', /type\(IToken\)\.interfaceId/],
  ['= 2 bits;', 'bits', /_unit_/],
  ['= 1 wei;', 'wei', /_unit_/],
  ['int ages = int(4 weeks);', 'weeks', /_unit_/],
  ['unsafe_bytes20(0x00)', 'unsafe_bytes20', /unsafe_bytes20\(x\)/],
  ['new LockingBytecodeP2PKH(hashOfZero)', 'LockingBytecodeP2PKH', /LockingBytecodeP2PKH\(bytes20 pkh\)/],
  // Members the compiler resolves through the generic `'.' Identifier` path.
  ['this.tokens[category].nftCount', 'nftCount', /this\.tokens\[category\]\.nftCount/],
  ['int spent = int(address(this).balance)', 'balance', /address\.balance/],
  ['int lo = type(int16).min', 'min', /type\(T\)\.min/],
  ['int hi = type(uint16).max', 'max', /type\(T\)\.max/],
  ['type(Registry).name', 'name', /type\(C\)\.name/],
  ['sum + int(this.category.length)', 'category', /bytes32 this\.category/],
];
for (const [snippet, word, expected] of newTokens) {
  const hover = coverageHover(snippet, word);
  assert.ok(hover, `${word} has no hover in the coverage fixture`);
  assert.ok(hover.contents.value.includes(word), `${word} hover does not name the token`);
  if (expected) assert.match(hover.contents.value, expected, `${word} hover is missing its signature`);
  assert.match(hover.contents.value, /_[^_]+_/, `${word} hover does not say what it is`);
}
assert.equal(coverageHover('{ invalid() }', 'invalid').contents.value.split('_')[1], 'assembly builtin');
assert.equal(coverageHover('for (int balance of this.balances)', 'of').contents.value.split('_')[1], 'statement');
// The modifier placeholder is documented, and the `deploy` / `delegate` lifecycle modifiers are scoped.
assert.match(coverageHover('        _;', '_').contents.value, /Placeholder inside a modifier body/);
assert.match(coverageHover('modifier checked(sig signature, pubkey admin)', 'modifier').contents.value,
  /A reusable guard inlined into every function that lists it/);

// The UDVT declaration form and its member operations.
assert.match(coverageHover('type Price is int;', 'Price').contents.value, /Price/);
const priceUse = coverageDefinition('Price price = Price.wrap(5)', 'Price');
const priceTarget = Array.isArray(priceUse) ? priceUse[0] : priceUse;
assert.equal(path.basename(priceTarget.uri.fsPath), 'coverage.scash');
assert.match(coverageText.split('\n')[priceTarget.range.start.line], /type Price is int/);

// Go to definition across the import, and the import link, work from the new fixture too.
const addTarget = coverageDefinition('add(this.total, amount)', 'add');
assert.equal(path.basename(addTarget[0].uri.fsPath), 'math.scash');
// An import path yields a single location; a symbol yields the candidate list.
const importPath = coverageDefinition('./math.scash', 'math');
assert.equal(path.basename((Array.isArray(importPath) ? importPath[0] : importPath).uri.fsPath), 'math.scash');
const coverageLinks = providers.get('link').provideDocumentLinks(coverageDocument);
assert.deepEqual(coverageLinks.map((link) => path.basename(link.target.fsPath)), ['math.scash']);
assert.equal(coverageText.split('\n')[coverageLinks[0].range.start.line]
  .slice(coverageLinks[0].range.start.character, coverageLinks[0].range.end.character), './math.scash');

// The outline nests the new members under their container, including the assembly `let` binding.
const coverageSymbols = providers.get('symbol').provideDocumentSymbols(coverageDocument);
assert.deepEqual(coverageSymbols.map((symbol) => symbol.name), ['Price', 'Registry']);
const registryNames = coverageSymbols.find((symbol) => symbol.name === 'Registry').children
  .map((child) => child.name);
for (const name of ['balances', 'total', 'namespace', 'Recorded', 'checked', 'record', 'summarize', 'hash', 'constants']) {
  assert.ok(registryNames.includes(name), `the outline is missing ${name}`);
}

// --- activation and manifest integrity ----------------------------------------------------------------

// Every path the manifest contributes must exist, and activation must register each provider exactly once.
const manifestJson = JSON.parse(fs.readFileSync(resolve(root, 'package.json'), 'utf8'));
for (const manifestPath of [
  manifestJson.main,
  manifestJson.contributes.languages[0].configuration,
  manifestJson.contributes.grammars[0].path,
  ...manifestJson.contributes.snippets.map((snippet) => snippet.path),
]) {
  assert.ok(fs.existsSync(resolve(root, manifestPath)),
    `the manifest references a missing path: ${manifestPath}`);
}
assert.deepEqual([...providers.keys()].sort(),
  ['definition', 'hover', 'link', 'symbol', 'workspaceSymbol'],
  'activation must register every contributed provider');

// --- evidence dump ------------------------------------------------------------------------------------

if (process.env.SOLIDCASH_PROVIDER_DUMP) {
  const dump = [];
  const record = (label, value) => dump.push(`${label}\n${value}\n`);
  for (const [snippet, word] of newTokens) {
    const hover = coverageHover(snippet, word);
    record(`hover ${word}`, hover ? hover.contents.value.trim() : '(none)');
  }
  for (const [snippet, word] of [['add(this.total, amount)', 'add'], ['this.balances[holder] = amount', 'balances']]) {
    const target = coverageDefinition(snippet, word);
    record(`definition ${word}`, target
      ? target.map((entry) => `${path.basename(entry.uri.fsPath)}:${entry.range.start.line}`).join(', ')
      : '(none)');
  }
  record('links', coverageLinks.map((link) => path.basename(link.target.fsPath)).join(', '));
  record('symbols', coverageSymbols.map((symbol) => `${symbol.name}(${symbol.children.map((child) => child.name).join(' ')})`).join(', '));
  fs.writeFileSync(process.env.SOLIDCASH_PROVIDER_DUMP, dump.join('\n'));
  console.log(`Provider dump written to ${process.env.SOLIDCASH_PROVIDER_DUMP}`);
}

extension.deactivate();
console.log('SolidCash VS Code extension providers render hovers, definitions, links and symbols.');
