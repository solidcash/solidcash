// F3 CORPUS-FIT PROBE. Compiles the four real corpora in this repo TWICE - once in the ordinary direct mode
// the existing benches use, once in message-bus participant mode - and records, per contract, exactly what the
// F2 estimator's descriptor needs: whether an SCB1 route exists at all, the named refusal when it does not,
// the route's balanced block size, and the instantiated master redeem-script length.
//
// Nothing here estimates or measures a transaction. It produces the CENSUS that
// `layer3-corpus-census-f3.ts` records and `Layer3CorpusFitF3.test.ts` consumes, so that the fit report rests
// on compile outputs taken at one named commit rather than on figures copied forward from an older run.
//
//   node packages/solidcash/test/e2e/layer3-corpus-probe-f3.mjs            # every corpus, DRY RUN
//   F3_CORPORA=mistswap,eacc node .../layer3-corpus-probe-f3.mjs           # a subset
//   F3_LIMIT=200 node .../layer3-corpus-probe-f3.mjs                       # smoke run
//   F3_WRITE_CENSUS=1 F3_COMMIT=<sha> node .../layer3-corpus-probe-f3.mjs  # RE-TAKE the committed census
//
// Writes JSON to F3_OUT (default: the scratchpad path below).
//
// X112. RUNNING THIS SCRIPT USED TO OVERWRITE `layer3-corpus-census-f3.ts` AS A SIDE EFFECT, every time,
// including a `F3_LIMIT=200` smoke run and a single-corpus run. The census is a committed 11,476-line record
// that four tests assert against and that is stamped with the compiler commit it was taken at, so a probe run
// intended to look at one corpus silently replaced it with a partial one under an `UNSTAMPED` commit. Writing
// it is now OPT-IN (`F3_WRITE_CENSUS=1`), and a partial run refuses to write it at all - the census's own test
// exists to catch rows from two compilers under one stamp, and this is the mechanism that produced them.

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');
const solidc = await import(join(repo, 'packages', 'solidc', 'dist', 'index.js'));
const sdk = await import(join(repo, 'packages', 'solidcash', 'dist', 'index.js'));

const { compileFile, compileFileMulti } = solidc;
const { Contract, MockNetworkProvider } = sdk;

/* ---------------------------------------------------------------------------------------------------- */
/* Compile options                                                                                        */
/* ---------------------------------------------------------------------------------------------------- */

// A message-bus participant is compiled exactly as every capstone compiles one: forced stateful, hidden-batch
// route synthesis on, and an authenticated graph controller declared. The controller identity is a fixed
// stand-in - route synthesis reads only whether one is DECLARED plus its bytes, never a live UTXO - so the
// census is reproducible without a provider. A real deployment substitutes its own controller and the redeem
// script changes by the difference in the two locking bytecodes, which is zero here because both are p2sh32.
const CONTROLLER_LBC = `aa20${'11'.repeat(32)}87`;
const CONTROLLER_CATEGORY = '22'.repeat(32);

// `ecrecover: 'p2pkh'` is the porting alias the EA and MistSwap benches compile with; without it every
// contract that uses Solidity's builtin fails on an undefined symbol before anything about the bus is reached.
const DIRECT_OPTIONS = { solidityImportCompat: true, ecrecover: 'p2pkh' };
const BUS_OPTIONS = {
  ...DIRECT_OPTIONS,
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: CONTROLLER_LBC,
  experimentalMessageBusControllerCategory: CONTROLLER_CATEGORY,
};

/* ---------------------------------------------------------------------------------------------------- */
/* Corpora                                                                                                */
/* ---------------------------------------------------------------------------------------------------- */

const SBE_ROOT = process.env.SBE_ROOT || '/Code/solidity-by-example';
const SOLC_ROOT = process.env.SOLC_CORPUS || '/Code/solidity';
const EACC_ROOT = process.env.EACC_CONTRACTS_DIR || '/Code/effectiveacceleration.ai/contract/contracts';
const MISTSWAP_ROOT = process.env.MISTSWAP_ROOT || '/Code/mistswap/mistswap/contracts';

