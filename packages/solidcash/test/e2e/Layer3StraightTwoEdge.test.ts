import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileFileMulti, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import { scriptToBytecode } from '@solidcash/utils';

const BUS_BASE = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: 'aa'.repeat(35),
  experimentalMessageBusControllerCategory: 'ab'.repeat(32),
} as never;

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;
const FIXTURE = new URL('./fixtures/Layer3StraightTwoEdge.sol', import.meta.url).pathname;
const KNOB = 3n;
const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const VM_VERIFY = 'Program failed an OP_VERIFY operation';

type Mutation = 'honest' | 'omit-second' | 'reorder' | 'substitute-target';

interface Attempt {
  sent?: string;
  refusal?: string;
  failingInput?: number;
  invocations: number;
  emissions: readonly string[];
}

async function attempt(mutation: Mutation): Promise<Attempt> {
  const provider = createLayer3SemanticTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const controllerCategory = genesis.categoryId as string;
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };

  const fixtureArtifacts: any = compileFileMulti(FIXTURE, {
    ...options, solidityImportCompat: true, ecrecover: 'p2pkh',
  });
  const calleeArtifact: any = fixtureArtifacts.TwoEdgeCallee;
  const leftBase = new Contract(calleeArtifact, [], { provider });
  const rightBase = new Contract(calleeArtifact, [], { provider });
  const leftSetup = await setupStatefulUtxos(
    provider, leftBase, calleeArtifact.stateLayout!, { brand: 11n },
  );
  const rightSetup = await setupStatefulUtxos(
    provider, rightBase, calleeArtifact.stateLayout!, { brand: 22n },
  );
  const left = leftBase.withCategory(hexToBin(leftSetup.categoryId));
  const right = rightBase.withCategory(hexToBin(rightSetup.categoryId));

  const callerArtifact: any = fixtureArtifacts.TwoEdgeCaller;
  const callerBase = new Contract(callerArtifact, [], { provider });
  const callerState = {
    target: hexToBin(left.lockingBytecode) as never,
    knob: KNOB,
  };
  const callerSetup = await setupStatefulUtxos(
    provider, callerBase, callerArtifact.stateLayout!, callerState,
  );
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  const plannedCallerArtifact = mutation === 'omit-second'
    ? {
      ...callerArtifact,
      abi: callerArtifact.abi.map((entry: any) => entry.name === 'ping'
        ? { ...entry, externalCalls: entry.externalCalls?.slice(0, 1) } : entry),
    }
    : callerArtifact;
  const participants = [
    { artifact: plannedCallerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: calleeArtifact, lockingBytecode: left.lockingBytecode },
    { artifact: calleeArtifact, lockingBytecode: right.lockingBytecode },
  ];
  const first = { parent: 0, callee: 1, function: 'tick', args: [KNOB + 1n] };
  const second = {
    parent: 0,
    callee: mutation === 'substitute-target' ? 2 : 1,
    function: 'tick',
    args: [KNOB + 2n],
  };
  const children = mutation === 'omit-second' ? [first]
    : mutation === 'reorder' ? [second, first] : [first, second];
  const invocations = [{ parent: null, callee: 0, function: 'ping', args: [] }, ...children];
  const usedParticipants = mutation === 'substitute-target' ? participants : participants.slice(0, 2);
  const plan = layer3.planCompiledGraph(usedParticipants, invocations as never);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs,
    plan.participants.map((participant, index) =>
      (participant.batch.results.length > 0 ? layout.returnOutputs![index] : null)),
    plan.participants.map(() => ''), layout.projectionInputs, '',
  );

  const initFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, initFee);
  const initialize = new TransactionBuilder({ provider });
  initialize.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
  initialize.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(initialize));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root)!;

  const projectionUtxos = [];
  for (let index = 0; index < plan.participants.length; index += 1) {
    const utxo = randomUtxo({ satoshis: 1000n });
    await provider.addUtxo(projection.address, utxo);
    projectionUtxos.push(utxo);
  }
  const fee = randomUtxo({ satoshis: 400_000n });
  await provider.addUtxo(p2pkh.address, fee);
  const contracts = [caller, left, right];
  const artifacts = [callerArtifact, calleeArtifact, calleeArtifact];
  const setups = [callerSetup, leftSetup, rightSetup];
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  for (let index = 0; index < plan.participants.length; index += 1) {
    const artifact = artifacts[index];
    const contract = contracts[index];
    const setup = setups[index];
    let dataNft = 0;
    for (const slot of artifact.hiddenBatch.route.blockLayout.slots as any[]) {
      if (slot.kind === 'master') {
        const routeArgs = [...layer3.compiledGraphRouteArgs(
          transcript, index, layout.controllerInput,
        )] as never[];
        if (artifact.hiddenBatch.route.inputs.some(
          (input: any) => input.name === '__internal__returnOutputIdx',
        )) routeArgs.push(BigInt(layout.returnOutputs![index] ?? 0) as never);
        tx.addInput(setup.masterUtxo, contract.createCompilerRouteUnlocker(
          artifact.hiddenBatch.route, hexToBin(artifact.hiddenBatch.selector),
        )(...routeArgs));
        tx.addOutput({
          to: contract.tokenAddress,
          amount: setup.masterUtxo.satoshis,
          token: {
            category: setup.categoryId, amount: 0n,
            nft: { capability: 'minting', commitment: '' },
          },
        });
      } else if (slot.kind === 'dataNft') {
        const utxo = setup.dataNftUtxos[dataNft];
        dataNft += 1;
        tx.addInput(utxo, createDataNftUnlocker(
          contract, layout.participantInputs[index], setup.categoryId,
        ));
        tx.addOutput({
          to: getDataNftAddress(contract, setup.categoryId),
          amount: utxo.satoshis,
          token: utxo.token!,
        });
      } else if (slot.kind === 'returnEvent') {
        const funding = randomUtxo({ satoshis: 1000n });
        await provider.addUtxo(p2pkh.address, funding);
        tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
        tx.addOutput({
          to: hexToBin('51'),
          amount: funding.satoshis,
          token: {
            category: setup.categoryId,
            amount: 0n,
            nft: {
              capability: 'none',
              commitment: binToHex(scriptToBytecode([new Uint8Array(0)])),
            },
          },
        });
      } else {
        throw new Error(`unhandled two-edge slot '${slot.kind}'`);
      }
    }
  }
  projectionUtxos.forEach((utxo, participant) => {
    tx.addInput(utxo, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  });
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({ to: p2pkh.address, amount: 350_000n });

  const report = {
    invocations: plan.invocations.length,
    emissions: (transcript as any).participantEmissionsHex as readonly string[],
  };
  try {
    return { sent: await provider.sendRawTransaction(raw(tx)), ...report };
  } catch (error) {
    const refusal = (error as Error).message;
    return {
      refusal,
      failingInput: Number(refusal.match(/input index (\d+)/)?.[1]),
      ...report,
    };
  }
}

