import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, RawCallCalleeRequiredError } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { StatefulContract, registerDeployment } from '../../src/stateful/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A raw call whose payload names a function that declares a result reads its co-spent callee's record: it has no
// record-less answer, so a token's `false` cannot be hidden behind the `(true, "")` of a function that returns
// nothing. A selector spelled as a signature string names no declaration and keeps that answer. A plain send that
// co-spends no callee answers `(true, "")` only: on the EVM a call to an account with no code succeeds.

const EVM_OPTIONS = { evmCompat: true, forceStateful: true } as const;

/** A token whose transfer records the amount and answers `true`. */
const TRUE_TOKEN = `pragma solidcash >=0.8.0;
contract TrueToken {
  bigint moved;
  function transfer(address, uint amount) external returns (bool) {
    this.moved = amount;
    return true;
  }
}`;

/** A token whose transfer moves nothing and answers `false`, as some ERC-20 tokens do rather than revert. */
const FALSE_TOKEN = `pragma solidcash >=0.8.0;
contract FalseToken {
  bigint touched;
  function transfer(address, uint amount) external returns (bool) {
    this.touched = amount;
    return false;
  }
}`;

/** SafeERC20's call with an `abi.encodeCall` payload, which names IToken.transfer and its `bool` result. */
const TYPED_PAYER = `pragma solidcash >=0.8.0;
interface IToken { function transfer(address to, uint amount) external returns (bool); }
contract TypedPayer {
  bigint paid;
  function payOut(address token, uint amount) external {
    (bool success, bytes data) = token.call(abi.encodeCall(IToken.transfer, (address(this), amount)));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
    this.paid = amount;
  }
}`;

/** The same call with the selector spelled as a signature string, which names no declaration. */
const SIGNATURE_PAYER = `pragma solidcash >=0.8.0;
contract SignaturePayer {
  bigint paid;
  function payOut(address token, uint amount) external {
    (bool success, bytes data) = token.call(abi.encodeWithSignature("transfer(address,uint256)", address(this), amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'PAY_FAILED');
    this.paid = amount;
  }
}`;

/** A call that accepts either answer of a call with no callee, so only the covenant tells them apart. */
const EITHER_SENDER = `pragma solidcash >=0.8.0;
contract EitherSender {
  bigint sends;
  function ping(address to, bytes payload) external {
    (bool success, bytes data) = to.call(payload);
    require(success || data.length == 0, 'PING_FAILED');
    this.sends = this.sends + 1;
  }
}`;

/** A plain send through an option-free call with a `""` payload. */
const PLAIN_SENDER = `pragma solidcash >=0.8.0;
contract PlainSender {
  bigint sends;
  function ping(address to) external {
    (bool success, bytes data) = to.call("");
    require(success && data.length == 0, 'PING_FAILED');
    this.sends = this.sends + 1;
  }
}`;

const MASTER_INDEX = /^__internal__extcallMasterIdx\d+$/;
const RETURN_COORDINATE = /^__internal__externalReturnOutputIdx\d*$/;
const OP_0 = 0x00;
const OP_1NEGATE = 0x4f;
/** A wallet's lock: a plain send's target, and the coin that stands at the token's input in a spend without it. */
const WALLET = hexToBin(`76a914${'22'.repeat(20)}88ac`);
/** Transfer call data handed over as bytes. */
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

/** `transaction` with input 0's unlocking pushes at the given positions replaced: an opcode, or a data push. */
function restate(transaction: Spend, edits: ReadonlyArray<readonly [number, number | Uint8Array]>): Spend {
  const copy = structuredClone(transaction);
  const instructions = decodeAuthenticationInstructions(copy.inputs[0].unlockingBytecode);
  for (const [position, push] of edits) {
    instructions[position] = typeof push === 'number' ? { opcode: push } : { opcode: push.length, data: push };
  }
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
  const withoutToken = sourceOutputs.map((output, index) => (index === tokenInput
    ? { lockingBytecode: WALLET, valueSatoshis: output.valueSatoshis } : output));
  return { transaction, sourceOutputs, withoutToken, master, coordinate };
}

