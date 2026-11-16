/**
 * A4.3 steps 1 and 6 to 8 and A4.5's run-time counts, on the BCH 2026 VM.
 *
 * Each case builds a whole creation transaction around the deployer coin at input 3, with OUTBASE 5, and runs
 * `vm.verify`: the honest transaction passes, and each one a hostile builder could send instead is refused.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, encodeDataPush, encodeLockingBytecodeP2sh32,
  hash256, hexToBin,
} from '@bitauth/libauth';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  AUTHHEAD_BODY, buildDataNftCovenantScript, buildPushdataCommitment, buildSatoshiContainerCovenantScript,
  containerKeepsTokenless, containerMasterRetires, Op, scriptToBytecode, type Artifact, type DeployerAbi,
} from '@solidcash/utils';
import { compileString } from '../src/index.js';

type Output = { lockingBytecode: Uint8Array; valueSatoshis: bigint; token?: any };
type Input = { outpointIndex: number; outpointTransactionHash: Uint8Array; sequenceNumber: number; unlockingBytecode: Uint8Array };

const P = 'pragma solidcash ^0.51.0;';
const EMPTY = new Uint8Array(0);
const OP_TRUE = Uint8Array.of(0x51);
const OUTBASE = 5;
const DEPLOYER_INPUT = 3;
const vm = createVirtualMachineBch2026();

const dummyHash = (seed: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (0x40 + seed * 7 + i * 19) & 0xff);
const num = (value: bigint | number): Uint8Array => bigIntToVmNumber(BigInt(value));
const pushes = (values: readonly Uint8Array[]): Uint8Array => new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));

function compile(source: string): Artifact {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return compileString(`${P} ${source}`, { deployer: true, messageBus: false } as never) as Artifact;
  } finally {
    console.warn = warn;
  }
}

interface Context { deployer: DeployerAbi; xDisplay: Uint8Array; xVm: Uint8Array; masterLock: Uint8Array; dataLock: Uint8Array }

function context(artifact: Artifact): Context {
  const deployer = artifact.deployer!;
  const xDisplay = dummyHash(3);
  const xVm = Uint8Array.from(xDisplay).reverse();
  const redeem = new Uint8Array([...encodeDataPush(Uint8Array.from([...xVm, 0x02])), 0xc0, 0xce, 0x88, ...hexToBin(deployer.code)]);
  const masterLock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const dataLock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildDataNftCovenantScript(xDisplay, masterLock))));
  return { deployer, xDisplay, xVm, masterLock, dataLock };
}

const master = (ctx: Context): Output => ({
  lockingBytecode: ctx.masterLock, valueSatoshis: 1200n,
  token: { category: ctx.xDisplay, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } },
});

const record = (artifact: Artifact, ctx: Context, values: Record<string, unknown>): Output => ({
  lockingBytecode: ctx.dataLock, valueSatoshis: 1200n,
  token: {
    category: ctx.xDisplay, amount: 0n,
    nft: { capability: 'mutable', commitment: hexToBin(buildPushdataCommitment(artifact.stateLayout!, values as never, 0)) },
  },
});

const filler = (n: number): Output[] => Array.from({ length: n }, () => ({ lockingBytecode: OP_TRUE, valueSatoshis: 1000n }));

/** C's satoshi container lock for (M, X), with C's own container options (A4.4). */
const satoshiRow = (artifact: Artifact, ctx: Context, valueSatoshis: bigint): Output => ({
  lockingBytecode: encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(
    ctx.xDisplay, ctx.masterLock,
    { masterRetires: containerMasterRetires(artifact.abi ?? []), keepsTokenless: containerKeepsTokenless(artifact.abi ?? [], 'satoshiContainer') },
  )))),
  valueSatoshis,
});

