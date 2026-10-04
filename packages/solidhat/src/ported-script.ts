/**
 * Run a Hardhat-era deployment script inside the current process.
 *
 * Hardhat executes scripts through ts-node in CommonJS mode, so ported scripts freely use `__dirname`, `require`,
 * and `process.exit(0)` at the end of `main()`. Under an ESM test runner none of those exist, and `process.exit`
 * would tear down the whole suite. This module supplies the missing script-environment globals for the duration of
 * one script, turns `process.exit` into a completion signal, and restores everything afterwards, so a deployment
 * script can be exercised in-process against the same mock chain and offline services as the suite around it.
 *
 * The script is responsible for its own async `main()`; completion is reported by `process.exit`, by an unhandled
 * rejection from the script, or by the caller's timeout.
 */
import Module from 'node:module';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** Module ids a ported script expects to receive the Hardhat runtime environment for. */
const HARDHAT_MODULE_IDS = new Set([
  'hardhat',
  'hardhat/config',
  '@nomicfoundation/hardhat-ethers',
  '@nomiclabs/hardhat-ethers',
  '@openzeppelin/hardhat-upgrades',
]);

/**
 * Answer CommonJS `require` calls for the ported module names for the duration of one script.
 *
 * A script that opens with `const { ethers } = require("hardhat")` never reaches the test runner's import aliases, so
 * the value is served straight from the loader: resolving it to a file instead would re-enter the ESM graph, which
 * Node refuses to load from CommonJS when it contains top-level await. The loader is also what answers the
 * module-scope `require` a test runner hands a transformed module: Vitest passes `createRequire(file)`, which
 * shadows `globalThis.require` but still loads through `Module._load`.
 */
function installCommonJsAliases(modules: ReadonlyMap<string, unknown>): () => void {
  const loader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = loader._load;
  loader._load = function patched(request: string, parent: unknown, isMain: boolean): unknown {
    if (modules.has(request)) return modules.get(request);
    return original.call(this, request, parent, isMain);
  };
  return () => { loader._load = original; };
}

/**
 * The ids a script's `require` is answered for ahead of the normal resolver: the caller's `modules`, and every
 * Hardhat id with `hardhat`, or by default with the solidhat Hardhat module, the runtime the preset aliases those ids
 * to for an ESM import. That module is imported by its path beside this file, not by the bare id: a bare `hardhat`
 * goes through whatever resolver loaded this file, which outside the preset's pipeline is Node's own and finds no
 * `hardhat`, or the real one. In the built package the sibling is the file the preset's alias names, loaded by the
 * same loader as this file, so the script's ESM import and its `require` share one instance. `require('hardhat')` is
 * a Hardhat 2 idiom (Hardhat 3 is ESM-only), and the Hardhat 3 module re-exports the same bindings anyway.
 */
async function commonJsModulesFor(hardhat: unknown, modules: Record<string, unknown>): Promise<Map<string, unknown>> {
  const table = new Map<string, unknown>(Object.entries(modules));
  const runtime = hardhat !== undefined ? hardhat : await import('./hardhat2.js');
  for (const id of HARDHAT_MODULE_IDS) if (hardhat !== undefined || !table.has(id)) table.set(id, runtime);
  return table;
}

interface PortedGlobals {
  __dirname?: string;
  __filename?: string;
  require?: unknown;
}

export interface RunPortedScriptOptions {
  /**
   * Value exposed to `require('hardhat')` and friends, matching Hardhat's script environment. CommonJS-style scripts
   * receive it verbatim, so pass an object carrying the fields they destructure (`ethers`, `upgrades`, `network`).
   * Defaults to the solidhat Hardhat module, the runtime the vitest preset aliases `hardhat` to for ESM imports.
   */
  hardhat?: unknown;
  /** Extra `require` ids the script may use, answered before the normal module resolver. */
  modules?: Record<string, unknown>;
  /** How long to wait for the script to finish before failing the run (default 300s). */
  timeoutMs?: number;
  /** Capture `console.log` / `console.error` output instead of letting it through (default `true`). */
  captureOutput?: boolean;
  /**
   * Module loader for the script. Defaults to a plain dynamic import, which works when the host is Node. A test
   * runner should pass its own loader (`() => import('../scripts/deploy.js')`) so the script is loaded through the
   * runner's module pipeline - that is what applies the Hardhat/Ethers aliases and the TypeScript transform.
   */
  load?: () => Promise<unknown>;
}