// Copied from examples/solidity-by-example/bench.mjs so the SBE denominator here is the SAME denominator that
// bench's scorecard uses. Out of scope: contracts bound to specific Ethereum-mainnet counterparties, and the
// EVM storage-slot internals demo.
const SBE_EXCLUDED = new Set([
  'defi/chronicle-price-oracle/chroniclePriceOracle.sol',
  'defi/dai-proxy/DaiProxy.sol',
  'defi/uniswap-v2-add-remove-liquidity/UniswapV2Liquidity.sol',
  'defi/uniswap-v2-flash-swap/UniswapV2FlashSwap.sol',
  'defi/uniswap-v2-optimal-one-sided-supply/Optimal.sol',
  'defi/uniswap-v3-flash-swap/UniswapV3FlashSwap.sol',
  'defi/uniswap-v3-liquidity/UniswapV3Liquidity.sol',
  'defi/uniswap-v3-swap/UniswapV3SingleHopSwap.sol',
  'defi/uniswap-v3-swap/UniswapV3MultiHopSwap.sol',
  'evm/storage/EVMStorage.sol',
]);
const SBE_NEGATIVE = new Set(['inheritance/Inheritance.sol']);

// The sixteen top-level MistSwap targets the recorded bench uses: ten at the contracts root, the four
// uniswapv2 core contracts, Timelock and BentoBoxV1.
const MISTSWAP_TARGETS = [
  'MasterChef.sol', 'MasterChefV2.sol', 'Migrator.sol', 'Multicall2.sol', 'Ownable.sol',
  'SushiBar.sol', 'SushiMaker.sol', 'SushiMakerKashi.sol', 'SushiRoll.sol', 'SushiToken.sol',
  'uniswapv2/UniswapV2ERC20.sol', 'uniswapv2/UniswapV2Factory.sol', 'uniswapv2/UniswapV2Pair.sol',
  'uniswapv2/UniswapV2Router02.sol',
  'governance/Timelock.sol', 'bentobox/BentoBoxV1.sol',
];

const findSol = (root) => (existsSync(root)
  ? execSync(`find ${root} -name '*.sol'`).toString().trim().split('\n').filter(Boolean).sort()
  : []);

/** solc-corpus bucketing, verbatim from examples/solidity-corpus/bench.mjs so the denominator matches. */
function solcClassify(source) {
  if (source.includes('==== Source:') || source.includes('==== ExternalSource:')) return 'MULTIFILE';
  const index = source.search(/\n\/\/ ----/);
  if (index >= 0 && /^\/\/ \w*Error \d+:/m.test(source.slice(index))) return 'NEGATIVE';
  return 'INSCOPE';
}

function corpora() {
  const list = [];
  list.push({
    name: 'mistswap',
    root: MISTSWAP_ROOT,
    files: MISTSWAP_TARGETS.map((target) => join(MISTSWAP_ROOT, target)).filter((file) => existsSync(file)),
    skip: () => undefined,
  });
  // Same directory filter `examples/effectiveacceleration/tasks/compile-real.mjs` applies: the app's own
  // contracts, not the OpenZeppelin tree vendored under `@openzeppelin/`, which is a dependency rather than a
  // corpus of contracts anyone wrote here.
  list.push({
    name: 'eacc',
    root: EACC_ROOT,
    files: findSol(EACC_ROOT)
      .filter((file) => !file.includes('/node_modules/') && !file.split('/').some((part) => part.startsWith('@'))),
    skip: () => undefined,
  });
  list.push({
    name: 'solidity-by-example',
    root: join(SBE_ROOT, 'contracts', 'src'),
    files: findSol(join(SBE_ROOT, 'contracts', 'src')),
    skip: (rel) => (SBE_EXCLUDED.has(rel) ? 'EXCLUDED' : (SBE_NEGATIVE.has(rel) ? 'NEGATIVE' : undefined)),
  });
  list.push({
    name: 'solc-corpus',
    root: SOLC_ROOT,
    files: findSol(SOLC_ROOT),
    skip: (rel, file) => {
      let source;
      try { source = readFileSync(file, 'utf8'); } catch { return 'READERR'; }
      const bucket = solcClassify(source);
      return bucket === 'INSCOPE' ? undefined : bucket;
    },
  });
  const only = process.env.F3_CORPORA?.split(',').map((name) => name.trim()).filter(Boolean);
  return only ? list.filter((corpus) => only.includes(corpus.name)) : list;
}

/* ---------------------------------------------------------------------------------------------------- */
/* Placeholder constructor arguments                                                                      */
/* ---------------------------------------------------------------------------------------------------- */

