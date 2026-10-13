// Cross-checks the extension's two language surfaces - the TextMate grammar and the hover documentation
// database - against the compiler's own definitions, so a construct the compiler knows cannot be missing
// from one of them, and nothing the language lacks stays highlighted or documented.
//
// The compiler is the source of truth:
//   packages/solidc/src/grammar/SolidCash.g4                       keywords, types, units, global properties
//   packages/solidc/src/ast/Globals.ts                             global functions, classes, modifiers
//   packages/solidc/src/ast/AST.ts                                 FunctionModifier
//   packages/solidc/src/semantic/InlineAssemblyDiagnostics.ts      the Yul builtin surface
//   packages/solidc/src/asmStackEffects.ts + semantic/TypeCheckTraversal.ts   the opcode surface
//
// Like the documentation-link check this runs only inside the monorepo checkout; when the compiler sources
// are absent (a published copy of the extension) it reports the skip instead of failing.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const repo = resolve(root, '..');
const solidc = resolve(repo, 'packages/solidc/src');
const read = (path) => fs.readFileSync(resolve(root, path), 'utf8');
const readCompiler = (path) => fs.readFileSync(resolve(solidc, path), 'utf8');

const grammar = JSON.parse(read('syntaxes/solidcash.tmLanguage.json'));
const docs = require('../src/docs.js');

if (!fs.existsSync(resolve(solidc, 'grammar/SolidCash.g4'))) {
  console.log(`Skipping the compiler surface cross-check: no compiler sources at ${solidc}`);
  process.exit(0);
}

// --- compiler surface -------------------------------------------------------------------------------

const g4 = readCompiler('grammar/SolidCash.g4');
const globalsSource = readCompiler('ast/Globals.ts');
const astSource = readCompiler('ast/AST.ts');
const assemblySource = readCompiler('semantic/InlineAssemblyDiagnostics.ts');
const stackEffectsSource = readCompiler('asmStackEffects.ts');
const typeCheckSource = readCompiler('semantic/TypeCheckTraversal.ts');

