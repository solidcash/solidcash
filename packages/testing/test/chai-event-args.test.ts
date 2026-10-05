import { cashAddressToLockingBytecode, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { decorateDecodedResult, hash160 } from '@solidcash/utils';
import { describe, expect as vitestExpect, it } from 'vitest';
import { expect } from '../src/chai.js';

describe('chai empty-address and event predicates', () => {
  it('treats a 20-byte fallback over a zero VM-number as empty', () => {
    expect('').to.deep.equal('0000000000000000000000000000000078000000');
    expect('0x0000000000000000000000000000000000000000').to.equal('');
  });

  it('compares an ABI-packed address payload with its CashAddress', () => {
    const address = 'bchtest:qpcn7sy4mgy9glvkjxj3r5y0s9rhy5lwtymfzfnde8';
    const decoded = cashAddressToLockingBytecode(address);
    if (typeof decoded === 'string') throw new Error(decoded);
    const payload = decoded.bytecode.slice(3, 23);
    expect(payload).to.equal(address);
    expect(address).to.equal(payload);
  });

  it('compares a hex-encoded locking bytecode with its CashAddress', () => {
    const address = 'bchtest:qpcn7sy4mgy9glvkjxj3r5y0s9rhy5lwtymfzfnde8';
    const decoded = cashAddressToLockingBytecode(address);
    if (typeof decoded === 'string') throw new Error(decoded);
    const lockingBytecodeHex = `0x${Array.from(decoded.bytecode)
      .map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    expect(lockingBytecodeHex).to.equal(address);
    expect(address).to.equal(lockingBytecodeHex);
  });

  it('compares a Solidity event address string with the exact P2SH32 CashAddress identity', () => {
    const locking = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x31), 0x87);
    const encoded = lockingBytecodeToCashAddress({
      bytecode: locking, prefix: 'bchtest', tokenSupport: false,
    });
    const address = typeof encoded === 'string' ? encoded : encoded.address;
    const identity = `0x${Array.from(hash160(locking), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    expect(identity).to.equal(address);
    expect(address).to.equal(identity);
    const different = `0x${'12'.repeat(20)}`;
    vitestExpect(() => expect(different).to.equal(address)).toThrow();
    vitestExpect(() => expect(address).to.equal(different)).toThrow();
    vitestExpect(() => expect(hash160(locking)).to.equal(locking)).toThrow();
  });

  it('compares typed Solidity-narrowed identities with native BCH locking bytecodes', () => {
    const p2pkh = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x42), 0x88, 0xac]);
    const p2sh32 = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x24), 0x87]);

    const typedP2pkh = decorateDecodedResult(p2pkh.slice(3, 23), 'address', undefined, 'evm-abi-v1');
    const typedP2sh32 = decorateDecodedResult(hash160(p2sh32), 'address', undefined, 'evm-abi-v1');
    expect(typedP2pkh).to.equal(p2pkh);
    expect(p2pkh).to.deep.equal(typedP2pkh);
    expect(typedP2sh32)
      .to.equal(p2sh32);
  });

  it('invokes withArgs predicates against receipt event args', async () => {
    const eventData = { data_: new Uint8Array([0x20, 0x00, 0x41]) };
    const receipt = {
      txid: 'ab',
      events: [{
        event: 'JobEvent',
        args: { jobId: 0n, eventData },
      }],
    };
    const contract = {
      artifact: {
        events: [{
          name: 'JobEvent',
          parameters: [{ name: 'jobId' }, { name: 'eventData' }],
        }],
      },
    };
    let seen: unknown;
    await expect(receipt).to.emit(contract, 'JobEvent').withArgs(0n, (value: typeof eventData) => {
      seen = value;
      return true;
    });
    vitestExpect(seen).toBe(eventData);
  });

  it('fails when a withArgs predicate returns false', async () => {
    const receipt = {
      txid: 'ab',
      events: [{
        event: 'JobEvent',
        args: { jobId: 0n, eventData: { data_: new Uint8Array() } },
      }],
    };
    const contract = {
      artifact: {
        events: [{
          name: 'JobEvent',
          parameters: [{ name: 'jobId' }, { name: 'eventData' }],
        }],
      },
    };
    await vitestExpect(
      expect(receipt).to.emit(contract, 'JobEvent').withArgs(0n, () => false),
    ).rejects.toThrow(/predicate returned false/);
  });

  it('checks every same-name event before rejecting withArgs', async () => {
    const receipt = {
      txid: 'ab',
      events: [
        { event: 'JobEvent', args: { jobId: 0n, eventData: { type_: 1n, data_: 0n } } },
        { event: 'JobEvent', args: { jobId: 0n, eventData: { type_: 2n, data_: 7n } } },
      ],
    };
    const contract = {
      artifact: {
        events: [{
          name: 'JobEvent',
          parameters: [{ name: 'jobId' }, { name: 'eventData' }],
        }],
      },
    };
    let observed = 0n;
    await expect(receipt).to.emit(contract, 'JobEvent').withArgs(0n, (value: { type_: bigint; data_: bigint }) => {
      vitestExpect(value.type_).toBe(2n);
      observed = value.data_;
      return true;
    });
    vitestExpect(observed).toBe(7n);
  });

  it('queries the emitting contract when an atomic receipt has no decoded events', async () => {
    const receipt = { txid: 'ab' };
    const eventData = { type_: 2n, data_: 9n };
    const contract = {
      artifact: {
        events: [{
          name: 'JobEvent',
          parameters: [{ name: 'jobId' }, { name: 'eventData' }],
        }],
      },
      filters: { JobEvent: () => ({ event: 'JobEvent' }) },
      queryFilter: async () => [{ txid: 'ab', eventName: 'JobEvent', args: { jobId: 0n, eventData } }],
    };
    let observed = 0n;
    await expect(receipt).to.emit(contract, 'JobEvent').withArgs(0n, (value: typeof eventData) => {
      observed = value.data_;
      return true;
    });
    vitestExpect(observed).toBe(9n);
  });

  it('does not silently accept withArgs when a sent receipt has no recoverable events', async () => {
    await vitestExpect(
      expect({ txid: 'ab' }).to.emit({}, 'JobEvent').withArgs(1n),
    ).rejects.toThrow(/has no decoded events/);
  });

  it('negates the next emit without reversing a preceding withArgs check', async () => {
    const receipt = {
      txid: 'ab',
      events: [{ event: 'Changed', args: { value: 7n } }],
    };
    const contract = { artifact: { events: [{ name: 'Changed', parameters: [{ name: 'value' }] }] } };
    await expect(receipt).to.emit(contract, 'Changed').withArgs(7n)
      .and.not.to.emit(contract, 'Absent');
    await vitestExpect(
      expect(receipt).to.emit(contract, 'Changed').withArgs(7n)
        .and.not.to.emit(contract, 'Changed'),
    ).rejects.toThrow("expected not to emit 'Changed'");
  });

  it('uses an empty transaction-scoped query to verify an event was absent', async () => {
    const receipt = { txid: 'ab' };
    const contract = {
      filters: { Missing: () => ({ event: 'Missing' }) },
      queryFilter: async () => [{ txid: 'other', eventName: 'Missing' }],
    };
    await expect(receipt).not.to.emit(contract, 'Missing');
    await vitestExpect(expect(receipt).to.emit(contract, 'Missing'))
      .rejects.toThrow("event 'Missing' not found in transaction ab");
    await vitestExpect(expect(receipt).not.to.emit({}, 'Missing'))
      .rejects.toThrow('cannot verify absence');
  });
});