const zeros = (length) => new Uint8Array(length);

/**
 * A syntactically valid value for a constructor parameter type, so that `contract.bytecode` can be read.
 *
 * The redeem script's length depends on the ENCODED LENGTH of each constructor argument, not on its value, and
 * every choice below is the shortest valid encoding of its type. A deployment that passes a longer value (a
 * large integer, a longer `bytes`) has a proportionally longer redeem script, so a census figure is a lower
 * bound for that contract and is labelled as such. Returns undefined for a type this cannot synthesize, which
 * is recorded as an uninstantiable contract rather than guessed at.
 */
function placeholder(type) {
  const name = String(type);
  if (/^u?int\d*$/.test(name) || name === 'bigint') return 1n;
  if (name === 'bool') return false;
  if (name === 'string') return '';
  if (name === 'address') return `aa20${'33'.repeat(32)}87`;
  if (name === 'pubkey') return zeros(33);
  if (name === 'sig') return zeros(65);
  if (name === 'datasig') return zeros(64);
  if (name === 'bytes') return zeros(0);
  const fixed = /^bytes(\d+)$/.exec(name);
  if (fixed) return zeros(Number(fixed[1]));
  return undefined;
}

/* ---------------------------------------------------------------------------------------------------- */
/* Probe                                                                                                  */
/* ---------------------------------------------------------------------------------------------------- */

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;
const noop = () => {};
const mute = () => { console.log = console.error = console.warn = console.info = noop; };
const unmute = () => {
  console.log = originalLog; console.error = originalError;
  console.warn = originalWarn; console.info = originalInfo;
};

const errorHead = (error) => `${error?.name || 'Error'}: ${String(error?.message).split('\n')[0]}`;

/**
 * ONE COMPILE METHOD FOR ALL FOUR CORPORA, and it counts CONTRACTS rather than files.
 *
 * `compileFileMulti` compiles every top-level declaration; it throws for the whole file if any one of them
 * fails, which would drop a perfectly good contract because a sibling in the same file does not compile. So a
 * throw falls back to `compileFile`, keeping the file's primary contract. The wider of the two answers is the
 * right one for the F3 question - how many contracts could reach the bus - since dropping a compiling contract
 * because of a sibling would UNDERSTATE the reachable set.
 *
 * This is deliberately not what the solc-corpus and solidity-by-example benches measure (`compileFile` alone,
 * counted per file), so nothing here is that scorecard and it must not be read as one.
 *
 * WHAT THE FALLBACK COSTS, because it is not free and the recorded census does not say so. When it is taken,
 * the file contributes ONE contract instead of all of its top-level declarations, so the `contracts`
 * denominator shrinks by the siblings, and in bus mode those siblings are recorded as failures. The error is
 * kept as `siblingError` and both paths now attribute it (X84); before that, only the direct path did.
 * Measured at `77cd1e8c` on the two application corpora: 6 rows took the direct fallback and 5 the bus one.
 */
function tryCompile(file, options) {
  mute();
  try {
    const map = compileFileMulti(file, options);
    unmute();
    return { map, method: 'multi' };
  } catch (multiError) {
    try {
      const artifact = compileFile(file, options);
      unmute();
      return { map: { [artifact.contractName]: artifact }, method: 'primary', siblingError: errorHead(multiError) };
    } catch (error) {
      unmute();
      return { error: errorHead(error) };
    }
  }
}

/** Concrete, deployable artifacts only: an interface yields an ABI-only declaration with no bytecode. */
const concreteArtifacts = (map) => Object.entries(map)
  .filter(([, artifact]) => typeof artifact?.bytecode === 'string' && artifact.bytecode.length > 0);

/** Per-entry-point reasons out of the `hidden-batch-route-not-synthesized` diagnostic's rendered message. */
function absenceReasons(artifact) {
  const diagnostic = artifact.diagnostics
    ?.find((entry) => entry.code === 'hidden-batch-route-not-synthesized');
  if (!diagnostic) return { present: false, reasons: [] };
  const stated = /Rejected entry points - ([^.]*)\./.exec(diagnostic.message);
  if (!stated) return { present: true, reasons: ['no-entry-point-declared'] };
  return {
    present: true,
    reasons: stated[1].split('; ').map((entry) => entry.split(': ').slice(1).join(': ').trim())
      .filter(Boolean),
  };
}

