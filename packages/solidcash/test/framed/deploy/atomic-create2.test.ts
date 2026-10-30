import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hash160, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { bytesEqual, validatorAddress, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { stateRecordLockingBytecode } from '../../../src/framed/deploy/records.js';
import { deployMaster } from '../../../src/framed/deploy/material.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A child created with `create2` in one planned transaction (docs/framed/CREATE2_IDENTITY.md).
 *
 * The creating entry's call composes the child's genesis into the same transaction: the caller's genesis-eligible
 * coin is its category `K`, so `create2` returns `addrV(K)`, and the transaction mints the child's masters at their
 * shard locks, its validator at `addrV(K)` and its records — the outputs a deployment would mint, as trailing
 * outputs of the creator's transaction.
 *
 * The assertions are read off the transaction the composer derived and the machine accepted: the address the entry
 * returned, and each output the child's genesis must carry, at a lock computed from the child's own artifact rather
 * than from the composer's list.
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
const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
const callerAddress = (() => {
  const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  return encoded.address;
})();

let coins = 0;
const nextCoin = (satoshis: bigint): Utxo => {
  coins += 1;
  return { txid: (0x20 + coins).toString(16).padStart(64, '0'), vout: 0, satoshis };
};

function shardsOf(primaryContractName: string): FunctionSplitBundle {
  return compileStringSplit(SOURCE, { ...FRAMED, primaryContractName }) as FunctionSplitBundle;
}

describe('a child created with create2 in one transaction', () => {
  const creator = shardsOf('Creator');
  const child = shardsOf('Child');

  /** A creator deployed on its own chain, and the genesis-eligible coin its `make` call will carry. */
  const deployCreator = async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = nextCoin(1_500_000n);
    await provider.addUtxo(binToHex(callerLock), funding);
    const { categoryId } = await deployStatefulContract(creator.logical, [], {
      provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: creator,
    });
    const caller = nextCoin(900_000n);
    await provider.addUtxo(binToHex(callerLock), caller);
    return { provider, categoryId, caller };
  };

  it('lives at the address create2 returned and carries its masters, validator and records', async () => {
    const { provider, categoryId, caller } = await deployCreator();
    const pool = { masters: 2, validators: 1 };
    const result = await callFramedEntry({
      provider, artifact: creator.logical, categoryId, functionName: 'make', args: [new Uint8Array(32)],
      callerUtxo: caller, callerLockingBytecode: callerLock, funder, split: creator,
      vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
      creates: { artifact: child.logical, split: child, pool },
    });
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    expect(result.accepted, refused).toBe(true);

    // (a) The child lives at the address `create2` returned: `addrV(K)` of the caller's coin.
    const category = hexToBin(caller.txid);
    const address = validatorAddress(category, VALIDATOR);
    const value = result.values[0];
    expect(value).toBeInstanceOf(Uint8Array);
    expect(binToHex(value as Uint8Array)).toBe(binToHex(hash160(address)));

    // (b) The genesis carries the child's masters at their shard locks, its validator at `addrV(K)`, and its
    // records — each an output of this same transaction carrying category K.
    // A token category is reported in display order, as the caller coin's txid is.
    const ofCategory = result.transaction.outputs.filter((output) => output.token !== undefined
      && bytesEqual(output.token.category, category));
    expect(ofCategory.length).toBeGreaterThan(0);
    for (const shard of child.shards) {
      const lock = deployMaster(shard.artifact, category, VALIDATOR).lockingBytecode;
      const master = ofCategory.find((output) => bytesEqual(output.lockingBytecode, lock)
        && output.token!.nft?.capability === 'minting');
      expect(master, `master of ${shard.function}`).toBeDefined();
    }
    const validator = ofCategory.find((output) => bytesEqual(output.lockingBytecode, address)
      && output.token!.nft?.capability === 'mutable');
    expect(validator, 'validator at addrV(K)').toBeDefined();
    const record = ofCategory.find((output) =>
      bytesEqual(output.lockingBytecode, stateRecordLockingBytecode(binToHex(category)))
      && output.token!.nft?.capability === 'mutable');
    expect(record, 'state record').toBeDefined();
    expect((record!.token!.nft?.commitment ?? '').length).toBeGreaterThan(0);
  }, 240_000);

  it('refuses a transaction that adds an output of the child\'s category', async () => {
    const { provider, categoryId, caller } = await deployCreator();
    const result = await callFramedEntry({
      provider, artifact: creator.logical, categoryId, functionName: 'make', args: [new Uint8Array(32)],
      callerUtxo: caller, callerLockingBytecode: callerLock, funder, split: creator,
      vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
      creates: { artifact: child.logical, split: child, pool: { masters: 2, validators: 1 } },
      // An output no child genesis mints: a fungible amount of the new category at the caller's own key. Minting it
      // alongside the genesis would create unbacked liquidity.
      extraOutputs: [{ to: callerLock, amount: 1_000n, token: { category: caller.txid, amount: 1n } }],
    });
    expect(result.accepted).toBe(false);
    const objection = result.verdicts.find((verdict) => !verdict.accepted)?.objection ?? '';
    expect(objection).toMatch(/VERIFY|verify/);
  }, 240_000);
});
