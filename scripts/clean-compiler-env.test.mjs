import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanCompilerEnvironment } from './clean-compiler-env.mjs';

test('cold compilation drops inherited compiler switches but preserves unrelated environment', () => {
  assert.deepEqual(cleanCompilerEnvironment({
    PATH: '/bin',
    SOLIDC_DEBUG_NO_OUTLINE: '1',
    SOLIDC_COMPILE_CACHE: '1',
    SOLIDC_ROUTE_ABI_TAIL: '0',
  }), { PATH: '/bin' });
});
