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

const file = resolve(root, 'test/fixtures/token.scash');
const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');
const document = {
  uri: stub.Uri.file(file),
  version: 1,
  getText: () => text,
  offsetAt: (position) => lines
    .slice(0, position.line)
    .reduce((sum, line) => sum + line.length + 1, 0) + position.character,
  positionAt: (offset) => {
    let remaining = offset;
    for (let line = 0; line < lines.length; line += 1) {
      if (remaining <= lines[line].length) return new Position(line, remaining);
      remaining -= lines[line].length + 1;
    }
    return new Position(lines.length - 1, 0);
  },
};

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

extension.deactivate();
console.log('SolidCash VS Code extension providers render hovers, definitions, links and symbols.');
