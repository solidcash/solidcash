/**
 * B7.16: a genuine `create` on the BCH 2026 VM.
 *
 * The deployer coin sits at input 3 and the genesis range starts at output 5, so no index of the range can be
 * mistaken for the running input. The constructor writes one scalar, which is minted as the data record at
 * OUTBASE + 1. The author coin (X, 1) is input 1 (A4.3 step 4), and the container rows sit at C's container locks
 * for (M, X), built with the options the SDK reads from C's artifact (A4.4).
 */
import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin, sha256 } from '@bitauth/libauth';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import {
  AUTHHEAD_BODY, buildDataNftCovenantScript, buildEntryNftCovenantScript,
  buildPushdataCommitment, buildSatoshiContainerCovenantScript, buildTokenContainerCovenantScript,
  computeCollectionHash, containerKeepsTokenless, containerMasterRetires, encodePushdataValue, scriptToBytecode,
  type Artifact, type DeployerAbi,
} from '@solidcash/utils';
import { compileString } from '../src/index.js';
import { SignatureTemplate } from '../../solidcash/src/index.js';
import { alicePriv } from '../../solidcash/test/fixture/vars.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type VmInput = VmTransaction['inputs'][number];
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;
type Spend = {
  sourceOutputs: SourceOutputs;
  transaction: { version: number; locktime: number; inputs: VmInput[]; outputs: VmOutput[] };
};

const P = 'pragma solidcash ^0.53.0;';
const EMPTY = new Uint8Array(0);
const TOKENLESS = Uint8Array.from([0x51]);
const OUTBASE = 5;
const DEPLOYER_INPUT = 3;
const vm = createVirtualMachineBch2026();

const pushes = (values: readonly Uint8Array[]): Uint8Array =>
  new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));


function dummyInput(index: number): VmInput {
  return {
    outpointIndex: 0,
    outpointTransactionHash: Uint8Array.from({ length: 32 }, (_, i) => (0x40 + index + i * 19) & 0xff),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: EMPTY,
  };
}

/** The selector at the bottom, then the ABI arguments with the first on top, then the redeem. */
function createUnlock(
  deployer: DeployerAbi, values: Record<string, Uint8Array>,
): Uint8Array {
  const fn = deployer.abi.find((entry) => entry.name === 'create');
  if (!fn) throw new Error('no create arm');
  const args = fn.inputs.map((input) => values[input.name] ?? new Uint8Array()).reverse();
  if (fn.selector) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushes(args), ...encodeDataPush(hexToBin(deployer.bytecode))]);
}

function recordOutput(
  artifact: Artifact, values: Record<string, bigint>, category: Uint8Array, master?: Uint8Array,
): VmOutput {
  const masterLock = master ?? genesisMasters(artifact.deployer!).master;
  const dataRedeem = scriptToBytecode(buildDataNftCovenantScript(category, masterLock));
  return {
    lockingBytecode: encodeLockingBytecodeP2sh32(hash256(dataRedeem)),
    valueSatoshis: 1200n,
    token: {
      category,
      amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: hexToBin(buildPushdataCommitment(artifact.stateLayout!, values, 0)),
      },
    },
  };
}

function genesisMasters(
  deployer: DeployerAbi, contractArgs: { name: string; value: Uint8Array }[] = [],
): { x: Uint8Array; redeem: Uint8Array; master: Uint8Array } {
  const x = dummyInput(DEPLOYER_INPUT).outpointTransactionHash;
  const category = Uint8Array.from([...x.slice().reverse(), 0x02]);
  const argumentBytes = new Uint8Array(contractArgs.slice().reverse()
    .flatMap((argument) => [...encodeDataPush(argument.value)]));
  const redeem = new Uint8Array([
    ...encodeDataPush(category), 0xc0, 0xce, 0x88, ...argumentBytes, ...hexToBin(deployer.code),
  ]);
  return { x, redeem, master: encodeLockingBytecodeP2sh32(hash256(redeem)) };
}

/** C's satoshi container lock for (M, X), as the SDK derives it (`getSatoshiContainerAddress`). */
function satoshiRowLock(artifact: Artifact, master: Uint8Array): Uint8Array {
  const abi = artifact.abi ?? [];
  return encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(
    dummyInput(DEPLOYER_INPUT).outpointTransactionHash, master,
    { masterRetires: containerMasterRetires(abi), keepsTokenless: containerKeepsTokenless(abi, 'satoshiContainer') },
  ))));
}

/** C's token container lock for (M, X, t), t in display order as the container key holds it (`getTokenContainerAddress`). */
function tokenRowLock(artifact: Artifact, master: Uint8Array, token: Uint8Array): Uint8Array {
  const abi = artifact.abi ?? [];
  return encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildTokenContainerCovenantScript(
    dummyInput(DEPLOYER_INPUT).outpointTransactionHash, token, master,
    { masterRetires: containerMasterRetires(abi), keepsTokenless: containerKeepsTokenless(abi, 'tokenContainer') },
  ))));
}

/** The author coin (X, 1) of the deployer coin at input DEPLOYER_INPUT (A4.3 step 4). */
function authorInput(index: number): VmInput {
  return {
    ...dummyInput(index), outpointTransactionHash: dummyInput(DEPLOYER_INPUT).outpointTransactionHash, outpointIndex: 1,
  };
}

