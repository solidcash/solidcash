import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../../test-util.js';

describe('literal-bound source-loop escape domains', () => {
  it('executes while and do-while selected ranks through the kernel row loop', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(`contract LiteralDomain() {
      mapping(int => int) values;
      mapping(int => int) other;
      function fromWhile(bool skip, bool stop) public {
        int cursor = 0;
        while (cursor < (2 + 3)) {
          if (skip && cursor == 1) { cursor = cursor + 1; continue; }
          this.values[cursor] = cursor + 10;
          if (stop && cursor == 3) break;
          cursor = cursor + 1;
        }
        require(true);
      }
      function fromDoWhile(bool stop) public {
        int cursor = 1;
        do {
          this.other[cursor] = cursor + 20;
          if (stop && cursor == 3) break;
          cursor = cursor + 2;
        } while (cursor < (1 + 6));
        require(true);
      }
      function checkValue(int key, int expected, pubkey pk, sig proof) public {
        require(checkSig(proof, pk));
        require(this.values[key] == expected);
      }
      function checkOther(int key, int expected, pubkey pk, sig proof) public {
        require(checkSig(proof, pk));
        require(this.other[key] == expected);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });
    for (const name of ['fromWhile', 'fromDoWhile']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }

    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0xa500;
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
    await expect(contract.batch([{ function: 'fromWhile', args: [true, true] }]).send())
      .resolves.toBeDefined();
    for (const [key, value] of [[0n, 10n], [2n, 12n], [3n, 13n]] as const) {
      await fund();
      await expect(contract.call.checkValue(key, value, alicePub, signature).send()).resolves.toBeDefined();
    }

    await fund();
    await expect(contract.batch([{ function: 'fromDoWhile', args: [true] }]).send())
      .resolves.toBeDefined();
    for (const [key, value] of [[1n, 21n], [3n, 23n]] as const) {
      await fund();
      await expect(contract.call.checkOther(key, value, alicePub, signature).send()).resolves.toBeDefined();
    }
  }, 120_000);
});
