import { compileString } from './direct-compile.js';

const size = (source: string, options: Record<string, unknown> = {}): number =>
  compileString(source, options).bytecode.split(' ').length;
const bytecode = (source: string, options: Record<string, unknown> = {}): string =>
  compileString(source, options).bytecode;

const withStruct = (init: string, use: string, extra = ''): string => `
pragma solidcash ^0.53.0;
struct Pair { bigint a; bigint b; }
contract C(pubkey pk) {
    function f(sig s, bigint x) {
        require(checkSig(s, pk));
        Pair memory p = ${init};
        ${extra}
        require(${use});
    }
}
`;

const scalars = `
pragma solidcash ^0.53.0;
contract C(pubkey pk) {
    function f(sig s, bigint x) {
        require(checkSig(s, pk));
        bigint a = tx.inputs[0].value;
        bigint b = tx.outputs[0].value + x;
        require(a >= b);
    }
}
`;

describe('ScalarReplaceStructLocals', () => {
  const init = 'Pair({ a: tx.inputs[0].value, b: tx.outputs[0].value + x })';

  it('compiles a read-only struct local exactly like the hand-written scalar locals', () => {
    expect(bytecode(withStruct(init, 'p.a >= p.b'))).toBe(bytecode(scalars));
  });

  it('removes the struct codec: much smaller than the escape-hatch lowering', () => {
    const replaced = size(withStruct(init, 'p.a >= p.b'));
    const framed = size(withStruct(init, 'p.a >= p.b'), { scalarReplaceStructLocals: false });
    expect(replaced).toBeLessThan(framed);
  });

  it('accepts positional and reordered named construction', () => {
    expect(bytecode(withStruct('Pair(tx.inputs[0].value, tx.outputs[0].value + x)', 'p.a >= p.b'))).toBe(bytecode(scalars));
    // Named arguments are evaluated in source order, so `b` is computed first.
    const bFirst = scalars.replace(
      '        bigint a = tx.inputs[0].value;\n        bigint b = tx.outputs[0].value + x;',
      '        bigint b = tx.outputs[0].value + x;\n        bigint a = tx.inputs[0].value;',
    );
    expect(bFirst).not.toBe(scalars);
    expect(bytecode(withStruct('Pair({ b: tx.outputs[0].value + x, a: tx.inputs[0].value })', 'p.a >= p.b'))).toBe(bytecode(bFirst));
  });

  it('leaves a local alone when it is written, so the field write keeps its rebuild semantics', () => {
    const source = withStruct(init, 'p.a >= p.b', 'p.a = p.a + 1;');
    expect(bytecode(source)).toBe(bytecode(source, { scalarReplaceStructLocals: false }));
  });

  it('leaves a local alone when the whole value escapes (hashed or passed on)', () => {
    const source = withStruct(init, 'sha256(abi.encode(p)) != sha256(0x)');
    expect(bytecode(source)).toBe(bytecode(source, { scalarReplaceStructLocals: false }));
  });

  it('leaves a local alone when it is initialised by a call rather than a construction', () => {
    const source = `
pragma solidcash ^0.53.0;
struct Pair { bigint a; bigint b; }
function mk(bigint a, bigint b) pure returns (Pair memory) { return Pair(a, b); }
contract C(pubkey pk) {
    function f(sig s, bigint x) {
        require(checkSig(s, pk));
        Pair memory p = mk(tx.inputs[0].value, x);
        require(p.a >= p.b);
    }
}
`;
    expect(bytecode(source)).toBe(bytecode(source, { scalarReplaceStructLocals: false }));
  });

  it('leaves a local alone when a state variable of its name is read before it (evmCompat)', () => {
    const source = `pragma solidity ^0.8.0;
contract C {
    struct Pair { uint a; uint b; }
    Pair v;
    constructor() { v = Pair(1, 2); }
    function f(uint x) public {
        uint before = v.a;
        {
            Pair memory v = Pair(x, x + 1);
            require(v.b > v.a);
        }
        require(before == 1);
    }
}`;
    const options = { evmCompat: true };
    expect(bytecode(source, options)).toBe(bytecode(source, { ...options, scalarReplaceStructLocals: false }));
  });

  it('leaves a local alone when its own initializer reads a state variable of its name (evmCompat)', () => {
    const source = `pragma solidity ^0.8.0;
contract C {
    struct Pair { uint a; uint b; }
    Pair v;
    constructor() { v = Pair(1, 2); }
    function f(uint x) public {
        {
            Pair memory v = Pair(v.a, x);
            require(v.b > v.a);
        }
    }
}`;
    const options = { evmCompat: true };
    expect(bytecode(source, options)).toBe(bytecode(source, { ...options, scalarReplaceStructLocals: false }));
  });

  it('publishes a call target read through a replaced field as the direct read of its value', () => {
    const proxy = (body: string): string => `pragma solidcash >=0.8.0;
contract P(address impl) {
    bigint counter;
    struct Route { bytes to; }
    function up(bytes input, bytes blob) external {
        ${body}
        require(input.length > 0);
    }
}`;
    const target = (body: string): unknown => compileString(proxy(body)).abi
      .find((entry) => entry.name === 'up')!.lowLevelCalls![0].target;
    const replaced = target('Route memory r = Route(blob); address t = address(r.to); t.delegatecall(input);');
    expect(replaced).toEqual(target('address t = address(blob); t.delegatecall(input);'));
    expect(target('Route memory r = Route(blob); r.to = r.to; address t = address(r.to); t.delegatecall(input);'))
      .toEqual({ kind: 'computed' });
  });

  it('does not touch a struct with a nested struct or array field', () => {
    const source = `
pragma solidcash ^0.53.0;
struct Inner { bigint v; }
struct Outer { Inner i; bigint w; }
contract C(pubkey pk) {
    function f(sig s, bigint x) {
        require(checkSig(s, pk));
        Outer memory o = Outer(Inner(x), x + 1);
        require(o.w > o.i.v);
    }
}
`;
    expect(bytecode(source)).toBe(bytecode(source, { scalarReplaceStructLocals: false }));
  });
});