function createSpend(
  artifact: Artifact, deployer: DeployerAbi, record?: VmOutput,
  contractArgs: { name: string; value: Uint8Array }[] = [],
  adjustMaster: (output: VmOutput) => VmOutput = (output) => output,
  codeOverride?: Uint8Array,
  valueOverrides: Record<string, Uint8Array> = {},
  originLock?: Uint8Array,
  locktime = 0,
  deployerSequence = 0xffffffff,
  extraOutputs: VmOutput[] = [],
  extraInputs: VmInput[] = [],
  extraSourceOutputs: SourceOutputs = [],
): Spend {
  // The deployer program keeps a block reader's `__oraclePool` in create's argument band; the master lock pins it
  // even though genesis block reads come from the locktime.
  const createInputs = deployer.abi.find((entry) => entry.name === 'create')?.inputs ?? [];
  if (createInputs.some((input) => input.name === '__oraclePool')
    && !contractArgs.some((argument) => argument.name === '__oraclePool')) {
    contractArgs = [...contractArgs, { name: '__oraclePool', value: new Uint8Array(32).fill(0x11) }];
  }
  const sourceOutputs: SourceOutputs = [
    { lockingBytecode: originLock ?? TOKENLESS, valueSatoshis: 10_000n },
    { lockingBytecode: TOKENLESS, valueSatoshis: 10_000n },
    { lockingBytecode: TOKENLESS, valueSatoshis: 10_000n },
    { lockingBytecode: hexToBin(deployer.lockingBytecode), valueSatoshis: 1200n },
    ...(extraSourceOutputs.length > 0 ? extraSourceOutputs
      : extraInputs.map(() => ({ lockingBytecode: TOKENLESS, valueSatoshis: 10_000n }))),
  ];
  const outputs: VmOutput[] = Array.from({ length: OUTBASE }, () => ({
    lockingBytecode: TOKENLESS, valueSatoshis: 1000n,
  }));
  // OUTBASE is the master; the record follows it when C has one.
  const dataNftCount = artifact.stateLayout?.dataNftCount ?? 0;
  const { x, master } = genesisMasters(deployer, contractArgs);
  outputs.push(adjustMaster({
    lockingBytecode: master,
    valueSatoshis: 1200n,
    token: { category: x, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } },
  }));
  if (dataNftCount > 0) {
    outputs.push(record ?? recordOutput(artifact, { n: 1n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash, master));
  }
  // A4.4's satoshi and single-token rows are pinned by create; fill them unless the caller supplies its own
  // outputs (the send test's row and transfer).
  if (extraOutputs.length === 0) {
    const create = deployer.abi.find((entry) => entry.name === 'create');
    const layout = create?.blockLayout;
    if (layout !== undefined) {
      const rawValue = valueOverrides.__internal__deployValue;
      const deployValue = rawValue === undefined || rawValue.length === 0 ? 0n : vmNumberToBigInt(rawValue) as bigint;
      for (const slot of layout.slots) {
        if (slot.kind === 'satoshiContainer') {
          outputs.push({
            lockingBytecode: satoshiRowLock(artifact, master),
            valueSatoshis: (layout.singleSatoshiContainer === true ? 1200n : 0n) + deployValue,
          });
        } else if (slot.kind === 'tokenContainer' && slot.slotIndex !== undefined) {
          // A token row's slot index names its contract parameter, which holds the category in display order.
          const argument = contractArgs[slot.slotIndex];
          if (argument !== undefined) {
            outputs.push({
              lockingBytecode: tokenRowLock(artifact, master, argument.value),
              valueSatoshis: 1200n,
              token: {
                category: argument.value,
                amount: 1n,
              },
            });
          }
        }
      }
    }
  }
  outputs.push(...extraOutputs);
  const values: Record<string, Uint8Array> = {
    __internal__budgetPad: EMPTY,
    __internal__authorIndex: new Uint8Array([0x01]),
    __internal__identity: EMPTY,
    __internal__genesisOutputBase: new Uint8Array([OUTBASE]),
    __internal__genesisSidecarBase: new Uint8Array([OUTBASE + 2]),
    __internal__code: codeOverride ?? hexToBin(deployer.code),
    __internal__deployValue: EMPTY,
    __internal__msgSenderCategory: new Uint8Array(32),
    __internal__genesisCallees: EMPTY,
  };
  for (const argument of contractArgs) values[argument.name] = argument.value;
  Object.assign(values, valueOverrides);
  const inputs = [dummyInput(0), authorInput(1), dummyInput(2), {
    ...dummyInput(DEPLOYER_INPUT), sequenceNumber: deployerSequence,
    unlockingBytecode: createUnlock(deployer, values),
  }, ...extraInputs];
  return {
    sourceOutputs,
    transaction: { version: 2, locktime, inputs, outputs },
  };
}

const C = `${P} contract C { int n; constructor() { n = 1; } }`;

