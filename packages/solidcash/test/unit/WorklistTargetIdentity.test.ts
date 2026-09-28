import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { ownerParticipantArtifact } from '../../src/message-bus/compose-participant-helpers.js';
import { deriveCompiledGraphPlan } from '../../src/message-bus/worklist.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../src/utils.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  solidityImportCompat: true, suppressWarnings: true, maximumInputBytes: 1_000_000,
} as const;
const leaf = ownerParticipantArtifact(compileString(`pragma solidity ^0.8.0;
  contract Leaf { function read() public pure returns (uint256) { return 1; } }
`, KERNEL), 1);
const root = compileString(`pragma solidity ^0.8.0;
  interface LeafApi { function read() external view returns (uint256); }
  contract Root(address leaf) {
    function check() public view returns (uint256) { return LeafApi(leaf).read(); }
  }
`, KERNEL);
const physical = `aa20${'22'.repeat(32)}87`;
const logical = `aa20${'33'.repeat(32)}87`;
const identityOffset = leaf.messageBus!.route.blockLayout!.blockSize - 1;
const payload = (lock: string): string => binToHex(lockingBytecodeToSolidityAddressPayload(hexToBin(lock))!);

function derive(
  targetLockingBytecode: string,
  solidityImportCompat = true,
  locks = { physical, logical },
): ReturnType<typeof deriveCompiledGraphPlan> {
  return deriveCompiledGraphPlan({
    root: {
      artifact: { ...root, compiler: { ...root.compiler, options: { solidityImportCompat } } },
      lockingBytecode: `aa20${'11'.repeat(32)}87`,
      constructorArgs: [hexToBin(logical)],
    },
    function: 'check', targets: {},
    target: () => ({
      participant: {
        artifact: leaf, lockingBytecode: locks.physical,
        logicalLockingBytecode: locks.logical, logicalIdentityOffset: identityOffset,
      },
      targetLockingBytecode,
    }),
  });
}

describe('worklist Solidity target identity projection', () => {
  it('binds forwarded canonical address words to the registered owner identity', () => {
    const forwarding = compileString(`pragma solidity ^0.8.0;
      interface LeafApi { function read() external view returns (uint256); }
      contract ForwardingRoot {
        function check(address destination) public view returns (uint256) {
          return LeafApi(destination).read();
        }
      }
    `, KERNEL);
    const plan = (
      argument: string, locks = { physical, logical }, solidityImportCompat = true,
    ): ReturnType<typeof deriveCompiledGraphPlan> => deriveCompiledGraphPlan({
      root: { artifact: { ...forwarding, compiler: { ...forwarding.compiler, options: { solidityImportCompat } } },
        lockingBytecode: `aa20${'11'.repeat(32)}87` },
      function: 'check', args: [hexToBin(argument)], targets: {},
      target: () => ({ participant: {
        artifact: leaf, lockingBytecode: locks.physical, logicalLockingBytecode: locks.logical,
        logicalIdentityOffset: identityOffset,
      } }),
    });
    expect(plan(payload(logical)).invocations[1].targetLockingBytecode).toBe(logical);
    expect(plan('00'.repeat(12) + payload(logical)).invocations[1]).toMatchObject({
      targetLockingBytecode: logical, targetIdentityOffset: identityOffset,
    });
    expect(() => plan('01'.repeat(12) + payload(logical))).toThrow(/target proof disagrees/);
    expect(() => plan('00'.repeat(12) + 'ff'.repeat(20))).toThrow(/target proof disagrees/);
    expect(() => plan('00'.repeat(12) + payload(logical), { physical, logical }, false))
      .toThrow(/target proof disagrees/);
    const sharedPayload = '44'.repeat(20);
    const ambiguous = { physical: `a914${sharedPayload}87`, logical: `76a914${sharedPayload}88ac` };
    expect(() => plan('00'.repeat(12) + sharedPayload, ambiguous)).toThrow(/target proof disagrees/);
    expect(plan(ambiguous.logical, ambiguous).invocations[1].targetLockingBytecode).toBe(ambiguous.logical);
  });

  it('attributes a missing resource-derived target proof without accepting a registry fallback', () => {
    const resourceRoot = compileString(`pragma solidity ^0.8.0;
      interface LeafApi { function read() external view returns (uint256); }
      contract ResourceRoot {
        address leaf;
        function check() public view returns (uint256) { return LeafApi(this.leaf).read(); }
      }
    `, KERNEL);
    const deriveMissing = (): ReturnType<typeof deriveCompiledGraphPlan> => deriveCompiledGraphPlan({
      root: { artifact: resourceRoot, lockingBytecode: `aa20${'11'.repeat(32)}87` },
      function: 'check', targets: { LeafApi: { artifact: leaf, lockingBytecode: physical } },
    });
    expect(deriveMissing).toThrow(/resource-derived callsite 0 occurrence 0 lacks a target proof/);
    expect(deriveMissing).toThrow(/0:ResourceRoot.check -> LeafApi.read/);
  });

  it.each([
    ['physical', physical, 0, ''], ['logical', logical, identityOffset, ''],
    ['physical word', physical, 0, '00'.repeat(12)], ['logical word', logical, identityOffset, '00'.repeat(12)],
  ] as const)('binds a projected %s target to its exact authenticated locking script', (_name, lock, offset, pad) => {
    const planned = derive(pad + payload(lock));
    expect(planned.invocations[1]).toMatchObject({ targetLockingBytecode: lock, targetIdentityOffset: offset });
  });

  it('preserves an exact native target without projecting it', () => {
    expect(derive(logical).invocations[1]).toMatchObject({
      targetLockingBytecode: logical, targetIdentityOffset: identityOffset,
    });
  });

  it('refuses foreign payloads and does not reinterpret native SolidCash addresses', () => {
    expect(() => derive('ff'.repeat(20))).toThrow(/not an authenticated identity/);
    expect(() => derive(payload(logical), false)).toThrow(/not an authenticated identity/);
    expect(() => derive('01'.repeat(12) + payload(logical))).toThrow(/not an authenticated identity/);
  });

  it('refuses an ambiguous projection without changing exact identity selection', () => {
    const hash = '44'.repeat(20);
    const locks = { physical: `a914${hash}87`, logical: `76a914${hash}88ac` };
    expect(() => derive(hash, true, locks)).toThrow(/not an authenticated identity/);
    expect(derive(locks.logical, true, locks).invocations[1]).toMatchObject({
      targetLockingBytecode: locks.logical, targetIdentityOffset: identityOffset,
    });
  });
});
