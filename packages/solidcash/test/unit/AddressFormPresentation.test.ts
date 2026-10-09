import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { AbiFunction, Artifact, ExternalResultEncoding } from '@solidcash/utils';
import { decorateFunctionResult, decorateStateAccessorResult } from '../../src/stateful/public-result.js';
import { artifactAddressForm } from '../../src/stateful/index.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../src/utils.js';

// The SDK half of `addressForm`: which form a decoded address is presented as. Two rules, in this order:
//   - a word-encoded leaf (`evm-abi-v1`) is the identity by construction - a fixed-width ABI word cannot carry a
//     variable-length lock - so the encoding decides it alone;
//   - otherwise the artifact's `addressForm` decides: 'hash' answers the 20-byte Solidity identity, 'bytecode'
//     answers the exact locking bytecode the contract stored.
// `artifactAddressForm` is the public way to assert which form an artifact was compiled with.

const P2SH32 = hexToBin(`aa20${'11'.repeat(32)}87`);    // 35 bytes, the lock a p2sh32 contract holds
const P2PKH = hexToBin(`76a914${'22'.repeat(20)}88ac`); // 25 bytes; its identity is the embedded payload
const PAYLOAD = '22'.repeat(20);

type Options = { evmCompat?: boolean; addressForm?: 'hash' | 'bytecode' };
const artifact = (options: Options): Artifact => ({
  contractName: 'C',
  compiler: { options },
  enums: [],
  structs: [],
  stateLayout: { variables: [{ name: 'owner', type: 'address' }], structs: [] },
} as unknown as Artifact);

const ownerFn = (resultEncoding?: ExternalResultEncoding): AbiFunction => ({
  name: 'owner',
  outputs: [{ type: 'address' }],
  ...(resultEncoding === undefined ? {} : { resultEncoding }),
} as unknown as AbiFunction);

const presentedReturn = (
  value: Uint8Array, options: Options, resultEncoding?: ExternalResultEncoding,
): string => binToHex(decorateFunctionResult(value, ownerFn(resultEncoding), artifact(options)) as Uint8Array);
const presentedState = (value: Uint8Array, options: Options): string =>
  binToHex(decorateStateAccessorResult(value, 'owner', 0, artifact(options)) as Uint8Array);

describe('addressForm presentation', () => {
  const identity = binToHex(lockingBytecodeToSolidityAddressPayload(P2SH32)!);

  it('answers a word-encoded address as the identity whatever the form says', () => {
    expect(identity.length / 2).toBe(20);
    // The wire carried a 32-byte word whose low 20 bytes are the identity; no lock is available to present.
    expect(presentedReturn(P2SH32, { evmCompat: true })).toBe(identity);
    expect(presentedReturn(P2SH32, { evmCompat: true, addressForm: 'bytecode' })).toBe(identity);
  });

  it('lets the form decide a non-word leaf: hash narrows the stored lock, bytecode keeps it', () => {
    const stored = presentedReturn(P2SH32, {}, 'compact-pushdata-v1');
    expect(stored).toBe(binToHex(P2SH32));
    expect(stored.length / 2).toBe(35);
    expect(presentedReturn(P2SH32, { addressForm: 'hash' }, 'compact-pushdata-v1')).toBe(identity);
  });

  it('takes a P2PKH lock to its embedded payload under hash, never to a hash of the lock', () => {
    expect(presentedReturn(P2PKH, { addressForm: 'hash' }, 'compact-pushdata-v1')).toBe(PAYLOAD);
    expect(presentedReturn(P2PKH, {}, 'compact-pushdata-v1')).toBe(binToHex(P2PKH));
  });

  it('presents a state accessor by the same rule as a decoded return', () => {
    // A synthetic artifact without evmCompat is a compact-pushdata artifact, so the form decides here too.
    expect(presentedState(P2SH32, {})).toBe(binToHex(P2SH32));
    expect(presentedState(P2SH32, { addressForm: 'hash' })).toBe(identity);
  });

  it('resolves the form a project did not state, and reports the one it did', () => {
    expect(artifactAddressForm(artifact({ evmCompat: true }))).toBe('hash');
    expect(artifactAddressForm(artifact({}))).toBe('bytecode');
    expect(artifactAddressForm(artifact({ evmCompat: true, addressForm: 'bytecode' }))).toBe('bytecode');
    expect(artifactAddressForm(artifact({ addressForm: 'hash' }))).toBe('hash');
  });
});
