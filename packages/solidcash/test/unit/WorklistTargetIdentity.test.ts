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
