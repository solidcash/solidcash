import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract BatchCounter() {
  int counter;
  function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
  function reset() public { this.counter = 0; require(true); }
  function signed(sig s, pubkey pk) public { require(checkSig(s, pk)); }
}`;

describe('Release 4 compiler-hidden local batch', () => {
  it('advertises SCB1 without exposing a source ABI function', () => {
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    expect(artifact.hiddenBatch).toMatchObject({
      version: 1,
      selector: '53434231',
      maximumRows: 8,
      maximumBlobBytes: 223,
    });
    expect(artifact.abi.some((fn) => fn.name === '__scb1')).toBe(false);
    expect(artifact.hiddenBatch?.route.selector).toBe('53434231');
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: false,
      rejectionReason: 'transaction-signature-route-binding-required',
    });
  });

  it('leaves artifacts byte-identical when the experimental capability is disabled', () => {
    const baseline = compileString(SOURCE, { forceStateful: true });
    const explicitOff = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: false,
    });
    expect(explicitOff.bytecode).toBe(baseline.bytecode);
    expect(explicitOff.hiddenBatch).toBeUndefined();
  });

  it('fails closed on deferred caller context and forward-call semantics', () => {
    const artifact = compileString(`
      interface IDownstream { function ping(); }
      contract Guarded(address downstream) {
        int counter;
        function senderBound() public { this.counter = 1; require(msg.sender != tx.origin); }
        function forward() public {
          IDownstream(downstream).ping();
          this.counter = 2;
          require(true);
        }
        function plain(int n) public { this.counter = n; require(n >= 0); }
      }
    `, { forceStateful: true, experimentalHiddenBatch: true });

    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'senderBound')).toMatchObject({
      eligible: false,
      rejectionReason: 'direct-versus-batch-introspection-divergence',
      inputs: [],
    });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'forward')).toMatchObject({
      eligible: false,
      rejectionReason: 'batched-handler-forward-call-not-enabled',
      inputs: [],
    });
  });

  it('binds one parameter-keyed mapping entry into the physical SCB1 route', () => {
    const artifact = compileString(`contract MappingBatch() {
      mapping(bigint => bigint) values;
      function add(bigint key, bigint amount) public {
        this.values[key] = this.values[key] + amount;
        require(amount >= 0);
      }
      function check(bigint key, bigint expected) public {
        require(this.values[key] == expected);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });

    expect(artifact.hiddenBatch?.route.inputs).toEqual([
      { name: 'batchBlob', type: 'bytes' },
      { name: '__scb_key_values_0', type: 'bigint' },
    ]);
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(1);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'add'))
      .toMatchObject({
        eligible: true,
        batchKeyWitnesses: [{ routeInput: '__scb_key_values_0', inputIndex: 0 }],
      });
  });

  it('allocates one exact two-row resource shape for shared and row-local mapping keys', () => {
    const artifact = compileString(`contract MappingAliasBatch() {
      mapping(bigint => bigint) values;
      function move(bigint from, bigint to, bigint amount) public {
        this.values[from] = this.values[from] - amount;
        this.values[to] = this.values[to] + amount;
        require(amount >= 0);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch).toMatchObject({
      minimumRows: 2,
      maximumRows: 2,
    });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'move'))
      .toMatchObject({
        eligible: true,
        batchKeyWitnesses: [
          { routeInput: '__scb_key_move_from_global', inputIndex: 0 },
          { routeInput: '__scb_key_move_to_row', inputIndex: 1, perRow: true },
        ],
      });
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(3);
  });

  it('advertises the exact ERC-20 transferFrom resource shape', () => {
    const source = `contract MappingToken() {
      mapping(bytes20 => bigint) balances;
      mapping(bytes20 => mapping(bytes20 => bigint)) allowances;

      function transferFrom(
        bytes20 from, bytes20 to, bytes20 spender, bigint amount
      ) public {
        require(this.allowances[from][spender] >= amount);
        require(this.balances[from] >= amount);
        this.allowances[from][spender] = this.allowances[from][spender] - amount;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
      }
    }`;
    const artifact = compileString(source, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });

    expect(artifact.hiddenBatch).toMatchObject({
      minimumRows: 2,
      maximumRows: 2,
    });
    expect(artifact.hiddenBatch?.handlers[0]).toMatchObject({
      name: 'transferFrom',
      eligible: true,
      batchKeyWitnesses: [
        { routeInput: '__scb_key_transferFrom_from_global', inputIndex: 0 },
        { routeInput: '__scb_key_transferFrom_to_row', inputIndex: 1, perRow: true },
        { routeInput: '__scb_key_transferFrom_spender_global', inputIndex: 2 },
      ],
    });
    expect(artifact.hiddenBatch?.route.entryAccesses).toHaveLength(4);
    expect(artifact.bytecode.length / 2).toBeLessThan(10_000);
  });

  it('allocates one ordered conditional event slot per possible row', () => {
    const artifact = compileString(`contract EventBatch() {
      bigint current;
      event Changed(bigint next);
      function set(bigint next) public {
        this.current = next;
        emit Changed(next);
        require(next >= 0);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'set')?.eligible)
      .toBe(true);
    expect(artifact.hiddenBatch?.route.emits).toHaveLength(8);
    expect(artifact.hiddenBatch?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'event')).toHaveLength(8);
    expect(artifact.bytecode.length / 2).toBeLessThan(10_000);
  });

  it('aggregates one common return value per row into the route return event', () => {
    const artifact = compileString(`contract ResultBatch() {
      bigint total;
      function add(bigint amount) public returns (bigint) {
        this.total = this.total + amount;
        require(amount >= 0);
        return this.total;
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'add'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'bigint' }] });
    expect(artifact.hiddenBatch?.route.outputs).toEqual([{ type: 'bytes' }]);
    expect(artifact.hiddenBatch?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'returnEvent')).toHaveLength(1);
    expect(artifact.bytecode.length / 2).toBeLessThan(10_000);
  });

  it('allocates one ordered conditional value-transfer slot per possible row', () => {
    const artifact = compileString(`contract ValueBatch() {
      function pay(bytes recipient, bigint amount) public {
        this.transfer(recipient, amount);
        require(amount >= 0);
      }
    }`, { forceStateful: true, experimentalHiddenBatch: true });
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'pay')?.eligible)
      .toBe(true);
    expect(artifact.hiddenBatch?.route.transferCount).toBe(8);
    expect(artifact.hiddenBatch?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'transfer')).toHaveLength(8);
    expect(artifact.bytecode.length / 2).toBeLessThan(10_000);
  });
});
