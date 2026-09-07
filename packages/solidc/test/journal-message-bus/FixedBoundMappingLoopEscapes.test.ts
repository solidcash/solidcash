import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

type Handler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const compile = (body: string): { handler: Handler | undefined } => {
  const artifact = compileString(`contract StaticEscapes() {
      mapping(int => int) before;
      mapping(int => int) after;
      mapping(int => int) tail;
      bool stopped;
      function write(bool skip, int n) public {
        ${body}
        require(true);
      }
    }`, KERNEL);
  return {
    handler: artifact.messageBus?.handlers.find((handler) => handler.name === 'write'),
  };
};

describe('fixed-bound mapping loops with source escapes', () => {
  it('keeps static continue and break decisions fenced over a non-unit induction domain', () => {
    const { handler } = compile(`for (int i = 1; i < 10; i = i + 2) {
      this.before[i] = i;
      if (i == 3) continue;
      this.after[i] = i + 10;
      if (i == 7) break;
      this.tail[i] = i + 20;
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('keeps a statically skipped write suffix fenced', () => {
    const { handler } = compile(`for (int i = 0; i < 4; i = i + 1) {
      if (i % 2 == 0) continue;
      this.after[i] = i;
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it.each([
    ['runtime continue', 'if (skip) continue;'],
    ['runtime break', 'if (skip) break;'],
    ['state-selected continue', 'if (this.stopped) continue;'],
    ['state-selected break', 'if (this.stopped) break;'],
  ])('keeps %s outside fixed mapping-write unrolling', (_label, escape) => {
    const { handler } = compile(`for (int i = 0; i < 4; i = i + 1) {
      this.before[i] = i;
      ${escape}
      this.after[i] = i;
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('keeps a runtime-bound mapping escape set fenced', () => {
    const { handler } = compile(`for (int i = 0; i < n; i = i + 1) {
      this.before[i] = i;
      if (skip) continue;
      this.after[i] = i;
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });
});
