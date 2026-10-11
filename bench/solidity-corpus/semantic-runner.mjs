/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { execSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isMainThread, parentPort, Worker, workerData } from 'worker_threads';

// Runtime parity: execute the solc corpus's OWN semantic expectations (the `// ----` trailer of
// test/libsolidity/semanticTests) on the BCH VM. Deliberately narrow first slice:
//   fixtures  - results.json status OK (they compile), single source, last definition is a plain contract (target),
//               no state variables in any contract, no constructor parameters;
//   lines     - `f(types): args -> rets`, `f() -> rets`, `... -> FAILURE` (any revert; payload ignored) with
//               uintN/intN/bool/bytesN values (decimal, negative, hex, left()/right(), true/false); `gas` lines are
//               ignored; call options, events, builtins, library/constructor lines, strings/bytes/arrays/structs/
//               address, or anything unparsed skip the whole fixture.
// Per (fixture, signature) one wrapper `contract __Check is <Target>` is appended and compiled; each line is one
// spend of `__check(args, expected, cmp)` on a fresh MockNetworkProvider. `cmp=false` on FAILURE lines, so a call
// that returns normally shows as a mismatch instead of a failed equality. Output: semantic-results.json and
// semantic-scorecard.txt. Env: CORPUS_RESULTS, SOLC_CORPUS, LIMIT (selected fixtures), FILTER (path substring),
// CORPUS_WORKERS, FIXTURE_TIMEOUT_MS, CORPUS_OUTPUT_DIR, SELECT_ONLY=true|list (selection only, no execution),
// RESCORE=true (re-derive both reports from an existing semantic-results.json, no execution).
const BENCH_DIR = dirname(fileURLToPath(import.meta.url));
const COMPILE_OPTIONS = { evmCompat: true, enforceFinalRequire: false }; // bench.mjs covenant-safety policy
const SEMANTIC_PREFIX = 'test/libsolidity/semanticTests/';
const errHead = (cause) => `${cause?.name || 'Error'}: ${String(cause?.message).split('\n')[0]}`;
// The script ending non-truthy is the wrapper's final require failing where the SDK could not map it to a line.
const canonicalOutcome = (outcome) => (/^revert: .*completed with a non-truthy value on top of the stack/.test(outcome)
  ? 'wrong value (unmapped final verify)' : outcome);

// ---------------------------------------------------------------------------------------------- worker side

async function workerMain() {
  const { compileString } = await import(workerData.compilerUrl);
  const { Contract, TransactionBuilder, FailedTransactionError, FailedRequireError, randomUtxo } =
    await import(workerData.sdkUrl);
  const { default: MockNetworkProvider } = await import(workerData.mockUrl);
  const noop = () => {};
  console.log = console.error = console.warn = console.info = noop;

  // Same spend shape as packages/solidcash/test/conformance/bch.ts buildAndSend.
  const spend = async (artifact, args) => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    const utxos = await contract.getUtxos();
    await new TransactionBuilder({ provider })
      .addInputs(utxos, contract.unlock.__check(...args))
      .addOutput({ to: contract.address, amount: 1_000n })
      .addOutput({ to: contract.address, amount: 900_000n })
      .send();
  };

  const vmReason = (cause) => {
    if (cause instanceof FailedRequireError) {
      const message = cause.requireStatement?.message;
      return `require@L${cause.requireStatement?.line}${message ? ` "${message}"` : ''}`;
    }
    const reason = cause.libauthErrorMessage ?? /Reason: (.*)/.exec(cause.message)?.[1] ?? cause.message;
    return String(reason).split('\n')[0];
  };

  const runLine = async (artifact, requireLine, line) => {
    try {
      await spend(artifact, line.args);
      return line.failure
        ? { status: 'mismatched', outcome: 'success (no revert)' }
        : { status: 'matched', outcome: 'success' };
    } catch (cause) {
      if (!(cause instanceof FailedTransactionError)) {
        return { status: 'mismatched', outcome: `build-error: ${errHead(cause)}` };
      }
      const atCheck = cause instanceof FailedRequireError && cause.requireStatement?.line === requireLine;
      const outcome = canonicalOutcome(atCheck ? 'wrong value' : `revert: ${vmReason(cause)}`);
      return { status: line.failure ? 'matched' : 'mismatched', outcome };
    }
  };

  const runCheck = async (check) => {
    if (check.lines.length === 0) return { compiled: null };
    let artifact;
    try {
      artifact = compileString(check.source, COMPILE_OPTIONS);
    } catch (cause) {
      return { compiled: false, error: errHead(cause) };
    }
    if (artifact.stateLayout) return { compiled: true, skip: 'stateful-artifact' };
    if (artifact.constructorInputs?.length) return { compiled: true, skip: 'constructor-inputs' };
    const lines = [];
    for (const line of check.lines) lines.push(await runLine(artifact, check.requireLine, line));
    return { compiled: true, lines };
  };

  parentPort.on('message', async ({ id, job }) => {
    try {
      const checks = [];
      for (const check of job.checks) checks.push(await runCheck(check));
      parentPort.postMessage({ id, checks });
    } catch (cause) {
      parentPort.postMessage({ id, error: `worker error: ${errHead(cause)}` });
    }
  });
}

