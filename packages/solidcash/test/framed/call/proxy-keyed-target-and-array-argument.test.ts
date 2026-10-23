import { describe, expect, it } from 'vitest';
import { binToHex, bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, type Artifact } from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster, entryRecordLockingBytecode, stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  entryRowOf, makeCallResolver, resolveCallArguments,
} from '../../../src/framed/proxy/call-resolution.js';
import { planHopExternalCalls, routingOf } from '../../../src/framed/proxy/external-calls.js';
import { encodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';

/**
 * A hop resolves an argument a pure helper builds as a fixed-size array, and a target its callee's own mapping holds.
 *
 * The helper's body reaches the artifact as a `call` expression carrying its statements, so an argument built by
 * indexed writes into a fixed-size array has to execute those statements to resolve. A state variable backed by a
 * mapping is not one of the frame's data-NFT fields: its entry is a separate node, so a target computed from a
 * mapping read has to resolve against the live deployment the frame runs on.
 */

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ISink { function ping(); }'
  + ' interface IEcho { function sum(int[5] a); }'
  + ' interface IRegistry { function dispatch(int id); }'
  + ' contract Sink { int public hits; function ping() { this.hits = this.hits + 1; require(true); } }'
  + ' contract Echo { int public total; function sum(int[5] a) { this.total = a[0]; require(true); } }'
  + ' contract Registry {'
  + '   mapping(int => address) routes;'
  + '   function dispatch(int id) { ISink(this.routes[id]).ping(); require(true); }'
  + ' }'
  + ' contract Caller {'
  + '   address public registry;'
  + '   address public echo;'
  + '   function build(int base) internal pure returns (int[5]) {'
  + '     int[5] out; out[0] = base; out[1] = base * 2; out[2] = base * 3; out[3] = base * 4; out[4] = base * 5;'
  + '     return out;'
  + '   }'
  + '   function go(int id) {'
  + '     IRegistry(this.registry).dispatch(id);'
  + '     IEcho(this.echo).sum(build(7));'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const caller = artifacts.Caller!;
const registry = artifacts.Registry!;
const echo = artifacts.Echo!;
const sink = artifacts.Sink!;

const CALLER_CATEGORY = 'a1'.repeat(31) + '5e';
const REGISTRY_CATEGORY = 'a2'.repeat(31) + '5d';
const ECHO_CATEGORY = 'a3'.repeat(31) + '5c';
const SINK_CATEGORY = 'a4'.repeat(31) + '5b';

/** The address a frame presents, which is what a state field or a mapping entry names. */
function masterAddress(artifact: Artifact, categoryId: string): Uint8Array {
  return deployMaster(artifact, hexToBin(categoryId), VALIDATOR_PROGRAM).address;
}

describe('the hop resolves a fixed-size array a pure helper builds', () => {
  it('executes the helper\'s indexed writes for an argument the routing publishes as a call', () => {
    const row = routingOf(caller, 'go').find((candidate) => candidate.interfaceName === 'IEcho')!;
    const resolver = makeCallResolver({
      artifact: caller, functionName: 'go', args: [1n],
      stateValues: { registry: new Uint8Array(35).fill(1), echo: new Uint8Array(35).fill(2) },
    });
    const { values } = resolveCallArguments(row, echo, entryRowOf(echo, 'sum'), resolver, 0);
    expect(values[0]).toStrictEqual([7n, 14n, 21n, 28n, 35n]);
  });
});

describe('the hop resolves a target a callee\'s own mapping holds', () => {
  /** A live framed deployment: a master, one record per data NFT, and the head of every sorted collection. */
  async function seed(
    network: MockNetworkProvider, artifact: Artifact, categoryId: string,
    state: Record<string, Uint8Array> = {},
  ): Promise<void> {
    const category = hexToBin(categoryId);
    const layout = artifact.stateLayout!;
    const master = deployMaster(artifact, category, VALIDATOR_PROGRAM).address;
    await network.addUtxo(binToHex(master), {
      txid: categoryId, vout: 0, satoshis: 500_000n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    for (let nftIndex = 0; nftIndex < layout.dataNftCount; nftIndex += 1) {
      await network.addUtxo(binToHex(stateRecordLockingBytecode(categoryId)), {
        txid: `${categoryId.slice(0, 62)}${(nftIndex + 1).toString(16).padStart(2, '0')}`,
        vout: nftIndex, satoshis: 1200n,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: buildPushdataCommitment(layout, state, nftIndex) },
        },
      });
    }
    for (const [index, collection] of (layout.collections ?? []).entries()) {
      if (collection.sorted !== true) continue;
      await network.addUtxo(binToHex(entryRecordLockingBytecode(categoryId, collection.signature)), {
        txid: `${categoryId.slice(0, 60)}${(0x80 + index).toString(16).padStart(2, '0')}ee`, vout: index,
        satoshis: 1200n,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: binToHex(headSentinelCommitment()) },
        },
      });
    }
  }

  it('finds the node the key names and places the callee at the address it holds', async () => {
    const network = new MockNetworkProvider();
    const registryMaster = masterAddress(registry, REGISTRY_CATEGORY);
    const echoMaster = masterAddress(echo, ECHO_CATEGORY);
    const sinkMaster = masterAddress(sink, SINK_CATEGORY);

    await seed(network, caller, CALLER_CATEGORY, { registry: registryMaster, echo: echoMaster });
    await seed(network, registry, REGISTRY_CATEGORY);
    await seed(network, echo, ECHO_CATEGORY);
    await seed(network, sink, SINK_CATEGORY);

    // The callee's own mapping entry: the key's slot, a null successor, and the address as the body stores it, its
    // own locking bytecode.
    const routes = registry.stateLayout!.collections!.find((collection) => collection.name === 'routes')!;
    const slot = keyToSlotMulti([bigIntToVmNumber(1n)]);
    await network.addUtxo(binToHex(entryRecordLockingBytecode(REGISTRY_CATEGORY, routes.signature)), {
      txid: 'b1'.repeat(32), vout: 0, satoshis: 1200n,
      token: {
        category: REGISTRY_CATEGORY, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: bytesToHex(encodeEntryCommitment(slot, new Uint8Array(32), sinkMaster)),
        },
      },
    });

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: caller,
      functionName: 'go',
      args: [1n],
      externals: {
        IRegistry: { artifact: registry, categoryId: REGISTRY_CATEGORY },
        IEcho: { artifact: echo, categoryId: ECHO_CATEGORY },
        ISink: { artifact: sink, categoryId: SINK_CATEGORY },
      },
      stateValues: { registry: registryMaster, echo: echoMaster },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    const dispatched = plan.callees.find((frame) => frame.functionName === 'Registry.dispatch()')!;
    expect(dispatched).toBeDefined();
    expect(dispatched.calls).toHaveLength(1);
    expect(bytesToHex(dispatched.calls[0]!.target)).toBe(bytesToHex(sinkMaster));

    // The helper's fixed-size array reaches the echo frame as its one argument push.
    const echoCall = plan.calls.find((call) => bytesToHex(call.target) === bytesToHex(echoMaster))!;
    const expected = encodeFunctionArgument([7n, 14n, 21n, 28n, 35n], 'int[5]', echo.structs);
    expect(echoCall.argumentPushes[echoCall.argumentPushes.length - 1]).toStrictEqual(expected);
  });
});
