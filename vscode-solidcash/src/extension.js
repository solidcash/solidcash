'use strict';

// Editor features for SolidCash: hover documentation, go-to-definition, clickable import paths, and
// document/workspace symbols. All analysis lives in scanner.js / resolver.js / docs.js; this file is the
// vscode adapter.

const fs = require('fs');
const vscode = require('vscode');
const docs = require('./docs.js');
const resolver = require('./resolver.js');

const SELECTOR = { language: 'solidcash' };
const MAX_WORKSPACE_FILES = 800;
const MAX_WORKSPACE_SYMBOLS = 2000;

const KIND_LABELS = {
  contract: 'contract',
  interface: 'interface',
  library: 'library',
  struct: 'struct',
  enum: 'enum',
  enumMember: 'enum member',
  type: 'user-defined value type',
  event: 'event',
  error: 'error',
  function: 'function',
  modifier: 'modifier',
  stateVariable: 'state variable',
  field: 'struct field',
  parameter: 'parameter',
  local: 'local variable',
};

const SYMBOL_KINDS = () => ({
  contract: vscode.SymbolKind.Class,
  interface: vscode.SymbolKind.Interface,
  library: vscode.SymbolKind.Module,
  struct: vscode.SymbolKind.Struct,
  enum: vscode.SymbolKind.Enum,
  enumMember: vscode.SymbolKind.EnumMember,
  type: vscode.SymbolKind.TypeParameter,
  event: vscode.SymbolKind.Event,
  error: vscode.SymbolKind.Event,
  function: vscode.SymbolKind.Function,
  modifier: vscode.SymbolKind.Method,
  stateVariable: vscode.SymbolKind.Field,
  field: vscode.SymbolKind.Field,
});

function openDocumentFor(file) {
  return vscode.workspace.textDocuments.find((document) => (
    document.uri.scheme === 'file' && document.uri.fsPath === file
  ));
}

// Open editors win over disk so navigation follows unsaved edits.
const host = {
  readFile(file) {
    const open = openDocumentFor(file);
    if (open) return open.getText();
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (error) {
      return undefined;
    }
  },
  exists(file) {
    if (openDocumentFor(file)) return true;
    try {
      return fs.statSync(file).isFile();
    } catch (error) {
      return false;
    }
  },
  version(file) {
    const open = openDocumentFor(file);
    if (open) return `doc:${open.version}`;
    try {
      return `fs:${fs.statSync(file).mtimeMs}`;
    } catch (error) {
      return undefined;
    }
  },
};

const workspace = resolver.createWorkspace(host);

function rangeOf(index, start, end) {
  const from = index.positionAt(start);
  const to = index.positionAt(end);
  return new vscode.Range(from.line, from.character, to.line, to.character);
}

function locationOf(entry) {
  return new vscode.Location(
    vscode.Uri.file(entry.file),
    rangeOf(entry.index, entry.decl.nameStart, entry.decl.nameEnd),
  );
}

function declarationLabel(decl) {
  const label = KIND_LABELS[decl.kind] || decl.kind;
  if (decl.subkind === 'constructor') return 'constructor';
  if (decl.subkind === 'contractParameter') return 'constructor parameter';
  if (decl.subkind === 'fallback' || decl.subkind === 'receive') return `${decl.subkind} function`;
  if (decl.isConstant) return `constant ${label}`;
  return label;
}

function renderDeclaration(entry) {
  const { decl } = entry;
  const markdown = new vscode.MarkdownString();
  markdown.appendCodeblock(decl.signature || decl.name, 'solidcash');
  const container = decl.container ? ` in \`${decl.container}\`` : '';
  markdown.appendMarkdown(`_${declarationLabel(decl)}${container}_`);
  if (decl.doc) markdown.appendMarkdown(`\n\n${decl.doc}`);
  return markdown;
}

function renderEntry(entry) {
  const markdown = new vscode.MarkdownString();
  markdown.appendCodeblock(entry.signature, 'solidcash');
  markdown.appendMarkdown(`_${entry.kind}_\n\n${entry.doc}`);
  if (entry.link) markdown.appendMarkdown(`\n\n[Documentation](${entry.link})`);
  return markdown;
}

