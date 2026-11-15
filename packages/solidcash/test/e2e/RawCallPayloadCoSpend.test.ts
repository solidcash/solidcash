import {
  binToHex, cashAddressToLockingBytecode, decodeAuthenticationInstructions, decodeTransactionUnsafe,
  encodeAuthenticationInstructions, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileString as compileProduction } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, RawCallCalleeRequiredError } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { StatefulContract, getContractFactory, registerDeployment } from '../../src/stateful/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, getSigners, setupStatefulUtxos } from '../test-util.js';

// A raw call whose payload has bytes must co-spend its target, so the call it names runs. Its witness used to admit
// a master index of -1 (no callee) and a negative return coordinate that answers `(true, "")` for any target, so a
// spender could claim a SafeERC20 token transfer succeeded while no token was spent. Only an empty payload, a plain
// send, may name no callee: its target can be a wallet, where the EVM runs no code.

const EVM_OPTIONS = { evmCompat: true, forceStateful: true } as const;

/** A token whose transfer records the amount it moved and answers `true`. */
const TOKEN = `pragma solidcash >=0.8.0;
contract Token {
  bigint moved;
  function transfer(address, uint amount) external returns (bool) {
    this.moved = amount;
    return true;
  }
}`;

/** SafeERC20's call: a transfer payload, then `require(success && (data.length == 0 || abi.decode(data, (bool))))`. */
const ENCODED_PAYER = `pragma solidcash >=0.8.0;
contract EncodedPayer {
  bigint paid;
  function payOut(address token, uint amount) external {
    (bool success, bytes data) = token.call(abi.encodeWithSelector(0xa9059cbb, address(this), amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
    this.paid = amount;
  }
}`;

/** The same check over call data the caller is handed as bytes, which the covenant reads where the call is made. */
const BYTES_PAYER = `pragma solidcash >=0.8.0;
contract BytesPayer {
  bigint paid;
  function payData(address token, bytes payload) external {
    (bool success, bytes data) = token.call(payload);
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
    this.paid = 1;
  }
}`;

/** A plain BCH send through `call{value:}("")`, as NoCodeLowLevelCall compiles it. */
const SENDER = `pragma solidity ^0.8.0;
contract Sender {
  uint256 public sends;
  function pay(address payable to, uint256 amount) public {
    (bool ok, bytes memory data) = to.call{value: amount}("");
    require(ok && data.length == 0);
    sends = sends + 1;
  }
}`;

const MASTER_INDEX = /^__internal__extcallMasterIdx\d+$/;
const RETURN_COORDINATE = /^__internal__externalReturnOutputIdx\d*$/;
const OP_0 = 0x00;
const OP_1NEGATE = 0x4f;
/** A wallet's lock: its coin stands at the token's input in a spend that does not co-spend the token. */
const WALLET = hexToBin(`76a914${'22'.repeat(20)}88ac`);
/** Transfer call data handed over as bytes: the selector, a recipient word and an amount word. */
const PAYLOAD = hexToBin(`a9059cbb${'00'.repeat(63)}05`);

/** A real node's 2026 VM: the standard instruction set under BCH's own size limits. */
const productionVm = createVirtualMachineBch2026ForProvider(new MockNetworkProvider({ profile: 'production' }));
type Program = Parameters<typeof productionVm.evaluate>[0];
type Spend = Program['transaction'];
type Coins = Program['sourceOutputs'];

/** Whether input 0, the caller, accepts its unlocking in `transaction` on the production VM. */
const callerAccepts = (transaction: Spend, sourceOutputs: Coins): true | string => productionVm.stateSuccess(
  productionVm.evaluate({ inputIndex: 0, sourceOutputs, transaction }),
);

type Provider = ReturnType<typeof createTestProvider>;
type Deployed = { contract: any; address: Uint8Array };

