import fs, { PathLike } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Artifact, ArtifactMap, SplitArtifactBundle } from '@solidcash/utils';
import { compileString, compileStringMulti, compileStringSplit, CompileOptions, SplitCompileOptions } from './compiler.js';

// Read a file + build the node import resolver, returning the source and the options to pass to
// compileString / compileStringMulti. Shared by compileFile and compileFileMulti.
function readSourceWithResolver(
  codeFile: PathLike, compilerOptions: CompileOptions,
): { code: string; options: CompileOptions } {
  const code = fs.readFileSync(codeFile, { encoding: 'utf-8' });

  // Convert URL objects to file paths, then resolve to absolute
  const fileStr = codeFile instanceof URL ? fileURLToPath(codeFile) : codeFile.toString();
  const filePath = path.resolve(fileStr);

  // With solidityImportCompat, `.sol` files resolve as solidcash sources (so OZ/Solidity imports load).
  const compat = compilerOptions.solidityImportCompat ?? false;
  // Ordered file candidates for a base path: keep an explicit extension, else try .scash (then .sol).
  const candidatesFor = (base: string): string[] => {
    if (base.endsWith('.scash')) return [base];
    if (base.endsWith('.sol')) return compat ? [base] : [`${base}.scash`];
    return compat ? [`${base}.scash`, `${base}.sol`] : [`${base}.scash`];
  };
  const firstExisting = (base: string): string | undefined => candidatesFor(base).find((c) => fs.existsSync(c));

  const nodeResolver = (importPath: string, currentFile: string): { source: string; id: string } | undefined => {
    const isRelative = importPath.startsWith('./') || importPath.startsWith('../');

    if (isRelative) {
      const resolved = firstExisting(path.resolve(path.dirname(currentFile), importPath));
      if (!resolved) return undefined;
      return { source: fs.readFileSync(resolved, { encoding: 'utf-8' }), id: resolved };
    }

    // Non-relative path (e.g. "@openzeppelin/contracts/..." or "mylib/utils.scash")
    // Walk up directories from the current file looking for node_modules/
    let searchDir = path.dirname(currentFile);
    while (true) {
      const resolved = firstExisting(path.join(searchDir, 'node_modules', importPath));
      if (resolved) {
        return { source: fs.readFileSync(resolved, { encoding: 'utf-8' }), id: resolved };
      }
      const parent = path.dirname(searchDir);
      if (parent === searchDir) break; // filesystem root
      searchDir = parent;
    }

    // A direct import that named no package (`import "sibling.sol"`) resolves against the importing file's own
    // directory - Solidity's base-path behavior for a non-remapped import. Fallback after node_modules so a real
    // package still wins; only used when a same-directory file of that name actually exists.
    const sibling = firstExisting(path.resolve(path.dirname(currentFile), importPath));
    if (sibling) return { source: fs.readFileSync(sibling, { encoding: 'utf-8' }), id: sibling };

    return undefined;
  };

  return {
    code,
    options: {
      ...compilerOptions,
      importResolver: compilerOptions.importResolver ?? nodeResolver,
      rootFileId: compilerOptions.rootFileId ?? filePath,
    },
  };
}

export function compileFile(codeFile: PathLike, compilerOptions: CompileOptions = {}): Artifact {
  const { code, options } = readSourceWithResolver(codeFile, compilerOptions);
  return compileString(code, options);
}

/** Like compileFile, but returns an Artifact per top-level declaration (a map keyed by name). See
 *  docs/multi-contract-artifacts.md. */
export function compileFileMulti(codeFile: PathLike, compilerOptions: CompileOptions = {}): ArtifactMap {
  const { code, options } = readSourceWithResolver(codeFile, compilerOptions);
  return compileStringMulti(code, options);
}

/** Compile a file to a statically-linked root/facet bundle. */
export function compileFileSplit(
  codeFile: PathLike, compilerOptions: SplitCompileOptions = {},
): SplitArtifactBundle {
  const { code, options } = readSourceWithResolver(codeFile, compilerOptions);
  return compileStringSplit(code, { ...options, ...compilerOptions });
}
