/**
 * Fence #11 residual negatives: recursive unwind + mapping / multi-stream settlement fences.
 */
import { compileString } from '../../src/compiler.js';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('Fence #11 recursive mapping residuals', () => {
  it('keeps recursive unwind event beside independently keyed mapping write behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      event Seen(int value);
      function fold(int depth, int seed) public returns (int) {
        if (depth == 0) return seed + 3;
        int result = fold(depth - 1, seed);
        this.values[depth] = result + depth;
        emit Seen(result + depth);
        return result;
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'fold'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps void post-recursion multi-stream mapping settlement behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) selected;
      mapping(int => int) removed;
      function apply(int cursor, int threshold) public {
        if (cursor == 0) return;
        apply(cursor - 1, threshold);
        if (cursor > threshold) this.selected[cursor] = cursor + 30;
        else delete this.removed[cursor + 1];
        require(cursor >= 1);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps overlapping nested streams sharing a literal tuple prefix behind KERNEL_LAYOUT', () => {
    // Proven residual from AffineRecursiveMappingStreams: shared literal outer key +
    // two overlapping nested reads into one unwind settlement.
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) source;
      mapping(int => int) destination;
      function apply(int cursor, int fallbackValue) public returns (int) {
        if (cursor == 0) return fallbackValue;
        int result = apply(cursor - 1, fallbackValue);
        this.destination[cursor] = this.source[7][cursor] + this.source[7][cursor + 1] + result;
        return result;
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('admits ordinary nested mapping writes (admitted #11 subset)', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(int => int)) grid;
      function work(int a, int b, int v) public {
        grid[a][b] = v;
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'work'))
      .toMatchObject({ eligible: true });
  });
});
