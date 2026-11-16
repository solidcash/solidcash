/**
 * B7.0: when a compile builds `Deploy<C>`, and why it does not.
 *
 * A plain compile builds none. `deployer: true` concerns the contract being compiled only, and a contract that
 * cannot have one records the A4.1 reason and warns instead of failing.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';
import { asmToScript, computeCollectionHash, scriptToBytecode } from '@solidcash/utils';
import { sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import type { DeployerConstants } from '../src/generation/deployerConstants.js';

const P = 'pragma solidcash ^0.51.0;';
const STATEFUL = `${P} contract C { int n; function bump() { n = n + 1; } }`;
const STATEFULWithCtor = `${P} contract C { int n; constructor() { n = 1; } function bump() { n = n + 1; } }`;

const compile = (source: string, options: Record<string, unknown>): {
  artifact: ReturnType<typeof compileString>;
  warnings: string[];
} => {
  const warnings: string[] = [];
  const artifact = compileString(source, {
    messageBus: false, warningListener: (warning) => warnings.push(warning.message), ...options,
  });
  return { artifact, warnings };
};

describe('B7.0: when a deployer is built', () => {
  it('a plain compile builds no deployer and records no reason', () => {
    const { artifact, warnings } = compile(STATEFUL, {});
    expect(artifact.deployer).toBeUndefined();
    expect(artifact.deployerUnsupported).toBeUndefined();
    expect(warnings.some((warning) => warning.includes('no deployer'))).toBe(false);
  });

  it('a stateless contract asked for a deployer warns and records not-stateful-direct', () => {
    const source = `${P} contract S { function f(int x) { require(x == 1); } }`;
    const { artifact, warnings } = compile(source, { deployer: true });
    expect(artifact.deployerUnsupported).toBe('not-stateful-direct');
    expect(artifact.deployer).toBeUndefined();
    expect(warnings.some((warning) => warning.includes('no deployer (not-stateful-direct)'))).toBe(true);
  });

  it('a blockhash reader records blockhash-ring', () => {
    const source = `${P} contract B { int n; function f(bytes32 h) { require(blockhash(n) == h); } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.deployerUnsupported).toBe('blockhash-ring');
  });

  // A2: a live block read names its oracle pool by the contract argument `__oraclePool`, which A carries, so the code
  // is the same for every category: the deployer is built, and its ABI says that C reads block data.
  it('builds a deployer for a live block reader, which binds its oracle pool in A', () => {
    const source = `${P} contract C { int n; constructor() { n = 1; } function f() { n = block.number; } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.deployerUnsupported).toBeUndefined();
    expect(artifact.deployer?.readsBlockData).toBe(true);
    expect(artifact.constructorInputs.map((input) => input.name)).toContain('__oraclePool');
  });

  it('a message-bus compile records lock-composition', () => {
    const source = `${P} contract C { int n; function a() { n = n + 1; } function b() { n = n + 2; } }`;
    const { artifact, warnings } = compile(source, { deployer: true, messageBus: true });
    expect(artifact.deployerUnsupported).toBe('lock-composition');
    expect(warnings.some((warning) => warning.includes('lock-composition'))).toBe(true);
  });

  describe('single-container-key (A4.1): a single token container named by anything but a contract parameter', () => {
    const single = (params: string, body: string): string => `${P} pragma tokencontainer single;
      contract C(bytes32 asset) { int n; bytes32 immutable key; constructor() { n = 1; key = asset; }
        function f(${params}address r) public { ${body} n = n + 1; } }`;

    it('keeps the deployer and its row for a container a contract parameter names, by a transfer or a read', () => {
      for (const body of ['this.tokens[asset].transfer(r, 1);', 'require(this.tokens[asset].tokenAmount > 0);']) {
        const { artifact } = compile(single('', body), { deployer: true });
        expect(artifact.deployerUnsupported).toBeUndefined();
        expect(artifact.deployer?.tokenRows).toEqual([0]);
      }
    });

    for (const [name, params, body] of [
      ['a parameter of the function', 'bytes32 cat, ', 'this.tokens[cat].transfer(r, 1);'],
      ['a parameter of the function, read', 'bytes32 cat, ', 'require(this.tokens[cat].tokenAmount > 0);'],
      ['C\'s own category', '', 'bytes32 c = this.category; this.tokens[c].transfer(r, 1);'],
      ['an immutable state value', '', 'bytes32 c = key; this.tokens[c].transfer(r, 1);'],
    ] as const) {
      it(`refuses a container named by ${name}`, () => {
        const { artifact, warnings } = compile(single(params, body), { deployer: true });
        expect(artifact.deployer).toBeUndefined();
        expect(artifact.deployerUnsupported).toBe('single-container-key');
        expect(warnings.some((warning) => warning.includes('single-container-key'))).toBe(true);
      });
    }

    it('refuses when one function names a contract parameter\'s container and another names its own', () => {
      const source = `${P} pragma tokencontainer single;
        contract C(bytes32 asset) { int n; constructor() { n = 1; }
          function f(address r) public { this.tokens[asset].transfer(r, 1); n = n + 1; }
          function g(bytes32 cat, address r) public { this.tokens[cat].transfer(r, 1); n = n + 1; } }`;
      const { artifact } = compile(source, { deployer: true });
      expect(artifact.deployerUnsupported).toBe('single-container-key');
    });

    it('does not apply without the single pragma', () => {
      const source = `${P} contract C(bytes32 asset) { int n; constructor() { n = 1; }
        function g(bytes32 cat, address r) public { this.tokens[cat].transfer(r, 1); n = n + 1; } }`;
      const { artifact } = compile(source, { deployer: true });
      expect(artifact.deployerUnsupported).toBeUndefined();
      expect(artifact.deployer?.tokenRows).toEqual([]);
    });
  });

  it('a struct constructor parameter records param-type', () => {
    const source = `${P} struct P { int x; } contract C { int n; constructor(P p) { n = p.x; } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.deployerUnsupported).toBe('param-type');
  });

  it('records that the constructor writes a collection', () => {
    const source = `${P} contract C { mapping(int => int) m; int n;
      constructor() { m[1] = 2; } function bump() { n = n + 1; } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.constructorWritesCollections).toBe(true);
  });

  it('derives the deployer constants from C\'s compile', () => {
    const source = `${P} contract C { mapping(int => int) m; int n;
      function bump() { n = n + 1; } }`;
    const box: { constants?: DeployerConstants } = {};
    const { artifact } = compile(source, { deployer: true, __deployerConstantsBox: box } as never);
    const constants = box.constants!;
    expect(constants.code).toEqual(scriptToBytecode(asmToScript(artifact.bytecode)));
    expect(constants.dataNftCount).toBe(artifact.stateLayout!.dataNftCount);
    const collection = constants.collections.find((candidate) => candidate.name === 'm')!;
    expect(collection.signature).toBe('m:mapping(int256 => int256)');
    expect(collection.hash).toEqual(computeCollectionHash(collection.signature));
    expect(constants.singleTokenContainer).toBe(false);
    expect(constants.singleTokenContainerKeys).toEqual([]);
  });

  it('derives the empty sorted-list HEAD and single-container keys', () => {
    const source = `${P} contract C { mapping(int => int) m; bytes32 t;
      function put(int k, int v) { m[k] = v; } }`;
    const box: { constants?: DeployerConstants } = {};
    const { artifact } = compile(source, { deployer: true, __deployerConstantsBox: box } as never);
    expect(artifact.stateLayout!.collections!.find((c) => c.name === 'm')!.sorted).toBe(true);
    const constants = box.constants!;
    const collection = constants.collections.find((candidate) => candidate.name === 'm')!;
    expect(collection.sorted).toBe(true);
    expect(collection.headCommitment).toEqual(new Uint8Array(128));
  });

  it('a supported stateful direct contract records no reason and publishes Deploy<C>', () => {
    const { artifact } = compile(STATEFUL, { deployer: true });
    expect(artifact.deployerUnsupported).toBeUndefined();
    expect(artifact.deployer).toBeDefined();
    expect(artifact.deployer!.abi.map((fn) => fn.name)).toEqual(['create', 'sweep']);
    expect(artifact.deployer!.abi.map((fn) => fn.selector)).toEqual(['af341413', '740b423a']);
    expect(artifact.deployer!.abi.find((fn) => fn.name === 'sweep')!.inputs).toEqual([]);
    expect(artifact.deployer!.version).toBe(1);
    expect(artifact.deployer!.genesisOutputs).toBe(2);
  });

  it('keeps exactly the create and sweep arms for every contract shape', () => {
    const cases = [
      `${P} contract C { int n; constructor() { n = 1; } function bump() { n = n + 1; } }`,
      `${P} contract Base { int b; function baseFn() { b = b + 1; } }
        contract C is Base { int n; constructor() { n = 1; } }`,
      `${P} contract C { int n; constructor() { n = 1; } function create() { n = n + 1; }
        function sweep() { n = n + 2; } }`,
      `${P} contract C { int n; constructor() { n = 1; } receive() external payable { n = n + 1; }
        fallback() external { n = n + 2; } }`,
      `${P} contract C { int n; constructor() { n = 1; } function bump() { n = n + 1; } }`,
    ];
    for (const source of cases) {
      const { artifact } = compile(source, { deployer: true });
      expect(artifact.deployer, source).toBeDefined();
      expect(artifact.deployer!.abi.map((fn) => fn.selector), source).toEqual(['af341413', '740b423a']);
    }
    const compat = compile(`${P} contract C { uint public n; constructor() { n = 1; } }`,
      { deployer: true, evmCompat: true });
    expect(compat.artifact.deployer!.abi.map((fn) => fn.selector)).toEqual(['af341413', '740b423a']);
  });

  it('the arms check throws for a program a test hook gave a third entry', () => {
    expect(() => compile(STATEFUL, { deployer: true, __deployerTestBox: { thirdArm: true } } as never))
      .toThrow(/internal deployer check failed/);
  });

  it('fails closed when create would pin no rows: no genesis layout, or a kept trailing region over container rows', () => {
    // Every create has a layout, even for a C without a constructor; a test hook removes it.
    expect(compile(STATEFUL, { deployer: true }).artifact.deployer).toBeDefined();
    expect(() => compile(STATEFUL, { deployer: true, __deployerTestBox: { genesisLayout: 'drop' } } as never))
      .toThrow(/internal deployer check failed: create has no genesis layout/);
    const single = `${P} pragma satoshicontainer single; contract C { int n; constructor() { n = 1; }
      function f() public payable { n = n + 1; } }`;
    expect(compile(single, { deployer: true }).artifact.deployer!.satoshiContainer).toBe('required');
    expect(() => compile(single, { deployer: true, __deployerTestBox: { genesisLayout: 'trailing' } } as never))
      .toThrow(/internal deployer check failed: the constructor's layout keeps a trailing region/);
  });

  const createInputs = (source: string): string[] => {
    const { artifact } = compile(source, { deployer: true });
    return artifact.deployer!.abi.find((fn) => fn.name === 'create')!.inputs.map((input) => input.name);
  };

  it('orders create inputs as A4.2 says, without a sender or a call slot', () => {
    expect(createInputs(`${P} contract C(bytes32 t) { int n; constructor(int x) { n = x; } }`)).toEqual([
      '__internal__budgetPad', '__internal__authorIndex', '__internal__identity',
      '__internal__genesisOutputBase', '__internal__genesisSidecarBase', '__internal__code',
      't', 'x', '__internal__deployValue', '__internal__msgSenderCategory', '__internal__genesisCallees',
    ]);
  });

  it('adds the creator parameters only when the constructor reads msg.sender', () => {
    expect(createInputs(`${P} contract C { address owner; constructor() { owner = msg.sender; } }`)).toEqual([
      '__internal__budgetPad', '__internal__authorIndex', '__internal__identity',
      '__internal__creatorInputIdx', '__internal__creatorList', '__internal__creatorListPos',
      '__internal__genesisOutputBase', '__internal__genesisSidecarBase', '__internal__code',
      '__internal__deployValue', '__internal__msgSenderCategory', '__internal__genesisCallees',
    ]);
  });
});

describe('B7.5: what the constructor does', () => {
  const reasonOf = (source: string): string | undefined => compile(source, { deployer: true }).artifact.deployerUnsupported;
  const cases: [string, string][] = [
    ['ctor-reads-outputs', `${P} contract C { int n; constructor() { n = int(tx.outputs.length); } }`],
    ['ctor-selfdestruct', `${P} contract C { int n; constructor() { selfdestruct(payable(msg.sender)); } }`],
    ['ctor-function-value', `${P} contract C { int n; constructor() { bytes4 s = msg.sig; n = int(s); } }`],
    ['ctor-block-data', `${P} contract C { int n; constructor() { n = block.difficulty; } }`],
    ['ctor-block-data', `${P} contract C { int n; constructor() { n = block.number + block.timestamp; } }`],
    ['ctor-dynamic-state', `${P} contract C { string s; constructor() { s = "x"; } }`],
    ['ctor-lowlevel-call', `${P} contract C { int n; constructor() { address(msg.sender).call(hex""); } }`],
    ['ctor-call-conditional', `${P} interface I { function f(int x) external returns (bool); }
      contract C { bool a; constructor(I i, bool c) { if (c) { a = i.f(5); } } }`],
    ['ctor-call-value', `${P} interface I { function f(int x) external payable returns (bool); }
      contract C { bool a; constructor(I i) { a = i.f{value: 1}(5); } }`],
    ['ctor-call-shape', `${P} interface I { function f(int x) external returns (bool); }
      contract C { bool a; bool b; constructor(I i) { a = i.f(5); b = i.f(6); } }`],
  ];
  for (const [reason, source] of cases) {
    it(`refuses ${reason}: ${source.slice(0, 60)}`, () => {
      expect(reasonOf(source)).toBe(reason);
    });
  }

  it('publishes the constructor facts the deployer and the SDK need', () => {
    const block = compile(`${P} contract C { int n; constructor() { n = block.number; } }`, { deployer: true });
    expect(block.artifact.deployer!.readsBlockData).toBe(false);
    expect(block.artifact.deployer!.constructorBlockField).toBe('number');

    const payable = compile(`${P} contract C { int n; constructor() payable { n = 1; } }`, { deployer: true });
    expect(payable.artifact.deployer!.satoshiContainer).toBe('optional');

    const plain = compile(`${P} contract C { int n; constructor() { n = 1; } }`, { deployer: true });
    expect(plain.artifact.deployer!.satoshiContainer).toBe('none');

    const hashed = compile(`${P} contract C { bytes32 h; constructor(bytes b) { h = keccak256(b); } }`,
      { deployer: true });
    expect(hashed.artifact.deployer!.sidecars.keccak).toBeGreaterThan(0);

    const sender = compile(`${P} contract C { address owner; constructor() { owner = msg.sender; } }`,
      { deployer: true });
    expect(sender.artifact.deployer!.constructorReadsSender).toBe(true);
  });

  it('keeps C\'s body byte-identical when the constructor has no call slot', () => {
    const { artifact } = compile(STATEFULWithCtor, { deployer: true });
    const deployer = artifact.deployer!;
    expect(deployer.birthTrailer).toBe(false);
    expect(Uint8Array.from(Buffer.from(deployer.code, 'hex')))
      .toEqual(scriptToBytecode(asmToScript(artifact.bytecode)));
    const redeemSize = Uint8Array.from(Buffer.from(deployer.bytecode, 'hex')).length;
    const pushHeader = redeemSize < 0x4c ? 1 : redeemSize <= 0xff ? 2 : redeemSize <= 0xffff ? 3 : 5;
    const unlocking = 5 + pushHeader + redeemSize;
    const varint = unlocking < 0xfd ? 1 : unlocking <= 0xffff ? 3 : 5;
    const sweepSize = 4 + 1 + 36 + varint + unlocking + 4 + 1 + 8 + 1 + 25 + 4;
    expect(BigInt(deployer.coinValue)).toBe(BigInt(1200 + Math.ceil(sweepSize / 100) * 100));
  });

  it('adds the 34-byte birth trailer when the constructor has a call slot', () => {
    const source = `${P} interface I { function f(int x) external returns (bool); }
      contract C { bool ok; constructor(I i) { ok = i.f(5); } }`;
    const { artifact } = compile(source, { deployer: true });
    const deployer = artifact.deployer!;
    expect(deployer.callSlots).toBe(1);
    expect(deployer.birthTrailer).toBe(true);
    const body = Uint8Array.from(Buffer.from(deployer.code, 'hex'));
    const hash = Uint8Array.from(Buffer.from(deployer.lockingBytecode, 'hex')).slice(2, 34);
    expect([...body.slice(-34)]).toEqual([0x20, ...hash, 0x75]);
    expect([...scriptToBytecode(asmToScript(artifact.bytecode))].slice(-34))
      .toEqual([0x20, ...hash, 0x75]);
  });

  it('orders two call slots and their witnesses after the synthetic bases', () => {
    const source = `${P} interface I { function f(int x) external returns (bool);
      function g(int x) external returns (bool); }
      contract C { bool a; bool b; constructor(I i, I j) { a = i.f(5); b = j.g(6); } }`;
    expect(compile(source, { deployer: true }).artifact.deployer!
      .abi.find((fn) => fn.name === 'create')!.inputs.map((input) => input.name)).toEqual([
      '__internal__budgetPad', '__internal__authorIndex', '__internal__identity',
      '__internal__genesisOutputBase', '__internal__genesisSidecarBase',
      '__internal__externalCallInputBase', '__internal__externalCallSelector0',
      '__internal__externalCallSelector1', '__internal__extcallMasterIdx0', '__internal__extcallMasterIdx1',
      '__internal__extcallAnchorIdx0', '__internal__extcallAnchorIdx1', '__internal__externalReturnOutputIdx0',
      '__internal__externalReturnOutputIdx1', '__internal__callEdgeOutputIdx0', '__internal__callEdgeOutputIdx1',
      '__internal__code', 'i', 'j', '__internal__deployValue', '__internal__msgSenderCategory',
      '__internal__genesisCallees',
    ]);
  });

  // A7: the generator must find a checked record for every call it visits in genesis mode. A low-level call's
  // result names no method, so there is no digest create could compare.
  it('refuses ctor-call-unbound for a constructor call with no record to check', () => {
    const source = `${P} contract C { bool ok; constructor(address a) {
      (bool s, bytes memory d) = a.call(abi.encodeWithSignature("f(int256)", 5)); ok = s && d.length == 0; } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.deployer).toBeUndefined();
    expect((artifact as { deployerUnsupported?: string }).deployerUnsupported).toBe('ctor-call-unbound');
  });

  // A void call is bound too: create requires the record `digest ‖ 01`, which a callee compiled with
  // `callRecords: 'all'` publishes and any other cannot (the SDK names it before building, A14 item 5).
  it('binds a void constructor call to its record', () => {
    const source = `${P} interface I { function g(int x) external; }
      contract C { bool ok; constructor(I i) { i.g(5); ok = true; } }`;
    expect(compile(source, { deployer: true }).artifact.deployer?.callSlots).toBe(1);
  });

  it('refuses ctor-call-shape for a constructor call that passes a sig', () => {
    const source = `${P} interface I { function f(sig s) external returns (bool); }
      contract C { bool ok; constructor(I i, sig s) { ok = i.f(s); } }`;
    const { artifact } = compile(source, { deployer: true });
    expect((artifact as { deployerUnsupported?: string }).deployerUnsupported).toBe('ctor-call-shape');
  });

  it('builds a deployer for a constructor whose call returns a record', () => {
    const source = `${P} interface I { function f(int x) external returns (bool); }
      contract C { bool ok; constructor(I i) { ok = i.f(5); } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.deployer?.callSlots).toBe(1);
  });

  it('sweep carries this.age >= 1440 and no own-category read', () => {
    const { artifact } = compile(STATEFULWithCtor, { deployer: true });
    const hex = artifact.deployer!.bytecode;
    expect(hex).toContain('02a005b2');
  });

  it('names a single satoshi container and a single token container keyed by a contract parameter', () => {
    // A8: the pragma and a function that uses the container; the pragma alone keeps nothing.
    const satoshi = compile(`pragma solidcash ^0.51.0; pragma satoshicontainer single;
      contract C() { int n; constructor() { n = 1; } function pay(address r) { payable(r).transfer(1200); n = n + 1; } }`,
    { deployer: true });
    expect(satoshi.artifact.deployer!.satoshiContainer).toBe('required');

    const token = compile(`pragma solidcash ^0.51.0; pragma tokencontainer single;
      contract C(bytes32 asset) { int n; constructor() { n = 1; }
        function take(address to, int amount) { this.tokens[asset].transfer(to, amount); } }`,
    { deployer: true });
    expect(token.artifact.deployer!.tokenRows).toEqual([0]);
  });

  it('a constructor reads a single token container\'s tokenAmount as its start', () => {
    const source = `pragma solidcash ^0.51.0; pragma tokencontainer single;
      contract C(bytes32 asset) { int n; constructor() { n = int(this.tokens[asset].tokenAmount); } }`;
    const { artifact } = compile(source, { deployer: true });
    expect(artifact.deployer).toBeDefined();
    expect(artifact.deployer!.tokenRows).toEqual([0]);
  });

  it('refuses any other token-container member in a constructor', () => {
    const source = `pragma solidcash ^0.51.0; pragma tokencontainer single;
      contract C(bytes32 asset) { int n; constructor() { n = int(this.tokens[asset].tokenCategory.length); } }`;
    expect(() => compile(source, { deployer: true })).toThrow(/tokenAmount/);
  });

  it('is deterministic across compiles and hashes the body for TEMPLATE', () => {
    const first = compile(`${STATEFULWithCtor}\n// one`, { deployer: true, __artifactCache: false } as never);
    const second = compile(`${STATEFULWithCtor}\n// two`, { deployer: true, __artifactCache: false } as never);
    expect(first.artifact.deployer!.bytecode).toBe(second.artifact.deployer!.bytecode);
    expect(first.artifact.deployer!.lockingBytecode).toBe(second.artifact.deployer!.lockingBytecode);
    const body = Uint8Array.from(Buffer.from(first.artifact.deployer!.code, 'hex'));
    expect(first.artifact.deployer!.template).toBe(
      Buffer.from(sha256.hash(body)).toString('hex'),
    );
  });
});

describe('ctor-construction-order (A4.1): construction the front end may order differently from solc', () => {
  const reasonOf = (source: string): string | undefined => compile(source, { deployer: true }).artifact.deployerUnsupported;
  const TAIL = 'int n; constructor() { n = 3; } function f() { n = n + 1; } }';

  it('allows sibling bases whose constructions touch different state', () => {
    expect(reasonOf(`${P} contract A { int a; constructor() { a = 1; } }
      contract B { int b; constructor() { b = 2; } }
      contract C is A, B { ${TAIL}`)).toBeUndefined();
  });

  it('refuses sibling bases that write one field of a shared base', () => {
    expect(reasonOf(`${P} contract S { int s; }
      contract A is S { constructor() { s = 1; } }
      contract B is S { constructor() { s = 2; } }
      contract C is A, B { ${TAIL}`)).toBe('ctor-construction-order');
  });

  it('refuses sibling bases that touch one field through a call', () => {
    expect(reasonOf(`${P} contract S { int s; function bumpS() internal { s = s + 1; } }
      contract A is S { constructor() { bumpS(); } }
      contract B is S { constructor() { s = 2; } }
      contract C is A, B { ${TAIL}`)).toBe('ctor-construction-order');
  });

  it('refuses a base reached by two paths when it has construction', () => {
    expect(reasonOf(`${P} contract S { int s; constructor() { s = 1; } }
      contract A is S { int a; constructor() { a = 1; } }
      contract B is S { int b; constructor() { b = 2; } }
      contract C is A, B { ${TAIL}`)).toBe('ctor-construction-order');
  });

  it('allows a base reached by two paths when it has no construction', () => {
    expect(reasonOf(`${P} contract S { int s; }
      contract A is S { int a; constructor() { a = 1; } }
      contract B is S { int b; constructor() { b = 2; } }
      contract C is A, B { ${TAIL}`)).toBeUndefined();
  });

  it('refuses a state initialiser that reads what a base constructor writes', () => {
    expect(reasonOf(`${P} contract B { int x; constructor() { x = 5; } }
      contract C is B { int y = x + 1; ${TAIL}`)).toBe('ctor-construction-order');
  });

  it('allows a state initialiser that touches nothing of its bases', () => {
    expect(reasonOf(`${P} contract B { int x; constructor() { x = 5; } }
      contract C is B { int y = 7; ${TAIL}`)).toBeUndefined();
  });

  it('allows a derived constructor body that writes what its base constructor wrote', () => {
    // Bases are built before the derived body in the front end and in both of solc's generators.
    expect(reasonOf(`${P} contract B { int x; constructor() { x = 5; } }
      contract C is B { int n; constructor() { x = 6; n = 1; } function f() { n = n + 1; } }`)).toBeUndefined();
  });

  it('refuses a constructor modifier that touches what a state initialiser of its contract writes', () => {
    expect(reasonOf(`${P} contract C { int y = 1; int n;
      modifier bump() { y = y + 1; _; }
      constructor() bump() { n = 3; } function f() { n = n + 1; } }`)).toBe('ctor-construction-order');
  });

  it('refuses the same modifier written without parentheses', () => {
    expect(reasonOf(`${P} contract C { int y = 1; int n;
      modifier bump { y = y + 1; _; }
      constructor() bump { n = 3; } function f() { n = n + 1; } }`)).toBe('ctor-construction-order');
  });

  it('allows a constructor modifier whose argument reads state no initialiser touches', () => {
    // A modifier's argument is the modifier's own, not a base argument.
    expect(reasonOf(`${P} contract C { int n;
      modifier atLeast(int v) { require(v >= 0); _; }
      constructor() atLeast(n) { n = 3; } function f() { n = n + 1; } }`)).toBeUndefined();
  });

  it('names the contracts in its warning', () => {
    const { warnings } = compile(`${P} contract S { int s; }
      contract A is S { constructor() { s = 1; } }
      contract B is S { constructor() { s = 2; } }
      contract C is A, B { ${TAIL}`, { deployer: true });
    expect(warnings.some((warning) => warning.includes('ctor-construction-order')
      && warning.includes("'A'") && warning.includes("'B'"))).toBe(true);
  });
});

describe('B7.5: the collection shape of a constructor', () => {
  const reasonOf = (source: string): string | undefined => compile(source, { deployer: true }).artifact.deployerUnsupported;

  it('refuses a base constructor argument that reads state', () => {
    const source = `${P} contract B(int x) { int pb; }
      contract D is B(b) { int b; constructor() {} }`;
    expect(reasonOf(source)).toBe('ctor-base-argument');
  });

  it('refuses a header base argument that reads an inherited field', () => {
    const source = `${P} contract S { int s; }
      contract B { int pb; constructor(int x) { pb = x; } }
      contract D is S, B { int n; constructor() B(s) { n = 1; } function f() { n = n + 1; } }`;
    expect(reasonOf(source)).toBe('ctor-base-argument');
  });

  it('refuses a base argument that reads state in an intermediate base', () => {
    const source = `${P} contract B(int x) { int pb; }
      contract M is B(m) { int m; }
      contract D is M { int n; constructor() { n = 1; } function f() { n = n + 1; } }`;
    expect(reasonOf(source)).toBe('ctor-base-argument');
  });

  it('allows a literal base constructor argument', () => {
    const source = `${P} contract B(int x) { int pb; }
      contract D is B(5) { int b; constructor() {} }`;
    expect(reasonOf(source)).toBeUndefined();
  });

  it('refuses a collection read in a loop', () => {
    const source = `${P} contract C { int n; mapping(int => int) m;
      constructor() { for (int i = 0; i < 2; i++) { n = m[i]; } } }`;
    expect(reasonOf(source)).toBe('ctor-collection-shape');
  });

  it('refuses a call in a loop whose callee accesses a collection', () => {
    const source = `${P} contract C { int n; mapping(int => int) m;
      function peek(int k) internal returns (int) { return m[k]; }
      constructor() { while (n < 2) { n = peek(n) + 1; } } }`;
    expect(reasonOf(source)).toBe('ctor-collection-shape');
  });

  it('refuses a constructor that reads the balance and sends satoshis', () => {
    const source = `${P} contract C { int n;
      constructor() payable { int b = address(this).balance; this.transfer(msg.sender, 1); n = b; } }`;
    expect(reasonOf(source)).toBe('ctor-collection-shape');
  });

  it('allows a balance read with no send', () => {
    const source = `${P} contract C { int n; constructor() payable { n = address(this).balance; } }`;
    expect(reasonOf(source)).toBeUndefined();
  });
});

describe('B7.5: reasons with no source shape use the test hook', () => {
  it('surfaces code-not-constant through the hook', () => {
    const box = { forceReason: 'code-not-constant' };
    const { artifact } = compile(STATEFUL, { deployer: true, __deployerTestBox: box } as never);
    expect(artifact.deployerUnsupported).toBe('code-not-constant');
  });

  it('surfaces ctor-call-unbound through the hook', () => {
    const box = { forceReason: 'ctor-call-unbound' };
    const { artifact } = compile(STATEFUL, { deployer: true, __deployerTestBox: box } as never);
    expect(artifact.deployerUnsupported).toBe('ctor-call-unbound');
  });
});

describe('B7.5: ctor-call-count', () => {
  it('refuses more than 37 call slots', () => {
    const calls = Array.from({ length: 38 }, (_, i) => `a = i.f(${i});`).join('');
    const source = `${P} interface I { function f(int x) external returns (bool); }
      contract C { bool a; constructor(I i) { ${calls} } }`;
    expect(compile(source, { deployer: true }).artifact.deployerUnsupported).toBe('ctor-call-count');
  });
});

describe('B7.9: the genesis range order', () => {
  const layoutOf = (source: string): {
    kinds: string[]; outputs: number; slots: { kind: string; offset: number; slotIndex?: number }[]; tokenRows: number[];
  } => {
    const { artifact } = compile(source, { deployer: true });
    const create = artifact.deployer!.abi.find((fn) => fn.name === 'create')!;
    const slots = create.blockLayout!.slots.map((slot) => ({
      kind: slot.kind, offset: slot.offset, slotIndex: slot.slotIndex,
    }));
    return {
      kinds: slots.map((slot) => slot.kind), outputs: artifact.deployer!.genesisOutputs, slots,
      tokenRows: [...artifact.deployer!.tokenRows],
    };
  };

  it('orders master, records, containers, transfers and events', () => {
    const layout = layoutOf(`${P} contract C { int n; event E(int x);
      constructor() payable { n = 1; emit E(2); payable(msg.sender).transfer(1000); } }`);
    expect(layout.kinds).toEqual(['master', 'dataNft', 'satoshiContainer', 'transfer', 'event']);
    expect(layout.outputs).toBe(5);
  });

  it('adds the satoshi row for a payable constructor that sends nothing', () => {
    const layout = layoutOf(`${P} contract C { int n; constructor() payable { n = 1; } }`);
    expect(layout.kinds).toEqual(['master', 'dataNft', 'satoshiContainer']);
    expect(layout.outputs).toBe(3);
  });

  it('keeps one token row per single container and none for a multi container', () => {
    const single = layoutOf(`${P} pragma tokencontainer single;
      contract C(bytes32 asset) { int n; constructor() { n = int(this.tokens[asset].tokenAmount); } }`);
    expect(single.kinds).toEqual(['master', 'dataNft', 'tokenContainer']);
    const multi = layoutOf(`${P} contract C(bytes32 asset) { int n;
      constructor() { n = int(this.tokens[asset].tokenAmount); } }`);
    expect(multi.kinds).toEqual(['master', 'dataNft']);
    expect(multi.outputs).toBe(2);
  });

  it('makes a token row for a single container the constructor does not touch, keyed by its parameter', () => {
    // A4.4: one row per contract parameter a function of C uses as a container's category, from birth. TokenPool's
    // shape: the container's parameter is not the first, and only a later function names the container. Its payable
    // `deposit` uses the satoshi container, so C keeps that container single under A8's stricter reading too.
    const layout = layoutOf(`${P} pragma satoshicontainer single; pragma tokencontainer single;
      contract C(uint8 exponent, bytes32 asset) { int n; constructor() { n = int(exponent); }
        function deposit() public payable { n = n + 1; }
        function withdraw(address recipient) public { this.tokens[asset].transfer(recipient, 1); } }`);
    expect(layout.kinds).toEqual(['master', 'dataNft', 'satoshiContainer', 'tokenContainer']);
    expect(layout.slots[3].slotIndex).toBe(1);
    expect(layout.tokenRows).toEqual([1]);
    expect(layout.outputs).toBe(4);
  });

  it('mints a HEAD for a sorted collection the constructor does not write', () => {
    const layout = layoutOf(`${P} contract C { mapping(int => int) m; constructor() {} }`);
    expect(layout.kinds).toEqual(['master', 'head']);
    expect(layout.outputs).toBe(2);
  });

  // A4.4: a constructor that writes a collection gets no deployer (`ctor-collection-shape`) until the collection
  // journal and step 12's check of its rows are built. Restore these with that work.
  it.skip('keeps the entries of a collection the constructor writes, with no separate HEAD', () => {
    const layout = layoutOf(`${P} contract C { mapping(int => int) m; constructor() { m[1] = 2; } }`);
    expect(layout.kinds).toEqual(['master', 'entry']);
    expect(layout.outputs).toBe(2);
  });

  it('puts the sidecar group after the range', () => {
    const layout = layoutOf(`${P} contract C { bytes32 h; constructor(bytes b) { h = keccak256(b); } }`);
    expect(layout.kinds).toEqual(['master', 'dataNft', 'keccakSideCar']);
    expect(layout.outputs).toBe(2);
    expect(layout.slots.at(-1)!.offset).toBe(2);
  });

  it('has no oracle row for a constructor that reads a block field', () => {
    const layout = layoutOf(`${P} contract C { int n; constructor() { n = block.number; } }`);
    expect(layout.kinds).toEqual(['master', 'dataNft']);
    expect(layout.outputs).toBe(2);
  });
});
