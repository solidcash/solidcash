import path from 'node:path';
import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import {
  buildValueChunkCommitment, encodeChunkableValueTail, encodePushdataValue,
  sha256, splitValueIntoValueChunks, type StateValue,
} from '@solidcash/utils';
import { compileFile } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { effectiveAccelerationContractsRoot } from '../effectiveacceleration-corpus.js';
import {
  getContractFactory,
  getEntryNftAddress,
  getValueChunkAddress,
  upgrades,
} from '../../src/stateful/index.js';
import { bytesToSlotValue, encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import { deriveLogicalCreateAddress } from '../../src/stateful/logical-identity.js';
import type { ProxyContract } from '../../src/stateful/upgrades.js';
import { addressToLockScript } from '../../src/utils.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { alicePub } from '../fixture/vars.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const OPTIONS = {
  evmCompat: true,
  suppressWarnings: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 1_000_000,
} as const;

const contractsRoot = effectiveAccelerationContractsRoot();
const names = ['UnicrowArbitrator', 'UnicrowClaim', 'Unicrow'] as const;
const compileArtifacts = (entryPoolCapacity?: number): Record<(typeof names)[number], ReturnType<typeof compileFile>> =>
  Object.fromEntries(names.map((name) => [
    name,
    compileFile(path.join(contractsRoot!, 'unicrow', `${name}.sol`), {
      ...OPTIONS,
      ...(entryPoolCapacity === undefined ? {} : { messageBusEntryPoolCapacity: entryPoolCapacity }),
    }),
  ])) as Record<(typeof names)[number], ReturnType<typeof compileFile>>;
let compiled: Record<(typeof names)[number], ReturnType<typeof compileFile>> | undefined;
// Compile lazily: a skipped run must not touch the corpus.
const artifacts = (): Record<(typeof names)[number], ReturnType<typeof compileFile>> => (compiled ??= compileArtifacts());

describe.skipIf(contractsRoot === undefined)('real Unicrow proxy kernel arbitration callback', () => {
  const setup = async (amounts: bigint[] = [], routeArtifacts = artifacts()): Promise<{
    arbitrator: ProxyContract; claim: ProxyContract; unicrow: ProxyContract;
    sellerLock: Uint8Array;
  }> => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4d), provider);
    const sellerLock = addressToLockScript(new Signer(new Uint8Array(32).fill(0x5d), provider).getAddress());
    for (let index = 0; index < 36; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });

    // Proxy deployment consumes one logical CREATE nonce per state owner. Predict all three identities so
    // immutable cross-references can be seeded at genesis without swapping a callee's runtime bytecode.
    const identities = Object.fromEntries(names.map((name, index) => [
      name, deriveLogicalCreateAddress(signer.getAddress(), index),
    ])) as Record<(typeof names)[number], string>;
    const identityLock = (name: (typeof names)[number]): Uint8Array => addressToLockScript(identities[name]);
    const common = { __block_timestamp: 100n, __blockOracleOwner: alicePub };
    const arbitrator = await upgrades.deployProxy(getContractFactory(routeArtifacts.UnicrowArbitrator, signer), {
      ...common, unicrow: identityLock('Unicrow'), unicrowClaim: identityLock('UnicrowClaim'),
    }, { initializer: false, implementationConstructorArgs: [
      identityLock('Unicrow'), identityLock('UnicrowClaim'),
    ] });
    const claim = await upgrades.deployProxy(getContractFactory(routeArtifacts.UnicrowClaim, signer), {
      ...common, unicrow: identityLock('Unicrow'), unicrowArbitrator: identityLock('UnicrowArbitrator'),
    }, { initializer: false, implementationConstructorArgs: [
      identityLock('Unicrow'), identityLock('UnicrowArbitrator'), signer.getAddress(),
    ] });
    const unicrow = await upgrades.deployProxy(getContractFactory(routeArtifacts.Unicrow, signer), {
      ...common, unicrowArbitrator: identityLock('UnicrowArbitrator'),
      unicrowClaim: identityLock('UnicrowClaim'),
    }, { initializer: false, implementationConstructorArgs: [
      identityLock('UnicrowClaim'), identityLock('UnicrowArbitrator'), signer.getAddress(),
      signer.getAddress(), 0n,
    ] });
    expect([arbitrator.address, claim.address, unicrow.address]).toEqual(names.map((name) => identities[name]));

    const seedEntry = async (
      name: 'UnicrowArbitrator' | 'Unicrow',
      owner: typeof arbitrator.proxy,
      values: readonly Record<string, StateValue>[],
    ): Promise<void> => {
      const artifact = routeArtifacts[name];
      const collection = artifact.stateLayout!.collections![0];
      const categoryId = owner.categoryId;
      const address = getEntryNftAddress(owner.inner, categoryId, collection.name);
      const entries = values.map((value, index) => ({
        slot: keyToSlot(bigIntToVmNumber(BigInt(index + 1))),
        encoded: encodePushdataValue(value, collection.valueType!, artifact.structs),
      })).sort((left, right) => {
        const a = bytesToSlotValue(left.slot);
        const b = bytesToSlotValue(right.slot);
        return a < b ? -1 : a > b ? 1 : 0;
      });
      const zeroSlot = new Uint8Array(32);
      const commitments = [
        encodeEntryCommitment(zeroSlot, entries[0]!.slot, new Uint8Array(64)),
        ...entries.map((entry, index) => encodeEntryCommitment(
          entry.slot, entries[index + 1]?.slot ?? zeroSlot, encodeChunkableValueTail(entry.encoded),
        )),
      ];
      for (const [index, commitment] of commitments.entries()) await provider.addUtxo(address, {
        txid: categoryId, vout: 32 + index, satoshis: 10_000n,
        token: { category: categoryId, amount: 0n, nft: {
          capability: 'mutable', commitment: binToHex(commitment),
        } },
      });
      let vout = 32 + commitments.length;
      for (const entry of entries) {
        for (const [index, chunk] of splitValueIntoValueChunks(entry.encoded).entries()) {
          await provider.addUtxo(getValueChunkAddress(
            owner.inner, categoryId, collection.name, entry.slot, sha256(entry.encoded),
          ), {
            txid: categoryId, vout, satoshis: 10_000n,
            token: { category: categoryId, amount: 0n, nft: {
              capability: 'mutable', commitment: buildValueChunkCommitment(index, chunk),
            } },
          });
          vout += 1;
        }
      }
    };

    if (amounts.length === 0) amounts = [0n];
    await seedEntry('UnicrowArbitrator', arbitrator.proxy, amounts.map(() => ({
      arbitrator: signer.getAddress(), arbitratorFee: 0n,
      sellerConsensus: true, buyerConsensus: true, arbitrated: false,
    })));
    const zeroAddress = new Uint8Array();
    await seedEntry('Unicrow', unicrow.proxy, amounts.map((escrowAmount) => ({
      buyer: zeroAddress, challengeExtension: 0n,
      seller: escrowAmount > 0n ? sellerLock : zeroAddress,
      challengePeriodStart: 0n, marketplace: zeroAddress, marketplaceFee: 0n,
      challengePeriodEnd: 0n, currency: zeroAddress, claimed: 0n,
      consensus: [0n, 1n], split: [0n, 10_000n, 0n, 0n],
      amount: escrowAmount, paymentReference: '',
    })));
    if (amounts.some((escrowAmount) => escrowAmount > 0n)) await provider.addUtxo(getSatoshiContainerAddress(
      unicrow.proxy.inner, unicrow.proxy.categoryId,
    ), { txid: 'fb'.repeat(32), vout: 0, satoshis: 30_000n });

    arbitrator.implementation._registerResolvedExternal('Unicrow', unicrow);
    arbitrator.implementation._registerResolvedExternal('IUnicrowClaim', claim);
    claim.implementation._registerResolvedExternal('Unicrow', unicrow);
    claim.implementation._registerResolvedExternal('UnicrowArbitrator', arbitrator);
    unicrow.implementation._registerResolvedExternal('IUnicrowArbitrator', arbitrator);
    unicrow.implementation._registerResolvedExternal('IUnicrowClaim', claim);

    return { arbitrator, claim, unicrow, sellerLock };
  };

  it('forwards arbitration through three proxy state owners and reads the earlier arbitrated write', async () => {
    const { arbitrator, unicrow } = await setup();
    const receipt = await arbitrator.forward('arbitrate', [1n, [8_000n, 2_000n]]).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await arbitrator.proxy.getEntries('escrowArbitrator'))[0]?.value)
      .toMatchObject({ arbitrated: true });
    expect((await unicrow.proxy.getEntries('escrows'))[0]?.value)
      .toMatchObject({ claimed: 1n, split: [8_000n, 2_000n, 0n, 0n] });
  }, 300_000);

  it('claims one real escrow through the nested proxy kernel route', async () => {
    const { claim, unicrow } = await setup();
    const receipt = await claim.forward('claimMultiple', [[1n]]).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await unicrow.proxy.getEntries('escrows'))[0]?.value).toMatchObject({ claimed: 1n });
  }, 300_000);

  it('pays a funded real escrow through the nested proxy kernel route', async () => {
    const { claim, sellerLock } = await setup([1_000n]);
    const receipt = await claim.forward('claimMultiple', [[1n]]).send();
    expect(receipt.outputs.some((output) => output.valueSatoshis === 1_000n
      && binToHex(output.lockingBytecode) === binToHex(sellerLock))).toBe(true);
  }, 300_000);

  it('pays two funded real escrows through repeated nested proxy kernel rows', async () => {
    const { claim, unicrow, sellerLock } = await setup([1_000n, 2_000n]);
    const receipt = await claim.forward('claimMultiple', [[1n, 2n]]).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect(receipt.outputs.filter((output) =>
      binToHex(output.lockingBytecode) === binToHex(sellerLock))
      .map((output) => output.valueSatoshis).sort((left, right) => (
        left < right ? -1 : left > right ? 1 : 0
      ))).toEqual([1_000n, 2_000n]);
    const escrows = await unicrow.proxy.getEntries('escrows');
    expect(escrows).toHaveLength(2);
    expect(escrows.every((entry) => (entry.value as { claimed: bigint }).claimed === 1n)).toBe(true);
  }, 300_000);

  it('pays three funded real escrows through repeated nested proxy kernel rows', async () => {
    const { claim, unicrow, sellerLock } = await setup([1_000n, 2_000n, 3_000n]);
    const receipt = await claim.forward('claimMultiple', [[1n, 2n, 3n]]).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect(receipt.outputs.filter((output) =>
      binToHex(output.lockingBytecode) === binToHex(sellerLock))
      .map((output) => output.valueSatoshis).sort((left, right) => (
        left < right ? -1 : left > right ? 1 : 0
      ))).toEqual([1_000n, 2_000n, 3_000n]);
    const escrows = await unicrow.proxy.getEntries('escrows');
    expect(escrows).toHaveLength(3);
    expect(escrows.every((entry) => (entry.value as { claimed: bigint }).claimed === 1n)).toBe(true);
  }, 300_000);

  it('pays seven distinct real escrows past the legacy graph invocation ceiling', async () => {
    const escrowIds = Array.from({ length: 7 }, (_unused, index) => BigInt(index + 1));
    const { claim, unicrow, sellerLock } = await setup(escrowIds.map(() => 1_000n));
    const receipt = await claim.forward('claimMultiple', [escrowIds]).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect(receipt.outputs.filter((output) =>
      binToHex(output.lockingBytecode) === binToHex(sellerLock)
      && output.valueSatoshis === 1_000n)).toHaveLength(escrowIds.length);
    const escrows = await unicrow.proxy.getEntries('escrows');
    expect(escrows).toHaveLength(escrowIds.length);
    expect(escrows.every((entry) => (entry.value as { claimed: bigint }).claimed === 1n)).toBe(true);
  }, 300_000);

  it('pays nine distinct real escrows with nine authenticated entry lanes', async () => {
    const escrowIds = Array.from({ length: 9 }, (_unused, index) => BigInt(index + 1));
    const { claim, unicrow, sellerLock } = await setup(escrowIds.map(() => 1_000n), compileArtifacts(9));
    const receipt = await claim.forward('claimMultiple', [escrowIds]).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect(receipt.outputs.filter((output) =>
      binToHex(output.lockingBytecode) === binToHex(sellerLock)
      && output.valueSatoshis === 1_000n)).toHaveLength(escrowIds.length);
    const escrows = await unicrow.proxy.getEntries('escrows');
    expect(escrows).toHaveLength(escrowIds.length);
    expect(escrows.every((entry) => (entry.value as { claimed: bigint }).claimed === 1n)).toBe(true);
  }, 600_000);
});