function verify(
  ctx: Context, outputs: Output[], values: Record<string, Uint8Array> = {}, extra: { input: Input; source: Output }[] = [],
  options: { deployerInputOnly?: boolean; surplusPush?: boolean } = {},
) {
  const create = ctx.deployer.abi.find((entry) => entry.name === 'create')!;
  const all: Record<string, Uint8Array> = {
    __internal__budgetPad: EMPTY,
    __internal__authorIndex: num(1),
    __internal__identity: EMPTY,
    __internal__genesisOutputBase: num(OUTBASE),
    __internal__genesisSidecarBase: num(OUTBASE + 50),
    __internal__code: hexToBin(ctx.deployer.code),
    __internal__deployValue: EMPTY,
    __internal__msgSenderCategory: new Uint8Array(32),
    __internal__genesisCallees: EMPTY,
    ...values,
  };
  const args = create.inputs.map((input) => all[input.name] ?? EMPTY).reverse();
  // A surplus push sits right before the redeem script, above every input create takes.
  const surplus = options.surplusPush === true ? [EMPTY] : [];
  const unlocking = new Uint8Array([
    ...pushes([hexToBin(create.selector!), ...args, ...surplus]), ...encodeDataPush(hexToBin(ctx.deployer.bytecode)),
  ]);
  const leading = Array.from({ length: DEPLOYER_INPUT }, (_, i): Input => (i === 1
    ? { outpointIndex: 1, outpointTransactionHash: ctx.xDisplay, sequenceNumber: 0xffffffff, unlockingBytecode: EMPTY }
    : { outpointIndex: 0, outpointTransactionHash: dummyHash(10 + i), sequenceNumber: 0xffffffff, unlockingBytecode: EMPTY }));
  const inputs: Input[] = [...leading, {
    outpointIndex: 0, outpointTransactionHash: ctx.xDisplay, sequenceNumber: 0xffffffff, unlockingBytecode: unlocking,
  }, ...extra.map((entry) => entry.input)];
  const sourceOutputs: Output[] = [
    ...leading.map(() => ({ lockingBytecode: OP_TRUE, valueSatoshis: 100_000n })),
    { lockingBytecode: hexToBin(ctx.deployer.lockingBytecode), valueSatoshis: BigInt(ctx.deployer.coinValue) },
    ...extra.map((entry) => entry.source),
  ];
  const program = { sourceOutputs, transaction: { version: 2, locktime: 0, inputs, outputs } };
  if (options.deployerInputOnly === true) {
    // Only `create` runs: the other inputs here are unsigned stand-ins.
    const state = vm.evaluate({ ...program, inputIndex: DEPLOYER_INPUT } as never);
    return vm.stateSuccess(state as never) === true ? true : String((state as { error?: string }).error);
  }
  return vm.verify(program as never);
}

describe('A4.3 step 1: create starts from an exact stack (O8)', () => {
  const artifact = compile('contract C { int n; constructor() { n = 1; } }');
  const ctx = context(artifact);
  const outputs = (): Output[] => [...filler(OUTBASE), master(ctx), record(artifact, ctx, { n: 1n })];

  it('opens create with OP_DEPTH n OP_NUMEQUALVERIFY, n the inputs it takes', () => {
    const create = ctx.deployer.abi.find((entry) => entry.name === 'create')!;
    const instructions = decodeAuthenticationInstructions(hexToBin(ctx.deployer.bytecode)) as {
      opcode: number; data?: Uint8Array;
    }[];
    const at = instructions.findIndex((instruction, index) => instruction.opcode === Op.OP_DEFINE
      && binToHex(instructions[index - 1]?.data ?? EMPTY) === create.selector);
    expect(at).toBeGreaterThan(1);
    const n = create.inputs.length;
    // OP_DEPTH <n> OP_NUMEQUALVERIFY, n pushed as OP_1 to OP_16 or as its number.
    const pushN = n >= 1 && n <= 16 ? [Op.OP_1 + n - 1] : [...encodeDataPush(num(n))];
    const head = [Op.OP_DEPTH, ...pushN, Op.OP_NUMEQUALVERIFY];
    expect([...instructions[at - 2]!.data!.slice(0, head.length)]).toEqual(head);
  });

  it('takes the honest unlocking and refuses one surplus push', () => {
    expect(verify(ctx, outputs())).toBe(true);
    expect(verify(ctx, outputs(), {}, [], { surplusPush: true })).not.toBe(true);
  });
});

