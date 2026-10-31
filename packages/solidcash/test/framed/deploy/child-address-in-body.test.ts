import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hash160, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
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
import { sha256 } from '@solidcash/utils';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A created child's address, as the creating body computes it.
 *
 * In a framed master, `create2` is the child's real address, `addrV(K)`, where `K` is the outpoint of the
 * genesis-eligible coin the creating transaction carries: no caller can hash it, so the body derives it from the
 * transaction itself (docs/framed/CREATE2_IDENTITY.md). The body reads its own witness block for the validator input
 * its frame co-spends and for the transaction's origin input — the root user's own coin — then reads the validator
 * program from that input and hashes `push(pin(K)) ++ program`, the P2SH32 address the child's validator settles at.
 *
 * The test drives the compiled creating master through the shipped call path, with the coin the test itself funded:
 * the derivation states that coin's real outpoint, so the address the entry returns must be `addrV` of it, and it must
 * move when the coin does. A value baked in at compile time, or read from the derivation's stand-in outpoint, would
 * satisfy neither.
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
/** A coin no earlier transaction spent, so a deployment and its call carry outpoints of their own. */
function nextCoin(satoshis: bigint): Utxo {
  coins += 1;
  return { txid: (0x10 + coins).toString(16).padStart(64, '0'), vout: 0, satoshis };
}

function shardsOf(primaryContractName: string): FunctionSplitBundle {
  return compileStringSplit(SOURCE, { ...FRAMED, primaryContractName }) as FunctionSplitBundle;
}

describe('the address a creating body computes', () => {
  const creator = shardsOf('Creator');

  it('is addrV of the caller coin the transaction carries, and it moves with the coin', async () => {
    /** A creator deployed on its own chain, and the genesis-eligible coin its `make` call will carry. */
    const deployCreator = async () => {
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const funding = nextCoin(900_000n);
      await provider.addUtxo(binToHex(callerLock), funding);
      const { categoryId } = await deployStatefulContract(creator.logical, [], {
        provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
        threadCount: 1, validatorCount: 1, functionSplit: creator,
        childOutputCount: 0,
      });
      const caller = nextCoin(300_000n);
      await provider.addUtxo(binToHex(callerLock), caller);
      return { provider, categoryId, caller };
    };

    /** Calls `make`, and answers the address it returned and the coin it carried. */
    const make = async (deployment: { provider: MockNetworkProvider; categoryId: string; caller: Utxo }) => {
      const result = await callFramedEntry({
        provider: deployment.provider, artifact: creator.logical, categoryId: deployment.categoryId,
        functionName: 'make', args: [new Uint8Array(32)],
        callerUtxo: deployment.caller, callerLockingBytecode: callerLock, funder,
        // The deployment patched the shard for the folded-output count, so the call runs the registered split.
        split: functionSplitFor(deployment.provider, deployment.categoryId) ?? creator,
        vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
        // The test derives the address the body computes; it mints no child. Its creator states a zero-output
        // category, so the folded-state digest is over nothing and the check still wants the OP_RETURN it commits to.
        creates: null,
        extraOutputs: [{ to: Uint8Array.from([0x6a, 0x20, ...sha256(new Uint8Array())]), amount: 0n }],
      });
      const refused = result.verdicts.filter((verdict) => !verdict.accepted)
        .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
      expect(result.accepted, refused).toBe(true);
      const value = result.values[0];
      expect(value).toBeInstanceOf(Uint8Array);
      expect((value as Uint8Array).length).toBe(20);
      return { computed: value as Uint8Array, caller: deployment.caller };
    };

    /** A Solidity `address` return is the 20-byte identity of the lock it names (DECISIONS D13). */
    const identityOf = (txid: string) => hash160(validatorAddress(hexToBin(txid), VALIDATOR));

    const first = await make(await deployCreator());
    expect(binToHex(first.computed)).toBe(binToHex(identityOf(first.caller.txid)));

    // Another deployment's coin is another outpoint, so the body's value must be another address's identity.
    const second = await make(await deployCreator());
    expect(binToHex(second.computed)).toBe(binToHex(identityOf(second.caller.txid)));
    expect(binToHex(second.computed)).not.toBe(binToHex(first.computed));

    // One byte of the coin's txid changed: the body's value names no address that category derives.
    const other = hexToBin(first.caller.txid);
    other[0] = other[0]! ^ 0xff;
    expect(binToHex(first.computed)).not.toBe(binToHex(hash160(validatorAddress(other, VALIDATOR))));
  }, 240_000);
});
