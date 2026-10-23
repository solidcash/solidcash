import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { HDSigner } from '../../../src/HDSigner.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import type { FramedFunctionCall } from '../../../src/framed/call/index.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';

/**
 * A read whose entry refuses.
 *
 * The contract keeps a mapping, and its view entry refuses a key the mapping does not hold. The view runs as a
 * local read: a key the constructor seeded resolves to the value the entry read, and a key it did not refuses —
 * the read rejects with the entry's own reason rather than resolving a default. The entry's body is dispatched
 * rather than inlined, so the reason the compiler publishes for the entry's own selector is what a caller reads.
 */

const CATEGORY_HEX = '99'.repeat(31) + '66';
const PHRASE = 'test test test test test test test test test test test junk';

const SEED_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x33));
const OTHER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x44));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   constructor(address owner) { this.balances[owner] = 1; }'
  + '   function deposit(address who, uint amount) returns (uint) {'
  + '     this.balances[who] = this.balances[who] + amount; require(amount <= 1000000); return this.balances[who]; }'
  + '   function balanceOf(address who) view returns (uint) {'
  + '     require(this.balances[who] > 0, "unknown account"); return this.balances[who]; }'
  + '   function guarded(address who) view returns (uint) {'
  + '     require(this.balances[who] > 0); return this.balances[who]; }'
  + ' }';

const ledger = compileStringMulti(SOURCE, { composition: 'framed' }).Ledger!;

/** The view entries the handle's call namespace exposes, as the class the framed path returns. */
interface LedgerCalls {
  readonly balanceOf: (who: Uint8Array) => FramedFunctionCall;
  readonly guarded: (who: Uint8Array) => FramedFunctionCall;
}

/** Deploys the contract through the shipped deployment, seeding one mapping key, and connects a signer. */
async function deployFresh(): Promise<LedgerCalls> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signer = HDSigner.fromPhrase(PHRASE, provider);
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(signer.getAddress(), fundingUtxo);
  const deployment = await deployStatefulContract(ledger, [SEED_LOCK], {
    provider, fundingUtxo, funder: signer.unlockP2PKH(), changeAddress: signer.getAddress(),
  });
  const handle = (deployment.contract as StatefulContract).connect(signer);
  return handle.call as unknown as LedgerCalls;
}

let deployed: Promise<LedgerCalls> | undefined;

/** One deployment serves every case: a read is local and changes nothing. */
function deploy(): Promise<LedgerCalls> {
  deployed ??= deployFresh();
  return deployed;
}

describe('a read whose entry refuses', () => {
  it('resolves the value the key the mapping holds names', async () => {
    const calls = await deploy();
    // The constructor seeded this key, so the entry's own guard accepts and its value is the answer.
    expect(await calls.balanceOf(SEED_LOCK)).toBe(1n);
  });

  it('rejects with the reason the artifact publishes for the entry, not a default value', async () => {
    const calls = await deploy();
    // The mapping holds no node for this key, so the entry's guard refuses it.
    let message = '';
    await calls.balanceOf(OTHER_LOCK).then(
      () => { throw new Error('the read resolved a value'); },
      (error: unknown) => { message = (error as Error).message; },
    );
    // The reason comes from the entry's own selector, whose debug metadata names the message. The refusal also
    // names the entry, so a caller can tell which read did not answer.
    expect(message).toContain('unknown account');
    expect(message).toContain('Ledger.balanceOf()');
  });

  it('reports a generic refusal naming the entry when the artifact publishes no message', async () => {
    const calls = await deploy();
    let message = '';
    await calls.guarded(OTHER_LOCK).then(
      () => { throw new Error('the read resolved a value'); },
      (error: unknown) => { message = (error as Error).message; },
    );
    // No message is published for a bare `require`, so the refusal is generic: it names the entry and the failing
    // source line rather than silently succeeding.
    expect(message).toContain('Ledger.guarded()');
    expect(message).toMatch(/at line \d+/);
    expect(message).not.toContain('unknown account');
  });
});
