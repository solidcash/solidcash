'use strict';

// A tolerant scanner for `.scash` (and ported `.sol`) sources. It is deliberately not the real parser:
// navigation must keep working while a file is mid-edit, so this walks masked text (comments and string
// bodies blanked out) and splits declarations on brace/semicolon boundaries.
//
// Everything here is pure: input text in, offsets out. The extension maps offsets to vscode Positions.

// `int` / `uint` are the int256 / uint256 aliases; `bigint` is the unbounded native integer.
const PRIMITIVE_TYPES = new Set([
  'int', 'uint', 'bigint', 'bool', 'string', 'bytes', 'byte', 'address', 'pubkey', 'sig', 'datasig',
  'fixed', 'ufixed', 'var',
]);

const PARAMETRIC_TYPE = /^(?:u?int\d+|bytes\d+|u?fixed\d+x\d+)$/;

// Words that may sit between a type and a name, or decorate a declaration.
const DECL_MODIFIERS = new Set([
  'public', 'private', 'internal', 'external', 'constant', 'immutable', 'transient', 'memory',
  'calldata', 'storage', 'packed', 'enumerable', 'indexed', 'payable', 'override', 'virtual',
  'pure', 'view', 'anonymous', 'unsafe', 'upgrade', 'selfdestruct', 'deploy', 'split', 'merge',
]);

// Leading words that mean a chunk is a statement, not a declaration.
const STATEMENT_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return',
  'require', 'assert', 'revert', 'emit', 'delete', 'unchecked', 'assembly', 'try', 'catch', 'new',
  'console', 'this', 'super', 'let', 'leave',
]);

const CONTAINER_KEYWORDS = new Set(['contract', 'interface', 'library']);

const IDENTIFIER = '[A-Za-z_$][A-Za-z0-9_$]*';
// Bounded so a directive missing its `;` (mid-edit) cannot blank the rest of the file.
const STATEMENT_DIRECTIVE = /\b(import|pragma|using)\b[^;]{0,500}?;/g;

function isTypeToken(token, knownTypes) {
  if (!token) return false;
  if (PRIMITIVE_TYPES.has(token) || PARAMETRIC_TYPE.test(token)) return true;
  return knownTypes ? knownTypes.has(token) : false;
}

/**
 * Blanks comments and string bodies so structural scans cannot trip over them. Offsets and line
 * breaks are preserved, so any index into the result is also valid in the source.
 */
function maskSource(text) {
  const out = new Array(text.length);
  const comments = [];
  const strings = [];
  let i = 0;
  while (i < text.length) {
    const two = text.substr(i, 2);
    if (two === '//') {
      const start = i;
      while (i < text.length && text[i] !== '\n') { out[i] = ' '; i += 1; }
      comments.push({ start, end: i, text: text.slice(start, i) });
      continue;
    }
    if (two === '/*') {
      const start = i;
      out[i] = ' '; out[i + 1] = ' ';
      i += 2;
      while (i < text.length && text.substr(i, 2) !== '*/') {
        out[i] = text[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < text.length) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      comments.push({ start, end: i, text: text.slice(start, i) });
      continue;
    }
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i];
      const start = i;
      out[i] = ' ';
      i += 1;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') { out[i] = ' '; i += 1; if (i >= text.length) break; }
        if (text[i] === '\n') break;
        out[i] = ' ';
        i += 1;
      }
      if (i < text.length && text[i] === quote) { out[i] = ' '; i += 1; }
      strings.push({ start, end: i, value: text.slice(start + 1, i - 1) });
      continue;
    }
    out[i] = text[i];
    i += 1;
  }
  return { masked: out.join(''), comments, strings };
}

/** Brace depth before each character, so a match offset can be attributed to its nesting level. */
function braceDepths(masked) {
  const depths = new Int32Array(masked.length + 1);
  let depth = 0;
  for (let i = 0; i < masked.length; i += 1) {
    depths[i] = depth;
    if (masked[i] === '{') depth += 1;
    else if (masked[i] === '}') depth = Math.max(0, depth - 1);
  }
  depths[masked.length] = depth;
  return depths;
}

