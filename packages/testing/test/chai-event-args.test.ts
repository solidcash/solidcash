import { describe, expect as vitestExpect, it } from 'vitest';
import { expect } from '../src/chai.js';

describe('chai empty-address and event predicates', () => {
  it('treats a 20-byte fallback over a zero VM-number as empty', () => {
    expect('').to.deep.equal('0000000000000000000000000000000078000000');
    expect('0x0000000000000000000000000000000000000000').to.equal('');
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
});
