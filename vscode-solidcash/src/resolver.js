'use strict';

// Import resolution and symbol lookup across a file's import graph. The host abstracts file access so
// this module stays free of vscode: the extension passes a host that prefers open editor documents,
// tests pass one backed by an in-memory map or plain fs.

const path = require('path');
const scanner = require('./scanner.js');

const MAX_FILES = 200;
const MAX_DEPTH = 24;

// Container kinds whose members are addressable as `Type.member` or through a typed receiver.
const MEMBER_CONTAINERS = new Set(['contract', 'interface', 'library', 'struct', 'enum']);

const TOP_LEVEL_KINDS = new Set([
  'contract', 'interface', 'library', 'struct', 'enum', 'type', 'event', 'error', 'function',
  'modifier', 'stateVariable',
]);

/** Ordered file candidates for an import base path, mirroring the compiler's resolver. */
function candidatesFor(base) {
  if (base.endsWith('.scash')) return [base];
  if (base.endsWith('.sol')) return [base];
  return [`${base}.scash`, `${base}.sol`];
}

/**
 * Resolves an import path the way `packages/solidc/src/compileFile.ts` does: relative to the importing
 * file, then through `node_modules` walking up from it, then as a sibling file.
 */
function resolveImportPath(importPath, fromFile, host) {
  if (!importPath || !fromFile) return undefined;
  const firstExisting = (base) => candidatesFor(base).find((candidate) => host.exists(candidate));
  const fromDir = path.dirname(fromFile);

  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return firstExisting(path.resolve(fromDir, importPath));
  }

  let searchDir = fromDir;
  for (;;) {
    const resolved = firstExisting(path.join(searchDir, 'node_modules', importPath));
    if (resolved) return resolved;
    const parent = path.dirname(searchDir);
    if (parent === searchDir) break;
    searchDir = parent;
  }

  return firstExisting(path.resolve(fromDir, importPath));
}

class Workspace {
  constructor(host) {
    this.host = host;
    this.cache = new Map();
  }

  /** Scans a file, reusing the cached index while the host reports the same version. */
  index(file) {
    if (!file) return undefined;
    const version = this.host.version ? this.host.version(file) : undefined;
    const cached = this.cache.get(file);
    if (cached && cached.version === version && version !== undefined) return cached.index;
    const text = this.host.readFile(file);
    if (text === undefined) {
      this.cache.delete(file);
      return undefined;
    }
    if (cached && cached.text === text) {
      cached.version = version;
      return cached.index;
    }
    const index = scanner.scan(text);
    index.file = file;
    index.positionAt = scanner.createPositionMapper(text);
    this.cache.set(file, { version, text, index });
    return index;
  }

  /** Resolves every import of a file to an absolute path, keeping the binding information. */
  importsOf(index) {
    if (!index) return [];
    if (index.resolvedImports) return index.resolvedImports;
    const resolved = index.imports.map((record) => ({
      ...record,
      file: resolveImportPath(record.path, index.file, this.host),
    }));
    index.resolvedImports = resolved;
    return resolved;
  }

  /**
   * Breadth-first walk of the import graph from `file`. Entry 0 is the root; later entries carry the
   * bindings that made them visible so name lookup can prefer legitimately imported symbols.
   */
  scope(file) {
    const root = this.index(file);
    if (!root) return [];
    const entries = [{ file, index: root, depth: 0, bindings: undefined, namespace: undefined }];
    const seen = new Set([file]);
    for (let i = 0; i < entries.length && entries.length < MAX_FILES; i += 1) {
      const entry = entries[i];
      if (entry.depth >= MAX_DEPTH) continue;
      for (const record of this.importsOf(entry.index)) {
        if (!record.file || seen.has(record.file)) continue;
        const index = this.index(record.file);
        if (!index) continue;
        seen.add(record.file);
        entries.push({
          file: record.file,
          index,
          depth: entry.depth + 1,
          bindings: record.bindings && record.bindings.length ? record.bindings : undefined,
          namespace: record.namespace,
          importedBy: entry.file,
        });
      }
    }
    return entries;
  }
}

