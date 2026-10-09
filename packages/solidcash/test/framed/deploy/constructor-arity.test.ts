import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Signer, getContractFactory } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The argument count a framed constructor is deployed with.
 *
 * A framed artifact publishes no `constructorInputs`; its constructor's parameters are the `__construct` ABI
 * entry. A factory deployment whose argument list does not match them (a stale deployment script's) is refused up
 * front, as ethers refuses it, naming the contract, the parameters it declares and the count it was given, rather
 * than stopping inside the constructor probe on a stack read. A value of the wrong kind names its parameter. The
 * same contract deployed with all three arguments settles its genesis.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Settings {',
  '  uint256 public cap;',
  '  uint64 public rate;',
  '  bool public open;',
  '  constructor(uint256 initialCap, uint64 initialRate, bool initiallyOpen) {',
  '    cap = initialCap;',
  '    rate = initialRate;',
  '    open = initiallyOpen;',
  '  }',
  '}',
].join('\n');

const artifact: Artifact = compileStringMulti(
  SOURCE, { evmCompat: true, composition: 'framed' } as never,
).Settings!;

/** A mock chain carrying the shipped validator facets, and a deployer holding fresh vout-0 coins. */
async function deployer(): Promise<Signer> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  await fundShippedFacets(provider);
  const signer = new Signer(new Uint8Array(32).fill(0xa7), provider);
  for (let serial = 1; serial <= 3; serial += 1) {
    const txid = `a7${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'c');
    await provider.addUtxo(signer.getAddress(), { txid, vout: 0, satoshis: 5_000_000n });
  }
  return signer;
}

describe('the argument count of a framed constructor deployment', () => {
  it('refuses one argument for three parameters with the contract, its parameters and the count', async () => {
    const signer = await deployer();
    const factory = getContractFactory(artifact, signer);

    await expect(factory.deploy(1_000n)).rejects.toThrow(
      'incorrect number of arguments to constructor of "Settings": expected 3 '
      + '(uint256 initialCap, uint64 initialRate, bool initiallyOpen) but got 1',
    );
    await expect(factory.deploy(1_000n, 'seven', true)).rejects.toThrow(
      'argument 2 to constructor of "Settings" (uint64 initialRate) does not fit its type',
    );
  }, 600_000);

  it('deploys with all three arguments', async () => {
    const signer = await deployer();
    const settings = await getContractFactory(artifact, signer).deploy(1_000n, 7n, true) as unknown as StatefulContract;

    expect(settings.categoryId).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);
});