describe('B7.16: create at an output base different from its input', () => {
  it('mints the constructor\'s record at OUTBASE + 1', () => {
    const artifact = compileString(C, { deployer: true });
    const deployer = artifact.deployer!;
    expect(vm.verify(createSpend(artifact, deployer) as never)).toBe(true);
  });

  it('refuses a record commitment that is not the constructor\'s', () => {
    const artifact = compileString(C, { deployer: true });
    const deployer = artifact.deployer!;
    const wrong = recordOutput(artifact, { n: 2n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash);
    expect(vm.verify(createSpend(artifact, deployer, wrong) as never)).not.toBe(true);
  });
});

describe('A4.4: the data record is pinned at its row', () => {
  const x = (): Uint8Array => dummyInput(DEPLOYER_INPUT).outpointTransactionHash;

  it('refuses the record at another lock or of another value', () => {
    const artifact = compileString(C, { deployer: true });
    const honest = recordOutput(artifact, { n: 1n }, x());
    expect(vm.verify(createSpend(artifact, artifact.deployer!, honest) as never)).toBe(true);
    expect(vm.verify(createSpend(artifact, artifact.deployer!, { ...honest, lockingBytecode: TOKENLESS }) as never))
      .not.toBe(true);
    expect(vm.verify(createSpend(artifact, artifact.deployer!, { ...honest, valueSatoshis: 1201n }) as never))
      .not.toBe(true);
  });

  it('refuses a decoy of another category at the record\'s row while X\'s record carries other state', () => {
    // Input 0 spends (Y, 0), so the builder may mint category Y; the census counts only X's outputs.
    const artifact = compileString(C, { deployer: true });
    const honest = recordOutput(artifact, { n: 1n }, x());
    const y = dummyInput(0).outpointTransactionHash;
    const decoy: VmOutput = { ...honest, token: { category: y, amount: 0n, nft: { capability: 'mutable', commitment: honest.token!.nft!.commitment } } };
    const forged = recordOutput(artifact, { n: 2n }, x());
    expect(vm.verify(createSpend(artifact, artifact.deployer!, decoy, [], (output) => output, undefined, {},
      undefined, 0, 0xffffffff, [forged]) as never)).not.toBe(true);
    // Control: the same Y NFT as an extra output beside the honest record passes.
    expect(vm.verify(createSpend(artifact, artifact.deployer!, honest, [], (output) => output, undefined, {},
      undefined, 0, 0xffffffff, [decoy]) as never)).toBe(true);
  });
});

describe('B7.7: genesis state reads and initialisers', () => {
  it('reads an unwritten field as its type\'s default', () => {
    const artifact = compileString(`${P} contract C { int a; int n; constructor() { n = a + 1; } }`,
      { deployer: true });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { a: 0n, n: 1n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).toBe(true);
  });

  it('keeps a state initialiser the constructor does not overwrite', () => {
    const artifact = compileString(`${P} contract C { int n = 7; constructor() {} }`,
      { deployer: true });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 7n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).toBe(true);
  });
});

describe('B7.7: a constructor helper that writes state', () => {
  it('runs the helper\'s write into the minted record', () => {
    const artifact = compileString(`${P} contract C { int n;
      function set(int x) internal { n = x; }
      constructor() { set(5); } }`, { deployer: true });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 5n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).toBe(true);
  });
});

describe('A3 rule 4: the start of a token container in a constructor', () => {
  const asset = Uint8Array.from({ length: 32 }, (_, i) => (0x21 + i * 7) & 0xff);
  const tokenStart = (pragma: string): string => `${P} ${pragma} contract C(bytes32 asset) { int n;
    constructor() { n = int(this.tokens[asset].tokenAmount); } }`;

  it('reads one unit for a container the contract keeps single', () => {
    const artifact = compileString(tokenStart('pragma tokencontainer single;'), { deployer: true });
    // A8: the container key is the token category in display order; the coin wears it.
    const category = asset;
    const tokenSource: SourceOutputs[number] = {
      lockingBytecode: TOKENLESS, valueSatoshis: 1200n, token: { category, amount: 1n },
    };
    const tokenInput: VmInput = { ...dummyInput(4), outpointTransactionHash: category, outpointIndex: 0 };
    // The record is at the data lock of the master that commits to `asset` (A4.4).
    const { master } = genesisMasters(artifact.deployer!, [{ name: 'asset', value: asset }]);
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 1n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash, master,
    ), [{ name: 'asset', value: asset }], (output) => output, undefined, {}, undefined, 0, 0xffffffff,
    [], [tokenInput], [tokenSource]);
    expect(vm.verify(spend as never)).toBe(true);
  });

  it('refuses a send from a token container in a constructor', () => {
    expect(() => compileString(
      `${P} pragma tokencontainer single; contract C(bytes32 asset) { int n;
        constructor() { this.tokens[asset].transfer(payable(msg.sender), 1); n = 1; } }`,
      { deployer: true },
    )).toThrow(/token container|CtorTokenContainer/);
  });

  it('reads zero for any other container', () => {
    const artifact = compileString(tokenStart(''), { deployer: true });
    const { master } = genesisMasters(artifact.deployer!, [{ name: 'asset', value: asset }]);
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 0n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash, master,
    ), [{ name: 'asset', value: asset }]) as never)).toBe(true);
  });
});

