import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { lowLevelRunNeedsSignerInput } from '../../src/stateful/sc-allocate-create-builder-funders-accounting.js';

const senderKey = (senderOp: string): { entryAccesses: { keySources: { kind: string; senderOp: string }[] }[] } => ({
  entryAccesses: [{ keySources: [{ kind: 'msgSender', senderOp }] }],
});

describe('a low-level run forces the signer input only when it reads the signer', () => {
  it('holds a delegate to its msg.sender, which is the signer at the top level', () => {
    expect(lowLevelRunNeedsSignerInput({ usesMsgSender: true }, 'delegatecall')).toBe(true);
    expect(lowLevelRunNeedsSignerInput(senderKey('msg.sender'), 'delegatecall')).toBe(true);
    expect(lowLevelRunNeedsSignerInput({}, 'delegatecall')).toBe(false);
  });

  it('leaves a delegate that only calls its msg.sender back, resolved through the callee category', () => {
    expect(lowLevelRunNeedsSignerInput(
      { usesMsgSender: true, externalCalls: [{ addressIsMsgSender: true }] }, 'delegatecall',
    )).toBe(false);
  });

  it('leaves a call or staticcall whose msg.sender is this contract', () => {
    for (const callMode of ['call', 'staticcall']) {
      expect(lowLevelRunNeedsSignerInput({ usesMsgSender: true }, callMode)).toBe(false);
      expect(lowLevelRunNeedsSignerInput(senderKey('msg.sender'), callMode)).toBe(false);
    }
  });

  it('keeps a tx.origin key in every call mode, which usesMsgSender does not count', () => {
    const keyed = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        mapping(address => int) bal;
        function f(int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.bal[tx.origin] = v; }
      }`, { sortedMappings: ['bal'], forceStateful: true }).abi.find((entry) => entry.name === 'f')!;
    expect(keyed.usesMsgSender).not.toBe(true);
    for (const callMode of ['call', 'staticcall', 'delegatecall']) {
      expect(lowLevelRunNeedsSignerInput(keyed, callMode)).toBe(true);
    }
  });
});
