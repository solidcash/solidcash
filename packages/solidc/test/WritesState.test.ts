import { compileString } from '../src/index.js';

// writesState marks a stateful-contract function as provably read-only (false) so the SDK can skip its
// derivation probe. Conservative: any mutation, side-effect, or covenant-bypass path -> true. Only emitted
// for stateful contracts (absent on stateless ones, where it is meaningless).
describe('AbiFunction.writesState classification', () => {
  const ws = (src: string, opts = {}): Record<string, boolean | undefined> => {
    const abi = compileString(src, { forceStateful: true, ...opts }).abi;
    return Object.fromEntries(abi.map((f) => [f.name, f.writesState]));
  };

  it('marks pure scalar/array/mapping readers read-only', () => {
    const r = ws(`pragma solidcash >=0.8.0;
      contract C() {
        int counter;
        int[] items;
        mapping(int => int) m;
        function getCounter(int n) { require(this.counter == n); }
        function len(int n) { require(this.items.length == n); }
        function at(int i, int v) { require(this.items[i] == v); }
        function mapAt(int k, int v) { require(this.m[k] == v); }
      }`);
    expect(r.getCounter).toBe(false);
    expect(r.len).toBe(false);
    expect(r.at).toBe(false);
    expect(r.mapAt).toBe(false);
  });

  it('marks scalar/array/mapping writers as writers', () => {
    const r = ws(`pragma solidcash >=0.8.0;
      contract C() {
        int counter;
        int[] items;
        mapping(int => int) m;
        function setC(int v) { this.counter = v; require(true); }
        function push(int v) { this.items.push(v); require(true); }
        function setM(int k, int v) { this.m[k] = v; require(true); }
        function delM(int k) { delete this.m[k]; require(true); }
      }`);
    expect(r.setC).toBe(true);
    expect(r.push).toBe(true);
    expect(r.setM).toBe(true);
    expect(r.delM).toBe(true);
  });

  it('treats emit / transfer as writers', () => {
    const r = ws(`pragma solidcash >=0.8.0;
      contract C() {
        int x;
        event E(int v);
        function fire(int v) { emit E(v); require(this.x == this.x); }
        function pay(int amt) { payable(msg.sender).transfer(amt); require(true); }
      }`);
    expect(r.fire).toBe(true);
    expect(r.pay).toBe(true);
  });

  it('omits writesState for stateless contracts', () => {
    const abi = compileString(`pragma solidcash >=0.8.0;
      contract P2PKH(bytes20 pkh) {
        function spend(pubkey pk, sig s) { require(hash160(pk) == pkh); require(checkSig(s, pk)); }
      }`).abi;
    expect(abi[0].writesState).toBeUndefined();
  });
});
