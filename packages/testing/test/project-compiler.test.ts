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
  it('compiles an import DAG once from its root when transitive artifacts resolve dependencies', () => {
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
    expect(calls).toEqual(['Root.sol']);
    expect(Object.keys(result.artifacts)).toEqual(['Root', 'Middle', 'Leaf']);
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
    expect(first.compiledRoots).toHaveLength(1);
    expect(second.compiledRoots).toHaveLength(0);
    expect(second.cacheHits).toHaveLength(1);
    expect(calls).toBe(1);

    fs.appendFileSync(files[0], '\n// dependency changed');
    const third = compileSolidityProject(files, { optimize: true }, compile, cache);
    expect(third.compiledRoots).toHaveLength(1);
    expect(calls).toBe(2);
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
