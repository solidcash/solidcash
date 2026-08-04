/**
 * VERIFICATION OF THE FOUR EXTERNAL CORPUS CHECKOUTS THE F3 CENSUS READS (row R3-16).
 *
 * The census produces the board's headline claims about real contracts while reading four working directories
 * that were pinned to nothing. `message-bus-corpus-pins.json` records their identity; this verifies a live checkout
 * against it.
 *
 * THE DESIGN RULE IS THAT AN UNVERIFIABLE CORPUS IS A NAMED REFUSAL, NEVER A SILENT PASS. The probe's own file
 * discovery degrades quietly in two ways, which is what makes that rule load-bearing:
 *
 *   - `findSol` returns [] when its root does not exist, so a MISSING corpus contributes zero files and the
 *     census still reports a total;
 *   - the mistswap target list is `.filter(existsSync)`, so a renamed or removed target silently shrinks the
 *     denominator.
 *
 * Neither raises anything today. `assertCorpusPinsOrRefuse` is what a censusing run must call so that both
 * become refusals with the corpus named.
 *
 * Verification is deliberately three-layered, because no single layer is sufficient:
 *   1. commit    - the upstream identity;
 *   2. counts    - the census's actual denominators, which a commit does NOT pin (the harness's own exclusion
 *                  sets also move them: solidity-by-example went 139 -> 141 in-scope with its pin unchanged);
 *   3. digest    - content of exactly the files the census reads, which catches a dirty tree at a matching
 *                  commit and an unpinnable checkout that has no git metadata at all.
 *
 * The whole check measured 3.8 s including all 7,343 solc-corpus file reads, so nothing here is sampled.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CorpusPin {
  name: string;
  envVar: string;
  defaultRoot: string;
  censusSubdir: string;
  upstream: string;
  branch: string;
  commit: string;
  commitReachableFromUpstream: boolean;
  nearestUpstreamAncestor?: string;
  fileCount: number;
  inScopeCount: number;
  fileSetDigest: string;
  notes: string[];
  recreate: string[];
}

export interface CorpusSampling {
  stride: number;
  sampled: number;
  population: number;
  /** False once the stride is DERIVED from the recorded counts rather than guessed. See `stridesConsistentWith`. */
  strideIsInferred: boolean;
  /** True when the probe emitted the exact stride alongside this recorded census denominator. */
  strideRecordedByProbe: boolean;
}

export interface RecordedCensusSampling {
  stride: number;
  population: number;
  sampled: number;
}

/**
 * Every stride that could have produced `sampled` files from `population` in-scope files, under the probe's
 * own rule (`message-bus-corpus-probe-f3.mjs:487`: keep when `(inScope - 1) % stride === 0`).
 *
 * This is what turns the recorded stride from a guess into a derivation. `ceil(population / stride) === sampled`
 * shows a stride is CONSISTENT with the counts; a search showing it is the ONLY consistent one establishes it.
 * A search returning several values means the counts do not determine the stride and the pin is unverifiable.
 */
export const stridesConsistentWith = (population: number, sampled: number): number[] => {
  const fits: number[] = [];
  for (let stride = 1; stride <= population; stride += 1) {
    if (Math.ceil(population / stride) === sampled) fits.push(stride);
  }
  return fits;
};

export interface CorpusManifest {
  recordedAt: string;
  recordedAtRepoCommit: string;
  samplingOfTheRecordedCensus: { byCorpus: Record<string, CorpusSampling> };
  corpora: CorpusPin[];
}

/** Fail loudly when a generated census's recorded sampling inputs disagree with its manifest or gate counts. */
export const assertRecordedSamplingOrRefuse = (
  manifest: CorpusManifest,
  recorded: Record<string, RecordedCensusSampling>,
  gates: Record<string, { files: number }>,
): void => {
  const expected = manifest.samplingOfTheRecordedCensus.byCorpus;
  const names = [...new Set([...Object.keys(expected), ...Object.keys(recorded), ...Object.keys(gates)])].sort();
  const refusals: string[] = [];
  for (const name of names) {
    const pin = expected[name];
    const actual = recorded[name];
    const gate = gates[name];
    if (!pin || !actual || !gate) {
      refusals.push(`'${name}' is missing from ${!pin ? 'the sampling manifest' : !actual
        ? 'F3_CENSUS_SAMPLING' : 'F3_CENSUS_GATES'}`);
      continue;
    }
    if (actual.stride !== pin.stride) refusals.push(`'${name}' stride is ${actual.stride}, pinned ${pin.stride}`);
    if (actual.population !== pin.population) {
      refusals.push(`'${name}' population is ${actual.population}, pinned ${pin.population}`);
    }
    if (actual.sampled !== pin.sampled) {
      refusals.push(`'${name}' sampled count is ${actual.sampled}, pinned ${pin.sampled}`);
    }
    if (actual.sampled !== gate.files) {
      refusals.push(`'${name}' sampling records ${actual.sampled} files but its census gate records ${gate.files}`);
    }
  }
  if (refusals.length > 0) {
    throw new Error(`corpus-sampling refusal: ${refusals.length} finding(s):\n- ${refusals.join('\n- ')}`);
  }
};