/**
 * Splits a region into declaration-sized chunks: text up to a top-level `;`, or a header plus its
 * `{ ... }` body. Parens and brackets are tracked so a `;` or `{` inside them never splits.
 */
function chunkRegion(masked, from, to) {
  const out = [];
  let i = from;
  while (i < to) {
    while (i < to && /\s/.test(masked[i])) i += 1;
    if (i >= to) break;
    const start = i;
    let depth = 0;
    let headerEnd = -1;
    let bodyStart = -1;
    let bodyEnd = -1;
    while (i < to) {
      const c = masked[i];
      if (c === '(' || c === '[') depth += 1;
      else if (c === ')' || c === ']') depth -= 1;
      else if (c === '{') {
        if (depth === 0 && bodyStart < 0) { headerEnd = i; bodyStart = i; }
        depth += 1;
      } else if (c === '}') {
        depth -= 1;
        if (depth === 0 && bodyStart >= 0) {
          bodyEnd = i + 1;
          i += 1;
          let j = i;
          while (j < to && /\s/.test(masked[j])) j += 1;
          if (masked[j] === ';') i = j + 1;
          break;
        }
      } else if (c === ';' && depth <= 0) {
        i += 1;
        break;
      }
      i += 1;
    }
    if (i === start) i += 1;
    out.push({ start, end: i, headerEnd: headerEnd < 0 ? i : headerEnd, bodyStart, bodyEnd });
  }
  return out;
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Splits on commas that are not nested inside parens or brackets. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) {
      parts.push({ text: text.slice(start, i), offset: start });
      start = i + 1;
    }
  }
  parts.push({ text: text.slice(start), offset: start });
  return parts.filter((part) => part.text.trim().length > 0);
}

/** Last identifier in a fragment, with its offset, ignoring modifier words. */
function trailingName(fragment, offset) {
  const pattern = new RegExp(`(${IDENTIFIER})\\s*$`);
  const match = pattern.exec(fragment.replace(/\s+$/, ''));
  if (!match) return undefined;
  const name = match[1];
  if (DECL_MODIFIERS.has(name)) return undefined;
  const nameStart = offset + fragment.lastIndexOf(name, fragment.length);
  return { name, nameStart, nameEnd: nameStart + name.length };
}

/** Parses a parameter list body into named parameters. */
function parseParams(text, offset) {
  const params = [];
  for (const part of splitTopLevel(text)) {
    const named = trailingName(part.text, offset + part.offset);
    if (!named) continue;
    const typeText = collapse(part.text.slice(0, named.nameStart - offset - part.offset));
    if (!typeText) continue; // a bare name is an argument, not a declaration
    params.push({
      kind: 'parameter',
      name: named.name,
      nameStart: named.nameStart,
      nameEnd: named.nameEnd,
      start: offset + part.offset,
      end: named.nameEnd,
      type: typeText.replace(/\b(memory|calldata|storage|constant|indexed)\b/g, '').trim(),
      signature: `${typeText} ${named.name}`,
    });
  }
  return params;
}

