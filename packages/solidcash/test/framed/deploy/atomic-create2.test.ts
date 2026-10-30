import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hash160, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { bytesEqual, validatorAddress, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Output, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { stateRecordLockingBytecode } from '../../../src/framed/deploy/records.js';
import { deployMaster } from '../../../src/framed/deploy/material.js';
import { MasterPoolDeployment } from '../../../src/framed/deploy/pool.js';
import { bindProviderBlockOracle } from '../../../src/framed/call/block-oracle.js';
import { functionSplitFor } from '../../../src/framed/deploy/split-registry.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A child created with `create2` in one planned transaction (docs/framed/CREATE2_IDENTITY.md).
 *
 * The creating entry's call composes the child's genesis into the same transaction: the caller's genesis-eligible
 * coin is its category `K`, so `create2` returns `addrV(K)`, and the transaction mints the child's masters at their
 * shard locks, its validator at `addrV(K)` and its records. The creator's own code checks what the transaction mints
 * for that category: an output of `K` must be one of those locks, carry an NFT and mint no fungible amount.
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
  const pool = { masters: 2, validators: 1 };
  /** A P2SH32 lock no part of the child sits at. */
  const foreignLock = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x11), 0x87]);

  /** The entry locks the child's masters deploy at, for a category of no consequence (constant shard locks). */
  const childLocksOf = (provider: MockNetworkProvider): readonly Uint8Array[] => {
    // The locks depend on the provider's block oracle, exactly as the deployment's and the composer's do.
    bindProviderBlockOracle(provider, child.logical);
    for (const shard of [...child.shards, ...child.internalCuts]) bindProviderBlockOracle(provider, shard.artifact);
    return MasterPoolDeployment.createFunctionSplit({
      bundle: child, category: new Uint8Array(32).fill(7), validatorProgram: VALIDATOR, size: pool,
    }).getEntryLocks();
  };

  /** Plans `make` on a creator whose sentinels the deployment filled, with any outputs after the genesis. */
  const plan = async (extra?: (caller: Utxo) => readonly Output[]) => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = nextCoin(1_500_000n);
    await provider.addUtxo(binToHex(callerLock), funding);
    const { categoryId } = await deployStatefulContract(creator.logical, [], {
      provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: creator,
      childLocks: childLocksOf(provider),
    });
    const caller = nextCoin(900_000n);
    await provider.addUtxo(binToHex(callerLock), caller);
    // The deployment filled the sentinels and registered the bundle it deployed; a call runs that one.
    const split = functionSplitFor(provider, categoryId) ?? creator;
    const result = await callFramedEntry({
      provider, artifact: creator.logical, categoryId, functionName: 'make', args: [new Uint8Array(32)],
      callerUtxo: caller, callerLockingBytecode: callerLock, funder, split,
      vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
      creates: { artifact: child.logical, split: child, pool },
      ...(extra === undefined ? {} : { extraOutputs: extra(caller) }),
    });
    return { provider, caller, result };
  };

  it('lives at the address create2 returned and carries its masters, validator and records', async () => {
    const { provider, caller, result } = await plan();
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
    expect(childLocksOf(provider).length).toBeGreaterThan(0);
  }, 240_000);

  it('refuses a transaction that adds a fungible amount of the child\'s category', async () => {
    const { result } = await plan((caller) => [{
      // An output no child genesis mints: unbacked liquidity of the new category at the caller's own key.
      to: callerLock, amount: 1_000n, token: { category: caller.txid, amount: 1n },
    }]);
    expect(result.accepted).toBe(false);
    const objection = result.verdicts.find((verdict) => !verdict.accepted)?.objection ?? '';
    expect(objection).toMatch(/VERIFY|verify/);
  }, 240_000);

  it('refuses a category output at a lock that is not one of the child\'s', async () => {
    const { result } = await plan((caller) => [{
      // A minting NFT of the new category at a P2SH32 lock no master of the child sits at: without the deployment's
      // allow-list it would pass every shape rule and could mint the child's token later.
      to: foreignLock, amount: 1_000n,
      token: { category: caller.txid, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    }]);
    expect(result.accepted).toBe(false);
    const objection = result.verdicts.find((verdict) => !verdict.accepted)?.objection ?? '';
    expect(objection).toMatch(/VERIFY|verify/);
  }, 240_000);
});