/** `new Contract(...).bytecode.length` with a category pinned, i.e. exactly what a bus participant deploys. */
function redeemBytesOf(artifact) {
  const inputs = artifact.constructorInputs ?? [];
  const args = [];
  for (const input of inputs) {
    const value = placeholder(input.type);
    if (value === undefined) return { error: `unsynthesizable-constructor-type:${input.type}` };
    args.push(value);
  }
  try {
    const provider = new MockNetworkProvider();
    const base = new Contract(artifact, args, { provider });
    const pinned = artifact.stateLayout ? base.withCategory(zeros(32)) : base;
    return { bytes: pinned.bytecode.length / 2 };
  } catch (error) {
    return { error: errorHead(error) };
  }
}

/** One row per CONCRETE contract; a file that does not compile contributes a single file-level row. */
function probeOne(file, rel, corpus) {
  const direct = tryCompile(file, DIRECT_OPTIONS);
  if (direct.error) return [{ corpus, rel, direct: 'FAIL', directError: direct.error }];
  const directArtifacts = concreteArtifacts(direct.map);
  if (directArtifacts.length === 0) {
    return [{ corpus, rel, direct: 'OK', declarationsOnly: true }];
  }
  const bus = tryCompile(file, BUS_OPTIONS);
  const busArtifacts = bus.error ? new Map() : new Map(concreteArtifacts(bus.map));

  return directArtifacts.map(([name, directArtifact]) => {
    const row = {
      corpus,
      rel,
      contractName: name,
      direct: 'OK',
      directMethod: direct.method,
      directStateful: Boolean(directArtifact.stateLayout),
      abiFunctions: directArtifact.abi?.length ?? 0,
      ...(direct.siblingError && { directSiblingError: direct.siblingError }),
    };
    if (bus.error) {
      row.bus = 'FAIL';
      row.busError = bus.error;
      return row;
    }
    const artifact = busArtifacts.get(name);
    if (artifact === undefined) {
      row.bus = 'FAIL';
      // X84. NAME THE CAUSE INSTEAD OF THE SYMPTOM. `tryCompile` falls back from `compileFileMulti` to
      // `compileFile`, and it records the multi error as `siblingError`. The direct path keeps it; this path
      // used to throw it away and stamp every OTHER contract in the file with a head that names no cause at
      // all, which is why the recorded census attributes 15 of its 96 bus-failure rows to nothing. Measured at
      // `77cd1e8c`, all five EA rows are ONE `InvalidParameterTypeError` on `meceTags` at
      // MarketplaceDataV1.sol:126, reached only in bus mode, and none of it is in the census.
      //
      // The distinction the old head carried is kept on the row rather than in the head: `busAbsentFromMap`
      // records the mechanism, and the head names the error, because a histogram of heads is a histogram of
      // CAUSES. A contract genuinely absent from a successful map - an interface, a declaration the bus mode
      // does not emit - has no sibling error and still reads as absent.
      row.busAbsentFromMap = true;
      row.busError = bus.siblingError ?? 'Error: contract absent from the bus-mode artifact map';
      if (bus.siblingError) row.busSiblingError = bus.siblingError;
      return row;
    }
    row.bus = 'OK';
    if (!artifact.hiddenBatch) {
      row.route = 'ABSENT';
      row.rejectionReasons = absenceReasons(artifact).reasons;
      return row;
    }
    const handlers = artifact.hiddenBatch.handlers ?? [];
    row.route = 'PRESENT';
    row.handlerCount = handlers.length;
    row.eligibleHandlers = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
    // WHICH admitted handlers can change anything. `writesState: false` is the compiler's own proof that a
    // function is read-only; absent means unknown, which is read here as writing. A participant whose entire
    // admitted surface is read-only can be co-spent but cannot do anything in the graph that a plain read
    // could not, so this is the difference between a reachable contract and a useful one.
    const writesOf = (name) => directArtifact.abi?.find((entry) => entry.name === name)?.writesState !== false;
    row.eligibleWrites = row.eligibleHandlers.filter(writesOf);
    row.refusedWrites = handlers.filter((handler) => !handler.eligible && writesOf(handler.name)).length;
    row.rejectionReasons = [...new Set(handlers.filter((handler) => !handler.eligible)
      .map((handler) => handler.rejectionReason ?? 'unnamed'))];
    row.blockSize = artifact.hiddenBatch.route.blockLayout?.blockSize;
    row.maximumRows = artifact.hiddenBatch.maximumRows;
    row.maximumBlobBytes = artifact.hiddenBatch.maximumBlobBytes;
    row.constructorTypes = (artifact.constructorInputs ?? []).map((input) => String(input.type));
    const redeem = redeemBytesOf(artifact);
    if (redeem.error) row.redeemError = redeem.error;
    else row.redeemBytes = redeem.bytes;
    return row;
  });
}

