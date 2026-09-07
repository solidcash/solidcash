import { describe, expect, it } from 'vitest';
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
