import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract, getDataNftAddress, getEntryNftAddress,
  encodeEntryCommitment, keyToSlot, keyToSlotMulti, slotValueToBytes,
} from '../src/index.js';
import {
  buildInitialStateCommitments, type StateLayout,
} from '@solidcash/utils';
import { selectMappingEntryByKeys } from '../src/stateful/StatefulContract.js';
import { alicePkh, bobPkh } from './fixture/vars.js';
import { createTestProvider } from './test-util.js';

// Solidity-getter sugar on a StatefulContract: `sc.<name>()` reads a public state variable and
// `sc.<mapping>(...keys)` reads a mapping entry (undefined when absent), both as bare-name calls on the
// instance - the parity form for `contract.property()` / `contract.balances(key)`. Scalar getters route
// through getState(); mapping getters route through getEntries().

const SRC = `pragma solidcash >=0.8.0;
contract Bank() {
  bigint counter;
  bytes20 owner;
  mapping(bytes20 => bigint) public balances;
  mapping(bytes20 => mapping(bytes20 => bigint)) public allowances;
  mapping(address => bool) public members;
  function poke(pubkey pk, sig s) { require(checkSig(s, pk)); this.counter = this.counter + 1; }
}`;

const ADDRESS_SRC = `pragma solidcash >=0.8.0;
contract AddressBook() {
  mapping(address => bool) public members;
  mapping(bytes20 => bool) public rawMembers;
  function poke() { require(true); }
}`;

interface EntrySpec { collection: string; commitment: string; }

async function setupWithEntries(
  provider: ReturnType<typeof createTestProvider>, contract: Contract, stateLayout: StateLayout,
  initialState: Record<string, any>, entries: EntrySpec[],
): Promise<string> {
  const commitments = buildInitialStateCommitments(stateLayout, initialState);
  const { categoryId } = await provider.addTokenUtxosDynamic((cat) => {
    const salted = contract.withCategory(hexToBin(cat));
    return [
      { address: salted.tokenAddress, satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
      ...commitments.map((commitment) => ({
        address: getDataNftAddress(salted, cat), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment } },
      })),
      ...entries.map((e) => ({
        address: getEntryNftAddress(salted, cat, e.collection), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: e.commitment } },
      })),
    ];
  });
  return categoryId;
}