function isTopLevel(decl) {
  return !decl.container && TOP_LEVEL_KINDS.has(decl.kind);
}

/** Innermost declaration of one of `kinds` whose range contains `offset`. */
function enclosing(index, offset, kinds) {
  let best;
  for (const decl of index.declarations) {
    if (!kinds.has(decl.kind)) continue;
    if (decl.start > offset || decl.end < offset) continue;
    if (!best || decl.start > best.start) best = decl;
  }
  return best;
}

const CONTAINER_KINDS = new Set(['contract', 'interface', 'library', 'struct']);
const CALLABLE_KINDS = new Set(['function', 'modifier']);

/** Type declaration with `name`, searched across the whole scope. */
function findType(scope, name) {
  if (!name) return undefined;
  for (const entry of scope) {
    for (const decl of entry.index.declarations) {
      if (decl.name === name && MEMBER_CONTAINERS.has(decl.kind)) return { entry, decl };
    }
  }
  return undefined;
}

/** Members of a type, following `is` bases depth-first. */
function membersOf(scope, typeName, name, seen = new Set()) {
  if (!typeName || seen.has(typeName)) return [];
  seen.add(typeName);
  const found = findType(scope, typeName);
  if (!found) return [];
  const results = [];
  for (const entry of scope) {
    for (const decl of entry.index.declarations) {
      if (decl.container !== typeName) continue;
      if (name && decl.name !== name) continue;
      if (decl.kind === 'parameter' || decl.kind === 'local') continue;
      results.push({ file: entry.file, index: entry.index, decl });
    }
  }
  for (const base of found.decl.bases || []) {
    results.push(...membersOf(scope, base, name, seen));
  }
  return results;
}

/** Strips array/mapping decoration to the bare element type name. */
function elementTypeName(type) {
  if (!type) return undefined;
  const mapping = /^mapping\s*\(.*=>\s*([^)]*?)\s*\)$/.exec(type.trim());
  if (mapping) return elementTypeName(mapping[1]);
  return type.replace(/\[[^\]]*\]/g, '').trim().split(/\s+/).pop();
}

function wordAt(text, offset) {
  const isWord = (c) => c !== undefined && /[A-Za-z0-9_$]/.test(c);
  let start = Math.min(Math.max(offset, 0), text.length);
  let end = start;
  while (start > 0 && isWord(text[start - 1])) start -= 1;
  while (end < text.length && isWord(text[end])) end += 1;
  if (start === end) return undefined;
  return { word: text.slice(start, end), start, end };
}

/** Open index of the group whose close bracket sits at `close`, or -1. */
function groupStart(masked, close) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const open = pairs[masked[close]];
  if (!open) return -1;
  let depth = 0;
  for (let i = close; i >= 0; i -= 1) {
    if (masked[i] === masked[close]) depth += 1;
    else if (masked[i] === open) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * The receiver expression immediately left of `start`, when the token there is a member access. Walks
 * back over identifier / call / index segments so `IToken(addr).` and `tx.inputs[0].` both resolve.
 */
function receiverBefore(text, masked, start) {
  let i = start;
  while (i > 0 && /\s/.test(masked[i - 1])) i -= 1;
  if (i === 0 || masked[i - 1] !== '.') return undefined;
  let end = i - 1;
  while (end > 0 && /\s/.test(masked[end - 1])) end -= 1;
  let j = end;
  for (;;) {
    const previous = masked[j - 1];
    if (j > 0 && (previous === ')' || previous === ']')) {
      const open = groupStart(masked, j - 1);
      if (open < 0) break;
      j = open;
      continue;
    }
    if (j > 0 && /[A-Za-z0-9_$]/.test(previous)) {
      while (j > 0 && /[A-Za-z0-9_$]/.test(masked[j - 1])) j -= 1;
      if (j > 0 && masked[j - 1] === '.') { j -= 1; continue; }
      break;
    }
    break;
  }
  if (j >= end) return undefined;
  return { text: text.slice(j, end), start: j, end };
}

/** Normalizes a receiver for documentation lookup: `tx.outputs[n + 1]` becomes `tx.outputs[i]`. */
function normalizeReceiver(receiverText) {
  return receiverText.replace(/\[[^\]]*\]/g, '[i]').replace(/\s+/g, '');
}