describe('chai revert assertions', () => {
  it('matches the reason produced by execution', async () => {
    const transaction = { debug: () => { throw new Error('expected reason'); } };
    await expect(transaction).to.be.revertedWith('expected reason');
  });

  it('does not accept a reason merely because transaction metadata declares it', async () => {
    const transaction = {
      debug: () => { throw new Error('different runtime failure'); },
      declaresRevertReason: () => true,
    };
    await vitestExpect(expect(transaction).to.be.revertedWith('expected reason'))
      .rejects.toThrow(/different runtime failure/);
  });

  it('matches a custom-error name but rejects unverifiable custom-error arguments', async () => {
    const transaction = { debug: () => { throw new Error('revert ExampleError(...)'); } };
    await expect(transaction).to.be.revertedWithCustomError({}, 'ExampleError');
    await vitestExpect(
      expect(transaction).to.be.revertedWithCustomError({}, 'ExampleError').withArgs(1n),
    ).rejects.toThrow(/cannot yet verify its arguments/);
  });

  it('rejects an unrelated runtime failure under relaxed mock limits', async () => {
    const transaction = {
      functionName: 'mutate',
      parentContract: {
        inner: {
          provider: { consensusLimits: { maximumInputBytes: 1_000_000 } },
          artifact: { abi: [{ name: 'mutate', writesState: true }] },
        },
      },
      send: async (): Promise<void> => { throw new Error('unrelated runtime failure'); },
    };
    await vitestExpect(
      expect(transaction).to.be.revertedWithCustomError({}, 'ExpectedError'),
    ).rejects.toThrow(/unrelated runtime failure/);
    await expect({
      ...transaction,
      send: async (): Promise<void> => { throw new Error('revert ExpectedError(...)'); },
    }).to.be.revertedWithCustomError({}, 'ExpectedError');
  });

  it('verifies custom-error arguments from the same rejected transaction', async () => {
    let sends = 0;
    const transaction = {
      functionName: 'mutate',
      parentContract: {
        inner: {
          provider: { consensusLimits: { maximumInputBytes: 1_000_000 } },
          artifact: { abi: [{ name: 'mutate', writesState: true }] },
        },
      },
      send: async (): Promise<void> => {
        sends += 1;
        const error = new Error('revert ExpectedError(...)') as Error & { errorArgs: bigint[] };
        error.errorArgs = [0n];
        throw error;
      },
    };
    await expect(transaction).to.be.revertedWithCustomError({}, 'ExpectedError').withArgs(0n);
    vitestExpect(sends).toBe(1);
  });
});
