/**
 * B7.16: a genuine `create` on the BCH 2026 VM.
 *
 * The deployer coin sits at input 3 and the genesis range starts at output 5, so no index of the range can be
 * mistaken for the running input. The constructor writes one scalar, which is minted as the data record at
 * OUTBASE + 1.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin, sha256 } from '@bitauth/libauth';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  asmToScript, buildDataNftCovenantScript, buildEntryNftCovenantScript, buildPushdataCommitment,
  computeCollectionHash, scriptToBytecode,
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

const P = 'pragma solidcash ^0.50.0;';
const EMPTY = new Uint8Array(0);
const TOKENLESS = Uint8Array.from([0x51]);
const OUTBASE = 5;
const DEPLOYER_INPUT = 3;
const vm = createVirtualMachineBch2026();

const pushes = (values: readonly Uint8Array[]): Uint8Array =>
  new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));

const redeemOf = (artifact: Artifact): Uint8Array => scriptToBytecode(asmToScript(artifact.bytecode));

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

function genesisMasters(deployer: DeployerAbi, contractArgs: { name: string; value: Uint8Array }[] = []) {
  const x = dummyInput(DEPLOYER_INPUT).outpointTransactionHash;
  const category = Uint8Array.from([...x.slice().reverse(), 0x02]);
  const argumentBytes = new Uint8Array(contractArgs.slice().reverse()
    .flatMap((argument) => [...encodeDataPush(argument.value)]));
  const redeem = new Uint8Array([
    ...encodeDataPush(category), 0xc0, 0xce, 0x88, ...argumentBytes, ...hexToBin(deployer.code),
  ]);
  return { x, redeem, master: encodeLockingBytecodeP2sh32(hash256(redeem)) };
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
) {
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
  const { x, redeem, master } = genesisMasters(deployer, contractArgs);
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
            lockingBytecode: TOKENLESS,
            valueSatoshis: (layout.singleSatoshiContainer === true ? 1200n : 0n) + deployValue,
          });
        } else if (slot.kind === 'tokenContainer' && slot.slotIndex !== undefined) {
          const argument = contractArgs[slot.slotIndex];
          if (argument !== undefined) {
            outputs.push({
              lockingBytecode: TOKENLESS,
              valueSatoshis: 1200n,
              token: {
                category: Uint8Array.from(argument.value).reverse(),
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
  const inputs = [dummyInput(0), dummyInput(1), dummyInput(2), {
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
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const deployer = artifact.deployer!;
    expect(vm.verify(createSpend(artifact, deployer) as never)).toBe(true);
  });

  it('refuses a record commitment that is not the constructor\'s', () => {
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const deployer = artifact.deployer!;
    const wrong = recordOutput(artifact, { n: 2n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash);
    expect(vm.verify(createSpend(artifact, deployer, wrong) as never)).not.toBe(true);
  });
});

describe('B7.7: genesis state reads and initialisers', () => {
  it('reads an unwritten field as its type\'s default', () => {
    const artifact = compileString(`${P} contract C { int a; int n; constructor() { n = a + 1; } }`,
      { deployer: true, messageBus: false });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { a: 0n, n: 1n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).toBe(true);
  });

  it('keeps a state initialiser the constructor does not overwrite', () => {
    const artifact = compileString(`${P} contract C { int n = 7; constructor() {} }`,
      { deployer: true, messageBus: false });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 7n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).toBe(true);
  });
});

describe('B7.7: a constructor helper that writes state', () => {
  it('runs the helper\'s write into the minted record', () => {
    const artifact = compileString(`${P} contract C { int n;
      function set(int x) internal { n = x; }
      constructor() { set(5); } }`, { deployer: true, messageBus: false });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 5n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).toBe(true);
  });
});

describe('A3 rule 4: the start of a token container in a constructor', () => {
  const asset = Uint8Array.from({ length: 32 }, (_, i) => (0x21 + i * 7) & 0xff);
  const tokenStart = (pragma: string) => `${P} ${pragma} contract C(bytes32 asset) { int n;
    constructor() { n = int(this.tokens[asset].tokenAmount); } }`;

  it('reads one unit for a container the contract keeps single', () => {
    const artifact = compileString(tokenStart('pragma tokencontainer single;'), { deployer: true, messageBus: false });
    const category = Uint8Array.from(asset).reverse();
    const tokenSource: SourceOutputs[number] = {
      lockingBytecode: TOKENLESS, valueSatoshis: 1200n, token: { category, amount: 1n },
    };
    const tokenInput: VmInput = { ...dummyInput(4), outpointTransactionHash: category, outpointIndex: 0 };
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 1n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [{ name: 'asset', value: asset }], (output) => output, undefined, {}, undefined, 0, 0xffffffff,
    [], [tokenInput], [tokenSource]);
    expect(vm.verify(spend as never)).toBe(true);
  });

  it('reads zero for any other container', () => {
    const artifact = compileString(tokenStart(''), { deployer: true, messageBus: false });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 0n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [{ name: 'asset', value: asset }]) as never)).toBe(true);
  });
});

describe('B7.10: the balance journal', () => {
  it('reads this.balance as __internal__deployValue less the sends', () => {
    const artifact = compileString(`${P} contract C(address payable to) { int n;
      constructor() payable { payable(to).send(1000); n = this.balance; } }`,
    { deployer: true, messageBus: false });
    const to = Uint8Array.from([0x76, 0xa9, 0x14, ...Array.from({ length: 20 }, (_, i) => i + 1), 0x88, 0xac]);
    const { master } = genesisMasters(artifact.deployer!, [{ name: 'to', value: to }]);
    const transfer: VmOutput = { lockingBytecode: to, valueSatoshis: 1000n };
    const satoshiRow: VmOutput = { lockingBytecode: TOKENLESS, valueSatoshis: 4000n };
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 4000n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash, master,
    ), [{ name: 'to', value: to }], (output) => output, undefined,
    { __internal__deployValue: bigIntToVmNumber(5000n) }, undefined, 0, 0xffffffff, [satoshiRow, transfer]);
    expect(vm.verify(spend as never)).toBe(true);
  });

  it('reads a payable constructor\'s balance as the deploy value', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() payable { n = this.balance; } }`,
      { deployer: true, messageBus: false });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 1000n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, { __internal__deployValue: Uint8Array.of(0xe8, 0x03) }) as never)).toBe(true);
  });

  it('reads the container start plus the value when it keeps the satoshi container single', () => {
    const artifact = compileString(`${P} pragma satoshicontainer single; contract C { int n;
      constructor() payable { n = this.balance; } }`, { deployer: true, messageBus: false });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 1700n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, { __internal__deployValue: bigIntToVmNumber(500n) }) as never)).toBe(true);
  });
});

describe('B7.13: the HEAD of an unwritten sorted collection', () => {
  const source = `${P} contract C { mapping(int => int) m; constructor() { } }`;
  const spendWith = (mutate: (head: VmOutput) => VmOutput) => {
    const artifact = compileString(source, { deployer: true, messageBus: false });
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

describe('B7.10: block fields at genesis come from the locktime', () => {
  it('reads block.number', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() { n = block.number; } }`,
      { deployer: true, messageBus: false });
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 900n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, {}, undefined, 900, 0xfffffffe);
    expect(vm.verify(spend as never)).toBe(true);
  });

  it('reads block.timestamp', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() { n = block.timestamp; } }`,
      { deployer: true, messageBus: false });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 1_700_000_000n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, {}, undefined, 1_700_000_000, 0xfffffffe) as never)).toBe(true);
  });

  it('refuses a height read from a timestamp locktime', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() { n = block.number; } }`,
      { deployer: true, messageBus: false });
    const spend = createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 1_700_000_000n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, {}, undefined, 1_700_000_000, 0xfffffffe);
    expect(vm.verify(spend as never)).not.toBe(true);
  });
});

describe('B7.12: the master lock commits to the contract arguments', () => {
  it('builds M as P2SH32(pin(X) || A || code)', () => {
    const artifact = compileString(`${P} contract C(bytes32 t) { int n; constructor() { n = 1; } }`,
      { deployer: true, messageBus: false });
    const t = Uint8Array.from({ length: 32 }, (_, i) => (0x10 + i * 5) & 0xff);
    expect(vm.verify(createSpend(artifact, artifact.deployer!, undefined, [{ name: 't', value: t }]) as never))
      .toBe(true);
  });
});

describe('B7.16: the master output is pinned', () => {
  const deployerOf = () => compileString(C, { deployer: true, messageBus: false });
  const spends = (adjust: (output: VmOutput) => VmOutput) => {
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
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const spend = createSpend(artifact, artifact.deployer!);
    spend.transaction.inputs[DEPLOYER_INPUT].outpointTransactionHash = new Uint8Array(32).fill(9);
    expect(vm.verify(spend as never)).not.toBe(true);
  });

  it('refuses a genesis output base that disagrees with the outputs', () => {
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const spend = createSpend(artifact, artifact.deployer!, undefined, [], (output) => output, undefined,
      { __internal__genesisOutputBase: Uint8Array.of(OUTBASE + 1) });
    expect(vm.verify(spend as never)).not.toBe(true);
  });
});

describe('B7.10: the constructor reads msg.sender as tx.origin at birth', () => {
  const C_SENDER = `${P} contract C { int n; constructor() { n = int(msg.sender.length); } }`;
  const signer = new SignatureTemplate(alicePriv);
  const P2PKH = signer.unlockP2PKH().generateLockingBytecode();

  it('resolves the deploying wallet when a native P2PKH coin is co-spent', () => {
    const artifact = compileString(C_SENDER, { deployer: true, messageBus: false });
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
    const artifact = compileString(C_SENDER, { deployer: true, messageBus: false });
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { n: 0n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).not.toBe(true);
  });
});

describe('B7.16: step 2, the code is C\'s', () => {
  it('refuses another code push', () => {
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const wrong = hexToBin(artifact.deployer!.code);
    wrong[wrong.length - 1] ^= 0x01;
    expect(vm.verify(createSpend(artifact, artifact.deployer!, undefined, [], (o) => o, wrong) as never))
      .not.toBe(true);
  });
});

describe('B7.10: msg.value is the deploy value', () => {
  it('stores __internal__deployValue', () => {
    const artifact = compileString(`${P} contract C { int n; constructor() payable { n = msg.value; } }`,
      { deployer: true, messageBus: false });
    const deployer = artifact.deployer!;
    const spend = createSpend(artifact, deployer, recordOutput(
      artifact, { n: 1000n }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    ), [], (output) => output, undefined, { __internal__deployValue: Uint8Array.of(0xe8, 0x03) });
    expect(vm.verify(spend as never)).toBe(true);
  });
});

describe('B7.10: msg.sender with a zero sender category is tx.origin', () => {
  it('stores the first P2PKH input\'s lock', () => {
    const artifact = compileString(`${P} contract C { address owner; constructor() { owner = msg.sender; } }`,
      { deployer: true, messageBus: false });
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
    { deployer: true, messageBus: false });
    const { redeem, master } = genesisMasters(artifact.deployer!);
    expect(vm.verify(createSpend(artifact, artifact.deployer!, recordOutput(
      artifact, { self: master, h: sha256.hash(redeem) }, dummyInput(DEPLOYER_INPUT).outpointTransactionHash,
    )) as never)).toBe(true);
  });
});



describe('B7.12 / A4.5: the census', () => {
  const deployerOf = () => compileString(C, { deployer: true, messageBus: false });
  const tokenOutput = (
    category: Uint8Array,
    nft: { capability: 'none' | 'mutable' | 'minting'; commitment: Uint8Array } | undefined,
    amount = 0n,
  ): VmOutput => ({
    lockingBytecode: TOKENLESS,
    valueSatoshis: 1200n,
    token: { category, amount, ...(nft === undefined ? {} : { nft }) },
  });
  const x = () => dummyInput(DEPLOYER_INPUT).outpointTransactionHash;
  const run = (
    extra: VmOutput[] = [], adjustMaster: (output: VmOutput) => VmOutput = (output) => output,
    valueOverrides: Record<string, Uint8Array> = {},
  ) => {
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
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const spend = createSpend(artifact, artifact.deployer!, undefined, [], (output) => output, undefined,
      { __internal__genesisCallees: Uint8Array.of(0, 0) });
    expect(vm.verify(spend as never)).not.toBe(true);
  });
});
