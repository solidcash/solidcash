import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

const manifest = await readJson('package.json');
const grammar = await readJson('syntaxes/solidcash.tmLanguage.json');
const configuration = await readJson('language-configuration.json');
await readJson('snippets/solidcash.json');

assert.equal(manifest.contributes.languages[0].id, 'solidcash');
assert.deepEqual(manifest.contributes.languages[0].extensions, ['.scash']);
assert.equal(manifest.contributes.grammars[0].scopeName, 'source.scash');
assert.equal(grammar.scopeName, 'source.scash');
assert.ok(configuration.comments.lineComment);
assert.ok(fsSync.existsSync(resolve(root, manifest.main)), `Missing extension entry point ${manifest.main}`);
assert.ok(manifest.activationEvents.includes('onLanguage:solidcash'));

const repositoryKeys = new Set(Object.keys(grammar.repository));
const visit = (value) => {
  if (Array.isArray(value)) {
    value.forEach(visit);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof value.include === 'string' && value.include.startsWith('#')) {
    assert.ok(repositoryKeys.has(value.include.slice(1)), `Missing include ${value.include}`);
  }
  Object.values(value).forEach(visit);
};
visit(grammar);

const regexes = [];
const collectRegexes = (value) => {
  if (Array.isArray(value)) {
    value.forEach(collectRegexes);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const property of ['match', 'begin', 'end']) {
    if (typeof value[property] === 'string') regexes.push(value[property]);
  }
  Object.values(value).forEach(collectRegexes);
};
collectRegexes(grammar);
regexes.forEach((source) => assert.doesNotThrow(() => new RegExp(source), `Invalid regex: ${source}`));

const matchesRepositoryPattern = (section, token) => grammar.repository[section].patterns
  .some(({ match }) => match && new RegExp(match).test(token));

for (const type of ['pubkey', 'uint256', 'fixed128x18', 'bytes32']) {
  assert.ok(matchesRepositoryPattern('types', type), `Type pattern does not cover ${type}`);
}
for (const builtin of ['checkSig(', 'delegatecall(', 'unsafe_bytes20(', 'keccak256(', 'blockhash(']) {
  assert.ok(matchesRepositoryPattern('builtins', builtin), `Builtin pattern does not cover ${builtin}`);
}
for (const unit of ['satoshis', 'bitcoin', 'days']) {
  assert.ok(matchesRepositoryPattern('constants', unit), `Constant pattern does not cover ${unit}`);
}

// --- documentation database -------------------------------------------------------------------------

const docs = require('../src/docs.js');

// --- assembly grammar and the Yul documentation must describe the same dialect ------------------------

const assemblyRules = grammar.repository['assembly-body'].patterns.filter(({ match }) => match);
const assemblyScope = (token, call) => {
  const probe = call ? `${token}(` : `${token} `;
  const rule = assemblyRules.find(({ match }) => new RegExp(match).test(probe));
  return rule && rule.name;
};

// The assembly block recurses, so a nested Yul `if x { ... }` body keeps assembly scopes.
assert.equal(grammar.repository.assembly.patterns[0].include, '#assembly-body');
assert.equal(grammar.repository['assembly-block'].patterns[0].include, '#assembly-body');

const asmEntries = [...docs.ENTRIES].filter(([name]) => name.startsWith('asm:'));
assert.ok(asmEntries.length > 60, 'the Yul dialect should be documented');
for (const [key, entry] of asmEntries) {
  const token = key.slice(4);
  const scope = assemblyScope(token, true) || assemblyScope(token, false);
  assert.ok(scope, `assembly grammar does not highlight the documented Yul builtin ${token}`);
  if (entry.kind === 'unsupported in assembly') {
    assert.match(scope, /^invalid\./, `rejected builtin ${token} should be scoped invalid, got ${scope}`);
  } else {
    assert.doesNotMatch(scope, /^invalid\./, `supported builtin ${token} is scoped ${scope}`);
  }
}

