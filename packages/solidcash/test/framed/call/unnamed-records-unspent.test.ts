import { beforeEach, describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate, Signer } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { registerDeployment } from '../../../src/stateful/deployment-registry.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { aliceAddress, alicePkh, alicePriv, bobPkh, bobPriv, carolPkh } from '../../fixture/vars.js';

/**
 * A compiled batch counts every data record ahead of its groups, and its code only steps over the ones its entry does
 * not name. A frame that fills those slots with a node it spends anyway leaves the data records out of the transaction,
 * so a `transfer` no longer waits on another transfer of the token over a record neither reads. The frames here run
 * through the shipped call path on the mock chain, whose covenants, masters and validator are the shipped programs, so
 * an accepted frame is one the covenants accept.
 *
 * A frame keeps spending the record where its code addresses something past its first declaration, or where it has
 * more than one segment: those cases are here too, so a stand-in is known to reach no frame it cannot serve.
 */

const SOURCE = `pragma solidity ^0.8.0;
interface IToken {
  function transfer(address to, uint256 value) external returns (bool);
  function transferFrom(address from, address to, uint256 value) external returns (bool);
}
interface IHook { function hook() external; }
contract Token {
  uint256 public totalSupply;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  function mint(address to, uint256 value) external { totalSupply += value; balanceOf[to] += value; }
  function approve(address spender, uint256 value) external returns (bool) {
    allowance[msg.sender][spender] = value; return true;
  }
  function transfer(address to, uint256 value) external returns (bool) {
    balanceOf[msg.sender] -= value; balanceOf[to] += value; return true;
  }
  function transferFrom(address from, address to, uint256 value) external returns (bool) {
    allowance[from][msg.sender] -= value; balanceOf[from] -= value; balanceOf[to] += value; return true;
  }
  function transferWithin(address to, uint256 value) external returns (bool) {
    require(allowance[msg.sender][to] >= value, "allowance");
    balanceOf[msg.sender] -= value; balanceOf[to] += value; return true;
  }
  function transferThenHook(address to, uint256 value) external returns (bool) {
    balanceOf[msg.sender] -= value; balanceOf[to] += value; IHook(to).hook(); return true;
  }
}
contract Hook {
  uint256 public hits;
  function hook() external { hits += 1; }
}
contract Wrapped {
  string public name = "Wrapped";
  uint256 public totalSupply;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  event Transfer(address indexed src, address indexed dst, uint256 wad);
  function mint(address to, uint256 wad) external { balanceOf[to] += wad; totalSupply += wad; }
  function approve(address guy, uint256 wad) public returns (bool) { allowance[msg.sender][guy] = wad; return true; }
  function transfer(address dst, uint256 wad) public returns (bool) { return transferFrom(msg.sender, dst, wad); }
  function transferFrom(address src, address dst, uint256 wad) public returns (bool) {
    require(balanceOf[src] >= wad, "balance");
    if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
      require(allowance[src][msg.sender] >= wad, "allowance");
      allowance[src][msg.sender] -= wad;
    }
    balanceOf[src] -= wad;
    balanceOf[dst] += wad;
    emit Transfer(src, dst, wad);
    return true;
  }
}
contract Ledger {
  address public first;
  address public second;
  address public third;
  uint256 public limit;
  mapping(address => uint256) public balanceOf;
  constructor(address a) { first = a; second = a; third = a; limit = 100; }
  function credit(address to, uint256 value) external { balanceOf[to] += value; }
  function creditWithin(address to, uint256 value) external { require(value <= limit, "limit"); balanceOf[to] += value; }
}
contract Payer {
  uint256 public unused;
  function payTwice(address token, address to, uint256 a, uint256 b) external {
    IToken(token).transfer(to, a);
    IToken(token).transfer(to, b);
  }
  function passOn(address token, address from, address to, uint256 value) external {
    IToken(token).transferFrom(from, address(this), value);
    IToken(token).transfer(to, value);
  }
}`;

const OPTIONS = {
  composition: 'framed', evmCompat: true, addressForm: 'bytecode', forceStateful: true, tagSingletonDataNfts: true,
  commitmentLimit: 128, suppressWarnings: true, split: 'func',
} as const;
const compiled = (name: string): FunctionSplitBundle =>
  compileStringSplit(SOURCE, { ...OPTIONS, primaryContractName: name } as never) as FunctionSplitBundle;
const TOKEN = compiled('Token');
const HOOK = compiled('Hook');
const WRAPPED = compiled('Wrapped');
const LEDGER = compiled('Ledger');
const PAYER = compiled('Payer');
const VALIDATOR = framedValidator.buildValidatorProgram();
/** Mainnet's limits, its hash allowance in the whole units the mock takes. */
const CHAIN_LIMITS = {
  maximumInputBytes: 10_000, maximumStackItemBytes: 10_000, maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128, operationCostBudgetPerByte: 800, hashDigestIterationsPerByte: 1,
};

