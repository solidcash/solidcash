import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { createFeeFunder, createTestProvider, expectScriptRejection } from '../../test-util.js';

describe('exact bounded additive recurrence security', () => {
  // About 85 s alone; the 120 s default left too little room under a full suite's load.
  it('authenticates scalar state, preserves checked source order, rejects tampering, and caps rank at 64', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(`event Seen(int value);
      contract C() {
        int total;
        int seed;
        function reset(int value, int initialDelta, pubkey pk, sig s) public {
          this.total = value;
          this.seed = initialDelta;
          require(checkSig(s, pk));
        }
        function exact(int limit, int increment) public {
          int delta = 0;
          delta = this.seed;
          for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
            this.total = this.total + delta;
            this.total = this.total + cursor / 2;
            delta = delta + increment;
            if (cursor == limit - 1) emit Seen(this.total);
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'exact'))
      .toMatchObject({ eligible: true });

    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0x9a00;
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
    const seen = async (limit: bigint, increment: bigint): Promise<bigint[]> => {
      const receipt = await (await contract.exact(limit, increment).send()).wait!();
      return receipt.events?.map((event) => event.args.value as bigint) ?? [];
    };

    await fund();
    await expect(contract.reset(10n, 2n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    await expect(seen(3n, 3n)).resolves.toEqual([26n]);

    const builder = await contract.exact(3n, 3n).build();
    const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
    builder.addInput(utxo, unlocker);
    const eventOutput = builder.outputs.find((output) => output.token?.nft?.capability === 'none');
    expect(eventOutput).toBeDefined();
    eventOutput!.token!.nft!.commitment = '0101';
    const raw = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
    const outcome = await provider.sendRawTransaction(raw)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 0);

    const maximum = (1n << 255n) - 1n;
    await fund();
    await expect(contract.reset(1n, maximum, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    await expect(contract.exact(1n, 0n).send()).rejects.toThrow();

    await fund();
    await expect(contract.reset(0n, 0n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    await expect(seen(64n, 0n)).resolves.toEqual([992n]);
    await expect(contract.exact(65n, 0n).build())
      .rejects.toThrow(/compiler-published maximum|64/i);
  }, 300_000);
});
