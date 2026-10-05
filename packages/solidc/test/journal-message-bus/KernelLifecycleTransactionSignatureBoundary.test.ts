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
  it('admits unsigned resource-free split/merge while fencing detached signature leaves', () => {
    const artifact = compileString(`contract Threads(pubkey authority) {
      function signedSplit(int count, sig proof) public split(count) {
        require(checkSig(proof, authority));
      }
      function signedMerge(int count, sig proof) public merge(count) {
        require(checkSig(proof, authority));
      }
      function opaqueSplit(int count, sig payload) public split(count) {
        require(bytes(payload).length >= 0);
      }
      function opaqueMerge(int count, sig payload) public merge(count) {
        require(count > 0);
      }
      function openSplit(int count) public split(count) { require(count > 0); }
      function openMerge(int count) public merge(count) { require(count > 0); }
    }`, KERNEL);
    const handler = (name: string): NonNullable<typeof artifact.messageBus>['handlers'][number] | undefined =>
      artifact.messageBus?.handlers.find((entry) => entry.name === name);

    for (const name of ['signedSplit', 'signedMerge', 'opaqueSplit', 'opaqueMerge']) {
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
    expect(artifact.messageBus?.verifierProgram?.lifecycle).toBe(true);
  });

  it('finds detached signature leaves by finite ABI shape while leaving data signatures in-row', () => {
    const artifact = compileString(`contract Threads() {
      struct Authorization { int nonce; sig proof; }
      function nested(int count, Authorization auth) public split(count) {
        require(auth.nonce >= 0);
      }
      function dataOnly(int count, datasig proof) public split(count) {
        require(bytes(proof).length >= 0 && count > 0);
      }
    }`, KERNEL);
    const handler = (name: string): NonNullable<typeof artifact.messageBus>['handlers'][number] | undefined =>
      artifact.messageBus?.handlers.find((entry) => entry.name === name);

    expect(handler('nested')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
      lifecycleTopology: { kind: 'split' },
    });
    expect(handler('nested')).not.toHaveProperty('transactionSignaturePolicy');
    expect(handler('dataOnly')).toMatchObject({
      eligible: true,
      lifecycleTopology: { kind: 'split' },
    });
    expect(artifact.messageBus?.route.inputs.some((input) => input.name.includes('__message_bus_sig_')))
      .toBe(false);
  });

  it('Fence #13: selfdestruct with detached sig stays KERNEL_TX_SIGNATURE', () => {
    const artifact = compileString(`contract Victim(pubkey authority) {
      function close(sig proof) public selfdestruct {
        require(checkSig(proof, authority));
      }
      function opaqueClose(sig payload) public selfdestruct {
        require(bytes(payload).length >= 0);
      }
    }`, KERNEL);
    const handler = (name: string): NonNullable<typeof artifact.messageBus>['handlers'][number] | undefined =>
      artifact.messageBus?.handlers.find((entry) => entry.name === name);

    expect(handler('close')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
      rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
    });
    expect(handler('opaqueClose')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
    });
  });

  it('retains exact SIGHASH_ALL provenance for an ordinary signed sibling beside an admitted lifecycle row', () => {
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
    expect(artifact.messageBus?.verifierProgram?.lifecycle).toBe(true);
  });
});
