import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString as compileProduction } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import {
  StatefulContract,
  getEventNftAddress,
  getEventNftContinuationAddress,
  readEventsFromChain,
} from '../../src/stateful/index.js';
import {
  createFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos,
} from '../test-util.js';
import { bobAddress } from '../fixture/vars.js';

/**
 * An event whose payload can exceed one 128-byte NFT commitment reserves one output per chunk: chunk 0 at its
 * event slot under the event covenant, chunk i at the `eventChunk` slot after it under the continuation covenant.
 * `Wide` always spans two commitments (5 x 33 bytes); `Totals` is sized for two but small values fit in one, so
 * its second slot must hold no token.
 */
const SOURCE = `pragma solidcash >=0.8.0;
contract WideLog() {
  bigint counter;
  event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
  event Totals(uint256 a, uint256 b, uint256 c, uint256 d);
  event Narrow(bigint value);
  function publish(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e) {
    emit Wide(a, b, c, d, e);
    this.counter = this.counter + 1;
  }
  function tally(uint256 a, uint256 b, uint256 c, uint256 d) {
    emit Totals(a, b, c, d);
    this.counter = this.counter + 1;
  }
  function note(bigint value) {
    emit Narrow(value);
    this.counter = this.counter + value;
  }
  function destroy() selfdestruct { require(true); }
}`;

const words = [1, 2, 3, 4, 5].map((fill) => new Uint8Array(32).fill(fill));
const hex = (value: unknown): string => (value instanceof Uint8Array ? binToHex(value) : String(value));
const raw = (builder: TransactionBuilder): string => binToHex(encodeTransaction(builder.buildLibauthTransaction()));

