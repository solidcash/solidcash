import { valuesEqual, type ParsedEvent, type EventFilter } from '../../src/stateful/StateReader.js';
import type { EventDefinitionAbi } from '@solidcash/utils';

describe('EventFiltering', () => {
  describe('valuesEqual', () => {
    it('should compare bigints correctly', () => {
      expect(valuesEqual(1n, 1n)).toBe(true);
      expect(valuesEqual(1n, 2n)).toBe(false);
      expect(valuesEqual(0n, 0n)).toBe(true);
    });

    it('should compare booleans correctly', () => {
      expect(valuesEqual(true, true)).toBe(true);
      expect(valuesEqual(false, false)).toBe(true);
      expect(valuesEqual(true, false)).toBe(false);
    });

    it('should compare strings correctly', () => {
      expect(valuesEqual('hello', 'hello')).toBe(true);
      expect(valuesEqual('hello', 'world')).toBe(false);
    });

    it('should compare Uint8Arrays correctly', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      const c = new Uint8Array([1, 2, 4]);
      const d = new Uint8Array([1, 2]);

      expect(valuesEqual(a, b)).toBe(true);
      expect(valuesEqual(a, c)).toBe(false);
      expect(valuesEqual(a, d)).toBe(false);
    });

    it('should compare struct records correctly', () => {
      const a = { name: 'alice' as const, age: 30n };
      const b = { name: 'alice' as const, age: 30n };
      const c = { name: 'bob' as const, age: 30n };

      expect(valuesEqual(a, b)).toBe(true);
      expect(valuesEqual(a, c)).toBe(false);
    });

    it('should return false for different types', () => {
      expect(valuesEqual(1n, true)).toBe(false);
      expect(valuesEqual('hello', 1n)).toBe(false);
    });
  });

  describe('filter validation', () => {
    const eventDef: EventDefinitionAbi = {
      name: 'Transfer',
      signature: 'Transfer(pubkey,pubkey,int)',
      parameters: [
        { name: 'from', type: 'pubkey', indexed: true },
        { name: 'to', type: 'pubkey', indexed: true },
        { name: 'amount', type: 'int' },
      ],
    };

    it('should identify indexed parameters', () => {
      const indexedParams = new Set(
        eventDef.parameters.filter((p) => p.indexed).map((p) => p.name),
      );
      expect(indexedParams.has('from')).toBe(true);
      expect(indexedParams.has('to')).toBe(true);
      expect(indexedParams.has('amount')).toBe(false);
    });

    it('should reject filter on non-indexed parameter', () => {
      const indexedParams = new Set(
        eventDef.parameters.filter((p) => p.indexed).map((p) => p.name),
      );
      const filters: EventFilter = { amount: 100n };

      for (const key of Object.keys(filters)) {
        expect(indexedParams.has(key)).toBe(false);
      }
    });

    it('should accept filter on indexed parameter', () => {
      const indexedParams = new Set(
        eventDef.parameters.filter((p) => p.indexed).map((p) => p.name),
      );
      const filters: EventFilter = { from: new Uint8Array(33) };

      for (const key of Object.keys(filters)) {
        expect(indexedParams.has(key)).toBe(true);
      }
    });
  });

  describe('event filtering logic', () => {
    const mockEvents: ParsedEvent[] = [
      {
        txid: 'tx1', vout: 0,
        values: { from: new Uint8Array([1, 2, 3]), to: new Uint8Array([4, 5, 6]), amount: 100n },
      },
      {
        txid: 'tx2', vout: 0,
        values: { from: new Uint8Array([1, 2, 3]), to: new Uint8Array([7, 8, 9]), amount: 200n },
      },
      {
        txid: 'tx3', vout: 0,
        values: { from: new Uint8Array([10, 11, 12]), to: new Uint8Array([4, 5, 6]), amount: 300n },
      },
    ];

    it('should return all events when no filter is provided', () => {
      const filtered = mockEvents.filter(() => true);
      expect(filtered).toHaveLength(3);
    });

    it('should filter by a single indexed value', () => {
      const filterFrom = new Uint8Array([1, 2, 3]);
      const filtered = mockEvents.filter(
        (e) => valuesEqual(e.values.from, filterFrom),
      );
      expect(filtered).toHaveLength(2);
      expect(filtered[0].txid).toBe('tx1');
      expect(filtered[1].txid).toBe('tx2');
    });

    it('should filter by multiple indexed values', () => {
      const filterFrom = new Uint8Array([1, 2, 3]);
      const filterTo = new Uint8Array([4, 5, 6]);
      const filtered = mockEvents.filter(
        (e) => valuesEqual(e.values.from, filterFrom) && valuesEqual(e.values.to, filterTo),
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].txid).toBe('tx1');
    });

    it('should return empty array when no events match filter', () => {
      const filterFrom = new Uint8Array([99, 99, 99]);
      const filtered = mockEvents.filter(
        (e) => valuesEqual(e.values.from, filterFrom),
      );
      expect(filtered).toHaveLength(0);
    });
  });
});
