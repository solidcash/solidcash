import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * X111 - the residual SEC-18 left behind: a route-reachable read-only GRAPH EMISSION CLONE.
 *
 * SEC-18 widened the scalar journal closure to every route-reachable function, so a pure reader observes an
 * earlier row's write instead of the pre-transaction commitment. `GenerateTargetTraversal.ts:1774` excludes
 * graph EMISSION clones from that widening: their frame is owned by the graph effect-frame protocol, which
 * already pushes hidden context, so journal slots leave the frame one item deeper than the caller pushes.
 * Widening to them broke C2's honest A -> B -> A cycle at input 0, and a per-slot COMPILE-time refusal
 * false-refused C2 entirely, because route-closure membership is not route-composition membership.
 *
 * The residual is therefore exact: a handler the compiler clones as `__scb_graph_*`, touching a scalar slot
 * and writing none, still reads the pre-state. `compiler.ts` decides that set - `graphTailHandlers` - and a
 * handler reading `msg.sender` under a message-bus controller is in it without making any outgoing call.
 *
 * MEASURED AT BASELINE 8d2fe0b5, before the graph-planning refusal below existed:
 *
 *   H1  withdraw(80) then assertFloor(50) on an opening 100, the guard an emission clone -> SETTLED on the
 *       mocknet VM. `assertFloor(50)` is true of 100 and false of the 20 the same transaction commits.
 *   N1  the identical row set with the ONE differing predicate removed              -> refused at the vault
 *   P1  reader first                                                                -> settled
 *   N3  reader first with a false expectation                                       -> refused at the vault
 *
 * The pair that isolates the cause differs in ONE predicate. `VAULT_PLAIN.assertFloor` closes its body with a
 * tautology over its second parameter; `VAULT_SENDER.assertFloor` closes it with `msg.sender == expectedSender`.
 * Same signature, same balance read, same route. The second is an emission clone; the first is not.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/** Control: the guard is an ordinary handler, so SEC-18's widened closure covers it. */
const VAULT_PLAIN = `pragma solidcash >=0.8.0;
    contract Vault() {
      bigint balance;
      bigint other;
      function withdraw(bigint amount) public {
        this.balance = this.balance - amount;
        require(amount >= 0);
      }
      function bumpOther(bigint n) public {
        this.other = this.other + n;
        require(n >= 0);
      }
      function assertFloor(bigint floor, address expectedSender) public {
        require(this.balance >= floor);
        require(expectedSender.length >= 0);
      }
    }`;

/** Subject: one predicate differs, and it moves the guard into `graphTailHandlers`. */
const VAULT_SENDER = `pragma solidcash >=0.8.0;
    contract Vault() {
      bigint balance;
      bigint other;
      function withdraw(bigint amount) public {
        this.balance = this.balance - amount;
        require(amount >= 0);
      }
      function bumpOther(bigint n) public {
        this.other = this.other + n;
        require(n >= 0);
      }
      function assertFloor(bigint floor, address expectedSender) public {
        require(this.balance >= floor);
        require(msg.sender == expectedSender);
      }
    }`;

type Handler = 'withdraw' | 'bumpOther' | 'assertFloor';

interface Row { fn: Handler; value: bigint }

interface Spec {
  rows: Row[];
  opening: bigint;
  /** Which vault source to compile: the emission-clone subject or the ordinary-handler control. */
  guard: 'sender' | 'plain';
}

interface Built {
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  closing: bigint;
  otherClosing: bigint;
  vaultInput: number;
  /** `compiler.ts` puts a msg.sender-reading handler in `graphTailHandlers`; this is its published form. */
  guardUsesMsgSender: boolean;
}

const SIGNATURES: Readonly<Record<Handler, string>> = {
  withdraw: 'function withdraw(bigint v);',
  bumpOther: 'function bumpOther(bigint v);',
  assertFloor: 'function assertFloor(bigint v, address s);',
};

