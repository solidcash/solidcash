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

describe('counter-alias scalar-state event recurrences', () => {
  it('commits exact non-unit source phases and rejects a forged alias-derived event', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        function accumulate(int limit, int offset, pubkey pk, sig s) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            emit Phase(this.total);
            int shifted = cursor + offset;
            int current = shifted * 2 + 1;
            this.total = this.total + current;
            emit Phase(this.total);
          }
          require(checkSig(s, pk) && limit == 6);
        }
      }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'accumulate'))
      .toMatchObject({ eligible: true });

    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x8e00;
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

    await fund();
    const receipt = await (await contract.accumulate(6n, 3n, alicePub, signature).send()).wait!();
    expect(receipt.events?.map((event) => event.args.value)).toEqual([0n, 9n, 9n, 22n, 22n, 39n]);

    const builder = await contract.accumulate(6n, 3n, alicePub, signature).build();
    const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
    builder.addInput(utxo, unlocker);
    const eventOutput = builder.outputs.find((output) => output.token?.nft?.capability === 'none');
    expect(eventOutput).toBeDefined();
    eventOutput!.token!.nft!.commitment = '0101';
    const raw = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
    const outcome = await provider.sendRawTransaction(raw)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 0);
  });
});
