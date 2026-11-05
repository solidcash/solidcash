import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Artifact, buildInitialStateCommitments, parsePushdataCommitment,
} from '@solidcash/utils';
import { Contract } from '../../../src/index.js';
import {
  StatefulTransactionBuilder,
  getDataNftAddress,
  createDataNftUnlocker,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { ExternalCallUtxoGroup } from '../../../src/stateful/StatefulTransactionBuilder.js';
import { addressToLockScript } from '../../../src/utils.js';
import type { Utxo } from '../../../src/interfaces.js';
import { getTxOutputs } from '../../test-util.js';
import { createMessageBusSemanticTestProvider } from './message-bus-semantic-profile.js';

/**
 * J4 Kernel* wrap of the E3/A13-1c bytecode-pin control:
 * honest pin settles; foreign co-spent implementation is refused at the proxy input.
 */

const IMPL = `pragma solidcash >=0.8.0;
contract PinImpl() {
  bigint counter;
  function increment() delegate { this.counter = this.counter + 1; }
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}`;

const IMPL_FOREIGN = IMPL
  .replace('PinImpl', 'ForeignImpl')
  .replace('this.counter = this.counter + 1;', 'this.counter = 999;');

const PROXY_PINNED = `pragma solidcash >=0.8.0;
contract PinnedProxy(address impl) {
  bigint counter;
  function up(bytes input) external {
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;

const compileFixture = (source: string): Artifact => compileString(source, {
  allowUnsafeOperations: true,
  enforceFinalRequire: false,
});

type SemanticProvider = ReturnType<typeof createMessageBusSemanticTestProvider>;

interface Deployed {
  contract: Contract;
  categoryId: string;
  master: Utxo;
  dataNfts: Utxo[];
}

async function deploy(
  provider: SemanticProvider, artifact: Artifact, args: unknown[], state: Record<string, unknown>,
): Promise<Deployed> {
  const contract = new Contract(artifact, args as never[], { provider });
  const commitments = buildInitialStateCommitments(artifact.stateLayout!, state);
  const { categoryId, utxos } = await (provider as any).addTokenUtxosDynamic((category: string) => [
    {
      address: contract.tokenAddress, satoshis: 10_000n,
      token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
    },
    ...commitments.map((commitment) => ({
      address: getDataNftAddress(contract, category), satoshis: 10_000n,
      token: { amount: 0n, nft: { capability: 'mutable' as const, commitment } },
    })),
  ]);
  return { contract, categoryId, master: utxos[0], dataNfts: utxos.slice(1) };
}

function delegateGroup(
  artifact: Artifact, deployed: Deployed, fn: string, args: unknown[], masterInputIndex: number,
): ExternalCallUtxoGroup {
  return {
    categoryId: deployed.categoryId,
    stateLayout: artifact.stateLayout!,
    masterUtxo: { ...deployed.master, unlocker: (deployed.contract.unlock as any)[fn](...args) },
    dataNftUtxos: deployed.dataNfts.map((nft) => ({
      ...nft, unlocker: createDataNftUnlocker(deployed.contract, masterInputIndex, deployed.categoryId),
    })),
    requiredDataNftIndices: deployed.dataNfts.map((_nft, index) => index),
    functionName: fn,
    functionArgs: args,
    externalContract: null,
  } as unknown as ExternalCallUtxoGroup;
}

const selectorOf = (artifact: Artifact, name: string): Uint8Array =>
  hexToBin(artifact.abi.find((entry) => entry.name === name)!.selector!);

const stateOf = (tx: any, category: string, layout: any): Record<string, bigint> => {
  const output = getTxOutputs(tx).find(
    (candidate: any) => candidate.token?.category === category && candidate.token?.nft?.capability === 'mutable',
  );
  return parsePushdataCommitment(output!.token!.nft!.commitment, layout, 0) as Record<string, bigint>;
};

const outcome = async (send: Promise<unknown>): Promise<string> =>
  send.then(() => 'ACCEPTED').catch((error: Error) => error.message);

describe('kernel proxy bytecode-pin refuses foreign implementation', () => {
  const implArtifact = compileFixture(IMPL);
  const foreignArtifact = compileFixture(IMPL_FOREIGN);
  const proxyArtifact = compileFixture(PROXY_PINNED);

  it('classifies as bytecode-pinned/adjacent-proxy-block/scalar', () => {
    const provider = createMessageBusSemanticTestProvider();
    const implementation = new Contract(implArtifact, [], { provider });
    const implementationLbc = binToHex(addressToLockScript(implementation.address));
    const proxy = new Contract(proxyArtifact, [hexToBin(implementationLbc)] as never[], { provider });
    expect(messageBus.classifyDelegateParticipant({
      proxy: { artifact: proxyArtifact, functionName: 'up', bytecode: proxy.bytecode },
      implementation: { artifact: implArtifact, functionName: 'increment', lockingBytecode: implementationLbc },
    })).toEqual({
      id: 'bytecode-pinned/adjacent-proxy-block/scalar',
      codeIdentity: 'bytecode-pinned',
      stateOwner: 'adjacent-proxy-block',
      outputAuthority: 'delegate-covenant-scalar',
    });
  });

  it('settles when the co-spent implementation matches the proxy pin', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const pinned = await deploy(provider, implArtifact, [], { counter: 0n });
    const proxy = await deploy(
      provider, proxyArtifact, [addressToLockScript(pinned.contract.address)], { counter: 5n },
    );
    const tx = await new StatefulTransactionBuilder({
      provider,
      stateLayout: proxyArtifact.stateLayout!,
      categoryId: proxy.categoryId,
      masterUtxo: {
        ...proxy.master,
        unlocker: (proxy.contract.unlock as any).up(selectorOf(implArtifact, 'increment'), 2n),
      },
      dataNftUtxos: proxy.dataNfts.map((nft) => ({
        ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
      })),
      externalCallUtxoGroups: [
        delegateGroup(implArtifact, pinned, 'increment', [0n], 2),
      ],
    }).setState('counter', 6n).send();
    expect(stateOf(tx, proxy.categoryId, proxyArtifact.stateLayout!).counter).toBe(6n);
  }, 120_000);

  it('refuses a foreign co-spent implementation at the proxy input', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const pinned = await deploy(provider, implArtifact, [], { counter: 0n });
    const foreign = await deploy(provider, foreignArtifact, [], { counter: 0n });
    const proxy = await deploy(
      provider, proxyArtifact, [addressToLockScript(pinned.contract.address)], { counter: 5n },
    );
    const message = await outcome(new StatefulTransactionBuilder({
      provider,
      stateLayout: proxyArtifact.stateLayout!,
      categoryId: proxy.categoryId,
      masterUtxo: {
        ...proxy.master,
        unlocker: (proxy.contract.unlock as any).up(selectorOf(implArtifact, 'increment'), 2n),
      },
      dataNftUtxos: proxy.dataNfts.map((nft) => ({
        ...nft, unlocker: createDataNftUnlocker(proxy.contract, 0, proxy.categoryId),
      })),
      externalCallUtxoGroups: [
        delegateGroup(foreignArtifact, foreign, 'increment', [0n], 2),
      ],
    }).setState('counter', 999n).send());
    expect(message).toMatch(/BCH-2026 preflight failed at input 0|error in evaluating input index 0/);
    expect(message).toMatch(/OP_VERIFY/);
  }, 120_000);
});