const deploy = async (provider: Provider, artifact: Artifact): Promise<Deployed> => {
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const address = hexToBin(base.withCategory(hexToBin(setup.categoryId)).lockingBytecode);
  const contract = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
  registerDeployment(provider, {
    contractName: artifact.contractName, address: contract.target, lockingBytecode: binToHex(address), contract,
  });
  return { contract, address };
};

/** The number an unlocking push carries. */
function pushedNumber(instruction: { opcode: number; data?: Uint8Array }): bigint {
  if (instruction.opcode === OP_0) return 0n;
  if (instruction.opcode === OP_1NEGATE) return -1n;
  if (instruction.opcode >= 0x51 && instruction.opcode <= 0x60) return BigInt(instruction.opcode - 0x50);
  const value = vmNumberToBigInt(instruction.data ?? new Uint8Array());
  if (typeof value === 'string') throw new Error(value);
  return value;
}

/**
 * Where an argument of `entry` sits among input 0's unlocking pushes: the SDK pushes the arguments last to first, then
 * the redeem script, so argument i is the push i + 2 from the end.
 */
function argumentPush(artifact: Artifact, entry: string, name: RegExp, pushes: number): number {
  const index = artifact.abi.find((fn) => fn.name === entry)!.inputs.findIndex((input) => name.test(input.name));
  expect(index).toBeGreaterThanOrEqual(0);
  return pushes - 2 - index;
}

/** `transaction` with input 0's unlocking pushes at the given positions replaced by one-opcode pushes. */
function restate(transaction: Spend, edits: ReadonlyArray<readonly [number, number]>): Spend {
  const copy = structuredClone(transaction);
  const instructions = decodeAuthenticationInstructions(copy.inputs[0].unlockingBytecode);
  for (const [position, opcode] of edits) instructions[position] = { opcode };
  copy.inputs[0].unlockingBytecode = encodeAuthenticationInstructions(instructions);
  return copy;
}

/**
 * The honest spend of `call`, its token co-spent, with the pushes of the call's master index and return coordinate.
 * The honest witness must name the token's master and a call record, so the positions are the call's own.
 */
async function honestSpend(call: any, artifact: Artifact, entry: string, token: Deployed): Promise<{
  transaction: Spend; sourceOutputs: Coins; withoutToken: Coins; master: number; coordinate: number;
}> {
  const builder = await call.build();
  const transaction: Spend = builder.buildLibauthTransaction();
  const sourceOutputs: Coins = generateLibauthSourceOutputs(builder.inputs);
  const pushes = decodeAuthenticationInstructions(transaction.inputs[0].unlockingBytecode);
  const master = argumentPush(artifact, entry, MASTER_INDEX, pushes.length);
  const coordinate = argumentPush(artifact, entry, RETURN_COORDINATE, pushes.length);
  const tokenInput = sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(token.address));
  expect(tokenInput).toBeGreaterThan(0);
  expect(pushedNumber(pushes[master])).toBe(BigInt(tokenInput));
  expect(transaction.outputs[Number(pushedNumber(pushes[coordinate]))]?.token?.nft).toBeDefined();
  // The token is not spent: a wallet's coin stands at its input.
  const withoutToken = sourceOutputs.map((output, index) => (index === tokenInput
    ? { lockingBytecode: WALLET, valueSatoshis: output.valueSatoshis } : output));
  return { transaction, sourceOutputs, withoutToken, master, coordinate };
}

function lockOf(address: string): string {
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return binToHex(decoded.bytecode);
}

