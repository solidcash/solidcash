import { describe, expect, it } from 'vitest';
import { Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const relaxedLimits = {
  maximumInputBytes: 100_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800,
  hashDigestIterationsPerByte: 3,
};

describe('observer-less provider VM cache', () => {
  it('reuses the factory VM and evaluates a real P2PKH spend', async () => {
    const provider = new MockNetworkProvider({
      consensusLimits: relaxedLimits, policy: { enforceDust: false },
    });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const utxo = randomUtxo({ satoshis: 20_000n });
    await provider.addUtxo(p2pkh.address, utxo);
    const builder = new TransactionBuilder({ provider });
    builder.addInput(utxo, p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
    builder.addOutput({ to: p2pkh.address, amount: 15_000n });
    const program = {
      inputIndex: 0,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    };

    const first = createVirtualMachineBch2026ForProvider(provider);
    const second = createVirtualMachineBch2026ForProvider(provider);
    expect(second).toBe(first);
    expect(first.stateSuccess(first.evaluate(program))).toBe(true);
    expect(second.stateSuccess(second.evaluate(program))).toBe(true);

    const observed = createVirtualMachineBch2026ForProvider(provider, {
      opcodes: new Set([0x87]),
      beforeOperation: (): void => {},
    });
    expect(observed).not.toBe(first);
    expect(observed.stateSuccess(observed.evaluate(program))).toBe(true);
  });
});
