import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

type Handler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number] | undefined;

const handler = (source: string): Handler => compileString(source, KERNEL).messageBus?.handlers
  .find((candidate) => candidate.name === 'materialize');

describe('resolved pure-helper overload deployment recipes', () => {
  it('selects an exact same-arity parent helper for a constructor recipe', () => {
    const result = handler(`
      contract Unit(bytes32 digest) {
        int marker;
        function keep() public { require(true); }
      }
      contract Coordinator() {
        function derive(bytes2 value) private pure returns (bytes32) { return sha256(value); }
        function derive(bytes3 value) private pure returns (bytes32) { return hash256(value); }
        function materialize(bytes2 seed) public {
          Unit unit = new Unit(derive(seed));
          require(true);
        }
      }
    `);
    expect(result).toMatchObject({
      eligible: true,
      childDeployments: [{
        constructorArgs: [{ kind: 'hash', algorithm: 'sha256', resultType: 'bytes32' }],
      }],
    });
  });

  it('selects a later overload through a typed local alias', () => {
    const result = handler(`
      contract Unit(bytes32 digest) { int marker; }
      contract Coordinator() {
        function derive(bytes2 value) internal pure returns (bytes32) { return hash256(value); }
        function derive(bytes3 value) internal pure returns (bytes32) { return sha256(value); }
        function materialize(bytes3 seed) public {
          bytes3 selected = seed;
          Unit unit = new Unit(derive(selected));
          require(true);
        }
      }
    `);
    expect(result).toMatchObject({
      eligible: true,
      childDeployments: [{ constructorArgs: [{
        kind: 'hash', algorithm: 'sha256', resultType: 'bytes32',
      }] }],
    });
  });

  it('does not borrow a pure sibling when the selected overload is not pure', () => {
    const result = handler(`
      contract Unit(bytes32 digest) { int marker; }
      contract Coordinator() {
        function derive(bytes2 value) internal view returns (bytes32) { return sha256(value); }
        function derive(bytes3 value) internal pure returns (bytes32) { return hash256(value); }
        function materialize(bytes2 seed) public {
          Unit unit = new Unit(derive(seed));
          require(true);
        }
      }
    `);
    expect(result).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps the selected recursive overload fenced', () => {
    const helpers = `
      function derive(bytes2 value) internal pure returns (bytes32) { return derive(value); }
      function derive(bytes3 value) internal pure returns (bytes32) { return hash256(value); }
    `;
    const result = handler(`
      contract Unit(bytes32 digest) { int marker; }
      contract Coordinator() {
        ${helpers}
        function materialize(bytes2 seed) public {
          Unit unit = new Unit(derive(seed));
          require(true);
        }
      }
    `);
    expect(result).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
