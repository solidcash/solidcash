import { cashAddressToLockingBytecode } from '@bitauth/libauth';
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
});
