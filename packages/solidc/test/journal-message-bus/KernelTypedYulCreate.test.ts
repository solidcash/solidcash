import { describe, expect, it } from 'vitest';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileStringMulti } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  solidityImportCompat: true,
  maximumInputBytes: 1_000_000,
} as const;

const source = (opcode: 'create' | 'create2'): string => `
  contract Unit() {
    int marker;
    constructor() { this.marker = 7; }
  }
  contract Factory() {
    function materialize(bytes32 salt) public returns (address result) {
      bytes memory creation = type(Unit).creationCode;
      assembly {
        result := ${opcode}(0, add(creation, 0x20), mload(creation)${opcode === 'create2' ? ', salt' : ''})
      }
      require(true);
    }
  }
`;

describe('kernel typed Yul contract creation', () => {
  it.each(['create', 'create2'] as const)(
    'publishes compiler-owned child geometry for %s over type(C).creationCode', (opcode) => {
      const artifact = compileStringMulti(source(opcode), KERNEL).Factory;
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
      expect(handler).toMatchObject({
        eligible: true,
        childDeployments: [{
          siteIndex: 0,
          contractName: 'Unit',
          occurrence: 'once',
          genesisInputCount: 1,
          masterOutputCount: 1,
          dataNftOutputCount: 1,
          totalOutputCount: 2,
          categorySource: 'genesis-input-outpoint-txhash',
          constructorArgs: [],
          genesisState: { kind: 'constructor', fields: [{ name: 'marker' }] },
        }],
      });
      if (opcode === 'create2') {
        expect(handler?.childDeployments?.[0].salt)
          .toMatchObject({ kind: 'handlerInput', inputIndex: 0 });
      } else {
        expect(handler?.childDeployments?.[0]).not.toHaveProperty('salt');
      }
    },
  );

  it.each([
    ['abi.encodePacked', 'abi.encodePacked(type(Unit).creationCode, abi.encode(initial, tag))'],
    ['bytes.concat', 'bytes.concat(type(Unit).creationCode, abi.encode(initial, tag))'],
  ])('reuses typed constructor recipes for %s creation buffers', (_label, creationExpression) => {
    const artifact = compileStringMulti(`
      contract Unit(int initial, bytes2 label) {
        int marker;
        bytes2 tag;
        constructor() { this.marker = initial; this.tag = label; }
      }
      contract Factory() {
        function materialize(int initial, bytes2 tag, bytes32 salt) public returns (address result) {
          bytes memory creation = ${creationExpression};
          assembly { result := create2(0, add(creation, 0x20), mload(creation), salt) }
          require(true);
        }
      }
    `, { ...KERNEL, suppressWarnings: true }).Factory;
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
    expect(handler).toMatchObject({
      eligible: true,
      childDeployments: [{
        contractName: 'Unit',
        constructorArgs: [
          { kind: 'handlerInput', inputIndex: 0, resultType: 'int256' },
          { kind: 'handlerInput', inputIndex: 1, resultType: 'bytes2' },
        ],
        genesisState: { fields: [
          { name: 'marker', value: { kind: 'handlerInput', inputIndex: 0 } },
          { name: 'tag', value: { kind: 'handlerInput', inputIndex: 1 } },
        ] },
        salt: { kind: 'handlerInput', inputIndex: 2 },
      }],
    });
    const routeBody = artifact.functionBodies?.['53434231'];
    expect(routeBody).toBeDefined();
    expect(bytecodeToAsm(Uint8Array.from(Buffer.from(routeBody!, 'hex')))).toContain('OP_INVOKE');
  });

  it('keeps a returned handler input live through typed deployment settlement', () => {
    const artifact = compileStringMulti(`
      contract Unit(int initial) {
        int marker;
        constructor() { this.marker = initial; }
      }
      contract Factory() {
        function materialize(int initial, bytes32 salt) public returns (int echoed) {
          bytes memory creation = abi.encodePacked(type(Unit).creationCode, abi.encode(initial));
          address deployed;
          assembly { deployed := create2(0, add(creation, 0x20), mload(creation), salt) }
          echoed = initial;
          require(deployed != address(0));
        }
      }
    `, { ...KERNEL, suppressWarnings: true }).Factory;
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
    expect(handler).toMatchObject({
      eligible: true,
      childDeployments: [{
        constructorArgs: [{ kind: 'handlerInput', inputIndex: 0 }],
        genesisState: { fields: [{
          name: 'marker', value: { kind: 'handlerInput', inputIndex: 0 },
        }] },
      }],
    });
  });

  it.each([
    ['mutated typed buffer', `
      bytes memory creation = abi.encodePacked(type(Unit).creationCode, abi.encode(initial));
      creation = runtimeCode;
      assembly { result := create(0, add(creation, 0x20), mload(creation)) }
    `, undefined],
    ['constructor input rebound after encoding', `
      bytes memory creation = abi.encodePacked(type(Unit).creationCode, abi.encode(initial));
      initial = initial + 1;
      assembly { result := create(0, add(creation, 0x20), mload(creation)) }
    `, undefined],
  ] as const)('keeps %s outside typed child deployment metadata', (_label, body, rejectionReason) => {
    const artifact = compileStringMulti(`
      contract Unit(int initial) { int marker; constructor() { this.marker = initial; } }
      contract Factory() {
        function materialize(int initial, bytes memory runtimeCode) public returns (address result) {
          ${body}
          require(true);
        }
      }
    `, { ...KERNEL, suppressWarnings: true }).Factory;
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
    expect(handler).not.toHaveProperty('childDeployments');
    if (rejectionReason) expect(handler).toMatchObject({ eligible: false, rejectionReason });
  });

  it('refuses value-funded typed CREATE rather than publishing incomplete output geometry', () => {
    expect(() => compileStringMulti(`
      contract Unit(int initial) { int marker; constructor() { this.marker = initial; } }
      contract Factory() {
        function materialize(int initial) public returns (address result) {
          bytes memory creation = abi.encodePacked(type(Unit).creationCode, abi.encode(initial));
          assembly { result := create(1, add(creation, 0x20), mload(creation)) }
          require(true);
        }
      }
    `, { ...KERNEL, suppressWarnings: true })).toThrow(/create.*no BCH equivalent/);
  });

  it('does not replay a mutated reference constructor argument at CREATE', () => {
    const artifact = compileStringMulti(`
      contract Unit(bytes seed) { bytes marker; constructor() { this.marker = seed; } }
      contract Factory() {
        function materialize(bytes memory seed) public returns (address result) {
          bytes memory creation = abi.encodePacked(type(Unit).creationCode, abi.encode(seed));
          seed[0] = hex"ff";
          assembly { result := create(0, add(creation, 0x20), mload(creation)) }
          require(true);
        }
      }
    `, { ...KERNEL, suppressWarnings: true }).Factory;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .not.toHaveProperty('childDeployments');
  });

  it('does not invent child lifecycle geometry for arbitrary runtime bytecode', () => {
    const artifact = compileStringMulti(`contract Factory() {
      function derive(bytes memory creation, bytes32 salt) public returns (address result) {
        assembly { result := create2(0, add(creation, 0x20), mload(creation), salt) }
        require(true);
      }
      function lifecycleOnly(bytes memory creation) public deploy {
        require(creation.length >= 0);
      }
    }`, KERNEL).Factory;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'derive'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'derive'))
      .not.toHaveProperty('childDeployments');
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'lifecycleOnly'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LIFECYCLE' });
  });
});
