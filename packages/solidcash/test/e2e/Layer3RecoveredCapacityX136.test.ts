import { describe, expect, it } from 'vitest';
import { compileFile } from 'solidc';

/**
 * X136 CONTINUED. WHAT THE RECOVERY DID TO CAPACITY, AND WHAT MyToken'S MISSING SLOT WAS.
 *
 * The partition commit recorded that Set A is byte-identical in BLOCK SHAPE and is NOT byte-identical in the
 * redeem script - every Set A script GREW - and named `FakeToken` as 446 bytes from the 10,000-byte per-input
 * limit. Two questions follow from that and neither was answered: how close is the rest of Set A, and what
 * does the compiler do when a row crosses.
 *
 * THE DISTRIBUTION, measured on both sides of the repair (`a2885464^` = `c988817e` and this branch) over the
 * whole census-eligible application + solidity-by-example population. All 14 rows whose route survived the
 * repair with a redeem length on both sides, sorted by headroom against the 10,000-byte per-input limit:
 *
 *      -26,234 B   33,732 ->  36,234   (+2,502)   eacc/MarketplaceV1.sol            SET A
 *      -23,284 B   28,852 ->  33,284   (+4,432)   eacc/MarketplaceV2.sol            SET A
 *      -23,259 B   28,827 ->  33,259   (+4,432)   eacc/MarketplaceV3.sol            SET A
 *          445.5   8,209.5 ->  9,554.5 (+1,345)   eacc/unicrow/FakeToken.sol        SET A
 *          634.5   8,311.5 ->  9,365.5 (+1,054)   eacc/unicrow/UnicrowArbitrator.sol SET A
 *          967.5   8,312   ->  9,032.5   (+720.5) eacc/unicrow/UnicrowDispute.sol   SET A
 *        1,448.5   7,118   ->  8,551.5 (+1,433.5) sbe/app/erc20/MyToken.sol         SET B
 *        1,506.5   7,688   ->  8,493.5   (+805.5) sbe/defi/stable-swap-amm/StableSwap.sol
 *        2,637     5,309   ->  7,363   (+2,054)   sbe/app/english-auction/EnglishAuction.sol
 *        2,778     6,678   ->  7,222     (+544)   sbe/app/crowd-fund/CrowdFund.sol
 *        5,825     3,531   ->  4,175     (+644)   sbe/app/airdrop/Airdrop.sol       SET B
 *        6,042.5   3,404.5 ->  3,957.5   (+553)   sbe/defi/vault/Vault.sol
 *        6,050.5   2,671.5 ->  3,949.5 (+1,278)   sbe/try-catch/TryCatch.sol        SET B
 *        6,534.5   3,173.5 ->  3,465.5   (+292)   sbe/hacks/weth-permit/ERC20Bank.sol
 *
 * SO THE ANSWER TO "HOW MANY ARE WITHIN 1,000 BYTES" IS THREE - FakeToken, UnicrowArbitrator and
 * UnicrowDispute - AND THAT IS NOT THE INTERESTING PART. Three more Set A rows are ALREADY 23,000 to 26,000
 * bytes PAST the limit, they grew by 2,502 to 4,432 bytes each in this repair, and every one of them compiles
 * without throwing and without printing anything. So "a further recovery could push a real contract over the
 * limit with no diagnostic" is not a risk to watch for. It has already happened, three times, in this corpus.
 *
 * WHAT THE COMPILER ACTUALLY SAYS, and it is not nothing - it is worse than nothing, because it is silent and
 * short. `compiler.ts` attaches `artifact.diagnostics = [{severity: 'error', code: 'contract-size-limit'}]`
 * when the script exceeds `MAX_INPUT_BYTESIZE`. It does not throw, it does not warn, and no SDK path reads
 * the field. AND ITS BASIS IS THE WRONG LENGTH: it measures `debug.bytecode`, while the census, the F3 fit
 * rows and `Contract.bytecode` all measure `artifact.bytecode`, which is LONGER on every row tested. So there
 * is a band above the ceiling in which the published redeem script is over the limit and the only diagnostic
 * in the compiler is still silent, and the band is hundreds of bytes wide.
 */

/** The compiler's own per-input limit. Not restated - `packages/solidc/src/constants.ts`. */
const MAX_INPUT_BYTESIZE = 10_000;

const EACC = process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts';
const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

const COMPILES = new Map<string, any>();
function compile(file: string): any {
  const cached = COMPILES.get(file);
  if (cached !== undefined) return cached;
  const artifact = compileFile(file, BUS as never);
  COMPILES.set(file, artifact);
  return artifact;
}