// And every builtin the grammar names must be documented, so the two lists stay in step.
for (const rule of assemblyRules) {
  if (!/support\.function\.builtin|invalid\.illegal/.test(rule.name)) continue;
  const alternation = /\(\?:([^)]*)\)/.exec(rule.match);
  const tokens = alternation ? alternation[1].split('|') : [rule.match.replace(/\\b/g, '')];
  for (const token of tokens) {
    if (/[[\]*]/.test(token)) continue; // verbatim_* is a family, not a single builtin
    assert.ok(docs.lookup(`asm:${token}`), `grammar highlights ${token} but it has no asm: documentation`);
  }
}

// Yul builtins that share a name with Solidity keep their Solidity highlighting outside assembly.
for (const token of ['address', 'byte', 'return', 'revert', 'not']) {
  assert.ok(docs.lookup(`asm:${token}`), `${token} should be documented as a Yul builtin`);
}

for (const [name, entry] of docs.ENTRIES) {
  assert.ok(entry.signature, `Doc entry ${name} has no signature`);
  // Yul operator builtins are complete in a few words ("x + y."); everything else owes a sentence.
  const minimum = entry.kind === 'assembly builtin' ? 4 : 10;
  assert.ok(entry.doc && entry.doc.length > minimum, `Doc entry ${name} has no description`);
  assert.match(entry.link, /^https:\/\//, `Doc entry ${name} has no link`);
  assert.doesNotMatch(entry.doc, /[^\x00-\x7F]/, `Doc entry ${name} contains non-ascii characters`);
}

const documented = [
  'contract', 'function', 'modifier', 'require', 'emit', 'revert', 'assembly', 'unchecked',
  'mapping', 'enumerable', 'immutable', 'unsafe', 'upgrade', 'deploy', 'split', 'merge',
  'int', 'bytes', 'pubkey', 'sig', 'datasig', 'address', 'uint256', 'bytes20', 'ufixed128x18',
  'checkSig', 'checkDataSig', 'hash160', 'keccak256', 'toPaddedBytes', 'blockhash', 'ecrecover',
  'LockingBytecodeP2SH32', 'unsafe_bytes8',
  'tx.time', 'this.age', 'this.activeInputIndex', 'tx.inputs.length', 'tx.outputs[i].value',
  'tx.inputs[i].tokenCategory', 'msg.sender', 'msg.value', 'block.timestamp', 'block.chainid',
  'abi.encodePacked', 'abi.encodeCall', 'bytes.concat', 'console.log',
  '.lockingBytecode', '.nftCommitment', '.transferNft', '.delegatecall', '.length', '.entries',
  'sats', 'bitcoin', 'weeks', 'OP_CHECKDATASIG', 'OP_UTXOTOKENCATEGORY', 'OP_DEFINE', 'OP_5',
  'OP_PUSHBYTES_33',
];
for (const token of documented) {
  assert.ok(docs.lookup(token), `No documentation for ${token}`);
}
// Integer model: `int`/`uint` are the bounded int256/uint256 aliases, `bigint` is the unbounded VM integer.
// See packages/utils/src/types.ts parseType and packages/solidc/docs/integers.md.
assert.match(docs.lookup('int').signature, /alias of int256/);
assert.match(docs.lookup('int').doc, /Signed 256-bit integer.*overflow-checked/s);
assert.match(docs.lookup('uint').signature, /alias of uint256/);
assert.match(docs.lookup('uint').doc, /Unsigned 256-bit integer.*overflow-checked/s);
assert.match(docs.lookup('bigint').doc, /arbitrary precision, no range check/);
assert.doesNotMatch(docs.lookup('bigint').doc, /alias/, 'bigint is not an alias of int');
assert.match(docs.lookup('uint96').signature, /0 to 2\^96 - 1/);
assert.match(docs.lookup('int16').signature, /-32768 to 32767/, 'narrow widths show exact bounds');
assert.match(docs.lookup('int16').doc, /bound is checked.*unchecked.*3 bytes/s);
// Global functions take the unbounded integer, matching their PrimitiveType.BIGINT declarations.
assert.match(docs.lookup('abs').signature, /^bigint abs\(bigint a\)$/);
assert.match(docs.lookup('within').signature, /^bool within\(bigint x, bigint lower, bigint upper\)$/);
// Introspection integers are bigint; the exceptions carry their real bounded width.
assert.match(docs.lookup('tx.outputs[i].value').signature, /^bigint /);
assert.match(docs.lookup('msg.value').signature, /^bigint /);
assert.match(docs.lookup('.length').signature, /^bigint /);
assert.match(docs.lookup('block.number').signature, /^uint32 /);
assert.match(docs.lookup('block.chainid').signature, /^uint256 /);
assert.match(docs.lookup('tx.gasprice').signature, /^uint32 /);
assert.match(docs.lookup('this.categoryId').signature, /^bytes this\.categoryId$/);
// Entry kinds that state a real signature (as opposed to an illustrative snippet, where `int amount` is
// legitimate user code) must never spell an integer as bare `int`/`uint`: that now means int256/uint256.
for (const [name, entry] of docs.ENTRIES) {
  if (!['builtin function', 'global', 'member'].includes(entry.kind)) continue;
  assert.doesNotMatch(
    entry.signature,
    /(^|[\s(])u?int\s+[A-Za-z_$]/,
    `${name} spells an integer parameter or value as int/uint; use bigint or an explicit width`,
  );
}

// Event model: `emit` creates an event NFT with a 144-block anyone-can-spend cleanup, not an OP_RETURN log.
// See buildEventNftCovenantScript in packages/utils/src/state.ts.
assert.match(docs.lookup('emit').doc, /event NFT output/);
assert.match(docs.lookup('emit').doc, /144-block relative timelock/);
assert.match(docs.lookup('emit').doc, /anyone-can-spend cleanup/);
assert.match(docs.lookup('event').doc, /persists it as a CashToken NFT/);
assert.match(docs.lookup('indexed').doc, /up to three per event/);
assert.match(docs.lookup('anonymous').doc, /shares one address/);
assert.match(docs.lookup('.selector').signature, /bytes32 E\.selector/);
// OP_RETURN only belongs to the null-data constructor and the opcode itself.
for (const [name, entry] of docs.ENTRIES) {
  if (!/OP_RETURN/.test(`${entry.signature} ${entry.doc}`)) continue;
  assert.ok(
    ['LockingBytecodeNullData', 'OP_RETURN'].includes(name),
    `${name} mentions OP_RETURN; events are NFTs, not log outputs`,
  );
}

assert.equal(docs.lookup('uint255'), undefined, 'uint255 is not a valid width');
assert.equal(docs.lookup('bytes33'), undefined, 'bytes33 is not a valid width');
assert.equal(docs.lookup('notAKeyword'), undefined);
assert.equal(docs.lookupFirst(['nope', '.length']).name, '.length');

// Every builtin the compiler registers globally must be documented.
for (const builtin of [
  'abs', 'min', 'max', 'within', 'addmod', 'mulmod', 'ripemd160', 'sha1', 'sha256', 'keccak256',
  'hash160', 'hash256', 'checkSig', 'checkMultiSig', 'checkDataSig', 'ecrecoverPubKey',
  'ecrecoverP2pkh', 'ecrecoverEvm', 'toPaddedBytes', 'intToString', 'stringToInt', 'blockhash',
  'blobhash',
]) {
  assert.equal(docs.lookup(builtin).kind, 'builtin function', `${builtin} is not documented as a builtin`);
}

// --- documentation links ----------------------------------------------------------------------------

// Every link must resolve to a real page and heading in the docs site. Runs against
// SOLIDCASH_DOCS_DIR, or the monorepo's website/docs once it carries the reorganized language tree.
const docsDir = process.env.SOLIDCASH_DOCS_DIR || resolve(root, '../website/docs');
if (fsSync.existsSync(resolve(docsDir, 'language/builtin-functions.md'))) {
  // github-slugger, as docusaurus uses it for heading anchors.
  const slugOf = (heading) => heading.trim().toLowerCase().replace(/[^a-z0-9 _-]/g, '').replace(/\s/g, '-');
  const pages = new Map();
  const collect = (dir) => {
    for (const entry of fsSync.readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) { collect(full); continue; }
      if (!/\.mdx?$/.test(entry.name)) continue;
      const route = `/docs/${full.slice(docsDir.length + 1).replace(/\.mdx?$/, '')}`;
      const anchors = new Set();
      const seen = new Map();
      for (const line of fsSync.readFileSync(full, 'utf8').split('\n')) {
        const heading = /^#{2,6}\s+(.*?)\s*$/.exec(line);
        if (!heading) continue;
        const explicit = /\{#([^}]+)\}\s*$/.exec(heading[1]);
        let id = explicit ? explicit[1] : slugOf(heading[1]);
        const count = seen.get(id) || 0;
        seen.set(id, count + 1);
        if (count) id = `${id}-${count}`;
        anchors.add(id);
      }
      pages.set(route, anchors);
    }
  };
  collect(docsDir);

  for (const [name, entry] of docs.ENTRIES) {
    if (!entry.link.startsWith('https://solidcash.org/')) continue;
    const url = new URL(entry.link);
    const anchors = pages.get(url.pathname.replace(/\/$/, ''));
    assert.ok(anchors, `${name} links to a missing docs page: ${entry.link}`);
    const hash = decodeURIComponent(url.hash.replace(/^#/, ''));
    assert.ok(!hash || anchors.has(hash), `${name} links to a missing heading: ${entry.link}`);
  }
  console.log(`Documentation links resolve against ${docsDir}`);
} else {
  console.log(`Skipping link check: no reorganized docs tree at ${docsDir} (set SOLIDCASH_DOCS_DIR)`);
}

// --- scanner ---------------------------------------------------------------------------------------

const scanner = require('../src/scanner.js');
const fixture = resolve(root, 'test/fixtures/token.scash');
const source = fsSync.readFileSync(fixture, 'utf8');
const index = scanner.scan(source);

const find = (name, kind) => index.declarations.find((decl) => (
  decl.name === name && (!kind || decl.kind === kind)
));

assert.equal(index.imports.length, 3);
assert.equal(index.imports[0].path, './math.scash');
assert.deepEqual(index.imports[1].bindings.map((b) => [b.name, b.alias]), [['Ledger', 'Book'], ['Receipt', undefined]]);
assert.equal(index.imports[2].namespace, 'OracleNs');
assert.equal(source.slice(index.imports[0].pathStart, index.imports[0].pathEnd), '"./math.scash"');

const token = find('Token', 'contract');
assert.ok(token, 'contract Token not found');
assert.deepEqual(token.bases, ['Base']);
assert.equal(token.doc, 'A minimal token used by the navigation tests.');
assert.equal(source.slice(token.nameStart, token.nameEnd), 'Token');

const balances = find('balances', 'stateVariable');
assert.equal(balances.container, 'Token');
assert.equal(balances.type, 'mapping(address holder => int amount)');
assert.deepEqual(balances.modifiers, ['enumerable']);
assert.equal(balances.doc, 'Balance per holder.');

assert.equal(find('totalSupply', 'stateVariable').doc, 'Total minted supply.');
assert.equal(find('MAX_SUPPLY', 'stateVariable').isConstant, true);
assert.equal(find('Holder', 'struct').container, 'Token');
assert.equal(find('weight', 'field').container, 'Holder');
assert.equal(find('Closed', 'enumMember').container, 'Phase');
assert.ok(find('Transfer', 'event'));
assert.ok(find('InsufficientBalance', 'error'));

const transfer = find('transfer', 'function');
assert.equal(transfer.container, 'Token');
assert.deepEqual(transfer.params.map((param) => param.name), ['signature', 'to', 'amount']);
assert.match(transfer.doc, /^Moves `amount`/);
assert.match(transfer.signature, /^function transfer\(sig signature, address to, int amount\) public/);

const onlyOwner = find('onlyOwner', 'modifier');
assert.deepEqual(onlyOwner.params.map((param) => param.name), ['signature']);

const available = find('available', 'local');
assert.equal(available.type, 'int');
assert.equal(available.container, 'transfer');
assert.equal(find('holder', 'local').type, 'Holder');
assert.equal(find('phase', 'local').type, 'Phase');

// Contract header parameters are constructor arguments, in scope for the whole contract.
const ownerParam = find('owner', 'parameter');
assert.equal(ownerParam.subkind, 'contractParameter');
assert.equal(ownerParam.container, 'Token');
assert.equal(ownerParam.scopeEnd, token.end);

// Event parameters back named-argument emits.
assert.equal(find('amount', 'parameter').name, 'amount');
assert.ok(index.declarations.some((decl) => decl.kind === 'parameter' && decl.container === 'Transfer'));

// A data-location keyword between the type and the name does not hide the local.
assert.equal(find('weights', 'local').type, 'int[2]');

// `uint` and `bigint` are type tokens too, so locals declared with them are indexed.
assert.equal(find('minted', 'local').type, 'uint');
assert.equal(find('native', 'local').type, 'bigint');

// Assembly declarations: `let` bindings are locals of the enclosing function.
const scale = find('scale', 'local');
assert.equal(scale.subkind, 'assembly');
assert.equal(scale.container, 'scaled');
assert.equal(source.slice(scale.nameStart, scale.nameEnd), 'scale');

// Comments and strings must not be scanned as code.
const masked = scanner.maskSource('// contract Ghost {}\nint a = "contract Phantom";').masked;
assert.doesNotMatch(masked, /Ghost/);
assert.doesNotMatch(masked, /Phantom/);
assert.equal(scanner.scan('// contract Ghost {}\n').declarations.length, 0);

// An unterminated body still indexes its members.
const partial = scanner.scan('contract Draft() {\n  int counter;\n  function f() public {\n');
assert.ok(partial.declarations.some((decl) => decl.name === 'counter'));

const mapper = scanner.createPositionMapper('a\nbb\nccc');
assert.deepEqual(mapper(0), { line: 0, character: 0 });
assert.deepEqual(mapper(2), { line: 1, character: 0 });
assert.deepEqual(mapper(6), { line: 2, character: 1 });

// --- resolver --------------------------------------------------------------------------------------

const resolver = require('../src/resolver.js');
const host = {
  readFile: (file) => (fsSync.existsSync(file) ? fsSync.readFileSync(file, 'utf8') : undefined),
  exists: (file) => fsSync.existsSync(file) && fsSync.statSync(file).isFile(),
  version: (file) => (fsSync.existsSync(file) ? `fs:${fsSync.statSync(file).mtimeMs}` : undefined),
};
const workspace = resolver.createWorkspace(host);

assert.equal(
  resolver.resolveImportPath('./math.scash', fixture, host),
  resolve(root, 'test/fixtures/math.scash'),
);
assert.equal(
  resolver.resolveImportPath('./ledger', fixture, host),
  resolve(root, 'test/fixtures/ledger.scash'),
  'extensionless imports resolve to .scash',
);
assert.equal(resolver.resolveImportPath('./nothing.scash', fixture, host), undefined);

const scope = workspace.scope(fixture);
assert.deepEqual(
  scope.map((entry) => entry.file.split('/').pop()),
  ['token.scash', 'math.scash', 'ledger.scash', 'oracle.scash'],
);

// Cursor position helper: offset of `word` inside the first occurrence of `snippet`.
const at = (snippet, word) => {
  const base = source.indexOf(snippet);
  assert.notEqual(base, -1, `Fixture is missing: ${snippet}`);
  const offset = snippet.indexOf(word);
  assert.notEqual(offset, -1, `Snippet does not contain: ${word}`);
  return base + offset + 1;
};
const analyzeAt = (snippet, word) => resolver.analyze(workspace, fixture, at(snippet, word));
const basename = (file) => file.split('/').pop();

// A call to an imported free function jumps into the imported file.
const addCall = analyzeAt('add(this.totalSupply, amount)', 'add');
assert.equal(addCall.word, 'add');
assert.equal(addCall.declarations.length >= 1, true);
assert.equal(basename(addCall.declarations[0].file), 'math.scash');
assert.equal(addCall.declarations[0].decl.kind, 'function');

// A library member through an imported library.
const libCall = analyzeAt('SafeMath.sub(amount, 1)', 'sub');
assert.equal(libCall.receiverType, 'SafeMath');
assert.equal(basename(libCall.declarations[0].file), 'math.scash');
assert.equal(libCall.declarations[0].decl.container, 'SafeMath');

// An interface call through an aliased import resolves the interface function in the imported file.
const ifaceCall = analyzeAt('Book(to).settle(receipt)', 'settle');
assert.equal(ifaceCall.receiverType, 'Ledger', 'the import alias Book must resolve to interface Ledger');
assert.equal(basename(ifaceCall.declarations[0].file), 'ledger.scash');
assert.equal(ifaceCall.declarations[0].decl.container, 'Ledger');

// An imported struct used as a local type, and its named-argument field.
assert.equal(basename(analyzeAt('Receipt memory receipt', 'Receipt').declarations[0].file), 'ledger.scash');
assert.equal(analyzeAt('payer: msg.sender', 'payer').declarations[0].decl.kind, 'field');

// Locals, state variables through `this`, struct fields and enum members.
assert.equal(analyzeAt('available - amount', 'available').declarations[0].decl.kind, 'local');
assert.equal(analyzeAt('this.balances[msg.sender] = available', 'balances').declarations[0].decl.kind, 'stateVariable');
assert.equal(analyzeAt('holder.weight', 'weight').declarations[0].decl.kind, 'field');
assert.equal(analyzeAt('Phase.Closed', 'Closed').declarations[0].decl.kind, 'enumMember');
assert.equal(analyzeAt('Holder memory holder', 'Holder').declarations[0].decl.kind, 'struct');
assert.equal(analyzeAt('is Base {', 'Base').declarations[0].decl.kind, 'contract');
assert.equal(analyzeAt('onlyOwner(signature)', 'onlyOwner').declarations[0].decl.kind, 'modifier');
assert.equal(analyzeAt('revert InsufficientBalance', 'InsufficientBalance').declarations[0].decl.kind, 'error');
assert.equal(analyzeAt('emit Transfer(', 'Transfer').declarations[0].decl.kind, 'event');
assert.equal(analyzeAt('checkSig(signature, owner)', 'signature').declarations[0].decl.kind, 'parameter');

// A contract parameter resolves from inside any function of that contract.
const ownerUse = analyzeAt('checkSig(signature, owner)', 'owner');
assert.equal(ownerUse.declarations[0].decl.subkind, 'contractParameter');
assert.equal(ownerUse.declarations[0].decl.nameStart, ownerParam.nameStart);

// A function parameter shadows a same-named contract parameter.
const shadowSource = 'contract C(int a) {\n  function f(int a) public {\n    require(a > 0);\n  }\n}\n';
const shadowFile = resolve(root, 'test/fixtures/shadow.scash');
const shadowHost = {
  readFile: (file) => (file === shadowFile ? shadowSource : host.readFile(file)),
  exists: (file) => file === shadowFile || host.exists(file),
  version: (file) => (file === shadowFile ? 'memory:1' : host.version(file)),
};
const shadowContext = resolver.analyze(
  resolver.createWorkspace(shadowHost),
  shadowFile,
  shadowSource.indexOf('require(a') + 8,
);
assert.equal(shadowContext.declarations[0].decl.container, 'f');

// Assembly `let` bindings resolve from their use site.
assert.equal(analyzeAt('sstore(0, scale)', 'scale').declarations[0].decl.subkind, 'assembly');

// A `uint` local resolves from its use site, and `uint` itself documents as the uint256 alias.
assert.equal(analyzeAt('minted >= native', 'minted').declarations[0].decl.type, 'uint');
assert.equal(docs.lookup(analyzeAt('uint minted = uint(amount)', 'uint').docKeys[0]).name, 'uint');

// An inherited function resolves through the `is` base list.
const inherited = resolver.membersOf(scope, 'Token', 'version');
assert.equal(inherited.length, 1);
assert.equal(inherited[0].decl.container, 'Base');

// Import statements: the quoted path and each binding are navigable.
const pathContext = resolver.analyze(workspace, fixture, source.indexOf('./math.scash') + 2);
assert.equal(pathContext.importPath, './math.scash');
assert.equal(basename(pathContext.importFile), 'math.scash');

const bindingContext = resolver.analyze(workspace, fixture, source.indexOf('Ledger as Book') + 2);
assert.equal(bindingContext.binding.name, 'Ledger');
assert.equal(basename(bindingContext.declarations[0].file), 'ledger.scash');
assert.equal(bindingContext.declarations[0].decl.kind, 'interface');

const aliasContext = resolver.analyze(workspace, fixture, source.indexOf('as Book') + 4);
assert.equal(aliasContext.binding.alias, 'Book');

// Language globals resolve as documentation keys, not symbols.
assert.equal(analyzeAt('msg.sender] = available', 'sender').docKeys[0], 'msg.sender');
assert.equal(analyzeAt('tx.outputs[0].value', 'value').docKeys[0], 'tx.outputs[i].value');
assert.equal(analyzeAt('this.age >= 4', 'age').docKeys[0], 'this.age');
assert.ok(docs.lookup(analyzeAt('tx.outputs[0].value', 'value').docKeys[0]));
assert.deepEqual(analyzeAt('checkSig(signature, owner)', 'checkSig').docKeys, ['checkSig']);
assert.equal(analyzeAt('4 weeks', 'weeks').docKeys[0], 'weeks');
assert.equal(docs.lookupFirst(analyzeAt('OP_TXVERSION', 'OP_TXVERSION').docKeys).kind, 'opcode');

// Inside `assembly { ... }` a name resolves to its Yul meaning first, and to Solidity outside.
const insideAssembly = analyzeAt('sstore(0, scale)', 'sstore');
assert.equal(insideAssembly.inAssembly, true);
assert.equal(insideAssembly.docKeys[0], 'asm:sstore');
assert.equal(docs.lookupFirst(insideAssembly.docKeys).kind, 'assembly builtin');
assert.equal(analyzeAt('revert InsufficientBalance', 'revert').inAssembly, false);
assert.equal(docs.lookup('asm:revert').signature, 'revert(p, l)');
assert.equal(docs.lookup('revert').kind, 'statement');
assert.equal(docs.lookup('asm:create2').kind, 'unsupported in assembly');
assert.match(docs.lookup('asm:create2').doc, /Not supported/);
assert.match(docs.lookup('asm:leave').doc, /Not supported yet/);
assert.equal(docs.lookup('byte').kind, 'type', 'byte keeps its Solidity meaning outside assembly');

// The index is reused while the file is unchanged.
assert.equal(workspace.index(fixture), index !== undefined ? workspace.index(fixture) : undefined);

console.log('SolidCash VS Code extension metadata, grammar, documentation and navigation are valid.');
