import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createEntryNftUnlocker, createSatoshiContainerUnlocker,
  getDataNftAddress, getEntryNftAddress, getEventNftAddress, getSatoshiContainerAddress,
} from '../../src/stateful/covenant-helpers.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlot, keyToSlotMulti,
} from '../../src/stateful/SortedList.js';

/**
 * ROUND-15 INDEPENDENT REVIEW of the C1 SEC-6 RESHAPE. Reviewer implemented none of it.
 *
 * The fixture's own hostile matrix rebuilds the whole transaction per row and asserts only that the two builds
 * are the same LENGTH, which it states honestly is evidence about SHAPE and not about the field. Every case here
 * instead mutates ONE field of ONE already-built honest transaction and re-preflights the same bytes, so the
 * control and the attack differ in exactly the mutated bytes and nothing else - no fresh outpoints, no fresh
 * categories, no recompilation.
 *
 * Sources are byte-copies of the capstone's.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

const SHARES = 22n;
const FROM_BALANCE = 100n;
const ALLOWANCE = 50n;
const FIRST_AMOUNT = 10n;
const SECOND_AMOUNT = 20n;
const TOTAL_AMOUNT = FIRST_AMOUNT + SECOND_AMOUNT;
const VAULT_ELASTIC = 12n;
const VAULT_BASE = 9n;
const ACCRUE_COLLATERAL = 5n;
const CONTAINER_SATS = 5_000n;
/** X60: the compiled satoshi effect, above BCHN's 546-satoshi P2PKH dust bar. See Layer3DefiCapstoneC1. */
const TRANSFER_SATS = 1_000n;

const ROUTER = `pragma solidcash >=0.8.0;
interface IC1Token { function transferFrom(bytes20 from, bytes20 to, bigint amount); }
interface IC1Accrue { function accrue(bigint amount); }
interface IC1Notifier { function notify(bigint amount); }
contract C1Router(address token, address accrue, address notifier) {
  bigint settled;
  function settle(
    bytes20 from, bytes20 first, bytes20 second, bigint firstAmount, bigint secondAmount
  ) public {
    IC1Token(token).transferFrom(from, first, firstAmount);
    IC1Token(token).transferFrom(from, second, secondAmount);
    IC1Accrue(accrue).accrue(firstAmount + secondAmount);
    IC1Notifier(notifier).notify(firstAmount + secondAmount);
    this.settled = this.settled + firstAmount + secondAmount;
    require(secondAmount > 0);
  }
}`;

const TOKEN = `pragma solidcash >=0.8.0;
contract C1Token() {
  mapping(bytes20 => bigint) balances;
  mapping(bytes20 => mapping(address => bigint)) allowance;
  function transferFrom(bytes20 from, bytes20 to, bigint amount) public {
    require(this.allowance[from][msg.sender] >= amount);
    require(this.balances[from] >= amount);
    this.allowance[from][msg.sender] = this.allowance[from][msg.sender] - amount;
    this.balances[from] = this.balances[from] - amount;
    this.balances[to] = this.balances[to] + amount;
  }
}`;

const ACCRUE = `pragma solidcash >=0.8.0;
interface IC1Vault { function deposit(bigint amount) returns (bigint); }
contract C1Accrue(address vault) {
  bigint collateral;
  function accrue(bigint amount) public {
    bigint shares = IC1Vault(vault).deposit(amount);
    this.collateral = this.collateral + shares;
    require(shares >= 0);
  }
}`;

const VAULT = `pragma solidcash >=0.8.0;
contract C1Vault() {
  bigint elastic;
  bigint base;
  function deposit(bigint amount) public returns (bigint) {
    bigint shares = amount * this.base / this.elastic;
    this.elastic = this.elastic + amount;
    this.base = this.base + shares;
    require(amount > 0);
    return shares;
  }
}`;

const NOTIFIER = `pragma solidcash >=0.8.0;
contract C1Notifier(bytes recipient) {
  bigint total;
  event Settled(bigint amount);
  function notify(bigint amount) public {
    this.total = this.total + amount;
    emit Settled(amount);
    this.transfer(recipient, ${TRANSFER_SATS});
    require(amount > 0);
  }
}`;

const createOrdinaryCapacityProvider = (): MockNetworkProvider => new MockNetworkProvider({
  consensusLimits: {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 10_000,
    maximumTransactionBytes: 1_000_000,
    maximumNftCommitmentBytes: 128,
    operationCostBudgetPerByte: 800,
    hashDigestIterationsPerByte: 3,
  },
  policy: { enforceDust: false },
});

/**
 * What the build itself varies. Everything a hostile case can reach AFTER assembly is mutated post-build
 * instead, so it shares one build with its control.
 */
type BuildVariant =
  | 'none'
  /**
   * The forgery the fixture's `caller` row cannot distinguish from an entry-slot mismatch: the spender key IS
   * substituted for another co-spent participant AND the co-spent allowance entry is the one that key derives,
   * carrying a real 50-unit allowance. Self-consistent on the collection side; the only thing wrong is that the
   * authenticated graph caller is the Router.
   */
  | 'spender-with-matching-entry'
  /**
   * The reshape's OWN new edge. The Router's emission WITNESS - not the transcript - restates the notify row's
   * target as the Vault. The transcript stays honest, so every projection proof still reads the honest row and
   * only the Router's own route can object. If the Router's clone were flattened out of OP_INVOKE (SEC-6's
   * shape) no emission row is ever recomputed and this witness is accepted.
   */
  | 'router-emission-target-swap'
  /** The matrix's `return-position` row: the transcript declares the Vault's return slot one output earlier. */
  | 'return-position';

