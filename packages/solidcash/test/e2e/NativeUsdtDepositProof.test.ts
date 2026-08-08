import {
  describe, it, expect, beforeAll,
} from 'vitest';
import { compileFile } from 'solidc';
import { URL } from 'url';
import { hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';
import {
  Contract, StatefulContract, Signer, SignatureTemplate,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  createTestProvider, setupStatefulUtxos, genesisFtContainer,
} from '../test-util.js';
import {
  alicePriv, bobPriv, aliceAddress, bobTokenAddress,
} from '../fixture/vars.js';

// =============================================================================
// `deposit`'s delivery proof, and the two ways it used to be wrong.
//
// The original check summed EVERY category output in the transaction and compared
// against the ledger's high-water mark:
//
//     for (i in tx.outputs) if (tx.outputs[i].tokenCategory == category)
//         delivered += tx.outputs[i].tokenAmount;
//     require(delivered >= this.containerSeen + amount);
//
// That was wrong twice over. It was UNSATISFIABLE: the container is not co-spent,
// so it contributes nothing to `delivered`, and a depositor had to supply
// `containerSeen + amount` from their own bearer coins to move `amount` - a
// 5 USDT deposit against a 1,000,000 premint demanded 1,000,005 USDT in the
// transaction. And it was blind to WHERE an output paid, so had it ever been
// satisfiable it would have accepted an output paying the depositor.
//
// The proof is now the container's DELTA:
//
//     require(this.outState.tokens[category].tokenAmount
//             >= this.tokens[category].tokenAmount + amount);
//
// Both sides derive the token container's p2sh32 on-chain from (master category,
// backing category), so only container-paying outputs count - destination is
// proven by construction rather than assumed. Taking a delta rather than an
// absolute makes it hold whether or not the container is co-spent.
//
// These two tests are the only VM-level coverage of `this.outState.tokens[...]`
// in the repo; elsewhere it appears solely in a compile fixture.
// =============================================================================

const fx = (n: string): URL => new URL(`../fixture/${n}`, import.meta.url);
const DECIMALS = 6n;
const UNIT = 10n ** DECIMALS;
const PREMINT = 1_000_000n * UNIT;

let masterArt: Artifact;
let facetArt: Artifact;

beforeAll(() => {
  masterArt = compileFile(fx('nusdt.scash'), { messageBus: false }) as Artifact;
  facetArt = compileFile(fx('nusdt_facet.scash'), { brandLibrary: true, messageBus: false }) as Artifact;
}, 300000);

function b32(text: string): Uint8Array {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(text));
  return out;
}

interface Deployed {
  provider: ReturnType<typeof createTestProvider>;
  master: StatefulContract;
  ftCategory: string;
  containerAddress: string;
  owner: Signer;
  bob: Signer;
  fund: (s: Signer) => Promise<void>;
  as: (s: Signer) => StatefulContract;
}

let seed = 0x70;

async function deploy(): Promise<Deployed> {
  const provider = createTestProvider();
  const ownerAddr = addressToLockScript(aliceAddress);
  seed += 1;
  const tag = seed.toString(16).padStart(2, '0');
  const masterCat = `${'c'.repeat(62)}${tag}`;
  const libCat = `${'d'.repeat(62)}${tag}`;

  const libContract = StatefulContract.brandedLibrary(facetArt, masterCat, { provider });
  const libAddr = hexToBin(libContract.withCategory(hexToBin(libCat)).lockingBytecode);
  const ctorArgs = masterArt.constructorInputs.map((input) => (
    input.name === 'initialOwner' ? ownerAddr : libAddr));
  const masterContract = new Contract(masterArt, ctorArgs as never, { provider });
  const state: Record<string, unknown> = {
    owner: ownerAddr,
    totalSupply: 0n,
    basisPointsRate: 0n,
    maximumFee: 0n,
    feeAccrued: 0n,
    paused: false,
    name: b32('Tether USD'),
    symbol: b32('USDT'),
    decimals: DECIMALS,
    deprecated: false,
    upgradedAddress: ownerAddr,
    quarantineBlocks: 0n,
    backingCategory: new Uint8Array(32),
    backingSet: false,
    containerSeen: 0n,
    backedSupply: 0n,
    clock: 0n,
  };
  await setupStatefulUtxos(provider, masterContract, masterArt.stateLayout!, state,
    { saltContract: true, categoryOverride: masterCat });
  const master = StatefulContract.withCategory(masterContract, masterCat);
  await setupStatefulUtxos(provider, libContract, facetArt.stateLayout!, state,
    { saltContract: true, categoryOverride: libCat });
  master.registerLibrary('UsdtFacet', StatefulContract.withCategory(libContract, libCat));

  const ft = await genesisFtContainer(provider, masterContract, masterCat, [PREMINT]);
  const owner = new Signer(alicePriv, provider);
  const bob = new Signer(bobPriv, provider);
  let nonce = 0xbf00;
  const fund = async (signer: Signer): Promise<void> => {
    for (let i = 0; i < 2; i += 1) {
      nonce += 1;
      await provider.addUtxo(signer.getAddress(), {
        txid: `${nonce.toString(16)}${tag}`.padStart(64, '7'), vout: 0, satoshis: 300000n,
      });
    }
  };
  await fund(owner);
  await fund(bob);
  return {
    provider,
    master,
    ftCategory: ft.category,
    containerAddress: ft.address,
    owner,
    bob,
    fund,
    as: (signer: Signer) => master.connect(signer),
  };
}