describe('B7.10: the balance journal', () => {
  it('refuses a constructor that sends and then reads this.balance (A4.1\'s balance rule)', () => {
    // A read and a send in one constructor would let the front end's order of evaluation show: in a function
    // `this.balance` is the same before and after a send, while at birth the journal falls at each send.
    const artifact = compileString(`${P} contract C(address payable to) { int n;
      constructor() payable { payable(to).send(1000); n = this.balance; } }`,
    { deployer: true });
    expect(artifact.deployer).toBeUndefined();
    expect((artifact as { deployerUnsupported?: string }).deployerUnsupported).toBe('ctor-collection-shape');
  });

  it('reads a payable constructor\'s balance as the deploy value', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() payable { n = this.balance; } }`,
      { deployer: true });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 2000n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, { __internal__deployValue: bigIntToVmNumber(2000n) }) as never)).toBe(true);
  });

  it('reads the container start plus the value when it keeps the satoshi container single', () => {
    const artifact = compileString(`${P} pragma satoshicontainer single; contract C { int n;
      constructor() payable { n = this.balance; } }`, { deployer: true });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 2700n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, { __internal__deployValue: bigIntToVmNumber(1500n) }) as never)).toBe(true);
  });
});

describe('B7.13: the HEAD of an unwritten sorted collection', () => {
  const source = `${P} contract C { mapping(int => int) m; constructor() { } }`;
  const spendWith = (mutate: (head: VmOutput) => VmOutput): Spend => {
    const artifact = compileString(source, { deployer: true });
    console.error('ENTRYABI', JSON.stringify(artifact.deployer!.abi.find((f) => f.name === 'create')!.inputs.map((i) => [i.name, i.type])));
    const { x, master } = genesisMasters(artifact.deployer!);
    const collection = artifact.stateLayout!.collections![0];
    const covenant = scriptToBytecode(buildEntryNftCovenantScript(
      x, computeCollectionHash(collection.signature), master,
    ));
    const head: VmOutput = {
      lockingBytecode: encodeLockingBytecodeP2sh32(hash256(covenant)),
      valueSatoshis: 1200n,
      token: {
        category: x, amount: 0n,
        nft: { capability: 'mutable', commitment: new Uint8Array(128) },
      },
    };
    return createSpend(artifact, artifact.deployer!, undefined, [], (output) => output, undefined, {},
      undefined, 0, 0xffffffff, [mutate(head)]);
  };

  it('mints the empty HEAD at its row', () => {
    expect(vm.verify(spendWith((head) => head) as never)).toBe(true);
  });

  it('refuses another lock or commitment', () => {
    expect(vm.verify(spendWith((head) => ({ ...head, lockingBytecode: TOKENLESS })) as never)).not.toBe(true);
    expect(vm.verify(spendWith((head) => ({
      ...head, token: { ...head.token!, nft: { capability: 'mutable', commitment: new Uint8Array(129) } },
    })) as never)).not.toBe(true);
  });
});

describe('B7.12: the identity output when the flag is 1', () => {
  const spendWith = (mutate: (outputs: VmOutput[]) => VmOutput[]): Spend => {
    const artifact = compileString(C, { deployer: true });
    const { x } = genesisMasters(artifact.deployer!);
    const genX = Uint8Array.from(x).reverse();
    const redeem = Uint8Array.from([0x21, ...genX, 0x01, ...AUTHHEAD_BODY]);
    const identity: VmOutput = {
      lockingBytecode: encodeLockingBytecodeP2sh32(hash256(redeem)),
      valueSatoshis: 1000n,
      token: { category: x, amount: 0n, nft: { capability: 'mutable', commitment: EMPTY } },
    };
    const spend = createSpend(artifact, artifact.deployer!, undefined, [], (output) => output, undefined,
      { __internal__identity: Uint8Array.of(0x01) });
    spend.transaction.outputs = mutate([identity, ...spend.transaction.outputs.slice(1)]);
    return spend;
  };

  it('mints the authhead coin at output 0', () => {
    expect(vm.verify(spendWith((outputs) => outputs) as never)).toBe(true);
  });

  it('refuses another lock, category or amount', () => {
    expect(vm.verify(spendWith(([first, ...rest]) => [{ ...first, lockingBytecode: TOKENLESS }, ...rest]) as never))
      .not.toBe(true);
    expect(vm.verify(spendWith(([first, ...rest]) => [{
      ...first, token: { ...first.token!, category: new Uint8Array(32) },
    }, ...rest]) as never)).not.toBe(true);
  });
});

describe('B7.10: block fields at genesis come from the locktime', () => {
  // A block reader's master lock commits to its `__oraclePool` binding (createSpend passes 0x11 bytes), and create
  // pins the record row at the data lock of that master (A4.4).
  const pooled = (artifact: Artifact): Uint8Array => genesisMasters(artifact.deployer!, [
    { name: '__oraclePool', value: new Uint8Array(32).fill(0x11) },
  ]).master;
  it('reads block.number', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() { n = block.number; } }`,
      { deployer: true });
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 900n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash, pooled(artifact),
    ), [], (output) => output, undefined, {}, undefined, 900, 0xfffffffe);
    expect(vm.verify(spend as never)).toBe(true);
  });

  it('reads block.timestamp', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() { n = block.timestamp; } }`,
      { deployer: true });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 1_700_000_000n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash, pooled(artifact),
    ), [], (output) => output, undefined, {}, undefined, 1_700_000_000, 0xfffffffe) as never)).toBe(true);
  });

  it('refuses a height read from a timestamp locktime', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() { n = block.number; } }`,
      { deployer: true });
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 1_700_000_000n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash, pooled(artifact),
    ), [], (output) => output, undefined, {}, undefined, 1_700_000_000, 0xfffffffe);
    expect(vm.verify(spend as never)).not.toBe(true);
  });
});

