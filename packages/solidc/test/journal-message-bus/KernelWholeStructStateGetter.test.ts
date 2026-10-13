import { compileString } from '../../src/compiler.js';
import { binToHex } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileAddressToEvmIdentity } from '../../src/generation/utils.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

describe('kernel whole-struct state getters', () => {
  it('admits a finite fixed-layout nested struct as one ABI result', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; bytes4 tag; uint16[2] marks; }
      contract Source {
        Record record;
        function read() public view returns (Record memory) { return record; }
      }`, OPTIONS);

    expect(artifact.stateLayout).toMatchObject({
      variables: [{ name: 'record', type: 'Record' }],
    });
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read')).toMatchObject({
      eligible: true,
      outputs: [{ type: 'Record' }],
    });
  });

  it('keeps a state-backed struct result behind the signature self-commit fence', () => {
    const artifact = compileString(`
      struct Record { bigint amount; sig authorization; }
      contract Source(pubkey owner) {
        Record record;
        function read(sig proof) public view returns (Record) {
          require(checkSig(proof, owner));
          return this.record;
        }
      }`, { ...OPTIONS, evmCompat: false });

    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
    });
  });

  it('authenticates a whole flattened state struct containing a dynamic array', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 value; uint16[] marks; }
      contract Source {
        Record record;
        function read() public view returns (Record memory) { return record; }
      }`, OPTIONS);

    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'read')).toMatchObject({
      eligible: true,
      outputs: [{ type: 'Record' }],
    });
    expect(artifact.abi.find((entry) => entry.name === 'read')?.dynamicReads).toEqual(['record__marks']);
    expect(artifact.messageBus?.route.dynamicReads).toEqual(['record__marks']);
  });

  it('normalizes variable-width BCH addresses before encoding a Solidity struct result', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { address owner; string label; }
      contract Source {
        Record record;
        function read() public view returns (Record memory) { return record; }
      }`, OPTIONS);
    // The 12-zero-byte prefix check may be outlined into its own helper once the contract pushes that word twice.
    const zeroWord = binToHex(scriptToBytecode([new Uint8Array(12)]));
    const [head, tail] = binToHex(scriptToBytecode(compileAddressToEvmIdentity())).split(zeroWord);
    expect(artifact.debug.bytecode).toMatch(new RegExp(`${head}(?:${zeroWord}|(?:5[1-9a-f]|60|01[0-9a-f]{2})8a)${tail}`));
  });
});
