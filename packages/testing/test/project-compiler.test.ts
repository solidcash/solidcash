import fs from 'fs';
import os from 'os';
import path from 'path';
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

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('compileSolidityProject', () => {
  it('publishes canonical declarations while compiling an import DAG', () => {
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
    const result = compileSolidityProject(files, { solidityImportCompat: true }, compile);
    expect(calls).toEqual(['Root.sol', 'Leaf.sol', 'Middle.sol']);
    expect(Object.keys(result.artifacts)).toEqual(['Root', 'Leaf', 'Middle']);
  });

  it('lets a declaring file overwrite the artifact imported from another root', () => {
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
    const result = compileSolidityProject(files, { solidityImportCompat: true }, compile);
    expect(result.artifacts.Leaf).toEqual({ from: 'leaf-file' });
    expect(result.artifacts.Root).toEqual({ from: 'root' });
  });

  it('compiles every selected declaration owner when filenames differ from declaration names', () => {
    const files = project({
      'Implementation.sol': 'contract Base {}',
      'Feature.sol': 'import "./Implementation.sol"; contract Feature {}',
      'Root.sol': 'import "./Feature.sol"; contract Root {}',
    });
    const calls: string[] = [];
    const compile = (file: string): any => {
      const name = path.basename(file);
      calls.push(name);
      if (name === 'Root.sol') return { Root: { from: name }, Feature: { from: name }, Base: { from: name } };
      if (name === 'Feature.sol') return { Feature: { from: name }, Base: { from: name } };
      return { Base: { from: name } };
    };

    const result = compileSolidityProject(files, { solidityImportCompat: true }, compile);

    expect(calls).toEqual(['Root.sol', 'Implementation.sol', 'Feature.sol']);
    expect(result.artifacts).toEqual({
      Root: { from: 'Root.sol' },
      Base: { from: 'Implementation.sol' },
      Feature: { from: 'Feature.sol' },
    });
  });

  it('uses distinct persistent jobs for declaration owners in an import cycle', () => {
    const files = project({
      'Left.sol': 'import "./Right.sol"; contract Left {}',
      'Right.sol': 'import "./Left.sol"; contract Right {}',
    });
    const cache = { directory: path.join(path.dirname(files[0]), 'cache'), compilerVersion: 'test' };
    const calls: string[] = [];
    const compile = (file: string): any => {
      const name = path.basename(file);
      calls.push(name);
      return name === 'Left.sol'
        ? { Left: { from: name }, Right: { from: name } }
        : { Left: { from: name }, Right: { from: name } };
    };

    const result = compileSolidityProject(files, {}, compile, cache);

    expect(calls).toEqual(['Left.sol', 'Right.sol']);
    expect(result.cacheHits).toEqual([]);
    expect(result.artifacts).toEqual({
      Left: { from: 'Left.sol' },
      Right: { from: 'Right.sol' },
    });
  });

  it('publishes only declarations owned by a focused source', () => {
    const [root] = project({
      'Root.sol': 'import "./Leaf.sol"; contract Root {}',
      'Leaf.sol': 'contract Leaf {}',
    });
    const compile = (): any => ({
      Root: { abi: [], from: 'root' },
      Leaf: { abi: [], from: 'import' },
    });

    const result = compileSolidityProject([root], {}, compile);

    expect(result.artifacts).toEqual({ Root: { abi: [], from: 'root' } });
  });

  it('asks the compiler to fully compile only declarations owned by the source file', () => {
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

    compileSolidityProject(files, { solidityImportCompat: true }, compile);

    expect(requested['Root.sol']).toEqual(['Root']);
    expect(requested['Leaf.sol']).toEqual(['Leaf']);
  });

  it('compiles a dependency when selective imports leave one of its declarations unresolved', () => {
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
    const result = compileSolidityProject(files, { solidityImportCompat: true }, compile);
    expect(calls).toEqual(['Root.sol', 'Library.sol']);
    expect(Object.keys(result.artifacts)).toEqual(['Root', 'Used', 'Unused']);
  });

  it('reuses a persistent job until a transitive dependency changes', () => {
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

    const first = compileSolidityProject(files, { optimize: true }, compile, cache);
    const second = compileSolidityProject(files, { optimize: true }, compile, cache);
    expect(first.compiledRoots).toHaveLength(2);
    expect(second.compiledRoots).toHaveLength(0);
    expect(second.cacheHits).toHaveLength(2);
    expect(calls).toBe(2);

    fs.appendFileSync(files[0], '\n// dependency changed');
    const third = compileSolidityProject(files, { optimize: true }, compile, cache);
    expect(third.compiledRoots).toHaveLength(2);
    expect(calls).toBe(4);
  });

  it('re-hashes a touched file but reuses the job when its contents are unchanged', () => {
    const [file] = project({ 'Root.sol': 'contract Root {}' });
    const cache = { directory: path.join(path.dirname(file), 'cache'), compilerVersion: 'test' };
    let calls = 0;
    const compile = (): any => {
      calls++;
      return { Root: {} };
    };
    compileSolidityProject([file], {}, compile, cache);
    const future = new Date(Date.now() + 2_000);
    fs.utimesSync(file, future, future);
    const result = compileSolidityProject([file], {}, compile, cache);
    expect(result.cacheHits).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it('reuses bytecode jobs when only warning output is suppressed', () => {
    const [file] = project({ 'Root.sol': 'contract Root {}' });
    const cache = { directory: path.join(path.dirname(file), 'cache'), compilerVersion: 'test' };
    let calls = 0;
    const compile = (): any => {
      calls++;
      return { Root: {} };
    };

    compileSolidityProject([file], { suppressWarnings: false }, compile, cache);
    const result = compileSolidityProject([file], { suppressWarnings: true }, compile, cache);

    expect(result.cacheHits).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it('does not infer a fixed upsert key from an unrelated dynamic write', () => {
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
    const result = compileSolidityProject([file], {}, compile);
    expect(result.artifacts.Root.abi[0].sortedUpsertLoopInfo[0].fixedKeySources).toBeUndefined();
  });

  it('retains the compiler-published fixed upsert key', () => {
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
    const result = compileSolidityProject([file], {}, compile);
    expect(result.artifacts.Root.abi[0].sortedUpsertLoopInfo[0].fixedKeySources).toEqual(fixedKeySources);
  });

  it('does not trust preserved mtime and size when file contents changed', () => {
    const [file] = project({ 'Root.sol': 'contract RootA {}' });
    const cache = { directory: path.join(path.dirname(file), 'cache'), compilerVersion: 'test' };
    const originalTime = fs.statSync(file).mtime;
    let calls = 0;
    const compile = (): any => {
      calls++;
      return { Root: {} };
    };
    compileSolidityProject([file], {}, compile, cache);
    fs.writeFileSync(file, 'contract RootB {}');
    fs.utimesSync(file, originalTime, originalTime);
    const result = compileSolidityProject([file], {}, compile, cache);
    expect(result.compiledRoots).toHaveLength(1);
    expect(calls).toBe(2);
  });
});
