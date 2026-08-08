import {
  describe, it, expect, beforeAll,
} from 'vitest';
import { compileFile } from 'solidc';
import { URL } from 'url';
import { hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { Contract, StatefulContract, Signer } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  createTestProvider, setupStatefulUtxos, genesisFtContainer,
} from '../test-util.js';
import {
  alicePriv, bobPriv, aliceAddress, bobTokenAddress,
} from '../fixture/vars.js';

// =============================================================================
// `deposit`'s delivery proof is UNSATISFIABLE, so the quarantined boundary - the
// port's headline extension - can never be entered. This pins that, with the
// arithmetic, because it reads like a test-harness gap and is not one.
//
// The check is:
//
//     for (i in tx.outputs) if (tx.outputs[i].tokenCategory == category)
//         delivered += tx.outputs[i].tokenAmount;
//     require(delivered >= containerSeen + amount);
//
// `containerSeen` is the whole reserve's high-water mark, and the CONTAINER IS NOT
// CO-SPENT by `deposit` - it touches no `this.tokens[...]`, and it runs on a
// delegate facet, where container operations are forbidden anyway. So the
// container's balance contributes NOTHING to `delivered`, and a depositor must
// supply `containerSeen + amount` from their own bearer coins to move `amount`.
// Measured below: depositing 5 USDT against a 1,000,000 USDT premint demands the
// transaction carry 1,000,005 USDT of category outputs. It is satisfiable only
// while `containerSeen == 0`, which `setBacking` makes false immediately.
//
// The loop is also blind to WHERE an output pays - it would count one paying the
// depositor - so the intended proof ("the reserve grew") is not what it checks
// even in principle. A sound version needs one of two things the port does not
// have: the container's locking bytecode, so container-paying outputs can be
// summed; or the container co-spent so its input/output delta is the measurement,
// which needs `deposit` on the master (delegate mode cannot touch a container)
// and the master has no room for it.
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

describe('NativeUsdt / deposit delivery proof', () => {
  it('cannot be satisfied: it demands containerSeen + amount from the depositor alone', async () => {
    const d = await deploy();
    await d.as(d.owner).call.openSelf().send();
    await d.fund(d.owner);
    await d.as(d.owner).call.setBacking(d.ftCategory).send();
    await d.fund(d.owner);
    await d.as(d.bob).call.openSelf().send();
    await d.fund(d.bob);

    // Bob holds bearer FTs of the backing category and pays them to HIMSELF.
    await d.provider.addUtxo(d.bob.getAddress(), {
      txid: 'ba'.repeat(32),
      vout: 0,
      satoshis: 100000n,
      token: { category: d.ftCategory, amount: 5n * UNIT },
    });

    const before = await d.master.getState();
    // The demand this transaction cannot meet, computed rather than written down.
    expect(before.containerSeen).toBe(PREMINT);
    let settled = true;
    let reason = '';
    try {
      await d.as(d.bob).call.deposit(d.ftCategory, 1n, 5n * UNIT)
        .setLocktime(500)
        .addOutput({ to: bobTokenAddress, amount: 100000n, token: { category: d.ftCategory, amount: 5n * UNIT } })
        .send();
    } catch (error) { settled = false; reason = (error as Error).message; }

    // Refused at the FACET's input, not the proxy's - so this is the delivery check itself
    // failing, not the delegated-INSERT boundary that used to stop deposit earlier.
    expect(settled, 'deposit settled; the delivery check may have been fixed').toBe(false);
    expect(reason, 'refused by the facet, not the proxy at input 0').not.toMatch(/at input 0:/);
    expect(reason).toMatch(/OP_VERIFY/);

    const after = await d.master.getState();
    expect(after.containerSeen).toBe(before.containerSeen);
    expect(after.backedSupply).toBe(before.backedSupply);
  }, 300000);
});
