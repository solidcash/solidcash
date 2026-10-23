import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { HDSigner } from '../../../src/HDSigner.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import type { FramedFunctionCall } from '../../../src/framed/call/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A writing entry whose own body refuses.
 *
 * The contract keeps one record and its writing entry guards it with a message; a write that trips the guard reports
 * what the artifact publishes for the entry's own selector rather than the opcode the machine stopped on, through
 * the call path and through the handle. A bare `require` naming the entry and the failing line is `call.test.ts`'s.
 */

const CATEGORY_HEX = '77'.repeat(31) + '88';
const CALLER_TXID = '78'.repeat(32);
const PHRASE = 'test test test test test test test test test test test junk';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Counter {'
  + '   int public counter;'
  + '   function add(int by) {'
  + '     this.counter = this.counter + by;'
  + '     require(this.counter <= 10, "counter overflow");'
  + '   }'
  + '   function current() view returns (int) { return this.counter; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const counter = artifacts.Counter!;

/** The handle's call namespace, as the framed path exposes it. */
interface CounterCalls {
  readonly add: (by: bigint) => FramedFunctionCall;
  readonly guarded: (by: bigint) => FramedFunctionCall;
}

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** Deploys the contract through the shipped deployment and funds the caller's own coin at its P2PKH lock. */
async function deploy(): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  const deployment = await deployStatefulContract(counter, [], {
    provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
  await provider.addUtxo(binToHex(callerLock), callerUtxo);
  // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(provider);
  return { provider, categoryId: deployment.categoryId, callerUtxo, callerLock, funder: signature.unlockP2PKH() };
}

/** Calls one entry with one argument through the shipped call path. */
function call(deployed: Deployed, functionName: string, by: bigint): ReturnType<typeof callFramedEntry> {
  return callFramedEntry({
    provider: deployed.provider,
    artifact: counter,
    categoryId: deployed.categoryId,
    functionName,
    args: [by],
    callerUtxo: deployed.callerUtxo,
    callerLockingBytecode: deployed.callerLock,
    funder: deployed.funder,
    vm: compositionMachine(),
  });
}

/** Deploys the contract with an HD signer and hands back the handle's write surface. */
async function connectWrites(): Promise<CounterCalls> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signer = HDSigner.fromPhrase(PHRASE, provider);
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(signer.getAddress(), fundingUtxo);
  // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(provider);
  const deployment = await deployStatefulContract(counter, [], {
    provider, fundingUtxo, funder: signer.unlockP2PKH(), changeAddress: signer.getAddress(),
  });
  const handle = (deployment.contract as StatefulContract).connect(signer);
  return handle.call as unknown as CounterCalls;
}

describe('a write whose entry refuses', () => {
  it('reports the entry\'s own declared message when the guard trips', async () => {
    const deployed = await deploy();
    const result = await call(deployed, 'add', 20n);

    expect(result.accepted).toBe(false);
    // The master's objection carries the reason the artifact publishes for the entry's own selector.
    const master = result.verdicts.find((verdict) => verdict.id === 'master');
    expect(master?.accepted).toBe(false);
    expect(master?.objection).toContain('counter overflow');
  });

  it('rejects the handle send with the entry\'s declared message', async () => {
    const calls = await connectWrites();
    let message = '';
    await calls.add(20n).then(
      () => { throw new Error('the write was accepted'); },
      (error: unknown) => { message = (error as Error).message; },
    );
    expect(message).toContain('counter overflow');
    expect(message).toContain('Counter.add()');
  });
});
