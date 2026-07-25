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
      experimentalHiddenBatch: true,
      experimentalMessageBusController: '51',
      experimentalMessageBusControllerCategory: '00'.repeat(32),
    });
    expect(artifact.hiddenBatch?.graphControllerLockingBytecode).toBe('51');
    expect(artifact.hiddenBatch?.graphControllerCategory).toBe('00'.repeat(32));
    expect(artifact.hiddenBatch?.route.inputs.map((input) => input.name)).toEqual([
      'batchBlob',
      '__internal__graphTranscript',
      '__internal__graphControllerIdx',
      '__internal__graphParticipantOffset',
      '__internal__graphBlockSize',
      '__internal__graphEmissions',
      '__internal__graphCallers',
    ]);
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('rejects malformed controller bytecode at compilation', () => {
    expect(() => compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: 'not-hex',
      experimentalMessageBusControllerCategory: '00'.repeat(32),
    })).toThrow(/hex-encoded locking bytecode/);
  });

  it('requires the unique controller category together with its locking bytecode', () => {
    expect(() => compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: '51',
    })).toThrow(/32-byte experimentalMessageBusControllerCategory/);
  });
});
