import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Signer, getContractFactory } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The `msg.sender` a constructor reads when a Signer deploys through the factory.
 *
 * An owner-guarded contract takes its owner from the constructor's `msg.sender` (`constructor() Owned(msg.sender)`),
 * and its setter later compares that owner with the caller each call states: the Signer's own P2PKH lock. The
 * factory therefore states the deploying Signer's lock as the constructor's caller, so the owner is the Signer
 * whichever coin funds the genesis: a deployment the Signer funds itself (the hardhat-style runtime's path) and one
 * a third party's coin pays for both leave the Signer as the owner. The owner's setter call settles, and another
 * Signer's is refused at the owner check.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'abstract contract Owned {',
  '  address private _owner;',
  '  constructor(address initialOwner) { _owner = initialOwner; }',
  '  modifier onlyOwner() { require(_owner == msg.sender, "caller is not the owner"); _; }',
  '  function owner() public view virtual returns (address) { return _owner; }',
  '}',
  'contract Box is Owned {',
  '  uint256 public value;',
  '  constructor() Owned(msg.sender) {}',
  '  function setValue(uint256 v) public onlyOwner { value = v; }',
  '}',
].join('\n');

const artifact: Artifact = compileStringMulti(
  SOURCE, { evmCompat: true, composition: 'framed' } as never,
).Box!;

/** A mock chain carrying the shipped validator facets, and a funder of fresh vout-0 coins for any signer. */
async function chain(): Promise<{ provider: MockNetworkProvider; fund: (signer: Signer) => Promise<Utxo> }> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  await fundShippedFacets(provider);
  let serial = 0;
  const fund = async (signer: Signer): Promise<Utxo> => {
    serial += 1;
    const utxo = { txid: `5e${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'c'), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(signer.getAddress(), utxo);
    return utxo;
  };
  return { provider, fund };
}

/** The 20-byte hash a P2PKH lock pays, which the read path answers for an address. */
function hashOf(lock: Uint8Array): string {
  return binToHex(lock.slice(3, 23));
}

/** The owner the deployment's records hold, read through the read path, as hex. */
async function ownerHex(provider: MockNetworkProvider, box: StatefulContract): Promise<string> {
  const read = await readFramedEntry({
    provider, artifact, categoryId: box.categoryId, functionName: 'owner', args: [], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return binToHex(read.value as Uint8Array);
}

/** The owner-only setter, called by `signer` through the handle. */
function setValueAs(box: StatefulContract, signer: Signer, value: bigint): Promise<unknown> {
  const calls = box.connect(signer).call as unknown as { setValue: (v: bigint) => Promise<unknown> };
  return calls.setValue(value);
}

describe('the msg.sender a constructor reads on a factory deployment', () => {
  it('is the deploying Signer: the owner reads back as its lock, its call settles, a stranger\'s is refused', async () => {
    const { provider, fund } = await chain();
    const owner = new Signer(new Uint8Array(32).fill(0xd1), provider);
    const stranger = new Signer(new Uint8Array(32).fill(0xd2), provider);
    await fund(owner);
    await fund(owner);
    await fund(stranger);

    const box = await getContractFactory(artifact, owner).deploy() as unknown as StatefulContract;
    expect(await ownerHex(provider, box)).toBe(hashOf(owner.getLockingBytecode()));

    await setValueAs(box, owner, 7n);
    await expect(setValueAs(box, stranger, 9n)).rejects.toThrow(/caller is not the owner|OP_VERIFY/);
    expect(await ownerHex(provider, box)).toBe(hashOf(owner.getLockingBytecode()));
  }, 600_000);

  it('stays the deploying Signer when a third party\'s coin and funder pay for the genesis', async () => {
    const { provider, fund } = await chain();
    const owner = new Signer(new Uint8Array(32).fill(0xd3), provider);
    const sponsor = new Signer(new Uint8Array(32).fill(0xd4), provider);
    await fund(owner);
    const fundingUtxo = await fund(sponsor);

    const box = await getContractFactory(artifact, owner).deploy({
      fundingUtxo, funder: sponsor.unlockP2PKH(), changeAddress: sponsor.getAddress(),
    }) as unknown as StatefulContract;
    expect(await ownerHex(provider, box)).toBe(hashOf(owner.getLockingBytecode()));

    await setValueAs(box, owner, 7n);
    await expect(setValueAs(box, sponsor, 9n)).rejects.toThrow(/caller is not the owner|OP_VERIFY/);
  }, 600_000);
});
