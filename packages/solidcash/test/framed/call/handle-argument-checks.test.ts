import { describe, expect, it } from 'vitest';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { HDSigner } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import type { FramedFunctionCall } from '../../../src/framed/call/index.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A framed handle checks each argument against its ABI type as the encoder does in every convention, so a value
 * no call can carry is refused with ethers' own message before anything is composed: a `bytes32` of another length
 * ("incorrect data length") and an integer outside its type ("value out-of-bounds"). Before, a 99,999-byte `bytes32`
 * reached a struct encode inside the hop and failed there on the push size.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Box { bytes32 public hash; uint32 public time;'
  + '   function put(bytes32 hash_, uint32 time_) external { hash = hash_; time = time_; } }';

const box = compileStringMulti(SOURCE, { composition: 'framed', solidityImportCompat: true } as never).Box!;

interface BoxCalls {
  readonly put: (hash: Uint8Array, time: bigint) => FramedFunctionCall;
}

describe('a framed handle checks its arguments before composing', () => {
  it('refuses a bytes32 of another length and an out-of-range uint32 by the encoder\'s message, sending nothing',
    async () => {
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const signer = HDSigner.fromPhrase('test test test test test test test test test test test junk', provider);
      const fundingUtxo = { txid: '57'.repeat(32), vout: 0, satoshis: 500_000n };
      await provider.addUtxo(signer.getAddress(), fundingUtxo);
      await provider.addUtxo(signer.getAddress(), { txid: '68'.repeat(32), vout: 0, satoshis: 200_000n });
      await fundShippedFacets(provider);
      const deployment = await deployStatefulContract(box, [], {
        provider, fundingUtxo, funder: signer.unlockP2PKH(), changeAddress: signer.getAddress(),
      });
      const handle = (deployment.contract as StatefulContract).connect(signer);
      const calls = handle.call as unknown as BoxCalls;
      const record = async (): Promise<string> =>
        (await readFramedDeployment(provider, handle.categoryId, box.stateLayout!)).records[0]!.token!.nft!.commitment;
      const before = await record();

      await expect(calls.put(new Uint8Array(99_999), 1n)).rejects.toThrow(/incorrect data length/);
      await expect(calls.put(new Uint8Array(32), 2n ** 32n)).rejects.toThrow(/value out-of-bounds/);
      expect(await record()).toBe(before);

      // A well-formed call passes the check and settles.
      await calls.put(new Uint8Array(32).fill(7), 5n);
      expect(await record()).not.toBe(before);
    }, 300_000);
});
