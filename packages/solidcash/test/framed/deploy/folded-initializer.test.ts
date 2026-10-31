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
import { bindProviderBlockOracle } from '../../../src/framed/call/block-oracle.js';
import { functionSplitFor } from '../../../src/framed/deploy/split-registry.js';
import { MasterPoolDeployment } from '../../../src/framed/deploy/pool.js';
import { stateRecordLockingBytecode } from '../../../src/framed/deploy/records.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

const FRAMED = { composition: 'framed' as const, evmCompat: true, suppressWarnings: true, split: 'func' as const };
const SOURCE = `pragma solidity ^0.8.0;
interface IChild { function initialize(address a, address b) external; }
contract Child {
  address public tokenA;
  address public tokenB;
  function initialize(address a, address b) external { tokenA = a; tokenB = b; }
}
contract Creator {
  uint256 public created;
  function make(address a, address b) external returns (address child) {
    bytes memory code = type(Child).creationCode;
    assembly { child := create2(0, add(code, 32), mload(code), a) }
    IChild(child).initialize(a, b);
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
  return { txid: (0x60 + coins).toString(16).padStart(64, '0'), vout: 0, satoshis };
};
const shardsOf = (primaryContractName: string): FunctionSplitBundle =>
  compileStringSplit(SOURCE, { ...FRAMED, primaryContractName }) as FunctionSplitBundle;

describe('a creator that initializes the child it makes', () => {
  it('folds the initializer into the genesis', async () => {
    const creator = shardsOf('Creator');
    const child = shardsOf('Child');
    const pool = { masters: 1, validators: 1 };
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = nextCoin(1_500_000n);
    await provider.addUtxo(binToHex(callerLock), funding);
    const childLocks = (() => {
      bindProviderBlockOracle(provider, child.logical);
      for (const shard of [...child.shards, ...child.internalCuts]) bindProviderBlockOracle(provider, shard.artifact);
      return MasterPoolDeployment.createFunctionSplit({
        bundle: child, category: new Uint8Array(32).fill(7), validatorProgram: VALIDATOR, size: pool,
      }).getEntryLocks();
    })();
    const { categoryId } = await deployStatefulContract(creator.logical, [], {
      provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: creator, childLocks,
    });
    const caller = nextCoin(9_000_000n);
    await provider.addUtxo(binToHex(callerLock), caller);
    const split = functionSplitFor(provider, categoryId) ?? creator;
    const a = new Uint8Array(20).fill(0x11);
    const b = new Uint8Array(20).fill(0x22);
    const result = await callFramedEntry({
      provider, artifact: creator.logical, categoryId, functionName: 'make', args: [a, b],
      callerUtxo: caller, callerLockingBytecode: callerLock, funder, split,
      vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
      creates: { artifact: child.logical, split: child, pool, initializer: { functionName: 'initialize', args: [a, b] } },
    });
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    expect(result.accepted, refused).toBe(true);
    const category = Uint8Array.from(Buffer.from(caller.txid, 'hex'));
    const ofCategory = result.transaction.outputs.filter((output) => output.token !== undefined
      && binToHex(output.token.category) === binToHex(category));
    const records = ofCategory.filter((output) => binToHex(output.lockingBytecode)
      === binToHex(stateRecordLockingBytecode(binToHex(category))));
    expect(binToHex(result.values[0] as Uint8Array)).toBe(binToHex(hash160(validatorAddress(category, VALIDATOR))));
    // The initialized values are in the child's genesis records: an `address` value in a framed contract is its
    // locking bytecode, so a 20-byte payload argument becomes its P2PKH lock.
    const lock = (payload: Uint8Array): string => `76a914${binToHex(payload)}88ac`;
    const commitments = records.map((record) => {
      const commitment = record.token?.nft?.commitment;
      return typeof commitment === 'string' ? commitment : binToHex((commitment ?? new Uint8Array()) as Uint8Array);
    });
    const record = commitments.join('');
    expect(record).toContain(lock(a));
    expect(record).toContain(lock(b));
  }, 240_000);
});