/** Matching close for the group opening at `open`, or -1. */
function matchGroup(masked, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const close = pairs[masked[open]];
  if (!close) return -1;
  let depth = 0;
  for (let i = open; i < masked.length; i += 1) {
    if (masked[i] === masked[open]) depth += 1;
    else if (masked[i] === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Documentation comment directly above `offset`, if any. `///`, `/** *\/`, `//` and `/* *\/` all count. */
function docCommentFor(comments, text, offset) {
  const collected = [];
  let boundary = offset;
  for (let i = comments.length - 1; i >= 0; i -= 1) {
    const comment = comments[i];
    if (comment.end > boundary) continue;
    const between = text.slice(comment.end, boundary);
    if (!/^\s*$/.test(between) || (between.match(/\n/g) || []).length > 1) break;
    collected.unshift(comment.text);
    boundary = comment.start;
    const lineStart = text.lastIndexOf('\n', comment.start - 1) + 1;
    if (!/^\s*$/.test(text.slice(lineStart, comment.start))) {
      collected.shift(); // a trailing comment on a code line, not a doc block
      break;
    }
  }
  if (!collected.length) return '';
  const lines = [];
  for (const raw of collected) {
    if (raw.startsWith('/*')) {
      const inner = raw.replace(/^\/\*+/, '').replace(/\*+\/$/, '');
      for (const line of inner.split('\n')) lines.push(line.replace(/^\s*\*+\s?/, '').trim());
    } else {
      lines.push(raw.replace(/^\/{2,3}\s?/, '').trim());
    }
  }
  return lines.join('\n').trim();
}

function headerName(headerText, chunkStart, keyword) {
  const pattern = new RegExp(`\\b${keyword}\\s+(${IDENTIFIER})`);
  const match = pattern.exec(headerText);
  if (!match) return undefined;
  const nameStart = chunkStart + match.index + match[0].length - match[1].length;
  return { name: match[1], nameStart, nameEnd: nameStart + match[1].length };
}

function parseBases(headerText) {
  const isIndex = headerText.search(/\bis\b/);
  if (isIndex < 0) return [];
  const tail = headerText.slice(isIndex + 2);
  return splitTopLevel(tail)
    .map((part) => (new RegExp(`^\\s*(${IDENTIFIER})`).exec(part.text) || [])[1])
    .filter(Boolean);
}

/**
 * Scans a source file into imports and declarations. Declarations carry absolute offsets, their
 * container, a display signature, any leading doc comment, and (for functions) parameters and locals.
 */
function scan(text) {
  const { masked, comments, strings } = maskSource(text);

  // Directives (`import` / `pragma` / `using`) are matched first and blanked from the chunk scan: their
  // `{ ... }` binding lists would otherwise read as declaration bodies.
  const imports = [];
  let work = masked;
  STATEMENT_DIRECTIVE.lastIndex = 0;
  let directive = STATEMENT_DIRECTIVE.exec(masked);
  const blanks = [];
  while (directive) {
    const start = directive.index;
    const end = start + directive[0].length;
    blanks.push([start, end]);
    if (directive[1] === 'import') {
      const literal = strings.find((s) => s.start >= start && s.end <= end);
      if (literal) {
        const bindings = [];
        const braceOpen = masked.indexOf('{', start);
        if (braceOpen >= 0 && braceOpen < literal.start) {
          const braceClose = matchGroup(masked, braceOpen);
          if (braceClose > braceOpen) {
            const inner = text.slice(braceOpen + 1, braceClose);
            for (const part of splitTopLevel(inner)) {
              const pattern = new RegExp(`^\\s*(${IDENTIFIER})(?:\\s+as\\s+(${IDENTIFIER}))?`);
              const match = pattern.exec(part.text);
              if (!match) continue;
              const nameStart = braceOpen + 1 + part.offset + part.text.indexOf(match[1]);
              const binding = {
                name: match[1], nameStart, nameEnd: nameStart + match[1].length,
              };
              if (match[2]) {
                const aliasStart = braceOpen + 1 + part.offset + part.text.lastIndexOf(match[2]);
                binding.alias = match[2];
                binding.aliasStart = aliasStart;
                binding.aliasEnd = aliasStart + match[2].length;
              }
              bindings.push(binding);
            }
          }
        }
        const namespacePattern = new RegExp(`\\bas\\s+(${IDENTIFIER})`);
        const namespace = namespacePattern.exec(masked.slice(literal.end, end));
        const record = {
          path: literal.value,
          pathStart: literal.start,
          pathEnd: literal.end,
          start,
          end,
          bindings,
        };
        if (namespace) {
          const aliasStart = literal.end + namespace.index + namespace[0].length - namespace[1].length;
          record.namespace = namespace[1];
          record.namespaceStart = aliasStart;
          record.namespaceEnd = aliasStart + namespace[1].length;
        }
        imports.push(record);
      }
    }
    directive = STATEMENT_DIRECTIVE.exec(masked);
  }
  if (blanks.length) {
    const chars = work.split('');
    for (const [start, end] of blanks) {
      for (let i = start; i < end; i += 1) if (chars[i] !== '\n') chars[i] = ' ';
    }
    work = chars.join('');
  }

  const declarations = [];
  const knownTypes = new Set();

  const record = (decl) => {
    declarations.push(decl);
    return decl;
  };

  const signatureOf = (chunk) => collapse(text.slice(chunk.start, chunk.headerEnd)).slice(0, 240);

  const scanRegion = (from, to, container) => {
    for (const chunk of chunkRegion(work, from, to)) {
      const headerText = work.slice(chunk.start, chunk.headerEnd);
      const first = (new RegExp(`^\\s*(${IDENTIFIER})`).exec(headerText) || [])[1];
      if (!first || STATEMENT_KEYWORDS.has(first)) continue;

      const keyword = first === 'abstract'
        ? (new RegExp(`^\\s*abstract\\s+(${IDENTIFIER})`).exec(headerText) || [])[1]
        : first;

      if (CONTAINER_KEYWORDS.has(keyword)) {
        const named = headerName(headerText, chunk.start, keyword);
        if (!named) continue;
        knownTypes.add(named.name);
        const decl = record({
          kind: keyword,
          name: named.name,
          nameStart: named.nameStart,
          nameEnd: named.nameEnd,
          start: chunk.start,
          end: chunk.end,
          bodyStart: chunk.bodyStart,
          bodyEnd: chunk.bodyEnd,
          signature: signatureOf(chunk),
          doc: docCommentFor(comments, text, chunk.start),
          bases: parseBases(headerText.slice(named.nameEnd - chunk.start)),
          container: container ? container.name : undefined,
          containerKind: container ? container.kind : undefined,
        });
        // Contract header parameters are the constructor arguments, in scope for the whole contract.
        const headerParen = new RegExp('^\\s*\\(').exec(work.slice(named.nameEnd, chunk.headerEnd));
        if (headerParen) {
          const open = named.nameEnd + headerParen[0].length - 1;
          const close = matchGroup(work, open);
          if (close > open && close <= chunk.headerEnd) {
            for (const param of parseParams(work.slice(open + 1, close), open + 1)) {
              param.subkind = 'contractParameter';
              param.container = named.name;
              param.containerKind = keyword;
              param.scopeStart = chunk.start;
              param.scopeEnd = chunk.end;
              param.owner = decl;
              declarations.push(param);
            }
          }
        }
        if (chunk.bodyStart >= 0) {
          // An unterminated body (mid-edit) still has members worth indexing, so fall back to the chunk end.
          scanRegion(chunk.bodyStart + 1, chunk.bodyEnd > chunk.bodyStart ? chunk.bodyEnd - 1 : chunk.end, decl);
        }
        continue;
      }

      if (keyword === 'struct' || keyword === 'enum') {
        const named = headerName(headerText, chunk.start, keyword);
        if (!named) continue;
        knownTypes.add(named.name);
        const decl = record({
          kind: keyword,
          name: named.name,
          nameStart: named.nameStart,
          nameEnd: named.nameEnd,
          start: chunk.start,
          end: chunk.end,
          bodyStart: chunk.bodyStart,
          bodyEnd: chunk.bodyEnd,
          signature: signatureOf(chunk),
          doc: docCommentFor(comments, text, chunk.start),
          container: container ? container.name : undefined,
          containerKind: container ? container.kind : undefined,
        });
        if (chunk.bodyStart >= 0 && chunk.bodyEnd > chunk.bodyStart) {
          if (keyword === 'enum') {
            const inner = text.slice(chunk.bodyStart + 1, chunk.bodyEnd - 1);
            for (const part of splitTopLevel(inner)) {
              const pattern = new RegExp(`^\\s*(${IDENTIFIER})`);
              const match = pattern.exec(part.text);
              if (!match) continue;
              const nameStart = chunk.bodyStart + 1 + part.offset + part.text.indexOf(match[1]);
              record({
                kind: 'enumMember',
                name: match[1],
                nameStart,
                nameEnd: nameStart + match[1].length,
                start: nameStart,
                end: nameStart + match[1].length,
                signature: `${decl.name}.${match[1]}`,
                doc: '',
                container: decl.name,
                containerKind: 'enum',
              });
            }
          } else {
            scanRegion(chunk.bodyStart + 1, chunk.bodyEnd - 1, decl);
          }
        }
        continue;
      }

      if (keyword === 'event' || keyword === 'error' || keyword === 'type') {
        const named = headerName(headerText, chunk.start, keyword);
        if (!named) continue;
        if (keyword === 'type') knownTypes.add(named.name);
        const decl = record({
          kind: keyword,
          name: named.name,
          nameStart: named.nameStart,
          nameEnd: named.nameEnd,
          start: chunk.start,
          end: chunk.end,
          signature: collapse(text.slice(chunk.start, chunk.end)).replace(/;$/, '').slice(0, 240),
          doc: docCommentFor(comments, text, chunk.start),
          container: container ? container.name : undefined,
          containerKind: container ? container.kind : undefined,
        });
        // Event / error parameters are the named arguments of `emit` and `revert`.
        if (keyword !== 'type') {
          const open = work.indexOf('(', named.nameEnd);
          const close = open >= 0 ? matchGroup(work, open) : -1;
          if (open >= 0 && close > open && close < chunk.end) {
            for (const param of parseParams(work.slice(open + 1, close), open + 1)) {
              param.container = named.name;
              param.containerKind = keyword;
              param.scopeStart = chunk.start;
              param.scopeEnd = chunk.end;
              param.owner = decl;
              declarations.push(param);
            }
          }
        }
        continue;
      }

      if (keyword === 'function' || keyword === 'modifier' || keyword === 'constructor'
        || keyword === 'fallback' || keyword === 'receive') {
        let named;
        if (keyword === 'function' || keyword === 'modifier') {
          named = headerName(headerText, chunk.start, keyword);
        } else {
          const index = headerText.indexOf(keyword);
          named = {
            name: keyword,
            nameStart: chunk.start + index,
            nameEnd: chunk.start + index + keyword.length,
          };
        }
        if (!named) continue;
        const parenOpen = work.indexOf('(', named.nameEnd);
        const parenClose = parenOpen >= 0 ? matchGroup(work, parenOpen) : -1;
        const params = parenOpen >= 0 && parenClose > parenOpen && parenClose < chunk.end
          ? parseParams(work.slice(parenOpen + 1, parenClose), parenOpen + 1)
          : [];
        const returnsOpen = (() => {
          const pattern = /\breturns\s*\(/g;
          pattern.lastIndex = Math.max(parenClose, named.nameEnd);
          const match = pattern.exec(work.slice(0, chunk.headerEnd + 1));
          return match ? match.index + match[0].length - 1 : -1;
        })();
        const returnParams = returnsOpen > 0
          ? parseParams(
            work.slice(returnsOpen + 1, matchGroup(work, returnsOpen)),
            returnsOpen + 1,
          )
          : [];
        const decl = record({
          kind: keyword === 'modifier' ? 'modifier' : 'function',
          subkind: keyword,
          name: named.name,
          nameStart: named.nameStart,
          nameEnd: named.nameEnd,
          start: chunk.start,
          end: chunk.end,
          bodyStart: chunk.bodyStart,
          bodyEnd: chunk.bodyEnd,
          signature: signatureOf(chunk).replace(/\s*\{$/, ''),
          doc: docCommentFor(comments, text, chunk.start),
          container: container ? container.name : undefined,
          containerKind: container ? container.kind : undefined,
          params,
          returnParams,
        });
        for (const param of params.concat(returnParams)) {
          param.container = decl.name;
          param.containerKind = 'function';
          param.scopeStart = chunk.start;
          param.scopeEnd = chunk.end;
          param.owner = decl;
          declarations.push(param);
        }
        continue;
      }

      // Anything else at declaration level is a variable: state variable, constant, or struct field.
      const initializer = (() => {
        let depth = 0;
        for (let i = chunk.start; i < chunk.end; i += 1) {
          const c = work[i];
          if (c === '(' || c === '[' || c === '{') depth += 1;
          else if (c === ')' || c === ']' || c === '}') depth -= 1;
          else if (c === '=' && depth === 0 && work[i + 1] !== '=' && work[i - 1] !== '=') return i;
        }
        return -1;
      })();
      const declEnd = initializer > 0 ? initializer : chunk.end;
      const declText = text.slice(chunk.start, declEnd).replace(/[;{]\s*$/, '');
      const named = trailingName(declText, chunk.start);
      if (!named) continue;
      const typeText = collapse(declText.slice(0, named.nameStart - chunk.start));
      if (!typeText) continue;
      const modifiers = typeText.split(/\s+/).filter((word) => DECL_MODIFIERS.has(word));
      record({
        kind: container && container.kind === 'struct' ? 'field' : 'stateVariable',
        name: named.name,
        nameStart: named.nameStart,
        nameEnd: named.nameEnd,
        start: chunk.start,
        end: chunk.end,
        signature: collapse(text.slice(chunk.start, chunk.end)).replace(/;$/, '').slice(0, 240),
        doc: docCommentFor(comments, text, chunk.start),
        type: typeText.split(/\s+/).filter((word) => !DECL_MODIFIERS.has(word)).join(' '),
        modifiers,
        isConstant: modifiers.includes('constant'),
        container: container ? container.name : undefined,
        containerKind: container ? container.kind : undefined,
      });
    }
  };

  scanRegion(0, work.length, undefined);

  // Locals need the full type set, so they are collected after every declaration is known.
  const locals = [];
  const localPattern = new RegExp(
    `\\b(${IDENTIFIER})((?:\\s*\\[[^\\]\\n]*\\])*)\\s+`
    + `(?:(?:memory|calldata|storage|constant|immutable|transient|packed|enumerable)\\s+)*`
    + `(${IDENTIFIER})\\s*(?=[=;,)])`,
    'g',
  );
  // Yul declarations inside `assembly { ... }`: `let x := ...` and nested `function f(a) -> b`.
  const yulLetPattern = new RegExp(`\\blet\\s+(${IDENTIFIER}(?:\\s*,\\s*${IDENTIFIER})*)`, 'g');
  const yulFunctionPattern = new RegExp(
    `\\bfunction\\s+(${IDENTIFIER})\\s*\\(([^)\\n]*)\\)\\s*(?:->\\s*([^{\\n]*))?`,
    'g',
  );
  for (const decl of declarations) {
    if (decl.kind !== 'function' && decl.kind !== 'modifier') continue;
    if (decl.bodyStart < 0 || decl.bodyEnd <= decl.bodyStart) continue;
    const body = work.slice(decl.bodyStart, decl.bodyEnd);

    const pushYul = (name, offsetInBody, signature) => {
      const nameStart = decl.bodyStart + offsetInBody;
      locals.push({
        kind: 'local',
        subkind: 'assembly',
        name,
        nameStart,
        nameEnd: nameStart + name.length,
        start: nameStart,
        end: nameStart + name.length,
        signature,
        doc: '',
        container: decl.name,
        containerKind: 'function',
        scopeStart: decl.start,
        scopeEnd: decl.end,
        owner: decl,
      });
    };

    yulLetPattern.lastIndex = 0;
    let yulLet = yulLetPattern.exec(body);
    while (yulLet) {
      let cursor = yulLet.index + yulLet[0].indexOf(yulLet[1]);
      for (const raw of yulLet[1].split(',')) {
        const name = raw.trim();
        pushYul(name, body.indexOf(name, cursor), `let ${name}`);
        cursor = body.indexOf(name, cursor) + name.length;
      }
      yulLet = yulLetPattern.exec(body);
    }

    yulFunctionPattern.lastIndex = 0;
    let yulFunction = yulFunctionPattern.exec(body);
    while (yulFunction) {
      const [, name, args, returns] = yulFunction;
      const nameStart = decl.bodyStart + yulFunction.index + yulFunction[0].indexOf(name);
      locals.push({
        kind: 'function',
        subkind: 'assembly',
        name,
        nameStart,
        nameEnd: nameStart + name.length,
        start: decl.bodyStart + yulFunction.index,
        end: nameStart + name.length,
        signature: collapse(yulFunction[0]),
        doc: '',
        container: decl.name,
        containerKind: 'function',
        scopeStart: decl.start,
        scopeEnd: decl.end,
        owner: decl,
      });
      let cursor = yulFunction.index + yulFunction[0].indexOf('(') + 1;
      for (const raw of `${args},${returns || ''}`.split(',')) {
        const argument = raw.trim();
        if (!argument) continue;
        const at = body.indexOf(argument, cursor);
        if (at < 0) continue;
        pushYul(argument, at, `${argument} (assembly)`);
        cursor = at + argument.length;
      }
      yulFunction = yulFunctionPattern.exec(body);
    }

    localPattern.lastIndex = 0;
    let match = localPattern.exec(body);
    while (match) {
      const [, typeToken, brackets, name] = match;
      if (isTypeToken(typeToken, knownTypes) && !DECL_MODIFIERS.has(name)
        && !STATEMENT_KEYWORDS.has(name)) {
        const nameStart = decl.bodyStart + match.index + match[0].lastIndexOf(name);
        locals.push({
          kind: 'local',
          name,
          nameStart,
          nameEnd: nameStart + name.length,
          start: decl.bodyStart + match.index,
          end: nameStart + name.length,
          type: `${typeToken}${brackets.replace(/\s+/g, '')}`,
          signature: `${typeToken}${brackets.replace(/\s+/g, '')} ${name}`,
          doc: '',
          container: decl.name,
          containerKind: 'function',
          scopeStart: decl.start,
          scopeEnd: decl.end,
          owner: decl,
        });
      }
      match = localPattern.exec(body);
    }
  }
  declarations.push(...locals);

  const byName = new Map();
  for (const decl of declarations) {
    const list = byName.get(decl.name);
    if (list) list.push(decl);
    else byName.set(decl.name, [decl]);
  }

  // `assembly { ... }` regions, so a token inside one can be documented as Yul rather than Solidity.
  const assemblyRanges = [];
  const assemblyPattern = /\bassembly\b/g;
  let assemblyMatch = assemblyPattern.exec(work);
  while (assemblyMatch) {
    const open = work.indexOf('{', assemblyMatch.index);
    const close = open >= 0 ? matchGroup(work, open) : -1;
    if (open >= 0 && close > open) assemblyRanges.push({ start: open, end: close });
    assemblyMatch = assemblyPattern.exec(work);
  }

  return {
    text,
    masked,
    work,
    comments,
    strings,
    imports,
    declarations,
    byName,
    knownTypes,
    assemblyRanges,
  };
}

/** Maps offsets to zero-based line/character pairs without needing an open editor document. */
function createPositionMapper(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') starts.push(i + 1);
  return (offset) => {
    const clamped = Math.max(0, Math.min(offset, text.length));
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (starts[mid] <= clamped) low = mid;
      else high = mid - 1;
    }
    return { line: low, character: clamped - starts[low] };
  };
}

module.exports = {
  scan,
  maskSource,
  braceDepths,
  chunkRegion,
  createPositionMapper,
  splitTopLevel,
  matchGroup,
  isTypeToken,
  IDENTIFIER,
  DECL_MODIFIERS,
  PRIMITIVE_TYPES,
};