const limit = process.env.F3_LIMIT ? Number(process.env.F3_LIMIT) : Infinity;
// A SYSTEMATIC sample, for a corpus too large to compile twice in full. Every stride-th in-scope file is
// probed, which spreads the sample across the whole sorted corpus; a `F3_LIMIT` prefix would instead take an
// alphabetical block, which for a corpus laid out by feature directory is a sample of one or two features.
const stride = process.env.F3_STRIDE ? Number(process.env.F3_STRIDE) : 1;
const out = process.env.F3_OUT
  || '/tmp/claude-0/-Code-cashscript/97db2cb3-5b7a-49a1-82fd-6dd1634533cf/scratchpad/f3-census.json';

const rows = [];
const skipped = {};
const files = {};

/**
 * ENRICHMENT PASS. `F3_ENRICH=a.json,b.json` recompiles ONLY the files that produced a bus-reachable contract
 * and fills in the write classification for census runs taken before it existed, then rewrites each file in
 * place. Recompiling seventy files rather than five thousand is the whole reason this is a separate pass.
 */
if (process.env.F3_ENRICH) {
  for (const path of process.env.F3_ENRICH.split(',')) {
    const census = JSON.parse(readFileSync(path, 'utf8'));
    const targets = [...new Set(census.rows
      .filter((row) => (row.eligibleHandlers?.length ?? 0) > 0)
      .map((row) => `${row.corpus}\u0000${row.rel}`))];
    let done = 0;
    for (const target of targets) {
      const [corpus, rel] = target.split('\u0000');
      const root = { mistswap: MISTSWAP_ROOT, eacc: EACC_ROOT, 'solc-corpus': SOLC_ROOT }[corpus]
        ?? join(SBE_ROOT, 'contracts', 'src');
      const fresh = probeOne(join(root, rel), rel, corpus);
      for (const row of fresh) {
        const existing = census.rows.find((candidate) => candidate.corpus === corpus
          && candidate.rel === rel && candidate.contractName === row.contractName);
        if (!existing) continue;
        existing.eligibleWrites = row.eligibleWrites;
        existing.refusedWrites = row.refusedWrites;
      }
      done += 1;
      if (done % 20 === 0) process.stderr.write(`  enriched ${done}/${targets.length} of ${path}\n`);
    }
    writeFileSync(path, JSON.stringify(census, null, 1));
    process.stderr.write(`enriched ${targets.length} files in ${path}\n`);
  }
  process.exit(0);
}

// MERGE. The corpora are probed in separate processes because they take very different lengths of time;
// `F3_MERGE=a.json,b.json` combines their outputs and emits one recorded module from all of them.
if (process.env.F3_MERGE) {
  for (const path of process.env.F3_MERGE.split(',')) {
    const census = JSON.parse(readFileSync(path, 'utf8'));
    rows.push(...census.rows);
    for (const [key, count] of Object.entries(census.skipped ?? {})) {
      skipped[key] = (skipped[key] ?? 0) + count;
    }
    for (const [key, count] of Object.entries(census.files ?? {})) {
      files[key] = (files[key] ?? 0) + count;
    }
  }
}

