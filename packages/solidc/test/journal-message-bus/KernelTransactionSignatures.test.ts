import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/index.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('kernel transaction-signature boundaries', () => {
  it('binds every checked signature leaf in a finite nested aggregate', () => {
    const artifact = compileString(`contract AggregateAuthorization() {
      struct Proof { sig authorization; pubkey owner; }
      struct Pair { Proof first; Proof second; }
      function apply(Pair pair, Proof[] extras) public {
        require(checkSig(pair.first.authorization, pair.first.owner));
        require(checkSig(pair.second.authorization, pair.second.owner));
        require(extras.length == 1);
        require(checkSig(extras[0].authorization, extras[0].owner));
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply')).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0, 1] },
    });
    expect(artifact.messageBus?.route.inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '__message_bus_sig_0_0_0_rows', type: 'sig[]' }),
      expect.objectContaining({ name: '__message_bus_sig_0_0_1_rows', type: 'sig[]' }),
      expect.objectContaining({ name: '__message_bus_sig_0_1_rows', type: 'sig[][]' }),
    ]));
  });

  it('binds a constant projection through nested signature arrays', () => {
    const artifact = compileString(`contract NestedAuthorization(pubkey owner) {
      function apply(sig[][] proofs) public {
        require(checkSig(proofs[0][0], owner));
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply')).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[][][]',
    }));
  });

  it('derives detached witnesses through mixed fixed and dynamic ABI tuple fields', () => {
    const artifact = compileString(`contract NeutralAuthorization() {
      struct Proof { sig authorization; pubkey owner; }
      struct Envelope { Proof[2] fixedProofs; Proof[][] proofGroups; int nonce; }
      function apply(Envelope envelope) public {
        require(envelope.nonce >= 0);
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '__message_bus_sig_0_0_0_rows', type: 'sig[2][]' }),
      expect.objectContaining({ name: '__message_bus_sig_0_0_1_rows', type: 'sig[][][]' }),
    ]));
  });

  it.each([
    ['a scalar', 'sig', 'value'],
    ['a fixed array', 'sig[2]', 'value'],
    ['a dynamic array', 'sig[]', 'value'],
    ['an ABI tuple represented by a struct', 'Result', 'value'],
  ])('keeps %s transaction-signature result off the route', (_label, type, expression) => {
    const definition = type === 'Result' ? 'struct Result { int sequence; sig authorization; }' : '';
    const artifact = compileString(`contract NeutralResultFence() {
      ${definition}
      function expose(${type} value) public pure returns (${type}) { return ${expression}; }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('keeps one signature-bearing member of a multi-result tuple off the route', () => {
    const artifact = compileString(`contract NeutralTupleResultFence() {
      function expose(sig authorization) public pure returns (int, sig) {
        return (7, authorization);
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });

  it('carries a data-only signature result as compact ABI bytes', () => {
    const artifact = compileString(`contract DataResult() {
      function expose(bytes value) public pure returns (sig) { return sig(value); }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'sig' }] });
  });

  it('recursively carries a data-only signature field inside a result struct', () => {
    const artifact = compileString(`contract StructuredDataResult() {
      struct Result { int sequence; sig payload; }
      function expose(bytes value) public pure returns (Result) {
        return Result(7, sig(value));
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Result' }] });
  });

  it('keeps a signature-bearing result fenced when the handler reaches checkSig', () => {
    const artifact = compileString(`contract CheckedResultFence() {
      function expose(sig authorization, pubkey owner) public pure returns (sig) {
        require(checkSig(authorization, owner));
        return authorization;
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it.each([
    ['an alias', 'sig result = sig(value); return result;', ''],
    ['return branches', 'if (choose) return sig(left); return sig(right);',
      ', bool choose, bytes left, bytes right'],
    ['a pure helper', 'return convert(value);',
      ' function convert(bytes input) internal pure returns (sig) { return sig(input); }'],
  ])('proves a data-only signature through %s', (_label, body, extra) => {
    const parameters = extra.startsWith(',') ? `sig witness${extra}` : 'sig witness, bytes value';
    const helper = extra.startsWith(' ') ? extra : '';
    const artifact = compileString(`contract DataFlow() {
      ${helper}
      function expose(${parameters}) public pure returns (sig) { ${body} }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'sig' }] });
  });

  it.each([
    ['an aliased signature parameter', 'sig result = witness; return result;', ''],
    ['a signature-dependent branch',
      'if (bytes(witness).length > 0) return sig(left); return sig(right);',
      ', bytes left, bytes right'],
    ['a pure identity helper', 'return identity(witness);',
      ' function identity(sig value) internal pure returns (sig) { return value; }'],
    ['a helper reaching checkSig', 'return convert(value, witness, owner);',
      ` function convert(bytes input, sig authorization, pubkey key) internal pure returns (sig) {
          require(checkSig(authorization, key)); return sig(input);
        }`],
  ])('rejects %s as transaction-signature-derived', (_label, body, extra) => {
    const parameters = extra.startsWith(',')
      ? `sig witness${extra}`
      : extra.includes('checkSig') ? 'sig witness, bytes value, pubkey owner' : 'sig witness';
    const helper = extra.startsWith(' ') ? extra : '';
    const artifact = compileString(`contract DataFlowFence() {
      ${helper}
      function expose(${parameters}) public pure returns (sig) { ${body} }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('proves a data-only result through the exact pure overload', () => {
    const artifact = compileString(`contract OverloadedDataFlow() {
      function convert(bytes value) internal pure returns (sig) { return sig(value); }
      function convert(sig witness) internal pure returns (sig) { return witness; }
      function expose(sig witness, bytes value) public pure returns (sig) {
        return convert(value);
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'sig' }] });
  });

  it('does not prove provenance from a pure sibling of the selected non-pure overload', () => {
    const artifact = compileString(`contract OverloadedDataFlowFence() {
      function convert(bytes value) internal returns (sig) { return sig(value); }
      function convert(sig witness) internal pure returns (sig) { return witness; }
      function expose(sig witness, bytes value) public returns (sig) {
        return convert(value);
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('keeps an unresolved overloaded result helper fail-closed', () => {
    const artifact = compileString(`contract OverloadedDataFlowFence() {
      function convert(bytes value) internal pure returns (sig) { return sig(value); }
      function convert(sig witness) internal pure returns (sig) { return witness; }
      function expose(sig witness, bool choose) public pure returns (sig) {
        return convert(choose ? witness : witness);
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'expose'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });

  it('requires every signature leaf in aggregates to be independently proven', () => {
    const artifact = compileString(`contract AggregateDataFlow() {
      struct Result { sig left; int sequence; sig right; }
      function safe(bytes left, bytes right) public pure returns (Result) {
        return Result(sig(left), 7, sig(right));
      }
      function unsafe(sig witness, bytes value) public pure returns (Result) {
        return Result(sig(value), 7, witness);
      }
      function tuple(bytes left, bytes right) public pure returns (sig, int, sig) {
        return (sig(left), 7, sig(right));
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'safe'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'tuple'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'unsafe'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
  });
});
