import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { type Utxo } from '../../../src/index.js';
import { HDSigner } from '../../../src/HDSigner.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { CreateLookahead } from '../../../src/framed/deploy/create-lookahead.js';

/**
 * A factory's child deployment funded by the connected signer leaves a reserved genesis coin alone.
 *
 * A look-ahead reserves a genesis-eligible coin so the create address it predicted stays reachable; the signer's
 * own selection for `deployFrom` has to skip it, as `ContractFactory`'s does, and fund the child from another coin.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Child() { int counter; function bump() { this.counter = this.counter + 1; require(true); } }'
  + ' contract Factory() { int made; function make() { Child child = new Child(); this.made = this.made + 1; } }';

// The Factory's `make()` is an intentionally permissionless deploy entry - this test is about the look-ahead
// reserving a genesis-eligible coin, not about lifecycle authorization - so declare that intent. The emitted
// child-deployment covenant is unchanged.
const artifacts = compileStringMulti(SOURCE, { allowUnsafeOperations: true });

interface FactoryCalls {
  readonly make: () => { deploy(options?: object): Promise<{ readonly childCategoryId: string }> };
}

describe('a signer-funded deployFrom', () => {
  it('funds the child from an unreserved coin and leaves the reserved one unspent', async () => {
    const provider = new MockNetworkProvider();
    const signer = HDSigner.fromPhrase('legal winner thank year wave sausage worth useful legal winner thank yellow',
      provider);
    const fundingUtxo: Utxo = { txid: 'fa'.repeat(32), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(signer.getAddress(), fundingUtxo);
    const factory = (await StatefulContract.deploy(artifacts.Factory!, [], {
      provider, fundingUtxo, funder: signer.unlockP2PKH(), changeAddress: signer.getAddress(),
      initialState: { made: 0n },
    })).contract as StatefulContract;

    // The reserved coin is the first genesis-eligible coin the signer holds; the free one comes after it.
    const reserved: Utxo = { txid: '1a'.repeat(32), vout: 0, satoshis: 150_000n };
    await provider.addUtxo(signer.getAddress(), reserved);
    const lookahead = CreateLookahead.open({ signer });
    try {
      expect((await lookahead.reserve(1)).map((utxo) => `${utxo.txid}:${utxo.vout}`)).toStrictEqual([
        `${reserved.txid}:0`,
      ]);
      const free: Utxo = { txid: '2b'.repeat(32), vout: 0, satoshis: 150_000n };
      await provider.addUtxo(signer.getAddress(), free);

      factory.registerArtifacts(artifacts);
      const calls = factory.connect(signer).call as unknown as FactoryCalls;
      const result = await calls.make().deploy();

      expect(result.childCategoryId).toBe(free.txid);
      const live = await provider.getUtxos(signer.getAddress());
      expect(live.some((utxo) => utxo.txid === reserved.txid && utxo.vout === 0)).toBe(true);
    } finally {
      lookahead.release();
    }
  });
});
