import { describe, expect, it } from 'vitest';
import { compileString } from '../../../solidc/src/compiler.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { ContractFactory } from '../../src/stateful/ContractFactory.js';
import { StatefulContract } from '../../src/stateful/StatefulContract.js';

/**
 * A framed contract's top-level creation arguments are baked into the redeem program, not the constructor frame.
 * `StatefulContract.deploy(artifact, [x, y], ...)` must accept them, keep them out of the state NFT, and make the
 * deployed functions read the values.
 *
 * This is the SDK half of the TornadoTokenPool syntax:
 *   contract TornadoTokenPool(int denomination, bytes32 category)
 *   this.tokens[category].transfer(...)
 */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract C(int x, bytes32 y) {'
  + '   int z;'
  + '   constructor() { }'
  + '   function set() public { this.z = x; }'
  + '   function get() view returns (int) { return x; }'
  + '   function getZ() view returns (int) { return this.z; }'
  + ' }';

describe('framed deploy with contract creation arguments', () => {
  it('deploys, reads the creation argument, and keeps it out of state', async () => {
    const artifact = compileString(SOURCE, { composition: 'framed' });
    expect(artifact.constructorInputs.map((input) => input.name)).toEqual(['x', 'y']);
    expect(artifact.stateLayout?.variables.map((variable) => variable.name)).toEqual(['z']);

    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1, { fundingUtxos: 8, genesisFundingUtxos: 2 });
    const coin = (await alice.getUtxos()).find((utxo) => !utxo.token && utxo.satoshis >= 200_000n);
    if (!coin) throw new Error('no funding coin');

    const { contract } = await StatefulContract.deploy(artifact, [7n, new Uint8Array(32).fill(9)], {
      provider,
      fundingUtxo: coin,
      funder: alice.unlockP2PKH(),
      changeAddress: alice.getAddress(),
    });

    const read = await contract.connect(alice).call.get().staticCall() as { value?: bigint; retval?: Uint8Array };
    expect(read.value ?? BigInt(read.retval?.[0] ?? -1)).toBe(7n);

    await contract.connect(alice).call.set().send();
    expect((await contract.getState()).z).toBe(7n);
  });

  it('splits creation arguments from constructor-block arguments through the factory', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract D(int x, bytes32 y) { int z; constructor(int z_) { z = z_; }'
      + '   function get() view returns (int) { return x; }'
      + '   function getZ() view returns (int) { return this.z; } }';
    const artifact = compileString(source, { composition: 'framed' });
    const provider = new MockNetworkProvider();
    const [alice] = await provider.getSigners(1, { fundingUtxos: 8, genesisFundingUtxos: 2 });

    const contract = await new ContractFactory(artifact, alice)
      .deploy(7n, new Uint8Array(32).fill(9), 42n);
    const read = await contract.connect(alice).call.get().staticCall() as { value?: bigint };
    expect(read.value).toBe(7n);
    expect((await contract.getState()).z).toBe(42n);
  });
});