async function buildGuardGraph(spec: Spec): Promise<Built> {
  const provider = createTestProvider();
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
  const vaultArtifact = compileString(spec.guard === 'sender' ? VAULT_SENDER : VAULT_PLAIN, options);
  const vaultBase = new Contract(vaultArtifact, [], { provider });
  const vaultSetup = await setupStatefulUtxos(
    provider, vaultBase, vaultArtifact.stateLayout!, { balance: spec.opening, other: 0n },
  );
  const vault = vaultBase.withCategory(hexToBin(vaultSetup.categoryId));

  // The ROUTER emits every row from its own body, so the guard row is not a spender's choice. `sender` is a
  // forwarded route parameter because a graph emission handler admits only forwarded identifier arguments.
  const calls = spec.rows.map((row, index) => (row.fn === 'assertFloor'
    ? `        IVault(vault).assertFloor(a${index}, sender);`
    : `        IVault(vault).${row.fn}(a${index});`)).join('\n');
  const params = [...spec.rows.map((_row, index) => `bigint a${index}`), 'address sender'].join(', ');
  const iface = [...new Set(spec.rows.map((row) => row.fn))].map((fn) => SIGNATURES[fn]).join(' ');
  const routerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IVault { ${iface} }
    contract GuardRouter(int brand, address vault) {
      function route(${params}) public {
${calls}
        require(true);
      }
    }`, options);
  const routerBase = new Contract(routerArtifact, [1n, vault.lockingBytecode], { provider });
  const routerSetup = await setupStatefulUtxos(provider, routerBase, routerArtifact.stateLayout!, {});
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  const plan = layer3.planCompiledGraph([
    { artifact: routerArtifact, lockingBytecode: router.lockingBytecode },
    { artifact: vaultArtifact, lockingBytecode: vault.lockingBytecode },
  ], [
    {
      parent: null,
      callee: 0,
      function: 'route',
      args: [...spec.rows.map((row) => row.value), hexToBin(router.lockingBytecode)],
    },
    ...spec.rows.map((row) => ({
      parent: 0,
      callee: 1,
      function: row.fn,
      args: row.fn === 'assertFloor'
        ? [row.value, hexToBin(router.lockingBytecode)]
        : [row.value],
    })),
  ]);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const seedFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, seedFee);
  const seedTx = new TransactionBuilder({ provider });
  seedTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  seedTx.addInput(seedFee, p2pkh.unlock.spend(alicePub, signature()));
  seedTx.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  seedTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(seedTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const projectionUtxos = plan.participants.map(() => randomUtxo({ satoshis: 1000n }));
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  const fee = randomUtxo({ satoshis: 50_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const closing = spec.rows.reduce(
    (running, row) => (row.fn === 'withdraw' ? running - row.value : running), spec.opening,
  );
  const otherClosing = spec.rows.reduce(
    (running, row) => (row.fn === 'bumpOther' ? running + row.value : running), 0n,
  );
  const routeUnlocker = (contract: Contract<any, any>, artifact: any): any =>
    contract.createCompilerRouteUnlocker(artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector));

  const builder = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  builder.addInput(routerSetup.masterUtxo, routeUnlocker(router, routerArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as FunctionArgument[] as any,
  ));
  builder.addInput(vaultSetup.masterUtxo, routeUnlocker(vault, vaultArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as FunctionArgument[] as any,
  ));
  builder.addInput(
    vaultSetup.dataNftUtxos[0],
    createDataNftUnlocker(vault, layout.participantInputs[1], vaultSetup.categoryId),
  );
  projectionUtxos.forEach((proof, participant) =>
    builder.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  builder.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  builder.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  // Outputs are placed by absolute slot from the layout, so a blockSize move does not silently shift them.
  const dataNftOffset = plan.participants[1].blockLayout.slots
    .find((slot) => slot.kind === 'dataNft')!.offset;
  const placed = new Map<number, () => void>([
    [layout.participantInputs[0], () => builder.addOutput({
      to: router.tokenAddress, amount: routerSetup.masterUtxo.satoshis,
      token: { category: routerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    })],
    [layout.participantInputs[1], () => builder.addOutput({
      to: vault.tokenAddress, amount: vaultSetup.masterUtxo.satoshis,
      token: { category: vaultSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    })],
    [layout.participantInputs[1] + dataNftOffset, () => builder.addOutput({
      to: getDataNftAddress(vault, vaultSetup.categoryId), amount: vaultSetup.dataNftUtxos[0].satoshis,
      token: {
        category: vaultSetup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildInitialStateCommitments(
            vaultArtifact.stateLayout!, { balance: closing, other: otherClosing },
          )[0],
        },
      },
    })],
  ]);
  for (let slot = 0; slot < layout.totalSlots; slot += 1) {
    const place = placed.get(slot);
    if (place) place();
    else builder.addOutput({ to: p2pkh.address, amount: slot === layout.totalSlots - 1 ? 20_000n : 1000n });
  }
  return {
    provider,
    builder,
    transaction: raw(builder),
    closing,
    otherClosing,
    vaultInput: layout.participantInputs[1],
    guardUsesMsgSender: vaultArtifact.abi
      .find((entry) => entry.name === 'assertFloor')?.usesMsgSender === true,
  };
}

/** Report the first input whose BCH-2026 evaluation fails, so a hostile case names one exact covenant. */
function failingInput(builder: TransactionBuilder): number | null {
  try {
    layer3.preflightLayer3Transaction(builder);
    return null;
  } catch (error) {
    const match = /failed at input (\d+)/.exec((error as Error).message);
    if (!match) throw error;
    return Number(match[1]);
  }
}

const STALE = /row 1 'assertFloor' is a read-only graph emission clone reading 'balance', which row 0/;

describe('X111 - a read-only graph emission clone must not read the pre-state', () => {
  it('H1 HOSTILE: the guard satisfied against the PRE-state is refused before anything is signed', async () => {
    // opening 100 -> closing 20. `assertFloor(50)` is TRUE of 100 and FALSE of 20. At baseline this SETTLED.
    await expect(buildGuardGraph({ guard: 'sender', opening: 100n, rows: [
      { fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 50n },
    ] })).rejects.toThrow(STALE);
  }, 300_000);

  it('N1 negative control on the ATTACKED FIELD: no msg.sender, so the gate stays out of it', async () => {
    // Differs from H1 in exactly one source predicate, which is what puts the guard in `graphTailHandlers`.
    // The composition is admitted by the plan and refused by the vault's own covenant instead.
    const built = await buildGuardGraph({ guard: 'plain', opening: 100n, rows: [
      { fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 50n },
    ] });
    expect(built.guardUsesMsgSender).toBe(false);
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(built.vaultInput);
  }, 300_000);

  it('P1 negative control on ORDER: the same rows reader-first are admitted and settle', async () => {
    // H1's row set with the two rows transposed. The clone at local row 0 reads the sequentially correct
    // value, so refusing it would be a false refusal - which is what makes H1's refusal order-specific.
    const built = await buildGuardGraph({ guard: 'sender', opening: 100n, rows: [
      { fn: 'assertFloor', value: 50n }, { fn: 'withdraw', value: 80n },
    ] });
    expect(built.guardUsesMsgSender).toBe(true);
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('P2 negative control on the SLOT: an earlier writer of a different slot is admitted and settles', async () => {
    // The C2 shape in miniature: a writing row co-occurs with a read-only emission clone, and the slots are
    // disjoint. A gate that keyed on co-occurrence alone would refuse this, and C2 with it.
    const built = await buildGuardGraph({ guard: 'sender', opening: 100n, rows: [
      { fn: 'bumpOther', value: 7n }, { fn: 'assertFloor', value: 50n },
    ] });
    expect(built.guardUsesMsgSender).toBe(true);
    expect(built.closing).toBe(100n);
    expect(built.otherClosing).toBe(7n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('N3 liveness: the admitted reader-first guard is still refused on a false expectation', async () => {
    // Proves P1 does not settle because the require went vacuous: 150 > the opening 100.
    const built = await buildGuardGraph({ guard: 'sender', opening: 100n, rows: [
      { fn: 'assertFloor', value: 150n }, { fn: 'withdraw', value: 10n },
    ] });
    expect(failingInput(built.builder)).toBe(built.vaultInput);
  }, 300_000);
});
