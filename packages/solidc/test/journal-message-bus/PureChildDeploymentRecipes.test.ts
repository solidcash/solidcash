import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('pure child deployment recipes', () => {
  it('publishes finite concatenation and nested hashing for constructor genesis', () => {
    const artifact = compileString(`
      contract Payload(bytes20 digest, bytes4 joined) {
        bytes20 storedDigest;
        bytes4 storedJoined;
        constructor() { this.storedDigest = digest; this.storedJoined = joined; }
      }
      contract Factory() {
        function create(bytes2 left, bytes2 right) public {
          bytes4 joined = left + right;
          Payload child = new Payload(hash160(joined), joined);
          require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
      childDeployments: [{
        constructorArgs: [
          {
            kind: 'hash', algorithm: 'hash160', resultType: 'bytes20',
            operand: {
              kind: 'concat', resultType: 'bytes4', operands: [
                { kind: 'handlerInput', inputIndex: 0, resultType: 'bytes2' },
                { kind: 'handlerInput', inputIndex: 1, resultType: 'bytes2' },
              ],
            },
          },
          { kind: 'concat', resultType: 'bytes4' },
        ],
        genesisState: { fields: [
          { name: 'storedDigest', value: { kind: 'hash', algorithm: 'hash160' } },
          { name: 'storedJoined', value: { kind: 'concat' } },
        ] },
      }],
    });
  });

  it.each(['ripemd160', 'sha1', 'sha256', 'hash160', 'hash256'])(
    'admits the pure %s builtin over byte input', (hash) => {
      const outputType = hash === 'sha256' || hash === 'hash256' ? 'bytes32' : 'bytes20';
      const artifact = compileString(`
        contract Payload(${outputType} digest) { ${outputType} stored; constructor() { this.stored = digest; } }
        contract Factory() {
          function create(bytes seed) public { Payload child = new Payload(${hash}(seed)); require(true); }
        }
      `, KERNEL);
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
        eligible: true,
        childDeployments: [{ constructorArgs: [{ kind: 'hash', algorithm: hash, resultType: outputType }] }],
      });
    },
  );

  it('carries a string concatenation through the child constructor into hashed genesis', () => {
    const artifact = compileString(`
      contract Payload(string joined, bytes32 digest) {
        bytes32 stored;
        constructor() { this.stored = digest; }
      }
      contract Factory() {
        function create(string left, string right) public {
          Payload child = new Payload(left + right, sha256(left + right));
          require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
      childDeployments: [{
        constructorArgs: [
          { kind: 'concat', resultType: 'string' },
          { kind: 'hash', algorithm: 'sha256', operand: { kind: 'concat', resultType: 'string' } },
        ],
        genesisState: { fields: [{
          name: 'stored',
          value: { kind: 'hash', algorithm: 'sha256', operand: { kind: 'concat', resultType: 'string' } },
        }] },
      }],
    });
  });

  it('publishes numeric hashing with one explicit VM-stack operand', () => {
    const artifact = compileString(`
      contract Payload(bytes32 digest) { bytes32 stored; constructor() { this.stored = digest; } }
      contract Factory() {
        function create(int seed) public { Payload child = new Payload(sha256(seed)); require(true); }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
      childDeployments: [{ constructorArgs: [{
        kind: 'hash', algorithm: 'sha256', resultType: 'bytes32',
        operand: { kind: 'handlerInput', inputIndex: 0, resultType: 'int256' },
      }] }],
    });
  });

  it.each([
    ['transaction data', 'sha256(tx.inputs[0].lockingBytecode)'],
    ['state data', 'sha256(this.seed)'],
    ['effectful call', 'sha256(load())'],
  ])('keeps %s out of child deployment recipes', (_label, expression) => {
    const artifact = compileString(`
      contract Payload(bytes32 digest) { bytes32 stored; constructor() { this.stored = digest; } }
      contract Factory() {
        bytes seed;
        function load() internal returns (bytes) { this.seed = hex"01"; require(true); return this.seed; }
        function create() public { Payload child = new Payload(${expression}); require(true); }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
