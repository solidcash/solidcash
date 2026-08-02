import { describe, expect, it } from 'vitest';
import { compileString, compileStringSplit } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { asmToBytecode } from '@solidcash/utils';
import { Contract, SplitContractBundle, StatefulContract, Signer } from '../../src/index.js';
import type { ConnectedStatefulContract } from '../../src/stateful/StatefulContract.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * Q1 row A item 2. DOES SPLITTING COMPOSE WITH A BUS ROUTE?
 *
 * The split capacity result was taken in DIRECT mode: nothing deployed the bundle and nothing spent it, so
 * whether a split root can also sit on an `IContract(addr).method()` route was unmeasured in either direction.
 * Both directions are measured here, and each records what actually happens rather than a pass/fail intent:
 *
 *   (1) split contract as CALLEE - an ordinary caller routes into a function that lives on a facet;
 *   (2) split contract as CALLER - a split root's own function makes the outgoing external call.
 *
 * Either answer is a result. What is NOT admissible is adjusting the fixture until something passes, so the
 * refusals below are asserted on their specific text, not on `toThrow()`.
 */

const IBENTO = 'interface IBento { function deposit(int amount) returns (int); }';

const BENTO = `pragma solidcash >=0.8.0;
${IBENTO}
contract Bento() is IBento {
  int elastic;
  int base;
  function deposit(int amount) returns (int) {
    int shareOut = amount;
    if (this.elastic != 0) { shareOut = amount * this.base / this.elastic; }
    this.elastic = this.elastic + amount;
    this.base = this.base + shareOut;
    return shareOut;
  }
}`;

// Direction (2): the CALLER is the contract that gets split. `borrow` carries the outgoing edge; `poke` is a
// second movable entry so the planner has something to pack and the caller is genuinely sharded.
const KASHI_SPLITTABLE = `pragma solidcash >=0.8.0;
${IBENTO}
contract Kashi(bytes bentoAddr) {
  int collateral;
  int pokes;
  function borrow(int amount) {
    int shareOut = IBento(bentoAddr).deposit(amount);
    this.collateral = this.collateral + shareOut;
  }
  function poke(int n) { this.pokes = this.pokes + n; require(n >= 0); }
}`;

// Direction (1): the CALLEE is the contract that gets split. Its `deposit` is the routed function.
const IVAULT = 'interface IVault { function deposit(int amount) returns (int); }';
const VAULT_SPLITTABLE = `pragma solidcash >=0.8.0;
${IVAULT}
contract Vault() is IVault {
  int elastic;
  int base;
  function deposit(int amount) returns (int) {
    int shareOut = amount;
    if (this.elastic != 0) { shareOut = amount * this.base / this.elastic; }
    this.elastic = this.elastic + amount;
    this.base = this.base + shareOut;
    return shareOut;
  }
  function bump(int n) { this.base = this.base + n; require(n >= 0); }
}`;

const CALLER_OF_VAULT = `pragma solidcash >=0.8.0;
${IVAULT}
contract Borrower(bytes vaultAddr) {
  int collateral;
  function borrow(int amount) {
    int shareOut = IVault(vaultAddr).deposit(amount);
    this.collateral = this.collateral + shareOut;
  }
}`;

/** Outpoint -> participant label, so a failing input index can be NAMED instead of numbered. */
async function outpointOwners(
  provider: { getUtxos: (address: string) => Promise<Array<{ txid: string; vout: number }>> },
  addresses: Record<string, string>,
): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  for (const [label, address] of Object.entries(addresses)) {
    for (const utxo of await provider.getUtxos(address)) owners.set(`${utxo.txid}:${utxo.vout}`, label);
  }
  return owners;
}

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return signer;
}

