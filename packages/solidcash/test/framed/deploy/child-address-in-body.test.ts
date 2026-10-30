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
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A created child's address, as the creating body computes it.
 *
 * In a framed master, `create2` is the child's real address, `addrV(K)`, where `K` is the outpoint of the
 * genesis-eligible coin the creating transaction leads with: no caller can hash it, so the body derives it from the
 * transaction itself (docs/framed/CREATE2_IDENTITY.md). The body reads its own witness block for the validator input
 * its frame co-spends, then reads that input's program and hashes `push(pin(K)) ++ program`, which is the P2SH32
 * address the child's validator settles at.
 *
 * The test drives the compiled creating master through the shipped call path: the value the entry returns is what the
 * fragment left, and it must be `addrV` of the transaction's own leading outpoint. The negative is the same outpoint
 * with one byte changed: a fragment that ignored `K`, or baked an address in, would not tell the two apart.
 *
 * The derivation runs on the composer's stand-in outpoints (`01…01`, `02…02`, …), so this pins the script's own
 * reading of the transaction. Composing a real creating transaction — the child's genesis minted in the same one —
 * replaces the stand-in with the caller's coin and is the next step (docs/framed/CREATE2_IDENTITY.md).
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
/** A coin no earlier transaction spent, so a deployment and its call lead with outpoints of their own. */
function nextCoin(satoshis: bigint): Utxo {
  coins += 1;
  return { txid: (0x10 + coins).toString(16).padStart(64, '0'), vout: 0, satoshis };
}

function shardsOf(primaryContractName: string): FunctionSplitBundle {
  return compileStringSplit(SOURCE, { ...FRAMED, primaryContractName }) as FunctionSplitBundle;
}

describe('the address a creating body computes', () => {
  const creator = shardsOf('Creator');

  it('is the child address the compiled creator returns for its leading outpoint, and no other', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = nextCoin(900_000n);
    await provider.addUtxo(binToHex(callerLock), funding);
    const { categoryId } = await deployStatefulContract(creator.logical, [], {
      provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: creator,
    });

    const callerUtxo = nextCoin(300_000n);
    await provider.addUtxo(binToHex(callerLock), callerUtxo);
    const result = await callFramedEntry({
      provider, artifact: creator.logical, categoryId, functionName: 'make', args: [new Uint8Array(32)],
      callerUtxo, callerLockingBytecode: callerLock, funder, split: creator,
      vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
    });
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    expect(result.accepted, refused).toBe(true);

    const value = result.values[0];
    expect(value).toBeInstanceOf(Uint8Array);
    const computed = value as Uint8Array;
    expect(computed.length).toBe(20);

    // OP_OUTPOINTTXHASH answers in hash order; a category is that reversed (`childAddressScript`).
    const leading = result.transaction.inputs[0]!.outpointTransactionHash;
    const category = Uint8Array.from(leading).reverse();
    // A Solidity `address` return is the 20-byte identity of the lock it names (DECISIONS D13).
    expect(binToHex(computed)).toBe(binToHex(hash160(validatorAddress(category, VALIDATOR))));

    // The same transaction with the leading outpoint's first byte changed: the body's value must follow the
    // transaction, so it names no address the changed category derives.
    const other = Uint8Array.from(category);
    other[0] = other[0]! ^ 0xff;
    expect(binToHex(computed)).not.toBe(binToHex(hash160(validatorAddress(other, VALIDATOR))));
  }, 240_000);
});