/**
 * R3-16: REFUSE TO CENSUS AN UNPINNED CORPUS. Wiring supplied as a BLOCKED hunk by the R3-16 worker, whose
 * `layer3-corpus-pins.json` manifest and `layer3-corpus-pins.ts` verifier this reads. Before this, four
 * external checkouts were pinned to nothing, so re-running against drifted sources silently changed the
 * denominator of every percentage the board quotes.
 *
 * Two SILENT-DEGRADATION paths made that invisible, and they are the same shape as X113's eroding size rule
 * in the consumer: `findSol` returns `[]` for a missing root, so an ABSENT corpus contributed zero files while
 * the run still reported a total, and the mistswap target list is filtered by `existsSync`, so a RENAMED
 * target shrank the denominator quietly. A guard whose subject can vanish while it stays green is the defect,
 * so both are refusals.
 *
 * This does NOT import the verifier: the probe is `.mjs` and plain `node` cannot load the `.ts` module. It
 * does not need to - the probe is already the authority on the file list, so it verifies its OWN `corpora()`
 * output against the manifest and reimplements no selection logic. The digest layer is left to
 * `layer3-corpus-pins.ts`: hashing 7,343 files inside a 29-minute run buys little, and commit plus counts are
 * the two layers that move a denominator.
 *
 * Set F3_ALLOW_UNPINNED=1 for a deliberately unpinned exploratory census; the refusal text names what is
 * given up, and no figure from such a run may be recorded as a census.
 */
function verifyCorpusPinsOrRefuse(active) {
  const manifestPath = join(here, 'layer3-corpus-pins.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`corpus-pin refusal: the pin manifest is missing at ${manifestPath}; a census run cannot `
      + 'report a reproducible denominator without it.');
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const refusals = [];
  for (const corpus of active) {
    const pin = manifest.corpora.find((entry) => entry.name === corpus.name);
    if (!pin) {
      refusals.push(`corpus-pin refusal: '${corpus.name}' has no entry in layer3-corpus-pins.json.`);
      continue;
    }
    if (!existsSync(corpus.root)) {
      refusals.push(`corpus-pin refusal: '${corpus.name}' is absent at ${corpus.root}, so its `
        + `${pin.inScopeCount} in-scope files would contribute nothing while this run still reports a total. `
        + `Recreate it or set ${pin.envVar}.`);
      continue;
    }
    if (corpus.files.length !== pin.fileCount) {
      refusals.push(`corpus-pin refusal: '${corpus.name}' file count moved, pinned ${pin.fileCount} and found `
        + `${corpus.files.length}. Every percentage over this corpus would have a different denominator than `
        + 'the one it was recorded against.');
    }
    let head = '';
    try {
      const top = execSync(`git -C ${corpus.root} rev-parse --show-toplevel 2>/dev/null`).toString().trim();
      head = top ? execSync(`git -C ${top} rev-parse HEAD 2>/dev/null`).toString().trim() : '';
    } catch { head = ''; }
    if (!head) {
      refusals.push(`corpus-pin refusal: '${corpus.name}' at ${corpus.root} is not inside a git checkout, so `
        + `its identity cannot be confirmed against pinned ${pin.commit}.`);
    } else if (head !== pin.commit) {
      refusals.push(`corpus-pin refusal: '${corpus.name}' is at ${head}, pinned ${pin.commit}. Nothing would `
        + 'distinguish a compiler change from a corpus change in this census.');
    }
  }
  if (refusals.length === 0) return;
  const message = `corpus-pin refusal: ${refusals.length} finding(s):\n- ${refusals.join('\n- ')}`;
  if (process.env.F3_ALLOW_UNPINNED) {
    console.error(`${message}\n\nF3_ALLOW_UNPINNED is set: continuing. This run is NOT a reproducible census.`);
    return;
  }
  throw new Error(message);
}

const activeCorpora = process.env.F3_MERGE ? [] : corpora();
if (activeCorpora.length > 0) verifyCorpusPinsOrRefuse(activeCorpora);

