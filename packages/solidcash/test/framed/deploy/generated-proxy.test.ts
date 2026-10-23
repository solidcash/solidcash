import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, encodeEventCommitment, type StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { participant } from '../../../src/framed/composer/index.js';
import {
  FramedProxyDeployError, buildProxyArtifact, deployFramedProxy, proxyRecordParticipantId,
} from '../../../src/framed/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM } from '../shapes/harness.js';

/**
 * A built-in proxy: the one the deployment generates from the implementation's own declaration.
 *
 * The implementation is the only contract the caller compiles. The proxy is derived from the implementation's
 * state layout, so its record fields — the coordinates the implementation's own write rebuilds the commitment from
 * — are the implementation's, and the layout needs no separate declaration to keep the address the fallback reads.
 *
 * The tests drive the shipped deployment and machine; the generated proxy goes through the same genesis as a
 * hand-written one.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';

// The implementation declares the field the fallback forwards to, beside the state its entry writes: the
// implementation's write rebuilds the record from its own declaration, so the address has to be one of its fields
// to survive it.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public version;'
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.version = 7;'
  + '   }'
  + ' }';

// An implementation that does not declare the field the fallback forwards to has no record a proxy can agree on.
const NO_IMPLEMENTATION_FIELD = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   int public version;'
  + '   function initialize(address expected) { require(msg.sender == expected); this.version = 7; }'
  + ' }';

/** Funds the two genesis UTXOs, and returns the deployer's own lock and funder; the proxy's genesis is initialized. */
async function funded(network: MockNetworkProvider): Promise<{
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  return {
    funder: funder.unlock.spend(alicePub, signature),
    implFunding,
    proxyFunding,
    deployerLock: encodeLockingBytecodeP2pkh(alicePkh),
    changeAddress: funder.address,
  };
}

/** The commitment the shipped encoder materializes from one state of a layout. */
function commitment(
  layout: StateLayout,
  state: Record<string, bigint | Uint8Array>,
): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, state, 0), 'hex'));
}

/** The implementation's address at its seeded category, `addrV(category)`. */
function implementationAddress(artifacts: ReturnType<typeof compileStringMulti>): Uint8Array {
  return deployMaster(
    artifacts.Impl!, new Uint8Array(Buffer.from(IMPL_CATEGORY, 'hex')), VALIDATOR_PROGRAM,
  ).address;
}

/** Every field's physical coordinate, the identity a record write rebuilds the commitment from. */
function fieldCoordinates(layout: StateLayout): string {
  return [...layout.variables]
    .sort((left, right) => left.nftIndex - right.nftIndex || left.fieldIndex - right.fieldIndex)
    .map((variable) => `${variable.name}: ${variable.type} (${variable.nftIndex}, ${variable.fieldIndex})`)
    .join('\n');
}