// The lexer section holds the token families; the parser section above it holds the keyword literals. Both
// `@lexer::members` and `@parser::members` are code blocks that mention Solidity keywords (including the
// `YUL_SOLIDITY_KEYWORDS` set of Solidity words Yul accepts as identifiers), so strip them first - a literal
// only counts as a language keyword when a grammar RULE uses it.
// Strip the `{ ... }` members blocks by brace counting (their bodies contain nested functions and strings
// whose braces defeat a non-greedy regex) so only the grammar RULES contribute keyword literals.
const withoutMembers = (text) => {
  let out = text;
  for (;;) {
    const at = out.search(/@(?:lexer|parser)::members\s*\{/);
    if (at < 0) return out;
    let depth = 0;
    let quote;
    let i = out.indexOf('{', at);
    for (; i < out.length; i += 1) {
      const c = out[i];
      // Comments carry apostrophes and braces of their own; skip them so neither desynchronizes the count.
      if (!quote && c === '/' && out[i + 1] === '/') {
        while (i < out.length && out[i] !== '\n') i += 1;
        continue;
      }
      if (!quote && c === '/' && out[i + 1] === '*') {
        i = out.indexOf('*/', i) + 1;
        continue;
      }
      if (quote) {
        if (c === '\\') i += 1;
        else if (c === quote) quote = undefined;
        continue;
      }
      if (c === "'" || c === '"') { quote = c; continue; }
      if (c === '{') depth += 1;
      else if (c === '}') { depth -= 1; if (depth === 0) break; }
    }
    out = out.slice(0, at) + out.slice(i + 1);
  }
};
const rules = withoutMembers(g4);
const lexerStart = rules.indexOf('\nVersionLiteral');
const lexer = rules.slice(lexerStart);
const parser = rules.slice(0, lexerStart);

const lexerFamily = (name) => {
  const body = new RegExp(`^${name}\\s*\\n?\\s*:\\s*([\\s\\S]*?);`, 'm').exec(lexer);
  assert.ok(body, `SolidCash.g4 no longer defines the ${name} token`);
  return [...body[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
};

const parserKeywords = [...new Set([...parser.matchAll(/'([a-zA-Z_][a-zA-Z_0-9]*(?:\.[a-zA-Z_0-9]+)*)'/g)]
  .map((match) => match[1]))].sort();
// Every literal a parser rule names is a keyword of the language (the members blocks that mention Solidity's
// reserved identifiers are stripped above, so those words do not show up here).
const languageKeywords = parserKeywords;

const literals = lexerFamily('BooleanLiteral');
// The width-carrying primitive families (`bytes`/`byte`, `int`/`uint`, `fixed`/`ufixed`); the width itself is
// generated, so one representative spelling is probed below.
const widthTypes = ['UnboundedBytes', 'BoundedBytes', 'BoundedSignedInt', 'BoundedUnsignedInt',
  'BoundedSignedFixed', 'BoundedUnsignedFixed']
  .flatMap((name) => lexerFamily(name)).filter((word) => word.length > 1);
const types = [
  ...lexerFamily('PrimitiveType'),
  ...lexerFamily('CryptoType'),
  ...widthTypes,
  ...lexerFamily('UnsafeCast').map((name) => name.replace(/Bound\??$/, '')),
];
const units = [...lexerFamily('NumberUnit'), ...lexerFamily('BchUnit')];
const globals = [...lexerFamily('NullaryOp'), ...lexerFamily('TxVar')];
// Member operations: the lexer's own `Dot*` tokens plus the dotted literals the parser rules name
// (`.reverse()`, `.value`, ...). A trailing `()` is the call spelling, not part of the member name.
const grammarMembers = [...new Set([
  ...[...lexer.matchAll(/^Dot\w+\s*:\s*'(\.[A-Za-z]+)'/gm)].map((match) => match[1]),
  ...[...parser.matchAll(/'(\.[A-Za-z_][A-Za-z0-9_.]*)\(?\)?'/g)].map((match) => match[1]),
])];
// Members the compiler resolves through the generic `'.' Identifier` path never appear as a dotted literal in
// the grammar, so derive them from the pass that types them: the token-container field tables, the address
// members, and the type-introspection properties of `visitFieldAccess` / `visitTypeIntrospection`.
// Deriving them here is what keeps a member the compiler adds from being silently undocumented.
const fieldAccessBody = /visitFieldAccess\(node: FieldAccessNode\): Node \{([\s\S]*?)\n  \}/.exec(typeCheckSource)[1];
const containerMembers = [...fieldAccessBody.matchAll(/const valid\w*Fields: Record<string, Type> = \{([\s\S]*?)\n\s*\};/g)]
  .flatMap((match) => [...match[1].matchAll(/^\s*(\w+):/gm)].map((entry) => entry[1]));
const addressMembers = [...fieldAccessBody.matchAll(/&& node\.name === '(\w+)'/g)].map((match) => match[1]);
const introspectionMembers = [...(/visitTypeIntrospection\(node: TypeIntrospectionNode\): Node \{([\s\S]*?)\n  \}/
  .exec(typeCheckSource)[1].matchAll(/node\.property === '(\w+)'/g))].map((match) => match[1]);
const resolvedMembers = [...new Set([...containerMembers, ...addressMembers, ...introspectionMembers])]
  .map((name) => `.${name}`);
const dotOps = [...new Set([...grammarMembers, ...resolvedMembers])];

const enumValues = (name, source = globalsSource) => {
  const body = new RegExp(`export enum ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  assert.ok(body, `no ${name} enum`);
  return [...body[1].matchAll(/=\s*'([^']+)'/g)].map((match) => match[1]);
};
const globalFunctions = enumValues('GlobalFunction');
// Built-in precompile libraries (`BUILTIN_LIBRARIES`): registered as global functions by name.
const builtinLibrariesRoot = resolve(repo, 'packages/utils/src');
const builtinLibraries = [...(/export const BUILTIN_LIBRARIES[^{]*\{([\s\S]*?)\n\};/
  .exec(fs.readFileSync(resolve(builtinLibrariesRoot, 'external-library.ts'), 'utf8'))[1]
  .matchAll(/^  (\w+):\s*\{/gm))].map((match) => match[1]);
const builtinClasses = enumValues('Class');
const storageModifiers = enumValues('Modifier');
const functionModifiers = enumValues('FunctionModifier', astSource);
const allModifiers = [...storageModifiers, ...functionModifiers];

const compilerSet = (name, source = assemblySource) => {
  const body = new RegExp(`const ${name} = new Set(?:<string>)?\\(\\[([\\s\\S]*?)\\]\\)`).exec(source);
  assert.ok(body, `no ${name} in the compiler source`);
  return [...body[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
};
const yulLowerable = compilerSet('LOWERABLE_BUILTINS');
// The low-level call family lowers in statement position (`let ok := call(...)`), which the diagnostics list
// deliberately omits because it names only the builtins that block a block-wide lowering.
const lowerAssemblySource = readCompiler('semantic/LowerInlineAssembly.ts');
const yulStatementCalls = ['call', 'staticcall', 'delegatecall'];
for (const name of yulStatementCalls) {
  assert.ok(lowerAssemblySource.includes(`'${name}'`), `'${name}' is not a Yul builtin the lowerer handles`);
}
const yulSupported = [...new Set([...yulLowerable, ...yulStatementCalls])];
const yulNoEquivalent = [...(/const YUL_NO_BCH_EQUIVALENT[^\n]*= \{([\s\S]*?)\n\};/
  .exec(assemblySource)[1].matchAll(/^\s*(\w+):\s*'/gm))].map((match) => match[1]);
const yulNeedsTypedTarget = [...(/const YUL_NEEDS_TYPED_TARGET[^\n]*= \{([\s\S]*?)\n\};/
  .exec(assemblySource)[1].matchAll(/^\s*(\w+):\s*'/gm))].map((match) => match[1]);
// The diagnostics walker treats a `verbatim*` call as raw bytecode injection; the family is rejected by prefix.
const yulRejected = [...yulNoEquivalent, ...yulNeedsTypedTarget];
// Yul names the lowerer classifies (as non-view, i.e. real builtins it recognises) but does not lower: the
// diagnostic reports these as "not yet lowerable to BCH script" rather than as having no BCH analogue.
const yulClassified = compilerSet('YUL_NON_VIEW_CALLS', lowerAssemblySource);
const yulDiagnosedOnly = yulClassified.filter((name) => !yulSupported.includes(name)
  && !yulRejected.includes(name));

// The assembly opcode surface: the tracked-effect table, the structurally analysed control opcodes, the
// single data-dependent opcode TypeCheckTraversal accepts, and the opcodes it recognises and refuses.
const opcodeEffects = [...new Set([...stackEffectsSource.matchAll(/\[Op\.(OP_[A-Z0-9_]+)\]/g)]
  .map((match) => match[1]))].sort();
const typeCheckSet = (name) => [...new Set([...new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`)
  .exec(typeCheckSource)[1].matchAll(/'(OP_[A-Z0-9_]+)'/g)].map((match) => match[1]))];
const structuredOpcodes = typeCheckSet('structuredOpcodes');
const trackableOpcodes = typeCheckSet('deterministicallyTrackableOpcodes');
const dangerousOpcodes = typeCheckSet('dangerousOpcodes');
const assemblyOpcodes = [...new Set([...opcodeEffects, ...structuredOpcodes, ...trackableOpcodes, ...dangerousOpcodes])].sort();
// Opcodes the compiler itself names (`Op.OP_X`) - the ones it emits and the pushdata family the assembly
// parser accepts alongside the tracked table.
const namedOpcodes = new Set();
{
  const collect = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory()
    ? collect(resolve(dir, entry.name))
    : (entry.name.endsWith('.ts') ? [resolve(dir, entry.name)] : [])));
  for (const file of [...collect(solidc), ...collect(resolve(repo, 'packages/utils/src'))]) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/\bOp\.(OP_[A-Z0-9_]+)\b/g)) {
      namedOpcodes.add(match[1]);
    }
  }
}
const opcodes = [...new Set([...assemblyOpcodes, ...namedOpcodes])].sort();
// The token set the compiler's resolver accepts at all: `Op` is libauth's BCH spec enum, so a name outside it
// is rejected as an unknown opcode before any stack analysis runs.
let bchOpcodes;
try {
  const spec = require('@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js');
  bchOpcodes = new Set(Object.keys(spec.OpcodesBchSpec).filter((key) => key.startsWith('OP_')));
} catch {
  bchOpcodes = undefined;
}

