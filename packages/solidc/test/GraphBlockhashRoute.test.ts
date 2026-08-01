import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const BUS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

const SOURCE = `pragma solidcash >=0.8.0;
interface ICallee { function ping(uint v); }
contract Watcher() {
  bytes32 first;
  bytes32 second;
  function wide(address callee, uint v, int n) public {
    this.first = blockhash(n);
    this.second = blockhash(n + 1);
    ICallee(callee).ping(v);
    require(v >= 0);
  }
  function narrow(address callee, uint v, int n) public {
    this.first = blockhash(n * 2);
    ICallee(callee).ping(v);
    require(v >= 0);
  }
}`;

describe('SCB1 graph blockhash route planning', () => {
  it('publishes row bands for mixed selector widths and computed reads', () => {
    const artifact = compileString(SOURCE, BUS);
    const route = artifact.hiddenBatch!.route;
    const plan = route.graphBlockhashOracle!;
    const selectors = Object.fromEntries(artifact.hiddenBatch!.handlers.map((handler) =>
      [handler.name, handler.selector]));

    expect(plan).toMatchObject({
      inputBaseParameter: '__internal__blockhashInputIndex',
      rowCount: artifact.hiddenBatch!.maximumRows,
      readWidth: 2,
      slotCount: artifact.hiddenBatch!.maximumRows * 2,
    });
    expect(plan.reads.filter((read) => read.row === 0 && read.selector === selectors.wide)).toEqual([
      { row: 0, selector: selectors.wide, readOrdinal: 0, readKey: 'n', slotOffset: 0 },
      { row: 0, selector: selectors.wide, readOrdinal: 1, readKey: '<computed:0>', slotOffset: 1 },
    ]);
    expect(plan.reads.filter((read) => read.row === 1 && read.selector === selectors.narrow)).toEqual([
      { row: 1, selector: selectors.narrow, readOrdinal: 0, readKey: '<computed:0>', slotOffset: 2 },
    ]);
    // The absent row-1/narrow ordinal 1 is the explicitly reserved inactive slot.
    expect(plan.reads.some((read) => read.row === 1 && read.selector === selectors.narrow
      && read.readOrdinal === 1)).toBe(false);
    expect(route.blockLayout?.slots.filter((slot) => slot.kind === 'blockhashOracle')).toHaveLength(plan.slotCount);
  }, 120_000);

  it('keeps the direct ABI free of graph row-offset context', () => {
    const artifact = compileString(SOURCE, BUS);
    for (const name of ['wide', 'narrow']) {
      expect(artifact.abi.find((fn) => fn.name === name)?.inputs.some((input) =>
        input.name === '__internal__blockhashRowOffset')).toBe(false);
    }
  }, 120_000);
});
