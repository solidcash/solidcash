import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  callerFields, edgeDeployment, eventsOnChain, expectRefusedEdge, settleEdge,
} from './edge-harness.js';

/**
 * Spec section 22: a fixed-size array crossing a return, used by the caller after the call.
 *
 * `Settler` sits behind its proxy and calls `Splitter`, deployed on its own. `settle` asks `Splitter.split` (a
 * `CALL`) to divide a total by a buyer's share: the callee emits the request and returns a `uint256[5]` of the
 * buyer's part, the seller's part, the fee, a zero slot and the total (the catalog's arbitration edge, whose
 * `uint256[5]` the caller checks and reverts after). The settler checks the parts add up, stores three of them and
 * emits all four it uses. `quote` asks the `STATIC` view `bands` for the `uint16[5]` the catalog's split calculation
 * returns, and emits two of its words. What each left is read back from the chain, words past 128 bits included. A
 * share the callee's own check rejects, and a split the caller's own check after the return rejects, are each
 * refused with their reason, and nothing is broadcast.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ISplitter {'
  + '   function split(int total, int buyerShare) returns (uint256[5]);'
  + '   function bands(int buyerShare) view returns (uint16[5]);'
  + ' }'
  + ' contract Splitter {'
  + '   int public feePercent;'
  + '   event Split(int total, int buyerShare);'
  + '   constructor() { this.feePercent = 3; }'
  + '   function split(int total, int buyerShare) returns (uint256[5]) {'
  + '     require(buyerShare <= 100, "share over 100");'
  + '     int fee = total * this.feePercent / 100;'
  + '     int rest = total - fee;'
  + '     int buyer = rest * buyerShare / 100;'
  + '     emit Split(total, buyerShare);'
  + '     return [uint256(buyer), uint256(rest - buyer), uint256(fee), uint256(0), uint256(total)];'
  + '   }'
  + '   function bands(int buyerShare) view returns (uint16[5]) {'
  + '     return [uint16(buyerShare * 100), uint16((100 - buyerShare) * 100), uint16(this.feePercent * 100),'
  + '       uint16(0), uint16(10000)];'
  + '   }'
  + ' }'
  + ' contract Settler {'
  + '   address public implementation;'
  + '   address public splitter;'
  + '   int public toBuyer;'
  + '   int public toSeller;'
  + '   int public toFee;'
  + '   int public settled;'
  + '   event Settled(int buyer, int seller, int fee, int total);'
  + '   event Quoted(int buyerBand, int feeBand);'
  + '   function initialize(address s) { this.splitter = s; require(true); }'
  + '   function settle(int total, int buyerShare) {'
  + '     uint256[5] parts = ISplitter(this.splitter).split(total, buyerShare);'
  + '     require(parts[0] + parts[1] + parts[2] == parts[4], "parts do not add up");'
  + '     require(parts[1] > 0, "nothing for the seller");'
  + '     this.toBuyer = int(parts[0]);'
  + '     this.toSeller = int(parts[1]);'
  + '     this.toFee = int(parts[2]);'
  + '     this.settled = this.settled + 1;'
  + '     emit Settled(int(parts[0]), int(parts[1]), int(parts[2]), int(parts[4]));'
  + '   }'
  + '   function quote(int buyerShare) {'
  + '     uint16[5] bands = ISplitter(this.splitter).bands(buyerShare);'
  + '     require(bands[0] + bands[1] == bands[4], "bands do not add up");'
  + '     emit Quoted(int(bands[0]), int(bands[2]));'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const deployed = edgeDeployment({
  scope: 'fixed array return edge', callee: artifacts.Splitter!, caller: artifacts.Settler!,
  interfaceName: 'ISplitter',
});

/** The parts `split` computes, by the callee's own arithmetic over non-negative numbers. */
function partsOf(total: bigint, buyerShare: bigint): { buyer: bigint; seller: bigint; fee: bigint } {
  const fee = (total * 3n) / 100n;
  const buyer = ((total - fee) * buyerShare) / 100n;
  return { buyer, seller: total - fee - buyer, fee };
}

describe('a uint256[5] returned to the caller', () => {
  it('reaches the caller word for word, which checks, stores and emits them: words past 128 bits', async () => {
    const run = await deployed();
    const [total, share] = [10n ** 40n + 7n, 25n];
    const { buyer, seller, fee } = partsOf(total, share);
    const result = await settleEdge(run, 'settle', [total, share]);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Splitter.split()', 'Settler.settle()', 'SettlerProxy.__fallback()']);
    expect(await callerFields(run)).toMatchObject({ toBuyer: buyer, toSeller: seller, toFee: fee, settled: 1n });
    expect((await eventsOnChain(run, run.caller, run.proxyCategoryId, result.txid))
      .map(({ name, args }) => ({ name, args }))).toStrictEqual([
      { name: 'Settled', args: { buyer, seller, fee, total } },
    ]);
    expect((await eventsOnChain(run, run.callee, run.calleeCategoryId, result.txid))
      .map(({ name, args }) => ({ name, args }))).toStrictEqual([
      { name: 'Split', args: { total, buyerShare: share } },
    ]);
  });

  it('refuses a share the callee\'s own check rejects, with its reason, and nothing is broadcast', async () => {
    const run = await deployed();
    await expectRefusedEdge(run, 'settle', [1_000_000n, 101n],
      /the call's callee "Splitter\.split\(\)" did not settle through the proxy: .*share over 100/);
    expect(await callerFields(run)).toMatchObject({ settled: 0n, toBuyer: 0n });
  });

  it('refuses a split the caller\'s own check after the return rejects, and nothing is broadcast', async () => {
    const run = await deployed();
    await expectRefusedEdge(run, 'settle', [1_000_000n, 100n],
      /the implementation's "settle" entry did not settle through the proxy: .*nothing for the seller/);
    expect(await callerFields(run)).toMatchObject({ settled: 0n, toBuyer: 0n });
  });
});

describe('a uint16[5] returned to the caller by a static call', () => {
  it('reaches the caller word for word, which checks the bands and emits two of them', async () => {
    const run = await deployed();
    const result = await settleEdge(run, 'quote', [80n]);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Splitter.bands()', 'Settler.quote()', 'SettlerProxy.__fallback()']);
    expect((await eventsOnChain(run, run.caller, run.proxyCategoryId, result.txid))
      .map(({ name, args }) => ({ name, args }))).toStrictEqual([
      { name: 'Quoted', args: { buyerBand: 8000n, feeBand: 300n } },
    ]);
  });
});
