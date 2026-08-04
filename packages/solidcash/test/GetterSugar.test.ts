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
  mapping(bytes20 => bigint) balances;
  mapping(bytes20 => mapping(bytes20 => bigint)) allowances;
  function poke(pubkey pk, sig s) { require(checkSig(s, pk)); this.counter = this.counter + 1; }
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
    const categoryId = await setupWithEntries(
      provider, contract, stateLayout, { counter: 7n, owner: alicePkh },
      [{ collection: 'balances', commitment: balEntry }, { collection: 'allowances', commitment: allowEntry }],
    );
    return StatefulContract.withCategory(contract, categoryId) as any;
  }

  it('reads a scalar state var: sc.<name>()', async () => {
    const sc = await deploy();
    expect(await sc.counter()).toBe(7n);
    expect(await sc.owner()).toEqual(alicePkh);
  });

  it('reads a single-key mapping entry: sc.<mapping>(key)', async () => {
    const sc = await deploy();
    expect(await sc.balances(alicePkh)).toBe(100n);
  });

  it('returns undefined for a missing mapping key', async () => {
    const sc = await deploy();
    expect(await sc.balances(bobPkh)).toBeUndefined();
  });

  it('reads a nested mapping entry: sc.<mapping>(k1, k2)', async () => {
    const sc = await deploy();
    expect(await sc.allowances(alicePkh, bobPkh)).toBe(500n);
    expect(await sc.allowances(bobPkh, alicePkh)).toBeUndefined();
  });

  it('is equivalent to the explicit sc.state.<name> accessor', async () => {
    const sc = await deploy();
    expect(await sc.state.counter()).toBe(7n);
    expect(await sc.state.balances(alicePkh)).toBe(100n);
  });
});
