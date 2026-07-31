import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const options = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

const source = (predicate: string): string => `pragma solidcash >=0.8.0;
interface ICtxPeer { function next(int seed); }
contract CtxEmission(int brand, address peer) {
  function keepRoute(int seed) public { require(seed > 0); }
  function probe(int seed) public {
    ${predicate}
    ICtxPeer(peer).next(seed);
    require(true);
  }
}`;

const admission = (predicate: string): { eligible: boolean; rejectionReason?: string } => {
  const artifact = compileString(source(predicate), options);
  const handler = artifact.hiddenBatch!.handlers.find((candidate) => candidate.name === 'probe')!;
  return { eligible: handler.eligible, rejectionReason: handler.rejectionReason };
};

describe('E4 emission-handler logical context boundary', () => {
  it.each([
    ['msg.sender', 'require(msg.sender.length >= 0 && seed > 0);'],
    ['msg.sig', 'require(msg.sig.length == 4 && seed > 0);'],
    ['msg.data', 'require(msg.data.length >= 4 && seed > 0);'],
  ])('fails %s closed before publishing an unexecutable emission route', (_name, predicate) => {
    expect(admission(predicate)).toEqual({
      eligible: false,
      rejectionReason: 'emission-handler-logical-context-reconstruction-unsupported',
    });
  });

  it('keeps emission-position msg.value admitted on its separately proven row-local lowering', () => {
    expect(admission('require(msg.value >= 0 && seed > 0);')).toEqual({
      eligible: true,
      rejectionReason: undefined,
    });
  });

  it('fails physical activeBytecode closed instead of substituting participant locking bytecode', () => {
    expect(admission('require(this.activeBytecode == bytes(seed));')).toEqual({
      eligible: false,
      rejectionReason: 'direct-versus-batch-introspection-divergence',
    });
  });
});
