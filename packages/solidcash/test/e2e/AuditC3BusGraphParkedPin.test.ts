/**
 * C3 beside a graph-context message-bus route (docs/security/SECURITY-AUDIT.md C3).
 *
 * A graph route always runs its verifier binder, so its C3 record pin skips the verifier by index, and the contract's
 * direct entries share that pin's parked helper with no input exempt: a pinned count, and a census walk.
 * Beside a direct `tick` (a pinned count) and a direct `put` (a census walk), a `side` entry outside the block is
 * co-spent through the entry covenant's write flag, which only asks for the master: it is rewritten in place, or
 * destroyed while its NFT reappears at its own lock at another index. Each spend is accepted by the entry covenant
 * and refused by the master. The honest calls settle.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, scriptToBytecode,
} from '@solidcash/utils';
import { Contract, type TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import {
  addressToLockScript, generateLibauthSourceOutputs, solidCashOutputToLibauthOutput,
} from '../../src/utils.js';
import {
  directConventionMasterLock, getEntryNftAddress, resolveCollectionSignature,
} from '../../src/stateful/covenant-helpers.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const LEDGER = `contract GraphLedger() {
  int public count;
  mapping(int => int) public side;
  function tick() public { this.count = this.count + 1; require(true); }
  function put(int key, int value) public { this.side[key] = value; require(true); }
}`;

const GRAPH = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
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

describe('C3 beside a graph route: the parked record pin holds each own-category record past the block', () => {
  it('settles honest direct calls and refuses a rewritten or moved entry beside them', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(LEDGER, { ...GRAPH, messageBusHandlers: ['tick'] });
    const routeInputs = artifact.messageBus!.route.inputs.map((input) => input.name);
    expect(routeInputs).toContain('__internal__activeVerifierIndex');
    expect(routeInputs).toContain('__internal__graphFixedSize');

    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, { count: 0n }, { saltContract: true });
    const categoryId = setup.categoryId;
    const bus = StatefulContract.withCategory(base.withCategory(hexToBin(categoryId)), categoryId);
    await bus.call.put(5n, 7n).send();
    await bus.call.put(9n, 1n).send();

    const collectionHash = computeCollectionHash(resolveCollectionSignature(artifact, 'side'));
    const redeem = scriptToBytecode(buildEntryNftCovenantScript(
      hexToBin(categoryId), collectionHash, directConventionMasterLock(bus.inner),
    ));
    const entryAddress = getEntryNftAddress(bus.inner, categoryId, 'side');
    const entryLock = addressToLockScript(entryAddress);
    expect(binToHex(encodeLockingBytecodeP2sh32(hash256(redeem)))).toBe(binToHex(entryLock));
    const vm = createVirtualMachineBch2026ForProvider(provider);

    /** A live `side` entry that `honest` does not spend. */
    const victimOf = async (honest: Spend): Promise<Victim> => {
      const spent = new Set(honest.transaction.inputs.map((input) =>
        `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`));
      const entry = (await provider.getUtxos(entryAddress)).find((utxo) => utxo.token?.nft?.capability === 'mutable'
        && !spent.has(`${utxo.txid}:${utxo.vout}`));
      expect(entry, 'an unspent side entry').toBeDefined();
      return {
        txid: entry!.txid, vout: entry!.vout, redeem,
        source: solidCashOutputToLibauthOutput({ to: entryLock, amount: entry!.satoshis, token: entry!.token }),
      };
    };

    /** The victim rewritten in place, and moved, beside `honest`: its covenant accepts each, the master refuses. */
    const attack = async (honest: Spend, label: string): Promise<void> => {
      const victim = await victimOf(honest);
      const master = honest.sourceOutputs.findIndex((output) => output.token?.nft?.capability === 'minting'
        && binToHex(output.token.category) === binToHex(victim.source.token!.category));
      expect(master).toBeGreaterThanOrEqual(0);
      const at = honest.transaction.inputs.length;
      const forged = Uint8Array.from(victim.source.token!.nft!.commitment);
      forged[forged.length - 1] ^= 1;
      const rewrite = beside(honest, victim, master, {
        ...victim.source, token: { ...victim.source.token!, nft: { capability: 'mutable', commitment: forged } },
      });
      const moved = beside(honest, victim, master, {
        lockingBytecode: OTHER_LOCK, valueSatoshis: victim.source.valueSatoshis,
      }, [victim.source]);
      expect(verdict(vm, rewrite, at), `beside ${label}, the entry write flag accepts the rewrite`).toBe(true);
      expect(verdict(vm, moved, at), `beside ${label}, the entry write flag accepts the move`).toBe(true);
      expect.soft(verdict(vm, rewrite, master), `beside ${label}, the master refuses the rewrite`).not.toBe(true);
      expect.soft(verdict(vm, moved, master), `beside ${label}, the master refuses the move`).not.toBe(true);
    };

    // 1. A direct `tick`: its pinned count runs through the parked pin.
    const tickCall = bus.call.tick();
    const tick = spendOf(await tickCall.build());
    expect(failures(vm, tick), 'honest tick').toEqual([]);
    await attack(tick, 'a direct tick');
    await tickCall.send();
    expect((await bus.getState()).count).toBe(1n);

    // 2. A direct `put` of key 5: its census walk runs through the parked pin; key 9's entry is the victim.
    const putCall = bus.call.put(5n, 8n);
    const put = spendOf(await putCall.build());
    expect(failures(vm, put), 'honest put').toEqual([]);
    await attack(put, 'a direct put');
    await putCall.send();
    expect((await bus.getEntries('side')).map((entry) => entry.value)).toEqual(expect.arrayContaining([8n, 1n]));
  }, 300_000);
});
