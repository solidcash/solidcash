import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

type KernelHandler = NonNullable<NonNullable<
ReturnType<typeof compileString>['messageBus']
>['handlers'][number]>;

const handler = (source: string, name: string): {
  artifact: ReturnType<typeof compileString>; selected: KernelHandler;
} => {
  const artifact = compileString(source, KERNEL);
  const selected = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
  expect(selected, `missing handler ${name}`).toBeDefined();
  return { artifact, selected: selected! };
};

describe('kernel all-output policy for direct multisignature arrays', () => {
  it.each([
    ['dynamic', 'sig[] proofs'],
    ['fixed', 'sig[2] proofs'],
  ])('publishes and enforces an all-output policy for a direct %s array', (_label, parameter) => {
    const { artifact, selected } = handler(`contract C(pubkey first, pubkey second) {
      function authorize(${parameter}) public {
        require(checkMultiSig(proofs, [first, second]));
      }
      function control() public { require(true); }
    }`, 'authorize');
    expect(selected).toMatchObject({
      eligible: true,
      usesTransactionSignature: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: parameter.startsWith('sig[]') ? 'sig[][]' : 'sig[2][]',
    }));
  });

  it('admits a direct multisignature array as upgrade authority', () => {
    const { selected } = handler(`contract C(pubkey first, pubkey second) {
      int marker;
      function replace(sig[] proofs) public upgrade {
        require(checkMultiSig(proofs, [first, second]));
      }
      function control() public { require(true); }
    }`, 'replace');
    expect(selected).toMatchObject({
      eligible: true,
      usesTransactionSignature: true,
      lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' },
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it.each([
    ['an alias', `sig[] selected = proofs;
      require(checkMultiSig(selected, keys));`],
    ['an element mutation', `proofs[0] = replacement;
      require(checkMultiSig(proofs, keys));`, 'sig[] proofs, sig replacement, pubkey[] keys'],
    ['a fixed-array element mutation', `proofs[0] = replacement;
      require(checkMultiSig(proofs, keys));`, 'sig[2] proofs, sig replacement, pubkey[] keys'],
    ['a whole-array deletion', `delete proofs;
      require(checkMultiSig(proofs, keys));`],
    ['an internal helper', 'verify(proofs, keys); require(true);'],
  ])('keeps upgrade multisignatures reached through %s fenced', (_label, body, parameters) => {
    const helper = _label === 'an internal helper'
      ? 'function verify(sig[] proofs, pubkey[] keys) internal { require(checkMultiSig(proofs, keys)); }'
      : '';
    const { selected } = handler(`contract C() {
      ${helper}
      function replace(${parameters ?? 'sig[] proofs, pubkey[] keys'}) public upgrade {
        ${body}
      }
      function control() public { require(true); }
    }`, 'replace');
    expect(selected).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
    });
    expect(selected).not.toHaveProperty('transactionSignaturePolicy');
  });
});
