/**
 * SDKCORE-1: a message-bus composition whose layout funders are the signer's own coins.
 *
 * The mock provider's addUtxo is removed after the coins exist, which is the live-provider branch:
 * structural slots are filled from the signer, not from the OP_TRUE dummy funder.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../src/index.js';
import Signer from '../src/Signer.js';
import { StatefulContract } from '../src/stateful/index.js';
import * as messageBus from '../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from './test-util.js';
import { alicePriv } from './fixture/vars.js';
import { createMessageBusSemanticTestProvider } from './journal-message-bus/e2e/message-bus-semantic-profile.js';

const WALLET_SATS = 2_000_000n;
const EVENT_CEILING = 1_200n;

describe('SDKCORE-1 wallet funders in a message-bus composition', () => {
  it('does not pay a signer coin out to anyone-can-spend', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const signer = new Signer(alicePriv, provider);
    const calleeArtifact = compileString(
      'contract Callee() { int n; function quote(int x) public returns (int) { require(x >= 0); return x; } }',
      { forceStateful: true, messageBus: true },
    );
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { n: 0n }, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId).connect(signer);

    const callerArtifact = compileString(
      'interface ICallee { function quote(int x) returns (int); }'
      + ' contract Caller() { int n;'
      + ' function ask(address other, int x) public { int y = ICallee(other).quote(x); this.n = y; require(y >= 0); } }',
      { forceStateful: true, messageBus: true },
    );
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, { n: 0n }, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    ).connect(signer);
    caller._registerResolvedExternal('ICallee', callee);

    for (let index = 0; index < 16; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, 'a'), vout: 1, satoshis: WALLET_SATS,
      });
    }
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    (provider as { addUtxo?: unknown }).addUtxo = undefined;

    const quote = calleeArtifact.abi.find((entry) => entry.name === 'quote');
    const ask = callerArtifact.abi.find((entry) => entry.name === 'ask');
    const layout = {
      quote: quote?.blockLayout,
      ask: ask?.blockLayout,
    };
    const built = await messageBus.compose({
      calls: [caller.call.ask(calleeInner.lockingBytecode, 7n), callee.call.quote(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();

    const walletLock = binToHex(signer.getLockingBytecode());
    const walletInputs = built.inputs.filter((input) => input.satoshis === WALLET_SATS
      && binToHex(input.unlocker.generateLockingBytecode()) === walletLock);
    expect(walletInputs.length, `no wallet funder was spent; layout ${JSON.stringify(layout)}`).toBeGreaterThan(0);
    const anyone = built.outputs.flatMap((output, index) => {
      const lock = output.to instanceof Uint8Array ? binToHex(output.to) : String(output.to);
      if (lock !== '51' || output.amount <= EVENT_CEILING) return [];
      return [`${index}:${output.amount}`];
    });
    expect(anyone, 'OP_TRUE output above the event ceiling').toEqual([]);
  }, 120_000);
});
