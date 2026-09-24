/**
 * Fence #15 permanent residual negatives: foreign delegatecall execution.
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

describe('Fence #15 foreign-delegate residuals', () => {
  it('keeps constructor-bound foreign delegatecall behind KERNEL_FOREIGN_DELEGATE', () => {
    const artifact = compileString(`contract C(address impl) {
      function denied(bytes input) public {
        impl.delegatecall(input);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps literal-address foreign delegatecall behind KERNEL_FOREIGN_DELEGATE', () => {
    const artifact = compileString(`contract C() {
      function denied(bytes input) public {
        address(hex"51").delegatecall(input);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps conditional-frame foreign delegatecall behind KERNEL_FOREIGN_DELEGATE', () => {
    const artifact = compileString(`contract C(address impl) {
      function denied(bytes input, bool active) public {
        if (active) { impl.delegatecall(input); }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps state-resolved foreign delegatecall behind KERNEL_FOREIGN_DELEGATE', () => {
    const artifact = compileString(`contract C() {
      address stored;
      function denied(bytes input) public {
        address(this.stored).delegatecall(input);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('admits a non-delegate control handler beside a fenced foreign relay (admitted neighbor)', () => {
    const artifact = compileString(`contract C(address impl) {
      function denied(bytes input) public {
        impl.delegatecall(input);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });
});
