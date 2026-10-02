import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import {
  buildValueChunkCommitment, encodeChunkableValueTail, encodePushdataValue,
  sha256, splitValueIntoValueChunks, type StateValue,
} from '@solidcash/utils';
import { compileFile } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Signer, getContractFactory, getEntryNftAddress, getValueChunkAddress, upgrades } from '../../src/index.js';
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import { deriveLogicalCreateAddress } from '../../src/stateful/logical-identity.js';
import type { ProxyContract } from '../../src/stateful/upgrades.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePub } from '../fixture/vars.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const OPTIONS = {
  solidityImportCompat: true,
  suppressWarnings: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 1_000_000,
} as const;

const names = ['UnicrowArbitrator', 'UnicrowClaim', 'Unicrow'] as const;
const artifacts = Object.fromEntries(names.map((name) => [
  name,
  compileFile(`../../examples/effectiveacceleration/contracts/unicrow/${name}.sol`, OPTIONS),
])) as Record<(typeof names)[number], ReturnType<typeof compileFile>>;

describe('real Unicrow proxy kernel arbitration callback', () => {
  const setup = async (): Promise<{
    arbitrator: ProxyContract; claim: ProxyContract; unicrow: ProxyContract;
  }> => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4d), provider);
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
    const arbitrator = await upgrades.deployProxy(getContractFactory(artifacts.UnicrowArbitrator, signer), {
      ...common, unicrow: identityLock('Unicrow'), unicrowClaim: identityLock('UnicrowClaim'),
    }, { initializer: false, implementationConstructorArgs: [
      identityLock('Unicrow'), identityLock('UnicrowClaim'),
    ] });
    const claim = await upgrades.deployProxy(getContractFactory(artifacts.UnicrowClaim, signer), {
      ...common, unicrow: identityLock('Unicrow'), unicrowArbitrator: identityLock('UnicrowArbitrator'),
    }, { initializer: false, implementationConstructorArgs: [
      identityLock('Unicrow'), identityLock('UnicrowArbitrator'), signer.getAddress(),
    ] });
    const unicrow = await upgrades.deployProxy(getContractFactory(artifacts.Unicrow, signer), {
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
      value: Record<string, StateValue>,
    ): Promise<void> => {
      const artifact = artifacts[name];
      const collection = artifact.stateLayout!.collections![0];
      const encoded = encodePushdataValue(value, collection.valueType!, artifact.structs);
      const slot = keyToSlot(bigIntToVmNumber(1n));
      const categoryId = owner.categoryId;
      const address = getEntryNftAddress(owner.inner, categoryId, collection.name);
      const commitments = [
        encodeEntryCommitment(new Uint8Array(32), slot, new Uint8Array(64)),
        encodeEntryCommitment(slot, new Uint8Array(32), encodeChunkableValueTail(encoded)),
      ];
      for (const [index, commitment] of commitments.entries()) await provider.addUtxo(address, {
        txid: categoryId, vout: 32 + index, satoshis: 10_000n,
        token: { category: categoryId, amount: 0n, nft: {
          capability: 'mutable', commitment: binToHex(commitment),
        } },
      });
      for (const [index, chunk] of splitValueIntoValueChunks(encoded).entries()) {
        await provider.addUtxo(getValueChunkAddress(
          owner.inner, categoryId, collection.name, slot, sha256(encoded),
        ), {
          txid: categoryId, vout: 34 + index, satoshis: 10_000n,
          token: { category: categoryId, amount: 0n, nft: {
            capability: 'mutable', commitment: buildValueChunkCommitment(index, chunk),
          } },
        });
      }
    };

    await seedEntry('UnicrowArbitrator', arbitrator.proxy, {
      arbitrator: signer.getAddress(), arbitratorFee: 0n,
      sellerConsensus: true, buyerConsensus: true, arbitrated: false,
    });
    const zeroAddress = new Uint8Array();
    await seedEntry('Unicrow', unicrow.proxy, {
      buyer: zeroAddress, challengeExtension: 0n, seller: zeroAddress,
      challengePeriodStart: 0n, marketplace: zeroAddress, marketplaceFee: 0n,
      challengePeriodEnd: 0n, currency: zeroAddress, claimed: 0n,
      consensus: [0n, 1n], split: [0n, 10_000n, 0n, 0n],
      amount: 0n, paymentReference: '',
    });

    arbitrator.implementation._registerResolvedExternal('Unicrow', unicrow);
    arbitrator.implementation._registerResolvedExternal('IUnicrowClaim', claim);
    claim.implementation._registerResolvedExternal('Unicrow', unicrow);
    claim.implementation._registerResolvedExternal('UnicrowArbitrator', arbitrator);
    unicrow.implementation._registerResolvedExternal('IUnicrowArbitrator', arbitrator);
    unicrow.implementation._registerResolvedExternal('IUnicrowClaim', claim);

    return { arbitrator, claim, unicrow };
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
});