interface BuiltC1 {
  provider: ReturnType<typeof createLayer3SemanticTestProvider>;
  builder: TransactionBuilder;
  layout: layer3.CompiledGraphPhysicalLayout;
  plan: layer3.CompiledGraphPlan;
  transcript: layer3.FinalizedCompiledGraph;
  artifacts: Record<string, any>;
  notifier: Contract;
  notifierCategory: string;
  eventAddress: string;
  eventCommitment: string;
}

async function buildC1(
  variant: BuildVariant = 'none',
  createProvider: () => MockNetworkProvider = createLayer3SemanticTestProvider,
): Promise<BuiltC1> {
  const provider = createProvider();
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

  // X60: a REAL P2PKH recipient, not a one-byte OP_1 placeholder that made this output relay dust.
  const recipient = hexToBin(`76a914${binToHex(bobPkh)}88ac`);
  const vaultArtifact = compileString(VAULT, options);
  const vaultBase = new Contract(vaultArtifact, [], { provider });
  const vaultSetup = await setupStatefulUtxos(
    provider, vaultBase, vaultArtifact.stateLayout!, { elastic: VAULT_ELASTIC, base: VAULT_BASE },
  );
  const vault = vaultBase.withCategory(hexToBin(vaultSetup.categoryId));

  const accrueArtifact = compileString(ACCRUE, options);
  const accrueBase = new Contract(accrueArtifact, [vault.lockingBytecode], { provider });
  const accrueSetup = await setupStatefulUtxos(
    provider, accrueBase, accrueArtifact.stateLayout!, { collateral: ACCRUE_COLLATERAL },
  );
  const accrue = accrueBase.withCategory(hexToBin(accrueSetup.categoryId));

  const tokenArtifact = compileString(TOKEN, options);
  const tokenBase = new Contract(tokenArtifact, [], { provider });
  const tokenSetup = await setupStatefulUtxos(provider, tokenBase, tokenArtifact.stateLayout!, {});
  const token = tokenBase.withCategory(hexToBin(tokenSetup.categoryId));

  const notifierArtifact = compileString(NOTIFIER, options);
  const notifierBase = new Contract(notifierArtifact, [recipient], { provider });
  const notifierSetup = await setupStatefulUtxos(
    provider, notifierBase, notifierArtifact.stateLayout!, { total: 0n },
  );
  const notifier = notifierBase.withCategory(hexToBin(notifierSetup.categoryId));

  const routerArtifact = compileString(ROUTER, options);
  const routerBase = new Contract(
    routerArtifact, [token.lockingBytecode, accrue.lockingBytecode, notifier.lockingBytecode], { provider },
  );
  const routerSetup = await setupStatefulUtxos(
    provider, routerBase, routerArtifact.stateLayout!, { settled: 0n },
  );
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  const from = hexToBin('31'.repeat(20));
  const first = hexToBin('32'.repeat(20));
  const second = hexToBin('33'.repeat(20));

  const plan = layer3.planCompiledGraph([
    { artifact: routerArtifact, lockingBytecode: router.lockingBytecode },
    { artifact: tokenArtifact, lockingBytecode: token.lockingBytecode },
    { artifact: accrueArtifact, lockingBytecode: accrue.lockingBytecode },
    { artifact: vaultArtifact, lockingBytecode: vault.lockingBytecode },
    { artifact: notifierArtifact, lockingBytecode: notifier.lockingBytecode },
  ], [
    {
      parent: null, callee: 0, function: 'settle', args: [from, first, second, FIRST_AMOUNT, SECOND_AMOUNT],
    },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, first, FIRST_AMOUNT] },
    { parent: 0, callee: 1, function: 'transferFrom', args: [from, second, SECOND_AMOUNT] },
    { parent: 0, callee: 2, function: 'accrue', args: [TOTAL_AMOUNT] },
    { parent: 3, callee: 3, function: 'deposit', args: [TOTAL_AMOUNT] },
    { parent: 0, callee: 4, function: 'notify', args: [TOTAL_AMOUNT] },
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const [
    routerBaseInput, tokenBaseInput, accrueBaseInput, vaultBaseInput, notifierBaseInput,
  ] = layout.participantInputs;

  const sharesResult = scriptToBytecode([bigIntToVmNumber(SHARES)]);
  const declaredReturnOutputs = variant === 'return-position'
    ? layout.returnOutputs!.map((slot, participant) => (participant === 3 ? slot! - 1 : slot))
    : layout.returnOutputs;
  const transcript = layer3.finalizeCompiledGraph(
    plan, { 4: binToHex(sharesResult) }, layout.participantInputs, declaredReturnOutputs,
    ['', '', '', binToHex(sharesResult), ''], layout.projectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const rootingFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, rootingFee);
  const rootingTx = new TransactionBuilder({ provider });
  rootingTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  rootingTx.addInput(rootingFee, p2pkh.unlock.spend(alicePub, signature()));
  rootingTx.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  rootingTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(rootingTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
  if (!rootedController) throw new Error('C1 review harness did not root its graph controller');

  const balanceRows = [from, first, second]
    .map((key) => ({ key, slot: keyToSlot(key), value: binToHex(key) === binToHex(from) ? FROM_BALANCE : 0n }))
    .sort((left, right) => Number(bytesToSlotValue(left.slot) - bytesToSlotValue(right.slot)));
  const balanceCommitments = new Map(balanceRows.map((row, index) => [
    binToHex(row.slot),
    encodeEntryCommitment(
      row.slot, balanceRows[index + 1]?.slot ?? new Uint8Array(32), bigIntToVmNumber(row.value),
    ),
  ]));
  // THE ONE BUILD-TIME VARIABLE: whose key the co-spent allowance entry is derived from.
  const spender = variant === 'spender-with-matching-entry' ? accrue : router;
  const allowanceSlot = keyToSlotMulti([from, hexToBin(spender.lockingBytecode)]);
  const allowanceCommitment = encodeEntryCommitment(
    allowanceSlot, new Uint8Array(32), bigIntToVmNumber(ALLOWANCE),
  );
  const balanceEntryByKey = new Map([from, first, second].map((key) => [binToHex(key), randomUtxo({
    satoshis: 10_000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable' as const,
        commitment: binToHex(balanceCommitments.get(binToHex(keyToSlot(key)))!),
      },
    },
  })]));
  const allowanceEntry = randomUtxo({
    satoshis: 10_000n,
    token: {
      category: tokenSetup.categoryId,
      amount: 0n,
      nft: { capability: 'mutable' as const, commitment: binToHex(allowanceCommitment) },
    },
  });
  const entries = [
    balanceEntryByKey.get(binToHex(from))!, allowanceEntry,
    balanceEntryByKey.get(binToHex(first))!, balanceEntryByKey.get(binToHex(second))!,
  ];
  for (const [, entry] of balanceEntryByKey) {
    await provider.addUtxo(getEntryNftAddress(token, tokenSetup.categoryId, 'balances'), entry);
  }
  await provider.addUtxo(getEntryNftAddress(token, tokenSetup.categoryId, 'allowance'), allowanceEntry);

  const container = randomUtxo({ satoshis: CONTAINER_SATS });
  await provider.addUtxo(getSatoshiContainerAddress(notifier, notifierSetup.categoryId), container);
  const notifierSlotFunding = Array.from({ length: 16 }, () => randomUtxo({ satoshis: 1000n }));
  const returnFunding = randomUtxo({ satoshis: 1000n });
  const projectionUtxos = Array.from({ length: 5 }, () => randomUtxo({ satoshis: 1000n }));
  const fee = randomUtxo({ satoshis: 500_000n });
  for (const utxo of [...notifierSlotFunding, returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);

  const routeUnlocker = (contract: Contract, artifact: typeof routerArtifact): any => contract
    .createCompilerRouteUnlocker(artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector));
  const routerRoute = routeUnlocker(router, routerArtifact);
  const tokenRoute = routeUnlocker(token, tokenArtifact);
  const accrueRoute = routeUnlocker(accrue, accrueArtifact);
  const vaultRoute = routeUnlocker(vault, vaultArtifact);
  const notifierRoute = routeUnlocker(notifier, notifierArtifact);

  const tokenRouteArgs = [
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput),
  ] as FunctionArgument[];
  if (variant === 'spender-with-matching-entry') tokenRouteArgs[7] = hexToBin(accrue.lockingBytecode);
  const journalOrder = [1, 0, 2, 3];
  for (const routeSlot of journalOrder) {
    const decoded = decodeEntryCommitment(hexToBin(entries[routeSlot].token!.nft!.commitment));
    tokenRouteArgs.push(decoded.slot, BigInt(journalOrder.indexOf(routeSlot) + 1), decoded.nextKey, -1n);
  }
  tokenRouteArgs.push(0n);

  const routerRouteArgs = [
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput),
  ] as FunctionArgument[];
  if (variant === 'router-emission-target-swap') {
    // Length-preserving: every participant is a 35-byte p2sh32, and only the notify row names the Notifier.
    const emissions = binToHex(routerRouteArgs[5] as Uint8Array);
    const swapped = emissions.replace(notifier.lockingBytecode, vault.lockingBytecode);
    if (swapped === emissions) throw new Error('C1 review: notify target not found in the emission witness');
    routerRouteArgs[5] = hexToBin(swapped);
  }

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(routerSetup.masterUtxo, routerRoute(...routerRouteArgs as any));
  tx.addInput(
    routerSetup.dataNftUtxos[0], createDataNftUnlocker(router, routerBaseInput, routerSetup.categoryId),
  );
  tx.addInput(tokenSetup.masterUtxo, tokenRoute(...tokenRouteArgs as any));
  journalOrder.forEach((routeSlot) => tx.addInput(entries[routeSlot], createEntryNftUnlocker(
    token, tokenBaseInput, tokenSetup.categoryId, routeSlot === 1 ? 'allowance' : 'balances',
  )));
  tx.addInput(
    accrueSetup.masterUtxo,
    accrueRoute(...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any),
  );
  tx.addInput(
    accrueSetup.dataNftUtxos[0], createDataNftUnlocker(accrue, accrueBaseInput, accrueSetup.categoryId),
  );
  tx.addInput(vaultSetup.masterUtxo, vaultRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 3, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![3]!),
  ));
  tx.addInput(
    vaultSetup.dataNftUtxos[0], createDataNftUnlocker(vault, vaultBaseInput, vaultSetup.categoryId),
  );
  tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
  tx.addInput(
    notifierSetup.masterUtxo,
    notifierRoute(...layer3.compiledGraphRouteArgs(transcript, 4, layout.controllerInput) as any),
  );
  tx.addInput(
    notifierSetup.dataNftUtxos[0],
    createDataNftUnlocker(notifier, notifierBaseInput, notifierSetup.categoryId),
  );
  tx.addInput(container, createSatoshiContainerUnlocker(notifier, notifierBaseInput, notifierSetup.categoryId));
  notifierSlotFunding.forEach((funding) => tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature())));
  projectionUtxos.forEach((proof, participant) => tx.addInput(proof, projection.unlock.verify(
    transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
  )));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const eventCommitment = binToHex(scriptToBytecode([bigIntToVmNumber(TOTAL_AMOUNT)]));
  const eventAddress = getEventNftAddress(
    notifier, notifierSetup.categoryId, notifierArtifact.events![0].signature,
  );
  tx.addOutput({
    to: router.tokenAddress,
    amount: routerSetup.masterUtxo.satoshis,
    token: { category: routerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(router, routerSetup.categoryId),
    amount: routerSetup.dataNftUtxos[0].satoshis,
    token: {
      category: routerSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(routerArtifact.stateLayout!, { settled: TOTAL_AMOUNT })[0],
      },
    },
  });
  tx.addOutput({
    to: token.tokenAddress,
    amount: tokenSetup.masterUtxo.satoshis,
    token: { category: tokenSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  const nextBalances = new Map<string, bigint>([
    [binToHex(from), FROM_BALANCE - TOTAL_AMOUNT],
    [binToHex(first), FIRST_AMOUNT],
    [binToHex(second), SECOND_AMOUNT],
  ]);
  for (const routeSlot of journalOrder) {
    const entry = entries[routeSlot];
    const decoded = decodeEntryCommitment(hexToBin(entry.token!.nft!.commitment));
    const value = routeSlot === 1
      ? bigIntToVmNumber(ALLOWANCE - TOTAL_AMOUNT)
      : bigIntToVmNumber(nextBalances.get(
        [from, first, second].map(binToHex)
          .find((key) => binToHex(keyToSlot(hexToBin(key))) === binToHex(decoded.slot))!,
      )!);
    tx.addOutput({
      to: getEntryNftAddress(token, tokenSetup.categoryId, routeSlot === 1 ? 'allowance' : 'balances'),
      amount: entry.satoshis,
      token: {
        category: tokenSetup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(decoded.slot, decoded.nextKey, value)),
        },
      },
    });
  }
  tx.addOutput({
    to: accrue.tokenAddress,
    amount: accrueSetup.masterUtxo.satoshis,
    token: { category: accrueSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(accrue, accrueSetup.categoryId),
    amount: accrueSetup.dataNftUtxos[0].satoshis,
    token: {
      category: accrueSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(accrueArtifact.stateLayout!, {
          collateral: ACCRUE_COLLATERAL + SHARES,
        })[0],
      },
    },
  });
  tx.addOutput({
    to: vault.tokenAddress,
    amount: vaultSetup.masterUtxo.satoshis,
    token: { category: vaultSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(vault, vaultSetup.categoryId),
    amount: vaultSetup.dataNftUtxos[0].satoshis,
    token: {
      category: vaultSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(vaultArtifact.stateLayout!, {
          elastic: VAULT_ELASTIC + TOTAL_AMOUNT, base: VAULT_BASE + SHARES,
        })[0],
      },
    },
  });
  tx.addOutput({
    to: hexToBin('51'),
    amount: 1000n,
    token: {
      category: vaultSetup.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: binToHex(scriptToBytecode([sharesResult])) },
    },
  });
  tx.addOutput({
    to: notifier.tokenAddress,
    amount: notifierSetup.masterUtxo.satoshis,
    token: { category: notifierSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(notifier, notifierSetup.categoryId),
    amount: notifierSetup.dataNftUtxos[0].satoshis,
    token: {
      category: notifierSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(notifierArtifact.stateLayout!, { total: TOTAL_AMOUNT })[0],
      },
    },
  });
  tx.addOutput({
    to: getSatoshiContainerAddress(notifier, notifierSetup.categoryId),
    amount: CONTAINER_SATS - TRANSFER_SATS,
  });
  tx.addOutput({ to: recipient, amount: TRANSFER_SATS });
  for (let slot = 0; slot < 7; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({
    to: eventAddress,
    amount: 1000n,
    token: {
      category: notifierSetup.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: eventCommitment },
    },
  });
  for (let slot = 0; slot < 7; slot += 1) tx.addOutput({ to: p2pkh.address, amount: 1000n });
  projectionUtxos.forEach(() => tx.addOutput({ to: p2pkh.address, amount: 1000n }));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });

  return {
    provider,
    builder: tx,
    layout,
    plan,
    transcript,
    artifacts: {
      router: routerArtifact, token: tokenArtifact, accrue: accrueArtifact,
      vault: vaultArtifact, notifier: notifierArtifact,
    },
    notifier,
    notifierCategory: notifierSetup.categoryId,
    eventAddress,
    eventCommitment,
  };
}

