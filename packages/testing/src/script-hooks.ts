/**
 * Module resolution hooks for the scripts `solidcash run` and `solidcash deploy` load (registered with
 * `module.register`). A script written for Hardhat imports `hardhat` and `ethers`; a project file's import of one
 * resolves to the drop-in the test runner aliases it to (`hardhatAliases`), so the script runs as `npx hardhat run`
 * runs it. Imports from installed packages are left alone: the drop-ins themselves import the real `ethers`.
 */
import path from 'node:path';
import type { InitializeHook, ResolveHook } from 'node:module';
import { pathToFileURL } from 'node:url';

export interface ScriptHookData {
  /** Specifier -> package specifier or absolute file path (`hardhatAliases()`). */
  readonly aliases: Record<string, string>;
  /** The module the alias targets resolve from: they are this package's own exports. */
  readonly parentURL: string;
  /** The project directory as a file URL ending in a separator; only its files' imports are aliased. */
  readonly projectURL: string;
}

let data: ScriptHookData | undefined;

export const initialize: InitializeHook<ScriptHookData> = (value) => {
  data = value;
};

export const resolve: ResolveHook = (specifier, context, nextResolve) => {
  const importer = context.parentURL;
  const target = data !== undefined && Object.hasOwn(data.aliases, specifier) ? data.aliases[specifier] : undefined;
  if (target === undefined || importer === undefined || !importer.startsWith(data!.projectURL)
    || importer.includes('/node_modules/')) {
    return nextResolve(specifier, context);
  }
  const resolved = path.isAbsolute(target) ? pathToFileURL(target).href : target;
  return nextResolve(resolved, { ...context, parentURL: data!.parentURL });
};
