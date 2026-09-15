import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import { compileSolidityProject } from '../src/project-compiler.js';

const dirs: string[] = [];
function project(files: Record<string, string>): string[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-project-'));
  dirs.push(dir);
  return Object.entries(files).map(([name, source]) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, source);
    return file;
  });
}

const workerStub = fileURLToPath(new URL('./fixtures/parallel-compile-stub.mjs', import.meta.url));

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('compileSolidityProject', () => {
  it('publishes canonical declarations while compiling an import DAG', async () => {
    const files = project({
      'Leaf.sol': 'contract Leaf {}',
      'Middle.sol': 'import "./Leaf.sol"; contract Middle {}',
      'Root.sol': 'import "./Middle.sol"; contract Root {}',
    });
    const calls: string[] = [];
    const compile = (file: string): any => {
      calls.push(path.basename(file));
      return { Root: {}, Middle: {}, Leaf: {} };
    };
    const result = await compileSolidityProject(files, { solidityImportCompat: true }, compile);
    expect(calls).toEqual(['Root.sol', 'Leaf.sol', 'Middle.sol']);
    expect(Object.keys(result.artifacts)).toEqual(['Root', 'Leaf', 'Middle']);
  });

  it('lets a declaring file overwrite the artifact imported from another root', async () => {
    const files = project({
      'Leaf.sol': 'contract Leaf {}',
      'Root.sol': 'import "./Leaf.sol"; contract Root {}',
    });
    const compile = (file: string): any => {
      const name = path.basename(file);
      return name === 'Root.sol'
        ? { Root: { from: 'root' }, Leaf: { from: 'root-import' } }
        : { Leaf: { from: 'leaf-file' } };
    };
    const result = await compileSolidityProject(files, { solidityImportCompat: true }, compile);
    expect(result.artifacts.Leaf).toEqual({ from: 'leaf-file' });
    expect(result.artifacts.Root).toEqual({ from: 'root' });
  });

  it('publishes only declarations owned by a focused source', async () => {
    const [root] = project({
      'Root.sol': 'import "./Leaf.sol"; contract Root {}',
      'Leaf.sol': 'contract Leaf {}',
    });
    const compile = (): any => ({
      Root: { abi: [], from: 'root' },
      Leaf: { abi: [], from: 'import' },
    });

    const result = await compileSolidityProject([root], {}, compile);

    expect(result.artifacts).toEqual({ Root: { abi: [], from: 'root' } });
  });

  it('asks the compiler to fully compile only declarations owned by the source file', async () => {
    const files = project({
      'Leaf.sol': 'contract Leaf {}',
      'Root.sol': 'import "./Leaf.sol"; contract Root {}',
    });
    const requested: Record<string, unknown> = {};
    const compile = (file: string, options: Record<string, unknown>): any => {
      requested[path.basename(file)] = options.compileDeclarations;
      return path.basename(file) === 'Root.sol'
        ? { Root: { abi: [] }, Leaf: { abi: [] } }
        : { Leaf: { abi: [] } };
    };

    await compileSolidityProject(files, { solidityImportCompat: true }, compile);

    expect(requested['Root.sol']).toEqual(['Root']);
    expect(requested['Leaf.sol']).toEqual(['Leaf']);
  });

  it('compiles a dependency when selective imports leave one of its declarations unresolved', async () => {
    const files = project({
      'Library.sol': 'contract Used {} contract Unused {}',
      'Root.sol': 'import { Used } from "./Library.sol"; contract Root {}',
    });
    const calls: string[] = [];
    const compile = (file: string): any => {
      const name = path.basename(file);
      calls.push(name);
      return name === 'Root.sol' ? { Root: {}, Used: {} } : { Used: {}, Unused: {} };
    };
    const result = await compileSolidityProject(files, { solidityImportCompat: true }, compile);
    expect(calls).toEqual(['Root.sol', 'Library.sol']);
    expect(Object.keys(result.artifacts)).toEqual(['Root', 'Used', 'Unused']);
  });

  it('reuses a persistent job until a transitive dependency changes', async () => {
    const files = project({
      'Dependency.sol': 'contract Dependency {}',
      'Root.sol': 'import "./Dependency.sol"; contract Root {}',
    });
    const cache = { directory: path.join(path.dirname(files[0]), 'cache'), compilerVersion: 'test' };
    let calls = 0;
    const compile = (): any => {
      calls++;
      return { Root: {}, Dependency: {} };
    };

    const first = await compileSolidityProject(files, { optimize: true }, compile, cache);
    const second = await compileSolidityProject(files, { optimize: true }, compile, cache);
    expect(first.compiledRoots).toHaveLength(2);
    expect(second.compiledRoots).toHaveLength(0);
    expect(second.cacheHits).toHaveLength(2);
    expect(calls).toBe(2);

    fs.appendFileSync(files[0], '\n// dependency changed');
    const third = await compileSolidityProject(files, { optimize: true }, compile, cache);
    expect(third.compiledRoots).toHaveLength(2);
    expect(calls).toBe(4);
  });

  it('keeps one job per file when two files import each other', async () => {
    // An import cycle makes both files' transitive closures identical, so a key built from the closures alone is
    // ambiguous: the two sources then share one job file, and the warm run reads whichever payload was written
    // last - dropping the other file's artifact from the published set.
    const files = project({
      'Alpha.sol': 'import "./Beta.sol"; contract Alpha {}',
      'Beta.sol': 'import "./Alpha.sol"; contract Beta {}',
    });
    const cache = { directory: path.join(path.dirname(files[0]), 'cache'), compilerVersion: 'test' };
    const compile = (file: string, options: Record<string, unknown>): any => Object.fromEntries(
      ((options.compileDeclarations ?? []) as string[]).map((name) => [name, { via: path.basename(file) }]),
    );

    const cold = await compileSolidityProject(files, {}, compile, cache);
    const warm = await compileSolidityProject(files, {}, compile, cache);

    expect(cold.compiledRoots).toHaveLength(2);
    expect(Object.keys(cold.artifacts).sort()).toEqual(['Alpha', 'Beta']);
    expect(warm.cacheHits).toHaveLength(2);
    expect(Object.keys(warm.artifacts).sort()).toEqual(['Alpha', 'Beta']);
    expect(warm.artifacts).toEqual(cold.artifacts);
    expect(fs.readdirSync(path.join(cache.directory, 'jobs'))).toHaveLength(2);
  });

  it('re-hashes a touched file but reuses the job when its contents are unchanged', async () => {
    const [file] = project({ 'Root.sol': 'contract Root {}' });
    const cache = { directory: path.join(path.dirname(file), 'cache'), compilerVersion: 'test' };
    let calls = 0;
    const compile = (): any => {
      calls++;
      return { Root: {} };
    };
    await compileSolidityProject([file], {}, compile, cache);
    const future = new Date(Date.now() + 2_000);
    fs.utimesSync(file, future, future);
    const result = await compileSolidityProject([file], {}, compile, cache);
    expect(result.cacheHits).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it('reuses bytecode jobs when only warning output is suppressed', async () => {
    const [file] = project({ 'Root.sol': 'contract Root {}' });
    const cache = { directory: path.join(path.dirname(file), 'cache'), compilerVersion: 'test' };
    let calls = 0;
    const compile = (): any => {
      calls++;
      return { Root: {} };
    };

    await compileSolidityProject([file], { suppressWarnings: false }, compile, cache);
    const result = await compileSolidityProject([file], { suppressWarnings: true }, compile, cache);

    expect(result.cacheHits).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it('does not infer a fixed upsert key from an unrelated dynamic write', async () => {
    const [file] = project({ 'Root.sol': 'contract Root {}' });
    const compile = (): any => ({
      Root: {
        abi: [{
          name: 'update',
          dynamicWrites: ['records'],
          sortedUpsertLoopInfo: [{
            collection: 'permissions',
            fixedKeyParams: [],
            varyingArrayParam: 'members',
            valueConst: '1',
            op: 'set',
          }],
        }],
      },
    });
    const result = await compileSolidityProject([file], {}, compile);
    expect(result.artifacts.Root.abi[0].sortedUpsertLoopInfo[0].fixedKeySources).toBeUndefined();
  });

  it('retains the compiler-published fixed upsert key', async () => {
    const [file] = project({ 'Root.sol': 'contract Root {}' });
    const fixedKeySources = [{
      kind: 'expression',
      expressionLabel: 'binop:-(unop:.length(state:records),lit:1)',
    }];
    const compile = (): any => ({
      Root: {
        abi: [{
          name: 'append',
          dynamicWrites: ['records'],
          sortedUpsertLoopInfo: [{
            collection: 'permissions',
            fixedKeySources,
            varyingArrayParam: 'members',
            valueConst: '1',
            op: 'set',
          }],
        }],
      },
    });
    const result = await compileSolidityProject([file], {}, compile);
    expect(result.artifacts.Root.abi[0].sortedUpsertLoopInfo[0].fixedKeySources).toEqual(fixedKeySources);
  });

  it('does not trust preserved mtime and size when file contents changed', async () => {
    const [file] = project({ 'Root.sol': 'contract RootA {}' });
    const cache = { directory: path.join(path.dirname(file), 'cache'), compilerVersion: 'test' };
    const originalTime = fs.statSync(file).mtime;
    let calls = 0;
    const compile = (): any => {
      calls++;
      return { Root: {} };
    };
    await compileSolidityProject([file], {}, compile, cache);
    fs.writeFileSync(file, 'contract RootB {}');
    fs.utimesSync(file, originalTime, originalTime);
    const result = await compileSolidityProject([file], {}, compile, cache);
    expect(result.compiledRoots).toHaveLength(1);
    expect(calls).toBe(2);
  });

  // The parallel path only changes WHERE a job runs. Every assertion below compares against the sequential run of
  // the same corpus, so a difference in artifact ownership, ordering or accounting fails here.
  describe('worker fan-out', () => {
    it('publishes the same artifacts and accounting as the sequential path', async () => {
      const files = project({
        'Leaf.sol': 'contract Leaf {}',
        'Middle.sol': 'import "./Leaf.sol"; contract Middle {}',
        'Root.sol': 'import "./Middle.sol"; contract Root {}',
        'Extra.sol': 'import "./Leaf.sol"; contract Extra {}',
      });
      const inProcess: string[] = [];
      const sequentialCompile = (file: string, options: Record<string, unknown>): any => (
        { [path.basename(file).replace('.sol', '')]: { via: 'inline', declarations: options.compileDeclarations } }
      );
      const sequential = await compileSolidityProject(files, {}, sequentialCompile);
      const parallel = await compileSolidityProject(
        files, {}, (file: string) => {
          inProcess.push(path.basename(file));
          return sequentialCompile(file, {});
        },
        undefined,
        { jobs: 2, module: workerStub, exportName: 'compile' },
      );

      expect(parallel.compiledRoots).toEqual(sequential.compiledRoots);
      expect(parallel.cacheHits).toEqual(sequential.cacheHits);
      expect(Object.keys(parallel.artifacts)).toEqual(Object.keys(sequential.artifacts));
      for (const [name, artifact] of Object.entries(parallel.artifacts)) {
        expect(artifact.declarations).toEqual(sequential.artifacts[name].declarations);
        // Proves the fan-out actually ran: the in-process compile closure never produced these.
        expect(artifact.via).toBe('worker');
      }
      expect(inProcess).toEqual([]);
    });

    it('falls back to an in-process compile when the plan skips a job the sequential rule still needs', async () => {
      const files = project({
        // `Both` is not the stem of either declaration, so it is only skipped when a previous source already
        // published both names - and this wrapper's artifact map deliberately omits one of them.
        'Both.sol': 'contract Alpha {} contract Beta {}',
        'Wrapper.sol': 'import "./Both.sol"; // stub: omit Alpha\ncontract Alpha {} contract Beta {}',
        'Solo.sol': 'contract Solo {}',
      });
      const inProcess: string[] = [];
      const compile = (file: string, options: Record<string, unknown>): any => {
        inProcess.push(path.basename(file));
        return Object.fromEntries(
          ((options.compileDeclarations ?? []) as string[]).map((name) => [name, { via: 'inline' }]),
        );
      };
      const parallel = await compileSolidityProject(
        files, {}, compile, undefined,
        { jobs: 2, module: workerStub, exportName: 'compile' },
      );

      // The wrapper ran in a worker, and the skipped declaration forced the dependency back into this process.
      expect(inProcess).toEqual(['Both.sol']);
      expect(parallel.artifacts.Alpha).toEqual({ via: 'inline' });
      expect(parallel.artifacts.Beta).toEqual({ via: 'inline' });
      expect(parallel.artifacts.Solo).toMatchObject({ via: 'worker', file: 'Solo.sol' });
      expect(parallel.compiledRoots.map((entry) => path.basename(entry)))
        .toEqual(['Wrapper.sol', 'Solo.sol', 'Both.sol']);
    });

    it('rejects compiler options a worker thread cannot receive', async () => {
      const [file] = project({ 'Root.sol': 'contract Root {}' });
      await expect(compileSolidityProject(
        [file], { onWarning: () => undefined }, () => ({ Root: {} }), undefined,
        { jobs: 2, module: workerStub, exportName: 'compile' },
      )).rejects.toThrow(/requires compiler options a worker thread can receive/);
    });
  });
});