// --- extension surface ------------------------------------------------------------------------------

// TextMate tries the top-level patterns in order, so the first rule whose regex matches a probe decides the
// token's scope. Build that ordered rule list.
const orderedRules = [];
// Word -> the scope of the first rule whose regex names that word literally. This is how a token is
// highlighted: the grammar names the construct in a rule (character classes and escapes are not literals).
const literalScopes = new Map();
const literalWords = (source) => {
  const cleaned = source.replace(/\[[^\]]*\]/g, ' ').replace(/\\[a-zA-Z]/g, ' ');
  // `u?int` / `u?fixed` accept both spellings, so the optional `u` yields a second literal.
  const both = [cleaned, cleaned.replace(/\bu\?/g, 'u')];
  return [...new Set(both.flatMap((text) => [...text.matchAll(/([A-Za-z_][A-Za-z0-9_.]*)/g)]
    .map((match) => match[1])))];
};
const walkRules = (value, inheritedScope, seen) => {
  if (Array.isArray(value)) {
    value.forEach((item) => walkRules(item, inheritedScope, seen));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof value.include === 'string' && value.include.startsWith('#')) {
    const name = value.include.slice(1);
    if (seen.has(name) || !grammar.repository[name]) return;
    walkRules(grammar.repository[name], inheritedScope, new Set([...seen, name]));
    return;
  }
  const captures = ['captures', 'beginCaptures', 'endCaptures']
    .flatMap((key) => (value[key] ? Object.values(value[key]).map((capture) => capture.name) : []))
    .filter(Boolean);
  const scope = value.name || captures[0] || inheritedScope;
  for (const key of ['match', 'begin']) {
    if (typeof value[key] !== 'string') continue;
    orderedRules.push({ regex: value[key], scope });
    for (const word of literalWords(value[key])) {
      if (!literalScopes.has(word)) literalScopes.set(word, scope);
    }
  }
  for (const key of ['patterns', 'end']) {
    if (key === 'patterns' && value.patterns) value.patterns.forEach((item) => walkRules(item, scope, seen));
  }
};
for (const pattern of grammar.patterns) {
  walkRules(pattern, undefined, new Set());
}
const scopeFor = (probe) => {
  for (const rule of orderedRules) {
    if (new RegExp(rule.regex).test(probe)) return rule.scope;
  }
  return undefined;
};
/** The scope a source token gets: the first rule that names it. */
const highlight = (word) => literalScopes.get(word);
// Scope families that mean "the grammar does not actually know this token".
const UNKNOWN_SCOPES = /^(?:$|variable\.other\.property|entity\.name\.function\.call|punctuation)/;