describe('B7.12: the master lock commits to the contract arguments', () => {
  it('builds M as P2SH32(pin(X) || A || code)', () => {
    const artifact = compileString(`${P} contract C(bytes32 t) { int n; constructor() { n = 1; } }`,
      { deployer: true });
    const t = Uint8Array.from({ length: 32 }, (_, i) => (0x10 + i * 5) & 0xff);
    expect(vm.verify(createSpend(artifact, artifact.deployer!, undefined, [{ name: 't', value: t }]) as never))
      .toBe(true);
  });
});

describe('B7.16: the master output is pinned', () => {
  const deployerOf = (): Artifact => compileString(C, { deployer: true });
  const spends = (adjust: (output: VmOutput) => VmOutput): Spend => {
    const artifact = deployerOf();
    return createSpend(artifact, artifact.deployer!, undefined, [], adjust);
  };
  it('refuses another lock', () => {
    expect(vm.verify(spends((output) => ({ ...output, lockingBytecode: TOKENLESS })) as never)).not.toBe(true);
  });
  it('refuses another category, amount, commitment or value', () => {
    const wrongCategory = spends((output) => ({
      ...output, token: { ...output.token!, category: new Uint8Array(32).fill(7) },
    }));
    expect(vm.verify(wrongCategory as never)).not.toBe(true);
    const wrongAmount = spends((output) => ({
      ...output, token: { ...output.token!, amount: 1n },
    }));
    expect(vm.verify(wrongAmount as never)).not.toBe(true);
    const wrongCommitment = spends((output) => ({
      ...output, token: { ...output.token!, nft: { capability: 'minting', commitment: Uint8Array.of(1) } },
    }));
    expect(vm.verify(wrongCommitment as never)).not.toBe(true);
    const wrongValue = spends((output) => ({ ...output, valueSatoshis: 1201n }));
    expect(vm.verify(wrongValue as never)).not.toBe(true);
  });
});

describe('B7.16: the deployer coin and the output base', () => {
  it('refuses a deployer outpoint that is not the category origin', () => {
    const artifact = compileString(C, { deployer: true });
    const spend = createSpend(artifact, artifact.deployer!);
    spend.transaction.inputs[DEPLOYER_INPUT].outpointTransactionHash = new Uint8Array(32).fill(9);
    expect(vm.verify(spend as never)).not.toBe(true);
  });

  it('refuses a genesis output base that disagrees with the outputs', () => {
    const artifact = compileString(C, { deployer: true });
    const spend = createSpend(artifact, artifact.deployer!, undefined, [], (output) => output, undefined,
      { __internal__genesisOutputBase: Uint8Array.of(OUTBASE + 1) });
    expect(vm.verify(spend as never)).not.toBe(true);
  });
});

describe('A4.3 steps 3 and 4: the deployer coin is (X, 0) and the author coin (X, 1) is spent', () => {
  const x = (): Uint8Array => dummyInput(DEPLOYER_INPUT).outpointTransactionHash;

  it('refuses another coin in the author coin\'s place, and the author coin at an index the parameter does not name', () => {
    const artifact = compileString(C, { deployer: true });
    const replaced = createSpend(artifact, artifact.deployer!);
    replaced.transaction.inputs[1] = dummyInput(1);
    expect(vm.verify(replaced as never)).not.toBe(true);
    const change = createSpend(artifact, artifact.deployer!);
    change.transaction.inputs[1] = { ...change.transaction.inputs[1], outpointIndex: 2 };
    expect(vm.verify(change as never)).not.toBe(true);
    // The author coin at input 2: refused while __internal__authorIndex names input 1, accepted once it names 2.
    for (const [authorIndex, accepted] of [[1, false], [2, true]] as const) {
      const moved = createSpend(artifact, artifact.deployer!, undefined, [], (output) => output, undefined,
        { __internal__authorIndex: Uint8Array.of(authorIndex) });
      [moved.transaction.inputs[1], moved.transaction.inputs[2]] = [dummyInput(1), authorInput(2)];
      expect(vm.verify(moved as never) === true, `author index ${authorIndex}`).toBe(accepted);
    }
  });

  it('refuses a deployer coin at (X, 2) beside a coin at (X, 0), and accepts the two the other way round', () => {
    const artifact = compileString(C, { deployer: true });
    for (const [deployerVout, otherVout, accepted] of [[2, 0, false], [0, 2, true]] as const) {
      const spend = createSpend(artifact, artifact.deployer!);
      spend.transaction.inputs[0] = {
        ...spend.transaction.inputs[0], outpointTransactionHash: x(), outpointIndex: otherVout,
      };
      spend.transaction.inputs[DEPLOYER_INPUT].outpointIndex = deployerVout;
      expect(vm.verify(spend as never) === true, `deployer at vout ${deployerVout}`).toBe(accepted);
    }
  });
});