describe('a raw call whose payload has bytes runs on its co-spent target', () => {
  const tokenArtifact = compileString(TOKEN, EVM_OPTIONS);
  const encodedArtifact = compileString(ENCODED_PAYER, EVM_OPTIONS);
  const bytesArtifact = compileString(BYTES_PAYER, EVM_OPTIONS);

  it('settles the SafeERC20 call with the token co-spent, which moves the token', async () => {
    const provider = createTestProvider();
    const token = await deploy(provider, tokenArtifact);
    const payer = await deploy(provider, encodedArtifact);

    await payer.contract.payOut(token.address, 5n)
      .withExternalCall(token.contract, 'transfer', [payer.address, 5n]).send();

    expect((await token.contract.getState()).moved).toBe(5n);
    expect((await payer.contract.getState()).paid).toBe(5n);
  });

  it('refuses the SafeERC20 call claiming (true, "") with no token spent, on the production VM', async () => {
    const provider = createTestProvider();
    const token = await deploy(provider, tokenArtifact);
    const payer = await deploy(provider, encodedArtifact);
    const spend = await honestSpend(payer.contract.payOut(token.address, 5n)
      .withExternalCall(token.contract, 'transfer', [payer.address, 5n]), encodedArtifact, 'payOut', token);
    expect(callerAccepts(spend.transaction, spend.sourceOutputs)).toBe(true);

    // No callee (master index -1) and the void answer (return coordinate -1): `(true, "")` from a token never spent.
    const claim = restate(spend.transaction, [[spend.master, OP_1NEGATE], [spend.coordinate, OP_1NEGATE]]);
    expect(callerAccepts(claim, spend.withoutToken)).not.toBe(true);
  });

  it('refuses the claim for call data handed over as bytes, and admits it for an empty payload alone', async () => {
    const provider = createTestProvider();
    const token = await deploy(provider, tokenArtifact);
    const payer = await deploy(provider, bytesArtifact);
    const spend = await honestSpend(payer.contract.payData(token.address, PAYLOAD)
      .withExternalCall(token.contract, 'transfer', [payer.address, 5n]), bytesArtifact, 'payData', token);
    expect(callerAccepts(spend.transaction, spend.sourceOutputs)).toBe(true);
    const pushes = decodeAuthenticationInstructions(spend.transaction.inputs[0].unlockingBytecode);
    const payload = argumentPush(bytesArtifact, 'payData', /^payload$/, pushes.length);
    expect((pushes[payload] as { data?: Uint8Array }).data).toEqual(PAYLOAD);

    const noCallee = [[spend.master, OP_1NEGATE], [spend.coordinate, OP_1NEGATE]] as const;
    expect(callerAccepts(restate(spend.transaction, noCallee), spend.withoutToken)).not.toBe(true);
    // The same spend with the payload emptied is a plain send, which may name no callee: the payload alone decides.
    const emptied = [...noCallee, [payload, OP_0] as const];
    expect(callerAccepts(restate(spend.transaction, emptied), spend.withoutToken)).toBe(true);
  });

  it('refuses before building a call with a payload to a wallet or to address(0), where no contract runs it', async () => {
    const provider = createTestProvider();
    const payer = await deploy(provider, encodedArtifact);
    for (const target of [WALLET, new Uint8Array()]) {
      const sent = payer.contract.payOut(target, 5n).send();
      await expect(sent).rejects.toThrow(RawCallCalleeRequiredError);
      await expect(sent).rejects.toThrow(/no contract deployment is at the target/);
    }
  });
});

describe('an empty payload is a plain send', () => {
  const senderArtifact = compileProduction(SENDER, { evmCompat: true, forceStateful: true, enforceFinalRequire: false });

  it('pays a P2PKH wallet from a value call, with no callee co-spent', async () => {
    const provider = createTestProvider();
    const [owner, payee] = await getSigners(2, { provider, fundingUtxos: 8 });
    const sender: any = await getContractFactory(senderArtifact, owner).deploy({ initialBalance: 30_000n });

    const tx = await sender.pay(payee.getAddress(), 2_000n).send();

    const paid = decodeTransactionUnsafe(hexToBin(tx.hex)).outputs.some((output) => output.valueSatoshis === 2_000n
      && binToHex(output.lockingBytecode) === lockOf(payee.getAddress()));
    expect(paid).toBe(true);
    expect((await sender.getState()).sends).toBe(1n);
  });
});