describe('A4.3 step 6: the deploy value', () => {
  const payable = compile('pragma satoshicontainer single; contract C { int n; constructor() payable { n = msg.value; } }');
  const ctx = context(payable);
  const outputs = (value: bigint): Output[] => [
    ...filler(OUTBASE), master(ctx), record(payable, ctx, { n: value }), satoshiRow(payable, ctx, 1200n + value),
  ];
  it('takes 0 and RESERVE or more when C has a satoshi row', () => {
    expect(verify(ctx, outputs(0n))).toBe(true);
    expect(verify(ctx, outputs(1200n), { __internal__deployValue: num(1200) })).toBe(true);
  });
  it('refuses a value from 1 to RESERVE - 1, and a negative one', () => {
    expect(verify(ctx, outputs(1000n), { __internal__deployValue: num(1000) })).not.toBe(true);
    expect(verify(ctx, outputs(-7n), { __internal__deployValue: num(-7) })).not.toBe(true);
  });
  it('refuses any value for a C with no satoshi row', () => {
    const plain = compile('contract C { int n; constructor() { n = 1; } }');
    const plainCtx = context(plain);
    const plainOutputs = [...filler(OUTBASE), master(plainCtx), record(plain, plainCtx, { n: 1n })];
    expect(verify(plainCtx, plainOutputs)).toBe(true);
    expect(verify(plainCtx, plainOutputs, { __internal__deployValue: num(5000) })).not.toBe(true);
  });
});

describe('A4.3 step 7 and A4.5: the identity flag', () => {
  const artifact = compile('contract C { int n; constructor() { n = 1; } }');
  const ctx = context(artifact);
  const authhead = (): Output => {
    const redeem = new Uint8Array([...encodeDataPush(Uint8Array.from([...ctx.xVm, 0x01])), ...AUTHHEAD_BODY]);
    return {
      lockingBytecode: encodeLockingBytecodeP2sh32(hash256(redeem)), valueSatoshis: 1000n,
      token: { category: ctx.xDisplay, amount: 0n, nft: { capability: 'mutable', commitment: Uint8Array.of(1) } },
    };
  };
  const base = (): Output[] => [...filler(OUTBASE), master(ctx), record(artifact, ctx, { n: 1n })];
  it('takes 1 with the authhead at output 0 and a zero sender category', () => {
    const outputs = base();
    outputs[0] = authhead();
    expect(verify(ctx, outputs, { __internal__identity: num(1) })).toBe(true);
  });
  it('refuses 2, which would let the census count one more mutable NFT of X', () => {
    const outputs = base();
    outputs[0] = authhead();
    outputs.push({ lockingBytecode: OP_TRUE, valueSatoshis: 800n, token: { category: ctx.xDisplay, amount: 0n, nft: { capability: 'mutable', commitment: Uint8Array.of(9) } } });
    expect(verify(ctx, outputs, { __internal__identity: num(2) })).not.toBe(true);
  });
  it('refuses 1 with a non-zero sender category', () => {
    const outputs = base();
    outputs[0] = authhead();
    expect(verify(ctx, outputs, { __internal__identity: num(1), __internal__msgSenderCategory: dummyHash(20) })).not.toBe(true);
  });
});

describe('A4.5: V counts the events the constructor filled', () => {
  const artifact = compile('contract C { int n; event E(int v); constructor(bool b) { n = 1; if (b) { emit E(5); } } }');
  const ctx = context(artifact);
  const skipped = (): Output[] => [...filler(OUTBASE), master(ctx), record(artifact, ctx, { n: 1n }), { lockingBytecode: OP_TRUE, valueSatoshis: 1000n }];
  it('passes an honest creation whose emit did not run', () => {
    expect(verify(ctx, skipped(), { b: EMPTY })).toBe(true);
  });
  it('refuses the same creation with a forged immutable NFT of X in its place', () => {
    const outputs = skipped();
    outputs.push({ lockingBytecode: OP_TRUE, valueSatoshis: 800n, token: { category: ctx.xDisplay, amount: 0n, nft: { capability: 'none', commitment: Uint8Array.of(7) } } });
    expect(verify(ctx, outputs, { b: EMPTY })).not.toBe(true);
  });
});

