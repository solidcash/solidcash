import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';

// A consumer that compiles with `exactOptionalPropertyTypes` passes a MockNetworkProvider wherever a NetworkProvider is
// expected. The mock's `oraclePoolCategory` getter returns `string | undefined`, which that option does not accept for
// an optional `string` property, so the assignment was a type error for every such consumer.
const here = path.dirname(fileURLToPath(import.meta.url));
const probeFile = path.join(here, '__mock-provider-exact-optional-probe.ts');
const probeSource = `
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
export const provider: NetworkProvider = new MockNetworkProvider();
`;

describe('MockNetworkProvider under exactOptionalPropertyTypes', () => {
  it('is assignable to NetworkProvider', () => {
    const options: ts.CompilerOptions = {
      strict: true,
      exactOptionalPropertyTypes: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      resolveJsonModule: true,
    };
    const host = ts.createCompilerHost(options);
    const readFile = host.readFile.bind(host);
    const getSourceFile = host.getSourceFile.bind(host);
    host.fileExists = ((exists) => (file: string) => file === probeFile || exists(file))(host.fileExists.bind(host));
    host.readFile = (file) => (file === probeFile ? probeSource : readFile(file));
    host.getSourceFile = (file, version, onError, create) => (file === probeFile
      ? ts.createSourceFile(file, probeSource, version)
      : getSourceFile(file, version, onError, create));
    const program = ts.createProgram([probeFile], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program, program.getSourceFile(probeFile))
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    expect(diagnostics).toEqual([]);
  }, 120000);
});
