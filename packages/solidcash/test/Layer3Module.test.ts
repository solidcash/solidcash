import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { layer3 } from '../src/index.js';

// Fast unit tests for the layer-3 production module's pure logic: layout, codec, generator, and validation.
// No VM - these pin the module-owned invariants (layout indices, blob envelope, generated checks, guards)
// that the e2e tests (Layer3Production.test.ts) exercise end to end against the real consensus VM.

const part = (lbc: string): layer3.TranscriptParticipant =>
  ({ contract: { lockingBytecode: lbc } as any, master: {} as any, categoryId: '' });

describe('layer3.transcriptLayout - module-owned canonical layout', () => {
  it('places every record/state/settlement/event at the canonical index', () => {
    const spec: layer3.TranscriptSpec = {
      participants: 2, invocations: [{ caller: 0, callee: 1 }], resources: [{ owner: 1 }],
      effects: [{ consumer: 0, valueExpr: 'x' }], events: [{ emitter: 1, topicHex: 'aabb' }],
    };
    const l = layer3.transcriptLayout(spec);
    expect([l.participants, l.invocations, l.resources, l.effects, l.events]).toEqual([2, 1, 1, 1, 1]);
    expect(l.stateInput(0)).toBe(2);   // after 2 participants
    expect(l.feeInput).toBe(3);        // after participants + resources
    expect(l.senderOutput(0)).toBe(2); // after 2 recreations
    expect(l.stateOutput(0)).toBe(3);  // after recreations + sender records
    expect(l.effectOutput(0)).toBe(4); // after ... + state recreations
    expect(l.eventOutput(0)).toBe(5);  // after ... + settlements
    expect(l.outputCount).toBe(6);
  });

  it('degenerates correctly for a bare binding (no records)', () => {
    const l = layer3.transcriptLayout({ participants: 3 });
    expect([l.invocations, l.resources, l.effects, l.events]).toEqual([0, 0, 0, 0]);
    expect(l.feeInput).toBe(3);
    expect(l.outputCount).toBe(3);
  });
});

describe('layer3.participantArgs / encodeTranscriptBlob - SCB1 codec', () => {
  it('emits input_i = i, output_i = i pairs', () => {
    expect(layer3.participantArgs(2)).toEqual([0n, 0n, 1n, 1n]);
    expect(layer3.participantArgs(3)).toEqual([0n, 0n, 1n, 1n, 2n, 2n]);
  });

  it('guards the participant count against the covenant bound', () => {
    expect(() => layer3.participantArgs(1)).toThrow();
    expect(() => layer3.participantArgs(layer3.MAX_PARTICIPANTS + 1)).toThrow();
  });

  it('wraps args in a SCB1 envelope: magic + [1,0,1] + selector-prefixed row', () => {
    const blob = binToHex(layer3.encodeTranscriptBlob('ab', layer3.participantArgs(2)));
    expect(blob.startsWith('53434231010001ab')).toBe(true); // magic, version/flags/count, then selector
    expect(blob.length).toBeLessThan(76 * 2); // stays a single push (< 76 bytes)
  });
});

describe('layer3.opReturnPrefix - authenticated-record push encoding', () => {
  it('uses a single-byte push up to 75 bytes and OP_PUSHDATA1 beyond', () => {
    expect(layer3.opReturnPrefix(35)).toBe('6a23'); // invocation record identity length
    expect(layer3.opReturnPrefix(67)).toBe('6a43'); // 35 identity + 32 topic
    expect(layer3.opReturnPrefix(75)).toBe('6a4b');
    expect(layer3.opReturnPrefix(76)).toBe('6a4c4c');
    expect(layer3.opReturnPrefix(255)).toBe('6a4cff');
  });

  it('rejects out-of-range payloads', () => {
    expect(() => layer3.opReturnPrefix(-1)).toThrow();
    expect(() => layer3.opReturnPrefix(256)).toThrow();
  });
});

