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
    ['an element mutation', `proofs[0] = replacement;
      require(checkMultiSig(proofs, keys));`, 'sig[] proofs, sig replacement, pubkey[] keys'],
    ['a fixed-array element mutation', `proofs[0] = replacement;
      require(checkMultiSig(proofs, keys));`, 'sig[2] proofs, sig replacement, pubkey[] keys'],
    ['a whole-array deletion', `delete proofs;
      require(checkMultiSig(proofs, keys));`],
  ])('keeps upgrade multisignatures reached through %s fenced', (_label, body, parameters) => {
    const { selected } = handler(`contract C() {
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

  it('proves an immutable multisignature array through an alias', () => {
    const { selected } = handler(`contract C() {
      function replace(sig[] proofs, pubkey[] keys) public upgrade {
        sig[] selected = proofs;
        require(checkMultiSig(selected, keys));
      }
      function control() public { require(true); }
    }`, 'replace');
    expect(selected).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
  });

  it('keeps an internal multisignature helper fenced because OP_INVOKE changes covered bytecode', () => {
    const { selected } = handler(`contract C() {
      function verify(sig[] selected, pubkey[] keys) internal {
        require(checkMultiSig(selected, keys));
      }
      function replace(sig[] proofs, pubkey[] keys) public upgrade {
        verify(proofs, keys); require(true);
      }
      function control() public { require(true); }
    }`, 'replace');
    expect(selected).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_TX_SIGNATURE' });
    expect(selected).not.toHaveProperty('transactionSignaturePolicy');
  });
});