// ------------------------------------------------------------------------------------------ source scanning

// Blank comments and string contents (same length, newlines kept) so brace/keyword scans see code only.
function stripSource(src) {
  const out = src.split('');
  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '; };
  for (let i = 0; i < src.length;) {
    if (src.startsWith('//', i)) {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      blank(i, stop); i = stop;
    } else if (src.startsWith('/*', i)) {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      blank(i, stop); i = stop;
    } else if (src[i] === '"' || src[i] === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== src[i] && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      blank(i + 1, Math.min(j, src.length)); i = j + 1;
    } else i++;
  }
  return out.join('');
}

function matchClose(text, open) {
  const o = text[open];
  const c = o === '{' ? '}' : o === '(' ? ')' : ']';
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === o) depth++;
    else if (text[k] === c && --depth === 0) return k;
  }
  return -1;
}

// Split at depth-0 commas; '' -> [].
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let k = 0; k < text.length; k++) {
    const ch = text[k];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) { parts.push(text.slice(from, k).trim()); from = k + 1; }
  }
  parts.push(text.slice(from).trim());
  return parts.length === 1 && parts[0] === '' ? [] : parts;
}

// Canonical ABI name of a supported elementary type, else undefined.
function elementaryAbi(type) {
  if (type === 'bool') return 'bool';
  if (type === 'byte') return 'bytes1';
  let m = /^(u?int)(\d*)$/.exec(type);
  if (m) {
    const bits = m[2] === '' ? 256 : Number(m[2]);
    return bits >= 8 && bits <= 256 && bits % 8 === 0 ? `${m[1]}${bits}` : undefined;
  }
  m = /^bytes(\d+)$/.exec(type);
  if (m) return Number(m[1]) >= 1 && Number(m[1]) <= 32 ? type : undefined;
  return undefined;
}

function typeKind(type) {
  if (type.includes('[')) return 'type:array';
  if (type.startsWith('(') || type.startsWith('tuple')) return 'type:struct';
  if (type === 'string' || type === 'bytes') return 'type:string-bytes';
  if (type.startsWith('address')) return 'type:address';
  if (type.startsWith('function')) return 'type:function';
  if (type.startsWith('mapping')) return 'type:mapping';
  return elementaryAbi(type) ? undefined : 'type:user-defined';
}

// A declared parameter or return: source spelling plus canonical ABI name when elementary.
function parseParam(text) {
  const tokens = text.trim().split(/\s+/);
  const extra = tokens.slice(1);
  const abi = elementaryAbi(tokens[0]);
  const plain = extra.length <= 1 && extra.every((t) => /^[A-Za-z_$][\w$]*$/.test(t)
    && !['memory', 'calldata', 'storage', 'payable'].includes(t));
  return abi && plain ? { src: tokens[0], abi } : { kind: typeKind(tokens[0]) ?? 'type:other' };
}

