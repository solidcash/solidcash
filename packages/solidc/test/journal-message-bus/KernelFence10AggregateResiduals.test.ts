/**
 * Fence #10 residual negatives: recursive/cyclic aggregates, tx-participating nested sig,
 * Solidity-incompatible leaves in return layouts.
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

describe('Fence #10 aggregate residuals', () => {
  it('refuses recursive/cyclic Node return at public ABI materialization', () => {
    expect(() => compileString(`pragma solidity ^0.8.0;
      struct Node { uint256 value; Node[] children; }
      contract C {
        Node root;
        function read() public view returns (Node memory) { return root; }
        function control() public { require(true); }
      }`, { ...KERNEL, evmCompat: true }))
      .toThrow(/cannot be used as return values|recursive/i);
  });

  it('keeps checkSig-participating nested sig return behind KERNEL_TX_SIGNATURE', () => {
    const artifact = compileString(`struct Result { bytes tag; sig authorization; }
      contract C(pubkey key) {
        function checked(bytes raw) public view returns (Result) {
          sig authorization = sig(raw);
          require(checkSig(authorization, key));
          return Result(hex"01", authorization);
        }
        function control() public { require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'checked'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_TX_SIGNATURE',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps Solidity-incompatible pubkey leaf aggregate returns behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Result { pubkey signer; bytes payload; }
      contract C {
        function data(pubkey signer) public pure returns (Result memory) {
          return Result(signer, hex"01");
        }
        function control() public { require(true); }
      }`, { ...KERNEL, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'data'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('admits finite nested struct/array leaves (admitted #10 subset)', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; }
      contract C {
        function snapshot() public pure returns (Record memory) {
          return Record(9, Detail(70, 1));
        }
        function control() public { require(true); }
      }`, { ...KERNEL, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'snapshot'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Record' }] });
  });
});
