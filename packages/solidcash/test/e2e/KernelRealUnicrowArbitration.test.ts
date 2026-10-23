import path from 'node:path';
import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildValueChunkCommitment, encodeChunkableValueTail, encodePushdataValue,
  sha256, splitValueIntoValueChunks, type StateValue,
} from '@solidcash/utils';
import { compileFile } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import {
  StatefulContract,
  getEntryNftAddress,
  getValueChunkAddress,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import { alicePub } from '../fixture/vars.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { effectiveAccelerationContractsRoot } from '../effectiveacceleration-corpus.js';

const OPTIONS = {
  evmCompat: true,
  suppressWarnings: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 1_000_000,
} as const;

const sources = ['UnicrowArbitrator', 'UnicrowClaim', 'Unicrow'] as const;
// The real Unicrow sources are the sibling checkout's own (see `effectiveacceleration-corpus.ts`), so the cases
// skip without it; compile lazily so a skipped run never touches the corpus.
const contractsRoot = effectiveAccelerationContractsRoot();
const compiled = new Map<(typeof sources)[number], ReturnType<typeof compileFile>>();
const artifactOf = (name: (typeof sources)[number]): ReturnType<typeof compileFile> => {
  const cached = compiled.get(name);
  if (cached !== undefined) return cached;
  const artifact = compileFile(path.join(contractsRoot!, 'unicrow', `${name}.sol`), OPTIONS);
  compiled.set(name, artifact);
  return artifact;
};

// Direct compiled artifacts isolate the source-level callback semantics; this is not a proxy-carrier proof.
describe.skipIf(contractsRoot === undefined)('real Unicrow kernel arbitration callback', () => {
  it('publishes the real arbitration, claim, and post-write getter edges', () => {
    const calls = (name: (typeof sources)[number], functionName: string): string[] | undefined => artifactOf(name).abi
      .find((entry) => entry.name === functionName)?.externalCalls?.map((call) => call.functionName);
    expect(calls('UnicrowArbitrator', 'arbitrate')).toEqual(['getEscrow', 'settle', 'claim']);
    expect(calls('UnicrowClaim', 'claim')).toContain('getArbitratorData');
    expect(artifactOf('UnicrowArbitrator').messageBus?.handlers.find((h) => h.name === 'arbitrate'))
      .toMatchObject({ eligible: true });
    expect(artifactOf('UnicrowClaim').messageBus?.handlers.find((h) => h.name === 'claim'))
      .toMatchObject({ eligible: true });
  });

  it.each([
    ['explicit composition', false],
    ['ordinary send', true],
  ] as const)('%s executes real arbitration through claim and reads the earlier arbitrated write', async (_mode, natural) => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4e), provider);
    for (let index = 0; index < 16; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }

    const ids = {
      UnicrowArbitrator: 'a1'.repeat(32),
      UnicrowClaim: 'b2'.repeat(32),
      Unicrow: 'c3'.repeat(32),
    };
    const bases = Object.fromEntries(sources.map((name) => [
      name, new Contract(artifactOf(name), [], { provider }).withCategory(hexToBin(ids[name])),
    ])) as Record<(typeof sources)[number], Contract>;

    const seedEntry = async (name: 'UnicrowArbitrator' | 'Unicrow', value: Record<string, StateValue>): Promise<void> => {
      const artifact = artifactOf(name);
      const contract = bases[name];
      const categoryId = ids[name];
      const collection = artifact.stateLayout!.collections![0];
      const encoded = encodePushdataValue(value, collection.valueType!, artifact.structs);
      const slot = keyToSlot(bigIntToVmNumber(1n));
      const address = getEntryNftAddress(contract, categoryId, collection.name);
      const commitments = [
        encodeEntryCommitment(new Uint8Array(32), slot, new Uint8Array(64)),
        encodeEntryCommitment(slot, new Uint8Array(32), encodeChunkableValueTail(encoded)),
      ];
      for (const [index, commitment] of commitments.entries()) {
        await provider.addUtxo(address, {
          txid: categoryId, vout: 32 + index, satoshis: 10_000n,
          token: { category: categoryId, amount: 0n, nft: {
            capability: 'mutable', commitment: binToHex(commitment),
          } },
        });
      }
      for (const [index, chunk] of splitValueIntoValueChunks(encoded).entries()) {
        await provider.addUtxo(getValueChunkAddress(contract, categoryId, collection.name, slot, sha256(encoded)), {
          txid: categoryId, vout: 34 + index, satoshis: 10_000n,
          token: { category: categoryId, amount: 0n, nft: {
            capability: 'mutable', commitment: buildValueChunkCommitment(index, chunk),
          } },
        });
      }
    };

    const common = { __block_timestamp: 100n, __blockOracleOwner: alicePub };
    for (const name of sources) {
      const initialState = name === 'UnicrowArbitrator'
        ? { ...common, unicrow: hexToBin(bases.Unicrow.lockingBytecode),
          unicrowClaim: hexToBin(bases.UnicrowClaim.lockingBytecode) }
        : name === 'UnicrowClaim'
          ? { ...common, unicrow: hexToBin(bases.Unicrow.lockingBytecode),
            unicrowArbitrator: hexToBin(bases.UnicrowArbitrator.lockingBytecode) }
          : { ...common, unicrowArbitrator: hexToBin(bases.UnicrowArbitrator.lockingBytecode),
            unicrowClaim: hexToBin(bases.UnicrowClaim.lockingBytecode) };
      try {
        await setupStatefulUtxos(provider, bases[name], {
          ...artifactOf(name).stateLayout!, collections: [],
        }, initialState, { categoryOverride: ids[name] });
      } catch (error) {
        throw new Error(`Cannot seed ${name}: ${String(error)}`);
      }
    }
    await seedEntry('UnicrowArbitrator', {
      arbitrator: signer.getAddress(), arbitratorFee: 0n,
      sellerConsensus: true, buyerConsensus: true, arbitrated: false,
    });
    const zeroAddress = new Uint8Array();
    await seedEntry('Unicrow', {
      buyer: zeroAddress, challengeExtension: 0n, seller: zeroAddress,
      challengePeriodStart: 0n, marketplace: zeroAddress, marketplaceFee: 0n,
      challengePeriodEnd: 0n, currency: zeroAddress, claimed: 0n,
      consensus: [0n, 1n], split: [0n, 10_000n, 0n, 0n],
      amount: 0n, paymentReference: '',
    });

    const arbitrator = StatefulContract.withCategory(bases.UnicrowArbitrator, ids.UnicrowArbitrator);
    const claim = StatefulContract.withCategory(bases.UnicrowClaim, ids.UnicrowClaim);
    const unicrow = StatefulContract.withCategory(bases.Unicrow, ids.Unicrow);
    arbitrator._registerResolvedExternal('Unicrow', unicrow);
    arbitrator._registerResolvedExternal('IUnicrowClaim', claim);
    claim._registerResolvedExternal('Unicrow', unicrow);
    claim._registerResolvedExternal('UnicrowArbitrator', arbitrator);
    unicrow._registerResolvedExternal('IUnicrowArbitrator', arbitrator);
    unicrow._registerResolvedExternal('IUnicrowClaim', claim);

    const callsite = (name: (typeof sources)[number], fn: string, target: string): number => {
      const id = artifactOf(name).abi.find((entry) => entry.name === fn)?.externalCalls
        ?.find((edge) => edge.functionName === target)?.callsiteId;
      if (id === undefined) throw new Error(`${name}.${fn} has no ${target} callsite`);
      return id;
    };
    const feeUtxo = (await provider.getUtxos(signer.getAddress()))[0]!;
    const receipt = natural
      ? await arbitrator.connect(signer).call.arbitrate(1n, [8_000n, 2_000n]).send()
      : await messageBus.compose({
        preparedCalls: [
          { contract: arbitrator, functionName: 'arbitrate', args: [1n, [8_000n, 2_000n]] },
          { contract: unicrow, functionName: 'getEscrow', args: [1n], parent: 0,
            callsiteId: callsite('UnicrowArbitrator', 'arbitrate', 'getEscrow') },
          { contract: unicrow, functionName: 'settle', args: [1n, [8_000n, 2_000n, 0n, 0n], [1n, 1n]],
            parent: 0, callsiteId: callsite('UnicrowArbitrator', 'arbitrate', 'settle') },
          { contract: claim, functionName: 'claim', args: [1n], parent: 0,
            callsiteId: callsite('UnicrowArbitrator', 'arbitrate', 'claim') },
          { contract: unicrow, functionName: 'getEscrow', args: [1n], parent: 3,
            callsiteId: callsite('UnicrowClaim', 'claim', 'getEscrow') },
          { contract: arbitrator, functionName: 'getArbitratorData', args: [1n], parent: 3,
            callsiteId: callsite('UnicrowClaim', 'claim', 'getArbitratorData') },
          { contract: arbitrator, functionName: 'arbitrationCalculation',
            args: [[8_000n, 2_000n, 0n, 0n, 0n]], parent: 3,
            callsiteId: callsite('UnicrowClaim', 'claim', 'arbitrationCalculation') },
          { contract: unicrow, functionName: 'setClaimed', args: [1n], parent: 3,
            callsiteId: callsite('UnicrowClaim', 'claim', 'setClaimed') },
        ],
        funder: { ...feeUtxo, unlocker: signer.unlockP2PKH() },
        changeAddress: signer.getAddress(),
      }).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    const arbitratorData = await arbitrator.getEntries('escrowArbitrator');
    expect(arbitratorData[0]?.value).toMatchObject({ arbitrated: true });
    const escrowData = await unicrow.getEntries('escrows');
    expect(escrowData[0]?.value).toMatchObject({ claimed: 1n, split: [8_000n, 2_000n, 0n, 0n] });
  }, 300_000);
});