describe('A4.3 step 8: a sender category is proved by the creator', () => {
  const artifact = compile('contract C { address owner; constructor() { owner = msg.sender; } }');
  const ctx = context(artifact);
  const walletLock = OP_TRUE;
  it('reads tx.origin when the sender category is zero', () => {
    const p2pkh = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(7), 0x88, 0xac]);
    const ctxOutputs = [...filler(OUTBASE), master(ctx), record(artifact, ctx, { owner: p2pkh })];
    const extra = [{
      input: { outpointIndex: 0, outpointTransactionHash: dummyHash(30), sequenceNumber: 0xffffffff, unlockingBytecode: EMPTY },
      source: { lockingBytecode: p2pkh, valueSatoshis: 10_000n },
    }];
    expect(verify(ctx, ctxOutputs, {}, extra, { deployerInputOnly: true })).toBe(true);
    // Any other owner is refused: the record holds what the constructor computed.
    const forged = [...filler(OUTBASE), master(ctx), record(artifact, ctx, { owner: OP_TRUE })];
    expect(verify(ctx, forged, {}, extra, { deployerInputOnly: true })).not.toBe(true);
  });
  it('refuses a non-zero sender category without a creator input that proves it', () => {
    const outputs = [...filler(OUTBASE), master(ctx), record(artifact, ctx, { owner: walletLock })];
    const values = {
      __internal__msgSenderCategory: dummyHash(21),
      __internal__creatorInputIdx: num(0),
      __internal__creatorList: Uint8Array.from(ctx.xVm),
      __internal__creatorListPos: EMPTY,
    };
    expect(verify(ctx, outputs, values)).not.toBe(true);
  });
  it('refuses a creator input that holds the sender category but whose code has no creator marker', () => {
    const k = dummyHash(22);
    const fakeRedeem = Uint8Array.of(0x75, 0x51);
    const fakeLock = encodeLockingBytecodeP2sh32(hash256(fakeRedeem));
    const list = Uint8Array.from(ctx.xVm);
    const unlocking = new Uint8Array([...pushes([Uint8Array.of(1, 2, 3, 4), new Uint8Array(32)]), ...encodeDataPush(fakeRedeem)]);
    const extra = [{
      input: { outpointIndex: 1, outpointTransactionHash: dummyHash(31), sequenceNumber: 0xffffffff, unlockingBytecode: unlocking },
      source: { lockingBytecode: fakeLock, valueSatoshis: 1200n, token: { category: Uint8Array.from(k).reverse(), amount: 0n, nft: { capability: 'minting', commitment: EMPTY } } },
    }];
    const outputs = [...filler(OUTBASE), master(ctx), record(artifact, ctx, { owner: fakeLock }), {
      lockingBytecode: fakeLock, valueSatoshis: 1200n, token: { category: Uint8Array.from(k).reverse(), amount: 0n, nft: { capability: 'minting', commitment: EMPTY } },
    }];
    const values = {
      __internal__msgSenderCategory: k,
      __internal__creatorInputIdx: num(DEPLOYER_INPUT + 1),
      __internal__creatorList: list,
      __internal__creatorListPos: EMPTY,
    };
    expect(verify(ctx, outputs, values, extra)).not.toBe(true);
  });
});

describe('A4.1 ctor-collection-shape: a collection written at birth', () => {
  it('gets a deployer whose journal holds one row per append site (A4.4)', () => {
    for (const source of [
      'contract C { mapping(int => int) m; constructor() { m[1] = 2; } }',
      'contract C { mapping(bytes => int) bal; int total; constructor() { _mint(msg.sender, 1000); } function _mint(bytes a, int v) internal { bal[a] = bal[a] + v; total = total + v; } }',
    ]) {
      const warn = console.warn;
      console.warn = () => {};
      try {
        const artifact = compileString(`${P} ${source}`, { deployer: true, messageBus: false } as never) as Artifact;
        expect((artifact as { deployerUnsupported?: string }).deployerUnsupported).toBeUndefined();
        expect(artifact.deployer?.collectionRows.map((row) => [row.collection, row.appendSites]))
          .toEqual([[source.includes('bal') ? 'bal' : 'm', 1]]);
      } finally {
        console.warn = warn;
      }
    }
  });

  it('keeps a constructor that only reads an unwritten collection', () => {
    const artifact = compile('contract C { mapping(int => int) m; int n; constructor() { n = m[3]; } }');
    expect(artifact.deployer).toBeDefined();
  });
});