function parseFunction(text) {
  const m = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(text);
  if (!m) return undefined;
  const open = m[0].length - 1;
  const close = matchClose(text, open);
  if (close < 0) return undefined;
  const params = splitTop(text.slice(open + 1, close)).map(parseParam);
  let attrs = text.slice(close + 1);
  let rets = [];
  const r = /\breturns\s*\(/.exec(attrs);
  if (r) {
    const ro = close + 1 + r.index + r[0].length - 1;
    const rc = matchClose(text, ro);
    if (rc < 0) return undefined;
    rets = splitTop(text.slice(ro + 1, rc)).map(parseParam);
    attrs = attrs.slice(0, r.index);
  }
  return {
    name: m[1], params, rets,
    visibility: /\b(external|public|internal|private)\b/.exec(attrs)?.[1] ?? 'public',
    mutability: /\b(pure|view|payable)\b/.exec(attrs)?.[1] ?? '',
  };
}

// Depth-1 members of a contract body: `;`-terminated items and `{}`-bodied headers, with code offsets.
function splitMembers(code, start, end) {
  const members = [];
  let from = start;
  const push = (to) => {
    const text = code.slice(from, to).trim();
    if (text !== '') members.push({ text, from, to, fn: parseFunction(text) });
  };
  for (let k = start; k < end; k++) {
    const ch = code[k];
    if (ch === '(' || ch === '[') {
      const close = matchClose(code, k);
      if (close < 0) break;
      k = close;
    } else if (ch === ';') {
      push(k); from = k + 1;
    } else if (ch === '{') {
      const close = matchClose(code, k);
      if (close < 0) break;
      // `using {f, g} for T;` keeps going to its `;`.
      if (/^using\b/.test(code.slice(from, k).trim())) { k = close; continue; }
      push(k); k = close; from = close + 1;
    }
  }
  return members;
}

function findContracts(code) {
  const contracts = [];
  const head = /\b(abstract\s+contract|contract|library|interface)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = head.exec(code))) {
    const open = code.indexOf('{', head.lastIndex);
    const close = open < 0 ? -1 : matchClose(code, open);
    if (close < 0) break;
    const header = code.slice(head.lastIndex, open);
    const is = /\bis\b([\s\S]*)$/.exec(header);
    const bases = is ? splitTop(is[1]).map((b) => /^([A-Za-z_$][\w$.]*)/.exec(b)?.[1]).filter(Boolean) : [];
    const kind = m[1].startsWith('abstract') ? 'abstract' : m[1];
    contracts.push({ kind, name: m[2], bases, members: splitMembers(code, open + 1, close) });
    head.lastIndex = close + 1;
  }
  return contracts;
}

const NON_STATE_MEMBER =
  /^(?:function\s+[A-Za-z_$]|modifier\b|constructor\b|fallback\b|receive\b|struct\b|enum\b|event\b|error\b|using\b|type\b)/;
const isStateVariable = (text) => !NON_STATE_MEMBER.test(text) && !/\bconstant\b/.test(text);

// ------------------------------------------------------------------------------------- expectation parsing

