import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../src/compiler.js';

const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
interface IReader { function read(uint256 id) external view returns (uint256); }
interface ISink { function submit(bytes32 digest) external; }
contract ComputeRecipeFixture(IReader reader, ISink sink) {
  uint256 public marker;
  function run(uint256 id) public {
    uint256 observed = reader.read(id);
    bytes32 digest = keccak256(bytes.concat(hex"ff", keccak256(abi.encode(observed, id))));
    require(digest != bytes32(0));
    sink.submit(digest);
  }
}`, {
  solidityImportCompat: true, forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true, optimizeForCompilationSpeed: true,
});

describe('authenticated compute side-car recipes', () => {
  it('binds nested Keccak operands to source call ordinals and the exact producer result', () => {
    const artifact = artifacts.ComputeRecipeFixture;
    const handler = artifact.abi.find((fn) => fn.name === 'run');
    expect(handler?.keccakPreimageParams).toEqual([null, null]);
    const recipe = handler?.computeSideCarRecipes;
    expect(recipe?.version).toBe(1);
    expect(recipe?.keccak).toHaveLength(2);
    expect(recipe?.keccak[0]).toMatchObject({ kind: 'bytesConcat', args: [
      { kind: 'literal', value: 'ff' }, { kind: 'call', name: 'keccak256' },
    ] });
    expect(recipe?.keccak[1]).toMatchObject({ kind: 'abiEncode', args: [
      { kind: 'producerResult', callsiteId: 0, resultIndex: 0 },
      { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
    ] });
    expect(recipe?.ecrecover).toEqual([]);
    expect(artifact.messageBus?.handlers.find((fn) => fn.name === 'run')?.computeSideCarRecipes)
      .toEqual(recipe);
  });

  it('publishes typed packed-ABI and cast operands used by a pre-call hash', () => {
    const source = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISink { function ping() external; }
      contract PackedRecipeFixture(ISink sink) {
        uint256 marker;
        function run(uint16 x, bytes2 y) public {
          require(keccak256(abi.encodePacked(uint16(2), x, y, true)) != bytes32(0));
          sink.ping();
        }
      }`, {
      solidityImportCompat: true, forceStateful: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000, suppressWarnings: true, optimizeForCompilationSpeed: true,
    });
    const recipe = source.PackedRecipeFixture.abi.find((fn) => fn.name === 'run')?.computeSideCarRecipes;
    expect(recipe?.keccak).toMatchObject([{ kind: 'abiEncodePacked', fields: ['uint16', 'uint16', 'bytes2', 'bool'], args: [
      { kind: 'cast', type: 'uint16', expression: { kind: 'literal', value: '2' } },
      { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      { kind: 'literal', type: 'bool', value: true },
    ] }]);
  });

  it('proves only an exact collection-array length return', () => {
    const source = compileStringMulti(`pragma solidity ^0.8.20;
      contract Lengths {
        mapping(uint256 => bytes[]) eventsById;
        function exact(uint256 id) public view returns (uint256) {
          return eventsById[id].length;
        }
        function computed(uint256 id) public view returns (uint256) {
          return eventsById[id].length + 1;
        }
      }`, { solidityImportCompat: true, forceStateful: true, suppressWarnings: true });
    expect(source.Lengths.abi.find((fn) => fn.name === 'exact')?.directCollectionLengthReturn)
      .toEqual({ collection: 'eventsById', keyParams: ['id'] });
    expect(source.Lengths.abi.find((fn) => fn.name === 'computed')?.directCollectionLengthReturn)
      .toBeUndefined();
  });

  it('derives a signature65 candidate only for a reached recovery helper', () => {
    const sourceCode = `pragma solidity ^0.8.20;
      library ECDSA {
        function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
          require(signature.length == 65);
          bytes32 r; bytes32 s; uint8 v;
          assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
          }
          return ecrecover(hash, v, r, s);
        }
      }
      interface ISink { function ping() external; }
      contract RecoveryRecipeFixture(ISink sink) {
        uint256 marker;
        function run(bytes32 hash, bytes signature) public {
          require(ECDSA.recover(hash, signature) != address(0));
          sink.ping();
        }
      }`;
    const options = { solidityImportCompat: true, ecrecover: 'p2pkh' as const, forceStateful: true,
      messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true };
    const source = compileStringMulti(sourceCode, options);
    const handler = source.RecoveryRecipeFixture.abi.find((fn) => fn.name === 'run');
    expect(handler?.ecrecoverCompute).toBe(true);
    expect(handler?.computeSideCarRecipes?.ecrecover).toMatchObject([{
      kind: 'signature65', hash: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      signature: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
    }]);
    const swapped = compileStringMulti(sourceCode.replace(
      'ecrecover(hash, v, r, s)', 'ecrecover(hash, v, s, r)',
    ), options);
    expect(swapped.RecoveryRecipeFixture.abi.find((fn) => fn.name === 'run')?.computeSideCarRecipes)
      .toBeUndefined();
    const wrongSlice = compileStringMulti(sourceCode.replace(
      's := mload(add(signature, 0x40))', 's := mload(add(signature, 0x20))',
    ), options);
    expect(wrongSlice.RecoveryRecipeFixture.abi.find((fn) => fn.name === 'run')?.computeSideCarRecipes)
      .toBeUndefined();
  });
});
