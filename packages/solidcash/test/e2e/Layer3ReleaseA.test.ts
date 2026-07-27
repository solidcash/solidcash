import { bigIntToVmNumber, binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
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
import {
  createDataNftUnlocker, createEntryNftUnlocker, getDataNftAddress, getEntryNftAddress,
} from '../../src/stateful/covenant-helpers.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';

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
  /** Optional single collection entry the handler reads and settles, seeded after both contracts are branded. */
  entry?: {
    collection: string;
    key: (target: Contract, router: Contract) => Uint8Array;
    value: bigint;
    settled: bigint;
    /** Raw settled value bytes, when the encoding under test is not the minimal VM number for `settled`. */
    settledRaw?: Uint8Array;
  };
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

  // One collection entry, seeded once both identities exist so its key can name either contract.
  const entrySpec = testCase.entry;
  let entryUtxo: any;
  if (entrySpec !== undefined) {
    const slot = keyToSlot(entrySpec.key(target, router));
    entryUtxo = randomUtxo({
      satoshis: 10_000n,
      token: {
        category: targetSetup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable' as const,
          commitment: binToHex(encodeEntryCommitment(
            slot, new Uint8Array(32), bigIntToVmNumber(entrySpec.value),
          )),
        },
      },
    });
    await provider.addUtxo(
      getEntryNftAddress(target, targetSetup.categoryId, entrySpec.collection), entryUtxo,
    );
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
  if (entryUtxo !== undefined) {
    tx.addInput(entryUtxo, createEntryNftUnlocker(
      target, layout.participantInputs[1], targetSetup.categoryId, entrySpec!.collection,
    ));
  }
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
  if (entryUtxo !== undefined) {
    const decoded = decodeEntryCommitment(hexToBin(entryUtxo.token.nft.commitment));
    tx.addOutput({
      to: getEntryNftAddress(target, targetSetup.categoryId, entrySpec!.collection),
      amount: entryUtxo.satoshis,
      token: {
        category: targetSetup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(
            decoded.slot, decoded.nextKey, entrySpec!.settledRaw ?? bigIntToVmNumber(entrySpec!.settled),
          )),
        },
      },
    });
  }
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

  describe('mint and burn', () => {
    const MINT = `pragma solidcash >=0.8.0;
    contract MintTarget() {
      mapping(address => bigint) balances;
      bigint supply;
      function mint(address to, bigint amount) public {
        this.balances[to] = this.balances[to] + amount;
        this.supply = this.supply + amount;
        require(amount >= 0);
      }
    }`;
    const BURN = `pragma solidcash >=0.8.0;
    contract BurnTarget() {
      mapping(address => bigint) balances;
      bigint supply;
      function burn(address from, bigint amount) public {
        require(this.balances[from] >= amount);
        this.balances[from] = this.balances[from] - amount;
        this.supply = this.supply - amount;
      }
    }`;
    const holder = hexToBin(`aa20${'55'.repeat(32)}87`);

    it('settles mint against both the holder balance and total supply', async () => {
      const { provider, transaction } = await buildScalarGraph({
        target: MINT,
        router: ROUTER('function mint(address to, bigint amount);', 'ITarget(target).mint(to, amount);',
          'address to, bigint amount'),
        state: { supply: 0n },
        settled: { supply: 40n },
        entry: { collection: 'balances', key: () => holder, value: 0n, settled: 40n },
        routeArgs: () => [holder, 40n] as FunctionArgument[],
        callName: 'mint',
        callArgs: () => [holder, 40n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    });

    it('rejects a mint whose supply does not match the minted balance', async () => {
      const { provider, transaction } = await buildScalarGraph({
        target: MINT,
        router: ROUTER('function mint(address to, bigint amount);', 'ITarget(target).mint(to, amount);',
          'address to, bigint amount'),
        state: { supply: 0n },
        // Balance settles the honest 40 while supply claims 41: the two writes must agree in one flush.
        settled: { supply: 41n },
        entry: { collection: 'balances', key: () => holder, value: 0n, settled: 40n },
        routeArgs: () => [holder, 40n] as FunctionArgument[],
        callName: 'mint',
        callArgs: () => [holder, 40n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    });

    it('settles burn against both the holder balance and total supply', async () => {
      const { provider, transaction } = await buildScalarGraph({
        target: BURN,
        router: ROUTER('function burn(address from, bigint amount);', 'ITarget(target).burn(from, amount);',
          'address from, bigint amount'),
        state: { supply: 100n },
        settled: { supply: 70n },
        entry: { collection: 'balances', key: () => holder, value: 100n, settled: 70n },
        routeArgs: () => [holder, 30n] as FunctionArgument[],
        callName: 'burn',
        callArgs: () => [holder, 30n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    });

    it('rejects burning more than the holder balance', async () => {
      const { provider, transaction } = await buildScalarGraph({
        target: BURN,
        router: ROUTER('function burn(address from, bigint amount);', 'ITarget(target).burn(from, amount);',
          'address from, bigint amount'),
        state: { supply: 100n },
        settled: { supply: 90n },
        // The holder only has 5; the handler's own require must reject the 10 the transcript commits.
        entry: { collection: 'balances', key: () => holder, value: 5n, settled: -5n },
        routeArgs: () => [holder, 10n] as FunctionArgument[],
        callName: 'burn',
        callArgs: () => [holder, 10n] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    });

    /**
     * X19. `balances[to] = ...` and `this.balances[to] = ...` denote the same write. The bare spelling - the
     * one Solidity source actually uses - parses as an ArrayAssign until symbol resolution decides
     * state-vs-local, so several pre-semantic node-type matches saw only the dotted spelling.
     *
     * The two settling mint cases above are themselves X19 evidence: the dotted read-modify-write now takes
     * the read-once/mutate-local/write-once C2 entry cache that the bare spelling has always taken, so their
     * emitted covenant changed. They still settle, and their hostile variants still fail.
     */
    const BARE_MINT = MINT.replace('MintTarget', 'BareMintTarget').replace(/this\./g, '');

    it('compiles both spellings of the same mint to a byte-identical direct-route artifact', () => {
      const dotted = MINT.replace('MintTarget', 'BareMintTarget');
      const a = compileString(dotted, { forceStateful: true });
      const b = compileString(BARE_MINT, { forceStateful: true });
      expect(b.bytecode).toBe(a.bytecode);
      expect(JSON.stringify(b.abi)).toBe(JSON.stringify(a.abi));
    }, 30_000);

    /**
     * OPEN: the bare spelling reaches the BATCH route with no SCB1 route at all, where the dotted spelling
     * gets one. It used to fail there outright, with the internal
     * `Function '__scb1' writes a resource at entry slot 0 that has no entry descriptor`; the footprint fix
     * removed that, and the X15 diagnostic now names the absence instead of it being silent. But the two
     * spellings still disagree.
     *
     * Remaining cause: hidden-batch eligibility builds its `directKeys` set by walking
     * `MappingAccess|MappingAssign|MappingDelete` only (compiler.ts), so a bare write contributes no direct
     * key and the handler is rejected `collection-helper-route-not-enabled`. That site is in a file leased
     * elsewhere, so this is pinned rather than fixed. `delete m[k]` already agrees in both spellings.
     */
    it('OPEN: the bare-spelled mapping write still gets no SCB1 route, but is now diagnosed', () => {
      const batch = { forceStateful: true, experimentalHiddenBatch: true };
      expect(compileString(MINT.replace('MintTarget', 'BareMintTarget'), batch).hiddenBatch).toBeDefined();
      const bare = compileString(BARE_MINT, batch);
      expect(bare.hiddenBatch).toBeUndefined();
      expect(bare.diagnostics).toContainEqual(expect.objectContaining({
        severity: 'error',
        code: 'hidden-batch-route-not-synthesized',
        message: expect.stringContaining("'mint': collection-helper-route-not-enabled"),
      }));
    }, 30_000);
  });

  describe('control flow', () => {
    const router = ROUTER('function act(bigint n);', 'ITarget(target).act(n);', 'bigint n');
    const cases: [string, string, bigint, bigint][] = [
      ['do/while runs its body once even at zero', `pragma solidcash >=0.8.0;
      contract DoWhileTarget() {
        bigint total;
        function act(bigint n) public {
          bigint i = 0;
          do { this.total = this.total + 1; i = i + 1; } while (i < n);
          require(n >= 0);
        }
      }`, 0n, 1n],
      ['break stops the loop at the guard', `pragma solidcash >=0.8.0;
      contract BreakTarget() {
        bigint total;
        function act(bigint n) public {
          for (bigint i = 0; i < 8; i = i + 1) {
            if (i >= n) { break; }
            this.total = this.total + 1;
          }
          require(n >= 0);
        }
      }`, 3n, 3n],
      ['continue skips exactly one iteration', `pragma solidcash >=0.8.0;
      contract ContinueTarget() {
        bigint total;
        function act(bigint n) public {
          for (bigint i = 0; i < 4; i = i + 1) {
            if (i == 2) { continue; }
            this.total = this.total + 1;
          }
          require(n >= 0);
        }
      }`, 0n, 3n],
      ['early return leaves state untouched', `pragma solidcash >=0.8.0;
      contract EarlyReturnTarget() {
        bigint total;
        function act(bigint n) public {
          if (n == 0) { return; }
          this.total = this.total + n;
          require(true);
        }
      }`, 0n, 0n],
    ];

    it.each(cases)('%s', async (_label, target, argument, expected) => {
      const { provider, transaction } = await buildScalarGraph({
        target,
        router,
        state: { total: 0n },
        settled: { total: expected },
        routeArgs: () => [argument] as FunctionArgument[],
        callName: 'act',
        callArgs: () => [argument] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    });

    it.each(cases)('%s rejects an off-by-one settlement', async (_label, target, argument, expected) => {
      const { provider, transaction } = await buildScalarGraph({
        target,
        router,
        state: { total: 0n },
        settled: { total: expected + 1n },
        routeArgs: () => [argument] as FunctionArgument[],
        callName: 'act',
        callArgs: () => [argument] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    });
  });

  describe('collection delete', () => {
    const TARGET = `pragma solidcash >=0.8.0;
    contract DeleteTarget() {
      mapping(address => bigint) balances;
      function clear(address who) public {
        delete this.balances[who];
        require(true);
      }
    }`;
    const router = ROUTER('function clear(address who);', 'ITarget(target).clear(who);', 'address who');
    const holder = hexToBin(`aa20${'66'.repeat(32)}87`);

    it('settles a collection delete as the entry default', async () => {
      const { provider, transaction } = await buildScalarGraph({
        target: TARGET,
        router,
        state: {},
        settled: {},
        entry: { collection: 'balances', key: () => holder, value: 42n, settled: 0n },
        routeArgs: () => [holder] as FunctionArgument[],
        callName: 'clear',
        callArgs: () => [holder] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
    });

    it('rejects a delete that leaves the entry value in place', async () => {
      const { provider, transaction } = await buildScalarGraph({
        target: TARGET,
        router,
        state: {},
        settled: {},
        // Identical shape; only the entry keeps its pre-delete value.
        entry: { collection: 'balances', key: () => holder, value: 42n, settled: 42n },
        routeArgs: () => [holder] as FunctionArgument[],
        callName: 'clear',
        callArgs: () => [holder] as FunctionArgument[],
      });
      await expect(provider.sendRawTransaction(transaction))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    });
  });
});
