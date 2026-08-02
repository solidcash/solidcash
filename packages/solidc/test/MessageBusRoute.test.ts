import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract MessageBusRoute() {
  int count;
  function add(int n) public {
    this.count = this.count + n;
    require(n >= 0);
  }
}`;

describe('compiler-integrated message-bus SCB1 route', () => {
  it('adds the authenticated graph context only when a controller is pinned', () => {
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      hiddenBatch: true,
      messageBusController: '51',
      messageBusControllerCategory: '00'.repeat(32),
    });
    expect(artifact.hiddenBatch?.graphControllerLockingBytecode).toBe('51');
    expect(artifact.hiddenBatch?.graphControllerCategory).toBe('00'.repeat(32));
    expect(artifact.hiddenBatch?.route.inputs.map((input) => input.name)).toEqual([
      'batchBlob',
      '__internal__graphControllerIdx',
      '__internal__graphParticipantOffset',
      '__internal__graphBlockSize',
      '__internal__graphEmissions',
      '__internal__graphCallers',
      '__internal__graphSettlementBoundary',
      '__internal__graphCompletionPositions',
      '__internal__graphSettlementTable',
    ]);
    // The transcript is graph-global evidence, carried once by the compiler-owned helper rather than repeated
    // as a participant input in every route block.
    expect(artifact.invocationAnalysis?.functions.map((fn) => fn.name))
      .toContain('__scb_graph_transcript');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('rejects malformed controller bytecode at compilation', () => {
    expect(() => compileString(SOURCE, {
      forceStateful: true,
      hiddenBatch: true,
      messageBusController: 'not-hex',
      messageBusControllerCategory: '00'.repeat(32),
    })).toThrow(/hex-encoded locking bytecode/);
  });

  it('requires the unique controller category together with its locking bytecode', () => {
    expect(() => compileString(SOURCE, {
      forceStateful: true,
      hiddenBatch: true,
      messageBusController: '51',
    })).toThrow(/32-byte messageBusControllerCategory/);
  });
});