/** Terminal state of one corpus. Only `verified` means the census may use it without qualification. */
export type CorpusVerdict = 'verified' | 'drifted' | 'unpinnable' | 'absent';

export interface CorpusStatus {
  name: string;
  verdict: CorpusVerdict;
  root: string;
  /** Every specific reason the corpus is not `verified`, each naming the corpus and the field that moved. */
  refusals: string[];
  measured: {
    present: boolean;
    gitRoot?: string;
    head?: string;
    fileCount?: number;
    fileSetDigest?: string;
  };
}

const here = dirname(fileURLToPath(import.meta.url));

export const MANIFEST_PATH = join(here, 'message-bus-corpus-pins.json');

export const loadCorpusManifest = (path: string = MANIFEST_PATH): CorpusManifest => {
  if (!existsSync(path)) {
    throw new Error(`corpus-pin refusal: the pin manifest is missing at ${path}. The census cannot report a `
      + 'reproducible denominator without it.');
  }
  return JSON.parse(readFileSync(path, 'utf8')) as CorpusManifest;
};

/** Resolves the root the census would actually read, honouring the same env var the probe honours. */
export const corpusRoot = (pin: CorpusPin, env: NodeJS.ProcessEnv = process.env): string => {
  const overridden = env[pin.envVar];
  const base = overridden && overridden.length > 0 ? overridden : pin.defaultRoot;
  // SBE_ROOT names the checkout root while the census reads contracts/src beneath it; the other three env
  // vars already name the directory the census reads.
  return pin.name === 'solidity-by-example' ? join(base, 'contracts', 'src') : base;
};

const git = (dir: string, args: string[]): string => {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim();
  } catch {
    return '';
  }
};

/**
 * Every filesystem read below is memoized per process. Classifying the solc corpus reads all 7,343 files, and a
 * verification run touches each corpus from several angles, so without this the same corpus is re-read per call.
 * A census run verifies once and a test process does not mutate the corpora, so caching cannot hide a change.
 */
const listCache = new Map<string, string[]>();
const inScopeCache = new Map<string, number>();
const digestCache = new Map<string, string>();

const listSol = (root: string): string[] => {
  const cached = listCache.get(root);
  if (cached !== undefined) return cached;
  let files: string[];
  try {
    files = execFileSync('find', [root, '-name', '*.sol'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .trim().split('\n').filter(Boolean).sort();
  } catch {
    files = [];
  }
  listCache.set(root, files);
  return files;
};

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

const MISTSWAP_TARGETS = [
  'MasterChef.sol', 'MasterChefV2.sol', 'Migrator.sol', 'Multicall2.sol', 'Ownable.sol',
  'SushiBar.sol', 'SushiMaker.sol', 'SushiMakerKashi.sol', 'SushiRoll.sol', 'SushiToken.sol',
  'uniswapv2/UniswapV2ERC20.sol', 'uniswapv2/UniswapV2Factory.sol', 'uniswapv2/UniswapV2Pair.sol',
  'uniswapv2/UniswapV2Router02.sol',
  'governance/Timelock.sol', 'bentobox/BentoBoxV1.sol',
];

/**
 * The file set the census reads, replicating `message-bus-corpus-probe-f3.mjs`'s selection per corpus. It must stay
 * identical to the probe's: a divergence here would verify a different subject than the census measures, which
 * is the same class of defect this row exists to close.
 */
export const censusFiles = (pin: CorpusPin, root: string): string[] => {
  if (pin.name === 'mistswap') {
    return MISTSWAP_TARGETS.map((target) => join(root, target)).filter((file) => existsSync(file));
  }
  if (pin.name === 'eacc') {
    return listSol(root).filter((file) =>
      !file.includes('/node_modules/') && !file.split('/').some((part) => part.startsWith('@')));
  }
  return listSol(root);
};

const inScope = (pin: CorpusPin, root: string, files: string[]): number => {
  const key = `${pin.name} ${root} ${files.length}`;
  const cached = inScopeCache.get(key);
  if (cached !== undefined) return cached;
  const computed = countInScope(pin, root, files);
  inScopeCache.set(key, computed);
  return computed;
};

const countInScope = (pin: CorpusPin, root: string, files: string[]): number => {
  if (pin.name === 'solidity-by-example') {
    return files.filter((file) => {
      const rel = file.slice(root.length + 1);
      return !SBE_EXCLUDED.has(rel) && !SBE_NEGATIVE.has(rel);
    }).length;
  }
  if (pin.name !== 'solc-corpus') return files.length;
  return files.filter((file) => {
    let source: string;
    try { source = readFileSync(file, 'utf8'); } catch { return false; }
    if (source.includes('==== Source:') || source.includes('==== ExternalSource:')) return false;
    const index = source.search(/\n\/\/ ----/);
    return !(index >= 0 && /^\/\/ \w*Error \d+:/m.test(source.slice(index)));
  }).length;
};

export const digestOf = (root: string, files: string[]): string => {
  const key = `${root} ${files.length} ${files[files.length - 1] ?? ''}`;
  const cached = digestCache.get(key);
  if (cached !== undefined) return cached;
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.slice(root.length + 1));
    hash.update(readFileSync(file));
  }
  const digest = `sha256:${hash.digest('hex')}`;
  digestCache.set(key, digest);
  return digest;
};