for (const corpus of activeCorpora) {
  let seen = 0;
  let inScope = 0;
  const started = Date.now();
  for (const file of corpus.files) {
    if (seen >= limit) break;
    const rel = file.replace(`${corpus.root}/`, '');
    const skip = corpus.skip(rel, file);
    if (skip) {
      skipped[`${corpus.name}/${skip}`] = (skipped[`${corpus.name}/${skip}`] ?? 0) + 1;
      continue;
    }
    inScope += 1;
    if ((inScope - 1) % stride !== 0) {
      skipped[`${corpus.name}/NOT-IN-SAMPLE`] = (skipped[`${corpus.name}/NOT-IN-SAMPLE`] ?? 0) + 1;
      continue;
    }
    seen += 1;
    files[corpus.name] = (files[corpus.name] ?? 0) + 1;
    rows.push(...probeOne(file, rel, corpus.name));
    if (seen % 250 === 0) {
      process.stderr.write(`  ${corpus.name} ${seen}/${corpus.files.length} `
        + `(${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
    }
  }
  process.stderr.write(`${corpus.name}: ${seen} probed in ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
}

writeFileSync(out, JSON.stringify({ skipped, files, rows }, null, 1));
process.stderr.write(`\nwrote ${rows.length} rows to ${out}\n`);

/* ---------------------------------------------------------------------------------------------------- */
/* The recorded census module                                                                             */
/* ---------------------------------------------------------------------------------------------------- */

// The solc corpus alone is thousands of rows, so what is RECORDED is the distillate the fit report and its
// test consume: per-corpus gate counts, the named-refusal histogram, the compile-failure heads, and the FULL
// row for every contract that reaches the bus. Same choice `layer3-estimator-basis-f2.ts` makes and for the
// same reason - a committed basis has to stay reviewable.
const tally = (values) => {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1]));
};
const head = (message) => String(message).replace(/'[^']*'/g, "'..'").replace(/\d+/g, 'N').slice(0, 90);

const gates = {};
const rejections = {};
const directHeads = {};
const busHeads = {};
for (const corpus of [...new Set(rows.map((row) => row.corpus))]) {
  const subset = rows.filter((row) => row.corpus === corpus);
  const compiled = subset.filter((row) => row.direct === 'OK');
  const busOk = compiled.filter((row) => row.bus === 'OK');
  const routed = busOk.filter((row) => row.route === 'PRESENT');
  const eligible = routed.filter((row) => (row.eligibleHandlers?.length ?? 0) > 0);
  const instantiable = eligible.filter((row) => typeof row.redeemBytes === 'number');
  gates[corpus] = {
    files: files[corpus] ?? 0,
    contracts: subset.length,
    skipped: Object.fromEntries(Object.entries(skipped)
      .filter(([key]) => key.startsWith(`${corpus}/`))
      .map(([key, count]) => [key.slice(corpus.length + 1), count])),
    directOk: compiled.length,
    busOk: busOk.length,
    routePresent: routed.length,
    eligibleHandler: eligible.length,
    instantiable: instantiable.length,
  };
  rejections[corpus] = tally(routed.concat(busOk.filter((row) => row.route === 'ABSENT'))
    .flatMap((row) => row.rejectionReasons ?? []));
  directHeads[corpus] = tally(subset.filter((row) => row.direct === 'FAIL').map((row) => head(row.directError)));
  busHeads[corpus] = tally(compiled.filter((row) => row.bus === 'FAIL').map((row) => head(row.busError)));
}
const eligibleRows = rows.filter((row) => (row.eligibleHandlers?.length ?? 0) > 0);

