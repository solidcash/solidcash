/**
 * C3 on a count-path message-bus route (docs/security/SECURITY-AUDIT.md C3).
 *
 * The route admits one handler, which writes a scalar, so it holds its data band and the own-category mutable count.
 * A standalone `batch` runs it with no verifier. Beside it, an entry of a collection no admitted handler names is
 * co-spent through the entry covenant's write flag, which only asks for the master: the entry is rewritten in place,
 * or destroyed while a mutable NFT of the category appears at another lock. Both keep the count balanced. The route
 * now pins every own-category mutable input outside its data band at its own index, except the one at its verifier
 * index, whose covenant recreates it with a new commitment. An honest batch, and an honest compose that co-spends that
 * verifier, settle.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, scriptToBytecode,
} from '@solidcash/utils';
import { Contract, type TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import {
  addressToLockScript, generateLibauthSourceOutputs, solidCashOutputToLibauthOutput,
} from '../../src/utils.js';
import {
  directConventionMasterLock, getEntryNftAddress, getMessageBusVerifierLockingBytecode, resolveCollectionSignature,
} from '../../src/stateful/covenant-helpers.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const BUS = `contract BusLedger() {
  int public count;
  mapping(int => int) public side;
  function tick() public { this.count = this.count + 1; require(true); }
  function put(int key, int value) public { this.side[key] = value; require(true); }
}`;

// A second participant so the atomic envelope clears its 256-byte minimum, as in the kernel composition suites.
const DRIVER = `interface IBusLedger { function tick(); }
contract BusDriver(address bus) {
  function poke() public { IBusLedger(bus).tick(); require(true); }
}`;

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;
type LibauthOutput = LibauthTransaction['outputs'][number];
type Vm = ReturnType<typeof createVirtualMachineBch2026ForProvider>;

interface Spend {
  readonly transaction: LibauthTransaction;
  readonly sourceOutputs: LibauthOutput[];
}

interface Victim {
  readonly txid: string;
  readonly vout: number;
  readonly source: LibauthOutput;
  readonly redeem: Uint8Array;
}

const OTHER_LOCK = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x66), 0x88, 0xac);

function spendOf(builder: TransactionBuilder): Spend {
  return {
    transaction: builder.buildLibauthTransaction(),
    sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
  };
}

function verdict(vm: Vm, spend: Spend, inputIndex: number): true | string {
  const state = vm.evaluate({ inputIndex, transaction: spend.transaction, sourceOutputs: spend.sourceOutputs });
  const result = vm.stateSuccess(state);
  return result === true ? true : `${result}`;
}

function failures(vm: Vm, spend: Spend): Array<{ inputIndex: number; error: string }> {
  return spend.transaction.inputs.flatMap((_input, inputIndex) => {
    const result = verdict(vm, spend, inputIndex);
    return result === true ? [] : [{ inputIndex, error: result }];
  });
}

/** The victim at the next input index through the entry write flag, `atVictim` at its index, `extra` after all. */
function beside(
  honest: Spend, victim: Victim, master: number, atVictim: LibauthOutput, extra: readonly LibauthOutput[] = [],
): Spend {
  const at = honest.transaction.inputs.length;
  const outputs = [...honest.transaction.outputs];
  while (outputs.length < at) outputs.push({ lockingBytecode: OTHER_LOCK, valueSatoshis: 1_000n });
  outputs.splice(at, 0, atVictim);
  const unlockingBytecode = Uint8Array.from([
    ...encodeDataPush(encodeIntegerValue(BigInt(master))),
    ...encodeDataPush(encodeIntegerValue(1n)),
    ...encodeDataPush(victim.redeem),
  ]);
  return {
    sourceOutputs: [...honest.sourceOutputs, victim.source],
    transaction: {
      ...honest.transaction,
      inputs: [...honest.transaction.inputs, {
        outpointIndex: victim.vout, outpointTransactionHash: hexToBin(victim.txid),
        sequenceNumber: 0xffffffff, unlockingBytecode,
      }],
      outputs: [...outputs, ...extra],
    },
  };
}

