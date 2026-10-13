import { describe, expect, it } from 'vitest';
import {
  binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, encodeDataPush, encodeLockingBytecodeP2sh32,
  hash256, hexToBin,
} from '@bitauth/libauth';
import { ContractFactory } from '../../src/stateful/index.js';
import { encodeLogicalIdentityCommitment } from '../../src/stateful/logical-identity.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { getSigners } from '../test-util.js';

// A function that calls out co-spends its own SCID sender anchor (an immutable NFT of its category at an
// anyone-can-spend lock), which the SDK recreates at any free index, so the container scan skips that anchor.
// The skip is exact: every other own-category immutable NFT input must still reappear at its own index.
type Vm = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type VmProgram = Parameters<Vm['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;
interface Spend { transaction: VmTransaction; sourceOutputs: SourceOutputs }

const OPTIONS = { evmCompat: true, forceStateful: true, messageBus: false } as any;
const limits = { maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000, maximumNftCommitmentBytes: 128 };

const LEDGER = `
pragma solidity ^0.8.0;
contract Ledger {
  uint256 public credited;
  address public lastCaller;
  function credit(uint256 amount) external { credited = credited + amount; lastCaller = msg.sender; }
}`;

const VAULT = `
pragma solidity ^0.8.0;
interface ILedger { function credit(uint256 amount) external; }
contract Vault {
  struct Config { ILedger ledger; uint256 deposited; }
  Config public config;
  function setLedger(ILedger ledger) external { config.ledger = ledger; }
  function pull(uint256 amount) external {
    bytes memory data = abi.encodeWithSelector(ILedger.credit.selector, amount);
    (bool ok, bytes memory ret) = address(config.ledger).call{value: 0}(data);
    require(ok && ret.length >= 0);
    config.deposited = config.deposited + amount;
  }
}`;

const ANYONE_REDEEM = Uint8Array.of(0x51);
const ANYONE_LOCK = encodeLockingBytecodeP2sh32(hash256(ANYONE_REDEEM));
const DEPLOYER_LOCK = hexToBin(`76a914${'11'.repeat(20)}88ac`);
const pinned = /failed an OP_(EQUAL)?VERIFY operation/;

function lockOf(address: string): Uint8Array {
  const decoded = cashAddressToLockingBytecode(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return decoded.bytecode;
}

/** Records each submitted transaction with the outputs it spends, read before the mock confirms it. */
function recordSends(provider: MockNetworkProvider): Spend[] {
  const sent: Spend[] = [];
  const submit = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string): Promise<string> => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('a spent output is not in the mock ledger');
      return solidCashOutputToLibauthOutput({ to: spent.lockingBytecode, amount: spent.satoshis, token: spent.token });
    }));
    sent.push({ transaction, sourceOutputs });
    return submit(hex);
  };
  return sent;
}

/** `spend` plus an own-category immutable NFT input at an anyone-can-spend lock; no output keeps it at its index. */
function withOwnImmutable(spend: Spend, category: Uint8Array, commitment: Uint8Array): Spend {
  const at = spend.transaction.inputs.length;
  const outputs = [...spend.transaction.outputs];
  while (outputs.length <= at) outputs.push({ lockingBytecode: Uint8Array.of(0x6a), valueSatoshis: 0n });
  return {
    sourceOutputs: [...spend.sourceOutputs, {
      lockingBytecode: ANYONE_LOCK,
      valueSatoshis: 1_000n,
      token: { category, amount: 0n, nft: { capability: 'none', commitment } },
    }],
    transaction: {
      ...spend.transaction,
      inputs: [...spend.transaction.inputs, {
        outpointTransactionHash: new Uint8Array(32).fill(0x77),
        outpointIndex: 0,
        sequenceNumber: spend.transaction.inputs[0]!.sequenceNumber,
        unlockingBytecode: encodeDataPush(ANYONE_REDEEM),
      }],
      outputs,
    },
  };
}

/** A logical-identity anchor commitment ending in `root`, with its version byte set to `version`. */
function scid(root: Uint8Array, version = 1): Uint8Array {
  const commitment = hexToBin(encodeLogicalIdentityCommitment({
    deployerLockingBytecode: DEPLOYER_LOCK, nonce: 0n, rootLockingBytecode: root,
  }));
  commitment[4] = version;
  return commitment;
}

describe('a calling function\'s container scan admits only its exact sender anchor', () => {
  it('skips an SCID anchor ending in its own lock and pins every other own-category immutable input', async () => {
    const provider = new MockNetworkProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    const [alice, bob] = await getSigners(2, { provider, fundingUtxos: 40 });
    const ledger = await new ContractFactory(compileString(LEDGER, OPTIONS), alice).deploy();
    const vault = await new ContractFactory(compileString(VAULT, OPTIONS), alice).deploy();
    await vault.setLedger(ledger.address).send();
    const sent = recordSends(provider);
    await vault.connect(bob).pull(100n).send();

    const vaultLock = lockOf(vault.address);
    const isVaultMaster = (output: SourceOutputs[number]): boolean => output.token?.nft?.capability === 'minting'
      && binToHex(output.lockingBytecode) === binToHex(vaultLock);
    const honest = sent.find((spend) => spend.sourceOutputs.some(isVaultMaster));
    if (honest === undefined) throw new Error('the call was not recorded');
    const vaultIndex = honest.sourceOutputs.findIndex(isVaultMaster);
    const category = honest.sourceOutputs[vaultIndex]!.token!.category;
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const verdict = (spend: Spend): true | string => vm.stateSuccess(vm.evaluate({
      inputIndex: vaultIndex, sourceOutputs: spend.sourceOutputs, transaction: spend.transaction,
    }));

    expect(verdict(honest), 'honest call').toBe(true);
    expect(verdict(withOwnImmutable(honest, category, scid(vaultLock))), 'own anchor, not kept').toBe(true);
    expect(verdict(withOwnImmutable(honest, category, scid(lockOf(ledger.address)))), 'anchor of another lock')
      .toMatch(pinned);
    expect(verdict(withOwnImmutable(honest, category, scid(vaultLock, 2))), 'another SCID version').toMatch(pinned);
    expect(verdict(withOwnImmutable(honest, category, scid(vaultLock).slice(0, 39))), 'short SCID').toMatch(pinned);
    expect(verdict(withOwnImmutable(honest, category, hexToBin('cafe'))), 'plain immutable').toMatch(pinned);
  }, 180_000);
});