/** Verifies one corpus against its pin. Never returns `verified` on evidence it could not obtain. */
export const verifyCorpus = (pin: CorpusPin, env: NodeJS.ProcessEnv = process.env): CorpusStatus => {
  const root = corpusRoot(pin, env);
  const refusals: string[] = [];

  if (!existsSync(root)) {
    return {
      name: pin.name,
      verdict: 'absent',
      root,
      measured: { present: false },
      refusals: [
        `corpus-pin refusal: '${pin.name}' is absent at ${root}, so its ${pin.inScopeCount} in-scope files `
        + 'cannot contribute to the census. The probe would silently measure zero files from it. Recreate it '
        + `(${pin.recreate.join(' ')}) or set ${pin.envVar}.`,
      ],
    };
  }

  const files = censusFiles(pin, root);
  const measuredDigest = digestOf(root, files);
  const gitRoot = git(root, ['rev-parse', '--show-toplevel']);
  const head = gitRoot ? git(gitRoot, ['rev-parse', 'HEAD']) : '';
  const measured = {
    present: true,
    gitRoot: gitRoot || undefined,
    head: head || undefined,
    fileCount: files.length,
    fileSetDigest: measuredDigest,
  };

  if (files.length !== pin.fileCount) {
    refusals.push(`corpus-pin refusal: '${pin.name}' file count moved, pinned ${pin.fileCount} and measured `
      + `${files.length}. Every percentage the board quotes over this corpus has a different denominator than `
      + 'the one it was recorded against.');
  }
  const measuredInScope = inScope(pin, root, files);
  if (measuredInScope !== pin.inScopeCount) {
    refusals.push(`corpus-pin refusal: '${pin.name}' in-scope count moved, pinned ${pin.inScopeCount} and `
      + `measured ${measuredInScope}. This is the census denominator itself.`);
  }
  if (measuredDigest !== pin.fileSetDigest) {
    refusals.push(`corpus-pin refusal: '${pin.name}' content digest moved, pinned ${pin.fileSetDigest} and `
      + `measured ${measuredDigest}. The files the census reads are not the files it was pinned against.`);
  }
  if (!head) {
    refusals.push(`corpus-pin refusal: '${pin.name}' at ${root} is not inside a git checkout, so its upstream `
      + `identity cannot be confirmed against pinned ${pin.commit}. Content was still checked by digest.`);
    return { name: pin.name, verdict: refusals.length > 1 ? 'drifted' : 'unpinnable', root, measured, refusals };
  }
  if (head !== pin.commit) {
    refusals.push(`corpus-pin refusal: '${pin.name}' is at ${head}, pinned ${pin.commit}. Nothing distinguishes `
      + 'a compiler change from a corpus change until this is resolved.');
  }

  return {
    name: pin.name,
    verdict: refusals.length === 0 ? 'verified' : 'drifted',
    root,
    measured,
    refusals,
  };
};

export interface CorpusVerification {
  ok: boolean;
  statuses: CorpusStatus[];
  refusals: string[];
}

export const verifyCorpusPins = (
  manifest: CorpusManifest = loadCorpusManifest(),
  env: NodeJS.ProcessEnv = process.env,
): CorpusVerification => {
  const statuses = manifest.corpora.map((pin) => verifyCorpus(pin, env));
  const refusals = statuses.flatMap((status) => status.refusals);
  return { ok: refusals.length === 0, statuses, refusals };
};

/**
 * What a censusing run must call before reporting any figure. It is the difference between "the corpus is at
 * the pinned commits" and a partial census that looks complete.
 */
export const assertCorpusPinsOrRefuse = (
  manifest: CorpusManifest = loadCorpusManifest(),
  env: NodeJS.ProcessEnv = process.env,
): CorpusVerification => {
  const result = verifyCorpusPins(manifest, env);
  if (!result.ok) {
    throw new Error('corpus-pin refusal: the F3 corpus is not at its pinned commits, so a census run would not '
      + `be reproducible. ${result.refusals.length} finding(s):\n- ${result.refusals.join('\n- ')}`);
  }
  return result;
};
