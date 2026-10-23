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

describe('loop-carried delta scalar-state event recurrences', () => {
  it('commits exact phases, rejects tampering, and leaves checked overflow in source execution', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(`event Phase(bigint value);
      contract C() {
        bigint total;
        function accumulate(int limit, bigint initialDelta, bigint increment, pubkey pk, sig s) public {
          bigint delta = initialDelta;
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            emit Phase(this.total);
            this.total = this.total + delta;
            emit Phase(this.total);
            delta = delta + increment;
          }
          require(checkSig(s, pk) && limit == 6);
        }
        function checkedOverflow(int initialDelta, int increment, pubkey pk, sig s) public {
          int delta = initialDelta;
          for (int cursor = 0; cursor < 2; cursor = cursor + 1) {
            delta = delta + increment;
            this.total = this.total + bigint(delta);
            emit Phase(this.total);
          }
          require(checkSig(s, pk));
        }
      }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'accumulate'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'checkedOverflow'))
      .toMatchObject({ eligible: true });

    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x8f00;
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
    const receipt = await (await contract.accumulate(6n, 2n, 3n, alicePub, signature).send()).wait!();
    expect(receipt.events?.map((event) => event.args.value)).toEqual([0n, 2n, 2n, 7n, 7n, 15n]);

    const builder = await contract.accumulate(6n, 2n, 3n, alicePub, signature).build();
    // Fund the large forged-event transaction past relay fees so rejection proves the script covenant.
    const { utxo, unlocker } = await createFeeFunder(provider, 100_000n);
    builder.addInput(utxo, unlocker);
    const eventOutput = builder.outputs.find((output) => output.token?.nft?.capability === 'none');
    expect(eventOutput).toBeDefined();
    eventOutput!.token!.nft!.commitment = '0101';
    const raw = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
    const outcome = await provider.sendRawTransaction(raw)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 0);

    // Repeated checked additions stay in range, but the old regrouped `rank * increment` projection overflows.
    // Exact replay must accept the source-valid call.
    const maximum = (1n << 255n) - 1n;
    await fund();
    const safeIncrement = (3n * maximum) / 4n;
    await expect(contract.checkedOverflow(-maximum, safeIncrement, alicePub, signature).send())
      .resolves.toBeDefined();

    // The exact fallback replays this bounded local without regrouping; the original checked update remains
    // on-chain and rejects on the same source operation.
    await fund();
    await expect(contract.checkedOverflow(maximum, 1n, alicePub, signature).send()).rejects.toThrow();
  });
});
