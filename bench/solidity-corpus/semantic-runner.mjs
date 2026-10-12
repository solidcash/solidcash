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
// spend of `__check(args, expected, cmp)` on a fresh MockNetworkProvider, with the keccak256 compute side-cars a
// deployer funds. `cmp=false` on FAILURE lines, so a call that returns normally shows as a mismatch instead of a
// failed equality. A spend stopped by the op-cost density limit is retried once behind a deployer's density reserve
// and scored apart (matched/mismatched-with-density-reserve). A target with a custom storage layout (`layout at`,
// which solc forbids inheriting from) gets the check functions inside a copy of its own body instead.
// Stateful slice: a fixture WITH state variables (no constructor parameters, same line restrictions; elementary
// public getters too; a getter wins over a base function it overrides) gets one wrapper with `__check_<k>` per
// signature, compiled with forceStateful (a derived wrapper refused by the lifecycle policy or MESSAGE_BUS_REQUIRED is
// compiled again with the checks inside the target), deployed ONCE through getContractFactory(...).deploy(); its lines
// then run in file order, one transaction each, so state carries over. A FAILURE line must revert without
// broadcasting; a reverted value line is re-sent with cmp=false (success = wrong value, state advances as in solc).
// Lines after a mismatch, or after a skipped value line of a state-writing function, are tagged afterDivergence. A
// density-limit stop replays the whole fixture behind the reserve.
// Routing: a pure fixture whose plain unlock leaves a compiler-owned external-call witness (`__internal__*`) unfilled
// runs again as a stateful fixture (StatefulContract building fills it) and is scored in the stateful slice.
// Pipeline-specific fixtures (`compileViaYul: true|false` settings: expectations of solc's via-IR or legacy pipeline
// only, often shipped as disagreeing twins) run as usual but are scored apart, outside both slices' rates.
// Size limits: every spend and deploy runs under the real BCH-2026 input, stack item and NFT commitment limits (the
// mock relaxes them). A line stopped by one runs again under the mock's relaxed limits and is scored apart
// (matched/mismatched-under-mock-size-limits, naming the limit); a stateful fixture replays from that line. A stop
// on a size limit in both runs is the line's own outcome.
// Output: semantic-results.json and semantic-scorecard.txt (pure slice, stateful section, pipeline section).
// Env: CORPUS_RESULTS, SOLC_CORPUS, LIMIT (selected fixtures), FILTER (path substring), SLICE=pure|stateful,
// CORPUS_WORKERS, FIXTURE_TIMEOUT_MS, CORPUS_OUTPUT_DIR, SELECT_ONLY=true|list (selection only, no execution),
// RESCORE=true (re-derive both reports from an existing semantic-results.json, no execution).
const BENCH_DIR = dirname(fileURLToPath(import.meta.url));
const COMPILE_OPTIONS = { evmCompat: true, enforceFinalRequire: false }; // bench.mjs covenant-safety policy
const SEMANTIC_PREFIX = 'test/libsolidity/semanticTests/';
const DENSITY_RESERVE = '-with-density-reserve'; // status suffix of a line retried behind a density reserve
// Stateful slice: forceStateful so a fixture whose state compiles away still deploys as a stateful contract.
const STATEFUL_COMPILE_OPTIONS = { ...COMPILE_OPTIONS, forceStateful: true };
const DENSITY_STOP = /operation cost density limit/;
// Real BCH-2026 values of the size limits MOCK_CONSENSUS_LIMITS relaxes (its operation-cost budget is real already).
const REAL_SIZE_LIMITS = { maximumInputBytes: 10_000, maximumStackItemBytes: 10_000, maximumNftCommitmentBytes: 128 };
const MOCK_SIZE = '-under-mock-size-limits'; // status suffix of a line re-run under the mock's relaxed size limits
// A stop on one of those limits, read from the whole error text and its causes (a byte-gate refusal lists its rules
// below its first line).
const SIZE_STOPS = [
  ['commitment', new RegExp('commitment[^\\n]*(?:exceeds limit|longer than the maximum size)|excessive token commitment '
    + 'length|NFT commitment limit|NFT commitment; active consensus permits', 'i')],
  ['input', new RegExp('unlocking bytecode exceeds the maximum bytecode length|excessive unlocking bytecode length'
    + '|consensus-unlocking-bytes|unlocking-bytecode bytes; maximum is|redeem script is \\d+ bytes \\(limit', 'i')],
  ['stack item', /exceeded the maximum stack item length|maximum stack item is \d+ bytes/i],
];
const sizeStop = (cause) => {
  let text = '';
  for (let c = cause, depth = 0; c && depth < 5; c = c.cause, depth++) {
    text += `\n${c.libauthErrorMessage ?? ''}\n${c.message ?? c}`;
  }
  const size = SIZE_STOPS.find(([, pattern]) => pattern.test(text))?.[0];
  return size ? { size } : {};
};
// A line re-run under the relaxed limits: the suffix replaces a density-reserve one (kept as a flag), and the line
// names the limit and the real run's outcome at that stop.
const underMockSizeLimits = ({ size: _size, status, ...rest }, limit, realOutcome) => ({
  ...rest,
  status: `${status.replace(DENSITY_RESERVE, '')}${MOCK_SIZE}`,
  sizeLimit: limit,
  realOutcome,
  ...(status.endsWith(DENSITY_RESERVE) && { densityReserve: true }),
});
const withoutSize = ({ size: _size, ...rest }) => rest;
// Wrapper shapes with the checks inside the target (see wrapSource). A derived wrapper hides the target's call-graph
// edges, so these refusals of it retry in the target, each recording its shape.
const IN_TARGET_LAYOUT = 'in-target: layout at';
const IN_TARGET_RETRIES = [
  [/^UnauthorizedLifecycleError: /, 'in-target: lifecycle refusal'],
  [/\[MESSAGE_BUS_REQUIRED\]/, 'in-target: message bus required'],
];
// A plain unlock cannot fill compiler-owned external-call witnesses; such a pure fixture routes to the stateful slice.
const WITNESS_GAP = /^build-error: Error: No value for '__internal__/;
const ROUTED = 'routed-to-stateful: external-call witnesses';
// `// ====` setting pinning a fixture's expectations to one solc pipeline.
const PIPELINE_SETTING = /^\/\/ ====\s*\n(?:\/\/.*\n)*?\/\/ compileViaYul:\s*(true|false)\s*$/m;
const pipelineOf = (src) => ({ true: 'via-IR', false: 'legacy' })[PIPELINE_SETTING.exec(src)?.[1]];
// A stateful send reports a VM failure either as FailedTransactionError or as the SDK's preflight/probe message.
const VM_ERROR = /preflight failed at input \d+: |^Program |\bProgram (?:failed|attempted|completed|exceeded)\b/;
const errHead = (cause) => `${cause?.name || 'Error'}: ${String(cause?.message).split('\n')[0]}`;
// The script ending non-truthy is the wrapper's final require failing where the SDK could not map it to a line.
const canonicalOutcome = (outcome) => (/^revert: .*completed with a non-truthy value on top of the stack/.test(outcome)
  ? 'wrong value (unmapped final verify)' : outcome);

