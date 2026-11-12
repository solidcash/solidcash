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

const P = 'pragma solidcash ^0.50.0;';
const STATEFUL = `${P} contract C { int n; function bump() { n = n + 1; } }`;
const STATEFULWithCtor = `${P} contract C { int n; constructor() { n = 1; } function bump() { n = n + 1; } }`;

const compile = (source: string, options: Record<string, unknown>): {
  artifact: ReturnType<typeof compileString>;
  warnings: string[];
} => {
  const warnings: string[] = [];
  const artifact = compileString(source, { messageBus: false, warningListener: (warning) => warnings.push(warning.message), ...options });
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

  it('a message-bus compile records lock-composition', () => {
    const source = `${P} contract C { int n; function a() { n = n + 1; } function b() { n = n + 2; } }`;
    const { artifact, warnings } = compile(source, { deployer: true, messageBus: true });
    expect(artifact.deployerUnsupported).toBe('lock-composition');
    expect(warnings.some((warning) => warning.includes('lock-composition'))).toBe(true);
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
    expect(block.artifact.deployer!.readsBlockData).toBe(true);
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

  it('sweep carries this.age >= 1440 and no own-category read', () => {
    const { artifact } = compile(STATEFULWithCtor, { deployer: true });
    const hex = artifact.deployer!.bytecode;
    expect(hex).toContain('02a005b2');
  });

  it('names a single satoshi container and a single token container keyed by a contract parameter', () => {
    const satoshi = compile(`pragma solidcash ^0.50.0; pragma satoshicontainer single;
      contract C() { int n; constructor() { n = 1; } function bump() { n = n + 1; } }`,
      { deployer: true });
    expect(satoshi.artifact.deployer!.satoshiContainer).toBe('required');

    const token = compile(`pragma solidcash ^0.50.0; pragma tokencontainer single;
      contract C(bytes32 asset) { int n; constructor() { n = 1; }
        function take(address to, int amount) { this.tokens[asset].transfer(to, amount); } }`,
      { deployer: true });
    expect(token.artifact.deployer!.tokenRows).toEqual([0]);
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
