/**
 * The co-spent implementation of a delegatecall, by the form of the call and where its target comes from. A function
 * that delegatecalls skips its own state covenant: the implementation it co-spends authorizes the proxy's state
 * through `_proxyMasterIndex`, so the proxy must require that implementation to be the one at its target, or a
 * spender co-spends code of their own, or none, and writes the proxy's state as they like (finding C1 in
 * packages/solidc/docs/delegatecall-security.md).
 *
 * Each proxy takes its target as a constructor argument, from a state variable, or as a parameter bound to that state
 * variable, and calls it as an expression, `(bool ok, bytes data) = impl.delegatecall(input)`, or as a statement,
 * `impl.delegatecall(input);`. A spend runs the counter from 5: the implementation adds one, a hostile one of the same
 * layout and selector sets 999, and the same code deployed twice is the same implementation. Each spend runs on the
 * BCH 2026 VM, through the builder's preflight.
 */
import { hexToBin } from '@bitauth/libauth';
import { Artifact, buildInitialStateCommitments, parsePushdataCommitment } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  StatefulTransactionBuilder, createDataNftUnlocker, getDataNftAddress,
} from '../../src/stateful/index.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';

/** The proxy's state, which every implementation shares. */
const LAYOUT = 'address implementation;\n  bigint counter;';