// `// ----` trailer -> [{ line, text }] call entries; continuation lines (`-> 5`, wrapped args) are joined.
function parseEntries(src) {
  const lines = src.split('\n');
  const sep = lines.findIndex((l) => /^\/\/ ----\s*$/.test(l));
  const entries = [];
  if (sep < 0) return entries;
  for (let n = sep + 1; n < lines.length; n++) {
    if (!lines[n].startsWith('//')) continue;
    const text = lines[n].slice(2).replace(/#[^#]*#/g, ' ').replace(/#.*$/, '').trim();
    if (text === '' || /^gas\s/.test(text)) continue;
    const startsEntry = /^(?:~|\(|(?!(?:left|right)\s*\(|(?:true|false)\b)[A-Za-z_$][\w$]*\s*(?:\(|:|->|$))/
      .test(text);
    if (startsEntry || entries.length === 0) entries.push({ line: n + 1, text });
    else entries[entries.length - 1].text += ` ${text}`;
  }
  return entries;
}

function parseCall(text) {
  if (text.startsWith('~')) return { skip: 'events' };
  const m = /^([A-Za-z_$][\w$]*)?\s*(\()?/.exec(text);
  const name = m[1] ?? '';
  if (!m[2]) return { skip: name === 'library' ? 'library' : `builtin:${name || 'unparsed'}` };
  if (name === '') return { skip: 'fallback-call' };
  if (name === 'constructor') return { skip: 'constructor-call' };
  const open = m[0].length - 1;
  const close = matchClose(text, open);
  if (close < 0) return { skip: 'unparsed' };
  const types = splitTop(text.slice(open + 1, close));
  const rest = text.slice(close + 1).trim();
  const arrow = rest.indexOf('->');
  if (rest.startsWith(',') || /\b(?:wei|gwei|ether|value)\b/.test(arrow < 0 ? rest : rest.slice(0, arrow))) {
    return { skip: 'call-options' };
  }
  if (arrow < 0) return { skip: 'unparsed' };
  let argText = rest.slice(0, arrow).trim();
  if (argText.startsWith(':')) argText = argText.slice(1).trim();
  else if (argText !== '') return { skip: 'unparsed' };
  const retText = rest.slice(arrow + 2).trim();
  return { name, types, argText, retText, failure: /^FAILURE\b/.test(retText) };
}

const WORD = 1n << 256n;

// isoltest value -> 256-bit ABI word, else undefined. As isoltest: numbers are compact big-endian bytes (negative =
// two's complement), right-aligned unless wrapped in left(); hex keeps its written byte length.
function parseWord(token) {
  let t = token.trim();
  const lr = /^(left|right)\((.*)\)$/.exec(t);
  if (lr) t = lr[2].trim();
  if (t === 'true' || t === 'false') return lr?.[1] === 'left' ? undefined : BigInt(t === 'true');
  let value;
  let bytes;
  if (/^-?\d+$/.test(t)) {
    value = BigInt(t);
    if (value < 0n) value += WORD;
    bytes = value === 0n ? 0 : Math.ceil(value.toString(16).length / 2);
  } else if (/^0x[0-9a-fA-F]+$/.test(t)) {
    value = BigInt(t);
    bytes = Math.ceil((t.length - 2) / 2);
  } else return undefined;
  if (value < 0n || value >= WORD || bytes > 32) return undefined;
  return lr?.[1] === 'left' ? value << BigInt(8 * (32 - bytes)) : value;
}

// ABI word -> SDK argument for the declared type; undefined when the word is not a clean value of that type.
function typedValue(word, abi) {
  if (abi === 'bool') return word === 0n ? false : word === 1n ? true : undefined;
  let m = /^uint(\d+)$/.exec(abi);
  if (m) return word < 1n << BigInt(m[1]) ? word : undefined;
  m = /^int(\d+)$/.exec(abi);
  if (m) {
    const signed = word >= 1n << 255n ? word - WORD : word;
    const half = 1n << BigInt(Number(m[1]) - 1);
    return signed >= -half && signed < half ? signed : undefined;
  }
  const n = Number(/^bytes(\d+)$/.exec(abi)[1]);
  const bytes = Uint8Array.from({ length: 32 }, (_, k) => Number((word >> BigInt(8 * (31 - k))) & 0xffn));
  return bytes.slice(n).every((b) => b === 0) ? bytes.slice(0, n) : undefined;
}

const zeroValue = (abi) => (abi === 'bool' ? false : abi.startsWith('bytes') ? new Uint8Array(Number(abi.slice(5))) : 0n);

// ------------------------------------------------------------------------------------------ fixture selection

function selectFixture(src) {
  if (src.includes('==== Source:') || src.includes('==== ExternalSource:')) return { skip: 'multi-source' };
  const code = stripSource(src);
  const contracts = findContracts(code);
  const target = contracts.at(-1);
  if (!target) return { skip: 'no-contract' };
  if (target.kind !== 'contract') return { skip: `target-is-${target.kind}` };
  const stateVariable = contracts.filter((c) => c.kind !== 'interface')
    .flatMap((c) => c.members).find((mb) => isStateVariable(mb.text));
  if (stateVariable) return { skip: 'state-variables', detail: stateVariable.text.slice(0, 80) };
  const byName = new Map(contracts.map((c) => [c.name, c]));
  const ancestry = [];
  for (const queue = [target]; queue.length > 0;) {
    const c = queue.shift();
    if (ancestry.includes(c)) continue;
    ancestry.push(c);
    for (const base of [...c.bases].reverse()) if (byName.has(base)) queue.push(byName.get(base));
  }
  if (ancestry.some((c) => c.members.some((mb) => /^constructor\s*\(\s*[^)\s]/.test(mb.text)))) {
    return { skip: 'constructor-params' };
  }
  const entries = parseEntries(src);
  if (entries.length === 0) return { skip: 'no-calls' };

  const checks = new Map();
  for (const entry of entries) {
    const call = parseCall(entry.text);
    if (call.skip) return { skip: call.skip };
    for (const t of call.types) { const kind = typeKind(t); if (kind) return { skip: kind }; }
    const sigTypes = call.types.map(elementaryAbi);
    const sig = `${call.name}(${sigTypes.join(',')})`;
    if (/"/.test(call.argText) || (!call.failure && /"/.test(call.retText))) return { skip: 'value:string-or-hex' };
    let check = checks.get(sig);
    if (!check) {
      const decls = ancestry.flatMap((c) => c.members
        .filter((mb) => mb.fn?.name === call.name && mb.fn.params.length === sigTypes.length
          && mb.fn.params.every((p, k) => p.abi === sigTypes[k]))
        .map((mb) => ({ contract: c, member: mb })));
      if (decls.length === 0) return { skip: 'no-matching-decl' };
      const fn = decls[0].member.fn;
      if (fn.visibility === 'internal' || fn.visibility === 'private') return { skip: 'not-external' };
      const badRet = fn.rets.find((r) => !r.abi);
      if (badRet) return { skip: `ret-${badRet.kind}` };
      check = { sig, name: call.name, decls, fn, lines: [] };
      checks.set(sig, check);
    }
    const argTokens = splitTop(call.argText);
    if (argTokens.length !== sigTypes.length) return { skip: 'arg-arity' };
    const argWords = argTokens.map(parseWord);
    if (argWords.some((w) => w === undefined)) return { skip: 'value:unparsed' };
    const retTokens = call.failure ? [] : splitTop(call.retText);
    if (!call.failure && retTokens.length !== check.fn.rets.length) return { skip: 'ret-arity' };
    const retWords = retTokens.map(parseWord);
    if (retWords.some((w) => w === undefined)) return { skip: 'value:unparsed' };
    const line = { line: entry.line, call: entry.text, failure: call.failure };
    const args = argWords.map((w, k) => typedValue(w, sigTypes[k]));
    const rets = call.failure
      ? check.fn.rets.map((r) => zeroValue(r.abi))
      : retWords.map((w, k) => typedValue(w, check.fn.rets[k].abi));
    if (args.some((a) => a === undefined)) Object.assign(line, { status: 'skipped', reason: 'arg-out-of-range' });
    else if (rets.some((r) => r === undefined)) Object.assign(line, { status: 'skipped', reason: 'ret-out-of-range' });
    else line.args = [...args, ...rets, ...(rets.length > 0 ? [!call.failure] : [])];
    check.lines.push(line);
  }
  return { target: target.name, checks: [...checks.values()].map((check) => buildWrapper(src, code, target, check)) };
}

const MUTABILITY_RANK = { pure: 0, view: 1, '': 2, payable: 2 };

// Wrapper source for one signature. An `external` declaration (contract, not interface) is respelled `public` so
// the derived wrapper can call it internally; the respelling is recorded in the results.
function buildWrapper(src, code, target, check) {
  const { fn, decls } = check;
  let edited = src;
  let rewrote = false;
  for (const { contract, member } of decls) {
    if (contract.kind === 'interface' || member.fn.visibility !== 'external') continue;
    const at = /\bexternal\b/.exec(code.slice(member.from, member.to));
    if (!at) continue;
    const abs = member.from + at.index;
    edited = `${edited.slice(0, abs)}public  ${edited.slice(abs + 'external'.length)}`;
    rewrote = true;
  }
  const rank = Math.max(...decls.map((d) => MUTABILITY_RANK[d.member.fn.mutability]));
  const mutability = ['pure', 'view', ''][rank];
  const params = [
    ...fn.params.map((p, k) => `${p.src} __a${k}`),
    ...fn.rets.map((r, k) => `${r.src} __e${k}`),
    ...(fn.rets.length > 0 ? ['bool __cmp'] : []),
  ];
  const callExpr = `${check.name}(${fn.params.map((_, k) => `__a${k}`).join(', ')})`;
  const callStmt = fn.rets.length === 0 ? `${callExpr};`
    : fn.rets.length === 1 ? `${fn.rets[0].src} __r0 = ${callExpr};`
      : `(${fn.rets.map((r, k) => `${r.src} __r${k}`).join(', ')}) = ${callExpr};`;
  const cond = fn.rets.length === 0 ? 'true'
    : `!__cmp || (${fn.rets.map((_, k) => `__r${k} == __e${k}`).join(' && ')})`;
  const source = `${edited.trimEnd()}

contract __Check is ${target.name} {
    function __check(${params.join(', ')}) public${mutability ? ` ${mutability}` : ''} {
        ${callStmt}
        require(${cond});
    }
}
`;
  const requireLine = source.slice(0, source.lastIndexOf('        require(')).split('\n').length;
  return { sig: check.sig, source, requireLine, lines: check.lines, ...(rewrote && { rewrote: 'external->public' }) };
}

// ------------------------------------------------------------------------------------------------ main side

async function main() {
  const OUTPUT_DIR = process.env.CORPUS_OUTPUT_DIR || BENCH_DIR;
  if (OUTPUT_DIR !== BENCH_DIR) mkdirSync(OUTPUT_DIR, { recursive: true });
  if (process.env.RESCORE === 'true') {
    const prior = JSON.parse(readFileSync(join(OUTPUT_DIR, 'semantic-results.json'), 'utf8'));
    for (const line of prior.fixtures.flatMap((f) => f.lines ?? [])) {
      if (line.outcome) line.outcome = canonicalOutcome(line.outcome);
    }
    writeReports(OUTPUT_DIR, { ...prior.meta, rescored: true }, prior.summary.candidates, prior.fixtures);
    return;
  }
  const ROOT = process.env.SOLC_CORPUS || '/Code/solidity';
  const RESULTS = process.env.CORPUS_RESULTS || join(BENCH_DIR, 'results.json');
  const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const FILTER = process.env.FILTER || '';
  const FIXTURE_TIMEOUT_MS = process.env.FIXTURE_TIMEOUT_MS ? Number(process.env.FIXTURE_TIMEOUT_MS) : 120000;
  const WORKER_COUNT = process.env.CORPUS_WORKERS ? Number(process.env.CORPUS_WORKERS) : 8;
  const started = Date.now();

  const candidates = JSON.parse(readFileSync(RESULTS, 'utf8'))
    .filter((r) => r.status === 'OK' && r.rel.startsWith(SEMANTIC_PREFIX) && r.rel.includes(FILTER))
    .map((r) => r.rel).sort();
  const fixtures = [];
  const jobs = [];
  for (const rel of candidates) {
    const selected = selectFixture(readFileSync(join(ROOT, rel), 'utf8'));
    if (selected.skip || jobs.length >= LIMIT) {
      const { skip: reason, detail } = selected;
      if (reason) fixtures.push({ rel, status: 'skipped', reason, ...(detail && { detail }) });
      continue;
    }
    const fixture = { rel, status: 'run', target: selected.target, checks: [], lines: [] };
    fixtures.push(fixture);
    jobs.push({ fixture, checks: selected.checks });
  }
  const selectedLines = jobs.reduce((n, j) => n + j.checks.reduce((m, c) => m + c.lines.length, 0), 0);
  process.stderr.write(`  ${candidates.length} candidates, ${jobs.length} fixtures / ${selectedLines} lines selected\n`);
  if (process.env.SELECT_ONLY === 'list') {
    for (const f of fixtures) process.stdout.write(`${f.rel}  ${f.reason ?? f.status}  ${f.detail ?? ''}\n`);
    return;
  }
  if (process.env.SELECT_ONLY === 'true') {
    const reasons = tally(fixtures.filter((f) => f.status === 'skipped').map((f) => f.reason));
    for (const [reason, n] of reasons) process.stdout.write(`${String(n).padStart(5)}  ${reason}\n`);
    return;
  }

  const workerUrls = {
    compilerUrl: new URL('../../packages/solidc/dist/index.js', import.meta.url).href,
    sdkUrl: new URL('../../packages/solidcash/dist/index.js', import.meta.url).href,
    mockUrl: new URL('../../packages/solidcash/dist/network/MockNetworkProvider.js', import.meta.url).href,
  };
  const createRunner = () => {
    let worker;
    let requestId = 0;
    return {
      run: (job) => {
        if (!worker) worker = new Worker(new URL(import.meta.url), { workerData: workerUrls });
        const active = worker;
        const id = requestId++;
        return new Promise((resolve) => {
          const drop = () => { if (worker === active) worker = undefined; void active.terminate(); };
          const cleanup = () => {
            clearTimeout(timer);
            active.off('message', onMessage);
            active.off('error', onError);
          };
          const onMessage = (message) => { if (message.id === id) { cleanup(); resolve(message); } };
          const onError = (error) => { cleanup(); drop(); resolve({ error: `worker error: ${errHead(error)}` }); };
          const timer = setTimeout(() => {
            cleanup(); drop(); resolve({ error: `timeout after ${FIXTURE_TIMEOUT_MS}ms` });
          }, FIXTURE_TIMEOUT_MS);
          active.on('message', onMessage);
          active.on('error', onError);
          const runnable = job.checks.map((c) => ({
            source: c.source, requireLine: c.requireLine, lines: c.lines.filter((l) => l.args),
          }));
          active.postMessage({ id, job: { checks: runnable } });
        });
      },
      terminate: async () => { if (worker) await worker.terminate(); },
    };
  };

  let next = 0;
  let done = 0;
  const runners = Array.from({ length: Math.max(1, WORKER_COUNT) }, createRunner);
  await Promise.all(runners.map(async (runner) => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const t0 = Date.now();
      const result = await runner.run(job);
      recordFixture(job, result);
      job.fixture.ms = Date.now() - t0;
      if (++done % 25 === 0 || done === jobs.length) process.stderr.write(`  ...${done}/${jobs.length} fixtures\n`);
    }
  }));
  await Promise.all(runners.map((runner) => runner.terminate()));

  const elapsedSeconds = Math.round((Date.now() - started) / 100) / 10;
  const meta = {
    corpusRoot: ROOT,
    corpusRevision: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(),
    resultsFile: RESULTS,
    compileOptions: COMPILE_OPTIONS,
    limit: LIMIT === Infinity ? null : LIMIT,
    filter: FILTER || null,
    workers: WORKER_COUNT,
    fixtureTimeoutMs: FIXTURE_TIMEOUT_MS,
    node: process.version,
    elapsedSeconds,
  };
  writeReports(OUTPUT_DIR, meta, candidates.length, fixtures);
}

// Fold a worker reply into the fixture's per-line records (file order).
function recordFixture(job, result) {
  const { fixture } = job;
  if (result.error) fixture.status = 'error';
  for (const [k, check] of job.checks.entries()) {
    const reply = result.checks?.[k];
    fixture.checks.push({
      sig: check.sig,
      ...(check.rewrote && { rewrote: check.rewrote }),
      ...(reply && { compiled: reply.compiled }),
      ...(reply?.error && { error: reply.error }),
      ...(reply?.skip && { skip: reply.skip }),
    });
    const runnable = check.lines.filter((l) => l.args);
    for (const line of check.lines) {
      const base = { line: line.line, call: line.call };
      if (line.status) { fixture.lines.push({ ...base, status: line.status, reason: line.reason }); continue; }
      const outcome = reply?.lines?.[runnable.indexOf(line)];
      if (result.error) fixture.lines.push({ ...base, status: 'error', outcome: result.error });
      else if (!reply.compiled) fixture.lines.push({ ...base, status: 'refused-at-compile', outcome: reply.error });
      else if (reply.skip) fixture.lines.push({ ...base, status: 'skipped', reason: reply.skip });
      else fixture.lines.push({ ...base, ...outcome });
    }
  }
  fixture.lines.sort((a, b) => a.line - b.line);
}

function tally(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

// Group key for an outcome: digits and quoted text folded so shapes aggregate.
const shapeOf = (line) => `${/->\s*FAILURE\b/.test(line.call) ? 'expected FAILURE' : 'expected values'}, got `
  + String(line.outcome).replace(/"[^"]*"/g, '".."').replace(/\d+/g, 'N').slice(0, 110);

function writeReports(outputDir, meta, candidateCount, fixtures) {
  const run = fixtures.filter((f) => f.status !== 'skipped');
  const lines = run.flatMap((f) => f.lines.map((l) => ({ ...l, rel: f.rel })));
  const count = (status) => lines.filter((l) => l.status === status).length;
  const summary = {
    candidates: candidateCount,
    selectedFixtures: run.length,
    skippedFixtures: Object.fromEntries(tally(fixtures.filter((f) => f.status === 'skipped').map((f) => f.reason))),
    lines: {
      selected: lines.length,
      matched: count('matched'),
      mismatched: count('mismatched'),
      refusedAtCompile: count('refused-at-compile'),
      skipped: count('skipped'),
      error: count('error'),
    },
    lineSkipReasons: Object.fromEntries(tally(lines.filter((l) => l.status === 'skipped').map((l) => l.reason))),
  };
  writeFileSync(join(outputDir, 'semantic-results.json'), `${JSON.stringify({ meta, summary, fixtures }, null, 1)}\n`);

  const L = summary.lines;
  const executed = L.matched + L.mismatched;
  const pct = executed ? ((100 * L.matched) / executed).toFixed(2) : '0.00';
  const header = `=== SOLC SEMANTIC RUNTIME PARITY (first slice): ${L.matched}/${executed} executed lines matched `
    + `(${pct}%) | ${L.mismatched} mismatched | ${L.refusedAtCompile} refused-at-compile | ${L.skipped} skipped `
    + `| ${L.error} error | ${run.length} fixtures run of ${candidateCount} compiled candidates `
    + `| ${meta.elapsedSeconds}s ===`;
  const block = (title, entries) => [`--- ${title} ---`, ...entries.map(([k, n]) => `${String(n).padStart(5)}  ${k}`)];
  const mismatches = lines.filter((l) => l.status === 'mismatched');
  const out = [
    header, '',
    ...block('FIXTURES SKIPPED (by reason)', Object.entries(summary.skippedFixtures)), '',
    ...block('LINES (selected fixtures)', [['selected', L.selected], ['matched', L.matched], ['mismatched', L.mismatched],
      ['refused-at-compile', L.refusedAtCompile], ['skipped', L.skipped], ['error (timeout/worker)', L.error]]), '',
    ...block('LINES SKIPPED (by reason)', Object.entries(summary.lineSkipReasons)), '',
    ...block('MISMATCH SHAPES', tally(mismatches.map(shapeOf))), '',
    ...block('REFUSED-AT-COMPILE (by error head, per line)', tally(lines.filter((l) => l.status === 'refused-at-compile')
      .map((l) => String(l.outcome).replace(/'[^']*'/g, "'..'").replace(/\d+/g, 'N').slice(0, 120)))), '',
    '--- MISMATCHES (fixture:line  call  =>  outcome) ---',
    ...mismatches.map((l) => `${l.rel}:${l.line}  ${l.call}  =>  ${l.outcome}`),
    '',
  ];
  writeFileSync(join(outputDir, 'semantic-scorecard.txt'), out.join('\n'));
  process.stdout.write(`\n${header}\n`);
}

if (isMainThread) await main();
else await workerMain();
