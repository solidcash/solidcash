import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { AbiFunction, Artifact, ExternalResultEncoding } from '@solidcash/utils';
import { decorateFunctionResult, decorateStateAccessorResult } from '../../src/stateful/public-result.js';
import { artifactAddressForm } from '../../src/stateful/index.js';
import { externalResultUsesEvmWords } from '../../src/stateful/solidityAbi.js';
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

  it('presents a state address through a registered deployment when a resolver is supplied', () => {
    // A `public address` getter must compare strictly with `contract.getAddress()`, which names the deployed
    // contract. The resolver supplies that address for the identity the decorated value carries.
    const deployed = 'bchtest:qqysjzgfpyysjzgfpyysjzgfpyysjzgfpynsmzst5t';
    expect(decorateStateAccessorResult(
      P2SH32, 'owner', 0, artifact({ evmCompat: true }), () => deployed,
    )).toBe(deployed);
    // Without a resolver the identity is the published form, and a non-address value never reaches it.
    expect(decorateStateAccessorResult(P2SH32, 'owner', 0, artifact({ evmCompat: true })))
      .toMatchObject({ length: 20 });
    expect(decorateStateAccessorResult(
      P2SH32, 'owner', 0, artifact({}), () => deployed,
    )).toMatchObject({ length: 35 });
  });

  it('keeps a state address whole under evmCompat when the form is bytecode, as its getter returns it', () => {
    // The getter's result travels as compact pushdata, not an ABI word, so the read answers the stored lock.
    const compat = { evmCompat: true, addressForm: 'bytecode' } as const;
    expect(presentedState(P2PKH, compat)).toBe(binToHex(P2PKH));
    expect(presentedState(P2SH32, compat)).toBe(binToHex(P2SH32));
    expect(presentedReturn(P2PKH, compat, 'compact-pushdata-v1')).toBe(binToHex(P2PKH));
    // Under hash the same artifact answers the identity, as before.
    expect(presentedState(P2PKH, { evmCompat: true })).toBe(PAYLOAD);
  });

  it('names a deployment by its whole lock under evmCompat and bytecode, and keeps an account\'s lock', () => {
    const deployed = 'bchtest:qqysjzgfpyysjzgfpyysjzgfpyysjzgfpynsmzst5t';
    const compat = artifact({ evmCompat: true, addressForm: 'bytecode' });
    const resolver = (value: Uint8Array): string | undefined => (
      binToHex(value) === binToHex(P2SH32) ? deployed : undefined);
    expect(decorateStateAccessorResult(P2SH32, 'owner', 0, compat, resolver)).toBe(deployed);
    const account = decorateStateAccessorResult(P2PKH, 'owner', 0, compat, resolver) as Uint8Array;
    expect(binToHex(account)).toBe(binToHex(P2PKH));
  });

  it('decides an external result\'s wire as the compiler does: words, except an address under bytecode', () => {
    const pair = { name: 'Pair', fields: [{ name: 'a', type: 'address' }, { name: 'n', type: 'uint256' }] };
    const words = (options: Options, types: string[]): boolean => externalResultUsesEvmWords(
      { ...artifact(options), structs: [pair] } as unknown as Artifact, types,
    );
    const bytecode = { evmCompat: true, addressForm: 'bytecode' } as const;
    expect(words({ evmCompat: true }, ['address'])).toBe(true);
    expect(words(bytecode, ['address'])).toBe(false);
    expect(words(bytecode, ['uint256'])).toBe(true);
    expect(words(bytecode, ['uint256', 'address[]'])).toBe(false);
    expect(words(bytecode, ['Pair'])).toBe(false);
    expect(words({}, ['uint256'])).toBe(false);
  });

  it('resolves the form a project did not state, and reports the one it did', () => {
    expect(artifactAddressForm(artifact({ evmCompat: true }))).toBe('hash');
    expect(artifactAddressForm(artifact({}))).toBe('bytecode');
    expect(artifactAddressForm(artifact({ evmCompat: true, addressForm: 'bytecode' }))).toBe('bytecode');
    expect(artifactAddressForm(artifact({ addressForm: 'hash' }))).toBe('hash');
  });
});