describe('layer3.generateTranscriptCovenant - generated framework + spec bindings', () => {
  it('emits the binding framework with the audit fixes and each spec binding at the layout index', () => {
    const src = layer3.generateTranscriptCovenant({
      participants: 2, invocations: [{ caller: 0, callee: 1 }], resources: [{ owner: 1 }],
      effects: [{ consumer: 0, valueExpr: 'settle' }], events: [{ emitter: 1, topicHex: 'aabbccdd' }],
    });
    expect(src).toContain('function __layer3_bind(');
    expect(src).toContain(`hex"${layer3.CONTROLLER_BRAND_PREFIX}"`); // brand cross-check
    expect(src).toContain('.value == tx.inputs[input0].value');      // N1 value preservation
    // invocation M3: msg.sender bound to caller lbc at senderOutput(0) = 2
    expect(src).toContain('tx.outputs[2].lockingBytecode == bytes.concat(hex"6a23", tx.inputs[input0].lockingBytecode)');
    // invocation M4: caller intent - caller's master commitment authorizes the callee
    expect(src).toContain('tx.inputs[input0].nftCommitment == hash160(tx.inputs[input1].lockingBytecode)');
    // resource F1: state category == owner category; N2 distinctness
    expect(src).toContain('tx.inputs[2].tokenCategory.slice(0, 32) == tx.inputs[input1].tokenCategory.slice(0, 32)');
    expect(src).toContain('2 != input0 && 2 != input1');
    // effect F2: settlement recipient == consumer, value == app expr
    expect(src).toContain('tx.outputs[4].lockingBytecode == tx.inputs[input0].lockingBytecode');
    expect(src).toContain('tx.outputs[4].value == settle');
    // event: emitter identity (35) + 4-byte topic => push 39 = 0x27, at eventOutput(0) = 5
    expect(src).toContain('tx.outputs[5].lockingBytecode == bytes.concat(hex"6a27", tx.inputs[input1].lockingBytecode, hex"aabbccdd")');
  });

  it('appends app resource-transition statements verbatim before effect binding', () => {
    const src = layer3.generateTranscriptCovenant({
      participants: 2, resources: [{ owner: 0 }], appBody: ['require(1 == 1); // marker'],
    });
    expect(src).toContain('require(1 == 1); // marker');
  });

  it('fails closed on every out-of-range or contradictory spec', () => {
    expect(() => layer3.generateTranscriptCovenant({ participants: 1 })).toThrow();
    expect(() => layer3.generateTranscriptCovenant({ participants: 2, invocations: [{ caller: 0, callee: 0 }] })).toThrow();
    expect(() => layer3.generateTranscriptCovenant({ participants: 2, invocations: [{ caller: 0, callee: 2 }] })).toThrow();
    // M4 single-master constraint: a caller cannot commit to two different callees.
    expect(() => layer3.generateTranscriptCovenant({
      participants: 3, invocations: [{ caller: 0, callee: 1 }, { caller: 0, callee: 2 }],
    })).toThrow();
    expect(() => layer3.generateTranscriptCovenant({ participants: 2, resources: [{ owner: 5 }] })).toThrow();
    expect(() => layer3.generateTranscriptCovenant({ participants: 2, effects: [{ consumer: 9, valueExpr: 'x' }] })).toThrow();
    expect(() => layer3.generateTranscriptCovenant({ participants: 2, events: [{ emitter: 3, topicHex: 'aa' }] })).toThrow();
    expect(() => layer3.generateTranscriptCovenant({ participants: 2, events: [{ emitter: 0, topicHex: 'zz' }] })).toThrow();
    expect(() => layer3.generateTranscriptCovenant({ participants: 2, events: [{ emitter: 0, topicHex: '' }] })).toThrow();
  });
});

describe('layer3.sortParticipants - canonical byte-lexicographic order', () => {
  it('orders participants by ascending locking bytecode (matches the covenant byte-lex check)', () => {
    const ordered = layer3.sortParticipants([part('cc00'), part('aa00'), part('bb00')]);
    expect(ordered.map((p) => p.contract.lockingBytecode)).toEqual(['aa00', 'bb00', 'cc00']);
  });
});

describe('layer3.deriveIntentCommitments - M4 authorization mapping', () => {
  it('commits each caller to hash160(callee lbc) in canonical order; non-callers stay empty', () => {
    // ordered = [aa00, bb00, cc00]; spec caller 0 -> callee 2 (over the ordered participants).
    const parts = [part('cc00'), part('aa00'), part('bb00')];
    const commitments = layer3.deriveIntentCommitments(parts, {
      participants: 3, invocations: [{ caller: 0, callee: 2 }],
    });
    expect(commitments[0]).toBe(layer3.intentCommitment('cc00')); // ordered[0]=aa00 commits to ordered[2]=cc00
    expect(commitments[1]).toBe(''); // ordered[1]=bb00 is not a caller
    expect(commitments[2]).toBe(''); // ordered[2]=cc00 is not a caller
    expect(commitments[0]).toHaveLength(40); // hash160 = 20 bytes
  });
});