/** The two lengths that disagree: what the artifact publishes, and what the size gate measures. */
function lengths(artifact: any): { published: number; gateBasis: number } {
  return { published: artifact.bytecode.length / 2, gateBasis: artifact.debug.bytecode.length / 2 };
}

describe('X136: the recovery pushed Set A at the per-input ceiling', () => {
  /**
   * THE THREE ROWS NEAREST THE WALL, recompiled here rather than quoted. Each is a Set A row - the repair
   * changed nothing about its block shape and grew its script - and each is now inside 1,000 bytes of the
   * limit. The assertion is a BAND, not an equality, so an optimisation that buys headroom does not turn this
   * red; it goes red when a row crosses, which is the event worth being told about.
   */
  it('MEASURED: three Set A rows are within 1,000 bytes of the 10,000-byte per-input limit', () => {
    const rows: [string, string, number][] = [
      ['FakeToken', `${EACC}/unicrow/FakeToken.sol`, 8_209.5],
      ['UnicrowArbitrator', `${EACC}/unicrow/UnicrowArbitrator.sol`, 8_311.5],
      ['UnicrowDispute', `${EACC}/unicrow/UnicrowDispute.sol`, 8_312],
    ];
    for (const [name, file, before] of rows) {
      const { published } = lengths(compile(file));
      const headroom = MAX_INPUT_BYTESIZE - published;
      console.log(`[X136C] ${name.padEnd(18)} ${before} -> ${published} `
        + `(+${(published - before).toFixed(1)})  headroom ${headroom}`);
      expect(published, `${name} no longer grew past its pre-repair length`).toBeGreaterThan(before);
      expect(headroom, `${name} has CROSSED the per-input limit`).toBeGreaterThan(0);
      expect(headroom, `${name} is no longer inside the 1,000-byte band this row is about`)
        .toBeLessThan(1_000);
    }
  }, 900_000);

  /**
   * AND A SET A ROW THAT IS ALREADY PAST IT, WITH NOTHING SAID. `MarketplaceV1` compiles to more than three
   * times the per-input limit, grew by 2,502 bytes in this repair, and `compileFile` returns normally. This
   * is the answer to "what does the compiler say when one crosses": it does not throw, and the only thing it
   * records is a field nothing reads.
   */
  it('MEASURED: a Set A row 26,000 bytes PAST the limit compiles without throwing', () => {
    const artifact = compile(`${EACC}/MarketplaceV1.sol`);
    const { published, gateBasis } = lengths(artifact);
    console.log(`[X136C] MarketplaceV1 published=${published} gateBasis=${gateBasis} `
      + `over=${published - MAX_INPUT_BYTESIZE}`);
    expect(published).toBeGreaterThan(3 * MAX_INPUT_BYTESIZE);
    // The diagnostic exists, is severity `error`, and is inert: no throw reached this line.
    const diagnostics = artifact.diagnostics as any[] | undefined;
    console.log(`[X136C] diagnostics ${JSON.stringify(diagnostics)}`);
    expect(diagnostics, 'the over-limit row carries no size diagnostic at all').toBeDefined();
    expect(diagnostics![0].severity).toBe('error');
    expect(diagnostics![0].code).toBe('contract-size-limit');
  }, 900_000);

  /**
   * THE GATE'S BASIS IS SHORTER THAN THE PUBLISHED SCRIPT, so the silence extends past the ceiling.
   *
   * `contract-size-limit` fires on `debug.bytecode`. Every consumer that asks "does this fit" - the F3
   * census's `redeemBytes`, this repository's fit rows, and `Contract.bytecode` - reads `artifact.bytecode`,
   * which is longer. The gap is measured per row here rather than asserted as a constant, and the direction
   * is the unsafe one: the gate stays quiet while the published script is already over.
   */
  it('MEASURED: the size gate measures a SHORTER script than the artifact publishes', () => {
    const rows: [string, string][] = [
      ['FakeToken', `${EACC}/unicrow/FakeToken.sol`],
      ['UnicrowArbitrator', `${EACC}/unicrow/UnicrowArbitrator.sol`],
      ['UnicrowDispute', `${EACC}/unicrow/UnicrowDispute.sol`],
      ['MarketplaceV1', `${EACC}/MarketplaceV1.sol`],
    ];
    for (const [name, file] of rows) {
      const { published, gateBasis } = lengths(compile(file));
      const blind = published - gateBasis;
      console.log(`[X136C] ${name.padEnd(18)} published=${published} gate=${gateBasis} `
        + `silent band above the ceiling = ${blind} B`);
      expect(blind, `${name}: the gate basis is no longer shorter than the published script`)
        .toBeGreaterThan(0);
    }
  }, 900_000);
});