/** Deploy, back the reserve, open Bob's row, and give Bob `amount` bearer FTs to deposit. */
async function ready(amount: bigint, txid: string): Promise<{ d: Deployed; coin: Utxo }> {
  const d = await deploy();
  await d.as(d.owner).call.openSelf().send();
  await d.fund(d.owner);
  await d.as(d.owner).call.setBacking(d.ftCategory).send();
  await d.fund(d.owner);
  await d.as(d.bob).call.openSelf().send();
  await d.fund(d.bob);
  const coin: Utxo = {
    txid, vout: 0, satoshis: 100000n, token: { category: d.ftCategory, amount },
  };
  await d.provider.addUtxo(d.bob.getAddress(), coin);
  return { d, coin };
}

const spendBobs = (coin: Utxo): [Utxo, ReturnType<SignatureTemplate['unlockP2PKH']>] => (
  [coin, new SignatureTemplate(bobPriv).unlockP2PKH()]);

describe('NativeUsdt / deposit delivery proof', () => {
  it('admits a deposit that actually grows the reserve', async () => {
    const { d, coin } = await ready(5n * UNIT, 'ba'.repeat(32));
    const before = await d.master.getState();
    // The premint is already in the container, so an absolute-sum proof would have
    // demanded PREMINT + 5 USDT here. The delta proof asks only for the 5.
    expect(before.containerSeen).toBe(PREMINT);

    await d.as(d.bob).call.deposit(d.ftCategory, 1n, 5n * UNIT)
      .setLocktime(500)
      .addInput(...spendBobs(coin))
      .tokenContainerDeposit(d.ftCategory, 5n * UNIT)
      .send();

    const after = await d.master.getState();
    expect(after.backedSupply).toBe(before.backedSupply + 5n * UNIT);
    expect(after.containerSeen).toBe(before.containerSeen + 5n * UNIT);
    const bobAddr = addressToLockScript(d.bob.getAddress());
    const readPending = (d.master.state as Record<string, (k: Uint8Array) => Promise<unknown>>).pendingAmount;
    expect(await readPending(bobAddr)).toBe(5n * UNIT);
  }, 300000);

  it('refuses a deposit whose FTs pay the depositor instead of the container', async () => {
    const { d, coin } = await ready(5n * UNIT, 'bb'.repeat(32));
    const before = await d.master.getState();

    // Same amount, same category, same everything - only the DESTINATION differs.
    // The old whole-transaction sum could not tell these two tests apart.
    let settled = true;
    let reason = '';
    try {
      await d.as(d.bob).call.deposit(d.ftCategory, 1n, 5n * UNIT)
        .setLocktime(500)
        .addInput(...spendBobs(coin))
        .addOutput({ to: bobTokenAddress, amount: 1200n, token: { category: d.ftCategory, amount: 5n * UNIT } })
        .send();
    } catch (error) { settled = false; reason = (error as Error).message; }

    expect(settled, 'deposit credited FTs that never reached the container').toBe(false);
    // Refused at input 0 - the MASTER's own script. `deposit` is not delegated: a token
    // container is invisible from a facet, so the proof can only run here.
    expect(reason, 'refused by the master, which is the input that carries the proof').toMatch(/at input 0/);
    expect(reason).toMatch(/OP_VERIFY/);

    const after = await d.master.getState();
    expect(after.containerSeen).toBe(before.containerSeen);
    expect(after.backedSupply).toBe(before.backedSupply);
  }, 300000);
});
