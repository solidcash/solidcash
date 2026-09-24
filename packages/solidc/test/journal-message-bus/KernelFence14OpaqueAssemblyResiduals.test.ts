/**
 * Fence #14 residual negatives: opaque / stack-divergent / active-bytecode assembly effects.
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

describe('Fence #14 opaque-assembly residuals', () => {
  it('keeps stack-divergent native assembly behind KERNEL_OPAQUE_EFFECT', () => {
    const artifact = compileString(`contract C() {
      int public x;
      function touch() public {
        assembly { OP_DUP }
        x = 1;
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'touch'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_OPAQUE_EFFECT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps hashed active-bytecode native assembly behind KERNEL_OPAQUE_EFFECT', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { OP_ACTIVEBYTECODE OP_SHA256 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_OPAQUE_EFFECT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps mixed lowerable Yul + opaque active-bytecode assembly behind KERNEL_OPAQUE_EFFECT', () => {
    const artifact = compileString(`contract C() {
      struct S { int x; }
      int value;
      function denied(S calldata arg, int next) public {
        assembly { sstore(value.slot, next) }
        assembly { OP_ACTIVEBYTECODE OP_SHA256 OP_DROP }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_OPAQUE_EFFECT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps native assembly that borrows compiler-stack values behind KERNEL_OPAQUE_EFFECT', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { OP_1 OP_LSHIFT OP_DROP } require(true); }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_OPAQUE_EFFECT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('admits isolated stack-neutral native assembly (admitted #14 subset)', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function touch() public { assembly { OP_1 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'touch'))
      .toMatchObject({ eligible: true });
  });
});
