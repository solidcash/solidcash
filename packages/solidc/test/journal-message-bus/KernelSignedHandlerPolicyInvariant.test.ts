import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const SIGNED_DEPLOYMENT = `contract Unit() {
  int marker;
  constructor(int seed) { this.marker = seed; }
}
contract Coordinator(pubkey authority) {
  function materialize(int seed, sig proof) public {
    require(checkSig(proof, authority));
    Unit child = new Unit(seed);
    require(true);
  }
  function control() public { require(true); }
}`;

const expectCompleteSignedHandlerPolicies = (artifact: Artifact): void => {
  for (const handler of artifact.messageBus?.handlers ?? []) {
    if (!handler.eligible || handler.usesTransactionSignature !== true) continue;
    expect(handler.transactionSignaturePolicy, `${handler.name} must publish a complete signature policy`)
      .toMatchObject({ hashType: 'all', parameterIndices: expect.any(Array) });
    expect(handler.transactionSignaturePolicy!.parameterIndices.length).toBeGreaterThan(0);
    expect(handler.signatureBytecode, `${handler.name} must publish its invoked signing body`)
      .toMatch(/^(?:[0-9a-f]{2})+$/);
  }
};

describe('kernel signed-handler policy invariant', () => {
  it('demotes a signed typed deployment when its covered invoked body cannot be published', () => {
    const artifact = compileString(SIGNED_DEPLOYMENT, KERNEL);
    const materialize = artifact.messageBus?.handlers.find((handler) => handler.name === 'materialize');

    expect(materialize).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
    });
    expect(materialize).not.toHaveProperty('transactionSignaturePolicy');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
    expectCompleteSignedHandlerPolicies(artifact);
  });

  it('never publishes an eligible signed handler without its complete signing metadata', () => {
    expectCompleteSignedHandlerPolicies(compileString(SIGNED_DEPLOYMENT, KERNEL));
  });

  it('keeps complete direct and helper-backed SIGHASH_ALL controls eligible', () => {
    const artifact = compileString(`contract Authorization(pubkey authority) {
      function authorize(sig proof, pubkey selected) private {
        require(checkSig(proof, selected));
      }
      function direct(sig proof) public {
        require(checkSig(proof, authority));
      }
      function throughHelper(sig proof) public {
        authorize(proof, authority);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);

    const direct = artifact.messageBus?.handlers.find((handler) => handler.name === 'direct');
    expect(direct).toMatchObject({
      eligible: true,
      usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    expect(direct?.signatureBytecode).toMatch(/^(?:[0-9a-f]{2})+$/);

    const helper = artifact.messageBus?.handlers.find((handler) => handler.name === 'throughHelper');
    expect(helper).toMatchObject({
      eligible: true,
      usesTransactionSignature: true,
      transactionSignaturePolicy: {
        hashType: 'all',
        parameterIndices: [0],
        coveredBytecodes: [expect.objectContaining({ parameterIndex: 0 })],
      },
    });
    expect(helper?.signatureBytecode).toMatch(/^(?:[0-9a-f]{2})+$/);
    expectCompleteSignedHandlerPolicies(artifact);
  });
});
