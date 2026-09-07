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

  it('publishes the dedicated bytes.concat and string.concat AST forms', () => {
    const bytesArtifact = compileString(`
      contract Payload(bytes5 joined) { bytes5 stored; constructor() { this.stored = joined; } }
      contract Factory() {
        function create(bytes2 first, bytes3 second) public {
          Payload child = new Payload(bytes5(bytes.concat(first, second))); require(true);
        }
      }
    `, KERNEL);
    expect(bytesArtifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
      childDeployments: [{ constructorArgs: [{
        kind: 'cast', resultType: 'bytes5', operand: {
          kind: 'concat', resultType: 'bytes', operands: [
            { kind: 'handlerInput', inputIndex: 0, resultType: 'bytes2' },
            { kind: 'handlerInput', inputIndex: 1, resultType: 'bytes3' },
          ],
        },
      }] }],
    });

    const stringArtifact = compileString(`
      contract Payload(bytes32 digest) { bytes32 stored; constructor() { this.stored = digest; } }
      contract Factory() {
        function create(string left, string right) public {
          Payload child = new Payload(sha256(string.concat(left, right))); require(true);
        }
      }
    `, KERNEL);
    expect(stringArtifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
      childDeployments: [{ constructorArgs: [{
        kind: 'hash', algorithm: 'sha256', resultType: 'bytes32',
        operand: {
          kind: 'concat', resultType: 'string', operands: [
            { kind: 'handlerInput', inputIndex: 0, resultType: 'string' },
            { kind: 'handlerInput', inputIndex: 1, resultType: 'string' },
          ],
        },
      }] }],
    });
  });

  it('inlines acyclic pure helpers into constructor and genesis byte recipes', () => {
    const artifact = compileString(`
      contract Payload(bytes5 joined, bytes32 digest) {
        int marker;
        function keep() public { require(true); }
      }
      contract Factory() {
        function joined(bytes2 first, bytes3 second) internal pure returns (bytes5) {
          return bytes5(bytes.concat(first, second));
        }
        function digest(bytes2 first, bytes3 second) private pure returns (bytes32) {
          bytes packed = abi.encodePacked(first, second);
          return sha256(packed);
        }
        function create(bytes2 first, bytes3 second) public {
          Payload child = new Payload(joined(first, second), digest(first, second));
          require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
      childDeployments: [{
        constructorArgs: [
          { kind: 'cast', resultType: 'bytes5', operand: { kind: 'concat', resultType: 'bytes' } },
          { kind: 'hash', algorithm: 'sha256', operand: { kind: 'concat', resultType: 'bytes' } },
        ],
      }],
    });
  });

  it('folds pure concat/hash/packed helpers into constructor genesis', () => {
    const artifact = compileString(`
      contract Payload(bytes2 first, bytes3 second) {
        bytes32 stored;
        constructor() { this.stored = digest(first, second); }
        function digest(bytes2 left, bytes3 right) private pure returns (bytes32) {
          bytes packed = abi.encodePacked(left, right);
          return sha256(packed);
        }
      }
      contract Factory() {
        function create(bytes2 first, bytes3 second) public {
          Payload child = new Payload(first, second); require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
      childDeployments: [{ genesisState: { fields: [{
        name: 'stored', value: {
          kind: 'hash', algorithm: 'sha256', operand: { kind: 'concat', resultType: 'bytes' },
        },
      }] } }],
    });
  });

  it.each([
    ['recursive', `function helper(bytes2 value) internal pure returns (bytes32) {
      return helper(value);
    }`],
    ['ambiguous same-arity overloads', `function helper(bytes2 value) internal pure returns (bytes32) {
      return sha256(value);
    }
    function helper(bytes3 value) internal pure returns (bytes32) {
      return sha256(value);
    }`],
  ])('keeps %s parent deployment helpers fenced', (_label, helpers) => {
    const artifact = compileString(`
      contract Payload(bytes32 digest) { int marker; function keep() public { require(true); } }
      contract Factory() {
        ${helpers}
        function create(bytes2 value) public {
          Payload child = new Payload(helper(value)); require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
      childDeployments: [{ constructorArgs: [{ kind: 'expression' }] }],
    });
  });

  it('does not let a replayable deployment helper mask an unrelated unsupported effect', () => {
    const artifact = compileString(`
      contract Payload(bytes32 digest) { int marker; function keep() public { require(true); } }
      contract Factory(address target) {
        function helper(bytes2 value) internal pure returns (bytes32) { return sha256(value); }
        function create(bytes2 value, bytes payload) public {
          target.delegatecall(payload);
          Payload child = new Payload(helper(value));
          require(true);
        }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
      childDeployments: [{ constructorArgs: [{ kind: 'hash', algorithm: 'sha256' }] }],
    });
  });

  it.each([
    ['mixed byte/string operands', 'bytes', 'bytes part, string suffix', 'bytes.concat(part, suffix)'],
    ['mixed string/byte operands', 'string', 'string part, bytes suffix', 'string.concat(part, suffix)'],
    ['transaction-dependent operands', 'bytes', 'bytes part', 'bytes.concat(part, tx.inputs[0].lockingBytecode)'],
  ])('keeps static concat with %s out of child recipes', (_label, childType, parameters, expression) => {
    const artifact = compileString(`
      contract Payload(${childType} joined) { bytes32 stored; constructor() { this.stored = sha256(joined); } }
      contract Factory() {
        function create(${parameters}) public { Payload child = new Payload(${expression}); require(true); }
      }
    `, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        childDeployments: [{ constructorArgs: [{ kind: 'expression' }] }],
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
