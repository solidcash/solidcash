import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createFeeFunder, createTestProvider, expectScriptRejection } from '../test-util.js';

describe('geometric scalar-state event recurrences', () => {
  it('authenticates a fixed pre-state factor, exact phases, tampering, and the 64-rank boundary', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        int factor;
        function reset(int value, int multiplier, pubkey pk, sig s) public {
          this.total = value;
          this.factor = multiplier;
          require(checkSig(s, pk));
        }
        function multiply(int limit) public {
          for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
            this.total = this.total * this.factor;
            if (cursor == limit - 1) { emit Phase(this.total); }
          }
          require(limit > 0 && limit <= 65);
        }
      }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'multiply'))
      .toMatchObject({ eligible: true });

    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x8d00;
    const uid = (): string => (++nonce).toString(16).padStart(64, '0');
    const deploymentUtxo = { txid: uid(), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funding.address, deploymentUtxo);
    const { contract } = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: deploymentUtxo,
      funder: funding.unlock.spend(alicePub, signature),
      initialState: {},
      changeAddress: funding.address,
    });
    const fund = async (): Promise<void> => {
      await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100_000n });
    };
    const phaseValues = async (pending: ReturnType<typeof contract.multiply>): Promise<bigint[]> => {
      const receipt = await (await pending.send()).wait!();
      return receipt.events?.map((event) => event.args.value as bigint) ?? [];
    };
    // `factor ** rank` would overflow here even though every original source multiplication remains exactly zero.
    await fund();
    const maximum = (1n << 255n) - 1n;
    await expect(contract.reset(0n, maximum, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    await expect(phaseValues(contract.multiply(3n))).resolves.toEqual([0n]);

    await fund();
    await expect(contract.reset(3n, 2n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    await expect(phaseValues(contract.multiply(3n))).resolves.toEqual([24n]);

    const builder = await contract.multiply(3n).build();
    const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
    builder.addInput(utxo, unlocker);
    const eventOutput = builder.outputs.find((output) => output.token?.nft?.capability === 'none');
    expect(eventOutput).toBeDefined();
    eventOutput!.token!.nft!.commitment = '0101';
    const raw = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
    const outcome = await provider.sendRawTransaction(raw)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 0);

    // The lowering only derives event arguments; it does not replace or weaken the source's checked multiply.
    await fund();
    await expect(contract.reset(maximum, 2n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    await expect(contract.multiply(3n).send()).rejects.toThrow();

    await fund();
    await expect(contract.reset(1n, 1n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    await expect(phaseValues(contract.multiply(64n))).resolves.toEqual([1n]);
    await expect(contract.multiply(65n).build())
      .rejects.toThrow(/compiler-published maximum|64/i);
  });
});
