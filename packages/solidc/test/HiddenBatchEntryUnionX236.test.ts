import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const SOURCE = `
pragma solidcash >=0.8.0;
contract X236EntryUnion() {
  mapping(address => uint256) balances;
  mapping(address => mapping(address => uint256)) allowances;
  function balanceOf(address owner) public view returns (uint256) { return this.balances[owner]; }
  function allowance(address owner, address spender) public view returns (uint256) {
    return this.allowances[owner][spender];
  }
}
`;

describe('X236 hidden-batch physical entry union', () => {
  it('represents and authenticates balanceOf and allowance as distinct route entry slots', () => {
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      hiddenBatch: true,
      messageBusController: `aa20${'11'.repeat(32)}87`,
      messageBusControllerCategory: '22'.repeat(32),
    });

    expect(artifact.hiddenBatch?.handlers.filter((handler) => handler.eligible)
      .map((handler) => handler.name)).toEqual(['balanceOf', 'allowance']);
    expect(artifact.hiddenBatch?.route.entryAccesses?.map((entry) => ({
      collection: entry.collection,
      keyCount: entry.keyParams.length,
      operations: entry.operations,
    }))).toEqual([
      { collection: 'balances', keyCount: 1, operations: ['read'] },
      { collection: 'allowances', keyCount: 2, operations: ['read'] },
    ]);
    expect(artifact.hiddenBatch?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'entry')
      .map((slot) => slot.slotIndex)).toEqual([0, 1]);
  });
});
