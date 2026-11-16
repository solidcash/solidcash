/**
 * A called contract's call made once per turn of a loop whose number of turns the SDK cannot plan before building, on
 * the direct convention (A calls D, which calls T in a loop). A loop that may run no turn would leave T spent and
 * uncalled, and a looped call carries no caller edge D would count, so the call is refused by name.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { CallGuardUndecidedError, SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const SOURCE = `pragma solidcash ^0.51.0;
  interface IT { function set(int h, int c) external; }
  interface ID { function crowdedLoop(IT t) external; }
  contract T { int height; int clock; int calls;
    function set(int h, int c) external { height = h; clock = c; calls = calls + 1; } }
  contract D { int runs;
    function crowdedLoop(IT t) external {
      for (int i = 0; i < int(tx.inputs.length) - 1000; i++) { t.set(i, i); }
      runs = runs + 1;
    } }
  contract A { int runs;
    function crowdedLoop(ID d, IT t) external { d.crowdedLoop(t); runs = runs + 1; } }`;

const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, messageBus: false, primaryContractName: primary,
}) as never;

let serial = 0x7000;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

describe('a called contract\'s call in a loop the SDK cannot plan (A calls D, which calls T in a loop)', () => {
  it('refuses the call by name, before sending, rather than spend T for a loop that may not turn', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const deploy = async (primary: string): Promise<DeployResult<Artifact>> => {
      const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
      await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
      return StatefulContract.deploy(compileString(SOURCE, compileOptions(primary)), [] as never, {
        provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
      } as never);
    };
    const t = await deploy('T');
    const d = await deploy('D');
    const a = await deploy('A');
    const wallet = new Signer(alicePriv, provider);
    for (let coin = 0; coin < 8; coin += 1) {
      await provider.seedUtxo(wallet.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
    }
    (d.contract as unknown as { _registerResolvedExternal(name: string, contract: unknown): void })
      ._registerResolvedExternal('IT', t.contract);
    const [tLock, dLock] = [t, d].map((deployed) => addressToLockScript(deployed.contract.address));

    // Fewer than a thousand inputs: the loop turns no time, and D never calls T.
    let outcome: string;
    let error: unknown;
    try {
      await (a.contract.connect(wallet) as any).call.crowdedLoop(dLock, tLock).withExternalCall(d.contract).send();
      const state = (await t.contract.getState()) as { calls?: bigint };
      outcome = `sent; T calls ${state.calls ?? 0n}`;
    } catch (caught) {
      error = caught;
      outcome = `refused: ${(caught as Error).message}`;
    }
    expect(outcome).toMatch(/^refused: D\.crowdedLoop's call of IT\.set \(line \d+\) cannot be built: it runs once per /);
    expect(outcome).toContain('turn of a loop, and the SDK cannot tell before it builds the transaction whether the '
      + 'loop turns (the number of turns of its loop did not resolve). Spending T on a guess would let it run without '
      + 'being called when the loop does not turn.');
    expect(error).toBeInstanceOf(CallGuardUndecidedError);
    expect(((await t.contract.getState()) as { calls?: bigint }).calls ?? 0n).toBe(0n);
  });
});