describe('a generated proxy', () => {
  it('agrees with the implementation field for field, so the record layout is the implementation\'s', () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const proxy = buildProxyArtifact(artifacts.Impl!);
    const implementationLayout = artifacts.Impl!.stateLayout!;
    const proxyLayout = proxy.stateLayout!;

    // The coordinates the implementation's write rebuilds the commitment from, and nothing else: a field only one
    // side knew would not survive the implementation's write.
    expect(proxyLayout.dataNftCount).toBe(implementationLayout.dataNftCount);
    expect(fieldCoordinates(proxyLayout)).toBe(fieldCoordinates(implementationLayout));

    // The two records carry the same bytes for the same state, which is the agreement the write depends on.
    const state = { implementation: implementationAddress(artifacts), initialized: 0n, version: 0n };
    expect(bytesToHex(commitment(proxyLayout, state))).toBe(bytesToHex(commitment(implementationLayout, state)));

    // And the generated contract is the forwarder shape the convention compiles.
    expect(proxy.abi.some((entry) => entry.name === '__fallback')).toBe(true);
  });

  it('settles a writing initialize through the proxy it generated, keeping the implementation\'s address', async () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);
    const proxy = buildProxyArtifact(artifacts.Impl!);

    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    });

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${artifacts.Impl!.contractName}.initialize()`, `${proxy.contractName}.__fallback()`]);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);
    // The derived hop spends the proxy's master, its validator and facet, the implementation's master and the
    // record, then the deployer's own coin. It is never broadcast: the proxy's genesis mints what it wrote.
    expect(deployment.initialize.broadcast.txid).toBe(deployment.proxy.tx.txid);
    expect(deployment.initialize.transaction.inputs.length).toBe(6);

    // The entry computed the state it wrote: the flag set and the version written, with the address still there.
    const written = commitment(artifacts.Impl!.stateLayout!, {
      implementation: deployment.implementation.address, initialized: 1n, version: 7n,
    });
    expect(bytesToHex(deployment.initialize.writtenRecordCommitment)).toBe(bytesToHex(written));
    const recordIndex = deployment.initialize.draft.layout.participants
      .find((placed) => placed.id === proxyRecordParticipantId(0))!.index;
    expect(bytesToHex(deployment.initialize.transaction.outputs[recordIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(written));

    // The proxy's record holds what the entry wrote, minted by its genesis and read back through the shipped decoder.
    // There is no later hop, so the chain is never left at the uninitialized commitment for someone else to take.
    const discovery = await readFramedDeployment(network, deployment.proxy.categoryId, proxy.stateLayout!);
    expect(discovery.records.length).toBe(1);
    const recordState = new Uint8Array(Buffer.from(discovery.records[0]!.token!.nft!.commitment, 'hex'));
    expect(bytesToHex(recordState)).toBe(bytesToHex(written));
    expect(bytesToHex(recordState)).toBe(bytesToHex(commitment(proxy.stateLayout!, {
      implementation: deployment.implementation.address, initialized: 1n, version: 7n,
    })));
  });

  it('settles an initialize that emits, and lists the payload the entry computed', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Impl {'
      + '   address public implementation;'
      + '   uint public initialized;'
      + '   event Changed(uint indexed version);'
      + '   function initialize(address expected) {'
      + '     require(msg.sender == expected);'
      + '     this.initialized = 7;'
      + '     emit Changed(this.initialized);'
      + '   }'
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);
    const generated = buildProxyArtifact(artifacts.Impl!);

    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    });

    expect(deployment.initialize.accepted).toBe(true);
    // The delegate frame's block lists the event, and the payload is what the entry's own body computed.
    const payload = new Uint8Array(Buffer.from(
      encodeEventCommitment(artifacts.Impl!.events![0]!.parameters, [7n]),
    ));
    expect(deployment.initialize.writtenEventCommitments.map(bytesToHex)).toStrictEqual([bytesToHex(payload)]);
    const eventIndex = deployment.initialize.draft.trailingOutputs[0]!.index;
    const eventOutput = deployment.initialize.transaction.outputs[eventIndex]!;
    expect(bytesToHex(eventOutput.token!.nft!.commitment)).toBe(bytesToHex(payload));
    // The output carries the proxy's category, which is the contract the delegate frame runs on.
    expect(bytesToHex(eventOutput.token!.category)).toBe(bytesToHex(new Uint8Array(Buffer.from(PROXY_CATEGORY, 'hex'))));
    expect(deployment.initialize.writtenRecordCommitment)
      .toStrictEqual(commitment(generated.stateLayout!, {
        implementation: deployment.implementation.address, initialized: 7n,
      }));
  });

  it('mirrors struct-typed fields, carrying the struct definitions they reference', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' struct Inner { int a; }'
      + ' struct Outer { Inner x; int t; }'
      + ' contract Impl {'
      + '   address public implementation;'
      + '   Outer public o;'
      + '   Inner[] packed public items;'
      + '   function initialize(address expected) { require(msg.sender == expected); }'
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const proxy = buildProxyArtifact(artifacts.Impl!);
    const implementationLayout = artifacts.Impl!.stateLayout!;
    const proxyLayout = proxy.stateLayout!;

    expect(proxyLayout.dataNftCount).toBe(implementationLayout.dataNftCount);
    expect(fieldCoordinates(proxyLayout)).toBe(fieldCoordinates(implementationLayout));
    // The struct definitions the fields name are part of the generated source, so the field types resolve.
    expect((proxyLayout.structs ?? []).map((definition) => definition.name).sort())
      .toStrictEqual((implementationLayout.structs ?? []).map((definition) => definition.name).sort());
  });

  it('mirrors a field the implementation keeps alone in a data NFT of its own', () => {
    // A field the compiler registers as a record of its own is not packed beside its neighbours, and the published
    // layout says so only through the coordinates: a proxy that declared it beside them would put it in the
    // previous record and every field after it would land somewhere the implementation does not read.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Impl {'
      + '   address public implementation;'
      + '   int public version;'
      + '   pubkey external owner;'
      + '   function initialize(address expected) { require(msg.sender == expected); this.version = 7; }'
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const implementationLayout = artifacts.Impl!.stateLayout!;
    expect(implementationLayout.dataNftCount).toBe(2);
    const proxy = buildProxyArtifact(artifacts.Impl!);
    expect(fieldCoordinates(proxy.stateLayout!)).toBe(fieldCoordinates(implementationLayout));
    expect(proxy.stateLayout!.dataNftCount).toBe(implementationLayout.dataNftCount);
  });

  it('settles an initialize through a proxy that keeps the address in a record of its own', async () => {
    // The shape both marketplace roots have: the implementation declares its state and nothing about its proxy,
    // and one of its own records is one the compiler isolated. The proxy declares the implementation's records
    // plus one for the address, and the deployment plans every one of them.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Impl {'
      + '   uint public initialized;'
      + '   int public version;'
      + '   pubkey external owner;'
      + '   function initialize(address expected) {'
      + '     require(msg.sender == expected);'
      + '     require(this.initialized == 0);'
      + '     this.initialized = 1;'
      + '     this.version = 7;'
      + '   }'
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);
    const generated = buildProxyArtifact(artifacts.Impl!);

    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    });

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${artifacts.Impl!.contractName}.initialize()`, `${generated.contractName}.__fallback()`]);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // Every record of the proxy's layout is a participant, and each ends where the execution left it: the entry's
    // write in the records its own declaration names, and the address in the record the proxy keeps of its own.
    const layout = generated.stateLayout!;
    expect(layout.dataNftCount).toBe(3);
    const recordOutput = (nftIndex: number): Uint8Array => {
      const index = participant(deployment.initialize.draft.layout, proxyRecordParticipantId(nftIndex)).index;
      return Uint8Array.from(deployment.initialize.transaction.outputs[index]!.token!.nft!.commitment);
    };
    const encode = (at: StateLayout, state: Record<string, bigint | Uint8Array>, nftIndex: number): Uint8Array =>
      new Uint8Array(Buffer.from(buildPushdataCommitment(at, state, nftIndex), 'hex'));
    expect(bytesToHex(recordOutput(0))).toBe(bytesToHex(
      encode(artifacts.Impl!.stateLayout!, { initialized: 1n, version: 7n }, 0),
    ));
    expect(bytesToHex(recordOutput(2))).toBe(bytesToHex(
      encode(layout, { implementation: deployment.implementation.address }, 2),
    ));
  });

  it('refuses a proxy whose own record would change how a commitment leads', () => {
    // A field the implementation does not declare is never rewritten by its frames, so a proxy can keep the address
    // it forwards to in a record past the implementation's. It can only do that where the two layouts already agree
    // on how a commitment leads: an implementation of one record writes it without a leading index, while a proxy
    // that added a record of its own leads every commitment with one, and a delegate frame writes through the
    // implementation's own declaration.
    const artifacts = compileStringMulti(NO_IMPLEMENTATION_FIELD, { composition: 'framed' });
    expect(artifacts.Impl!.stateLayout!.dataNftCount).toBe(1);
    expect(() => buildProxyArtifact(artifacts.Impl!))
      .toThrow(/only one of them leads a commitment with the index it belongs to/);
  });

  it('settles a tagged singleton implementation through its generated proxy and refuses a substituted record tag', async () => {
    const source = 'pragma solidcash ^0.14.0; contract Impl {'
      + ' int public version;'
      + ' function initialize(address expected) {'
      + '   require(msg.sender == expected); require(this.version == 0); this.version = 7;'
      + ' } }';
    const artifacts = compileStringMulti(source, {
      composition: 'framed', tagSingletonDataNfts: true,
    });
    const implementation = artifacts.Impl!;
    expect(implementation.stateLayout!.dataNftCount).toBe(1);
    expect(implementation.stateLayout!.taggedDataNfts).toBe(true);
    const generated = buildProxyArtifact(implementation);
    expect(generated.stateLayout!.dataNftCount).toBe(2);
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);
    const vm = compositionMachine();
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: implementation,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm,
    });
    const { draft, transaction, sourceOutputs, verdicts } = deployment.initialize;
    expect(verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    const recordIndex = participant(draft.layout, proxyRecordParticipantId(0)).index;
    expect(bytesToHex(transaction.outputs[recordIndex]!.token!.nft!.commitment))
      .toBe(buildPushdataCommitment(implementation.stateLayout!, { version: 7n }, 0));
    const pointerIndex = participant(draft.layout, proxyRecordParticipantId(1)).index;
    expect(bytesToHex(transaction.outputs[pointerIndex]!.token!.nft!.commitment))
      .toBe(buildPushdataCommitment(generated.stateLayout!, { implementation: deployment.implementation.address }, 1));

    // A different leading index cannot be substituted for the singleton's record, even when all field bytes match.
    const changedSources = structuredClone(sourceOutputs);
    changedSources[recordIndex]!.token!.nft!.commitment[0] = 0x51;
    const sourceRefusals = verdicts.filter(({ index }) => vm.stateSuccess(vm.evaluate({
      inputIndex: index, sourceOutputs: changedSources, transaction,
    })) !== true);
    expect(sourceRefusals.map(({ id }) => id)).not.toStrictEqual([]);
    const changedTransaction = structuredClone(transaction);
    changedTransaction.outputs[recordIndex]!.token!.nft!.commitment[0] = 0x51;
    const outputRefusals = verdicts.filter(({ index }) => vm.stateSuccess(vm.evaluate({
      inputIndex: index, sourceOutputs, transaction: changedTransaction,
    })) !== true);
    expect(outputRefusals.map(({ id }) => id)).not.toStrictEqual([]);
  });

  it('refuses a field whose type it cannot name, naming the field', () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const layout = artifacts.Impl!.stateLayout!;
    const broken = {
      ...artifacts.Impl!,
      stateLayout: {
        ...layout,
        variables: [...layout.variables, { name: 'ghost', type: 'NotAType', nftIndex: 0, fieldIndex: 9 }],
      },
    };

    expect(() => buildProxyArtifact(broken)).toThrowError(FramedProxyDeployError);
    expect(() => buildProxyArtifact(broken)).toThrowError(/field "ghost"/);
  });

  it('refuses an "implementation" field that is not an address, naming the field and its type', () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const layout = artifacts.Impl!.stateLayout!;
    const broken = {
      ...artifacts.Impl!,
      stateLayout: {
        ...layout,
        variables: layout.variables.map((variable) => (
          variable.name === 'implementation' ? { ...variable, type: 'int256' } : variable
        )),
      },
    };

    expect(() => buildProxyArtifact(broken)).toThrowError(
      /"implementation" field has type "int256"/,
    );
  });
});