describe('C3 count-path route: an own-category record the route does not name is pinned at its index', () => {
  it('settles an honest batch and compose, and refuses a rewritten or destroyed unnamed entry', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const busArtifact = compileString(BUS, { ...KERNEL, messageBusHandlers: ['tick'] });
    const driverArtifact = compileString(DRIVER, KERNEL);
    expect(busArtifact.messageBus?.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['tick']);
    expect(busArtifact.messageBus?.route.inputs.some((input) => input.name === '__internal__activeVerifierIndex'))
      .toBe(true);

    const connect = async (
      artifact: typeof busArtifact, args: readonly unknown[], initialState: Record<string, unknown>,
    ): Promise<{ contract: StatefulContract; categoryId: string }> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, initialState, { saltContract: true },
      );
      return {
        contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
        categoryId: setup.categoryId,
      };
    };
    const { contract: bus, categoryId } = await connect(busArtifact, [], { count: 0n });
    const { contract: driver } = await connect(driverArtifact, [hexToBin(bus.inner.lockingBytecode)], {});
    await bus.call.put(5n, 7n).send();

    // An entry of `side`, which the route's only handler never names.
    const collectionHash = computeCollectionHash(resolveCollectionSignature(busArtifact, 'side'));
    const redeem = scriptToBytecode(buildEntryNftCovenantScript(
      hexToBin(categoryId), collectionHash, directConventionMasterLock(bus.inner),
    ));
    const entryAddress = getEntryNftAddress(bus.inner, categoryId, 'side');
    const entryLock = addressToLockScript(entryAddress);
    expect(binToHex(encodeLockingBytecodeP2sh32(hash256(redeem)))).toBe(binToHex(entryLock));
    const entries = (await provider.getUtxos(entryAddress))
      .filter((utxo) => utxo.token?.nft?.capability === 'mutable');
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries[entries.length - 1]!;
    const victim: Victim = {
      txid: entry.txid, vout: entry.vout, redeem,
      source: solidCashOutputToLibauthOutput({ to: entryLock, amount: entry.satoshis, token: entry.token }),
    };
    const vm = createVirtualMachineBch2026ForProvider(provider);

    // 1. Honest standalone batch: the route runs with no verifier.
    const call = bus.batch([{ function: 'tick', args: [] }]);
    const honest = spendOf(await call.build());
    expect(failures(vm, honest), 'honest batch').toEqual([]);
    const master = honest.sourceOutputs.findIndex((output) => output.token?.nft?.capability === 'minting'
      && binToHex(output.token.category) === binToHex(victim.source.token!.category));
    expect(master).toBeGreaterThanOrEqual(0);
    const at = honest.transaction.inputs.length;

    // 2. The entry comes back at its own index and lock with another commitment.
    const commitment = victim.source.token!.nft!.commitment;
    const forged = Uint8Array.from(commitment);
    forged[forged.length - 1] ^= 1;
    const rewrite = beside(honest, victim, master, {
      ...victim.source, token: { ...victim.source.token!, nft: { capability: 'mutable', commitment: forged } },
    });
    expect(verdict(vm, rewrite, at), 'the entry write flag accepts the rewrite').toBe(true);
    expect.soft(verdict(vm, rewrite, master), 'the route refuses the rewrite').not.toBe(true);

    // 3. The entry is destroyed and a mutable NFT of the category is re-emitted at another lock.
    const destroy = beside(honest, victim, master, {
      lockingBytecode: OTHER_LOCK, valueSatoshis: victim.source.valueSatoshis,
    }, [{ ...victim.source, lockingBytecode: OTHER_LOCK }]);
    expect(verdict(vm, destroy, at), 'the entry write flag accepts the burn').toBe(true);
    expect.soft(verdict(vm, destroy, master), 'the route refuses the burn').not.toBe(true);

    await call.send();
    expect((await bus.getState()).count).toBe(1n);

    // 4. Honest compose: the bus route runs beside its own verifier, which comes back with a new commitment.
    const funder = await createBareP2pkhFeeFunder(provider, 2_000_000n);
    const composed = await messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'poke', args: [] },
        { contract: bus, functionName: 'tick', args: [] },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    const composeSpend = spendOf(composed);
    const verifierLock = binToHex(getMessageBusVerifierLockingBytecode(bus.inner, categoryId));
    const verifierAt = composeSpend.sourceOutputs.findIndex((output) =>
      binToHex(output.lockingBytecode) === verifierLock && output.token?.nft?.capability === 'mutable');
    expect(verifierAt, 'compose co-spends the bus verifier').toBeGreaterThanOrEqual(0);
    expect(binToHex(composeSpend.transaction.outputs[verifierAt]!.token!.nft!.commitment))
      .not.toBe(binToHex(composeSpend.sourceOutputs[verifierAt]!.token!.nft!.commitment));
    expect(failures(vm, composeSpend), 'honest compose').toEqual([]);
    await expect(provider.sendRawTransaction(composed.build())).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect((await bus.getState()).count).toBe(2n);
  }, 300_000);
});