describe('events wider than one NFT commitment', () => {
  const artifact = compileString(SOURCE);
  const layoutOf = (name: string): any => (artifact.abi as any[]).find((entry) => entry.name === name).blockLayout;

  const deploy = async (): Promise<{
    provider: ReturnType<typeof createTestProvider>; sc: StatefulContract; categoryId: string; salted: Contract;
  }> => {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    return {
      provider,
      sc: StatefulContract.withCategory(contract, categoryId),
      categoryId,
      salted: contract.withCategory(hexToBin(categoryId)),
    };
  };

  /** Build a call, pay its fee past the block, optionally tamper with the outputs, and submit it. */
  const submit = async (
    call: (sc: any) => any, tamper?: (outputs: any[], context: { categoryId: string; salted: Contract }) => void,
  ): Promise<string> => {
    const { provider, sc, categoryId, salted } = await deploy();
    const builder = await call(sc).build();
    const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
    builder.addInput(utxo, unlocker);
    tamper?.((builder as any).outputs, { categoryId, salted });
    try {
      await provider.sendRawTransaction(raw(builder));
      return 'ACCEPTED';
    } catch (error) {
      return `REJECTED: ${(error as Error).message}`;
    }
  };

  it('reserves a continuation slot after a wide emit and none for a narrow one', () => {
    const wide = layoutOf('publish').slots.filter((slot: any) => slot.kind === 'event' || slot.kind === 'eventChunk');
    expect(wide).toEqual([
      { kind: 'event', offset: wide[0].offset, slotIndex: 0 },
      { kind: 'eventChunk', offset: wide[0].offset + 1, slotIndex: 0, chunk: 1, conditional: true },
    ]);
    expect(layoutOf('tally').slots.filter((slot: any) => slot.kind === 'eventChunk')).toHaveLength(1);
    expect(layoutOf('note').slots.filter((slot: any) => slot.kind === 'eventChunk')).toEqual([]);
  });

  it('emits a two-commitment payload and reads it back joined, from the receipt and from the chain', async () => {
    const { sc, categoryId, salted, provider } = await deploy();
    const receipt = await (await (sc as any).publish(...words).send()).wait();
    expect(receipt.events).toHaveLength(1);
    expect(receipt.events[0].event).toBe('Wide');
    expect(['a', 'b', 'c', 'd', 'e'].map((name) => hex(receipt.events[0].args[name])))
      .toEqual(words.map((word) => binToHex(word)));

    const logs = await (sc as any).queryFilter('Wide');
    expect(logs).toHaveLength(1);
    expect(hex(logs[0].args.e)).toBe(binToHex(words[4]));

    const definition = artifact.events!.find((event) => event.name === 'Wide')!;
    const head = await provider.getUtxos(getEventNftAddress(salted, categoryId, definition.signature));
    const tail = await provider.getUtxos(getEventNftContinuationAddress(salted, categoryId, definition.signature));
    expect(head.map((utxo) => utxo.token!.nft!.commitment.length / 2)).toEqual([128]);
    expect(tail.map((utxo) => utxo.token!.nft!.commitment.length / 2)).toEqual([165 - 128]);
    expect(tail[0].vout).toBe(head[0].vout + 1);
    const chain = await readEventsFromChain(
      provider as any, getEventNftAddress(salted, categoryId, definition.signature), categoryId, definition,
      undefined, getEventNftContinuationAddress(salted, categoryId, definition.signature),
    );
    expect(hex(chain[0].values.a)).toBe(binToHex(words[0]));
  }, 300_000);

  it('leaves the unreached continuation slot without a token when the payload fits one commitment', async () => {
    const { sc } = await deploy();
    const receipt = await (await (sc as any).tally(1n, 2n, 3n, 4n).send()).wait();
    expect(receipt.events.map((event: any) => event.args.d)).toEqual([4n]);
    const logs = await (sc as any).queryFilter('Totals');
    expect(logs.map((log: any) => [log.args.a, log.args.d])).toEqual([[1n, 4n]]);
  }, 300_000);

  it('accepts the honest built row', async () => {
    expect(await submit((sc) => sc.publish(...words))).toBe('ACCEPTED');
  }, 300_000);

  it('refuses a forged continuation chunk', async () => {
    const chunk = layoutOf('publish').slots.find((slot: any) => slot.kind === 'eventChunk').offset;
    const outcome = await submit((sc) => sc.publish(...words), (outputs) => {
      const commitment = outputs[chunk].token.nft.commitment as string;
      outputs[chunk] = {
        ...outputs[chunk],
        token: { ...outputs[chunk].token, nft: { capability: 'none', commitment: `ff${commitment.slice(2)}` } },
      };
    });
    expectScriptRejection(outcome, 0);
  }, 300_000);

  it('refuses the continuation chunk moved ahead of the first', async () => {
    const event = layoutOf('publish').slots.find((slot: any) => slot.kind === 'event').offset;
    const outcome = await submit((sc) => sc.publish(...words), (outputs) => {
      [outputs[event], outputs[event + 1]] = [outputs[event + 1], outputs[event]];
    });
    expectScriptRejection(outcome, 0);
  }, 300_000);

  it('refuses an own-category carrier in an unreached continuation slot', async () => {
    const chunk = layoutOf('tally').slots.find((slot: any) => slot.kind === 'eventChunk').offset;
    const outcome = await submit((sc) => sc.tally(1n, 2n, 3n, 4n), (outputs, { categoryId, salted }) => {
      const signature = artifact.events!.find((event) => event.name === 'Totals')!.signature;
      outputs[chunk] = {
        to: getEventNftContinuationAddress(salted, categoryId, signature),
        amount: 1000n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: '' } },
      };
    });
    expectScriptRejection(outcome, 0);
  }, 300_000);

  it('streams a wide event on the kernel route, refuses it on the legacy route, and keeps its direct layout', () => {
    const source = `contract WideRoute {
      int last;
      event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
      function emitWide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e) public {
        last = 1;
        emit Wide(a, b, c, d, e);
        require(last == 1);
      }
      function setLast(int value) public {
        last = value;
        require(last == value);
      }
    }`;
    const options = {
      forceStateful: true, messageBus: true, maximumInputBytes: 1_000_000, optimizeForCompilationSpeed: true,
    } as const;
    const kernel = compileProduction(source, options);
    const streamed = kernel.messageBus?.handlers.find((handler) => handler.name === 'emitWide');
    expect(streamed).toMatchObject({ eligible: true, runtimeLoopEvents: [{ repeatCount: 1, chunked: true }] });
    expect(streamed?.emits).toBeUndefined();
    const legacy = compileProduction(source, { ...options, messageBusKernel: false });
    expect(legacy.messageBus?.handlers.find((handler) => handler.name === 'emitWide')?.eligible ?? false).toBe(false);
    for (const compiled of [kernel, legacy]) {
      expect((compiled.abi as any[]).find((entry) => entry.name === 'emitWide').blockLayout.slots
        .some((slot: any) => slot.kind === 'eventChunk')).toBe(true);
    }
  });

  it('destroy sweeps a wide event head and its continuation chunks', async () => {
    const { sc, categoryId, salted, provider } = await deploy();
    await (sc as any).publish(...words).send();
    const definition = artifact.events!.find((event) => event.name === 'Wide')!;
    const headAddress = getEventNftAddress(salted, categoryId, definition.signature);
    const continuationAddress = getEventNftContinuationAddress(salted, categoryId, definition.signature);
    // The emit produced one head commitment and one continuation chunk.
    expect(await provider.getUtxos(headAddress)).toHaveLength(1);
    expect(await provider.getUtxos(continuationAddress)).toHaveLength(1);
    // The event covenant carries a 144-block relative timelock; elapse it so the sweep can spend both NFTs.
    await (provider as any).mine(144);
    const result = await StatefulContract.destroy({
      provider, contract: sc, destroyFunctionName: 'destroy', destroyFunctionArgs: [], recipient: bobAddress,
    });
    expect(result.txs).toHaveLength(1);
    // Both the head and the continuation chunks are swept into the reclaim output.
    expect(await provider.getUtxos(headAddress)).toHaveLength(0);
    expect(await provider.getUtxos(continuationAddress)).toHaveLength(0);
  }, 300_000);
});
