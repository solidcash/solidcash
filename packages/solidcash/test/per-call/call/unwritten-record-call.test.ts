import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A call whose entry leaves one of its contract's records untouched.
 *
 * The call path declares every state record in each segment and leaves the end view for the derivation to learn. A
 * record the entry's code never writes has no write to learn from: its segment close requires it kept, and that
 * close compares the declaration with the view the segment started at, so the run learns the record kept and the
 * transaction writes back what it spent. `transfer` writes two balances as one sorted batch, the token shape, and
 * never touches `total`.
 */

const CATEGORY_HEX = '66'.repeat(32);
const CALLER_TXID = '99'.repeat(32);
const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const RECIPIENT_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x02));

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Ledger {'
  + '   uint total;'
  + '   mapping(address => uint) balances;'
  + '   constructor(address owner) { this.balances[owner] = 1000; this.total = 1000; }'
  + '   function transfer(address to, uint amount) {'
  + '     this.balances[msg.sender] = this.balances[msg.sender] - amount;'
  + '     this.balances[to] = this.balances[to] + amount;'
  + '   }'
  + '   function balanceOf(address who) view returns (uint) { return this.balances[who]; }'
  + ' }';

describe('a call whose entry leaves a record of its contract untouched', () => {
  it('settles with the untouched record written back as it was spent', async () => {
    const artifact = compileStringMulti(SOURCE, { composition: 'per-call' }).Ledger!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    const deployment = await deployStatefulContract(artifact, [CALLER_LOCK], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });
    const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
    await provider.addUtxo(binToHex(CALLER_LOCK), callerUtxo);
    // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
    await fundShippedFacets(provider);

    const result = await callPerCallEntry({
      provider, artifact, categoryId: deployment.categoryId, functionName: 'transfer',
      args: [RECIPIENT_LOCK, 5n], callerUtxo, callerLockingBytecode: CALLER_LOCK,
      funder: signature.unlockP2PKH(), vm: compositionMachine(),
    });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    // `total` is the contract's one data record: the only record whose commitment is the plain encoded 1000.
    const total = result.sourceOutputs.findIndex((output) => output.token?.nft !== undefined
      && binToHex(output.token.nft.commitment) === '02e803');
    expect(total).toBeGreaterThanOrEqual(0);
    expect(binToHex(result.transaction.outputs[total]!.token!.nft!.commitment)).toBe('02e803');
  });
});
