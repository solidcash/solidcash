import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * S0 conformance, spec section 23 row 14: two events in one transaction.
 *
 * A contract's one entry emits two events, each a token NFT at its own event covenant in the transaction's trailing
 * region. The transaction is driven through the shipped path: the shipped compiler compiles the source for the
 * framed convention, the shipped deploy publishes it, and `callFramedEntry` enters the entry from a user's coin,
 * derives the composition and asks the shipped machine. The two logs are read back with the shipped receipt
 * (`compositionEventLogs`), which decodes each commitment with the artifact's own event ABI, so both events are
 * asserted against the arguments the entry emitted rather than against a re-encoded payload.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   event Credited(int account, int amount);'
  + '   event Debited(int account);'
  + '   int public balance;'
  + '   function post(int account, int amount) {'
  + '     this.balance = this.balance + amount;'
  + '     emit Credited(account, amount);'
  + '     emit Debited(account);'
  + '     require(true);'
  + '   }'
  + '   function idle() { require(true); }'
  + ' }';

/** A 32-byte outpoint hash whose bytes are not all the same. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

describe('spec section 23 row 14: two events in one transaction', () => {
  it('emits two events from one entry and reads both decoded logs back', async () => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never)
      .Ledger!;

    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);

    const deployment = await deployStatefulContract(artifact, [], {
      provider,
      fundingUtxo,
      funder: funder.unlock.spend(alicePub, signature),
      changeAddress: funder.address,
    });

    const user = encodeLockingBytecodeP2pkh(alicePkh);
    const callerUtxo = { txid: outpointHash(0x51), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(binToHex(user), callerUtxo);

    const answered = await callFramedEntry({
      provider,
      artifact,
      categoryId: deployment.categoryId,
      functionName: 'post',
      args: [7n, 500n],
      callerUtxo,
      callerLockingBytecode: user,
      funder: signature.unlockP2PKH(),
      vm: compositionMachine(),
    });

    // Every participant the shipped machine was asked about accepted the derived transaction, so it broadcast.
    expect(answered.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`)).toStrictEqual([]);
    expect(answered.accepted).toBe(true);
    expect(answered.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The shipped receipt reads the two declared event outputs back, each with its own decoded fields.
    const logs = compositionEventLogs(answered.draft, [artifact]);
    expect(logs.map((log) => ({
      eventName: log.eventName,
      eventSignature: log.eventSignature,
      values: log.values,
      args: log.args,
    }))).toStrictEqual([
      {
        eventName: 'Credited',
        eventSignature: artifact.events![0]!.signature,
        values: [7n, 500n],
        args: { account: 7n, amount: 500n },
      },
      {
        eventName: 'Debited',
        eventSignature: artifact.events![1]!.signature,
        values: [7n],
        args: { account: 7n },
      },
    ]);
    // Both logs sit at distinct event outputs of the one transaction, in emit order.
    expect(logs).toHaveLength(2);
    expect(logs[0]!.outputIndex).not.toBe(logs[1]!.outputIndex);
  }, 120_000);
});
