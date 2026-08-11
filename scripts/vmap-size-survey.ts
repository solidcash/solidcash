import { compileString } from '../packages/solidc/test/direct-compile.js';

const options = { forceStateful: true, messageBus: false } as const;

const cases: Record<string, string> = {
  empty: 'contract C { int x; function f() external { require(true); } }',
  scalarRead: 'contract C { int x; function f(int e) external { require(x == e); } }',
  scalarWrite: 'contract C { int x; function f(int v) external { x = v; require(true); } }',
  dynamicBytesRead: 'contract C { bytes x; function f(int n) external { require(x.length == n); } }',
  dynamicBytesWrite: 'contract C { bytes x; function f(bytes v) external { x = v; require(true); } }',
  vmapUnused: 'contract C { mapping(int=>int) m; function f() external { require(true); } }',
  vmapRead1: 'contract C { mapping(int=>int) m; function f(int k,int e) external { require(m[k] == e); } }',
  vmapRead2SameFn: 'contract C { mapping(int=>int) m; function f(int a,int b,int ea,int eb) external { require(m[a] == ea && m[b] == eb); } }',
  vmapRead3SameFn: 'contract C { mapping(int=>int) m; function f(int a,int b,int c,int ea,int eb,int ec) external { require(m[a] == ea && m[b] == eb && m[c] == ec); } }',
  vmapRead2Functions: 'contract C { mapping(int=>int) m; function f(int k,int e) external { require(m[k] == e); } function g(int k,int e) external { require(m[k] == e); } }',
  vmapRead3Functions: 'contract C { mapping(int=>int) m; function f(int k,int e) external { require(m[k] == e); } function g(int k,int e) external { require(m[k] == e); } function h(int k,int e) external { require(m[k] == e); } }',
  vmapRead2Collections: 'contract C { mapping(int=>int) a; mapping(int=>int) b; function f(int k,int ea,int eb) external { require(a[k] == ea && b[k] == eb); } }',
  vmapWrite1: 'contract C { mapping(int=>int) m; function f(int k,int v) external { m[k] = v; require(true); } }',
  vmapWrite2Functions: 'contract C { mapping(int=>int) m; function f(int k,int v) external { m[k] = v; require(true); } function g(int k,int v) external { m[k] = v; require(true); } }',
  vmapRmw1: 'contract C { mapping(int=>int) m; function f(int k,int v) external { m[k] = m[k] + v; require(true); } }',
  vmapSameKeyReadTwice: 'contract C { mapping(int=>int) m; function f(int k,int a,int b) external { require(m[k] >= a && m[k] <= b); } }',
  vmapSameKeyReadThrice: 'contract C { mapping(int=>int) m; function f(int k,int a,int b,int c) external { require(m[k] >= a && m[k] <= b && m[k] != c); } }',
  vmapFixedWrites2: 'contract C { mapping(int=>int) m; function f(int a,int b,int v) external { m[a]=v; m[b]=v; require(true); } }',
  vmapFixedWrites3: 'contract C { mapping(int=>int) m; function f(int a,int b,int c,int v) external { m[a]=v; m[b]=v; m[c]=v; require(true); } }',
  vmapFixedWrites4: 'contract C { mapping(int=>int) m; function f(int a,int b,int c,int d,int v) external { m[a]=v; m[b]=v; m[c]=v; m[d]=v; require(true); } }',
  vmapFixedWrites5: 'contract C { mapping(int=>int) m; function f(int a,int b,int c,int d,int e,int v) external { m[a]=v; m[b]=v; m[c]=v; m[d]=v; m[e]=v; require(true); } }',
  vmapFixedWrites6: 'contract C { mapping(int=>int) m; function f(int a,int b,int c,int d,int e,int f0,int v) external { m[a]=v; m[b]=v; m[c]=v; m[d]=v; m[e]=v; m[f0]=v; require(true); } }',
  vmapFixedWrites7: 'contract C { mapping(int=>int) m; function f(int a,int b,int c,int d,int e,int f0,int g,int v) external { m[a]=v; m[b]=v; m[c]=v; m[d]=v; m[e]=v; m[f0]=v; m[g]=v; require(true); } }',
  vmapTwoMappingsRmw: 'contract C { mapping(int=>int) a; mapping(int=>int) b; function f(int k,int v) external { a[k] = a[k] + v; b[k] = b[k] + v; require(true); } }',
  vmapBytesRead: 'contract C { mapping(int=>bytes) m; function f(int k,int n) external { require(m[k].length == n); } }',
  vmapBytesWrite: 'contract C { mapping(int=>bytes) m; function f(int k,bytes v) external { m[k] = v; require(true); } }',
};

const rows = Object.entries(cases).map(([name, source]) => {
  const artifact = compileString(source, options);
  const invokeDebug = (artifact.debug as typeof artifact.debug & {
    invokeDebug?: Record<string, { bytecode: string; name?: string }>;
  }).invokeDebug ?? {};
  const helpers = Object.values(invokeDebug).filter((entry) => entry.name?.startsWith('compiler helper')
    || entry.name?.startsWith('outlined source span'));
  const placeholders = [...artifact.bytecode.matchAll(/<[^>]+>/g)].map((match) => match[0]);
  return {
    name,
    templateChars: artifact.bytecode.length,
    debugBytes: artifact.debug.bytecode.length / 2,
    placeholderCount: placeholders.length,
    placeholderChars: placeholders.reduce((sum, placeholder) => sum + placeholder.length, 0),
    helperCount: helpers.length,
    helperBodyBytes: helpers.reduce((sum, helper) => sum + helper.bytecode.length / 2, 0),
    helpers: helpers.map((helper) => `${helper.name}:${helper.bytecode.length / 2}`),
    entryAccesses: artifact.abi.reduce((sum, fn) => sum + (fn.entryAccesses?.length ?? 0), 0),
  };
});

console.log(JSON.stringify({ commit: process.env.SURVEY_COMMIT ?? 'working-tree', rows }, null, 2));