const module = `import type { CensusGates, CensusRow } from './layer3-corpus-fit-f3.js';

/**
 * THE RECORDED F3 CORPUS CENSUS, produced by \`layer3-corpus-probe-f3.mjs\` at the commit named below by
 * compiling every contract in the four corpora TWICE - once in the ordinary direct mode the existing benches
 * use, once in message-bus participant mode - and reading the compiler's own answers.
 *
 * Every number here is a COMPILE OUTPUT, never a transaction measurement. Where a contract lands against the
 * BCH-2026 limits is estimated by F2 or measured by F1; neither is recorded here.
 *
 * Distilled rather than dumped: the solc corpus alone is thousands of rows, so the per-corpus gate counts, the
 * named-refusal histogram and the compile-failure heads are recorded in full, and the complete row is kept for
 * every contract that reaches the bus. Regenerate with:
 *
 *   F3_WRITE_CENSUS=1 F3_COMMIT=<sha> node packages/solidcash/test/e2e/layer3-corpus-probe-f3.mjs
 *   npx eslint --fix packages/solidcash/test/e2e/layer3-corpus-census-f3.ts
 *
 * X112: without \`F3_WRITE_CENSUS\`, the probe writes its module to a scratch path and leaves this file alone.
 * It used to overwrite this file on EVERY run, a partial one included.
 *
 * The second line is not optional: the module is emitted with \`JSON.stringify\`, whose double quotes this
 * repository's lint rejects. Measured cost of a full four-corpus re-take at stride 12: 29 minutes.
 *
 * F3_CENSUS_COMMIT IS THE COMPILER COMMIT THESE ROWS WERE COMPILED AGAINST, not the commit that committed the
 * file. Every figure here is an output of that compiler, so a consumer reporting a different commit is quoting
 * a record rather than a measurement - which is fine for a gate count and is NOT fine for a quantity the
 * consumer could recompile. The built-graph rows in \`Layer3EstimatorF2.test.ts\` and \`Layer3CorpusFitF3.test.ts\`
 * therefore take block size and redeem length from their own compile and report any disagreement with this
 * file as drift; three solc-corpus redeem lengths had drifted before that was done, and the population of the
 * built corpus row silently fell from 45 to 43 because the disagreement was being caught inside a try/catch.
 */
export const F3_CENSUS_COMMIT = '${process.env.F3_COMMIT ?? 'UNSTAMPED'}';

/** Corpora present in this census, in the order they were merged. A partial re-take shows up here. */
export const F3_CENSUS_CORPORA: string[] = ${JSON.stringify([...new Set(rows.map((row) => row.corpus))])};

export const F3_CENSUS_GATES: Record<string, CensusGates> = ${JSON.stringify(gates, null, 2)};

/** Named route refusals, per corpus, counted per rejected entry point (a contract can contribute several). */
export const F3_CENSUS_REJECTIONS: Record<string, Record<string, number>> = ${JSON.stringify(rejections, null, 2)};

/** Direct-mode compile-failure heads: what stops a corpus contract from being a SolidCash contract at all. */
export const F3_CENSUS_DIRECT_FAILURES: Record<string, Record<string, number>> =
  ${JSON.stringify(directHeads, null, 2)};

/** Bus-mode compile-failure heads: contracts that compile directly but not as a participant. */
export const F3_CENSUS_BUS_FAILURES: Record<string, Record<string, number>> = ${JSON.stringify(busHeads, null, 2)};

/** Every contract with at least one eligible SCB1 handler, in full. This is the bus-reachable corpus. */
export const F3_CENSUS_ELIGIBLE: CensusRow[] = ${JSON.stringify(eligibleRows, null, 2)};
`;
// X112. The committed census is written only when asked for it by name, and never from a partial run.
const committedCensus = join(here, 'layer3-corpus-census-f3.ts');
const scratchCensus = `${out.replace(/\.json$/, '')}-census-f3.ts`;
const wantsCommitted = process.env.F3_MODULE_OUT === committedCensus
  || (process.env.F3_MODULE_OUT === undefined && process.env.F3_WRITE_CENSUS !== undefined);
const partial = process.env.F3_LIMIT !== undefined
  || process.env.F3_CORPORA !== undefined
  || process.env.F3_MERGE !== undefined;
if (wantsCommitted && partial) {
  throw new Error('refusing to overwrite the committed census from a PARTIAL run: F3_LIMIT / F3_CORPORA / '
    + 'F3_MERGE is set, and a partial re-take leaves rows from two compilers under one commit stamp. Take the '
    + 'full four-corpus run, or set F3_MODULE_OUT to a scratch path.');
}
if (wantsCommitted && process.env.F3_COMMIT === undefined) {
  throw new Error('refusing to overwrite the committed census without F3_COMMIT: the stamp is what makes every '
    + 'recorded figure attributable to a compiler, and UNSTAMPED silently detaches all of them.');
}
const moduleOut = process.env.F3_MODULE_OUT ?? (wantsCommitted ? committedCensus : scratchCensus);
writeFileSync(moduleOut, module);
process.stderr.write(`wrote recorded census module to ${moduleOut}\n`);
if (!wantsCommitted) {
  process.stderr.write('the COMMITTED census was not touched; re-take it with F3_WRITE_CENSUS=1 F3_COMMIT=<sha>\n');
}

for (const corpus of [...new Set(rows.map((row) => row.corpus))]) {
  const subset = rows.filter((row) => row.corpus === corpus);
  const compiled = subset.filter((row) => row.direct === 'OK');
  const busOk = subset.filter((row) => row.bus === 'OK');
  const routed = subset.filter((row) => row.route === 'PRESENT');
  process.stderr.write(`${corpus.padEnd(22)} probed=${String(subset.length).padStart(5)} `
    + `direct-OK=${String(compiled.length).padStart(5)} bus-OK=${String(busOk.length).padStart(5)} `
    + `route=${String(routed.length).padStart(5)}\n`);
}