/** An implementation: `increment` adds one to the proxy's counter. Two functions, so it is selector-dispatched. */
const IMPLEMENTATION = `pragma solidcash >=0.8.0;
contract Implementation() {
  ${LAYOUT}
  function increment() public { this.counter = this.counter + 1; }
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

/** A hostile implementation of the same layout and selector: `increment` sets the proxy's counter to 999. */
const HOSTILE = `pragma solidcash >=0.8.0;
contract Hostile() {
  ${LAYOUT}
  function increment() public { this.counter = 999; }
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

const EXPRESSION = (target: string): string => `(bool ok, bytes data) = ${target}.delegatecall(input);
    require(ok);`;
const STATEMENT = (target: string): string => `${target}.delegatecall(input);
    require(input.length > 0);`;

type Form = { name: string; call: (target: string) => string };
const FORMS: readonly Form[] = [{ name: 'expression', call: EXPRESSION }, { name: 'statement', call: STATEMENT }];

/** Where the proxy's target comes from: its source, and the arguments `up` takes before the delegate witness. */
type Source = {
  name: string;
  proxy: (form: Form) => string;
  constructorArgs: (implementation: Uint8Array) => unknown[];
  upArgs: (input: Uint8Array, implementation: Uint8Array) => unknown[];
};
const SOURCES: readonly Source[] = [
  {
    name: 'a constructor argument',
    proxy: (form) => `pragma solidcash >=0.8.0;
contract Proxy(address impl) {
  ${LAYOUT}
  function up(bytes input) external {
    ${form.call('impl')}
  }
}`,
    constructorArgs: (implementation) => [implementation],
    upArgs: (input) => [input],
  },
  {
    name: 'a state variable',
    proxy: (form) => `pragma solidcash >=0.8.0;
contract Proxy() {
  ${LAYOUT}
  function up(bytes input) external {
    ${form.call('implementation')}
  }
}`,
    constructorArgs: () => [],
    upArgs: (input) => [input],
  },
  {
    name: 'a parameter bound to a state variable',
    proxy: (form) => `pragma solidcash >=0.8.0;
contract Proxy() {
  ${LAYOUT}
  function up(bytes input, address impl) external {
    require(impl == this.implementation);
    ${form.call('impl')}
  }
}`,
    constructorArgs: () => [],
    upArgs: (input, implementation) => [input, implementation],
  },
];

interface Deployed {
  contract: Contract;
  categoryId: string;
  utxos: { master: Utxo; dataNfts: Utxo[] };
}

/** The inferred implementation build of `source`, which runs against a proxy's state. */
function delegateBuild(source: string): Artifact {
  const standalone = compileString(source);
  if (!standalone.delegateArtifact) throw new Error(`${standalone.contractName} has no inferred delegate build`);
  return standalone.delegateArtifact;
}

/** A genesis of `artifact` holding `state`, at its unsalted address. */
async function deploy(
  provider: MockNetworkProvider, artifact: Artifact, args: unknown[], state: Record<string, unknown>,
): Promise<Deployed> {
  const contract = new Contract(artifact, args as never, { provider });
  const commitments = buildInitialStateCommitments(artifact.stateLayout!, state);
  const { categoryId, utxos } = await (provider as any).addTokenUtxosDynamic((category: string) => [
    {
      address: contract.tokenAddress, satoshis: 10_000n,
      token: { amount: 0n, nft: { capability: 'minting', commitment: '' } },
    },
    ...commitments.map((commitment) => ({
      address: getDataNftAddress(contract, category), satoshis: 10_000n,
      token: { amount: 0n, nft: { capability: 'mutable' as const, commitment } },
    })),
  ]);
  return { contract, categoryId, utxos: { master: utxos[0], dataNfts: utxos.slice(1) } };
}

/** The implementation `d` co-spent at input `index`, running `increment` against the proxy master at input 0. */
function delegateGroup(artifact: Artifact, d: Deployed, index: number): ExternalCallUtxoGroup {
  return {
    categoryId: d.categoryId,
    stateLayout: artifact.stateLayout!,
    masterUtxo: { ...d.utxos.master, unlocker: (d.contract.unlock as any).increment(0n) },
    dataNftUtxos: d.utxos.dataNfts.map((nft) => ({
      ...nft, unlocker: createDataNftUnlocker(d.contract, index, d.categoryId),
    })),
    requiredDataNftIndices: d.utxos.dataNfts.map((_, nftIndex) => nftIndex),
    functionName: 'increment',
    functionArgs: [0n],
    externalContract: null,
  };
}

const implementationArtifact = delegateBuild(IMPLEMENTATION);
const hostileArtifact = delegateBuild(HOSTILE);
const selector = hexToBin(implementationArtifact.abi.find((fn) => fn.name === 'increment')!.selector!);

for (const form of FORMS) {
  for (const source of SOURCES) {
    describe(`a delegatecall as ${form.name === 'expression' ? 'an expression' : 'a statement'} through `
      + `${source.name}`, () => {
      const proxyArtifact = compileString(source.proxy(form), { forceStateful: true });

      /** A proxy at counter 5 whose target is a deployment of the implementation, a second one, and a hostile one. */
      async function setup(): Promise<{
        provider: MockNetworkProvider; proxy: Deployed; implementation: Deployed; again: Deployed; hostile: Deployed;
        lock: Uint8Array;
      }> {
        const provider = createTestProvider() as MockNetworkProvider;
        const implementation = await deploy(provider, implementationArtifact, [], { counter: 0n });
        const again = await deploy(provider, implementationArtifact, [], { counter: 0n });
        const hostile = await deploy(provider, hostileArtifact, [], { counter: 0n });
        const lock = addressToLockScript(implementation.contract.address);
        const proxy = await deploy(provider, proxyArtifact, source.constructorArgs(lock), {
          implementation: lock, counter: 5n,
        });
        return { provider, proxy, implementation, again, hostile, lock };
      }

      /** Sends `up` with `delegate` (an implementation build and its deployment) co-spent, or none, settling `counter`. */
      function send(
        s: Awaited<ReturnType<typeof setup>>, delegate: [Artifact, Deployed] | undefined, counter: bigint,
      ): Promise<any> {
        const index = 1 + s.proxy.utxos.dataNfts.length;
        return new StatefulTransactionBuilder({
          provider: s.provider,
          stateLayout: proxyArtifact.stateLayout!,
          categoryId: s.proxy.categoryId,
          masterUtxo: {
            ...s.proxy.utxos.master,
            unlocker: (s.proxy.contract.unlock as any).up(...source.upArgs(selector, s.lock), BigInt(index)),
          },
          dataNftUtxos: s.proxy.utxos.dataNfts.map((nft) => ({
            ...nft, unlocker: createDataNftUnlocker(s.proxy.contract, 0, s.proxy.categoryId),
          })),
          externalCallUtxoGroups: delegate ? [delegateGroup(delegate[0], delegate[1], index)] : [],
        }).setState('counter', counter).send();
      }

      /** The counter the proxy's data NFTs hold after `tx`. */
      const counterAfter = (tx: any, categoryId: string): bigint => {
        const outputs = getTxOutputs(tx).filter((output) => output.token?.category === categoryId
          && output.token?.nft?.capability === 'mutable');
        const state = Object.assign({}, ...outputs.map((output, nftIndex) => parsePushdataCommitment(
          output.token!.nft!.commitment, proxyArtifact.stateLayout!, nftIndex,
        )));
        return state.counter as bigint;
      };

      it('runs the implementation at the target', async () => {
        const s = await setup();
        const tx = await send(s, [implementationArtifact, s.implementation], 6n);
        expect(counterAfter(tx, s.proxy.categoryId)).toBe(6n);
      });

      it('runs a second deployment of the same implementation, which is the same code', async () => {
        const s = await setup();
        const tx = await send(s, [implementationArtifact, s.again], 6n);
        expect(counterAfter(tx, s.proxy.categoryId)).toBe(6n);
      });

      it('refuses a hostile implementation co-spent in its place', async () => {
        const s = await setup();
        await expect(send(s, [hostileArtifact, s.hostile], 999n)).rejects.toThrow(/preflight failed at input 0\b/);
      });

      it('refuses a spend that co-spends no implementation', async () => {
        const s = await setup();
        await expect(send(s, undefined, 999n)).rejects.toThrow(/preflight failed at input 0\b/);
      });
    });
  }
}