describe('Q1 row A: splitting versus a bus route', () => {
  /**
   * CONTROL. The unsplit version of exactly this composition settles, so any refusal below is attributable to
   * the split and not to the fixture, the provider or the external-call machinery.
   */
  it('CONTROL: the same composition settles with both participants UNSPLIT', async () => {
    const provider = createTestProvider();
    const artBento = compileString(BENTO);
    const artKashi = compileString(`pragma solidcash >=0.8.0;
${IBENTO}
contract Kashi(bytes bentoAddr) {
  int collateral;
  function borrow(int amount) {
    int shareOut = IBento(bentoAddr).deposit(amount);
    this.collateral = this.collateral + shareOut;
  }
}`);
    const bento = new Contract(artBento, [], { provider });
    const { categoryId: catBento } = await setupStatefulUtxos(
      provider, bento, artBento.stateLayout!, { elastic: 10n, base: 8n }, { saltContract: true },
    );
    const bentoAddr = bento.withCategory(hexToBin(catBento)).lockingBytecode;
    const kashi = new Contract(artKashi, [bentoAddr], { provider });
    const { categoryId: catKashi } = await setupStatefulUtxos(
      provider, kashi, artKashi.stateLayout!, { collateral: 0n }, { saltContract: true },
    );
    const scKashi = StatefulContract.withCategory(kashi, catKashi) as ConnectedStatefulContract;
    const scBento = StatefulContract.withCategory(bento, catBento) as ConnectedStatefulContract;
    const tx = await scKashi.borrow(5n).withExternalCall(scBento, 'deposit', [5n]).send();
    expect(tx).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      hex: expect.stringMatching(/.+/),
    });
    expect((await scBento.getState()).base).toBe(12n);
    expect((await scKashi.getState()).collateral).toBe(4n);
  });

  /**
   * MEASUREMENT (2): the split root is the CALLER. Recorded at the first gate that speaks, then ISOLATED -
   * the same refusal is reproduced by a facet-resident entry that only READS a constructor parameter, with no
   * external call anywhere in the source. That separates "external calls do not survive a split" from the
   * wider mechanism actually in play.
   *
   * The mechanism is one line: `compileFacet` REPLACES `contract.parameters` with a single `__brand`, so a
   * facet has no constructor parameters of its own and any moved body referencing one is an undefined symbol.
   * `IContract(addr).method()` with `addr` a constructor parameter is the canonical caller shape, so this is
   * why the caller direction cannot even reach the VM - it is not a capacity result.
   */
  it('MEASURED: a split CALLER whose entry carries an outgoing external call', () => {
    const attempt = (source: string): string | undefined => {
      try { compileStringSplit(source, { forceSplit: true }); return undefined; } catch (error) {
        return `${(error as Error).name}: ${(error as Error).message.split('\n')[0]}`;
      }
    };
    const callerError = attempt(KASHI_SPLITTABLE);
    console.log(`[Q1-A2] split CALLER compile: ${callerError ?? 'OK'}`);

    // ISOLATION: no interface, no external call - one movable entry reads a constructor parameter.
    const plainCtorRead = attempt(`pragma solidcash >=0.8.0;
contract Plain(bytes owner) {
  int a;
  int b;
  function setA(int v) { this.a = v + owner.length; require(v >= 0); }
  function setB(int v) { this.b = v; require(v >= 0); }
}`);
    console.log(`[Q1-A2] split CALLER isolation (ctor param read, NO external call): ${plainCtorRead ?? 'OK'}`);

    // GUARD NEGATIVE CONTROL: identical shape with the constructor parameter removed from the moved body.
    const noCtorRead = attempt(`pragma solidcash >=0.8.0;
contract Plain(bytes owner) {
  int a;
  int b;
  function setA(int v) { this.a = v; require(v >= 0); }
  function setB(int v) { this.b = v; require(v >= 0); }
}`);
    console.log(`[Q1-A2] split CALLER guard control (same shape, no ctor read): ${noCtorRead ?? 'OK'}`);

    expect(callerError, 'a split caller with an outgoing external call now compiles - re-read this row')
      .toMatch(/Undefined reference to symbol bentoAddr/);
    expect(plainCtorRead, 'the refusal is NOT about external calls: it reproduces on a bare constructor read')
      .toMatch(/Undefined reference to symbol owner/);
    expect(noCtorRead, 'the guard control must split cleanly, or the isolation proves nothing').toBeUndefined();
  });

  /**
   * MEASUREMENT (3), at COMPILE time rather than at settlement: bus mode reaches the split ROOT and stops
   * there. The root grows by the hidden-batch machinery; every facet is byte-identical to its direct-mode
   * build, so the moved function bodies were compiled as if the bus did not exist. That is the compile-side
   * shape of the runtime result above - the split root's route has no notion of its own facets.
   */
  it('MEASURED: bus mode reaches the split root and not its facets', () => {
    const busOptions = {
      forceStateful: true,
      hiddenBatch: true,
      messageBusController: `aa20${'11'.repeat(32)}87`,
      messageBusControllerCategory: '22'.repeat(32),
    };
    const direct = compileStringSplit(VAULT_SPLITTABLE, { forceSplit: true });
    const bus = compileStringSplit(VAULT_SPLITTABLE, { ...busOptions, forceSplit: true });
    const rootDirect = asmToBytecode(direct.root.bytecode).length;
    const rootBus = asmToBytecode(bus.root.bytecode).length;
    console.log(`[Q1-A2] split root direct=${rootDirect}B bus=${rootBus}B (+${rootBus - rootDirect})`);
    console.log(`[Q1-A2] facets direct=${direct.manifest.facets.map((f) => f.estimatedRedeemBytes).join(',')} `
      + `bus=${bus.manifest.facets.map((f) => f.estimatedRedeemBytes).join(',')}`);

    // The root DOES take the bus machinery. A control, so "facets unchanged" cannot be read as "nothing ran".
    expect(rootBus).toBeGreaterThan(rootDirect);
    expect((bus.root as unknown as Record<string, unknown>).hiddenBatch).toBeDefined();
    // And the facets do not.
    expect(bus.manifest.facets.map((f) => f.estimatedRedeemBytes))
      .toEqual(direct.manifest.facets.map((f) => f.estimatedRedeemBytes));
    for (const info of bus.manifest.facets) {
      expect(bus.facets[info.name].bytecode).toBe(direct.facets[info.name].bytecode);
      expect((bus.facets[info.name] as unknown as Record<string, unknown>).hiddenBatch).toBeUndefined();
    }
  });

  /**
   * MEASUREMENT (1): the split root is the CALLEE. Three legs in one test so the differential is exact.
   *
   *   leg 1  the split deployment is LIVE on its own delegate route (`deployed.call.deposit`) - so any bus
   *          failure is not "the split bundle does not work";
   *   leg 2  the same function reached from an ordinary caller over `withExternalCall`;
   *   leg 3  GUARD NEGATIVE CONTROL - the identical caller, the identical helper, the identical deploy path,
   *          differing ONLY in whether the callee bundle was split (`forceSplit`).
   */
  it('MEASURED: a split CALLEE reached through an ordinary caller on a bus route', async () => {
    const compiled = compileStringSplit(VAULT_SPLITTABLE, { forceSplit: true });
    console.log(`[Q1-A2] split CALLEE routes: ${compiled.manifest.routes
      .map((route) => `${route.function}->${route.target}`).join(' ')}`);

    // LEG 1. The split bundle's own delegate route, with no bus involved.
    const ownSigner = await fundedSigner();
    const own = await SplitContractBundle.from(compiled, ownSigner)
      .deploy([], { initialState: { elastic: 10n, base: 8n } });
    const ownOwners = await outpointOwners(ownSigner.provider as never, {
      'callee-root': own.root.inner.address,
      ...Object.fromEntries(Object.entries(own.facets).map(([n, f]) => [`facet:${n}`, f.inner.address])),
    });
    const ownBuilt = await own.call.deposit(5n).build();
    const ownRows = ownBuilt.inputs.map((input, index) =>
      `${index}:${ownOwners.get(`${(input as any).txid}:${(input as any).vout}`) ?? 'other'}`);
    console.log(`[Q1-A2] leg 1 inputs ${ownRows.join(' ')}`);
    const ownTx = await own.call.deposit(5n).send();
    expect(ownTx).toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      hex: expect.stringMatching(/.+/),
    });
    console.log(`[Q1-A2] leg 1 split CALLEE own delegate route: SETTLED ${ownTx.txid}`);
    expect((await own.root.getState()).base).toBe(12n);
    // The settling route carries the facet. That is the input the bus route below never builds.
    expect(ownRows.some((row) => row.includes('facet:Vault__Facet0'))).toBe(true);

    // LEG 2 / LEG 3. Same caller source, same deploy helper, split vs unsplit callee.
    const busRoute = async (forceSplit: boolean): Promise<string> => {
      const bundle = compileStringSplit(VAULT_SPLITTABLE, { forceSplit });
      const signer = await fundedSigner();
      const deployed = await SplitContractBundle.from(bundle, signer)
        .deploy([], { initialState: { elastic: 10n, base: 8n } });
      const provider = signer.provider;
      const artCaller = compileString(CALLER_OF_VAULT);
      const caller = new Contract(
        artCaller, [addressToLockScript(deployed.root.inner.address)] as never[], { provider },
      );
      const { categoryId } = await setupStatefulUtxos(
        provider as never, caller, artCaller.stateLayout!, { collateral: 0n }, { saltContract: true },
      );
      const scCaller = StatefulContract.withCategory(caller, categoryId) as ConnectedStatefulContract;
      const owners = await outpointOwners(provider as never, {
        caller: caller.address,
        'callee-root': deployed.root.inner.address,
        ...Object.fromEntries(Object.entries(deployed.facets).map(([n, f]) => [`facet:${n}`, f.inner.address])),
      });
      let rows: string[] = [];
      try {
        const built = await scCaller.borrow(5n)
          .withExternalCall(deployed.root as never, 'deposit', [5n]).build();
        rows = built.inputs.map((input, index) =>
          `${index}:${owners.get(`${(input as any).txid}:${(input as any).vout}`) ?? 'other'}`);
        console.log(`[Q1-A2] forceSplit=${forceSplit} built inputs ${rows.join(' ')}`);
      } catch (error) {
        console.log(`[Q1-A2] forceSplit=${forceSplit} build: ${(error as Error).message.split('\n')[0]}`);
      }
      try {
        const tx = await scCaller.borrow(5n)
          .withExternalCall(deployed.root as never, 'deposit', [5n]).send();
        return { rows, result: `SETTLED ${tx.txid} collateral=${(await scCaller.getState()).collateral}` };
      } catch (error) { return { rows, result: (error as Error).message.split('\n')[0] }; }
    };

    const split = await busRoute(true);
    const unsplit = await busRoute(false);
    console.log(`[Q1-A2] leg 2 SPLIT callee on a bus route:   ${split.result}`);
    console.log(`[Q1-A2] leg 3 UNSPLIT callee on a bus route: ${unsplit.result}`);

    // The control has to settle, or the differential says nothing about splitting.
    expect(unsplit.result, 'the guard control did not settle, so nothing below is attributable to the split')
      .toMatch(/^SETTLED /);
    // And the measured answer, pinned to its INPUT INDEX rather than to a bare throw.
    expect(split.result, 'a split callee now settles on a bus route - this row has changed and must be re-read')
      .toBe('layer3: BCH-2026 preflight failed at input 2: Program failed an OP_VERIFY operation.');
    // WHY it fails, and the reason it is a missing input rather than an unsatisfiable covenant: input 2 is the
    // callee's split ROOT, whose body is a forwarder to a facet, and no facet input is built at all.
    expect(split.rows[2]).toBe('2:callee-root');
    expect(split.rows.some((row) => row.includes('facet:'))).toBe(false);
  });
});