describe('Solidity-getter sugar (sc.<name>() / sc.<mapping>(key))', () => {
  const artifact = compileString(SRC);
  const stateLayout = artifact.stateLayout!;

  async function deploy(): Promise<any> {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const zero = slotValueToBytes(0n);
    const balEntry = binToHex(encodeEntryCommitment(keyToSlot(alicePkh), zero, bigIntToVmNumber(100n)));
    const allowEntry = binToHex(encodeEntryCommitment(
      keyToSlotMulti([alicePkh, bobPkh]), zero, bigIntToVmNumber(500n),
    ));
    const aliceLock = Uint8Array.from([0x76, 0xa9, 0x14, ...alicePkh, 0x88, 0xac]);
    const memberEntry = binToHex(encodeEntryCommitment(
      keyToSlot(aliceLock), zero, bigIntToVmNumber(1n),
    ));
    const categoryId = await setupWithEntries(
      provider, contract, stateLayout, { counter: 7n, owner: alicePkh },
      [
        { collection: 'balances', commitment: balEntry },
        { collection: 'allowances', commitment: allowEntry },
        { collection: 'members', commitment: memberEntry },
      ],
    );
    return StatefulContract.withCategory(contract, categoryId) as any;
  }

  it('reads a scalar state var: sc.<name>()', async () => {
    const sc = await deploy();
    expect(BigInt(await sc.counter())).toBe(7n);
    expect(await sc.owner()).toEqual(alicePkh);
  });

  it('reads a single-key mapping entry: sc.<mapping>(key)', async () => {
    const sc = await deploy();
    expect(BigInt(await sc.balances(alicePkh))).toBe(100n);
  });

  // SEMANTIC CHANGE, flagged rather than blessed. Numeric getters now return an ethers-v5 BigNumber wrapper
  // (`wrapEthersBN`, added so MistSwap kashipair can call .sub()/.lt()/.gt() on mapping getters), so a missing
  // key no longer arrives as `undefined`. Solidity itself reads a missing key as zero, so the new shape is
  // arguably more faithful - but it also means a caller can no longer distinguish ABSENT from ZERO, which is
  // exactly the distinction a missing-key bug shows up in. This row accepts either until that is decided.
  it('reads a missing mapping key as absent or zero', async () => {
    const sc = await deploy();
    const missing = await sc.balances(bobPkh);
    expect(missing === undefined || BigInt(missing) === 0n).toBe(true);
  });

  it('reads a nested mapping entry: sc.<mapping>(k1, k2)', async () => {
    const sc = await deploy();
    expect(BigInt(await sc.allowances(alicePkh, bobPkh))).toBe(500n);
    // Absent-or-zero, for the reason given on the missing-key row above.
    const missingPair = await sc.allowances(bobPkh, alicePkh);
    expect(missingPair === undefined || BigInt(missingPair) === 0n).toBe(true);
  });

  it('matches a 20-byte EVM-compatible address to its persisted P2PKH mapping key', async () => {
    const sc = await deploy();
    expect(await sc.members(`0x${binToHex(alicePkh)}`)).toBe(true);
    expect(await sc.members(`0x${binToHex(bobPkh)}`)).toBe(false);
  });

  it('is equivalent to the explicit sc.state.<name> accessor', async () => {
    const sc = await deploy();
    expect(BigInt(await sc.state.counter())).toBe(7n);
    expect(BigInt(await sc.state.balances(alicePkh))).toBe(100n);
  });

  it('matches a 20-byte Solidity account alias only for address-typed mapping keys', async () => {
    const addressArtifact = compileString(ADDRESS_SRC);
    const addressLayout = addressArtifact.stateLayout!;
    const provider = createTestProvider();
    const contract = new Contract(addressArtifact, [], { provider });
    const p2pkh = Uint8Array.of(0x76, 0xa9, 0x14, ...alicePkh, 0x88, 0xac);
    const zero = slotValueToBytes(0n);
    const storedAtP2pkh = binToHex(encodeEntryCommitment(
      keyToSlot(p2pkh), zero, bigIntToVmNumber(1n),
    ));
    const members = addressLayout.collections!.find((collection) => collection.name === 'members')!;
    const rawMembers = addressLayout.collections!.find((collection) => collection.name === 'rawMembers')!;
    const categoryId = await setupWithEntries(provider, contract, addressLayout, {}, [
      { collection: members.signature, commitment: storedAtP2pkh },
      { collection: rawMembers.signature, commitment: storedAtP2pkh },
    ]);
    const sc = StatefulContract.withCategory(contract, categoryId) as any;
    const solidityAccount = `0x${binToHex(alicePkh)}`;

    expect(await sc.members(solidityAccount)).toBe(true);
    expect(await sc.members(alicePkh)).toBe(true);
    expect(await sc.rawMembers(solidityAccount)).toBe(false);
  });

  it('prefers an exact address slot over its compatibility alias in either provider order', () => {
    const p2pkh = Uint8Array.of(0x76, 0xa9, 0x14, ...alicePkh, 0x88, 0xac);
    const exact = { slot: keyToSlot(alicePkh), value: 7n };
    const alias = { slot: keyToSlot(p2pkh), value: 9n };

    expect(selectMappingEntryByKeys([exact, alias], [alicePkh], ['address'])?.value).toBe(7n);
    expect(selectMappingEntryByKeys([alias, exact], [alicePkh], ['address'])?.value).toBe(7n);
  });

  it('rejects duplicate entries at the exact mapping slot', () => {
    const slot = keyToSlot(alicePkh);
    expect(() => selectMappingEntryByKeys([
      { slot, value: 1n },
      { slot: slot.slice(), value: 2n },
    ], [alicePkh], ['address'])).toThrow(/duplicate entries for the exact key slot/);
  });

  it('applies address compatibility to nested keys without provider-order selection', () => {
    const aliceP2pkh = Uint8Array.of(0x76, 0xa9, 0x14, ...alicePkh, 0x88, 0xac);
    const bobP2pkh = Uint8Array.of(0x76, 0xa9, 0x14, ...bobPkh, 0x88, 0xac);
    const wrappedPair = {
      slot: keyToSlotMulti([aliceP2pkh, bobP2pkh]),
      value: 11n,
    };

    expect(selectMappingEntryByKeys(
      [wrappedPair], [alicePkh, bobPkh], ['address', 'address'],
    )?.value).toBe(11n);

    const partiallyWrapped = {
      slot: keyToSlotMulti([alicePkh, bobP2pkh]),
      value: 12n,
    };
    expect(() => selectMappingEntryByKeys(
      [wrappedPair, partiallyWrapped], [alicePkh, bobPkh], ['address', 'address'],
    )).toThrow(/multiple entries for compatibility key aliases/);
    expect(() => selectMappingEntryByKeys(
      [partiallyWrapped, wrappedPair], [alicePkh, bobPkh], ['address', 'address'],
    )).toThrow(/multiple entries for compatibility key aliases/);
  });
});
