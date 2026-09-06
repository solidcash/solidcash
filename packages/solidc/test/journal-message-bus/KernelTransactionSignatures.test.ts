import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/index.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('kernel transaction-signature boundaries', () => {
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
});