/**
 * X136 CONTINUED. MyToken LOST A SLOT, AND THE SLOT WAS ONE NO ADMITTED HANDLER EVER USED.
 *
 * A slot disappearing from a covenant is the shape most likely to be wrong, so this is what it was.
 *
 *   before  blockSize 69  master dataNft entry entry returnEvent  + 64 trailing
 *   after   blockSize 68  master dataNft entry       returnEvent  + 64 trailing
 *
 * ONE OF TWO `entry` SLOTS. Nothing else in the block changed in kind or in count; the block shifted down by
 * one, so `returnEvent` moved from offset 4 to 3 and the trailing base from 5 to 4.
 *
 * WHY, and it is not a slot vanishing from the same covenant - it is a DIFFERENT covenant. The route changed
 * admission rung. Before, `totalSupply`/`name`/`symbol`/`decimals` were refused
 * `mixed-scalar-and-collection-route-not-enabled` and the route was collection-only, admitting exactly
 * `balanceOf` and `allowance`; after, the mixed scalar+collection rung succeeds and all six are admitted.
 * The rung change is independently visible in the compiler's own warnings: the BEFORE compile emits
 * `unused variable '__rh0___getterKey1'`, `'__rh1___getterKey1'` and `'__rh1___getterKey2'` - one key witness
 * per ADMITTED HANDLER, which is where two entry slots for two collection handlers came from. The AFTER
 * compile emits none of those three.
 *
 * AND THE REMOVAL IS SOUND ON THE EVIDENCE AVAILABLE AT COMPILE TIME. Every admitted handler's own published
 * `entryAccesses` and `blockLayout` are byte-identical on both sides, and the maximum entry demand of any of
 * them is ONE: `balanceOf` is `balanceOf[k]`, and `allowance` is `allowance[k1][k2]` - a nested mapping is
 * ONE entry with a two-part key, not two entries. So the route reserved two slots to serve handlers that
 * never needed more than one, and the removed slot was surplus on both sides. The direction is also the safe
 * one: fewer entry slots is less capacity, never more authority.
 *
 * NOT CLAIMED, AND IT IS THE REAL RESIDUAL. This is a COMPILE-level argument. MyToken's route was not run:
 * its block is 68 slots wide and a row needs a live C2 sorted-mapping entry, so settling `balanceOf` or
 * `allowance` through the recovered 1-entry route is not established here. What a single 68-slot block does
 * with a participant carrying TWO collection rows in one transaction is also not established.
 */
describe('X136: MyToken lost an `entry` slot', () => {
  it('MEASURED: the route reserves ONE entry slot, and no admitted handler demands more', () => {
    const artifact = compile(`${SBE}/app/erc20/MyToken.sol`);
    const route = artifact.hiddenBatch!.route.blockLayout!;
    const tally = (slots: readonly any[]): Record<string, number> => slots
      .reduce((acc: Record<string, number>, slot: any) => (
        { ...acc, [slot.kind]: (acc[slot.kind] ?? 0) + 1 }), {});
    const routeTally = tally(route.slots);
    console.log(`[X136M] route blockSize=${route.blockSize} ${JSON.stringify(routeTally)}`);
    expect(route.blockSize).toBe(68);
    // Recorded at `c988817e`: blockSize 69, entry 2. The removed slot is the second `entry`.
    expect(routeTally).toEqual({ master: 1, dataNft: 1, entry: 1, returnEvent: 1, trailing: 64 });

    const handlers = artifact.hiddenBatch!.handlers as any[];
    const eligible = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
    console.log(`[X136M] eligible ${JSON.stringify(eligible)}`);
    expect(eligible.sort()).toEqual(
      ['allowance', 'balanceOf', 'decimals', 'name', 'symbol', 'totalSupply'],
    );

    // The demand side: the maximum entry slots any admitted handler's own block declares.
    let peak = 0;
    for (const name of eligible) {
      const entry = artifact.abi.find((abi: any) => abi.name === name);
      const demand = (entry?.blockLayout?.slots ?? [])
        .filter((slot: any) => slot.kind === 'entry').length;
      const accesses = entry?.entryAccesses ?? null;
      console.log(`[X136M] ${name.padEnd(12)} entrySlots=${demand} `
        + `entryAccesses=${JSON.stringify(accesses)}`);
      peak = Math.max(peak, demand);
    }
    // `allowance[k1][k2]` is ONE entry with a two-part key. If this ever reads 2, the removed slot was load
    // bearing and this whole docblock is wrong.
    expect(peak, 'an admitted handler demands more entry slots than the route reserves').toBe(1);
    expect(routeTally.entry).toBeGreaterThanOrEqual(peak);
  }, 900_000);
});
