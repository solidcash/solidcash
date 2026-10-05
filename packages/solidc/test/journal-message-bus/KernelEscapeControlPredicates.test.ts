import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/index.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

const handler = (source: string, name = 'write'): {
  admission: NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number] | undefined;
  stream: NonNullable<ReturnType<typeof compileString>['abi'][number]['sortedUpsertLoopInfo']>[number] | undefined;
} => {
  const artifact = compileString(source, KERNEL);
  return {
    admission: artifact.messageBus?.handlers.find((candidate) => candidate.name === name),
    stream: artifact.abi.find((candidate) => candidate.name === name)?.sortedUpsertLoopInfo?.[0],
  };
};

const contract = (body: string, helpers = ''): string => `contract EscapeControl() {
  mapping(int => int) values;
  bool gate;
  ${helpers}
  function write(int n) public {
    ${body}
    require(true);
  }
  function control() public { require(true); }
}`;

describe('kernel counter-loop dead escape control', () => {
  it.each([
    ['while', `int i = 0;
      while (i < n) {
        if (false) { continue; }
        this.values[i] = i;
        i = i + 1;
      }`],
    ['do-while', `int i = 0;
      do {
        if (false) { continue; }
        this.values[i] = i;
        i = i + 1;
      } while (i < n);`],
  ])('ignores a provably dead non-progressing continue in a canonical %s', (_kind, loop) => {
    const result = handler(contract(loop));
    expect(result.admission).toMatchObject({ eligible: true });
    expect(result.stream).toBeDefined();
  });

  it.each([
    ['ascending bound', `int i = 0;
      while (i < n) {
        if (i >= n) { continue; }
        this.values[i] = i;
        i = i + 1;
      }`],
    ['descending literal floor', `int i = 4;
      while (i > n) {
        if (i >= 5) { continue; }
        this.values[i] = i;
        i = i - 1;
      }`],
    ['post-test literal floor', `int i = 0;
      do {
        if (i < 0) { continue; }
        this.values[i] = i;
        i = i + 1;
      } while (i < n);`],
    ['literal stride congruence', `int i = 0;
      while (i < n) {
        if (i % 2 == 1) { continue; }
        this.values[i] = i;
        i = i + 2;
      }`],
  ])('admits a %s predicate which is false over the complete affine counter domain', (_kind, loop) => {
    const result = handler(contract(loop));
    expect(result.admission).toMatchObject({ eligible: true });
    expect(result.stream).toBeDefined();
  });

  it.each([
    ['while', `int i = 0;
      while (i < n) {
        if (gate) { continue; }
        this.values[i] = i;
        i = i + 1;
      }`],
    ['do-while', `int i = 0;
      do {
        if (gate) { continue; }
        this.values[i] = i;
        i = i + 1;
      } while (i < n);`],
  ])('still refuses a runtime-selected non-progressing continue in a canonical %s', (_kind, loop) => {
    expect(handler(contract(loop)).admission).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });

  it.each([
    ['reachable equality', `int i = 0;
      while (i < n) {
        if (i == 1) { continue; }
        this.values[i] = i;
        i = i + 1;
      }`],
    ['reachable congruence', `int i = 0;
      while (i < n) {
        if (i % 2 == 0) { continue; }
        this.values[i] = i;
        i = i + 2;
      }`],
  ])('keeps a %s non-progressing continue fenced', (_kind, loop) => {
    expect(handler(contract(loop)).admission).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });
});

describe('kernel counter-loop helper escape predicates', () => {
  it.each([
    ['continue',
      'function selected(int i) private pure returns (bool) { return i % 2 == 0; }',
      `int i = 0; while (i < n) {
        if (selected(i)) { i = i + 1; continue; }
        this.values[i] = i; i = i + 1;
      }`,
      `int i = 0; while (i < n) {
        if (i % 2 == 0) { i = i + 1; continue; }
        this.values[i] = i; i = i + 1;
      }`],
    ['break',
      'function selected(int i) internal pure returns (bool) { return i == 3; }',
      `int i = 0; while (i < n) {
        if (selected(i)) { break; }
        this.values[i] = i; i = i + 1;
      }`,
      `int i = 0; while (i < n) {
        if (i == 3) { break; }
        this.values[i] = i; i = i + 1;
      }`],
  ])('treats a uniquely resolved pure %s helper like its inline predicate', (_kind, helper, viaHelper, inline) => {
    const expected = handler(contract(inline));
    expect(expected.admission).toMatchObject({ eligible: true });

    const actual = handler(contract(viaHelper, helper));
    expect(actual.admission).toMatchObject({ eligible: true });
    expect(actual.stream?.iterationCondition).toEqual(expected.stream?.iterationCondition);
    expect(actual.stream?.iterationBreakCondition).toEqual(expected.stream?.iterationBreakCondition);
  });

  it.each([
    ['recursive pure',
      `function selected(int i) private pure returns (bool) {
        if (i == 0) { return true; }
        return selected(i - 1);
      }`],
    ['state-mutating',
      `function selected(int i) private returns (bool) {
        this.gate = !this.gate;
        return i == 0;
      }`],
  ])('keeps a %s helper predicate fail-closed', (_kind, helper) => {
    const result = handler(contract(`int i = 0; while (i < n) {
      if (selected(i)) { i = i + 1; continue; }
      this.values[i] = i; i = i + 1;
    }`, helper));
    expect(result.admission).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });

  it('rejects an overload call whose literal argument does not uniquely resolve a helper', () => {
    expect(() => compileString(contract(`int i = 0; while (i < n) {
      if (selected(1)) { i = i + 1; continue; }
      this.values[i] = i; i = i + 1;
    }`, `function selected(uint8 i) private pure returns (bool) { return i == 1; }
      function selected(uint16 i) private pure returns (bool) { return i == 1; }`), KERNEL))
      .toThrow(/No unique declaration|ambiguous.*overload/i);
  });
});

describe('Fence #7 escape control beside effects', () => {
  it('keeps runtime continue beside emit in a counter loop behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) scores;
      event Touched(int indexed i);
      function work(int n, bool skipOdd) public {
        for (int i = 0; i < n; i = i + 1) {
          if (skipOdd && (i % 2) == 1) { continue; }
          scores[i] = i;
          emit Touched(i);
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'work'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps runtime break beside transfer in a counter loop behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) scores;
      function work(int n, int stopAt, bytes20 to) public {
        for (int i = 0; i < n; i = i + 1) {
          if (i == stopAt) { break; }
          scores[i] = i;
          this.transfer(to, 1000);
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'work'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps phased break beside emit+mutation behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) scores;
      event Touched(int indexed i);
      function work(int n, int stopAt) public {
        for (int i = 0; i < n; i = i + 1) {
          scores[i] = i;
          emit Touched(i);
          if (i == stopAt) { break; }
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'work'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });
});