const requiresScope = (word, what) => {
  const scope = highlight(word);
  assert.ok(scope && !UNKNOWN_SCOPES.test(scope),
    `${what} '${word}' is not highlighted by the grammar (scope: ${scope || 'none'})`);
  return scope;
};

// --- deliberate exclusions ---------------------------------------------------------------------------

// Tokens the extension recognizes that are not literal compiler keywords, each with the reason it is part of
// the language. Everything else a surface names must be a construct the compiler defines.
const ACCEPTED = new Map(Object.entries({
  _: 'the modifier placeholder (SolidCash.g4 placeholderStatement)',
  this: 'the contract self reference',
  tx: 'the transaction namespace of the tx.* properties',
  msg: 'the message namespace of the msg.* properties',
  block: 'the block namespace of the block.* properties',
  abi: 'the ABI helper namespace (AbiEncodeNode / AbiDecodeNode)',
  console: 'the console.log debug helper, stripped from production bytecode',
  super: 'inheritance: InheritanceExpansionTransformation resolves super.f()',
  from: 'the `import { A } from "..."` clause',
  is: 'the inheritance clause',
  using: 'the `using L for T` directive',
  for: 'the `using ... for T` directive and for loops',
  global: 'the `using ... for T global` directive',
  function: 'declarations and Yul local functions',
  entries: 'mapping entry iteration (`for (k, v of m.entries)`)',
  of: 'mapping value iteration (`for (v of m)`)',
  in: 'mapping key iteration (`for (k in m)`)',
  now: 'the legacy block.timestamp alias (SynthesizeBlockOracle)',
  hex: 'the HexStringLiteral prefix',
  unicode: 'the UnicodeLiteral prefix',
  date: 'the DateLiteral builtin',
  gasleft: 'the BCH shim lowering to a fixed gas figure (SynthesizeBlockOracle)',
  ecrecover: 'the opt-in EVM alias of ecrecoverEvm/P2pkh/PubKey (compiler.ts)',
  string: 'the string primitive',
  tokens: 'the token-container map, `this.tokens[category]`',
  outState: 'the post-execution state read, `this.outState.<field>`',
  bool: 'the bool primitive',
  address: 'the address primitive',
  bigint: 'the unbounded integer primitive',
  pubkey: 'the public-key primitive',
  sig: 'the signature primitive',
  datasig: 'the data-signature primitive',
  mapping: 'the mapping type constructor',
  payable: 'the payable address/data-location modifier',
}));
// Psdoc tags live in the doc-comment rules, not in the language.
for (const tag of ['title', 'author', 'notice', 'dev', 'param', 'return', 'inheritdoc', 'custom']) {
  ACCEPTED.set(tag, 'a doc-comment annotation tag, not a language token');
}
ACCEPTED.set('verbatim', 'the raw-bytecode family rejected by prefix in InlineAssemblyDiagnostics');

