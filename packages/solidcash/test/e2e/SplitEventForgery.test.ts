/**
 * Forged logs on a split contract whose only emit sits in a library function.
 *
 * The SDK reads a split contract's logs through the artifact of its logical contract (function split) or its root (size
 * split), which lists the events the whole contract emits. SEC-10 pins forged logs only on a contract with events, and a
 * shard holds some bodies only, so the split states that for the logical contract. The split's probe looked at the
 * contract's own bodies, where an emit made in a library or free function does not sit before inlining: a shard without
 * the emitting body pinned nothing while the logical artifact listed the event, and a size-split root no longer listed
 * it. The split now also takes it from the logical contract's compiled artifact.
 */
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileStringSplit } from 'solidc';
import { encodeEventCommitment, type SplitArtifactBundle } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { callFramedEntry, type FramedCallResult } from '../../src/framed/call/index.js';
import { eventLockingBytecode } from '../../src/framed/deploy/index.js';
import type { LibauthOutput, Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { SignatureTemplate } from '../../src/index.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { tryParseEventCommitment } from '../../src/stateful/StateReader.js';
import { aliceAddress, alicePkh, alicePriv } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const LIBRARY = `pragma solidcash ^0.14.0;
event Fired(int value);
library Log {
  function fire(int value) internal { emit Fired(value); }
}
contract Emitter {
  int counter;
  function bump(int x) { Log.fire(x); this.counter = this.counter + x; require(x > 0); }
  function quiet(int x) { this.counter = this.counter + x; require(x > 0); }
}`;

/** The same contract emitting in its own body, which the split's probe always saw. */
const OWN_BODY = `pragma solidcash ^0.14.0;
event Fired(int value);
contract Emitter {
  int counter;
  function bump(int x) { emit Fired(x); this.counter = this.counter + x; require(x > 0); }
  function quiet(int x) { this.counter = this.counter + x; require(x > 0); }
}`;

const FRAMED = { split: 'func', composition: 'framed', suppressWarnings: true } as const;

describe('a function-split contract whose only emit sits in a library function', () => {
  const bundle = compileStringSplit(LIBRARY, FRAMED);
  const fired = bundle.logical.events!.find((event) => event.name === 'Fired')!;
  const alice = { lock: encodeLockingBytecodeP2pkh(alicePkh), signer: new SignatureTemplate(alicePriv) };

  it('pins forged logs on every shard, as the logical artifact the SDK reads lists the event', () => {
    expect(bundle.logical.events?.map((event) => event.name)).toEqual(['Fired']);
    expect(bundle.shards.map((shard) => shard.function).sort()).toEqual(['bump', 'quiet']);
    for (const shard of bundle.shards) {
      expect(shard.artifact.events?.map((event) => event.name), shard.function).toEqual(['Fired']);
    }
    // The shard that does not emit pins as it does when the emit sits in the contract's own body.
    const quiet = (split: typeof bundle): string => split.shards.find((shard) => shard.function === 'quiet')!
      .artifact.bytecode;
    expect(quiet(bundle)).toBe(quiet(compileStringSplit(OWN_BODY, FRAMED)));
  });

  it('refuses a forged event NFT beside a call to the shard that does not emit, and reads the honest log', async () => {
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const fundingUtxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(binToHex(alice.lock), fundingUtxo);
    await fundShippedFacets(provider);
    const { categoryId } = await deployStatefulContract(bundle.logical, [], {
      provider, fundingUtxo, funder: alice.signer.unlockP2PKH(), changeAddress: aliceAddress, functionSplit: bundle,
    });
    const firedLock = eventLockingBytecode(hexToBin(categoryId), fired.signature, false);
    const logs = async (): Promise<unknown[]> => (await provider.getUtxosForLockingBytecode(firedLock))
      .filter((utxo) => utxo.token?.category === categoryId)
      .map((utxo) => tryParseEventCommitment(utxo.token!.nft!.commitment, fired)?.value);
    const coin = async (txid: string): Promise<Utxo> => {
      const utxo = { txid, vout: 0, satoshis: 300_000n };
      await provider.addUtxo(binToHex(alice.lock), utxo);
      return utxo;
    };
    const enter = async (functionName: string, x: bigint, callerUtxo: Utxo): Promise<FramedCallResult> => {
      const result = await callFramedEntry({
        provider, artifact: bundle.logical, split: bundle, categoryId, functionName, args: [x],
        callerUtxo, callerLockingBytecode: alice.lock, funder: alice.signer.unlockP2PKH(), vm,
      });
      expect(result.verdicts.filter((verdict) => !verdict.accepted), functionName).toEqual([]);
      expect(result.broadcast, functionName).toBeDefined();
      return result;
    };

    await enter('bump', 200n, await coin('e1'.repeat(32)));
    expect(await logs()).toEqual([200n]);

    // The honest call to the shard that does not emit, rewound and sent again with a forged Fired log appended. The
    // caller's coin signs the outputs, so it signs again over the coins the rewound chain holds; nothing else changes.
    const callerUtxo = await coin('e2'.repeat(32));
    const snapshot = await provider.takeSnapshot();
    const honest = await enter('quiet', 4n, callerUtxo);
    await snapshot.restore();
    const forged = decodeTransactionUnsafe(hexToBin(honest.broadcast!.hex));
    const sourceOutputs = await Promise.all(forged.inputs.map(async (input): Promise<LibauthOutput> => {
      const live = (await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex))!;
      const nft = live.token?.nft;
      return {
        lockingBytecode: live.lockingBytecode,
        valueSatoshis: live.satoshis,
        ...(live.token === undefined ? {} : {
          token: {
            amount: live.token.amount,
            category: hexToBin(live.token.category),
            ...(nft === undefined ? {} : { nft: { capability: nft.capability, commitment: hexToBin(nft.commitment) } }),
          },
        }),
      };
    }));
    const callerIndex = forged.inputs.findIndex((input) => binToHex(input.outpointTransactionHash) === callerUtxo.txid);
    const change = forged.outputs.at(-1)!;
    expect(binToHex(change.lockingBytecode)).toBe(binToHex(alice.lock));
    change.valueSatoshis -= 2_000n;
    forged.outputs.push({
      lockingBytecode: firedLock,
      valueSatoshis: 1_000n,
      token: {
        category: hexToBin(categoryId),
        amount: 0n,
        nft: { capability: 'none', commitment: encodeEventCommitment(fired.parameters, [999_999n]) },
      },
    });
    forged.inputs[callerIndex]!.unlockingBytecode = alice.signer.unlockP2PKH()
      .generateUnlockingBytecode({ transaction: forged, sourceOutputs, inputIndex: callerIndex });
    const outcome = await provider.sendRawTransaction(binToHex(encodeTransaction(forged)))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    // The caller's own signature is not what refuses it.
    expect(outcome.toLowerCase()).not.toContain(`input index ${callerIndex}:`);
    expect(await logs()).toEqual([200n]);
  }, 900_000);
});

describe('a size-split contract whose only emit sits in a library function', () => {
  it('lists the event on its root, through which the SDK reads a facet log', () => {
    const bundle = compileStringSplit(LIBRARY, { forceSplit: true, messageBus: false }) as SplitArtifactBundle;
    expect(bundle.root.events?.map((event) => event.name)).toEqual(['Fired']);
    for (const facet of Object.values(bundle.facets)) {
      expect(facet.events?.map((event) => event.name), facet.contractName).toEqual(['Fired']);
    }
  });
});