const ALICE = encodeLockingBytecodeP2pkh(alicePkh);
const BOB = encodeLockingBytecodeP2pkh(bobPkh);
const CAROL = encodeLockingBytecodeP2pkh(carolPkh);
const STRANGER = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x5e));
const HELD = 1_000n;

type Call = ((...args: unknown[]) => Promise<unknown>) & Record<string, never>;
interface Deployed {
  readonly categoryId: string;
  readonly lock: Uint8Array;
  readonly bundle: FunctionSplitBundle;
  connect(signer: Signer): Record<string, Call>;
}
interface Chain {
  readonly provider: MockNetworkProvider;
  readonly alice: Signer;
  readonly bob: Signer;
  readonly token: Deployed;
  readonly hook: Deployed;
  readonly wrapped: Deployed;
  readonly ledger: Deployed;
  readonly payer: Deployed;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Chain> | undefined;

async function deployed(): Promise<Chain> {
  run ??= (async (): Promise<Chain> => {
    const provider = new MockNetworkProvider({ consensusLimits: CHAIN_LIMITS });
    const alice = new Signer(alicePriv, provider);
    const bob = new Signer(bobPriv, provider);
    let serial = 0xb000;
    const coin = (satoshis: bigint): Utxo => {
      serial += 1;
      return { txid: serial.toString(16).padStart(64, '0'), vout: 0, satoshis };
    };
    for (let at = 0; at < 40; at += 1) {
      await provider.addUtxo(binToHex(ALICE), coin(3_000_000n));
      await provider.addUtxo(binToHex(BOB), coin(3_000_000n));
    }
    const deploy = async (bundle: FunctionSplitBundle, args: readonly unknown[] = []): Promise<Deployed> => {
      const fundingUtxo = coin(30_000_000n);
      await provider.addUtxo(binToHex(ALICE), fundingUtxo);
      const { categoryId, contract } = await deployStatefulContract(bundle.logical, args as never, {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
        functionSplit: bundle,
      } as never);
      const lock = validatorAddress(hexToBin(categoryId), VALIDATOR);
      registerDeployment(provider, {
        contractName: bundle.logical.contractName, address: binToHex(lock), lockingBytecode: binToHex(lock),
        contract: { inner: { artifact: bundle.logical }, categoryId },
      } as never);
      return {
        categoryId, lock, bundle,
        connect: (signer) => (contract as unknown as { connect(s: Signer): Record<string, Call> }).connect(signer),
      };
    };
    const token = await deploy(TOKEN);
    const hook = await deploy(HOOK);
    const wrapped = await deploy(WRAPPED);
    const ledger = await deploy(LEDGER, [ALICE]);
    const payer = await deploy(PAYER);
    const minter = token.connect(alice);
    await minter.mint!(ALICE, HELD);
    await minter.mint!(BOB, HELD);
    await minter.mint!(CAROL, HELD);
    await minter.mint!(payer.lock, HELD);
    await wrapped.connect(alice).mint!(ALICE, HELD);
    await wrapped.connect(alice).mint!(CAROL, HELD);
    return {
      provider, alice, bob, token, hook, wrapped, ledger, payer, snapshot: await provider.takeSnapshot(),
    };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

/** The outpoint of each data record of a deployment, as the chain holds it now. */
async function records(chain: Chain, target: Deployed): Promise<readonly string[]> {
  const live = await readFramedDeployment(chain.provider, target.categoryId, target.bundle.logical.stateLayout!);
  return live.records.map((utxo) => `${utxo.txid}:${utxo.vout}`);
}

const balanceOf = (chain: Chain, target: Deployed, who: Uint8Array): Promise<unknown> =>
  target.connect(chain.alice).balanceOf!(who);

describe('a frame whose batch only counts a data record', () => {
  beforeEach(async () => {
    await deployed();
  }, 600_000);

  it('leaves it unspent in a transfer that updates both balances', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.token);
    await chain.token.connect(chain.alice).transfer!(CAROL, 7n);
    expect(await records(chain, chain.token)).toStrictEqual(before);
    expect(await balanceOf(chain, chain.token, ALICE)).toBe(HELD - 7n);
    expect(await balanceOf(chain, chain.token, CAROL)).toBe(HELD + 7n);
  }, 120_000);

  it('leaves it unspent in a transfer that creates the recipient\'s node', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.token);
    await chain.token.connect(chain.alice).transfer!(STRANGER, 7n);
    expect(await records(chain, chain.token)).toStrictEqual(before);
    expect(await balanceOf(chain, chain.token, STRANGER)).toBe(7n);
  }, 120_000);

  it('leaves it unspent when a transfer empties the sender', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.token);
    await chain.token.connect(chain.alice).transfer!(CAROL, HELD);
    expect(await balanceOf(chain, chain.token, ALICE)).toBe(0n);
    expect(await records(chain, chain.token)).toStrictEqual(before);
  }, 120_000);

  it('leaves it unspent in a first and a later approval, and in the transferFrom they allow', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.token);
    const alice = chain.token.connect(chain.alice);
    await alice.approve!(BOB, 5n);
    await alice.approve!(BOB, 9n);
    await chain.token.connect(chain.bob).transferFrom!(ALICE, CAROL, 4n);
    expect(await records(chain, chain.token)).toStrictEqual(before);
    expect(await chain.token.connect(chain.alice).allowance!(ALICE, BOB)).toBe(5n);
    expect(await balanceOf(chain, chain.token, CAROL)).toBe(HELD + 4n);
  }, 120_000);

  it('leaves it unspent beside a write its body may skip, taken or not', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.wrapped);
    const alice = chain.wrapped.connect(chain.alice);
    await alice.transfer!(CAROL, 3n);
    await alice.transferFrom!(ALICE, CAROL, 4n);
    await alice.approve!(BOB, 5n);
    await chain.wrapped.connect(chain.bob).transferFrom!(ALICE, CAROL, 5n);
    expect(await records(chain, chain.wrapped)).toStrictEqual(before);
    expect(await balanceOf(chain, chain.wrapped, CAROL)).toBe(HELD + 12n);
    expect(await alice.allowance!(ALICE, BOB)).toBe(0n);
  }, 120_000);

  it('leaves every record unspent on a contract that keeps several', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.ledger);
    expect(before.length).toBeGreaterThan(1);
    await chain.ledger.connect(chain.alice).credit!(CAROL, 7n);
    expect(await records(chain, chain.ledger)).toStrictEqual(before);
    expect(await balanceOf(chain, chain.ledger, CAROL)).toBe(7n);
  }, 120_000);

  it('spends only the record an entry names, of several', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.ledger);
    await chain.ledger.connect(chain.alice).creditWithin!(CAROL, 7n);
    const after = await records(chain, chain.ledger);
    expect(after.filter((outpoint) => before.includes(outpoint))).toHaveLength(before.length - 1);
    await expect(chain.ledger.connect(chain.alice).creditWithin!(CAROL, 101n)).rejects.toThrow(/limit/);
  }, 120_000);

  it('leaves it unspent in frames a call enters, the later starting from the node the earlier left', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.token);
    await chain.payer.connect(chain.alice).payTwice!(chain.token.lock, CAROL, 3n, 4n);
    expect(await records(chain, chain.token)).toStrictEqual(before);
    expect(await balanceOf(chain, chain.token, chain.payer.lock)).toBe(HELD - 7n);
    expect(await balanceOf(chain, chain.token, CAROL)).toBe(HELD + 7n);
  }, 120_000);

  it('holds when a frame declares in the slot a node an earlier frame of the call created', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.token);
    await chain.token.connect(chain.alice).approve!(chain.payer.lock, 5n);
    // The payer holds a node of its own, so empty it first: the pull then writes it and the push writes it again.
    await chain.payer.connect(chain.alice).payTwice!(chain.token.lock, CAROL, HELD, 0n);
    await chain.payer.connect(chain.alice).passOn!(chain.token.lock, ALICE, STRANGER, 5n);
    expect(await records(chain, chain.token)).toStrictEqual(before);
    expect(await balanceOf(chain, chain.token, STRANGER)).toBe(5n);
    expect(await balanceOf(chain, chain.token, chain.payer.lock)).toBe(0n);
  }, 120_000);
});

describe('a frame that keeps spending the record', () => {
  beforeEach(async () => {
    await deployed();
  }, 600_000);

  it('reads a key beside its batch, which its code finds past its first declaration', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.token);
    const alice = chain.token.connect(chain.alice);
    await alice.approve!(CAROL, 7n);
    await alice.transferWithin!(CAROL, 7n);
    expect(await records(chain, chain.token)).not.toStrictEqual(before);
    expect(await balanceOf(chain, chain.token, CAROL)).toBe(HELD + 7n);
  }, 120_000);

  it('makes a call, so it holds more than one segment', async () => {
    const chain = await deployed();
    const before = await records(chain, chain.token);
    await chain.token.connect(chain.alice).transferThenHook!(chain.hook.lock, 7n);
    expect(await records(chain, chain.token)).not.toStrictEqual(before);
    expect(await chain.hook.connect(chain.alice).hits!()).toBe(1n);
  }, 120_000);
});