// Every identifier the compiler names in its own sources. Member operations and soft keywords are matched by
// name in the semantic and codegen passes rather than listed in the grammar (`transfer`, `.selector`,
// `outState`, ...), so this is the surface those documented members are checked against.
const compilerTypeScript = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory()
    ? compilerTypeScript(resolve(dir, entry.name))
    : (entry.name.endsWith('.ts') ? [resolve(dir, entry.name)] : [])));
const solidcFiles = compilerTypeScript(solidc);
const compilerIdentifiers = new Set();
for (const file of solidcFiles) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/'([a-z_][A-Za-z0-9_]*)'/g)) {
    compilerIdentifiers.add(match[1]);
  }
}
// Members and properties the semantic and code-generation passes resolve by NAME (`node.name === 'x'`,
// `node.property === 'x'`, `methodName === 'x'`). They share the parser's generic `'.' Identifier` path, so no
// grammar rule names them; this derivation is what keeps one from being silently absent from the database.
const resolvedNames = new Set();
for (const file of solidcFiles.filter((path) => /\/(?:semantic|generation)\//.test(path))) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(
    /(?:node|property|methodName|method)\.(?:name|property|\w*[Nn]ame) === '([a-z][A-Za-z0-9_]*)'/g,
  )) {
    resolvedNames.add(match[1]);
  }
}

// --- 1. every language keyword the parser accepts is highlighted and documented -----------------------

// `entries` is only ever written as a member of a collection (`for (k, v of this.balances.entries)`), so the
// members rule highlights it and no bare-keyword scope exists.
const DOTTED_ONLY = new Set(['entries']);
// Words the parser accepts only through the Yul rules (and, for `leave`, through `anyIdentifier` too, so it
// stays a valid name outside assembly). They are covered by the Yul checks below, not by a Solidity keyword
// scope.
const YUL_ONLY = new Set(['let', 'leave']);
for (const word of languageKeywords) {
  if (YUL_ONLY.has(word)) continue;
  if (DOTTED_ONLY.has(word)) {
    assert.match(scopeFor(`.${word} `) || '', /^variable\.other\.property/,
      `member '${word}' is not highlighted after a dot`);
  } else if (word.includes('.')) {
    // A dotted keyword (`tx.inputs`, `abi.decode`, `console.log`) is highlighted segment by segment: the head
    // by its namespace rule, each member by the trailing `.member` rule.
    const [head, ...members] = word.split('.');
    requiresScope(head, 'namespace');
    for (const member of members) {
      assert.ok(highlight(member) || scopeFor(`.${member} `),
        `keyword '${word}': member '${member}' is not highlighted`);
    }
  } else {
    requiresScope(word, 'keyword');
  }
  assert.ok(docs.lookup(word), `keyword '${word}' has no hover documentation`);
}

// --- 2. types, units, global properties, classes and modifiers ---------------------------------------

