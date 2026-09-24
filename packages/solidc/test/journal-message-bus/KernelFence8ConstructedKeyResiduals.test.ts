/**
 * Fence #8 residual negatives: multi-arm / cross-array / effectful constructed-key producers.
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

describe('Fence #8 constructed-key residuals', () => {
  it('keeps ternary multi-arm key-vector joins behind KERNEL_UNBOUNDED_KEY', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) scores;
      function work(bool pick, int[] memory a, int[] memory b, int v) public {
        int[] memory keys = pick ? a : b;
        for (int i = 0; i < keys.length; i = i + 1) {
          scores[keys[i]] = v;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'work'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_UNBOUNDED_KEY',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps cross-array dual-vector key writes behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) scores;
      function work(int[] memory a, int[] memory b, int v) public {
        for (int i = 0; i < a.length; i = i + 1) {
          scores[a[i]] = v;
          scores[b[i]] = v;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'work'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps effectful constructed-key producers behind KERNEL_UNBOUNDED_KEY', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) scores;
      int counter;
      function makeKeys(int n) internal returns (int[] memory) {
        int[] memory keys;
        for (int i = 0; i < n; i = i + 1) {
          keys.push(i);
          this.counter = this.counter + 1;
        }
        return keys;
      }
      function work(int n, int v) public {
        int[] memory keys = makeKeys(n);
        for (int i = 0; i < keys.length; i = i + 1) {
          scores[keys[i]] = v;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'work'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_UNBOUNDED_KEY',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('admits a parameter array key vector with dominating writes (admitted #8 subset)', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) scores;
      function work(int[] memory keys, int v) public {
        for (int i = 0; i < keys.length; i = i + 1) {
          scores[keys[i]] = v;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'work'))
      .toMatchObject({ eligible: true });
  });
});
