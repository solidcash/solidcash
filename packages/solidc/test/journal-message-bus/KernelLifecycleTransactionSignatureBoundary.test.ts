import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('kernel lifecycle transaction-signature boundary', () => {
  it('keeps signed split and merge fenced without poisoning unsigned lifecycle siblings', () => {
    const artifact = compileString(`contract Threads(pubkey authority) {
      function signedSplit(int count, sig proof) public split(count) {
        require(checkSig(proof, authority));
      }
      function signedMerge(int count, sig proof) public merge(count) {
        require(checkSig(proof, authority));
      }
      function openSplit(int count) public split(count) { require(count > 0); }
      function openMerge(int count) public merge(count) { require(count > 0); }
    }`, KERNEL);
    const handler = (name: string) => artifact.messageBus?.handlers.find((entry) => entry.name === name);

    for (const name of ['signedSplit', 'signedMerge']) {
      expect(handler(name)).toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_TX_SIGNATURE',
      });
      expect(handler(name)).not.toHaveProperty('transactionSignaturePolicy');
    }
    expect(handler('openSplit')).toMatchObject({
      eligible: true,
      lifecycleTopology: { kind: 'split' },
    });
    expect(handler('openMerge')).toMatchObject({
      eligible: true,
      lifecycleTopology: { kind: 'merge' },
    });
  });

  it('retains exact SIGHASH_ALL provenance for an ordinary signed sibling', () => {
    const artifact = compileString(`contract Threads(pubkey authority) {
      function divide(int count) public split(count) { require(count > 0); }
      function signed(sig proof) public { require(checkSig(proof, authority)); }
      function open() public { require(true); }
    }`, KERNEL);
    const signed = artifact.messageBus?.handlers.find((entry) => entry.name === 'signed');

    expect(signed).toMatchObject({
      eligible: true,
      usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: expect.stringMatching(/^__message_bus_sig_\d+_0_rows$/),
      type: 'sig[]',
    }));
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'divide')).toMatchObject({
      eligible: true,
      lifecycleTopology: { kind: 'split' },
    });
    expect(artifact.messageBus?.handlers.find((entry) => entry.name === 'open'))
      .toMatchObject({ eligible: true });
  });
});
