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

describe('mapping loops with source escapes', () => {
  it('statically replays a mixed multi-site escape domain after substituting the fixed counter', () => {
    const { handler } = compile(`for (int i = 1; i < 10; i = i + 2) {
      this.before[i] = i;
      if (i == 3) continue;
      this.after[i] = i + 10;
      if (i == 7) break;
      this.tail[i] = i + 20;
    }`);
    expect(handler).toMatchObject({ eligible: true });
    // Four `before`, three `after`, and two `tail` writes survive the statically replayed escapes.
    expect(handler?.physicalEntrySlots).toHaveLength(9);
  });

  it('keeps the equivalent runtime-selected mixed escape domain fenced', () => {
    const { handler } = compile(`for (int i = 1; i < 10; i = i + 2) {
      this.before[i] = i;
      if (skip) continue;
      this.after[i] = i + 10;
      if (i == 7) break;
      this.tail[i] = i + 20;
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('publishes a statically selected write suffix through the exact row loop', () => {
    const { handler } = compile(`for (int i = 0; i < 4; i = i + 1) {
      if (i % 2 == 0) continue;
      this.after[i] = i;
    }`);
    expect(handler).toMatchObject({ eligible: true });
  });

  it.each([
    ['runtime continue', 'if (skip) continue;'],
    ['runtime break', 'if (skip) break;'],
    ['state-selected continue', 'if (this.stopped) continue;'],
    ['state-selected break', 'if (this.stopped) break;'],
  ])('publishes %s through an authenticated exact escape domain', (_label, escape) => {
    const { handler } = compile(`for (int i = 0; i < 4; i = i + 1) {
      this.before[i] = i;
      ${escape}
      this.after[i] = i;
    }`);
    expect(handler).toMatchObject({ eligible: true });
  });

  it('keeps runtime-selected streams without one shared schedule behind the layout fence', () => {
    const { handler } = compile(`for (int i = 0; i < n; i = i + 1) {
      this.before[i] = i;
      if (skip) continue;
      this.after[i] = i;
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('publishes a terminating do-while break domain', () => {
    const { handler } = compile(`int i = 0;
      do {
        this.before[i] = i;
        if (skip) break;
        i = i + 1;
      } while (i < n);`);
    expect(handler).toMatchObject({ eligible: true });
  });

  it('keeps a non-progressing do-while continue fenced', () => {
    const { handler } = compile(`int i = 0;
      do {
        this.before[i] = i;
        if (skip) continue;
        i = i + 1;
      } while (i < n);`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });
});