describe('A4.4: an optional satoshi row', () => {
  const SENDS = `${P} contract C(address payable to) { int n; constructor() payable { payable(to).send(1200); n = 1; } }`;
  const to = Uint8Array.from([0x76, 0xa9, 0x14, ...Array.from({ length: 20 }, (_, i) => i + 1), 0x88, 0xac]);
  const spendWith = (deployValue: bigint, row: (master: Uint8Array, artifact: Artifact) => VmOutput): Spend => {
    const artifact = compileString(SENDS, { deployer: true });
    const { master } = genesisMasters(artifact.deployer!, [{ name: 'to', value: to }]);
    const transfer: VmOutput = { lockingBytecode: to, valueSatoshis: 1200n };
    return createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 1n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash, master,
    ), [{ name: 'to', value: to }], (output) => output, undefined,
    { __internal__deployValue: bigIntToVmNumber(deployValue) }, undefined, 0, 0xffffffff, [row(master, artifact), transfer]);
  };

  it('with a balance left, holds it at the container lock', () => {
    expect(vm.verify(spendWith(5000n, (master, artifact) => ({
      lockingBytecode: satoshiRowLock(artifact, master), valueSatoshis: 3800n,
    })) as never)).toBe(true);
    expect(vm.verify(spendWith(5000n, () => ({ lockingBytecode: TOKENLESS, valueSatoshis: 3800n })) as never))
      .not.toBe(true);
    expect(vm.verify(spendWith(5000n, (master, artifact) => ({
      lockingBytecode: satoshiRowLock(artifact, master), valueSatoshis: 3799n,
    })) as never)).not.toBe(true);
  });

  it('with nothing left, takes any output without a token', () => {
    expect(vm.verify(spendWith(1200n, () => ({ lockingBytecode: TOKENLESS, valueSatoshis: 1000n })) as never)).toBe(true);
    expect(vm.verify(spendWith(1200n, () => ({
      lockingBytecode: TOKENLESS, valueSatoshis: 1000n,
      token: { category: dummyInput(0).outpointTransactionHash, amount: 1n },
    })) as never)).not.toBe(true);
  });
});

describe('B7.10: the constructor reads msg.sender as tx.origin at birth', () => {
  const C_SENDER = `${P} contract C { int n; constructor() { n = int(msg.sender.length); } }`;
  const signer = new SignatureTemplate(alicePriv);
  const P2PKH = signer.unlockP2PKH().generateLockingBytecode();

  it('resolves the deploying wallet when a native P2PKH coin is co-spent', () => {
    const artifact = compileString(C_SENDER, { deployer: true });
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 25n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, {
      __internal__creatorInputIdx: Uint8Array.of(0x81),
      __internal__creatorList: EMPTY,
      __internal__creatorListPos: EMPTY,
    }, P2PKH);
    spend.transaction.inputs[0].unlockingBytecode = signer.unlockP2PKH().generateUnlockingBytecode({
      transaction: spend.transaction as never, sourceOutputs: spend.sourceOutputs as never, inputIndex: 0,
    });
    expect(vm.verify(spend as never)).toBe(true);
  });

  it('refuses when there is no native origin', () => {
    const artifact = compileString(C_SENDER, { deployer: true });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 0n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).not.toBe(true);
  });
});

describe('B7.16: step 2, the code is C\'s', () => {
  it('refuses another code push', () => {
    const artifact = compileString(C, { deployer: true });
    const wrong = hexToBin(artifact.deployer!.code);
    wrong[wrong.length - 1] ^= 0x01;
    expect(vm.verify(createSpend(artifact, artifact.deployer!, undefined, [], (o) => o, wrong) as never))
      .not.toBe(true);
  });
});

