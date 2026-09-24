/**
 * Fence #12 residual negatives: runtime-count / escaping / ambiguous child-deploy geometry.
 */
import { compileString, compileStringMulti } from '../../src/compiler.js';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('Fence #12 child-deploy residuals', () => {
  it('keeps a runtime-count stateful deployment loop behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract Child() { int marker; }
      contract C() {
        function denied(int count) public {
          for (int i = 0; i < count; i = i + 1) { Child child = new Child(); }
          require(true);
        }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps a >64-iteration bounded deploy loop behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply() public {
          for (int i = 0; i < 65; i = i + 1) { Unit child = new Unit(i); }
          require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps ambiguous switch exits fenced from deployment joins behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(int choice, int seed) public {
          int adjusted = seed;
          switch (choice) {
            case 1: if (seed > 0) { break; } adjusted = seed + 10; break;
            default: adjusted = seed + 20; break;
          }
          Unit child = new Unit(adjusted);
          require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps abrupt branch exits fenced from deployment joins behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(bool enabled, int seed) public {
          int adjusted = seed;
          if (enabled) { adjusted = seed + 10; revert("stop"); }
          Unit child = new Unit(adjusted);
          require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps opaque tx ctor provenance out of child recipes behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`
      contract Payload(bytes32 digest) { bytes32 stored; constructor() { this.stored = digest; } }
      contract Factory() {
        function create() public {
          Payload child = new Payload(sha256(tx.inputs[0].lockingBytecode));
          require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('admits a straight-line typed child deployment site (admitted #12 subset)', () => {
    const artifact = compileStringMulti(`
      contract Child(int x) { int public v; constructor() { v = x; } }
      contract Parent() {
        function spawn(int x) public deploy {
          new Child(x);
          require(true);
        }
        function control() public { require(true); }
      }
    `, KERNEL).Parent;
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'spawn'))
      .toMatchObject({ eligible: true });
  });
});
