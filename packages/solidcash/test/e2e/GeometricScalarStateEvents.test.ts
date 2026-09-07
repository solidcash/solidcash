import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

describe('geometric scalar-state event recurrences', () => {
  it('verifies exact source-phase commitments without exponentiation overflow assumptions', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        function reset(int value, pubkey pk, sig s) public {
          this.total = value;
          require(checkSig(s, pk));
        }
        function multiply(int limit, int factor, pubkey pk, sig s) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            emit Phase(this.total);
            this.total = this.total * factor;
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
    await expect(phaseValues(contract.multiply(6n, maximum, alicePub, signature)))
      .resolves.toEqual([0n, 0n, 0n, 0n, 0n, 0n]);

    await fund();
    await expect(contract.reset(3n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    await expect(phaseValues(contract.multiply(6n, 2n, alicePub, signature)))
      .resolves.toEqual([3n, 6n, 6n, 12n, 12n, 24n]);

    // The lowering only derives event arguments; it does not replace or weaken the source's checked multiply.
    await fund();
    await expect(contract.reset(maximum, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    await expect(contract.multiply(6n, 2n, alicePub, signature).send()).rejects.toThrow();
  });
});