describe('B7.10: msg.value is the deploy value', () => {
  it('stores __internal__deployValue', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() payable { n = msg.value; } }`,
      { deployer: true });
    const deployer = artifact.deployer!;
    const spend = createSpend(artifact, deployer, recordOutput(
      artifact, { n: 2000n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, { __internal__deployValue: bigIntToVmNumber(2000n) });
    const verdict = vm.verify(spend as never);
    if (verdict !== true) {
      const st = vm.evaluate({ ...(spend as never), inputIndex: 3 } as never) as unknown as {
        error?: string; ip?: number; instructions?: { opcode: number }[];
      };
      console.error('READFAIL', st.error, st.ip, (st.instructions ?? []).slice(Math.max(0, (st.ip ?? 0) - 10), (st.ip ?? 0) + 2).map((x)=>x.opcode.toString(16)).join(' '));
    }
    expect(verdict).toBe(true);
  });
});

describe('B7.10: msg.sender with a zero sender category is tx.origin', () => {
  it('stores the first P2PKH input\'s lock', () => {
    const artifact = compileString(`${P} contract C { address owner; constructor() { owner = msg.sender; } }`,
      { deployer: true });
    const p2pkh = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(3), 0x88, 0xac]);
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { owner: p2pkh }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, {}, p2pkh);
    expect(vm.stateSuccess(vm.evaluate({ ...(spend as never), inputIndex: DEPLOYER_INPUT }))).toBe(true);
  });
});

describe('B7.10: address(this) and this.activeBytecode', () => {
  it('answers address(this) with M and this.activeBytecode with R', () => {
    const artifact = compileString(`${P} contract C { address self; bytes32 h;
      constructor() { self = address(this); h = sha256(this.activeBytecode); } }`,
    { deployer: true });
    const { redeem, master } = genesisMasters(artifact.deployer!);
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { self: master, h: sha256.hash(redeem) }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).toBe(true);
  });
});



describe('B7.12 / A4.5: the census', () => {
  const deployerOf = (): Artifact => compileString(C, { deployer: true });
  const tokenOutput = (
    category: Uint8Array,
    nft: { capability: 'none' | 'mutable' | 'minting'; commitment: Uint8Array } | undefined,
    amount = 0n,
  ): VmOutput => ({
    lockingBytecode: TOKENLESS,
    valueSatoshis: 1200n,
    token: { category, amount, ...(nft === undefined ? {} : { nft }) },
  });
  const x = (): Uint8Array => dummyInput(DEPLOYER_INPUT).outpointTransactionHash;
  const run = (
    extra: VmOutput[] = [], adjustMaster: (output: VmOutput) => VmOutput = (output) => output,
    valueOverrides: Record<string, Uint8Array> = {},
  ): Spend => {
    const artifact = deployerOf();
    return createSpend(artifact, artifact.deployer!, undefined, [], adjustMaster, undefined,
      valueOverrides, undefined, 0, 0xffffffff, extra);
  };

  it('refuses a second master', () => {
    expect(vm.verify(run([tokenOutput(x(), { capability: 'minting', commitment: EMPTY })]) as never))
      .not.toBe(true);
  });
  it('refuses an extra mutable record', () => {
    expect(vm.verify(run([tokenOutput(x(), { capability: 'mutable', commitment: EMPTY })]) as never))
      .not.toBe(true);
  });
  it('refuses an extra immutable own-category NFT', () => {
    expect(vm.verify(run([tokenOutput(x(), { capability: 'none', commitment: EMPTY })]) as never))
      .not.toBe(true);
  });
  it('refuses an own-category fungible amount', () => {
    expect(vm.verify(run([tokenOutput(x(), undefined, 1n)]) as never)).not.toBe(true);
  });
  it('refuses a missing master', () => {
    expect(vm.verify(run([], (output) => ({ ...output, token: undefined })) as never)).not.toBe(true);
  });
  it('refuses an OUTBASE that does not name the master', () => {
    expect(vm.verify(run([], (output) => output,
      { __internal__genesisOutputBase: Uint8Array.of(OUTBASE - 1) }) as never)).not.toBe(true);
  });
});

describe('B7.12: the callee list', () => {
  it('refuses a non-empty list when the constructor calls nothing', () => {
    const artifact = compileString(C, { deployer: true });
    const spend = createSpend(artifact, artifact.deployer!, undefined, [], (output) => output, undefined,
      { __internal__genesisCallees: Uint8Array.of(0, 0) });
    expect(vm.verify(spend as never)).not.toBe(true);
  });
});

describe('B7.18: a constructor mapping write', () => {
  // A4.4: a constructor that writes a collection gets no deployer (`ctor-collection-shape`) until the collection
  // journal and step 12's check of its rows are built. Restore these with that work.
  it.skip('mints the entry row its write describes', () => {
    const artifact = compileString(`${P} contract C { mapping(int => int) m; constructor() { m[1] = 2; } }`,
      { deployer: true });
    const { x, master } = genesisMasters(artifact.deployer!);
    const collection = artifact.stateLayout!.collections![0];
    const covenant = scriptToBytecode(buildEntryNftCovenantScript(
      x, computeCollectionHash(collection.signature), master,
    ));
    const slot = sha256.hash(encodePushdataValue(1n, 'int'));
    slot[31] &= 0x7f;
    const commitment = new Uint8Array([...slot, ...new Uint8Array(32), ...encodePushdataValue(2n, 'int')]);
    const entry: VmOutput = {
      lockingBytecode: encodeLockingBytecodeP2sh32(hash256(covenant)),
      valueSatoshis: 1200n,
      token: { category: x, amount: 0n, nft: { capability: 'mutable', commitment } },
    };
    expect(vm.verify(createSpend(artifact, artifact.deployer!, undefined, [], (output) => output, undefined, {
      __internal__vmapBatchSlot_0: new Uint8Array(32),
      __internal__vmapBatchProof_0: Uint8Array.of(0x81),
      __internal__vmapBatchNext_0: new Uint8Array(32),
      __internal__vmapBatchPredOut_0: Uint8Array.of(0x82),
      __internal__vmapBatchTrailingCount: EMPTY,
    }, undefined, 0, 0xffffffff, [entry]) as never)).toBe(true);
  });

  const entryFor = (artifact: Artifact, value: bigint): { x: Uint8Array; master: Uint8Array; entry: VmOutput } => {
    const { x, master } = genesisMasters(artifact.deployer!);
    const collection = artifact.stateLayout!.collections![0];
    const covenant = scriptToBytecode(buildEntryNftCovenantScript(
      x, computeCollectionHash(collection.signature), master,
    ));
    const slot = sha256.hash(encodePushdataValue(1n, 'int'));
    slot[31] &= 0x7f;
    return {
      x, master,
      entry: {
        lockingBytecode: encodeLockingBytecodeP2sh32(hash256(covenant)),
        valueSatoshis: 1200n,
        token: {
          category: x, amount: 0n,
          nft: { capability: 'mutable' as const,
            commitment: new Uint8Array([...slot, ...new Uint8Array(32), ...encodePushdataValue(value, 'int')]) },
        },
      } as VmOutput,
    };
  };

  // A4.4: a constructor that writes a collection gets no deployer (`ctor-collection-shape`) until the collection
  // journal and step 12's check of its rows are built. Restore these with that work.
  it.skip('reads the value it wrote in the constructor', () => {
    const artifact = compileString(`${P} contract C { mapping(int => int) m;
      constructor() { m[1] = 2; require(m[1] == 2); } }`, { deployer: true });
    const { entry } = entryFor(artifact, 2n);
    const spend = createSpend(artifact, artifact.deployer!, undefined, [], (output) => output, undefined, {
      __internal__vmapBatchSlot_0: new Uint8Array(32),
      __internal__vmapBatchProof_0: Uint8Array.of(0x81),
      __internal__vmapBatchNext_0: new Uint8Array(32),
      __internal__vmapBatchPredOut_0: Uint8Array.of(0x82),
      __internal__vmapBatchTrailingCount: EMPTY,
    }, undefined, 0, 0xffffffff, [entry]);
    expect(vm.verify(spend as never)).toBe(true);
  });

  // A4.4: a constructor that writes a collection gets no deployer (`ctor-collection-shape`) until the collection
  // journal and step 12's check of its rows are built. Restore these with that work.
  it.skip('reads an unwritten key as the type default', () => {
    const artifact = compileString(`${P} contract C { int n; mapping(int => int) m;
      constructor() { m[1] = 2; n = m[5]; } }`, { deployer: true });
    const { master, entry } = entryFor(artifact, 2n);
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 0n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash, master,
    ), [], (output) => output, undefined, {
      __internal__vmapBatchSlot_0: new Uint8Array(32),
      __internal__vmapBatchProof_0: Uint8Array.of(0x81),
      __internal__vmapBatchNext_0: new Uint8Array(32),
      __internal__vmapBatchPredOut_0: Uint8Array.of(0x82),
      __internal__vmapBatchTrailingCount: EMPTY,
    }, undefined, 0, 0xffffffff, [entry]);
    expect(vm.verify(spend as never)).toBe(true);
  });
});

describe('B7.18: a held read feeds the next entry', () => {
  // A4.4: a constructor that writes a collection gets no deployer (`ctor-collection-shape`) until the collection
  // journal and step 12's check of its rows are built. Restore these with that work.
  it.skip('writes the held value into the second key', () => {
    const artifact = compileString(`${P} contract C { mapping(int => int) m;
      constructor() { m[1] = 5; m[2] = m[1] + 1; } }`, { deployer: true });
    const { x, master } = genesisMasters(artifact.deployer!);
    const collection = artifact.stateLayout!.collections![0];
    const lock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(
      buildEntryNftCovenantScript(x, computeCollectionHash(collection.signature), master),
    )));
    const commitmentFor = (key: bigint, value: bigint): Uint8Array => {
      const slot = sha256.hash(encodePushdataValue(key, 'int'));
      slot[31] &= 0x7f;
      return new Uint8Array([...slot, ...new Uint8Array(32), ...encodePushdataValue(value, 'int')]);
    };
    const entry = (key: bigint, value: bigint): VmOutput => ({
      lockingBytecode: lock, valueSatoshis: 1200n,
      token: { category: x, amount: 0n, nft: { capability: 'mutable', commitment: commitmentFor(key, value) } },
    });
    const witnesses = (slot: number): Record<string, Uint8Array> => ({
      [`__internal__vmapBatchSlot_${slot}`]: new Uint8Array(32),
      [`__internal__vmapBatchProof_${slot}`]: Uint8Array.of(0x81),
      [`__internal__vmapBatchNext_${slot}`]: new Uint8Array(32),
      [`__internal__vmapBatchPredOut_${slot}`]: Uint8Array.of(0x82),
    });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, undefined, [], (o) => o, undefined, {
      ...witnesses(0), ...witnesses(1), __internal__vmapBatchTrailingCount: EMPTY,
    }, undefined, 0, 0xffffffff, [entry(1n, 5n), entry(2n, 6n)]) as never)).toBe(true);
  });
});

describe('B7.18: a held read stored in scalar state', () => {
  // A4.4: a constructor that writes a collection gets no deployer (`ctor-collection-shape`) until the collection
  // journal and step 12's check of its rows are built. Restore these with that work.
  it.skip('encodes the held value in the data record', () => {
    const artifact = compileString(`${P} contract C { int n; mapping(int => int) m;
      constructor() { m[1] = 2; n = m[1]; } }`, { deployer: true });
    const { x, master } = genesisMasters(artifact.deployer!);
    const collection = artifact.stateLayout!.collections![0];
    const lock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(
      buildEntryNftCovenantScript(x, computeCollectionHash(collection.signature), master))));
    const slot = sha256.hash(encodePushdataValue(1n, 'int')); slot[31] &= 0x7f;
    const entry: VmOutput = { lockingBytecode: lock, valueSatoshis: 1200n,
      token: { category: x, amount: 0n, nft: { capability: 'mutable',
        commitment: new Uint8Array([...slot, ...new Uint8Array(32), ...encodePushdataValue(2n, 'int')]) } } };
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(artifact, { n: 2n },
      dummyInput(DEPLOYER_INPUT).outpointTransactionHash, master), [], (o) => o, undefined, {
      __internal__vmapBatchSlot_0: new Uint8Array(32), __internal__vmapBatchProof_0: Uint8Array.of(0x81),
      __internal__vmapBatchNext_0: new Uint8Array(32), __internal__vmapBatchPredOut_0: Uint8Array.of(0x82),
      __internal__vmapBatchTrailingCount: EMPTY,
    }, undefined, 0, 0xffffffff, [entry]) as never)).toBe(true);
  });
});
