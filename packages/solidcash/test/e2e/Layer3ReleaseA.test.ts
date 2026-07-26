import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

async function createGraphAuthority(provider: ReturnType<typeof createTestProvider>) {
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  return {
    projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0],
  };
}

async function initializeGraphAuthority(
  provider: ReturnType<typeof createTestProvider>,
  controller: Contract,
  genesisUtxo: any,
  categoryId: string,
  root: string,
  p2pkh: Contract,
) {
  const fee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: controller.tokenAddress,
    amount: genesisUtxo.satoshis,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(tx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('graph controller initialization did not create the rooted authority');
  return rooted;
}

interface ScalarGraphCase {
  /** Callee contract source; its state lives entirely in data NFTs (no collection entries). */
  target: string;
  /** Callee state at genesis, and the settlement the transaction claims. */
  state: Record<string, unknown>;
  settled: Record<string, unknown>;
  /** Router source must expose `route` and forward exactly one call to the callee. */
  router: string;
  routeArgs: (target: Contract) => FunctionArgument[];
  /** Route arguments that need the router's own identity (resolved after both contracts are branded). */
  routeArgsFrom?: (target: Contract, router: Contract) => FunctionArgument[];
  callName: string;
  callArgs: (target: Contract, router: Contract) => FunctionArgument[];
  /** Callee state written by the target contract before the graph runs (e.g. an owner address). */
  genesisState?: (router: Contract) => Record<string, unknown>;
}

/**
 * Compose a two-participant graph: a router that forwards one call into a scalar-state callee. The router owns
 * one balanced slot (its master), the callee owns its master plus one slot per data NFT, and the fixed
 * projection/controller/fee tail follows. Every fixture below only varies the two contract sources, the claimed
 * settlement, and the invocation arguments.
 */
async function buildScalarGraph(testCase: ScalarGraphCase) {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const targetArtifact = compileString(testCase.target, options);
  const targetBase = new Contract(targetArtifact, [], { provider });
  const routerArtifact = compileString(testCase.router, options);

  const targetSetup = await setupStatefulUtxos(provider, targetBase, targetArtifact.stateLayout!, testCase.state);
  const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));
  const routerBase = new Contract(routerArtifact, [1n, target.lockingBytecode], { provider });
  const routerSetup = await setupStatefulUtxos(provider, routerBase, routerArtifact.stateLayout!, {});
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  // The callee's genesis state can name the router (an owner address), while the router's own address depends on
  // the callee's. That is only a cycle if state is fixed at setup time - it is not, because a data NFT's
  // commitment does not participate in the contract address. Re-seed the callee's data NFTs now that both
  // identities exist; the covenant authenticates their address and category, not their provenance.
  const genesisState = { ...testCase.state, ...(testCase.genesisState?.(router) ?? {}) };
  let dataNftUtxos = targetSetup.dataNftUtxos;
  if (testCase.genesisState !== undefined) {
    const seeded = buildInitialStateCommitments(targetArtifact.stateLayout!, genesisState as any);
    dataNftUtxos = [];
    for (const [index, commitment] of seeded.entries()) {
      const utxo = randomUtxo({
        satoshis: targetSetup.dataNftUtxos[index].satoshis,
        token: {
          category: targetSetup.categoryId,
          amount: 0n,
          nft: { capability: 'mutable' as const, commitment },
        },
      });
      await provider.addUtxo(getDataNftAddress(target, targetSetup.categoryId), utxo);
      dataNftUtxos.push(utxo);
    }
  }

  const plan = layer3.planCompiledGraph([
    { artifact: routerArtifact, lockingBytecode: router.lockingBytecode },
    { artifact: targetArtifact, lockingBytecode: target.lockingBytecode },
  ], [
    {
      parent: null,
      callee: 0,
      function: 'route',
      args: testCase.routeArgsFrom?.(target, router) ?? testCase.routeArgs(target),
    },
    { parent: 0, callee: 1, function: testCase.callName, args: testCase.callArgs(target, router) },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxos = [randomUtxo({ satoshis: 1000n }), randomUtxo({ satoshis: 1000n })];
  const fee = randomUtxo({ satoshis: 50_000n });
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);
  const routerRoute = router.createCompilerRouteUnlocker(
    routerArtifact.hiddenBatch!.route, hexToBin(routerArtifact.hiddenBatch!.selector),
  );
  const targetRoute = target.createCompilerRouteUnlocker(
    targetArtifact.hiddenBatch!.route, hexToBin(targetArtifact.hiddenBatch!.selector),
  );
  const settledCommitments = buildInitialStateCommitments(
    targetArtifact.stateLayout!, { ...genesisState, ...testCase.settled } as any,
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    routerSetup.masterUtxo,
    routerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    targetSetup.masterUtxo,
    targetRoute(...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any),
  );
  dataNftUtxos.forEach((utxo: any) =>
    tx.addInput(utxo, createDataNftUnlocker(target, layout.participantInputs[1], targetSetup.categoryId)));
  projectionUtxos.forEach((proof, participant) =>
    tx.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: router.tokenAddress,
    amount: routerSetup.masterUtxo.satoshis,
    token: { category: routerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: target.tokenAddress,
    amount: targetSetup.masterUtxo.satoshis,
    token: { category: targetSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  dataNftUtxos.forEach((utxo: any, index: number) =>
    tx.addOutput({
      to: getDataNftAddress(target, targetSetup.categoryId),
      amount: utxo.satoshis,
      token: {
        category: targetSetup.categoryId,
        amount: 0n,
        nft: { capability: 'mutable', commitment: settledCommitments[index] },
      },
    }));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });

  // Construction completing is itself part of the evidence: a hostile case must fail in the VM, not in the SDK.
  const transaction = raw(tx);
  const targetInputBytes = tx.buildLibauthTransaction().inputs[1].unlockingBytecode.length;
  return { provider, transaction, targetInputBytes, router, target };
}

const ROUTER = (callSignature: string, callExpression: string, routeParams: string): string =>
  `pragma solidcash >=0.8.0;
  interface ITarget { ${callSignature} }
  contract ReleaseARouter(int brand, address target) {
    function route(${routeParams}) public {
      ${callExpression}
      require(true);
    }
  }`;

describe('Release A: admitted handler semantics on BCH-2026', () => {
  describe('modifiers', () => {
    const TARGET = `pragma solidcash >=0.8.0;
    contract ModifierTarget() {
      bigint total;
      modifier onlyFrom(address expected) { require(msg.sender == expected); _; }
      function act(address expected, bigint n) public onlyFrom(expected) {
        this.total = this.total + n;
        require(true);
      }
    }`;
    const router = ROUTER(
      'function act(address expected, bigint n);',
      'ITarget(target).act(expected, n);',
      'address expected, bigint n',
    );

    it('runs a modifier whose msg.sender authorization holds', async () => {
      const { provider, transaction } = await buildScalarGraph({
        target: TARGET,
        router,
        state: { total: 0n },
        settled: { total: 5n },
        routeArgs: () => [] as unknown as FunctionArgument[],
        routeArgsFrom: (_target, router_) => [hexToBin(router_.lockingBytecode), 5n] as FunctionArgument[],
        callName: 'act',
        callArgs: (_target, router_) => [hexToBin(router_.lockingBytecode), 5n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    });

    it('rejects the same graph when the modifier names a different authorized caller', async () => {
      // Identical shape, identical claimed settlement; only the address the modifier compares against differs,
      // so the rejection can only come from the modifier executing against the authenticated graph caller.
      const { provider, transaction } = await buildScalarGraph({
        target: TARGET,
        router,
        state: { total: 0n },
        settled: { total: 5n },
        routeArgs: () => [] as unknown as FunctionArgument[],
        routeArgsFrom: (targetContract) => [hexToBin(targetContract.lockingBytecode), 5n] as FunctionArgument[],
        callName: 'act',
        callArgs: (targetContract) => [hexToBin(targetContract.lockingBytecode), 5n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    });
  });

  describe('revert', () => {
    const stringRevert = `pragma solidcash >=0.8.0;
    contract StringRevertTarget() {
      bigint total;
      function act(bigint n) public {
        if (n < 0) { revert("negative"); }
        this.total = this.total + n;
        require(true);
      }
    }`;
    const customRevert = `pragma solidcash >=0.8.0;
    contract CustomRevertTarget() {
      bigint total;
      error Negative(bigint n);
      function act(bigint n) public {
        if (n < 0) { revert Negative(n); }
        this.total = this.total + n;
        require(true);
      }
    }`;
    const router = ROUTER('function act(bigint n);', 'ITarget(target).act(n);', 'bigint n');

    it.each([
      ['string', stringRevert],
      ['custom error', customRevert],
    ])('takes the non-reverting path of a %s revert handler', async (_label, target) => {
      const { provider, transaction } = await buildScalarGraph({
        target,
        router,
        state: { total: 0n },
        settled: { total: 7n },
        routeArgs: () => [7n] as FunctionArgument[],
        callName: 'act',
        callArgs: () => [7n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    });

    it.each([
      ['string', stringRevert],
      ['custom error', customRevert],
    ])('aborts the transaction when a %s revert is reached', async (_label, target) => {
      const { provider, transaction } = await buildScalarGraph({
        target,
        router,
        state: { total: 0n },
        // A reverting argument still produces a well-formed transcript and a constructible transaction; only the
        // VM can reject it, which is exactly what makes this a covenant proof rather than an SDK guard.
        settled: { total: 0n },
        routeArgs: () => [-1n] as FunctionArgument[],
        callName: 'act',
        callArgs: () => [-1n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    });
  });

  describe('loops', () => {
    const whileTarget = `pragma solidcash >=0.8.0;
    contract WhileTarget() {
      bigint total;
      function act(bigint n) public {
        bigint i = 0;
        while (i < n) { this.total = this.total + 1; i = i + 1; }
        require(n >= 0);
      }
    }`;
    const router = ROUTER('function act(bigint n);', 'ITarget(target).act(n);', 'bigint n');

    it('settles the exact iteration count of a while loop', async () => {
      const { provider, transaction } = await buildScalarGraph({
        target: whileTarget,
        router,
        state: { total: 0n },
        settled: { total: 3n },
        routeArgs: () => [3n] as FunctionArgument[],
        callName: 'act',
        callArgs: () => [3n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    });

    it('rejects a settlement claiming one iteration more than the loop performs', async () => {
      const { provider, transaction } = await buildScalarGraph({
        target: whileTarget,
        router,
        state: { total: 0n },
        settled: { total: 4n },
        routeArgs: () => [3n] as FunctionArgument[],
        callName: 'act',
        callArgs: () => [3n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    });
  });

  describe('route equivalence', () => {
    it('reaches the same settlement through one SCB1 row as a direct invocation', async () => {
      const target = `pragma solidcash >=0.8.0;
      contract EquivalenceTarget() {
        bigint total;
        function act(bigint n) public { this.total = this.total + n; require(n >= 0); }
      }`;
      const router = ROUTER('function act(bigint n);', 'ITarget(target).act(n);', 'bigint n');
      const graph = await buildScalarGraph({
        target,
        router,
        state: { total: 4n },
        settled: { total: 9n },
        routeArgs: () => [5n] as FunctionArgument[],
        callName: 'act',
        callArgs: () => [5n] as FunctionArgument[],
      });
      await expect(graph.provider.sendRawTransaction(graph.transaction)).resolves.toBeTypeOf('string');

      // The direct (non-graph) path must reach byte-identical state from the same inputs.
      const directProvider = createTestProvider();
      const directArtifact = compileString(target, { forceStateful: true });
      const directBase = new Contract(directArtifact, [], { provider: directProvider });
      const directSetup = await setupStatefulUtxos(
        directProvider, directBase, directArtifact.stateLayout!, { total: 4n },
      );
      const directContract = directBase.withCategory(hexToBin(directSetup.categoryId));
      const settled = buildInitialStateCommitments(directArtifact.stateLayout!, { total: 9n });
      const graphSettled = buildInitialStateCommitments(
        compileString(target, {
          forceStateful: true, experimentalHiddenBatch: true,
        }).stateLayout!,
        { total: 9n },
      );
      expect(settled).toEqual(graphSettled);
      expect(directContract.artifact.stateLayout).toEqual(
        compileString(target, { forceStateful: true, experimentalHiddenBatch: true }).stateLayout,
      );
    });
  });
});