export interface PortedScriptResult {
  /** Code passed to `process.exit`, when the script called it. */
  exitCode?: number;
  /** Error the script rejected with, when it failed. */
  error?: unknown;
  /** Captured `console.log` lines. */
  stdout: string[];
  /** Captured `console.error` lines. */
  stderr: string[];
}

/** Thrown when a script neither exits nor fails within the configured timeout. */
export class PortedScriptTimeout extends Error {
  constructor(scriptPath: string, timeoutMs: number) {
    super(`Ported script did not finish within ${timeoutMs}ms: ${scriptPath}`);
    this.name = 'PortedScriptTimeout';
  }
}

/**
 * Import `scriptPath` with Hardhat-style script globals installed and wait for it to complete.
 *
 * The module is imported with a cache-busting query so a test can run the same script twice in one file — the
 * second run must observe the chain state the first one left behind, not a stale module instance.
 */
export async function runPortedScript(
  scriptPath: string,
  options: RunPortedScriptOptions = {},
): Promise<PortedScriptResult> {
  const { timeoutMs = 300_000, captureOutput = true, hardhat, modules = {}, load } = options;
  const commonJsModules = await commonJsModulesFor(hardhat, modules);
  const scriptRequire = createRequire(scriptPath);
  const globals = globalThis as PortedGlobals & { console: Console };
  const previousGlobals: PortedGlobals = {
    __dirname: globals.__dirname,
    __filename: globals.__filename,
    require: globals.require,
  };
  const previousExit = process.exit;
  const previousLog = console.log;
  const previousError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const format = (args: unknown[]): string => args.map((value) => (
    typeof value === 'string' ? value : (() => {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })()
  )).join(' ');

  let settle!: (result: PortedScriptResult) => void;
  const finished = new Promise<PortedScriptResult>((resolve) => { settle = resolve; });
  const onUnhandled = (reason: unknown): void => settle({ error: reason, stdout, stderr });
  let exitCode: number | undefined;

  globals.__filename = scriptPath;
  globals.__dirname = scriptPath.slice(0, Math.max(scriptPath.lastIndexOf('/'), scriptPath.lastIndexOf('\\')));
  globals.require = (id: string): unknown => (
    commonJsModules.has(id) ? commonJsModules.get(id) : scriptRequire(id) as unknown
  );
  if (captureOutput) {
    console.log = (...args: unknown[]): void => { stdout.push(format(args)); };
    console.error = (...args: unknown[]): void => { stderr.push(format(args)); };
  }
  // Scripts conventionally end `main()` with `process.exit(0)` without awaiting `main()`. Record the code and
  // return normally: throwing here would surface as an unhandled rejection inside the import.
  process.exit = ((code?: number): never => {
    exitCode = code ?? 0;
    settle({ exitCode, stdout, stderr });
    return undefined as never;
  }) as typeof process.exit;
  process.on('unhandledRejection', onUnhandled);
  const restoreCommonJsAliases = installCommonJsAliases(commonJsModules);

  try {
    if (load) await load();
    else await import(pathToFileURL(scriptPath).href);
    const timeout = new Promise<PortedScriptResult>((resolve) => {
      const timer = setTimeout(() => resolve({ error: new PortedScriptTimeout(scriptPath, timeoutMs), stdout, stderr }), timeoutMs);
      timer.unref?.();
    });
    const result = await Promise.race([finished, timeout]);
    return { exitCode, ...result, stdout, stderr };
  } finally {
    restoreCommonJsAliases();
    process.off('unhandledRejection', onUnhandled);
    process.exit = previousExit;
    console.log = previousLog;
    console.error = previousError;
    if (previousGlobals.__dirname === undefined) delete globals.__dirname;
    else globals.__dirname = previousGlobals.__dirname;
    if (previousGlobals.__filename === undefined) delete globals.__filename;
    else globals.__filename = previousGlobals.__filename;
    if (previousGlobals.require === undefined) delete globals.require;
    else globals.require = previousGlobals.require;
  }
}
