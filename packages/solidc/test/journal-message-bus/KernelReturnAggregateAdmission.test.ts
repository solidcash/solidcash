import { compileString } from '../../src/compiler.js';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

type MessageBusHandler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const handler = (source: string, name: string, solidity = false): MessageBusHandler | undefined => compileString(source, {
  ...KERNEL,
  ...(solidity && { solidityImportCompat: true }),
}).messageBus?.handlers.find((candidate) => candidate.name === name);

describe('kernel aggregate return admission', () => {
  it('admits finite nested struct/array leaves and a mixed multi-return tuple', () => {
    const source = `pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; }
      struct Envelope { Record record; bytes payload; }
      contract C {
        function snapshot() public pure
          returns (Record memory, uint16[2] memory, bytes memory, Envelope memory) {
          uint16[2] memory marks = [uint16(4), uint16(6)];
          return (Record(9, Detail(70, 1)), marks, hex"cafe",
            Envelope(Record(12, Detail(80, 0)), hex"abcd"));
        }
      }`;

    expect(handler(source, 'snapshot', true)).toMatchObject({
      eligible: true,
      outputs: [{ type: 'Record' }, { type: 'uint16[2]' }, { type: 'bytes' }, { type: 'Envelope' }],
    });
  });

  it('preserves a forwarded source tuple as separate encodable return components', () => {
    const source = `contract C() {
      function pair() internal pure returns (int, bool) { return (7, true); }
      function forwarded() public pure returns (int, bool) { return pair(); }
    }`;

    expect(handler(source, 'forwarded')).toMatchObject({
      eligible: true,
      outputs: [{ type: 'int256' }, { type: 'bool' }],
    });
  });

  it('publishes a fixed self function pointer as its physical integer function id', () => {
    const source = `pragma solidity ^0.8.0;
      contract C {
        function target(uint value) external pure returns (uint) { return value; }
        function pointer() public view returns (function(uint) external returns (uint)) {
          return this.target;
        }
      }`;

    expect(handler(source, 'pointer', true)).toMatchObject({
      eligible: true,
      outputs: [{ type: 'int256' }],
    });
  });

  it('keeps a cyclic aggregate return behind the earlier public-ABI materialization fence', () => {
    const source = `pragma solidity ^0.8.0;
      struct Node { Node[] children; uint value; }
      contract C {
        Node root;
        function read() public view returns (Node memory) { return root; }
      }`;

    expect(() => compileString(source, { ...KERNEL, solidityImportCompat: true }))
      .toThrow(/cannot be used as return values of an external\/public function/);
  });

  it('admits an opaque nested sig result only when it cannot self-commit', () => {
    const source = `struct Result { bytes tag; sig authorization; }
      contract C() {
        function data(bytes raw) public pure returns (Result) {
          return Result(hex"01", sig(raw));
        }
      }`;

    expect(handler(source, 'data')).toMatchObject({
      eligible: true,
      outputs: [{ type: 'Result' }],
    });
  });

  it('keeps a nested returned sig behind the transaction-signature fence', () => {
    const source = `struct Result { bytes tag; sig authorization; }
      contract C(pubkey key) {
        function checked(bytes raw) public view returns (Result) {
          sig authorization = sig(raw);
          require(checkSig(authorization, key));
          return Result(hex"01", authorization);
        }
      }`;

    expect(handler(source, 'checked')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
    });
  });

  it('keeps SolidCash-only byte-string leaves out of Solidity ABI return layouts', () => {
    const source = `pragma solidity ^0.8.0;
      struct Result { pubkey signer; bytes payload; }
      contract C {
        function data(pubkey signer) public pure returns (Result memory) {
          return Result(signer, hex"01");
        }
      }`;

    expect(handler(source, 'data', true)).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });
});
