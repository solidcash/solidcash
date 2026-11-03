import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hash160, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { validatorAddress, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { functionSplitFor } from '../../../src/framed/deploy/split-registry.js';
import { MasterPoolDeployment } from '../../../src/framed/deploy/pool.js';
import { deployMaster } from '../../../src/framed/deploy/material.js';
import { childGenesisOutputCount } from '../../../src/framed/deploy/genesis-outputs.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * The creator's allow-list at its shipped width (docs/framed/CREATE2_IDENTITY.md).
 *
 * The SushiSwap pair has 23 entries and 3 internal helpers, so the check names 26 master locks: the largest child the
 * release creates must fit, and the creator's own spend must stay under one input's production budget.
 */

const FRAMED = { composition: 'framed' as const, evmCompat: true, suppressWarnings: true, split: 'func' as const };
const ENTRY_COUNT = 26;
// The public getter `n()` is an entry of its own, so the source states one entry fewer.
const ENTRY_FUNCTIONS = ENTRY_COUNT - 1;
const CHILD_ENTRIES = Array.from({ length: ENTRY_FUNCTIONS }, (_unused, index) =>
  `function f${index}(uint256 k) external { n = n + k + ${index}; }`).join('\n  ');
const SOURCE = `pragma solidity ^0.8.0;
contract Child {
  uint256 public n;
  ${CHILD_ENTRIES}
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
  return { txid: (0x40 + coins).toString(16).padStart(64, '0'), vout: 0, satoshis };
};
const shardsOf = (primaryContractName: string): FunctionSplitBundle =>
  compileStringSplit(SOURCE, { ...FRAMED, primaryContractName }) as FunctionSplitBundle;

describe('a child as wide as the allow-list', () => {
  it('is created atomically, and the creator fits one input', async () => {
    const creator = shardsOf('Creator');
    const child = shardsOf('Child');
    expect(child.shards.length).toBe(ENTRY_COUNT);
    const pool = { masters: 1, validators: 1 };
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = nextCoin(1_500_000n);
    await provider.addUtxo(binToHex(callerLock), funding);
    const childLocks = (() => {
      return MasterPoolDeployment.createFunctionSplit({
        bundle: child, category: new Uint8Array(32).fill(7), validatorProgram: VALIDATOR, size: pool,
      }).getEntryLocks();
    })();
    expect(childLocks.length).toBe(ENTRY_COUNT);
    const { categoryId } = await deployStatefulContract(creator.logical, [], {
      provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: creator, childLocks,
      childOutputCount: childGenesisOutputCount({
        artifact: child.logical, category: new Uint8Array(32).fill(9), validatorProgram: VALIDATOR,
        provider, split: child, pool, ownerLock: callerLock,
      }),
    });
    const caller = nextCoin(9_000_000n);
    await provider.addUtxo(binToHex(callerLock), caller);
    const split = functionSplitFor(provider, categoryId) ?? creator;
    const result = await callFramedEntry({
      provider, artifact: creator.logical, categoryId, functionName: 'make', args: [new Uint8Array(32)],
      callerUtxo: caller, callerLockingBytecode: callerLock, funder, split,
      vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
      creates: { artifact: child.logical, split: child, pool },
    });
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    expect(result.accepted, refused).toBe(true);

    const category = Uint8Array.from(Buffer.from(caller.txid, 'hex'));
    expect(binToHex(result.values[0] as Uint8Array)).toBe(binToHex(hash160(validatorAddress(category, VALIDATOR))));
    const ofCategory = result.transaction.outputs.filter((output) => output.token !== undefined
      && binToHex(output.token.category) === binToHex(category));
    for (const shard of child.shards) {
      const lock = deployMaster(shard.artifact, category, VALIDATOR).lockingBytecode;
      expect(ofCategory.some((output) => binToHex(output.lockingBytecode) === binToHex(lock)
        && output.token!.nft?.capability === 'minting'), `master of ${shard.function}`).toBe(true);
    }

    // The creator is one input of this transaction; production caps an input's unlocking bytecode at 10,000 bytes.
    const lengths = result.transaction.inputs.map((input) => input.unlockingBytecode.length);
    expect(Math.max(...lengths)).toBeLessThan(10_000);
  }, 600_000);
});
