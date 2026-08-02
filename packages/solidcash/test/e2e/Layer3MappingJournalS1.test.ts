import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createEntryNftUnlocker, getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlot, slotValueToBytes,
} from '../../src/stateful/SortedList.js';

/**
 * S1 - collection-entry flush cardinality inside a compiled message-bus balanced block.
 *
 * The bus route settles its mapping write through the same C2 covenant as the direct route, so the exact
 * collection-address output cardinality has to hold inside the balanced block too: the transaction must not be
 * able to mint a second node for the written key, or a node for a key no row ever wrote, alongside the authorized
 * settlement. Each hostile case is the honest transaction with one appended output; the honest transaction is
 * broadcast in the same test as its control.
 *
 * Scope note: this fixture writes an EXISTING key. A cold-key insert does not settle through the compiled graph
 * route at this baseline - the balanced block the artifact publishes is master + entry only, so the insert's newly
 * minted node has no slot. See the evidence packet; the insert path itself is proven on the direct route in
 * MappingJournalTransitionS1.test.ts.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

const KEYS = Array.from({ length: 60 }, (_, i) => BigInt(i + 1))
  .map((k) => ({ k, s: bytesToSlotValue(keyToSlot(bigIntToVmNumber(k))) }))
  .sort((a, b) => (a.s < b.s ? -1 : 1));
const LOW = KEYS[10];
const HIGH = KEYS[12];
const UNWRITTEN_SLOT = keyToSlot(bigIntToVmNumber(9999n));

const SOURCE = `pragma solidcash >=0.8.0;
    contract S1GraphMapping() {
      mapping(bigint => bigint) values;
      function set(bigint key, bigint amount) public {
        this.values[key] = amount;
        require(amount >= 0);
      }
    }`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Tamper = 'none' | 'duplicate-node' | 'fabricated-node' | 'forged-value';

interface GraphAuthority {
  projection: Contract<any, any>;
  controller: Contract<any, any>;
  categoryId: string;
  genesisUtxo: any;
}

async function createGraphAuthority(provider: Provider): Promise<GraphAuthority> {
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
  provider: Provider, controller: Contract<any, any>, genesisUtxo: any,
  categoryId: string, root: string, p2pkh: Contract<any, any>,
): Promise<any> {
  const fee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(tx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('graph controller initialization did not create the rooted authority');
  return rooted;
}

/**
 * Turn the terminal change output into a second collection node. Replacing rather than appending keeps the
 * transaction's input/output extent identical to the honest one, so the balanced-block width check cannot be what
 * rejects the result: the only thing that changed is how many outputs carry the collection entry address.
 */
function replaceChangeWithEntryOutput(tx: Tx, sourceIndex: number, commitment?: Uint8Array): void {
  const source = tx.outputs[sourceIndex];
  tx.outputs[tx.outputs.length - 1] = {
    ...source,
    valueSatoshis: 1000n,
    lockingBytecode: source.lockingBytecode.slice(),
    token: {
      ...source.token!,
      nft: { ...source.token!.nft!, commitment: commitment ?? source.token!.nft!.commitment.slice() },
    },
  };
}