describe('straight-line two-edge graph handler', () => {
  it('admits exactly two straight-line typed statements', () => {
    const artifact: any = compileFileMulti(FIXTURE, {
      ...BUS_BASE, solidityImportCompat: true, ecrecover: 'p2pkh',
    }).TwoEdgeCaller;
    const ping = artifact.hiddenBatch.handlers.find((handler: any) => handler.name === 'ping');
    expect(ping.eligible).toBe(true);
    expect(artifact.abi.find((entry: any) => entry.name === 'ping').externalCalls)
      .toHaveLength(2);
  });

  it('admits the exact Delegatecall_2 Attack.attack as two ordered typed edges', () => {
    const artifacts: any = compileFileMulti(`${SBE}/hacks/delegatecall/Delegatecall_2.sol`, {
      solidityImportCompat: true, ecrecover: 'p2pkh', ...BUS_BASE,
    });
    const attack = artifacts.Attack;
    expect(attack.hiddenBatch.handlers.find((handler: any) => handler.name === 'attack').eligible)
      .toBe(true);
    expect(attack.abi.find((entry: any) => entry.name === 'attack').externalCalls
      .map((call: any) => [call.functionName, call.callsiteId]))
      .toEqual([['doSomething', 0], ['doSomething', 1]]);
  }, 120_000);

  it('settles both authenticated call rows in source order', async () => {
    const result = await attempt('honest');
    expect(result.refusal).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    expect(result.invocations).toBe(3);
    expect(result.emissions[0]).not.toBe('');
  }, 900_000);

  it.each([
    ['omit-second', 'an omitted second row', 'Program called an OP_SPLIT operation with an invalid index'],
    ['reorder', 'reordered rows', VM_VERIFY],
    ['substitute-target', 'a substituted second target', VM_VERIFY],
  ] as const)('refuses %s (%s) at the caller input', async (mutation, _label, reason) => {
    const result = await attempt(mutation);
    expect(result.sent).toBeUndefined();
    expect(result.refusal).toContain(reason);
    expect(result.failingInput).toBe(0);
  }, 900_000);
});