describe('A4.1: a constructor that both reads the satoshi balance and may send', () => {
  const unsupported = (source: string): string | undefined => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      return (compileString(`${P} ${source}`, { deployer: true, messageBus: false } as never) as { deployerUnsupported?: string }).deployerUnsupported;
    } finally {
      console.warn = warn;
    }
  };
  it('is refused however the read and the send are written', () => {
    for (const source of [
      'contract C { int n; constructor(address r) payable { n = this.balance; payable(r).transfer(1200); } }',
      'contract C { int n; constructor() payable { this.payMinerFee(500); n = address(this).balance; } }',
      'contract C { int n; constructor(address r) payable { n = bal(); payable(r).transfer(1200); } function bal() internal view returns (int) { return address(this).balance; } }',
      'contract C { int n; constructor(address r) payable { payable(r).transfer(1200); n = this.balance; } }',
    ]) {
      expect(unsupported(source), source).toBe('ctor-collection-shape');
    }
  });
  it('refuses genesis-site for a read in a helper that stays a subroutine of create', () => {
    expect(unsupported('contract C { int n; constructor() payable { n = bal(); } function bal() internal view returns (int) { return address(this).balance; } function g() { require(bal() >= 0); } }'))
      .toBe('genesis-site');
  });
  it('keeps a constructor that only reads, or only sends', () => {
    expect(unsupported('contract C { int n; constructor() payable { n = this.balance; } }')).toBeUndefined();
    expect(unsupported('contract C { int n; constructor(address r) payable { payable(r).transfer(1200); n = 1; } }')).toBeUndefined();
  });
});

describe('A5: address(this).balance at birth is the satoshi journal', () => {
  const artifact = compile('pragma satoshicontainer single; contract C { int n; constructor() payable { n = address(this).balance; } }');
  const ctx = context(artifact);
  const outputs = (stored: bigint, row: bigint): Output[] => [
    ...filler(OUTBASE), master(ctx), record(artifact, ctx, { n: stored }), satoshiRow(artifact, ctx, row),
  ];
  it('reads the container start plus the value', () => {
    expect(verify(ctx, outputs(3200n, 3200n), { __internal__deployValue: num(2000) })).toBe(true);
  });
  it('refuses a record that stores the inputs\' sum, 0, instead', () => {
    expect(verify(ctx, outputs(0n, 3200n), { __internal__deployValue: num(2000) })).not.toBe(true);
  });
});

describe('B7.4 (O1): the sweep arm is the template', () => {
  it('builds a deployer whose sweep arm matches it', () => {
    expect(compile('contract C { int n; constructor() { n = 1; } }').deployer).toBeDefined();
  });
  it('trips on a sweep arm with another age or without one of its checks', () => {
    for (const sweepBody of [
      '74009d02a105b275c4519d00d10087', // 1441 blocks
      '74009d02a005b275c4519d', // no token check on output 0
      '74009dc4519d00d10087', // no age
    ]) {
      expect(() => compileString(`${P} contract C { int n; constructor() { n = 1; } }`,
        { deployer: true, messageBus: false, __deployerTestBox: { sweepBody } } as never)).toThrow(/O1's template/);
    }
  });
});

describe('A8: what "C keeps its satoshi container single" means', () => {
  it('requires the pragma and a function that uses the container', () => {
    expect(compile('pragma satoshicontainer single; contract C { int n; constructor() { n = 1; } function f(address r) { payable(r).transfer(1200); } }')
      .deployer!.satoshiContainer).toBe('required');
  });
  it('keeps nothing for the pragma alone', () => {
    expect(compile('pragma satoshicontainer single; contract C { int n; constructor() { n = 1; } function f() { n = 2; } }')
      .deployer!.satoshiContainer).toBe('none');
  });
});
