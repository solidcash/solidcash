import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUtxo } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * The browser contract of the SDK: every exported entry bundles for a browser without the compiler, initializes
 * there, and can build and send a transaction.
 *
 * The compiler is Node-only (`compileFile*` reads the filesystem; `compiler.ts` hashes through `node:crypto` and
 * keeps a disk cache), so a browser bundle must not reach it. These tests bundle the SHIPPED `dist` the way a
 * bundler outside this repository does - including the package's `browser` field - so that a re-introduced barrel
 * import (`solidc` instead of `solidc/runtime`) fails here instead of in an application. `tsconfigRaw` drops this
 * repository's `paths` mapping, which would otherwise resolve `solidc/runtime` to `packages/solidc/src`: a consumer
 * has no such mapping.
 *
 * A bundle only RUNS when the bundler preserves top-level await, which is what `splitting` gives esbuild and what
 * Rollup, Vite and webpack give without being asked. `@bitauth/libauth` instantiates its WebAssembly crypto behind a
 * module-level `await`; in a single-file esbuild bundle that makes every module initializer async, and esbuild then
 * cannot order an import cycle that contains one: the cycle's initializers await each other and never settle, and a
 * module-scope read of a binding that sits behind a re-export barrel can see `undefined`. `dist/stateful/index.js`
 * (cycles among the `stateful/` and `message-bus/` modules) and libauth's own `compiler-utils.js` both fail that way
 * in a single-file bundle. The static test below therefore bundles WITHOUT splitting - the strongest form of "the
 * compiler is not in the graph" - and the runtime tests bundle with it.
 */

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const distEntries = ((): string[] => {
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    exports: Record<string, { default?: string }>;
  };
  return Object.entries(pkg.exports)
    .filter(([, value]) => typeof value.default === 'string' && value.default.endsWith('.js'))
    .map(([, value]) => value.default as string);
})();

/** The compiler core: the file entry reads the filesystem, the core hashes and caches on disk. */
const COMPILER_CORE = /solidc[/\\](?:src|dist)[/\\](?:compiler|compileFile)\.(?:js|ts)$/;

/** Bundle an entry from the package's `dist`, as a bundler outside this repository resolves it. */
const bundleResult = async (relative: string, platform: 'browser' | 'node', splitting = false) => build({
  entryPoints: [join(packageRoot, relative)],
  bundle: true,
  platform,
  format: 'esm',
  write: false,
  metafile: true,
  logLevel: 'silent',
  splitting,
  outdir: splitting ? mkdtempSync(join(tmpdir(), 'solidcash-browser-chunks-')) : undefined,
  tsconfigRaw: { compilerOptions: { paths: {} } },
});

const bundle = async (relative: string, platform: 'browser' | 'node'): Promise<string[]> =>
  Object.keys((await bundleResult(relative, platform)).metafile.inputs);

/** Import a browser bundle the way a browser would load it, from the files the bundler wrote. */
const importBundle = async (relative: string): Promise<Record<string, any>> => {
  const result = await bundleResult(relative, 'browser', true);
  const outdir = dirname(result.outputFiles[0].path);
  for (const output of result.outputFiles) writeFileSync(output.path, output.text);
  return import(pathToFileURL(join(outdir, basename(relative))).href) as Promise<Record<string, any>>;
};

describe('SDK browser bundle', () => {
  it('bundles every exported entry for a browser without the compiler', async () => {
    const failures: string[] = [];
    for (const entry of distEntries) {
      let modules: string[];
      try {
        modules = await bundle(entry, 'browser');
      } catch (error) {
        failures.push(`${entry}: ${String((error as Error).message).split('\n').slice(0, 6).join(' | ')}`);
        continue;
      }
      const compiler = modules.filter((module) => COMPILER_CORE.test(module));
      if (compiler.length > 0) failures.push(`${entry}: reaches ${compiler.join(', ')}`);
    }
    expect(failures).toEqual([]);
  }, 300_000);

  it('initializes every exported entry from its browser bundle', async () => {
    const failures: string[] = [];
    for (const entry of distEntries) {
      // The vitest extensions install into vitest's globals; outside a test run they cannot initialize.
      if (entry.endsWith('TestExtensions.js')) continue;
      try {
        const modules = await importBundle(entry);
        if (Object.keys(modules).length === 0) failures.push(`${entry}: no exports`);
      } catch (error) {
        failures.push(`${entry}: ${String((error as Error).message).split('\n')[0]}`);
      }
    }
    expect(failures).toEqual([]);
  }, 300_000);

  it('keeps the compiler in the Node build of the framed entry', async () => {
    const nodeModules = await bundle('./dist/framed/proxy/index.js', 'node');
    expect(nodeModules.some((module) => /solidc[/\\](?:src|dist)[/\\]compiler\.(?:js|ts)$/.test(module)))
      .toBe(true);
    const browserModules = await bundle('./dist/framed/proxy/index.js', 'browser');
    expect(browserModules.filter((module) => COMPILER_CORE.test(module))).toEqual([]);
  }, 300_000);

  it('sends a stateless transaction from the browser bundle', async () => {
    const sdk = await importBundle('dist/index.js') as {
      Contract: typeof import('../../src/index.js')['Contract'];
      TransactionBuilder: typeof import('../../src/index.js')['TransactionBuilder'];
      SignatureTemplate: typeof import('../../src/index.js')['SignatureTemplate'];
      randomUtxo: typeof import('../../src/index.js')['randomUtxo'];
    };
    const { MockNetworkProvider } = await importBundle('dist/network/mock/index.js') as {
      MockNetworkProvider: new () => import('../../src/interfaces.js').NetworkProvider;
    };
    const provider = new MockNetworkProvider();
    const p2pkh = new sdk.Contract(p2pkhArtifact, [alicePkh], { provider });
    const utxo = sdk.randomUtxo({ satoshis: 20_000n });
    await (provider as unknown as { addUtxo(a: string, u: typeof utxo): Promise<unknown> })
      .addUtxo(p2pkh.address, utxo);
    const builder = new sdk.TransactionBuilder({ provider });
    builder.addInput(utxo, p2pkh.unlock.spend(alicePub, new sdk.SignatureTemplate(alicePriv)));
    builder.addOutput({ to: p2pkh.address, amount: 15_000n });
    const { txid, hex } = await builder.send();
    expect(txid).toHaveLength(64);
    expect(hex.length).toBeGreaterThan(0);
  }, 300_000);

  it('picks the browser proxy module, which refuses on-the-fly generation', async () => {
    const modules = await bundle('dist/framed/proxy/index.js', 'browser');
    expect(modules.some((module) => module.endsWith('generate.browser.js'))).toBe(true);
    expect(modules.some((module) => module.endsWith('generate.js'))).toBe(false);
    const proxy = await importBundle('dist/framed/proxy/index.js') as {
      buildProxyArtifact: (artifact: unknown) => unknown;
    };
    expect(() => proxy.buildProxyArtifact({ contractName: 'Impl', stateLayout: { commitmentLimit: 128 } }))
      .toThrow(/proxyArtifact/);
  }, 300_000);

});