describe('a raw call whose payload names a function that declares a result reads its record', () => {
  const trueArtifact = compileString(TRUE_TOKEN, EVM_OPTIONS);
  const falseArtifact = compileString(FALSE_TOKEN, EVM_OPTIONS);
  const typedArtifact = compileString(TYPED_PAYER, EVM_OPTIONS);
  const signatureArtifact = compileString(SIGNATURE_PAYER, EVM_OPTIONS);

  it('publishes the read for the typed payload and not for the signature string', () => {
    const call = (artifact: Artifact): Record<string, unknown> => artifact.abi
      .find((fn) => fn.name === 'payOut')!.externalCalls![0] as unknown as Record<string, unknown>;
    expect(call(typedArtifact).rawReadsRecord).toBe(true);
    expect(call(signatureArtifact).rawReadsRecord).toBeUndefined();
  });

  it('reverts the SafeERC20 call when the token answers false, as SafeERC20 does', async () => {
    const provider = createTestProvider();
    const token = await deploy(provider, falseArtifact);
    const payer = await deploy(provider, typedArtifact);

    await expect(payer.contract.payOut(token.address, 5n)
      .withExternalCall(token.contract, 'transfer', [payer.address, 5n]).send()).rejects.toThrow(/PAY_FAILED/);
  });

  it('refuses the spend that answers the co-spent token with no record, on the production VM', async () => {
    const provider = createTestProvider();
    const token = await deploy(provider, trueArtifact);
    const payer = await deploy(provider, typedArtifact);
    const spend = await honestSpend(payer.contract.payOut(token.address, 5n)
      .withExternalCall(token.contract, 'transfer', [payer.address, 5n]), typedArtifact, 'payOut', token);
    expect(callerAccepts(spend.transaction, spend.sourceOutputs)).toBe(true);

    // The token runs its transfer; the spender answers for it as a function that returns nothing, `(true, "")`,
    // where its record could say `false`.
    const claim = restate(spend.transaction, [[spend.coordinate, OP_1NEGATE]]);
    expect(callerAccepts(claim, spend.sourceOutputs)).not.toBe(true);
  });

  it('admits that answer for a signature-string payload, which names no declaration', async () => {
    const provider = createTestProvider();
    const token = await deploy(provider, trueArtifact);
    const payer = await deploy(provider, signatureArtifact);
    const spend = await honestSpend(payer.contract.payOut(token.address, 5n)
      .withExternalCall(token.contract, 'transfer', [payer.address, 5n]), signatureArtifact, 'payOut', token);
    expect(callerAccepts(spend.transaction, spend.sourceOutputs)).toBe(true);

    const claim = restate(spend.transaction, [[spend.coordinate, OP_1NEGATE]]);
    expect(callerAccepts(claim, spend.sourceOutputs)).toBe(true);
  });
});

describe('a plain send that co-spends no callee answers (true, "") only', () => {
  const trueArtifact = compileString(TRUE_TOKEN, EVM_OPTIONS);
  const eitherArtifact = compileString(EITHER_SENDER, EVM_OPTIONS);
  const plainArtifact = compileString(PLAIN_SENDER, EVM_OPTIONS);

  it('refuses the (false, "") answer, which the caller would otherwise accept, on the production VM', async () => {
    const provider = createTestProvider();
    const token = await deploy(provider, trueArtifact);
    const sender = await deploy(provider, eitherArtifact);
    const spend = await honestSpend(sender.contract.ping(token.address, PAYLOAD)
      .withExternalCall(token.contract, 'transfer', [sender.address, 5n]), eitherArtifact, 'ping', token);
    expect(callerAccepts(spend.transaction, spend.sourceOutputs)).toBe(true);
    const pushes = decodeAuthenticationInstructions(spend.transaction.inputs[0].unlockingBytecode);
    const payload = argumentPush(eitherArtifact, 'ping', /^payload$/, pushes.length);
    expect((pushes[payload] as { data?: Uint8Array }).data).toEqual(PAYLOAD);

    // The payload emptied and no callee named: a plain send. Its `(true, "")` (coordinate -1) is admitted; its
    // `(false, "")` (coordinate -2) is not, though this caller's own check would pass it.
    const plainSend = [[payload, OP_0], [spend.master, OP_1NEGATE]] as const;
    const answered = (coordinate: number | Uint8Array): Spend => restate(spend.transaction,
      [...plainSend, [spend.coordinate, coordinate] as const]);
    expect(callerAccepts(answered(OP_1NEGATE), spend.withoutToken)).toBe(true);
    expect(callerAccepts(answered(Uint8Array.of(0x82)), spend.withoutToken)).not.toBe(true);
  });

  it('builds an option-free `""` send to a wallet with no callee, and refuses one to a contract', async () => {
    const provider = createTestProvider();
    const token = await deploy(provider, trueArtifact);
    const sender = await deploy(provider, plainArtifact);

    await sender.contract.ping(WALLET).send();
    expect((await sender.contract.getState()).sends).toBe(1n);

    const sent = sender.contract.ping(token.address).send();
    await expect(sent).rejects.toThrow(RawCallCalleeRequiredError);
    await expect(sent).rejects.toMatchObject({ reason: 'plain send to a contract' });
  });
});
