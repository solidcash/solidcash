import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  getContractFactory,
  type ProxyContract,
  StatefulContract,
  upgrades,
} from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel late transitive sparse loop graph planning', () => {
  it('materializes every reached void row through one physical state owner', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x5a), provider);
    for (let index = 0; index < 48; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (0x100n + BigInt(index)).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 500_000n,
      });
    }

    const sinkArtifact = compileString(`pragma solidity ^0.8.0;
      contract SparseLoopSink {
        uint16 public total;

        function add(uint16 value) public {
          total = total * 10 + value;
          require(true);
        }

        function echo(uint16 value) public pure returns (uint16) {
          return value;
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    const coordinatorArtifact = compileString(`pragma solidity ^0.8.0;
      interface ISparseLoopSink {
        function add(uint16 value) external;
        function echo(uint16 value) external view returns (uint16);
      }

      contract SparseLoopCoordinator(address sink) {
        function run(uint16[3] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            if (values[i] != 0) ISparseLoopSink(sink).add(values[i]);
          }
          require(true);
        }

        function runReturning(uint16[3] memory values) public {
          uint16 observed;
          for (uint i = 0; i < values.length; i++) {
            if (values[i] != 0) observed = ISparseLoopSink(sink).echo(values[i]);
          }
          require(observed == 3);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    expect(coordinatorArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(coordinatorArtifact.bytecode.replace(/\s+/gu, '')).toContain('OP_INVOKE');
    const coordinatorBase = new Contract(
      coordinatorArtifact, [sink.inner.lockingBytecode], { provider },
    );
    const coordinatorSetup = await setupStatefulUtxos(
      provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
    );
    coordinator._registerResolvedExternal('ISparseLoopSink', sink);

    const relayArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ISparseLoopCoordinator {
        function run(uint16[3] memory values) external;
        function runReturning(uint16[3] memory values) external;
      }

      contract SparseLoopRelay {
        uint16 public marker;

        function relay(address coordinator, uint16[3] memory values) public {
          this.marker = this.marker + 1;
          ISparseLoopCoordinator(coordinator).run(values);
          require(true);
        }

        function relayReturning(address coordinator, uint16[3] memory values) public {
          this.marker = this.marker + 1;
          ISparseLoopCoordinator(coordinator).runReturning(values);
          require(true);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    expect(relayArtifact.delegateArtifact?.messageBus?.convention).toBe('kernel-row-loop');
    expect(relayArtifact.delegateArtifact?.bytecode.replace(/\s+/gu, '')).toContain('OP_INVOKE');
    const deployed = await upgrades.deployProxy(
      getContractFactory(relayArtifact, signer), { marker: 0n }, { initializer: false },
    );
    deployed.implementation._registerResolvedExternal('ISparseLoopCoordinator', coordinator);

    const buildRows = async (values: bigint[]): Promise<{
      builder: TransactionBuilder;
      call: { send(): Promise<unknown> };
      participants: string[];
    }> => {
      const call = (deployed as any).relay(coordinator.inner.lockingBytecode, values);
      const builder = await call.build();
      const participants = builder.inputs.flatMap((input) => (
        'contract' in input.unlocker ? [input.unlocker.contract.artifact.contractName] : []
      ));
      return { builder, call, participants };
    };

    const values = [2n, 0n, 3n];
    const { builder, call, participants: participantContracts } = await buildRows(values);
    expect(participantContracts.filter((name) => name === 'SparseLoopCoordinator')).toHaveLength(1);
    expect(participantContracts.filter((name) => name === 'SparseLoopSink')).toHaveLength(1);
    expect(vmAccepts(builder)).toBe(true);

    await expect((deployed as any).relayReturning(coordinator.inner.lockingBytecode, values).build())
      .rejects.toThrow(/return metadata has no per-occurrence source identity/);

    // Compact return carriers are sound for a dense zero-based reached prefix: carrier occurrence and source
    // loop indices are then the same authenticated identity even though the final source element is skipped.
    const returningBuilder = await (deployed as any)
      .relayReturning(coordinator.inner.lockingBytecode, [2n, 3n, 0n]).build();
    const returningTransaction = returningBuilder.buildLibauthTransaction();
    const returningSources = generateLibauthSourceOutputs(returningBuilder.inputs);
    const returningVm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < returningTransaction.inputs.length; inputIndex += 1) {
      const state = returningVm.evaluate({
        inputIndex, sourceOutputs: returningSources, transaction: returningTransaction,
      });
      expect(returningVm.stateSuccess(state), `input ${inputIndex}: ${JSON.stringify({
        error: state.error, ip: state.ip, instructions: state.instructions.length,
        nearby: state.instructions.slice(Math.max(0, state.ip - 8), state.ip + 2)
          .map((instruction) => instruction.opcode),
        stack: state.stack.slice(-6).map(binToHex),
      })}`).toBe(true);
    }

    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    // Decimal accumulation distinguishes the compact source-order rows [2, 3] from reversal,
    // duplicated skipped iterations, or a guessed occurrence-zero argument.
    await expect(sink.getState()).resolves.toMatchObject({ total: 23n });
  }, 180_000);

  it('preserves zero, sparse, and full source order for a direct inferred-delegate loop', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x5b), provider);
    for (let index = 0; index < 48; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (0x200n + BigInt(index)).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 500_000n,
      });
    }

    const sinkSource = `pragma solidcash >=0.8.0;
      contract DirectSparseSink {
        uint16 public total;

        function add(uint16 value) public {
          this.total = this.total * 10 + value;
          require(true);
        }
      }`;
    const sinkArtifact = compileString(sinkSource, { ...KERNEL, messageBusGraphContext: true });
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    const relaySource = `pragma solidcash >=0.8.0;
      interface IDirectSparseSink { function add(uint16 value) external; }

      contract DirectSparseRelay {
        uint16 public marker;

        function relay(address sink, uint16[3] memory values) public {
          this.marker = this.marker + 1;
          for (uint i = 0; i < values.length; i++) {
            if (values[i] != 0) IDirectSparseSink(sink).add(values[i]);
          }
          require(true);
        }
      }`;
    const relayArtifact = compileString(relaySource, { ...KERNEL, messageBusGraphContext: true });
    expect(relayArtifact.delegateArtifact?.messageBus?.convention).toBe('kernel-row-loop');
    expect(relayArtifact.delegateArtifact?.bytecode.replace(/\s+/gu, '')).toContain('OP_INVOKE');
    const deployRelay = async (): Promise<ProxyContract> => {
      const deployed = await upgrades.deployProxy(
        getContractFactory(relayArtifact, signer), { marker: 0n }, { initializer: false },
      );
      deployed.implementation._registerResolvedExternal('IDirectSparseSink', sink);
      return deployed;
    };
    const emptyRelay = await deployRelay();
    const activeRelay = await deployRelay();
    const fullRelay = await deployRelay();

    const run = async (
      deployed: Awaited<ReturnType<typeof deployRelay>>,
      values: bigint[], expected: bigint, expectedSinkInputs: number,
    ): Promise<void> => {
      const call = (deployed as any).relay(sink.inner.lockingBytecode, values);
      const builder = await call.build() as TransactionBuilder;
      const participants = builder.inputs.flatMap((input) => (
        'contract' in input.unlocker ? [input.unlocker.contract.artifact.contractName] : []
      ));
      expect(participants.filter((name) => name === 'DirectSparseSink'))
        .toHaveLength(expectedSinkInputs);
      expect(vmAccepts(builder)).toBe(true);
      await expect(call.send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      await expect(sink.getState()).resolves.toMatchObject({ total: expected });
    };

    // A zero-row predicate does not materialize or co-spend the unused callee.
    await run(emptyRelay, [0n, 0n, 0n], 0n, 0);
    await run(activeRelay, [0n, 2n, 3n], 23n, 1);
    await run(fullRelay, [4n, 5n, 6n], 23456n, 1);

    const paritySinkBase = new Contract(sinkArtifact, [], { provider });
    const paritySinkSetup = await setupStatefulUtxos(
      provider, paritySinkBase, sinkArtifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const paritySink = StatefulContract.withCategory(
      paritySinkBase.withCategory(hexToBin(paritySinkSetup.categoryId)), paritySinkSetup.categoryId,
    );
    const parityRelay = await upgrades.deployProxy(
      getContractFactory(relayArtifact, signer), { marker: 0n }, { initializer: false },
    );
    parityRelay.implementation._registerResolvedExternal('IDirectSparseSink', paritySink);
    await expect((parityRelay as any).relay(
      paritySink.inner.lockingBytecode, [2n, 0n, 0n],
    ).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const kernelSingleRowTotal = (await paritySink.getState()).total;
    await expect((parityRelay as any).relay(
      Uint8Array.of(0x51), [2n, 0n, 0n],
    ).build()).rejects.toThrow(/is not connected[\s\S]*Resolved target: 51/);

    const legacyOptions = { ...KERNEL, messageBusKernel: false, messageBusGraphContext: false } as const;
    const legacySinkArtifact = compileString(sinkSource, legacyOptions);
    const legacySinkBase = new Contract(legacySinkArtifact, [], { provider });
    const legacySinkSetup = await setupStatefulUtxos(
      provider, legacySinkBase, legacySinkArtifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const legacySink = StatefulContract.withCategory(
      legacySinkBase.withCategory(hexToBin(legacySinkSetup.categoryId)), legacySinkSetup.categoryId,
    );
    const legacyRelayArtifact = compileString(relaySource, legacyOptions);
    expect(legacyRelayArtifact.delegateArtifact?.messageBus?.convention).toBe('legacy-unroll');
    const legacyRelay = await upgrades.deployProxy(
      getContractFactory(legacyRelayArtifact, signer), { marker: 0n }, { initializer: false },
    );
    legacyRelay.implementation._registerResolvedExternal('IDirectSparseSink', legacySink);
    await expect((legacyRelay as any).relay(
      legacySink.inner.lockingBytecode, [2n, 0n, 0n],
    ).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await legacySink.getState()).total).toBe(kernelSingleRowTotal);
  }, 180_000);

  it('requires target resources only for rows that are actually reached', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x5c), provider);
    for (let index = 0; index < 32; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (0x300n + BigInt(index)).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 500_000n,
      });
    }

    const coordinatorArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IReachableSink { function add(uint16 value) external; }
      contract ReachabilityCoordinator(address sink) {
        function run(uint16[2] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            if (values[i] != 0) IReachableSink(sink).add(values[i]);
          }
          require(true);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const relayArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IReachabilityCoordinator { function run(uint16[2] memory values) external; }
      contract ReachabilityRelay {
        uint16 marker;
        function relay(address coordinator, uint16[2] memory values) public {
          this.marker = this.marker + 1;
          IReachabilityCoordinator(coordinator).run(values);
          require(true);
        }
      }`, { ...KERNEL, messageBusGraphContext: true });

    const makeCoordinator = async (sinkLockingBytecode: Uint8Array): Promise<StatefulContract> => {
      const base = new Contract(coordinatorArtifact, [sinkLockingBytecode], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(
        base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      );
    };
    const makeRelay = async (coordinator: StatefulContract): Promise<ProxyContract> => {
      const deployed = await upgrades.deployProxy(
        getContractFactory(relayArtifact, signer), { marker: 0n }, { initializer: false },
      );
      deployed.implementation._registerResolvedExternal('IReachabilityCoordinator', coordinator);
      return deployed;
    };

    const missingDeploymentCoordinator = await makeCoordinator(Uint8Array.of(0x51));
    const missingDeploymentRelay = await makeRelay(missingDeploymentCoordinator);
    const zeroBuilder = await (missingDeploymentRelay as any).relay(
      missingDeploymentCoordinator.inner.lockingBytecode, [0n, 0n],
    ).build() as TransactionBuilder;
    expect(vmAccepts(zeroBuilder)).toBe(true);
    expect(zeroBuilder.inputs.flatMap((input) => (
      'contract' in input.unlocker ? [input.unlocker.contract.artifact.contractName] : []
    ))).not.toContain('ReachableSink');
    await expect((missingDeploymentRelay as any).relay(
      missingDeploymentCoordinator.inner.lockingBytecode, [1n, 0n],
    ).build()).rejects.toThrow(/callsite .* published target .* does not match a connected .* callee/);

    const missingMasterArtifact = compileString(`pragma solidcash >=0.8.0;
      contract ReachableSink {
        function add(uint16 value) public pure { require(value >= 0); }
        function distinct() public pure returns (uint16) { return 7; }
      }`, { ...KERNEL, messageBusGraphContext: true });
    const missingMasterBase = new Contract(missingMasterArtifact, [], { provider });
    const missingMaster = StatefulContract.withCategory(
      missingMasterBase.withCategory(Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0x82 : 0x7d))),
      '7d'.repeat(31) + '82',
    );
    const missingMasterCoordinator = await makeCoordinator(hexToBin(missingMaster.inner.lockingBytecode));
    missingMasterCoordinator._registerResolvedExternal('IReachableSink', missingMaster);
    const missingMasterRelay = await makeRelay(missingMasterCoordinator);
    const missingMasterZero = await (missingMasterRelay as any).relay(
      missingMasterCoordinator.inner.lockingBytecode, [0n, 0n],
    ).build() as TransactionBuilder;
    expect(vmAccepts(missingMasterZero)).toBe(true);
    await expect((missingMasterRelay as any).relay(
      missingMasterCoordinator.inner.lockingBytecode, [1n, 0n],
    ).build()).rejects.toThrow(/callsite .* occurrence 0 has no master UTXO/);
  }, 180_000);
});
