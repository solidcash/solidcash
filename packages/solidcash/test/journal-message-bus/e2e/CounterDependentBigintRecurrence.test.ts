import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../../test-util.js';

describe('counter-dependent bigint recurrence', () => {
  it('executes the authenticated source-order product and enforces the 64-rank bound', async () => {
    const provider = createTestProvider();
    const signature = new SignatureTemplate(alicePriv);
    const artifact = compileString(`event Observed(bigint value); event Mask(uint256 value);
      contract Product() {
        bigint product;
        uint256 mask;
        function reset(bigint next, pubkey key, sig proof) public {
          this.product = next;
          require(checkSig(proof, key));
        }
        function multiply(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.product = this.product * bigint(cursor + 1);
            emit Observed(this.product);
          }
          require(limit >= 1 && limit <= 131);
        }
        function multiplyAffine(int limit, bigint factor) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            factor = factor + 2;
            this.product = this.product * factor;
            emit Observed(this.product);
          }
          require(limit >= 1 && limit <= 131);
        }
        function divide(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.product = this.product / bigint(cursor + 1);
            emit Observed(this.product);
          }
          require(limit >= 1 && limit <= 131);
        }
        function divideBeforeZero(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.product = this.product / bigint(cursor - 5);
            emit Observed(this.product);
          }
          require(limit >= 1 && limit <= 131);
        }
        function remainder(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.product = this.product % bigint(cursor + 6);
            emit Observed(this.product);
          }
          require(limit >= 1 && limit <= 131);
        }
        function resetMask(uint256 next) public {
          this.mask = next;
          require(true);
        }
        function foldXor(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.mask = (this.mask ^ uint256(cursor + 1));
            emit Mask(this.mask);
          }
          require(limit >= 1 && limit <= 131);
        }
        function foldMixed(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.mask = (this.mask ^ uint256(cursor + 1));
            this.mask = (this.mask & uint256(cursor + 14));
            this.mask = (this.mask | uint256(cursor));
            emit Mask(this.mask);
          }
          require(limit >= 1 && limit <= 131);
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'multiplyAffine'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'foldXor'))
      .toMatchObject({ eligible: true });
    for (const name of ['divide', 'divideBeforeZero', 'remainder', 'foldMixed']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }

    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0xa300;
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
    await expect(contract.reset(2n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    const receipt = await (await contract.multiply(7n).send()).wait!();
    expect(receipt.events?.map((event) => event.args.value)).toEqual([4n, 16n, 96n]);

    await fund();
    await expect(contract.reset(2n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    const affineReceipt = await (await contract.multiplyAffine(7n, 1n).send()).wait!();
    expect(affineReceipt.events?.map((event) => event.args.value)).toEqual([6n, 30n, 210n]);

    await fund();
    await expect(contract.reset(1_000n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    const divideReceipt = await (await contract.divide(7n).send()).wait!();
    expect(divideReceipt.events?.map((event) => event.args.value)).toEqual([500n, 125n, 20n]);

    // Later materialized choices contain a zero divisor, but lazy rank selection must not execute them.
    await fund();
    await expect(contract.reset(100n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    const beforeZeroReceipt = await (await contract.divideBeforeZero(5n).send()).wait!();
    expect(beforeZeroReceipt.events?.map((event) => event.args.value)).toEqual([-25n, 12n]);

    await fund();
    await expect(contract.reset(100n, alicePub, signature).send()).resolves.toBeDefined();
    await fund();
    const remainderReceipt = await (await contract.remainder(7n).send()).wait!();
    expect(remainderReceipt.events?.map((event) => event.args.value)).toEqual([2n, 2n, 2n]);

    await fund();
    await expect(contract.resetMask(9n).send()).resolves.toBeDefined();
    await fund();
    const xorReceipt = await (await contract.foldXor(7n).send()).wait!();
    expect(xorReceipt.events?.map((event) => event.args.value)).toEqual([11n, 15n, 9n]);

    await fund();
    await expect(contract.resetMask(15n).send()).resolves.toBeDefined();
    await fund();
    const mixedReceipt = await (await contract.foldMixed(7n).send()).wait!();
    expect(mixedReceipt.events?.map((event) => event.args.value)).toEqual([13n, 3n, 5n]);

    // The source predicate permits this value, but its 65 logical ranks exceed the authenticated kernel bound.
    await expect(contract.multiply(130n).build()).rejects.toThrow(/compiler-published maximum|64/i);
  });
});
