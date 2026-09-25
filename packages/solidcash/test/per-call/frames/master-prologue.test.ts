import { describe, expect, it } from 'vitest';
import { encodeDataPush, hash256, encodeLockingBytecodeP2sh32, Opcodes } from '@bitauth/libauth';
import { masterPrologue } from 'solidc';
import { MockNetworkProvider } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';

/**
 * The master prologue, evaluated in the VM rather than asserted structurally.
 *
 * A master is one UTXO per entry into a contract. Its prologue must prove that it is spending its own category's
 * minting token, and that the output at its own index recreates that UTXO unchanged. Both are opinions about a
 * transaction, so only the VM can settle them: every case below builds a real transaction and asks the real virtual
 * machine.
 *
 * Attribution comes from isolating a check, not from the VM's message: libauth reports every `OP_*VERIFY` failure
 * with the same sentence, so each block below is evaluated on its own and a rejection is attributed to the block
 * that was under test.
 */

const relaxedLimits = {
  maximumInputBytes: 100_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800,
  hashDigestIterationsPerByte: 3,
};

const CATEGORY = new Uint8Array(32).fill(0x5a);
const FOREIGN = new Uint8Array(32).fill(0x77);

/** A body that succeeds, standing in for the function the prologue prefixes. */
const ACCEPTING_BODY = new Uint8Array([Opcodes.OP_1]);
/** A body that fails, to prove the harness rejects a script that does not end truthy. */
const REJECTING_BODY = new Uint8Array([Opcodes.OP_0]);

interface SpendOptions {
  readonly prefix: Uint8Array;
  readonly body?: Uint8Array;
  readonly inputCategory?: Uint8Array;
  readonly inputCapability?: 'none' | 'mutable' | 'minting';
  readonly inputHasToken?: boolean;
  readonly outputCategory?: Uint8Array | null;
  readonly outputCapability?: 'none' | 'mutable' | 'minting';
  readonly outputCommitment?: Uint8Array;
  readonly outputValue?: bigint;
  readonly outputLock?: Uint8Array;
}

interface TokenShape {
  readonly category: Uint8Array;
  readonly amount: bigint;
  readonly nft: { readonly capability: 'none' | 'mutable' | 'minting'; readonly commitment: Uint8Array };
}

const masterToken = (
  category: Uint8Array,
  capability: 'none' | 'mutable' | 'minting',
  commitment: Uint8Array = new Uint8Array(0),
): TokenShape => ({ category, amount: 0n, nft: { capability, commitment } });

/**
 * Builds a real transaction spending one master whose script is `prefix + body`, and evaluates the input in the
 * BCH-2026 VM. `stateSuccess` answers `true` on success and the objection otherwise, so a bare falsy check would
 * pass on a missing verdict as readily as on a rejection.
 */
function evaluateSpend(options: SpendOptions): boolean {
  const redeemScript = new Uint8Array([...options.prefix, ...(options.body ?? ACCEPTING_BODY)]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));

  const inputHasToken = options.inputHasToken ?? true;
  const sourceOutput = {
    lockingBytecode: lock,
    valueSatoshis: 20_000n,
    ...(inputHasToken
      ? {
        token: masterToken(
          options.inputCategory ?? CATEGORY,
          options.inputCapability ?? 'minting',
        ),
      }
      : {}),
  };

  const outputCategory = options.outputCategory === undefined ? CATEGORY : options.outputCategory;
  const output = {
    lockingBytecode: options.outputLock ?? lock,
    valueSatoshis: options.outputValue ?? 20_000n,
    ...(outputCategory === null
      ? {}
      : {
        token: masterToken(
          outputCategory,
          options.outputCapability ?? 'minting',
          options.outputCommitment ?? new Uint8Array(0),
        ),
      }),
  };

  const transaction = {
    version: 2,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: encodeDataPush(redeemScript),
    }],
    outputs: [output],
    locktime: 0,
  };

  const provider = new MockNetworkProvider({ consensusLimits: relaxedLimits, policy: { enforceDust: false } });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs: [sourceOutput], transaction })) === true;
}

const prologue = (): Uint8Array => masterPrologue.buildMasterPrologue(CATEGORY);
const ownership = (): Uint8Array => masterPrologue.categoryOwnershipCheck(CATEGORY);
const recreation = (): Uint8Array => masterPrologue.recreationInPlaceCheck(CATEGORY);

describe('master prologue', () => {
  it('accepts a master that recreates itself in place', () => {
    expect(evaluateSpend({ prefix: prologue() })).toBe(true);
  });

  it('accepts an output worth more than the input, since a master may be funded', () => {
    expect(evaluateSpend({ prefix: prologue(), outputValue: 25_000n })).toBe(true);
  });

  it('rejects a body that does not end truthy, so the harness is not accepting vacuously', () => {
    expect(evaluateSpend({ prefix: prologue(), body: REJECTING_BODY })).toBe(false);
  });

  describe('the category ownership check on its own', () => {
    it('accepts its own category with minting capability', () => {
      expect(evaluateSpend({ prefix: ownership() })).toBe(true);
    });

    it('rejects an input that carries no token at all', () => {
      expect(evaluateSpend({ prefix: ownership(), inputHasToken: false })).toBe(false);
    });

    it('rejects a foreign category', () => {
      expect(evaluateSpend({ prefix: ownership(), inputCategory: FOREIGN })).toBe(false);
    });

    it('rejects a spent token without minting capability', () => {
      expect(evaluateSpend({ prefix: ownership(), inputCapability: 'mutable' })).toBe(false);
      expect(evaluateSpend({ prefix: ownership(), inputCapability: 'none' })).toBe(false);
    });
  });

  describe('the recreation check on its own', () => {
    it('accepts a faithful recreation', () => {
      expect(evaluateSpend({ prefix: recreation() })).toBe(true);
    });

    it('rejects an output that does not carry the master at the input index', () => {
      // No token on the output at all.
      expect(evaluateSpend({ prefix: recreation(), outputCategory: null })).toBe(false);
      // The wrong category.
      expect(evaluateSpend({ prefix: recreation(), outputCategory: FOREIGN })).toBe(false);
      // The wrong capability.
      expect(evaluateSpend({ prefix: recreation(), outputCapability: 'mutable' })).toBe(false);
      // A non-empty commitment, which a master never carries.
      expect(evaluateSpend({ prefix: recreation(), outputCommitment: new Uint8Array([0x01]) })).toBe(false);
      // A different lock.
      expect(evaluateSpend({
        prefix: recreation(),
        outputLock: encodeLockingBytecodeP2sh32(hash256(new Uint8Array([0x51]))),
      })).toBe(false);
    });

    it('rejects an output worth less than the input', () => {
      expect(evaluateSpend({ prefix: recreation(), outputValue: 19_999n })).toBe(false);
    });

    it('accepts an output worth exactly the input, so an entry may leave the value alone', () => {
      expect(evaluateSpend({ prefix: recreation(), outputValue: 20_000n })).toBe(true);
    });
  });

  it('is a prefix: the prologue leaves the stack as it found it', () => {
    // A body that reads the stack depth proves nothing was left behind: with an empty stack before the body, a
    // body that pushes the depth must push zero, and zero is falsy, so instead the body pushes one only when the
    // depth is empty. `OP_DEPTH OP_0 OP_NUMEQUAL` is true exactly when the prologue left nothing.
    const depthIsEmpty = new Uint8Array([Opcodes.OP_DEPTH, Opcodes.OP_0, Opcodes.OP_NUMEQUAL]);
    expect(evaluateSpend({ prefix: prologue(), body: depthIsEmpty })).toBe(true);
  });
});