const hoverProvider = {
  provideHover(document, position) {
    const context = resolver.analyze(workspace, document.uri.fsPath, document.offsetAt(position));
    if (!context) return undefined;

    if (context.importPath) {
      const markdown = new vscode.MarkdownString();
      markdown.appendCodeblock(`import "${context.importPath}";`, 'solidcash');
      markdown.appendMarkdown(context.importFile
        ? `_resolves to_ \`${vscode.workspace.asRelativePath(context.importFile)}\``
        : '_unresolved import: no matching `.scash` or `.sol` file_');
      return new vscode.Hover(markdown, rangeOf(
        context.index,
        context.import.pathStart,
        context.import.pathEnd,
      ));
    }

    if (!context.token) return undefined;
    const range = rangeOf(context.index, context.token.start, context.token.end);

    // Inside `assembly { ... }` the Yul meaning wins over any same-named Solidity symbol.
    const assembly = context.inAssembly ? docs.lookup(`asm:${context.word}`) : undefined;
    if (assembly) return new vscode.Hover(renderEntry(assembly), range);

    // An exact dotted match (`msg.sender`, `tx.outputs[i].value`) is a language global, not a symbol.
    const dotted = context.dottedKey ? docs.lookup(context.dottedKey) : undefined;
    if (dotted) return new vscode.Hover(renderEntry(dotted), range);

    if (context.declarations.length) {
      return new vscode.Hover(renderDeclaration(context.declarations[0]), range);
    }

    const entry = docs.lookupFirst(context.docKeys);
    if (entry) return new vscode.Hover(renderEntry(entry), range);
    return undefined;
  },
};

const definitionProvider = {
  provideDefinition(document, position) {
    const context = resolver.analyze(workspace, document.uri.fsPath, document.offsetAt(position));
    if (!context) return undefined;

    if (context.importPath) {
      if (!context.importFile) return undefined;
      return new vscode.Location(vscode.Uri.file(context.importFile), new vscode.Position(0, 0));
    }
    if (context.namespaceFile) {
      return new vscode.Location(vscode.Uri.file(context.namespaceFile), new vscode.Position(0, 0));
    }
    if (!context.declarations.length) return undefined;
    return context.declarations.map(locationOf);
  },
};

const documentLinkProvider = {
  provideDocumentLinks(document) {
    const index = workspace.index(document.uri.fsPath);
    if (!index) return [];
    const links = [];
    for (const record of workspace.importsOf(index)) {
      if (!record.file) continue;
      const link = new vscode.DocumentLink(
        rangeOf(index, record.pathStart + 1, record.pathEnd - 1),
        vscode.Uri.file(record.file),
      );
      link.tooltip = vscode.workspace.asRelativePath(record.file);
      links.push(link);
    }
    return links;
  },
};

const documentSymbolProvider = {
  provideDocumentSymbols(document) {
    const index = workspace.index(document.uri.fsPath);
    if (!index) return [];
    const kinds = SYMBOL_KINDS();
    const containers = new Map();
    const roots = [];
    for (const decl of index.declarations) {
      const kind = kinds[decl.kind];
      if (kind === undefined) continue;
      const symbol = new vscode.DocumentSymbol(
        decl.name,
        decl.kind === 'stateVariable' || decl.kind === 'field' ? (decl.type || '') : '',
        kind,
        rangeOf(index, decl.start, decl.end),
        rangeOf(index, decl.nameStart, decl.nameEnd),
      );
      // Declarations arrive outermost-first, so a container is always registered before its members.
      const parent = decl.container ? containers.get(decl.container) : undefined;
      if (parent && parent.decl.start <= decl.start && parent.decl.end >= decl.end) {
        parent.symbol.children.push(symbol);
      } else {
        roots.push(symbol);
      }
      containers.set(decl.name, { decl, symbol });
    }
    return roots;
  },
};

const workspaceSymbolProvider = {
  async provideWorkspaceSymbols(query, token) {
    const files = await vscode.workspace.findFiles('**/*.scash', '**/node_modules/**', MAX_WORKSPACE_FILES);
    const kinds = SYMBOL_KINDS();
    const needle = query.toLowerCase();
    const symbols = [];
    for (const uri of files) {
      if (token.isCancellationRequested || symbols.length >= MAX_WORKSPACE_SYMBOLS) break;
      const index = workspace.index(uri.fsPath);
      if (!index) continue;
      for (const decl of index.declarations) {
        const kind = kinds[decl.kind];
        if (kind === undefined) continue;
        if (needle && !decl.name.toLowerCase().includes(needle)) continue;
        symbols.push(new vscode.SymbolInformation(
          decl.name,
          kind,
          decl.container || '',
          new vscode.Location(uri, rangeOf(index, decl.nameStart, decl.nameEnd)),
        ));
      }
    }
    return symbols;
  },
};

function activate(context) {
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(SELECTOR, hoverProvider),
    vscode.languages.registerDefinitionProvider(SELECTOR, definitionProvider),
    vscode.languages.registerDocumentLinkProvider(SELECTOR, documentLinkProvider),
    vscode.languages.registerDocumentSymbolProvider(SELECTOR, documentSymbolProvider),
    vscode.languages.registerWorkspaceSymbolProvider(workspaceSymbolProvider),
    vscode.workspace.onDidDeleteFiles(() => workspace.cache.clear()),
    vscode.workspace.onDidRenameFiles(() => workspace.cache.clear()),
  );
}

function deactivate() {
  workspace.cache.clear();
}

module.exports = { activate, deactivate };
