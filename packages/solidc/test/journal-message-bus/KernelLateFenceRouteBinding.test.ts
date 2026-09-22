import { bytecodeToAsm } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const SOURCE = `contract C() {
  struct Pair { int left; int right; }
  mapping(int => Pair) pairs;
  function update(int n) public {
    for (int i=0; i<n; i=i+1) { Pair pair=pairs[i]; pair.left=pair.left+1; pairs[i]=pair; }
    require(true);
  }
  function ping() public { require(true); }
}`;

const selectorPushCount = (artifact: ReturnType<typeof compileString>, selectorHex: string): number => {
  const body = artifact.functionBodies?.['53434231'];
  expect(body).toBeDefined();
  const haystack = bytecodeToAsm(Uint8Array.from(Buffer.from(body!, 'hex'))).replace(/\s+/g, '').toLowerCase();
  const needle = selectorHex.toLowerCase();
  let count = 0;
  let from = 0;
  while (from < haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
};

describe('kernel late-fence route binding', () => {
  it('does not leave a late-fenced handler selector in the bound kernel route', () => {
    for (const optimizeForCompilationSpeed of [undefined, true] as const) {
      const artifact = compileString(SOURCE, { ...KERNEL, optimizeForCompilationSpeed });
      const update = artifact.messageBus?.handlers.find((handler) => handler.name === 'update');
      const ping = artifact.messageBus?.handlers.find((handler) => handler.name === 'ping');
      expect(update, `speed=${String(optimizeForCompilationSpeed)}`).toMatchObject({
        eligible: false, rejectionReason: 'KERNEL_LAYOUT',
      });
      expect(ping, `speed=${String(optimizeForCompilationSpeed)}`).toMatchObject({ eligible: true });
      expect(artifact.messageBus).toMatchObject({
        convention: 'kernel-row-loop', available: true, routeInBytecode: true,
      });
      expect(selectorPushCount(artifact, update!.selector), `speed=${String(optimizeForCompilationSpeed)}`)
        .toBe(0);
      expect(selectorPushCount(artifact, ping!.selector), `speed=${String(optimizeForCompilationSpeed)}`)
        .toBe(1);
    }
  });
});
