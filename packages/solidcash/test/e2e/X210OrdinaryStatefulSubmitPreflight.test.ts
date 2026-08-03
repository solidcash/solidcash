import { binToHex } from '@bitauth/libauth';
import { asmToBytecode } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract, SignatureTemplate, StatefulContract, TransactionBuilder, messageBus,
} from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { randomUtxo } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const provider = (): MockNetworkProvider =>
  new MockNetworkProvider({ policy: { enforceDust: false } });

async function builderFor(lockingBytecode: Uint8Array): Promise<TransactionBuilder> {
  const network = provider();
  const utxo = { ...randomUtxo({ satoshis: 20_000n }), txid: '21'.repeat(32), vout: 0 };
  await network.addUtxo(binToHex(lockingBytecode), utxo);
  const builder = new TransactionBuilder({ provider: network });
  builder.addInput(utxo, {
    generateUnlockingBytecode: () => new Uint8Array(),
    generateLockingBytecode: () => lockingBytecode,
  } as never);
  builder.addOutput({ to: Uint8Array.of(0x51), amount: 15_000n });
  return builder;
}

describe('X210 - the ordinary stateful submit path verifies finalized covenants by default', () => {
  it('accepts an honest finalized transaction', async () => {
    const builder = await builderFor(Uint8Array.of(0x51));
    const transaction = builder.buildLibauthTransaction(true);
    messageBus.assertFinalizedTransactionCovenants(builder, transaction);
    expect(transaction.inputs).toHaveLength(1);
    expect(transaction.outputs).toHaveLength(1);
    expect([...transaction.inputs[0].unlockingBytecode]).toEqual([]);
    expect([...transaction.outputs[0].lockingBytecode]).toEqual([0x51]);
  });

  it('refuses a raised VM failure at its input index', async () => {
    const builder = await builderFor(Uint8Array.of(0x00, 0x69));
    expect(() => messageBus.assertFinalizedTransactionCovenants(
      builder, builder.buildLibauthTransaction(true),
    )).toThrow('messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
  });

  it('refuses the non-raised falsy-top failure class', async () => {
    const builder = await builderFor(Uint8Array.of(0x00));
    expect(() => messageBus.assertFinalizedTransactionCovenants(
      builder, builder.buildLibauthTransaction(true),
    )).toThrow(
      'messageBus: BCH-2026 preflight failed at input 0: Unsuccessful evaluation: completed with a '
      + 'non-truthy value on top of the stack. Top stack item: "".',
    );
  });

  it('ordinary StatefulTransactionBuilder.send refuses a compiler-emitted falsy top before submission',
    async () => {
      const network = provider();
      const artifact = compileString(`pragma solidcash >=0.8.0;
        contract X210Guard(int brand) {
          int counter;
          function setIf(int v) public unsafe {
            require(v == brand);
          }
        }`, { forceStateful: true });
      expect(asmToBytecode(artifact.bytecode)).toContain(0x9c);
      const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
      const fundingUtxo = { ...randomUtxo({ satoshis: 100_000n }), txid: '22'.repeat(32), vout: 0 };
      await network.addUtxo(funder.address, fundingUtxo);
      const deployed = await StatefulContract.deploy(artifact, [77n], {
        provider: network,
        fundingUtxo,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: funder.address,
      });

      const submit = vi.spyOn(network, 'sendRawTransaction');
      submit.mockClear(); // deployment is outside the subject
      await expect(deployed.contract.call.setIf(76n).send()).rejects.toThrow(
        'messageBus: BCH-2026 preflight failed at input 0: Unsuccessful evaluation: completed with a '
        + 'non-truthy value on top of the stack. Top stack item: "".',
      );
      expect(submit).not.toHaveBeenCalled();
    }, 180_000);
});

async function deployRecursiveGuard(network: MockNetworkProvider): Promise<StatefulContract> {
  const artifact = compileString(`pragma solidcash >=0.8.0;
    contract X211RecursiveGuard(int brand) {
      int counter;
      function setIf(int v) public unsafe {
        if (v > brand) { setIf(v - 1); }
        require(v == brand);
        this.counter = v;
        require(this.counter == v);
      }
    }`, { forceStateful: true });
  expect(artifact.abi.find((fn) => fn.name === 'setIf')?.recursiveStateHandler).toBe(true);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const fundingUtxo = { ...randomUtxo({ satoshis: 100_000n }), txid: '23'.repeat(32), vout: 0 };
  await network.addUtxo(funder.address, fundingUtxo);
  return (await StatefulContract.deploy(artifact, [77n], {
    provider: network,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: { counter: 0n },
    changeAddress: funder.address,
  })).contract;
}

describe('X211 - the recursive opt-in preflight has its own hostile proof', () => {
  it('settles the honest recursive-opt-in invocation', async () => {
    const network = provider();
    const contract = await deployRecursiveGuard(network);
    const submit = vi.spyOn(network, 'sendRawTransaction');
    submit.mockClear();

    await expect(contract.call.setIf(77n).send()).resolves.toHaveProperty('txid');
    expect(submit).toHaveBeenCalledTimes(1);
  }, 180_000);

  it('refuses the one-field argument hostile at input 0 OP_VERIFY before submission', async () => {
    const network = provider();
    const contract = await deployRecursiveGuard(network);
    const submit = vi.spyOn(network, 'sendRawTransaction');
    submit.mockClear();

    // This differs from the honest control only in `v`: 77 -> 76. It remains fee- and dust-valid, reaches the
    // recursive ABI opt-in, and fails the first explicit require rather than a byte-policy gate.
    await expect(contract.call.setIf(76n).send()).rejects.toThrow(
      'Recursive state invocation failed concrete BCH VM preflight: input 0: '
      + 'Program failed an OP_VERIFY operation.',
    );
    expect(submit).not.toHaveBeenCalled();
  }, 180_000);
});