const preflightOutcome = (built: BuiltC1): string => {
  try {
    layer3.preflightLayer3Transaction(built.builder);
    return 'ACCEPTED';
  } catch (error) {
    return (error as Error).message;
  }
};

/** The exact input a mutated build is refused at, or ACCEPTED. */
const refusedAt = (outcome: string): number | 'ACCEPTED' => {
  if (outcome === 'ACCEPTED') return 'ACCEPTED';
  const match = /preflight failed at input (\d+)/.exec(outcome);
  if (!match) throw new Error(`unparsed refusal: ${outcome}`);
  return Number(match[1]);
};

/** Physical indices this assembly produces; asserted before any case relies on them. */
const NOTIFIER_BASE = 12;
const EVENT_SLOT_0 = NOTIFIER_BASE + 11;
const TRANSFER_SLOT_0 = NOTIFIER_BASE + 3;

describe('R2 review: C1 reshape, single-build one-variable mutations', () => {
  it('R2-C1-0: the honest control settles, and the reshape indices are what the fixture claims', async () => {
    const built = await buildC1();
    expect(built.layout.participantInputs).toEqual([0, 2, 7, 9, 12]);
    expect(built.layout.controllerInput).toBe(36);
    expect(built.layout.totalSlots).toBe(38);
    const notifierSlots = built.plan.participants[4].blockLayout!.slots;
    expect(notifierSlots.filter((slot) => slot.kind === 'event')).toHaveLength(8);
    expect(notifierSlots.filter((slot) => slot.kind === 'transfer')).toHaveLength(8);
    expect(notifierSlots.filter((slot) => slot.kind === 'event')
      .map((slot) => slot.offset).sort((a, b) => a - b)).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
    expect(notifierSlots.filter((slot) => slot.kind === 'transfer')
      .map((slot) => slot.offset).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(preflightOutcome(built)).toBe('ACCEPTED');
  }, 300_000);

  /**
   * THE RESHAPE'S OWN NEW SURFACE. Moving the `emit` onto a LEAF gave that leaf a route with EIGHT reserved
   * event slots, of which exactly one is reached. The seven unreached ones are ordinary p2pkh funding outputs
   * in the honest build. If nothing binds them, any spender parks a forged own-category immutable NFT at the
   * event covenant address there and `readEventsFromChain` returns it as a genuine `Settled(..)` log.
   *
   * One mutated output on one honest build; every other byte, and every witness, is the control's.
   */
  it.each([1, 2, 7])(
    'R2-C1-A: a forged event NFT at UNREACHED reserved event slot %i',
    async (slot) => {
      const built = await buildC1();
      const output = EVENT_SLOT_0 + slot;
      expect(preflightOutcome(built)).toBe('ACCEPTED');
      const honest = built.builder.outputs[output];
      // The honest slot is token-free p2pkh funding.
      expect(honest.token).toBeUndefined();

      built.builder.outputs[output] = {
        to: built.eventAddress,
        amount: 1000n,
        token: {
          category: built.notifierCategory,
          amount: 0n,
          nft: { capability: 'none', commitment: binToHex(scriptToBytecode([bigIntToVmNumber(999n)])) },
        },
      } as never;
      const outcome = preflightOutcome(built);
      expect(
        refusedAt(outcome),
        `forged event NFT at reserved event slot ${slot} (output ${output}): ${outcome}`,
      ).not.toBe('ACCEPTED');
    },
    300_000,
  );

  /**
   * The same question for the other effect the reshape moved: seven unreached reserved TRANSFER slots.
   * A satoshi drain has to come out of the container, so this asks only whether the slot is bound at all.
   */
  it('R2-C1-B: an extra payment at an UNREACHED reserved transfer slot', async () => {
    const built = await buildC1();
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    const output = TRANSFER_SLOT_0 + 1;
    expect(built.builder.outputs[output].token).toBeUndefined();
    // Pay the compiled recipient at an unreached slot, out of fee-funded satoshis.
    built.builder.outputs[output] = { to: hexToBin('51'), amount: 1000n } as never;
    const outcome = preflightOutcome(built);
    // Recorded either way: this is a measurement, not an assertion of a defect.
    expect(typeof outcome).toBe('string');
    console.log(`R2-C1-B unreached transfer slot ${output}: ${outcome.slice(0, 160)}`);
  }, 300_000);

  /**
   * The version of R2-C1-B that would be a THEFT: the extra payment at the unreached transfer slot is taken
   * out of the contract's own satoshi container instead of out of the spender's fee input. Satoshi-neutral, so
   * only the container's value covenant can object.
   */
  it('R2-C1-B2: draining the satoshi container through an unreached transfer slot', async () => {
    const built = await buildC1();
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    const containerOutput = NOTIFIER_BASE + 2;
    const spare = TRANSFER_SLOT_0 + 1;
    expect(built.builder.outputs[containerOutput].amount).toBe(CONTAINER_SATS - FIRST_AMOUNT);
    built.builder.outputs[containerOutput] = {
      ...built.builder.outputs[containerOutput], amount: CONTAINER_SATS - FIRST_AMOUNT - 1000n,
    } as never;
    built.builder.outputs[spare] = { to: hexToBin('51'), amount: 2000n } as never;
    const outcome = preflightOutcome(built);
    console.log(`R2-C1-B2 container drain via slot ${spare}: ${outcome.slice(0, 160)}`);
    expect(refusedAt(outcome), 'the satoshi container is drained through an unreached transfer slot')
      .not.toBe('ACCEPTED');
  }, 300_000);

  /**
   * The reserved-slot question that is NOT about events: the participant's own MINTING master is co-spent, so
   * any spender can mint own-category NFTs as outputs. A second own-category MUTABLE NFT parked at the data-NFT
   * address, in one of the reshape's unreached reserved slots, would be readable as this contract's state.
   */
  it.each([
    { kind: 'mutable' as const, at: 'transfer' as const },
    { kind: 'mutable' as const, at: 'event' as const },
  ])('R2-C1-J: a forged own-category $kind data NFT at an unreached $at slot', async ({ kind, at }) => {
    const built = await buildC1();
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    const output = (at === 'transfer' ? TRANSFER_SLOT_0 : EVENT_SLOT_0) + 3;
    expect(built.builder.outputs[output].token).toBeUndefined();
    built.builder.outputs[output] = {
      to: getDataNftAddress(built.notifier, built.notifierCategory),
      amount: 1000n,
      token: {
        category: built.notifierCategory,
        amount: 0n,
        nft: {
          capability: kind,
          commitment: buildInitialStateCommitments(
            built.artifacts.notifier.stateLayout!, { total: 999_999n },
          )[0],
        },
      },
    } as never;
    const outcome = preflightOutcome(built);
    console.log(`R2-C1-J forged ${kind} data NFT at unreached ${at} slot ${output}: ${outcome.slice(0, 160)}`);
    expect(outcome, `a forged ${kind} data NFT settles at output ${output}`).not.toBe('ACCEPTED');
  }, 300_000);

  /**
   * THE HOSTILE-MATRIX ATTRIBUTION CHECK. Each row of C1's matrix is reproduced as a mutation of ONE field of
   * ONE honest build, so the control differs in exactly the named bytes. The refusing input must be the one the
   * matrix names.
   */
  it('R2-C1-C: every output-side matrix row is refused at the input its name claims', async () => {
    const built = await buildC1();
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    const outputs = built.builder.outputs;
    const snapshot = outputs.map((output) => ({ ...output }));
    const restore = (): void => { snapshot.forEach((output, index) => { outputs[index] = { ...output } as never; }); };
    const withCommitment = (index: number, commitment: string): void => {
      outputs[index] = {
        ...snapshot[index],
        token: { ...(snapshot[index] as any).token, nft: { ...(snapshot[index] as any).token.nft, commitment } },
      } as never;
    };
    const results: Record<string, number | 'ACCEPTED'> = {};

    // allowance: the allowance entry settles undebited. Output 3 is the allowance row (journal order).
    const allowanceOutput = 3;
    const allowanceDecoded = decodeEntryCommitment(
      hexToBin((snapshot[allowanceOutput] as any).token.nft.commitment),
    );
    withCommitment(allowanceOutput, binToHex(encodeEntryCommitment(
      allowanceDecoded.slot, allowanceDecoded.nextKey, bigIntToVmNumber(ALLOWANCE),
    )));
    results.allowance = refusedAt(preflightOutcome(built));
    restore();

    // continuation: the Accrue post-state uses a share value other than the authenticated result.
    withCommitment(8, buildInitialStateCommitments(built.artifacts.accrue.stateLayout!, {
      collateral: ACCRUE_COLLATERAL + SHARES + 1n,
    })[0]);
    results.continuation = refusedAt(preflightOutcome(built));
    restore();

    // result: the Vault's return-event NFT carries an uncommitted share value.
    withCommitment(11, binToHex(scriptToBytecode([scriptToBytecode([bigIntToVmNumber(SHARES + 1n)])])));
    results.result = refusedAt(preflightOutcome(built));
    restore();

    // resource: the satoshi effect pays a different amount than the compiled call.
    outputs[15] = { ...snapshot[15], amount: FIRST_AMOUNT + 1n } as never;
    results.resource = refusedAt(preflightOutcome(built));
    restore();

    // event: the event NFT is sent somewhere other than its event covenant.
    outputs[23] = { ...snapshot[23], to: built.notifier.tokenAddress } as never;
    results.event = refusedAt(preflightOutcome(built));
    restore();

    // event-argument: the event NFT publishes an argument the handler did not emit.
    withCommitment(23, binToHex(scriptToBytecode([bigIntToVmNumber(TOTAL_AMOUNT + 1n)])));
    results['event-argument'] = refusedAt(preflightOutcome(built));
    restore();

    // And the restored build is the control again: byte-identical acceptance.
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    console.log('R2-C1-C single-build refusal indices:', JSON.stringify(results));
    expect(results).toEqual({
      allowance: 2,
      continuation: 7,
      result: 9,
      resource: 12,
      event: 12,
      'event-argument': 12,
    });
  }, 300_000);

  /**
   * THE `caller` ROW, ASKED PROPERLY. The fixture substitutes only the spender witness, which also breaks the
   * derived entry slot, so its refusal is equally explained by "this key does not derive the co-spent entry".
   * Here the co-spent allowance entry IS the one the substituted key derives and carries a real 50-unit
   * allowance. Only one thing is wrong: the authenticated graph caller is the Router, not the Accrue.
   */
  it('R2-C1-D: a self-consistent spender substitution is still refused, and at the token master', async () => {
    const control = await buildC1();
    expect(preflightOutcome(control)).toBe('ACCEPTED');

    // The witness index the fixture substitutes really is the allowance sender key.
    const routeAbi = (control.artifacts.token.hiddenBatch!.route as any).inputs;
    expect(routeAbi[7].name).toBe('__scb_key_allowance_sender_1');

    const attacked = await buildC1('spender-with-matching-entry');
    const outcome = preflightOutcome(attacked);
    console.log(`R2-C1-D self-consistent spender substitution: ${outcome.slice(0, 200)}`);
    expect(refusedAt(outcome)).toBe(2);
  }, 300_000);

  /**
   * DOES THE RESHAPE DEPEND ON THE FORGEABLE SHAPE BY ANOTHER ROUTE? SEC-6's defect is an emission clone
   * flattened out of OP_INVOKE, whose outgoing edges then generate with no emission row to recompute. Measured
   * directly on the five compiled participants: every participant that HAS an outgoing edge must carry emission
   * binding sites, and the two that carry the physical effects must not be callers.
   */
  it('R2-C1-E: every calling participant in the reshaped graph is emission-bound', async () => {
    const built = await buildC1();
    // `verifyGraphEmissionRow`'s target||len||mode frame construction; 0 means flattened and unbound.
    const MARK = '76827752807c7e';
    const marksOf = (artifact: any): number => (artifact.debug!.bytecode as string).split(MARK).length - 1;
    const callers = new Set(built.plan.invocations
      .filter((invocation) => invocation.parent !== null)
      .map((invocation) => built.plan.invocations[invocation.parent!].callee));
    expect([...callers].sort((a, b) => a - b)).toEqual([0, 2]);
    const byIndex = ['router', 'token', 'accrue', 'vault', 'notifier'];
    const marks = byIndex.map((name) => marksOf(built.artifacts[name]));
    // The per-handler projection is the signal the layout is not: it names the handler, not the block.
    const handlers = Object.fromEntries(byIndex.map((name) => [name, (built.artifacts[name].hiddenBatch
      ?.handlers ?? []).map((handler: any) => `${handler.name}:${handler.eligible}`)]));
    console.log('R2-C1-E emission-binding sites per participant:', JSON.stringify(
      Object.fromEntries(byIndex.map((name, index) => [name, marks[index]])),
    ));
    console.log('R2-C1-E per-handler eligibility:', JSON.stringify(handlers));
    for (const participant of callers) {
      expect(marks[participant], `participant ${participant} (${byIndex[participant]}) binding sites`)
        .toBeGreaterThan(0);
    }
    // The effect owner is a leaf: it appears as a callee and never as a parent's callee.
    expect(callers.has(4)).toBe(false);
  }, 300_000);

  /**
   * The decisive form of the same question, at the VM rather than in the artifact. Only the Router's emission
   * WITNESS misstates the reshape's new edge; the transcript, and therefore every projection proof, is honest.
   * Acceptance here would mean the caller never recomputes that row - SEC-6's defect by another route.
   */
  it('R2-C1-G: a restated notify target in the Router\'s emission witness is refused at the Router', async () => {
    const control = await buildC1();
    expect(preflightOutcome(control)).toBe('ACCEPTED');
    const attacked = await buildC1('router-emission-target-swap');
    const outcome = preflightOutcome(attacked);
    console.log(`R2-C1-G restated notify target: ${outcome.slice(0, 200)}`);
    expect(refusedAt(outcome)).toBe(0);
  }, 300_000);

  /**
   * The one matrix row the controller owns. The Vault's block is inputs 9..11, so declaring 10 keeps the slot
   * inside the block; what refuses it is the transcript binding the declared slot to the committed result. The
   * refusal must land at the controller and not earlier - preflight reports the FIRST failing input, so an
   * index of 36 also states that inputs 0..35, every route and every projection proof, accepted the transcript.
   */
  it('R2-C1-H: declaring the return slot elsewhere inside the Vault block is refused at the controller', async () => {
    const attacked = await buildC1('return-position');
    const outcome = preflightOutcome(attacked);
    console.log(`R2-C1-H return-position: ${outcome.slice(0, 200)}`);
    expect(refusedAt(outcome)).toBe(36);
  }, 300_000);

  /**
   * WHAT THE RESHAPE WAS FOR. Both capstone headers state the reshape's premise as a live compiler refusal:
   * C1 says "a handler carrying an `emit` or a `transfer` has physical effects, so its graph clone is flattened
   * out of OP_INVOKE ... They now live on a fifth participant"; C3 says the same shape is "measured FORGEABLE
   * and refused by name (SEC-6)". Compiled at THIS commit, the pre-reshape shapes are neither flattened nor
   * refused: X29 keeps an effect-carrying clone behind OP_INVOKE and reserves a per-site frame for it, and
   * `InlineStoragePointerCalls.keepsGraphEmissionBinding` now returns true for exactly this case
   * (`!hasPhysicalEffects(fn) || hasOutgoingCall(fn)`).
   */
  it('R2-C1-I: the PRE-reshape C1 Router and C3 Router both compile bound at this commit', () => {
    const MARK = '76827752807c7e';
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `76a914${'11'.repeat(20)}88ac`,
      experimentalMessageBusControllerCategory: 'ab'.repeat(32),
    };
    // C1's Router as it stood BEFORE the SEC-6 reshape: three outgoing calls plus the two physical effects.
    const preReshapeC1 = compileString(`pragma solidcash >=0.8.0;
interface IC1Token { function transferFrom(bytes20 from, bytes20 to, bigint amount); }
interface IC1Accrue { function accrue(bigint amount); }
contract C1RouterPreReshape(address token, address accrue, bytes recipient) {
  bigint settled;
  event Settled(bigint amount);
  function settle(
    bytes20 from, bytes20 first, bytes20 second, bigint firstAmount, bigint secondAmount
  ) public {
    IC1Token(token).transferFrom(from, first, firstAmount);
    IC1Token(token).transferFrom(from, second, secondAmount);
    IC1Accrue(accrue).accrue(firstAmount + secondAmount);
    this.settled = this.settled + firstAmount + secondAmount;
    emit Settled(firstAmount + secondAmount);
    this.transfer(recipient, 10);
    require(secondAmount > 0);
  }
}`, options) as any;
    // C3's Router as it stood BEFORE the reshape: three outgoing calls plus the two physical effects.
    const preReshapeC3 = compileString(`pragma solidcash >=0.8.0;
interface IC3Ledger { function record(bigint v); }
interface IC3Broker { function broker(bigint v); }
interface IC3Escrow { function hold(bigint v); }
contract C3RouterPreReshape(address ledger, address broker, address escrow, bytes payee) {
  bigint fired;
  event Fired(bigint amount);
  function run(bigint v) public {
    IC3Ledger(ledger).record(v);
    IC3Broker(broker).broker(v);
    IC3Escrow(escrow).hold(v);
    this.fired = this.fired + v;
    emit Fired(v);
    this.transfer(payee, 10);
    require(v > 0);
  }
}`, options) as any;

    for (const [label, artifact, handler] of [
      ['C1 pre-reshape Router', preReshapeC1, 'settle'], ['C3 pre-reshape Router', preReshapeC3, 'run'],
    ] as const) {
      const marks = (artifact.debug!.bytecode as string).split(MARK).length - 1;
      const physical = (artifact.hiddenBatch?.route?.blockLayout?.slots ?? [])
        .filter((slot: any) => ['event', 'transfer', 'tcTransfer'].includes(slot.kind)).length;
      const entry = artifact.hiddenBatch?.handlers?.find((row: any) => row.name === handler);
      console.log(`R2-C1-I ${label}: route=${artifact.hiddenBatch !== undefined} marks=${marks} `
        + `physicalSlots=${physical} eligible=${entry?.eligible} reason=${entry?.rejectionReason}`);
      // NOT refused, and NOT unbound: a route is synthesized, the handler is eligible, the edges are bound.
      expect(artifact.hiddenBatch, `${label} has no route`).toBeDefined();
      expect(entry?.eligible, `${label} handler ineligible`).toBe(true);
      expect(marks, `${label} lost its emission binding`).toBeGreaterThan(0);
      // And it declares exactly the owner-local physical slots C1's structural guard treats as the signature
      // of forgery - which is why that guard would reject this bound shape.
      expect(physical).toBeGreaterThan(0);
    }
  }, 300_000);

  /**
   * The fixture's recorded capacity figures, re-measured run-to-completion at this commit. Round 13 recorded
   * that the numbers in the comment (projections ~0.52, controller 0.8057) predate X27 by 55 seconds and do
   * not reproduce. This re-measures independently and prints, so the record is a measurement not a citation.
   */
  it('R2-C1-F: re-measure the ordinary-capacity ratios run-to-completion', async () => {
    const built = await buildC1('none', createOrdinaryCapacityProvider);
    expect(preflightOutcome(built)).toBe('ACCEPTED');
    const transaction = built.builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs as never);
    const vm = createVirtualMachineBch2026ForProvider({
      consensusLimits: {
        maximumInputBytes: 10_000,
        maximumStackItemBytes: 10_000,
        maximumTransactionBytes: 1_000_000,
        maximumNftCommitmentBytes: 128,
        operationCostBudgetPerByte: 800_000,
        hashDigestIterationsPerByte: 3_000,
      },
    } as never);
    const ratios = transaction.inputs.map((_input, input) => {
      const state = vm.evaluate({ inputIndex: input, sourceOutputs, transaction }) as any;
      expect(state.error, `input ${input} failed on the relaxed budget`).toBeUndefined();
      return {
        input,
        bytes: state.metrics.densityControlLength,
        cost: state.metrics.operationCost,
        ratio: state.metrics.operationCost / (state.metrics.densityControlLength * 800),
      };
    });
    console.log('R2-C1-F run-to-completion ratios:', JSON.stringify(
      ratios.map((row) => `${row.input}:${row.ratio.toFixed(4)}`),
    ));
    expect(ratios.filter((row) => row.ratio > 1).map((row) => row.input)).toEqual([]);
  }, 300_000);
});
