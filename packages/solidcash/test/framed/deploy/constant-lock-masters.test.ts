import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { bytesEqual, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster, readFramedState, verifyMasterDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A contract another contract creates is compiled with constant master locks.
 *
 * Its masters reserve no deployment slot: each reads its category from its own token and leaves `address(this)` to the
 * validator, so every master of a shard has one lock whatever category it is deployed as, which is what lets the
 * creator check its child's genesis against the lock it embeds (docs/framed/CREATE2_IDENTITY.md). A contract nobody
 * creates keeps its slots.
 */

const FRAMED = {
  composition: 'framed' as const, evmCompat: true, suppressWarnings: true, split: 'func' as const,
};

const SOURCE = `pragma solidity ^0.8.0;
contract Child {
  uint256 public n;
  function bump(uint256 k) external { n = n + k; }
}
contract Creator {
  uint256 public created;
  function make(bytes32 salt) external returns (address child) {
    bytes memory code = type(Child).creationCode;
    assembly { child := create2(0, add(code, 32), mload(code), salt) }
    created = created + 1;
  }
}`;

const VALIDATOR = framedValidator.buildValidatorProgram();

function shardsOf(primaryContractName: string): FunctionSplitBundle {
  return compileStringSplit(SOURCE, { ...FRAMED, primaryContractName }) as FunctionSplitBundle;
}

describe('the masters of a contract another contract creates', () => {
  const child = shardsOf('Child');

  it('reserve no deployment slot', () => {
    expect(child.shards.length).toBeGreaterThan(0);
    for (const shard of child.shards) {
      expect(shard.artifact.composition?.placeholders).toStrictEqual({ version: 1, constantLock: true });
    }
  });

  it('have one lock whatever category they are deployed as, and each verifies as deployed', () => {
    const first = seededCategory('constant lock first');
    const second = seededCategory('constant lock second');
    for (const shard of child.shards) {
      const atFirst = deployMaster(shard.artifact, first, VALIDATOR);
      const atSecond = deployMaster(shard.artifact, second, VALIDATOR);
      expect(bytesEqual(atFirst.lockingBytecode, atSecond.lockingBytecode)).toBe(true);
      // The address is still the category's own: only the master's program is the same.
      expect(bytesEqual(atFirst.address, atSecond.address)).toBe(false);
      verifyMasterDeployment(atFirst, shard.artifact, first, VALIDATOR);
      verifyMasterDeployment(atSecond, shard.artifact, second, VALIDATOR);
    }
  });
});

describe('a constant-lock master at run time', () => {
  let coins = 0;
  const freshCoin = (satoshis: bigint): Utxo => {
    coins += 1;
    return { txid: coins.toString(16).padStart(64, 'c'), vout: 0, satoshis };
  };

  it('reads its category from its own token and settles a call covered by its validator', async () => {
    const split = shardsOf('Child');
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const funding = freshCoin(800_000n);
    await provider.addUtxo(binToHex(callerLock), funding);
    const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
    if (typeof encoded === 'string') throw new Error(encoded);
    const { categoryId } = await deployStatefulContract(split.logical, [], {
      provider, fundingUtxo: funding, funder, changeAddress: encoded.address,
      threadCount: 1, validatorCount: 1, functionSplit: split,
    });
    const callerUtxo = freshCoin(300_000n);
    await provider.addUtxo(binToHex(callerLock), callerUtxo);
    const result = await callFramedEntry({
      provider, artifact: split.logical, categoryId, functionName: 'bump', args: [5n],
      callerUtxo, callerLockingBytecode: callerLock, funder, split, vm: compositionMachine(), validatorProgram: VALIDATOR,
    });
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    expect(result.accepted, refused).toBe(true);
    expect((await readFramedState(provider, categoryId, split.logical.stateLayout!)).byNft[0]!.n).toBe(5n);
  });
});

describe('the masters of a contract nobody creates', () => {
  it('keep their category and address slots', () => {
    const creator = shardsOf('Creator');
    for (const shard of creator.shards) {
      const placeholders = shard.artifact.composition?.placeholders;
      expect(placeholders?.constantLock).toBeUndefined();
      expect(typeof (placeholders as { categoryOffset?: number } | undefined)?.categoryOffset).toBe('number');
    }
  });
});
