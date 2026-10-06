import { describe, expect, it } from 'vitest';
import { bytesToHex, parsePushdataCommitment } from '@solidcash/utils';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { HDSigner } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import type { PerCallFunctionCall } from '../../../src/per-call/call/index.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A signer passed where an entry takes an `address` stands for the address it names, as an ethers contract call
 * resolves an `Addressable` argument: the handle resolves it through `getAddress()` before the call is checked and
 * composed, so a writing call records exactly what the same call given the signer's `.address` records, and a read
 * answers alike for both. Before, the handle refused the signer before composing: "Value for type address should be
 * a Uint8Array or hex string".
 */

const PHRASE = 'test test test test test test test test test test test junk';

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Pin { address public holder;'
  + '   function hold(address who) external { holder = who; }'
  + '   function holds(address who) external view returns (bool) { return who == holder; } }';

const pin = compileStringMulti(SOURCE, { composition: 'per-call', solidityImportCompat: true } as never).Pin!;

interface PinCalls {
  readonly hold: (who: unknown) => PerCallFunctionCall;
  readonly holds: (who: unknown) => PerCallFunctionCall;
}

describe('a per-call handle resolves a signer passed for an address argument', () => {
  it('records and reads a signer exactly as its .address', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signer = HDSigner.fromPhrase(PHRASE, provider);
    const other = HDSigner.fromPhrase(PHRASE, provider, "m/44'/145'/0'/0/1");
    const fundingUtxo = { txid: '59'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(signer.getAddress(), fundingUtxo);
    await provider.addUtxo(signer.getAddress(), { txid: '6a'.repeat(32), vout: 0, satoshis: 400_000n });
    await fundShippedFacets(provider);
    const deployment = await deployStatefulContract(pin, [], {
      provider, fundingUtxo, funder: signer.unlockP2PKH(), changeAddress: signer.getAddress(),
    });
    const handle = (deployment.contract as StatefulContract).connect(signer);
    const calls = handle.call as unknown as PinCalls;
    const record = async (): Promise<string> =>
      (await readPerCallDeployment(provider, handle.categoryId, pin.stateLayout!)).records[0]!.token!.nft!.commitment;
    const holder = (commitment: string): string =>
      bytesToHex(parsePushdataCommitment(commitment, pin.stateLayout!, 0).holder as Uint8Array);

    await calls.hold(other.address);
    const byAddress = await record();
    expect(holder(byAddress)).toBe(bytesToHex(other.getLockingBytecode()));

    await calls.hold(signer);
    expect(holder(await record())).toBe(bytesToHex(signer.getLockingBytecode()));

    // The signer itself, after another holder: the record is the one its `.address` wrote, byte for byte.
    await calls.hold(other);
    expect(await record()).toBe(byAddress);

    // A read resolves the same way, an ethers-style asynchronous `getAddress()` included.
    expect(await calls.holds(other)).toBe(true);
    expect(await calls.holds(other.address)).toBe(true);
    expect(await calls.holds({ getAddress: async (): Promise<string> => other.address })).toBe(true);
    expect(await calls.holds(signer)).toBe(false);
  });
});