/** The import statement containing `offset`, if any. */
function importAt(index, offset) {
  return index.imports.find((record) => offset >= record.start && offset <= record.end);
}

/**
 * Resolves the token at `offset` in `file`: the word itself, its receiver, documentation lookup keys,
 * any import context, and the user declarations it refers to (best candidate first).
 */
function analyze(workspace, file, offset) {
  const index = workspace.index(file);
  if (!index) return undefined;
  const { text, masked } = index;
  const token = wordAt(text, offset);
  const scope = workspace.scope(file);
  const result = {
    file, index, scope, token, declarations: [], docKeys: [],
  };

  const record = importAt(index, offset);
  if (record) {
    result.import = record;
    if (offset >= record.pathStart && offset <= record.pathEnd) {
      result.importPath = record.path;
      result.importFile = resolveImportPath(record.path, file, workspace.host);
      return result;
    }
    const binding = record.bindings.find((entry) => (
      (offset >= entry.nameStart && offset <= entry.nameEnd)
      || (entry.aliasStart !== undefined && offset >= entry.aliasStart && offset <= entry.aliasEnd)
    ));
    if (binding) {
      result.binding = binding;
      const target = resolveImportPath(record.path, file, workspace.host);
      const targetIndex = target ? workspace.index(target) : undefined;
      if (targetIndex) {
        for (const decl of targetIndex.declarations) {
          if (decl.name === binding.name && isTopLevel(decl)) {
            result.declarations.push({ file: target, index: targetIndex, decl });
          }
        }
      }
      return result;
    }
  }

  if (!token) return result;
  result.word = token.word;

  // Inside `assembly { ... }` a name means its Yul builtin first: `revert(p, l)` and `byte(n, x)` are not
  // the Solidity forms. The prefixed key is only offered there, so both meanings stay documented.
  result.inAssembly = (index.assemblyRanges || []).some(
    (range) => offset >= range.start && offset <= range.end,
  );
  if (result.inAssembly) result.docKeys.push(`asm:${token.word}`);

  const receiver = receiverBefore(text, masked, token.start);
  if (receiver) {
    result.receiver = receiver;
    result.dottedKey = `${normalizeReceiver(receiver.text)}.${token.word}`;
    result.docKeys.push(result.dottedKey);
    result.docKeys.push(`.${token.word}`);
  }
  result.docKeys.push(token.word);

  const container = enclosing(index, offset, CONTAINER_KINDS);
  const callable = enclosing(index, offset, CALLABLE_KINDS);
  result.container = container;
  result.callable = callable;

  const push = (candidates) => {
    for (const candidate of candidates) {
      if (!candidate || !candidate.decl) continue;
      const duplicate = result.declarations.some((existing) => (
        existing.file === candidate.file && existing.decl.nameStart === candidate.decl.nameStart
      ));
      if (!duplicate) result.declarations.push(candidate);
    }
  };

  // Locals, function parameters and contract (constructor) parameters whose scope covers the cursor.
  // Innermost-and-latest wins, so a function parameter shadows a same-named contract parameter.
  const localsNamed = (name) => index.declarations.filter((decl) => (
    (decl.kind === 'local' || decl.kind === 'parameter')
    && decl.name === name
    && decl.scopeStart <= offset && decl.scopeEnd >= offset
  )).sort((a, b) => {
    const aDeclared = a.nameStart <= offset ? 0 : 1;
    const bDeclared = b.nameStart <= offset ? 0 : 1;
    if (aDeclared !== bDeclared) return aDeclared - bDeclared;
    return b.nameStart - a.nameStart;
  }).map((decl) => ({ file, index, decl }));

  // `import { Ledger as Book }` makes `Book` a local spelling of `Ledger`; type lookups follow it.
  const aliases = new Map();
  for (const entry of index.imports) {
    for (const binding of entry.bindings) {
      if (binding.alias) aliases.set(binding.alias, binding.name);
    }
  }
  const unalias = (name) => aliases.get(name) || name;

  const declaredTypeOf = (name) => {
    const local = localsNamed(name)[0];
    if (local) return unalias(elementTypeName(local.decl.type));
    if (container) {
      const member = membersOf(scope, container.name, name)
        .find((entry) => entry.decl.kind === 'stateVariable' || entry.decl.kind === 'field');
      if (member) return unalias(elementTypeName(member.decl.type));
    }
    for (const entry of scope) {
      const decl = entry.index.declarations.find((candidate) => (
        candidate.name === name
        && (candidate.kind === 'stateVariable' || candidate.kind === 'field')
      ));
      if (decl) return unalias(elementTypeName(decl.type));
    }
    return undefined;
  };

  // A member access resolves against the receiver's type when that type can be determined.
  if (receiver) {
    const receiverText = receiver.text.trim();
    const bare = new RegExp(`^(${scanner.IDENTIFIER})$`).exec(receiverText);
    const cast = new RegExp(`^(${scanner.IDENTIFIER})\\s*\\(`).exec(receiverText);
    const chained = new RegExp(`^this\\s*\\.\\s*(${scanner.IDENTIFIER})`).exec(receiverText);
    const indexed = new RegExp(`^(${scanner.IDENTIFIER})\\s*\\[`).exec(receiverText);

    let typeName;
    if (receiverText === 'this' && container) typeName = container.name;
    else if (receiverText === 'super' && container) {
      for (const base of container.bases || []) push(membersOf(scope, base, token.word));
    } else if (chained) typeName = declaredTypeOf(chained[1]);
    else if (bare) {
      typeName = findType(scope, unalias(bare[1])) ? unalias(bare[1]) : declaredTypeOf(bare[1]);
    } else if (cast && findType(scope, unalias(cast[1]))) typeName = unalias(cast[1]);
    else if (indexed) typeName = declaredTypeOf(indexed[1]);

    if (typeName) push(membersOf(scope, typeName, token.word));
    result.receiverType = typeName;
  }

  if (!receiver) {
    push(localsNamed(token.word));
    if (container) push(membersOf(scope, container.name, token.word));
    push(index.declarations
      .filter((decl) => decl.name === token.word && isTopLevel(decl))
      .map((decl) => ({ file, index, decl })));

    // Imported names: honour selective bindings and their aliases before falling back to the graph.
    for (const entry of scope.slice(1)) {
      if (entry.bindings) {
        const binding = entry.bindings.find((candidate) => (
          (candidate.alias || candidate.name) === token.word
        ));
        if (!binding) continue;
        push(entry.index.declarations
          .filter((decl) => decl.name === binding.name && isTopLevel(decl))
          .map((decl) => ({ file: entry.file, index: entry.index, decl })));
      } else if (entry.namespace === token.word) {
        result.namespaceFile = entry.file;
      } else if (!entry.namespace) {
        push(entry.index.declarations
          .filter((decl) => decl.name === token.word && isTopLevel(decl))
          .map((decl) => ({ file: entry.file, index: entry.index, decl })));
      }
    }
  }

  // Last resort: any declaration of that name anywhere in the graph, nearest file first.
  if (!result.declarations.length) {
    for (const entry of scope) {
      push(entry.index.declarations
        .filter((decl) => decl.name === token.word && decl.kind !== 'local' && decl.kind !== 'parameter')
        .map((decl) => ({ file: entry.file, index: entry.index, decl })));
    }
  }

  return result;
}

function createWorkspace(host) {
  return new Workspace(host);
}

module.exports = {
  createWorkspace,
  Workspace,
  resolveImportPath,
  candidatesFor,
  analyze,
  membersOf,
  findType,
  enclosing,
  elementTypeName,
  wordAt,
  receiverBefore,
  normalizeReceiver,
  importAt,
  isTopLevel,
  CONTAINER_KINDS,
  CALLABLE_KINDS,
};
