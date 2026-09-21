/**
 * Worker-loadable compiler stub for the project-compile parallel tests.
 *
 * The parallel path loads `compileFile` by module URL inside a worker thread, so a closure passed to
 * `compileSolidityProject` cannot be used there: the stub has to be a real module. It mirrors the one behaviour
 * of the real compiler the parallel plan depends on - the artifact map a job returns - and nothing else.
 */
import fs from 'node:fs';
import path from 'node:path';

export function compile(file, options) {
  const source = fs.readFileSync(file, 'utf8');
  const declarations = Array.isArray(options?.compileDeclarations) ? options.compileDeclarations : [];
  // `// stub: omit <Name>` models a scanned declaration the compiler never emits, which is the case the parallel
  // pre-pass cannot predict and the sequential merge has to repair with an in-process compile.
  const omitted = source.match(/\/\/ stub: omit (\w+)/)?.[1];
  const artifacts = {};
  for (const name of declarations) {
    if (name === omitted) continue;
    artifacts[name] = { via: 'worker', file: path.basename(file), declarations };
  }
  return artifacts;
}