// ---------------------------------------------------------------------------------------------- worker side

async function workerMain() {
  const { compileString, compileStringMulti } = await import(workerData.compilerUrl);
  const { Contract, TransactionBuilder, FailedTransactionError, FailedRequireError, randomUtxo } =
    await import(workerData.sdkUrl);
  const { default: MockNetworkProvider } = await import(workerData.mockUrl);
  const { SHARED_LIBRARY_SALT, keccakComputeLockingBytecode } = await import(workerData.utilsUrl);
  const { getContractFactory } = await import(workerData.statefulUrl);
  const noop = () => {};
  console.log = console.error = console.warn = console.info = noop;

  // Deployer-funded keccak256 compute side-cars (shared salt: the contract is stateless). A dynamic keccak loop
  // reads STATEFUL-covenant ones; the SDK probe needs N + 1 for N iterations, capped at 64.
  const fundKeccakSideCars = async (provider, stateful, count) => {
    const lock = Buffer.from(keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, stateful)).toString('hex');
    for (let i = 0; i < count; i++) {
      await provider.addUtxo(lock, {
        ...randomUtxo({ satoshis: 100_000n }),
        token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
  };

  // Same spend shape as packages/solidcash/test/conformance/bch.ts buildAndSend. `salt` is a deployer's density
  // reserve (a dropped redeem-script push), which raises the input's operation budget. No `limits`: the mock's own.
  const spend = async (artifact, args, salt, limits) => {
    const provider = new MockNetworkProvider(limits && { consensusLimits: limits });
    const contract = new Contract(artifact, [], { provider, ...(salt && { salt }) });
    const keccak = artifact.externalLibraries?.find((library) => library.name === 'keccak256' && library.resultNft);
    if (keccak) await fundKeccakSideCars(provider, false, Math.max(1, keccak.minInstances ?? 1));
    if (keccak?.unbounded) await fundKeccakSideCars(provider, true, 64 + 1);
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

  const attempt = async (artifact, requireLine, line, salt, limits) => {
    try {
      await spend(artifact, line.args, salt, limits);
      return line.failure
        ? { status: 'mismatched', outcome: 'success (no revert)' }
        : { status: 'matched', outcome: 'success' };
    } catch (cause) {
      if (!(cause instanceof FailedTransactionError)) {
        return { status: 'mismatched', outcome: `build-error: ${errHead(cause)}`, ...sizeStop(cause) };
      }
      const atCheck = cause instanceof FailedRequireError && cause.requireStatement?.line === requireLine;
      const outcome = canonicalOutcome(atCheck ? 'wrong value' : `revert: ${vmReason(cause)}`);
      return { status: line.failure ? 'matched' : 'mismatched', outcome, ...sizeStop(cause) };
    }
  };

  // A spend stopped by the op-cost density limit is retried once behind a 512-byte reserve (the SDK caps a salt at
  // 520); the status suffix keeps those lines apart from plain matches and mismatches.
  const runLineUnder = async (artifact, requireLine, line, limits) => {
    const first = await attempt(artifact, requireLine, line, undefined, limits);
    if (!/^revert: .*operation cost density limit/.test(first.outcome)) return first;
    const retry = await attempt(artifact, requireLine, line, new Uint8Array(512).fill(0x5a), limits);
    return { ...retry, status: `${retry.status}${DENSITY_RESERVE}` };
  };

  const runLine = async (artifact, requireLine, line) => {
    const { size, ...real } = await runLineUnder(artifact, requireLine, line, REAL_SIZE_LIMITS);
    if (!size) return real;
    const relaxed = await runLineUnder(artifact, requireLine, line);
    return relaxed.size ? real : underMockSizeLimits(relaxed, size, real.outcome);
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

  // Stateful slice: one deploy, then every runnable line in file order as its own transaction. Each run gets fresh
  // funding txids (a deploy's category) and fires the mock reset hooks, so no process-global cache crosses fixtures.
  // A send counter on the provider tells whether a reverted line broadcast anything (a partial state change).
  let fundingNonce = 0;
  // A check whose body creates a stateful child carries the deploy modifier. Its call's `.send()` is the plain call
  // without the child genesis the deploy covenant verifies, so such a line runs `.deploy()`: the child artifacts are
  // registered on the deployed contract and each line has its own vout-0 genesis coin.
  const deployChecks = new WeakMap(); // artifact -> { checks, children }
  const prepareDeployChecks = (artifact, source) => {
    const deploying = artifact.abi.filter((fn) => (fn.deployTargets?.length ?? 0) > 0);
    if (deploying.length === 0) return;
    const names = [...new Set(deploying.flatMap((fn) => fn.deployTargets.map((target) => target.contractName)))];
    let children = {};
    try {
      children = compileStringMulti(source, { ...STATEFUL_COMPILE_OPTIONS, compileDeclarations: names });
    } catch { /* the deploy then names the missing child as its build error */ }
    deployChecks.set(artifact, { checks: new Set(deploying.map((fn) => fn.name)), children });
  };
  const runSequence = async (artifact, sequence, salt, limits) => {
    const provider = new MockNetworkProvider(limits && { consensusLimits: limits });
    provider.reset();
    const counter = { sent: 0 };
    const sendRaw = provider.sendRawTransaction.bind(provider);
    provider.sendRawTransaction = async (hex) => { const txid = await sendRaw(hex); counter.sent += 1; return txid; };
    const signer = provider.getCachedSigner(0);
    const nonce = (++fundingNonce).toString(16).padStart(8, '0');
    const txid = `${nonce}${'5a'.repeat(28)}`;
    for (let vout = 0; vout < 8; vout++) {
      await provider.addUtxo(signer.getAddress(), { txid, vout, satoshis: 100_000_000n });
    }
    let contract;
    try {
      contract = await getContractFactory(artifact, signer).deploy(...(salt ? [{ salt }] : []));
    } catch (cause) {
      return { deployError: statefulOutcome(cause), ...sizeStop(cause) };
    }
    const deploying = deployChecks.get(artifact);
    if (deploying) {
      contract.registerArtifacts(deploying.children);
      for (let k = 0; k < sequence.length; k++) {
        const genesis = `${nonce}${k.toString(16).padStart(8, '0')}${'5b'.repeat(24)}`;
        await provider.addUtxo(signer.getAddress(), { txid: genesis, vout: 0, satoshis: 100_000_000n });
      }
    }
    const outcomes = [];
    for (const step of sequence) {
      const name = `__check_${step.check}`;
      outcomes.push(await statefulAttempt(contract.getFunction(name), step, counter, deploying?.checks.has(name)));
    }
    return { outcomes };
  };

  const statefulOutcome = (cause) => (cause instanceof FailedTransactionError || VM_ERROR.test(String(cause?.message))
    ? `revert: ${vmReason(cause)}` : `build-error: ${errHead(cause)}`);

  // A FAILURE line must revert without broadcasting. A value line that reverts is re-sent with cmp=false: success
  // there means a wrong value, and the call then still changes state as solc's call did.
  const sendCall = (call, deploys) => (deploys && typeof call.deploy === 'function' ? call.deploy() : call.send());
  const statefulAttempt = async (fn, step, counter, deploys) => {
    const before = counter.sent;
    try {
      await sendCall(fn(...step.args), deploys);
      return step.failure
        ? { status: 'mismatched', outcome: 'success (no revert)' }
        : { status: 'matched', outcome: 'success' };
    } catch (cause) {
      const outcome = statefulOutcome(cause);
      const reverted = outcome.startsWith('revert: ');
      const size = sizeStop(cause);
      if (step.failure) {
        const sent = counter.sent - before;
        if (!reverted || sent === 0) return { status: reverted ? 'matched' : 'mismatched', outcome, ...size };
        return { status: 'mismatched', outcome: `${outcome} (after ${sent} broadcast tx: state changed)`, ...size };
      }
      if (step.cmp && reverted && !DENSITY_STOP.test(outcome) && !size.size) {
        try {
          await sendCall(fn(...step.args.slice(0, -1), false), deploys);
          return { status: 'mismatched', outcome: 'wrong value' };
        } catch { /* the revert is not the comparison */ }
      }
      return { status: 'mismatched', outcome, ...size };
    }
  };

  // A line stopped by the density limit reruns the whole fixture behind the reserve (state must replay); lines from
  // the first stopped one on take the reserve run's results, tagged like the pure slice's retries.
  const runSequenceUnder = async (artifact, sequence, limits) => {
    const plain = await runSequence(artifact, sequence, undefined, limits);
    const at = plain.deployError ? (DENSITY_STOP.test(plain.deployError) ? 0 : -1)
      : plain.outcomes.findIndex((o) => DENSITY_STOP.test(o.outcome));
    if (at < 0) return plain;
    const reserve = await runSequence(artifact, sequence, new Uint8Array(512).fill(0x5a), limits);
    if (reserve.deployError) return { ...reserve, deployError: `${reserve.deployError} (with density reserve)` };
    const tagged = reserve.outcomes.map((o) => ({ ...o, status: `${o.status}${DENSITY_RESERVE}` }));
    return { outcomes: plain.deployError ? tagged : [...plain.outcomes.slice(0, at), ...tagged.slice(at)] };
  };

  // Real size limits first. From the first line (or deploy) stopped by one that the relaxed limits do not stop, the
  // lines take a relaxed replay's results; a deploy refused in both runs keeps the real refusal.
  const runStatefulArtifact = async (artifact, sequence) => {
    if (artifact.constructorInputs?.length) return { compiled: true, skip: 'constructor-inputs' };
    const real = await runSequenceUnder(artifact, sequence, REAL_SIZE_LIMITS);
    const kept = real.deployError ? { deployError: real.deployError } : { outcomes: real.outcomes.map(withoutSize) };
    if (!(real.deployError ? real.size : real.outcomes.some((o) => o.size))) return { compiled: true, ...kept };
    const relaxed = await runSequenceUnder(artifact, sequence);
    const at = real.deployError ? 0 : real.outcomes.findIndex((o, k) => o.size && !relaxed.outcomes?.[k]?.size);
    if (relaxed.deployError || at < 0) return { compiled: true, ...kept };
    const [limit, stop] = real.deployError ? [real.size, real.deployError]
      : [real.outcomes[at].size, real.outcomes[at].outcome];
    const tagged = relaxed.outcomes.map((o) => underMockSizeLimits(o, limit, stop));
    return { compiled: true, outcomes: [...(kept.outcomes ?? []).slice(0, at), ...tagged.slice(at)] };
  };

  // A derived wrapper refused for the target's hidden call-graph edges is compiled again with its checks inside it.
  const compileStateful = (source, fallback) => {
    let shape;
    try {
      return { artifact: compileString(source, STATEFUL_COMPILE_OPTIONS) };
    } catch (cause) {
      shape = fallback && IN_TARGET_RETRIES.find(([refusal]) => refusal.test(errHead(cause)))?.[1];
      if (!shape) return { error: errHead(cause) };
    }
    try {
      return { artifact: compileString(fallback, STATEFUL_COMPILE_OPTIONS), shape };
    } catch (cause) {
      return { error: errHead(cause), shape };
    }
  };

  const runStatefulJob = async ({ source, fallback, sequence }) => {
    const { artifact, error, shape } = compileStateful(source, fallback);
    if (artifact) prepareDeployChecks(artifact, source);
    const result = error ? { compiled: false, error } : await runStatefulArtifact(artifact, sequence);
    return { ...result, ...(shape && { shape }) };
  };

  parentPort.on('message', async ({ id, job }) => {
    try {
      if (job.stateful) {
        parentPort.postMessage({ id, stateful: await runStatefulJob(job.stateful) });
        return;
      }
      const checks = [];
      for (const check of job.checks) checks.push(await runCheck(check));
      if (job.route && checks.some((check) => check.lines?.some((line) => WITNESS_GAP.test(line.outcome)))) {
        parentPort.postMessage({ id, routed: await runStatefulJob(job.route) });
        return;
      }
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
    const layout = /\blayout\s+at\b/.test(header); // custom storage layout: solc forbids inheriting from it
    contracts.push({ kind, name: m[2], bases, close, layout, members: splitMembers(code, open + 1, close) });
    head.lastIndex = close + 1;
  }
  return contracts;
}

const NON_STATE_MEMBER =
  /^(?:function\s+[A-Za-z_$]|modifier\b|constructor\b|fallback\b|receive\b|struct\b|enum\b|event\b|error\b|using\b|type\b)/;
const isStateVariable = (text) => !NON_STATE_MEMBER.test(text) && !/\bconstant\b/.test(text);

// A public state variable's getter (stateful slice): mapping keys and array indices become parameters that index
// the variable directly in the wrapper; the elementary leaf type is the one return.
function parseGetter(text) {
  if (NON_STATE_MEMBER.test(text) || !/\bpublic\b/.test(text)) return undefined;
  const decl = text.split(/=(?!>)/)[0]
    .replace(/\b(?:public|constant|immutable|transient|override(?:\s*\([^)]*\))?)\b/g, ' ').trim();
  const m = /^([\s\S]*?)\s*\b([A-Za-z_$][\w$]*)$/.exec(decl);
  if (!m) return undefined;
  const name = m[2];
  let type = m[1].trim();
  const params = [];
  for (;;) {
    if (type.endsWith(']')) {
      type = type.slice(0, type.lastIndexOf('[')).trim();
      params.push({ src: 'uint256', abi: 'uint256' });
    } else if (/^mapping\s*\(/.test(type) && matchClose(type, type.indexOf('(')) === type.length - 1) {
      const inner = type.slice(type.indexOf('(') + 1, -1);
      const arrow = inner.indexOf('=>');
      const key = inner.slice(0, arrow).trim().split(/\s+/)[0];
      if (!elementaryAbi(key)) return { name, kind: typeKind(key) ?? 'type:other' };
      params.push({ src: key, abi: elementaryAbi(key) });
      type = inner.slice(arrow + 2).trim().replace(/^(\S.*?)\s+[A-Za-z_$][\w$]*$/, '$1'); // named value
    } else break;
  }
  const abi = elementaryAbi(type);
  if (!abi) return { name, kind: typeKind(type) ?? 'type:other' };
  const access = `${name}${params.map((_, k) => `[__a${k}]`).join('')}`;
  return { name, fn: { name, params, rets: [{ src: type, abi }], visibility: 'public', mutability: 'view', access } };
}

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
  // A fixture with state variables runs in the stateful slice; its later skips carry the tag.
  const stateful = Boolean(stateVariable);
  const skip = (reason) => ({ skip: reason, ...(stateful && { stateful: true }) });
  const byName = new Map(contracts.map((c) => [c.name, c]));
  const ancestry = [];
  for (const queue = [target]; queue.length > 0;) {
    const c = queue.shift();
    if (ancestry.includes(c)) continue;
    ancestry.push(c);
    for (const base of [...c.bases].reverse()) if (byName.has(base)) queue.push(byName.get(base));
  }
  if (ancestry.some((c) => c.members.some((mb) => /^constructor\s*\(\s*[^)\s]/.test(mb.text)))) {
    return skip('constructor-params');
  }
  const entries = parseEntries(src);
  if (entries.length === 0) return skip('no-calls');

  const checks = new Map();
  for (const entry of entries) {
    const call = parseCall(entry.text);
    if (call.skip) return skip(call.skip);
    for (const t of call.types) { const kind = typeKind(t); if (kind) return skip(kind); }
    const sigTypes = call.types.map(elementaryAbi);
    const sig = `${call.name}(${sigTypes.join(',')})`;
    if (/"/.test(call.argText) || (!call.failure && /"/.test(call.retText))) return skip('value:string-or-hex');
    let check = checks.get(sig);
    if (!check) {
      // A public state variable's getter wins over a base function it overrides (nothing can override it).
      const found = !stateful ? undefined : ancestry.flatMap((c) => c.members
        .map((member) => ({ contract: c, member, getter: parseGetter(member.text) })))
        .find((d) => d.getter?.name === call.name);
      if (found?.getter.kind) return skip(`getter-${found.getter.kind}`);
      const decls = found ? [] : ancestry.flatMap((c) => c.members
        .filter((mb) => mb.fn?.name === call.name && mb.fn.params.length === sigTypes.length
          && mb.fn.params.every((p, k) => p.abi === sigTypes[k]))
        .map((mb) => ({ contract: c, member: mb })));
      if (found && found.getter.fn.params.map((p) => p.abi).join() === sigTypes.join()) {
        decls.push({ contract: found.contract, member: { ...found.member, fn: found.getter.fn } });
      }
      if (decls.length === 0) return skip('no-matching-decl');
      const fn = decls[0].member.fn;
      if (fn.visibility === 'internal' || fn.visibility === 'private') return skip('not-external');
      const badRet = fn.rets.find((r) => !r.abi);
      if (badRet) return skip(`ret-${badRet.kind}`);
      check = { sig, name: call.name, decls, fn, lines: [] };
      checks.set(sig, check);
    }
    const argTokens = splitTop(call.argText);
    if (argTokens.length !== sigTypes.length) return skip('arg-arity');
    const argWords = argTokens.map(parseWord);
    if (argWords.some((w) => w === undefined)) return skip('value:unparsed');
    const retTokens = call.failure ? [] : splitTop(call.retText);
    if (!call.failure && retTokens.length !== check.fn.rets.length) return skip('ret-arity');
    const retWords = retTokens.map(parseWord);
    if (retWords.some((w) => w === undefined)) return skip('value:unparsed');
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
  const list = [...checks.values()];
  const statefulWrapper = buildStatefulWrapper(src, code, target, list);
  if (stateful) return { target: target.name, stateful: statefulWrapper };
  // A pure fixture keeps its stateful wrapper as the route for unfilled external-call witnesses.
  const wrappers = list.map((check) => buildWrapper(src, code, target, check));
  return { target: target.name, checks: wrappers, route: statefulWrapper };
}

const MUTABILITY_RANK = { pure: 0, view: 1, '': 2, payable: 2 };
const mutabilityRank = (check) => Math.max(...check.decls.map((d) => MUTABILITY_RANK[d.member.fn.mutability]));

// An `external` declaration (contract, not interface) is respelled `public` so the derived wrapper can call it
// internally; same length, so later offsets stay valid. The respelling is recorded in the results.
function respellExternal(src, code, decls) {
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
  return { edited, rewrote };
}

// One wrapper function: call the target, then require equal returns unless `__cmp` is false.
function checkFunction(check, name) {
  const { fn } = check;
  const mutability = ['pure', 'view', ''][mutabilityRank(check)];
  const params = [
    ...fn.params.map((p, k) => `${p.src} __a${k}`),
    ...fn.rets.map((r, k) => `${r.src} __e${k}`),
    ...(fn.rets.length > 0 ? ['bool __cmp'] : []),
  ];
  const callExpr = fn.access ?? `${check.name}(${fn.params.map((_, k) => `__a${k}`).join(', ')})`;
  const callStmt = fn.rets.length === 0 ? `${callExpr};`
    : fn.rets.length === 1 ? `${fn.rets[0].src} __r0 = ${callExpr};`
      : `(${fn.rets.map((r, k) => `${r.src} __r${k}`).join(', ')}) = ${callExpr};`;
  const cond = fn.rets.length === 0 ? 'true'
    : `!__cmp || (${fn.rets.map((_, k) => `__r${k} == __e${k}`).join(' && ')})`;
  return `    function ${name}(${params.join(', ')}) public${mutability ? ` ${mutability}` : ''} {
        ${callStmt}
        require(${cond});
    }`;
}

// The check functions go into a derived `contract __Check is <Target>`, or (`inTarget`) into a copy of the
// target's own body: solc forbids inheriting from a custom storage layout (`layout at`), and the compiler's
// message-bus auto-selection reads only the root contract's own functions, so a derived wrapper hides the target's
// call-graph edges. `requireLine` is the source line of the body's last `require(`.
function wrapSource(edited, target, body, inTarget) {
  const head = inTarget ? `${edited.slice(0, target.close).trimEnd()}\n\n`
    : `${edited.trimEnd()}\n\ncontract __Check is ${target.name} {\n`;
  const tail = inTarget ? `\n${edited.slice(target.close)}` : '\n}\n';
  const requireLine = head.split('\n').length + body.slice(0, body.lastIndexOf('        require(')).split('\n').length - 1;
  return { source: `${head}${body}${tail}`, requireLine };
}

// Wrapper source for one signature (pure slice).
function buildWrapper(src, code, target, check) {
  const { edited, rewrote } = respellExternal(src, code, check.decls);
  const { source, requireLine } = wrapSource(edited, target, checkFunction(check, '__check'), target.layout);
  return {
    sig: check.sig, source, requireLine, lines: check.lines,
    ...(rewrote && { rewrote: 'external->public' }), ...(target.layout && { shape: IN_TARGET_LAYOUT }),
  };
}

// Stateful slice: one wrapper with `__check_<k>` per signature, deployed once; `lines` is every line in file order
// with its check index, whether it carries `cmp`, and whether its function may write state. `inTargetSource` is
// the fallback for a derived wrapper the lifecycle policy refuses.
function buildStatefulWrapper(src, code, target, checks) {
  const { edited, rewrote } = respellExternal(src, code, checks.flatMap((check) => check.decls));
  const body = checks.map((check, k) => checkFunction(check, `__check_${k}`)).join('\n');
  const { source } = wrapSource(edited, target, body, target.layout);
  const lines = checks.flatMap((check, k) => check.lines.map((line) => ({
    ...line, check: k, cmp: check.fn.rets.length > 0, writes: mutabilityRank(check) === 2,
  }))).sort((a, b) => a.line - b.line);
  return {
    sigs: checks.map((check) => check.sig), source, lines, ...(rewrote && { rewrote: 'external->public' }),
    ...(target.layout ? { shape: IN_TARGET_LAYOUT } : { inTargetSource: wrapSource(edited, target, body, true).source }),
  };
}

// ------------------------------------------------------------------------------------------------ main side

// Worker message for a stateful wrapper: its source, the in-target fallback and the runnable lines in file order.
const statefulMessage = (wrapper) => ({
  source: wrapper.source,
  fallback: wrapper.inTargetSource,
  sequence: wrapper.lines.filter((l) => l.args).map(({ check, args, failure, cmp }) => ({ check, args, failure, cmp })),
});

async function main() {
  const OUTPUT_DIR = process.env.CORPUS_OUTPUT_DIR || BENCH_DIR;
  if (OUTPUT_DIR !== BENCH_DIR) mkdirSync(OUTPUT_DIR, { recursive: true });
  if (process.env.RESCORE === 'true') {
    const prior = JSON.parse(readFileSync(join(OUTPUT_DIR, 'semantic-results.json'), 'utf8'));
    for (const line of prior.fixtures.filter((f) => !f.stateful).flatMap((f) => f.lines ?? [])) {
      if (line.outcome) line.outcome = canonicalOutcome(line.outcome);
    }
    // Results older than the pipeline tag take it from the corpus source.
    const corpus = process.env.SOLC_CORPUS || prior.meta.corpusRoot;
    for (const f of prior.fixtures) f.pipeline ??= pipelineOf(readFileSync(join(corpus, f.rel), 'utf8'));
    writeReports(OUTPUT_DIR, { ...prior.meta, rescored: true }, prior.summary.candidates, prior.fixtures);
    return;
  }
  const ROOT = process.env.SOLC_CORPUS || '/Code/solidity';
  const RESULTS = process.env.CORPUS_RESULTS || join(BENCH_DIR, 'results.json');
  const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const FILTER = process.env.FILTER || '';
  const SLICE = process.env.SLICE || ''; // pure | stateful: run one slice only
  // Real size limits keep the SDK on its live-network VM path (no fast evaluators, full debug() probe traces).
  const FIXTURE_TIMEOUT_MS = process.env.FIXTURE_TIMEOUT_MS ? Number(process.env.FIXTURE_TIMEOUT_MS) : 600000;
  const WORKER_COUNT = process.env.CORPUS_WORKERS ? Number(process.env.CORPUS_WORKERS) : 8;
  const started = Date.now();

  const candidates = JSON.parse(readFileSync(RESULTS, 'utf8'))
    .filter((r) => r.status === 'OK' && r.rel.startsWith(SEMANTIC_PREFIX) && r.rel.includes(FILTER))
    .map((r) => r.rel).sort();
  const fixtures = [];
  const jobs = [];
  for (const rel of candidates) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const selected = selectFixture(src);
    const pipeline = pipelineOf(src);
    const tags = { ...(selected.stateful && { stateful: true }), ...(pipeline && { pipeline }) };
    if (SLICE && (SLICE === 'stateful') !== Boolean(selected.stateful)) continue;
    if (selected.skip || jobs.length >= LIMIT) {
      const { skip: reason, detail } = selected;
      if (reason) fixtures.push({ rel, status: 'skipped', reason, ...(detail && { detail }), ...tags });
      continue;
    }
    const fixture = { rel, status: 'run', target: selected.target, checks: [], lines: [], ...tags };
    fixtures.push(fixture);
    jobs.push({ fixture, checks: selected.checks, stateful: selected.stateful, route: selected.route });
  }
  const lineCount = (j) => (j.stateful ? j.stateful.lines.length : j.checks.reduce((m, c) => m + c.lines.length, 0));
  const statefulJobs = jobs.filter((j) => j.stateful);
  process.stderr.write(`  ${candidates.length} candidates, ${jobs.length} fixtures / `
    + `${jobs.reduce((n, j) => n + lineCount(j), 0)} lines selected (stateful: ${statefulJobs.length} fixtures / `
    + `${statefulJobs.reduce((n, j) => n + lineCount(j), 0)} lines)\n`);
  const sliceReason = (f) => `${f.stateful ? 'stateful/' : ''}${f.reason ?? f.status}`;
  if (process.env.SELECT_ONLY === 'list') {
    for (const f of fixtures) process.stdout.write(`${f.rel}  ${sliceReason(f)}  ${f.detail ?? ''}\n`);
    return;
  }
  if (process.env.SELECT_ONLY === 'true') {
    const reasons = tally(fixtures.filter((f) => f.status === 'skipped').map(sliceReason));
    for (const [reason, n] of reasons) process.stdout.write(`${String(n).padStart(5)}  ${reason}\n`);
    return;
  }

  const workerUrls = {
    compilerUrl: new URL('../../packages/solidc/dist/index.js', import.meta.url).href,
    sdkUrl: new URL('../../packages/solidcash/dist/index.js', import.meta.url).href,
    mockUrl: new URL('../../packages/solidcash/dist/network/MockNetworkProvider.js', import.meta.url).href,
    utilsUrl: new URL('../../packages/utils/dist/index.js', import.meta.url).href,
    statefulUrl: new URL('../../packages/solidcash/dist/stateful/index.js', import.meta.url).href,
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
          if (job.stateful) {
            active.postMessage({ id, job: { stateful: statefulMessage(job.stateful) } });
            return;
          }
          const runnable = job.checks.map((c) => ({
            source: c.source, requireLine: c.requireLine, lines: c.lines.filter((l) => l.args),
          }));
          active.postMessage({ id, job: { checks: runnable, route: statefulMessage(job.route) } });
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
      if (result.routed) {
        Object.assign(job.fixture, { stateful: true, routed: ROUTED });
        recordStatefulFixture({ fixture: job.fixture, stateful: job.route }, { stateful: result.routed });
      } else if (job.stateful) recordStatefulFixture(job, result);
      else recordFixture(job, result);
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
    statefulCompileOptions: STATEFUL_COMPILE_OPTIONS,
    sizeLimits: REAL_SIZE_LIMITS,
    slice: SLICE || null,
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
      ...(check.shape && { shape: check.shape }),
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

// Stateful replies come in file order. After a mismatch, or a skipped value line of a state-writing function, the
// fixture's state may already differ from solc's: later executed lines carry `afterDivergence`.
function recordStatefulFixture(job, result) {
  const { fixture, stateful } = job;
  const reply = result.stateful;
  if (result.error) fixture.status = 'error';
  fixture.checks = stateful.sigs.map((sig) => ({ sig }));
  Object.assign(fixture, {
    ...(stateful.rewrote && { rewrote: stateful.rewrote }),
    ...((reply?.shape ?? stateful.shape) && { shape: reply?.shape ?? stateful.shape }),
    ...(reply && { compiled: reply.compiled }),
    ...(reply?.skip && { skip: reply.skip }),
  });
  let diverged = false;
  let k = 0;
  for (const line of stateful.lines) {
    const base = { line: line.line, call: line.call };
    let record;
    if (line.status) record = { ...base, status: line.status, reason: line.reason };
    else if (result.error) record = { ...base, status: 'error', outcome: result.error };
    else if (!reply.compiled) record = { ...base, status: 'refused-at-compile', outcome: reply.error };
    else if (reply.skip) record = { ...base, status: 'skipped', reason: reply.skip };
    else if (reply.deployError) record = { ...base, status: 'refused-at-deploy', outcome: reply.deployError };
    else record = { ...base, ...reply.outcomes[k], ...(diverged && { afterDivergence: true }) };
    if (!line.status) k++;
    fixture.lines.push(record);
    // A routed fixture has no state variables, so a miss leaves no state behind.
    const diverges = record.status.startsWith('mismatched') || (line.status && !line.failure && line.writes);
    if (diverges && !fixture.routed) diverged = true;
  }
}

function tally(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

const limitTag = (line) => {
  if (line.status?.endsWith(DENSITY_RESERVE)) return '(with density reserve) ';
  if (!line.status?.endsWith(MOCK_SIZE)) return '';
  return `(under mock size limits: ${line.sizeLimit}${line.densityReserve ? ', with density reserve' : ''}) `;
};
const divergenceTag = (line) => (line.afterDivergence ? '(after divergence) ' : '');
const block = (title, entries) => [`--- ${title} ---`, ...entries.map(([k, n]) => `${String(n).padStart(5)}  ${k}`)];
const errorShape = (text) => String(text).replace(/'[^']*'/g, "'..'").replace(/\d+/g, 'N').slice(0, 120);
// Group key for an outcome: digits and quoted text folded so shapes aggregate.
const shapeOf = (line) => `${/->\s*FAILURE\b/.test(line.call) ? 'expected FAILURE' : 'expected values'}, got `
  + divergenceTag(line) + limitTag(line)
  + String(line.outcome).replace(/"[^"]*"/g, '".."').replace(/\d+/g, 'N').slice(0, 110);
// Lines a real size limit stopped, run under the mock's relaxed ones: by limit and by fixture, then the matched ones
// (the mismatched ones are listed with the mismatches, tagged with their limit).
const mockSizeBlocks = (prefix, lines) => {
  const sized = lines.filter((l) => l.status?.endsWith(MOCK_SIZE));
  return [
    ...block(`${prefix}UNDER MOCK SIZE LIMITS (by the real BCH-2026 limit that stopped the line, and status)`,
      tally(sized.map((l) => `${l.sizeLimit}: ${l.status}${l.afterDivergence ? ' (after divergence)' : ''}`))), '',
    ...block(`${prefix}UNDER MOCK SIZE LIMITS (lines by fixture and limit)`,
      tally(sized.map((l) => `${l.rel}  ${l.sizeLimit}`))), '',
    `--- ${prefix}MATCHED UNDER MOCK SIZE LIMITS (fixture:line  call  =>  outcome) ---`,
    ...sized.filter((l) => l.status.startsWith('matched'))
      .map((l) => `${l.rel}:${l.line}  ${l.call}  =>  ${divergenceTag(l)}${limitTag(l)}${l.outcome}`),
  ];
};

function writeReports(outputDir, meta, candidateCount, fixtures) {
  // The pure slice reports as before: a stateful fixture is one skipped for its state variables (or its routing).
  // Pipeline-specific fixtures are left to pipelineReport, outside both slices' rates.
  const pure = fixtures.map((f) => (f.stateful
    ? { rel: f.rel, status: 'skipped', reason: f.routed ?? 'state-variables' } : f));
  const run = pure.filter((f) => f.status !== 'skipped' && !f.pipeline);
  const lines = run.flatMap((f) => f.lines.map((l) => ({ ...l, rel: f.rel })));
  const count = (status) => lines.filter((l) => l.status === status).length;
  const summary = {
    candidates: candidateCount,
    selectedFixtures: run.length,
    skippedFixtures: Object.fromEntries(tally(pure.filter((f) => f.status === 'skipped').map((f) => f.reason))),
    lines: {
      selected: lines.length,
      matched: count('matched'),
      matchedWithDensityReserve: count(`matched${DENSITY_RESERVE}`),
      mismatched: count('mismatched'),
      mismatchedWithDensityReserve: count(`mismatched${DENSITY_RESERVE}`),
      matchedUnderMockSizeLimits: count(`matched${MOCK_SIZE}`),
      mismatchedUnderMockSizeLimits: count(`mismatched${MOCK_SIZE}`),
      refusedAtCompile: count('refused-at-compile'),
      skipped: count('skipped'),
      error: count('error'),
    },
    lineSkipReasons: Object.fromEntries(tally(lines.filter((l) => l.status === 'skipped').map((l) => l.reason))),
  };
  const stateful = statefulReport(fixtures.filter((f) => f.stateful));
  summary.stateful = stateful.summary;
  const pipelines = pipelineReport(fixtures);
  summary.pipelines = pipelines.summary;
  writeFileSync(join(outputDir, 'semantic-results.json'), `${JSON.stringify({ meta, summary, fixtures }, null, 1)}\n`);

  const L = summary.lines;
  const executed = L.matched + L.matchedWithDensityReserve + L.mismatched + L.mismatchedWithDensityReserve
    + L.matchedUnderMockSizeLimits + L.mismatchedUnderMockSizeLimits;
  const pct = executed ? ((100 * L.matched) / executed).toFixed(2) : '0.00';
  const header = `=== SOLC SEMANTIC RUNTIME PARITY (first slice): ${L.matched}/${executed} executed lines matched `
    + `(${pct}%) | ${L.matchedWithDensityReserve} matched-with-density-reserve | ${L.mismatched} mismatched `
    + `| ${L.mismatchedWithDensityReserve} mismatched-with-density-reserve | ${L.matchedUnderMockSizeLimits} `
    + `matched-under-mock-size-limits | ${L.mismatchedUnderMockSizeLimits} mismatched-under-mock-size-limits `
    + `| ${L.refusedAtCompile} refused-at-compile | ${L.skipped} skipped | ${L.error} error | ${run.length} fixtures `
    + `run of ${candidateCount} compiled candidates `
    + `| ${meta.elapsedSeconds}s ===`;
  const mismatches = lines.filter((l) => l.status?.startsWith('mismatched'));
  const out = [
    header, stateful.header, pipelines.header, '',
    ...block('FIXTURES SKIPPED (by reason)', Object.entries(summary.skippedFixtures)), '',
    ...block('LINES (selected fixtures)', [['selected', L.selected], ['matched', L.matched],
      [`matched${DENSITY_RESERVE}`, L.matchedWithDensityReserve], ['mismatched', L.mismatched],
      [`mismatched${DENSITY_RESERVE}`, L.mismatchedWithDensityReserve],
      [`matched${MOCK_SIZE}`, L.matchedUnderMockSizeLimits], [`mismatched${MOCK_SIZE}`, L.mismatchedUnderMockSizeLimits],
      ['refused-at-compile', L.refusedAtCompile], ['skipped', L.skipped], ['error (timeout/worker)', L.error]]), '',
    ...block('LINES SKIPPED (by reason)', Object.entries(summary.lineSkipReasons)), '',
    ...block('MISMATCH SHAPES', tally(mismatches.map(shapeOf))), '',
    ...block('REFUSED-AT-COMPILE (by error head, per line)', tally(lines.filter((l) => l.status === 'refused-at-compile')
      .map((l) => errorShape(l.outcome)))), '',
    ...block('WRAPPER INSIDE THE TARGET (fixtures, by reason)', tally(run
      .map((f) => f.checks?.find((c) => c.shape)?.shape).filter(Boolean))), '',
    '--- MATCHED WITH DENSITY RESERVE (fixture:line  call  =>  outcome) ---',
    ...lines.filter((l) => l.status === `matched${DENSITY_RESERVE}`)
      .map((l) => `${l.rel}:${l.line}  ${l.call}  =>  ${l.outcome}`), '',
    ...mockSizeBlocks('', lines), '',
    '--- MISMATCHES (fixture:line  call  =>  outcome) ---',
    ...mismatches.map((l) => `${l.rel}:${l.line}  ${l.call}  =>  ${limitTag(l)}${l.outcome}`), '',
    ...stateful.blocks, '',
    ...pipelines.blocks,
    '',
  ];
  writeFileSync(join(outputDir, 'semantic-scorecard.txt'), out.join('\n'));
  process.stdout.write(`\n${header}\n${stateful.header}\n${pipelines.header}\n`);
}

// Stateful slice section. Executed lines after a divergence are counted apart from the clean ones.
function statefulReport(fixtures) {
  const run = fixtures.filter((f) => f.status !== 'skipped' && !f.pipeline);
  const lines = run.flatMap((f) => f.lines.map((l) => ({ ...l, rel: f.rel })));
  const count = (status, after = false) => lines
    .filter((l) => l.status === status && Boolean(l.afterDivergence) === after).length;
  const executed = (after) => ['matched', 'mismatched'].flatMap((s) => [s, `${s}${DENSITY_RESERVE}`, `${s}${MOCK_SIZE}`])
    .reduce((n, s) => n + count(s, after), 0);
  const summary = {
    fixturesWithState: fixtures.filter((f) => !f.routed).length,
    routedFixtures: fixtures.filter((f) => f.routed).length,
    selectedFixtures: run.length,
    skippedFixtures: Object.fromEntries(tally(fixtures.filter((f) => f.status === 'skipped').map((f) => f.reason))),
    lines: {
      selected: lines.length,
      matched: count('matched'),
      matchedWithDensityReserve: count(`matched${DENSITY_RESERVE}`),
      mismatched: count('mismatched'),
      mismatchedWithDensityReserve: count(`mismatched${DENSITY_RESERVE}`),
      matchedUnderMockSizeLimits: count(`matched${MOCK_SIZE}`),
      mismatchedUnderMockSizeLimits: count(`mismatched${MOCK_SIZE}`),
      afterDivergence: {
        executed: executed(true),
        matched: count('matched', true) + count(`matched${DENSITY_RESERVE}`, true),
        matchedUnderMockSizeLimits: count(`matched${MOCK_SIZE}`, true),
      },
      refusedAtCompile: count('refused-at-compile'),
      refusedAtDeploy: count('refused-at-deploy'),
      skipped: count('skipped'),
      error: count('error'),
    },
    lineSkipReasons: Object.fromEntries(tally(lines.filter((l) => l.status === 'skipped').map((l) => l.reason))),
  };
  const L = summary.lines;
  const clean = executed(false);
  const pct = clean ? ((100 * L.matched) / clean).toFixed(2) : '0.00';
  const header = `=== STATEFUL SLICE (deploy once, lines in order): ${L.matched}/${clean} executed lines matched `
    + `(${pct}%) | ${L.matchedWithDensityReserve} matched-with-density-reserve | ${L.mismatched} mismatched `
    + `| ${L.mismatchedWithDensityReserve} mismatched-with-density-reserve | ${L.matchedUnderMockSizeLimits} `
    + `matched-under-mock-size-limits | ${L.mismatchedUnderMockSizeLimits} mismatched-under-mock-size-limits `
    + `| after divergence ${L.afterDivergence.matched}/${L.afterDivergence.executed} matched `
    + `| ${L.refusedAtCompile} refused-at-compile `
    + `| ${L.refusedAtDeploy} refused-at-deploy | ${L.skipped} skipped | ${L.error} error | ${run.length} fixtures `
    + `run of ${summary.fixturesWithState} with state variables + ${summary.routedFixtures} routed from the pure slice ===`;
  const mismatches = lines.filter((l) => l.status?.startsWith('mismatched'));
  const blocks = [
    header, '',
    ...block('STATEFUL FIXTURES SKIPPED (by reason)', Object.entries(summary.skippedFixtures)), '',
    ...block('STATEFUL LINES (selected fixtures; after-divergence lines counted apart)', [['selected', L.selected],
      ['matched', L.matched], [`matched${DENSITY_RESERVE}`, L.matchedWithDensityReserve],
      ['mismatched', L.mismatched], [`mismatched${DENSITY_RESERVE}`, L.mismatchedWithDensityReserve],
      [`matched${MOCK_SIZE}`, L.matchedUnderMockSizeLimits], [`mismatched${MOCK_SIZE}`, L.mismatchedUnderMockSizeLimits],
      ['matched after-divergence', L.afterDivergence.matched],
      [`matched${MOCK_SIZE} after-divergence`, L.afterDivergence.matchedUnderMockSizeLimits],
      ['mismatched after-divergence', L.afterDivergence.executed - L.afterDivergence.matched
        - L.afterDivergence.matchedUnderMockSizeLimits],
      ['refused-at-compile', L.refusedAtCompile], ['refused-at-deploy', L.refusedAtDeploy],
      ['skipped', L.skipped], ['error (timeout/worker)', L.error]]), '',
    ...block('STATEFUL LINES SKIPPED (by reason)', Object.entries(summary.lineSkipReasons)), '',
    ...block('STATEFUL MISMATCH SHAPES', tally(mismatches.map(shapeOf))), '',
    ...block('STATEFUL FAILURE LINES MATCHED (by revert reason)', tally(lines
      .filter((l) => l.status?.startsWith('matched') && /->\s*FAILURE\b/.test(l.call)).map((l) => errorShape(l.outcome)))),
    '',
    ...block('STATEFUL REFUSED (by status and error head, per line)', tally(lines
      .filter((l) => l.status?.startsWith('refused')).map((l) => `${l.status}: ${errorShape(l.outcome)}`))), '',
    ...block('STATEFUL WRAPPER INSIDE THE TARGET (fixtures, by reason)', tally(run.filter((f) => f.shape)
      .map((f) => f.shape))), '',
    '--- STATEFUL LINES ROUTED FROM THE PURE SLICE (external-call witnesses; fixture:line  call  =>  status: outcome) ---',
    ...run.filter((f) => f.routed).flatMap((f) => f.lines
      .map((l) => `${f.rel}:${l.line}  ${l.call}  =>  ${l.status}: ${l.outcome ?? l.reason}`)), '',
    '--- STATEFUL MATCHED WITH DENSITY RESERVE (fixture:line  call  =>  outcome) ---',
    ...lines.filter((l) => l.status?.startsWith(`matched${DENSITY_RESERVE}`))
      .map((l) => `${l.rel}:${l.line}  ${l.call}  =>  ${divergenceTag(l)}${l.outcome}`), '',
    ...mockSizeBlocks('STATEFUL ', lines), '',
    '--- STATEFUL MISMATCHES (fixture:line  call  =>  outcome) ---',
    ...mismatches.map((l) => `${l.rel}:${l.line}  ${l.call}  =>  ${divergenceTag(l)}${limitTag(l)}${l.outcome}`),
  ];
  return { summary, header, blocks };
}

// Pipeline-specific fixtures of both slices, outside both rates: per pipeline the clean executed lines matched (as in
// the slice headers), then solc's twin pairs (same name once a pipeline suffix is stripped) with the pipeline whose
// expectations SolidCash met on every executed line.
const PIPELINES = ['legacy', 'via-IR'];
const TWIN_SUFFIX = /_(?:via_?(?:ir|yul)|ir|legacy|(?:old|new)codegen)(?=\.sol$)/i;
const isExecuted = (line) => /^(?:mis)?matched/.test(line.status);

function pipelineReport(fixtures) {
  const tagged = fixtures.filter((f) => f.pipeline);
  const run = tagged.filter((f) => f.status !== 'skipped');
  const lines = run.flatMap((f) => f.lines
    .map((l) => ({ ...l, rel: f.rel, pipeline: f.pipeline, slice: f.stateful ? 'stateful' : 'pure' })));
  const summary = Object.fromEntries(PIPELINES.map((p) => {
    const own = lines.filter((l) => l.pipeline === p);
    const clean = own.filter((l) => isExecuted(l) && !l.afterDivergence);
    return [p, { fixtures: run.filter((f) => f.pipeline === p).length, selected: own.length, executed: clean.length,
      matched: clean.filter((l) => l.status === 'matched').length }];
  }));
  const executedOf = (f) => (f.lines ?? []).filter(isExecuted);
  const met = (f) => executedOf(f).length > 0 && executedOf(f).every((l) => l.status.startsWith('matched'));
  const side = (f) => (f.status === 'skipped' ? `${f.pipeline} skipped: ${f.reason}` : `${f.pipeline} `
    + `${executedOf(f).filter((l) => l.status.startsWith('matched')).length}/${executedOf(f).length} matched`
    + ` of ${f.lines.length} lines`);
  const twins = [...Map.groupBy(tagged, (f) => f.rel.replace(TWIN_SUFFIX, '')).values()]
    .filter((pair) => pair.length === 2 && pair[0].pipeline !== pair[1].pipeline)
    .map((pair) => {
      const sides = PIPELINES.map((p) => pair.find((f) => f.pipeline === p));
      const held = sides.filter(met).map((f) => f.pipeline);
      const verdict = held.length === 2 ? 'both'
        : held[0] ?? (sides.every((f) => executedOf(f).length > 0) ? 'neither' : 'unmeasured');
      const text = `${verdict.padEnd(10)}  ${sides[0].rel.slice(SEMANTIC_PREFIX.length)} [${side(sides[0])}]  vs  `
        + `${sides[1].rel.split('/').pop()} [${side(sides[1])}]`;
      return { legacy: sides[0].rel, viaIR: sides[1].rel, verdict, text };
    });
  summary.twins = twins.map(({ text: _text, ...twin }) => twin);
  const verdicts = tally(twins.map((t) => t.verdict)).map(([v, n]) => `${n} ${v}`).join(', ');
  const header = '=== PIPELINE-SPECIFIC EXPECTATIONS (compileViaYul true/false, excluded from both rates): '
    + `${PIPELINES.map((p) => `${p} ${summary[p].matched}/${summary[p].executed}`).join(' | ')} executed lines `
    + `matched | ${run.length} fixtures run of ${tagged.length} | ${twins.length} twin pairs: `
    + `${verdicts || 'none'} ===`;
  const blocks = [
    header, '',
    ...block('PIPELINE-SPECIFIC LINES (pipeline, slice, status)', tally(lines
      .map((l) => `${l.pipeline} ${l.slice} ${l.status}${l.afterDivergence ? ' (after divergence)' : ''}`))
      .sort((a, b) => a[0].localeCompare(b[0]))), '',
    '--- PIPELINE TWIN PAIRS (verdict: the pipeline whose expectations matched every executed line) ---',
    ...twins.map((t) => t.text), '',
    '--- PIPELINE-SPECIFIC LINES NOT MATCHED (fixture:line  call  =>  outcome) ---',
    ...lines.filter((l) => !l.status.startsWith('matched') && l.status !== 'skipped')
      .map((l) => `[${l.pipeline}] ${l.rel}:${l.line}  ${l.call}  =>  ${divergenceTag(l)}`
        + `${l.status.startsWith('mismatched') ? limitTag(l) : `${l.status}: `}${l.outcome}`),
  ];
  return { summary, header, blocks };
}

if (isMainThread) await main();
else await workerMain();
