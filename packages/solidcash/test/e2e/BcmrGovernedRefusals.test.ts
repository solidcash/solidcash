/**
 * The governed guard alone (docs/bcmr/DESIGN.md, section 9). Evaluated by itself, it accepts a spend that meets its
 * three conditions, in either notation, and refuses a spend that breaks any one of them: it does not lean on the
 * event covenant's own category check.
 */
import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, flattenBinArray, hexToBin,
  utf8ToBin,
} from '@bitauth/libauth';
import { encodeEventParameter, type EventDefinitionAbi } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  framedEventLockingBytecode, governedAuthorization, governedGuardLockingBytecode, governedGuardUnlocker,
  publicationBytecode, type GovernedGuard,
} from '../../src/bcmr/index.js';

// Not palindromes, so each byte order the guard reads is exercised.
const CATEGORY = binToHex(Uint8Array.from({ length: 32 }, (_, index) => 0xc0 + index));
const IDENTITY_TXID = binToHex(Uint8Array.from({ length: 32 }, (_, index) => 0x80 + index));
const HASH = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const URIS = ['https://example.com/bcmr.json'];
const EVENT: EventDefinitionAbi = {
  name: 'MetadataUpdated',
  signature: 'MetadataUpdated(bytes32,bytes32)',
  parameters: [{ name: 'registryHash', type: 'bytes32' }, { name: 'identityTxid', type: 'bytes32' }],
};
const NATIVE: GovernedGuard = {
  category: CATEGORY, eventLockingBytecode: framedEventLockingBytecode(CATEGORY, EVENT), notation: 'native',
};
const EVM: GovernedGuard = { ...NATIVE, notation: 'evm' };

/** A spend of the guard at input 0, naming input 1: the authorization's NFT and lock, and the guard's outpoint. */
interface Spend {
  readonly category: string;
  readonly capability: 'none' | 'mutable';
  readonly lockingBytecode: Uint8Array;
  readonly commitment: Uint8Array;
  readonly outpointTxid: string;
  readonly outpointIndex: number;
  readonly outputs: readonly Uint8Array[];
}

/** The spend meeting every condition: an event naming the hash output 1 publishes and the guard's own outpoint. */
function validSpend(guard: GovernedGuard): Spend {
  const { registryHash, identityTxid } = governedAuthorization(HASH, IDENTITY_TXID);
  const values = [registryHash, identityTxid];
  return {
    category: CATEGORY,
    capability: 'none',
    lockingBytecode: guard.eventLockingBytecode,
    commitment: flattenBinArray(EVENT.parameters.map((parameter, index) => encodeEventParameter(
      values[index]!, guard.notation === 'evm' ? { ...parameter, notation: 'evm' } : parameter,
    ))),
    outpointTxid: IDENTITY_TXID,
    outpointIndex: 0,
    outputs: [governedGuardLockingBytecode(guard), publicationBytecode(HASH, URIS)],
  };
}

/** The guard's verdict on input 0 of `spend`, evaluated alone: true, or why it refused. */
function verdict(guard: GovernedGuard, spend: Spend): string | true {
  const sourceOutputs = [
    { lockingBytecode: governedGuardLockingBytecode(guard), valueSatoshis: 1000n },
    {
      lockingBytecode: spend.lockingBytecode,
      valueSatoshis: 1000n,
      token: {
        amount: 0n,
        category: hexToBin(spend.category),
        nft: { capability: spend.capability, commitment: spend.commitment },
      },
    },
  ];
  const draft = {
    version: 2,
    locktime: 0,
    inputs: [
      {
        outpointTransactionHash: hexToBin(spend.outpointTxid), outpointIndex: spend.outpointIndex,
        sequenceNumber: 0, unlockingBytecode: new Uint8Array(),
      },
      {
        outpointTransactionHash: hexToBin('e1'.repeat(32)), outpointIndex: 1,
        sequenceNumber: 144, unlockingBytecode: new Uint8Array(),
      },
    ],
    outputs: spend.outputs.map((lockingBytecode) => ({ lockingBytecode, valueSatoshis: 1000n })),
  };
  const unlockingBytecode = governedGuardUnlocker(guard, 1)
    .generateUnlockingBytecode({ transaction: draft, sourceOutputs, inputIndex: 0 });
  const transaction = { ...draft, inputs: [{ ...draft.inputs[0]!, unlockingBytecode }, draft.inputs[1]!] };
  const vm = createVirtualMachineBch2026(true);
  return vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction }));
}

describe('the governed guard alone', () => {
  it('accepts a spend that meets each condition, in the notation the artifact states', () => {
    expect(verdict(NATIVE, validSpend(NATIVE))).toBe(true);
    expect(verdict(EVM, validSpend(EVM))).toBe(true);
    // Each guard reads its own notation only.
    expect(verdict(NATIVE, { ...validSpend(NATIVE), commitment: validSpend(EVM).commitment })).not.toBe(true);
    expect(verdict(EVM, { ...validSpend(EVM), commitment: validSpend(NATIVE).commitment })).not.toBe(true);
  });

  it('refuses an authorization that is not an immutable NFT of the category at the event\'s lock', () => {
    const spend = validSpend(NATIVE);
    expect(verdict(NATIVE, { ...spend, category: 'd5'.repeat(32) })).not.toBe(true);
    expect(verdict(NATIVE, { ...spend, capability: 'mutable' })).not.toBe(true);
    // An event of the same shape at its own lock, such as one the contract lets anyone emit.
    const noted = framedEventLockingBytecode(CATEGORY, { ...EVENT, name: 'Noted', signature: 'Noted(bytes32,bytes32)' });
    expect(verdict(NATIVE, { ...spend, lockingBytecode: noted })).not.toBe(true);
  });

  it('refuses outputs that do not recreate the guard and publish the authorized hash, and another outpoint', () => {
    const spend = validSpend(NATIVE);
    const [guardOutput, publication] = spend.outputs as [Uint8Array, Uint8Array];
    const otherHash = HASH.map((byte) => byte ^ 0xff);
    expect(verdict(NATIVE, { ...spend, outputs: [guardOutput, publicationBytecode(otherHash, URIS)] })).not.toBe(true);
    // The authorized hash at the publication's offset, under another protocol identifier.
    const notPublication = flattenBinArray([Uint8Array.of(0x6a), encodeDataPush(utf8ToBin('NOTE')), encodeDataPush(HASH)]);
    expect(verdict(NATIVE, { ...spend, outputs: [guardOutput, notPublication] })).not.toBe(true);
    const elsewhere = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
    expect(verdict(NATIVE, { ...spend, outputs: [elsewhere, publication] })).not.toBe(true);
    expect(verdict(NATIVE, { ...spend, outpointTxid: 'a1'.repeat(32) })).not.toBe(true);
    expect(verdict(NATIVE, { ...spend, outpointIndex: 1 })).not.toBe(true);
  });
});