async function buildGraphEntryWrite(
  tamper: Tamper = 'none',
): Promise<{ provider: Provider; transaction: string }> {
  const provider = createTestProvider();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const artifact = compileString(SOURCE, {
    forceStateful: true,
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  });
  const base = new Contract(artifact, [], { provider });
  const lowSlot = slotValueToBytes(LOW.s);
  const highSlot = slotValueToBytes(HIGH.s);
  // A two-node list: the written key keeps a real successor, so the settlement has a link to preserve.
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, {
    extraOutputs: (categoryId) => [{
      address: getEntryNftAddress(base, categoryId, 'values'),
      satoshis: 10000n,
      token: {
        amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: binToHex(encodeEntryCommitment(lowSlot, highSlot, bigIntToVmNumber(11n))),
        },
      },
    }],
  });
  const contract = base.withCategory(hexToBin(setup.categoryId));
  const entryAddress = getEntryNftAddress(contract, setup.categoryId, 'values');
  const master = setup.masterUtxo;
  const entry = setup.extraUtxos?.[0];
  if (!master || !entry?.token?.nft?.commitment) {
    throw new Error('S1 graph fixture did not seed its entry');
  }
  const settled = encodeEntryCommitment(
    lowSlot, highSlot, bigIntToVmNumber(tamper === 'forged-value' ? 78n : 77n),
  );

  const plan = layer3.planCompiledGraph(
    [{ artifact, lockingBytecode: contract.lockingBytecode }],
    [{ parent: null, callee: 0, function: 'set', args: [LOW.k, 77n] }],
  );
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, [''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh,
  );
  const projectionUtxo = randomUtxo({ satoshis: 1000n });
  const fee = randomUtxo({ satoshis: 50000n });
  await provider.addUtxo(projection.address, projectionUtxo);
  await provider.addUtxo(p2pkh.address, fee);
  const route = contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    master,
    route(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(entry, createEntryNftUnlocker(contract, 0, setup.categoryId, 'values'));
  tx.addInput(
    projectionUtxo,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), 0n),
  );
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: contract.tokenAddress, amount: master.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: entryAddress, amount: entry.satoshis,
    token: {
      category: setup.categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: binToHex(settled) },
    },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 10000n });
  if (tamper !== 'duplicate-node' && tamper !== 'fabricated-node') {
    return { provider, transaction: raw(tx) };
  }
  const decoded = decodeTransactionUnsafe(hexToBin(raw(tx)));
  replaceChangeWithEntryOutput(decoded, 1, tamper === 'fabricated-node'
    ? encodeEntryCommitment(UNWRITTEN_SLOT, new Uint8Array(32), hexToBin('e703'))
    : undefined);
  return { provider, transaction: binToHex(encodeTransaction(decoded)) };
}

/**
 * The route covenant at input 0 refused the transaction. Naming the input matters: replacing the change output
 * also invalidates the fee input's signature, so an assertion that accepted any failure would be satisfied by a
 * NULLFAIL at the funding input and would prove nothing about the collection covenant.
 */
async function expectCovenantRejection(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex)
    .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  expect(outcome).toContain('mandatory-script-verify-flag-failed');
  expect(outcome).toContain('error in evaluating input index 0');
  expect(outcome).toContain('Program failed an OP_VERIFY operation');
}

describe('S1 message-bus collection-entry flush cardinality', () => {
  it('SEMANTIC: settles one authorized entry flush inside a balanced graph block', async () => {
    const { provider, transaction } = await buildGraphEntryWrite();
    const outputs = decodeTransactionUnsafe(hexToBin(transaction)).outputs;
    const settled = decodeEntryCommitment(outputs[1].token!.nft!.commitment);
    expect(bytesToSlotValue(settled.slot)).toBe(LOW.s);
    // The successor link survives the write, so the rest of the list stays reachable.
    expect(bytesToSlotValue(settled.nextKey)).toBe(HIGH.s);
    expect(outputs.filter((o) => (o.token?.nft?.commitment?.length ?? 0) >= 64).length).toBe(1);
    await expect(provider.sendRawTransaction(transaction)).resolves.toBeTypeOf('string');
  });

  it('SEMANTIC: rejects a forged post-state for the graph-settled entry', async () => {
    const { provider, transaction } = await buildGraphEntryWrite('forged-value');
    await expectCovenantRejection(provider, transaction);
    const honest = await buildGraphEntryWrite();
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeTypeOf('string');
  });

  // Attacks unique authority over the written key inside the balanced block: two nodes for one slot fork the
  // list and a later read can authenticate either of them.
  it('SEMANTIC: rejects a second authority for the graph-settled key', async () => {
    const { provider, transaction } = await buildGraphEntryWrite('duplicate-node');
    await expectCovenantRejection(provider, transaction);
    const honest = await buildGraphEntryWrite();
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeTypeOf('string');
  });

  // Attacks value fabrication inside the balanced block: a node for a key no row wrote would still satisfy every
  // per-entry authentication a later read performs.
  it('SEMANTIC: rejects a fabricated node for a key no graph row wrote', async () => {
    const { provider, transaction } = await buildGraphEntryWrite('fabricated-node');
    await expectCovenantRejection(provider, transaction);
    const honest = await buildGraphEntryWrite();
    await expect(honest.provider.sendRawTransaction(honest.transaction)).resolves.toBeTypeOf('string');
  });
});
