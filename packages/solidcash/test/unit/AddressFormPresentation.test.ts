import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import { decorateFunctionResult, decorateStateAccessorResult } from '../../src/stateful/public-result.js';
import { artifactAddressForm } from '../../src/stateful/index.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../src/utils.js';

// The SDK half of `addressForm`: a decoded address is presented as the 20-byte Solidity identity under 'hash'
// and as the exact locking bytecode the contract stored under 'bytecode'. The form comes off the artifact, so a
// consumer reads back what the compiler decided; `artifactAddressForm` is the public way to assert that.

const P2SH32 = hexToBin(`aa20${'11'.repeat(32)}87`);   // 35 bytes, the lock a p2sh32 contract holds
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

const ownerFn = { name: 'owner', outputs: [{ type: 'address' }] } as unknown as AbiFunction;
const presentedReturn = (value: Uint8Array, options: Options): string =>
  binToHex(decorateFunctionResult(value, ownerFn, artifact(options)) as Uint8Array);
const presentedState = (value: Uint8Array, options: Options): string =>
  binToHex(decorateStateAccessorResult(value, 'owner', 0, artifact(options)) as Uint8Array);

describe('addressForm presentation', () => {
  it('answers the 20-byte identity under hash and the stored lock under bytecode', () => {
    const identity = binToHex(lockingBytecodeToSolidityAddressPayload(P2SH32)!);
    expect(identity.length / 2).toBe(20);
    expect(presentedReturn(P2SH32, { evmCompat: true })).toBe(identity);
    expect(presentedReturn(P2SH32, { evmCompat: true, addressForm: 'bytecode' })).toBe(binToHex(P2SH32));
    expect(presentedReturn(P2SH32, { evmCompat: true, addressForm: 'bytecode' }).length / 2).toBe(35);
  });

  it('takes a P2PKH lock to its embedded payload, never to a hash of the lock', () => {
    expect(presentedReturn(P2PKH, { evmCompat: true })).toBe(PAYLOAD);
    expect(presentedReturn(P2PKH, { evmCompat: true, addressForm: 'bytecode' })).toBe(binToHex(P2PKH));
  });

  it('presents a state accessor by the same rule as a decoded return', () => {
    expect(presentedState(P2SH32, { evmCompat: true })).toBe(presentedReturn(P2SH32, { evmCompat: true }));
    expect(presentedState(P2SH32, { evmCompat: true, addressForm: 'bytecode' })).toBe(binToHex(P2SH32));
  });

  it('resolves the form a project did not state, and reports the one it did', () => {
    expect(artifactAddressForm(artifact({ evmCompat: true }))).toBe('hash');
    expect(artifactAddressForm(artifact({}))).toBe('bytecode');
    expect(artifactAddressForm(artifact({ evmCompat: true, addressForm: 'bytecode' }))).toBe('bytecode');
    expect(artifactAddressForm(artifact({ addressForm: 'hash' }))).toBe('hash');
  });
});