const spread = (word) => word.replace(/Bound\??$/, '');
for (const [label, words] of [
  ['type', types],
  ['unit', units],
  ['global property', globals],
]) {
  for (const word of words) {
    const token = spread(word);
    if (!token) continue;
    // Generated families (int<N>, bytes<N>, unsafe_bytes<N>) are probed at a representative width.
    const probe = /int\d+|uint\d+/.test(token) ? token.replace(/\d+/, '8')
      : /^fixed/i.test(token) ? token.replace(/\d+x?\d*/, '128x18')
        : /^bytes\d/.test(token) ? token.replace(/\d+/, '32')
          : /unsafe_bytes$/.test(token) ? `${token}32` : token;
    assert.ok(docs.lookup(probe), `${label} '${probe}' has no hover documentation`);
  }
}
for (const word of [...builtinClasses]) {
  requiresScope(word, 'class');
  assert.ok(docs.lookup(word), `class '${word}' has no hover documentation`);
}
for (const word of [...globalFunctions, ...builtinLibraries]) {
  requiresScope(word, 'global function');
  assert.equal(docs.lookup(word).kind, 'builtin function', `'${word}' is not documented as a builtin`);
}
for (const word of allModifiers) {
  requiresScope(word, 'modifier');
  assert.ok(docs.lookup(word), `modifier '${word}' has no hover documentation`);
}
for (const name of [...resolvedNames].sort()) {
  assert.ok(docs.lookup(`.${name}`) || docs.lookup(name) || docs.lookup(`this.${name}`),
    `the compiler resolves '${name}' by name but the hover database has no entry for it (as '.${name}', `
    + `'${name}' or 'this.${name}')`);
}
for (const word of dotOps) {
  assert.ok(docs.lookup(word), `member operation '${word}' has no hover documentation`);
  // A member is highlighted either by a rule that names it or by the generic `.member` rule, which is how the
  // compiler-resolved members (`.nftCount`, `.balance`, `.min`) reach the editor.
  const scope = highlight(word.slice(1)) || scopeFor(`${word} `);
  assert.ok(scope, `member operation '${word}' is not highlighted`);
}

// --- 3. the Yul surface ------------------------------------------------------------------------------

for (const word of yulSupported) {
  const scope = requiresScope(word, 'Yul builtin');
  assert.doesNotMatch(scope, /^invalid\./, `Yul builtin '${word}' is highlighted as invalid`);
  assert.ok(docs.lookup(`asm:${word}`), `Yul builtin '${word}' has no asm: documentation`);
  assert.notEqual(docs.lookup(`asm:${word}`).kind, 'unsupported in assembly',
    `Yul builtin '${word}' is lowered by the compiler but documented as unsupported`);
}
for (const word of [...yulRejected, ...yulDiagnosedOnly, 'verbatim']) {
  const scope = requiresScope(word, 'rejected Yul builtin');
  assert.match(scope, /^invalid\./, `rejected Yul builtin '${word}' is not scoped invalid`);
  const entry = docs.lookup(`asm:${word}`);
  assert.ok(entry, `rejected Yul builtin '${word}' has no asm: documentation`);
  assert.equal(entry.kind, 'unsupported in assembly', `rejected Yul builtin '${word}' is documented as supported`);
}
for (const word of ['let', 'function', 'if', 'switch', 'case', 'default', 'for', 'break', 'continue', 'leave']) {
  requiresScope(word, 'Yul control keyword');
}

// --- 4. the opcode surface ---------------------------------------------------------------------------

for (const word of assemblyOpcodes) {
  const entry = docs.lookup(word);
  assert.ok(entry, `opcode '${word}' has no hover documentation`);
  assert.equal(entry.kind, 'opcode', `'${word}' is documented as ${entry.kind}, not an opcode`);
  // The grammar highlights the whole `OP_*` family with one rule (the surface changes with BCH upgrades), so
  // the token is matched, not named literally.
  assert.match(scopeFor(`OP_${word.slice(3)} `) || scopeFor(`${word} `) || '',
    /^support\.function\.opcode/, `opcode '${word}' is not highlighted`);
}
for (const width of [1, 33, 75]) {
  assert.equal(docs.lookup(`OP_PUSHBYTES_${width}`).kind, 'opcode', `OP_PUSHBYTES_${width} is undocumented`);
  assert.match(scopeFor(`OP_PUSHBYTES_${width} `) || '', /^support\.function\.opcode/,
    'the pushdata opcodes are not highlighted');
}

// --- 5. the reverse direction: nothing highlighted or documented that the language lacks -------------

