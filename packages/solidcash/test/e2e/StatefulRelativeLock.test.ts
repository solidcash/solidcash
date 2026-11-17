import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransaction } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { alicePkh, alicePriv, alicePub, bobAddress, bobPkh } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// `this.age` in a stateful function is OP_CHECKSEQUENCEVERIFY on the master input, so the call sets that input's
// nSequence with `setSequence`; the node then holds the spend until the master is old enough (BIP68).
const SRC = `pragma solidcash >=0.8.0;
contract Matured() {
  event Ticked(int count);
  int counter;
  function tick() {
    require(this.age >= 3);
    this.counter = this.counter + 1;
  }
  function payOut(bytes20 recipient) {
    require(this.age >= 2);
    this.counter = this.counter + 1;
    emit Ticked(this.counter);
    this.transfer(new LockingBytecodeP2PKH(recipient), 10000);
  }
}`;

const DEFAULT_SEQUENCE = 0xfffffffe;

const outcome = (send: Promise<unknown>): Promise<string> => send.then(
  () => 'accepted',
  (error: unknown) => String((error as Error)?.message ?? error),
);

async function deployMatured(): Promise<{ provider: MockNetworkProvider; contract: StatefulContract<any> }> {
  const provider = new MockNetworkProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo: Utxo = { txid: 'a7'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.addUtxo(p2pkh.address, fundingUtxo);
  const { contract } = await StatefulContract.deploy(compileString(SRC), [], {
    provider,
    fundingUtxo,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: { counter: 0n },
    changeAddress: p2pkh.address,
    initialBalance: 50_000n,
  });
  return { provider, contract };
}

/** Mine one block at a time until `send` is accepted; every refusal on the way must be the BIP68 relative lock. */
async function sendOnceMature(provider: MockNetworkProvider, send: () => Promise<unknown>): Promise<number> {
  let mined = 0;
  let result = await outcome(send());
  while (result !== 'accepted' && mined < 6) {
    expect(result).toMatch(/non-BIP68-final/);
    await provider.mine(1);
    mined++;
    result = await outcome(send());
  }
  expect(result).toBe('accepted');
  return mined;
}

describe('stateful this.age', () => {
  it('puts the sequence on the master input only, and spends once the master is 3 blocks deep', async () => {
    const { provider, contract } = await deployMatured();

    expect(() => contract.call.tick().setSequence(-1)).toThrow(/32-bit unsigned integer/);
    expect(() => contract.call.tick().setSequence(0x80000003)).toThrow(/disable flag/);

    const unsigned = await contract.call.tick().setSequence(3).buildUnsigned();
    const transaction = decodeTransaction(unsigned.transaction);
    if (typeof transaction === 'string') throw new Error(transaction);
    const masterIndex = unsigned.sourceOutputs.findIndex((output) => output.token?.nft?.capability === 'minting'
      && binToHex(output.token.category) === contract.categoryId);
    expect(masterIndex).toBeGreaterThanOrEqual(0);
    transaction.inputs.forEach((input, index) => {
      expect(input.sequenceNumber).toBe(index === masterIndex ? 3 : DEFAULT_SEQUENCE);
    });

    // The default sequence keeps the relative lock disabled, so the script's CHECKSEQUENCEVERIFY fails at any age.
    expect(await outcome(contract.call.tick().send())).toMatch(/OP_CHECKSEQUENCEVERIFY/);

    // With the sequence set, the script passes and the node refuses the spend until the master is mature.
    expect(await outcome(contract.call.tick().setSequence(3).send())).toMatch(/non-BIP68-final/);
    const mined = await sendOnceMature(provider, () => contract.call.tick().setSequence(3).send());
    // BIP68 counts the confirming block: a 3-block lock needs at least two more blocks after the deploy.
    expect(mined).toBeGreaterThanOrEqual(2);
    expect(((await contract.getState()) as { counter?: bigint }).counter).toBe(1n);
  });

  it('derives the later state, event and transfer of a function that checks this.age', async () => {
    const { provider, contract } = await deployMatured();
    expect(await provider.getUtxos(bobAddress)).toHaveLength(0);

    await sendOnceMature(provider, () => contract.call.payOut(bobPkh).setSequence(2).send());

    expect(((await contract.getState()) as { counter?: bigint }).counter).toBe(1n);
    const logs = await contract.queryFilter('Ticked');
    expect(logs.map((log) => log.args)).toEqual([{ count: 1n }]);
    expect((await provider.getUtxos(bobAddress)).map((utxo) => utxo.satoshis)).toEqual([10_000n]);
  });
});