const known = new Set([
  ...languageKeywords, ...types, ...units, ...globals, ...literals, ...dotOps.map((dot) => dot.slice(1)),
  ...globalFunctions, ...builtinLibraries, ...builtinClasses, ...allModifiers,
  ...yulSupported, ...yulRejected, 'verbatim', 'let', 'function', 'if', 'switch', 'case', 'default', 'for',
  'break', 'continue', 'leave', 'if', 'else', 'while', 'do', 'try', 'catch', 'return', 'returns', 'revert',
  'throw', 'require', 'assert', 'emit', 'delete', 'unchecked', 'new', 'import', 'as', 'abstract', 'interface',
  'library', 'struct', 'enum', 'type', 'error', 'event', 'constructor', 'fallback', 'receive', 'modifier',
  'contract', 'pragma', 'solidity', 'solidcash', 'anonymous', 'indexed', 'override', 'virtual', 'constant',
  'immutable', 'transient', 'memory', 'storage', 'calldata', 'packed', 'enumerable', 'unsafe', 'upgrade',
  'selfdestruct', 'deploy', 'split', 'merge', 'delegate', ...opcodes,
  ...Object.keys(docs.ENTRIES).filter((key) => key.startsWith('OP_')).map((key) => key),
]);

for (const [key] of docs.ENTRIES) {
  if (key.startsWith('asm:')) {
    const name = key.slice(4);
    const knownYul = new Set([...yulSupported, ...yulRejected, ...yulDiagnosedOnly,
      'verbatim', 'let', 'function', 'leave']);
    assert.ok(knownYul.has(name), `documented Yul builtin '${name}' is not in the compiler's Yul surface`);
    continue;
  }
  if (key.startsWith('OP_')) {
    if (/^OP_PUSHBYTES_\d+$/.test(key)) continue;
    assert.ok(bchOpcodes ? bchOpcodes.has(key) : opcodes.includes(key),
      `documented opcode '${key}' is not an opcode the compiler resolves`);
    continue;
  }
  const head = key.split('.').pop().split('[')[0].split('(')[0];
  assert.ok(known.has(key) || ACCEPTED.has(key) || known.has(head) || ACCEPTED.has(head)
  || compilerIdentifiers.has(head),
  `documented '${key}' (head '${head}') is not a compiler construct and has no recorded reason`);
}

// Every word the grammar scopes as a keyword / support token must be a compiler construct or recorded.
const scopedWords = new Set();
for (const rule of orderedRules) {
  if (!rule.scope) continue;
  if (!/^(?:keyword|support|storage|constant\.language|variable\.language)/.test(rule.scope)) continue;
  const cleaned = rule.regex.replace(/\[[^\]]*\]/g, ' ').replace(/\\./g, ' ')
    .replace(/\(\?:/g, ' ').replace(/\|\?/g, ' ');
  for (const match of cleaned.matchAll(/([A-Za-z_][A-Za-z0-9_]*)/g)) scopedWords.add(match[1]);
}
// The member half of a documented dotted construct (`abi.encode`, `bytes.concat`, `tx.inputs`) is scoped by the
// grammar on its own, so it is accepted when a documented key ends with it.
const documentedMembers = new Set([...docs.ENTRIES.keys()].filter((key) => key.includes('.'))
  .map((key) => key.split('.').pop().split('[')[0].split('(')[0]));
const unknown = [...scopedWords].sort().filter((word) => word !== 'OP' && !word.startsWith('OP_')
  && (word.length >= 2 || word === '_')
  && !known.has(word) && !ACCEPTED.has(word) && !compilerIdentifiers.has(word)
  && !documentedMembers.has(word));
assert.deepEqual(unknown, [],
  `the grammar scopes these words, but they are not compiler constructs and have no recorded reason: ${
    unknown.join(', ')}`);

console.log(
  'SolidCash extension coverage: '
  + `${languageKeywords.length} keywords, ${builtinLibraries.length} builtin libraries, `
  + `${globalFunctions.length} global functions, ${builtinClasses.length} classes, ${allModifiers.length} modifiers, `
  + `${units.length} units, ${globals.length} global properties, `
  + `${dotOps.length} members + ${resolvedNames.size} name-resolved properties, `
  + `${yulSupported.length} Yul builtins + ${yulRejected.length + yulDiagnosedOnly.length} rejected, `
  + `${assemblyOpcodes.length} opcodes `
  + '- all highlighted and documented.',
);
