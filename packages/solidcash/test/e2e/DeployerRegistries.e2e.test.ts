/**
 * Part C, "registries of the user's shape, one per pool kind" (A18 (e)).
 *
 * The user's pool registries are two contracts, one per pool kind, since one function may not choose between two
 * child types (A6). Each registry's `create` runs `new` of its pool through the pool's deployer, stores `pool.category`
 * in its state and emits it in an event. The pools are reduced from `bch-next/contracts/BchPool.scash` and
 * `TokenPool.scash` to what makes their creation: the same contract parameters and pragmas, so the satoshi container is
 * single and, for the token pool, the token container too (`this.tokens[asset]`, `asset` a contract parameter); a
 * constructor that bounds the exponent and folds 64 levels of the nullifier tree through an internal pure function;
 * and functions that pay from the containers. The token pool's coin comes from `childContainers`.
 *
 * Each creation is checked with stock libauth's standard VM. A hand-built creation whose pool has no satoshi coin, or
 * whose token coin holds 546 satoshis, fails at the pool's deployer input.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin,
  lockingBytecodeToCashAddress, sha256,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getSatoshiContainerAddress, getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import { encodeEventCommitment, type Artifact } from '@solidcash/utils';
import type { Utxo } from '../../src/interfaces.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);

type Spend = { transaction: any; sourceOutputs: any[] };

/** What both pools share: the nullifier tree's start and the roots' digest, written by the constructor. */
const POOL_COMMON = `
    event Deposit(uint32 indexed leafIndex, bytes32 indexed commitment);
    event Withdraw(bytes32 indexed nullifierHash);
    uint32 constant NULLIFIER_LEVELS = 64;
    int constant FINISH_FEE = 90000;
    bytes32 constant EMPTY_ROOT = 0xd496520be32fae75d9cedda85ed239f39fb833e9866c59eac3cc561239edd729;
    bytes32 constant NOTHING = 0x0000000000000000000000000000000000000000000000000000000000000000;
    bytes32 recentRoots;
    bytes32 nullifierState;
    uint32 nextIndex;
    uint32 live;

    function hashNullifierPair(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(bytes1(0x03), left, right));
    }

    /// Hash the deposited note further up the tree; anyone may run it, and the deposit prepaid it.
    function finish() public {
        require(tx.inputs[1].lockingBytecode == workerLock, "worker");
        this.payMinerFee(FINISH_FEE);
    }`;

/** The constructor's tree, as both pools write it. */
const POOL_CONSTRUCTOR_TAIL = `
        this.recentRoots = sha256(abi.encodePacked(EMPTY_ROOT, EMPTY_ROOT, EMPTY_ROOT, EMPTY_ROOT));
        bytes32 z = NOTHING;
        for (uint32 i = 0; i < NULLIFIER_LEVELS; i = i + 1) {
            z = hashNullifierPair(z, z);
        }
        this.nullifierState = z;`;

/** BchPool's shape: a payable deposit into the single satoshi container, a withdrawal that pays from it. */
const BCH = `
pragma solidcash ^0.50.0;
pragma satoshicontainer single;
pragma tokencontainer single;
contract NotePool(uint8 exponent, bytes verifierLock, bytes workerLock) {
    int constant WITHDRAW_FEE = 41000;
    uint8 constant LEAST_EXPONENT = 6;
    uint8 constant MOST_EXPONENT = 10;
    ${POOL_COMMON}

    constructor() {
        require(within(exponent, LEAST_EXPONENT, MOST_EXPONENT + 1), "exponent");
        ${POOL_CONSTRUCTOR_TAIL}
    }

    function deposit(bytes32 commitment) public payable {
        require(msg.value == 10 ** exponent + WITHDRAW_FEE + FINISH_FEE, "value");
        require(this.activeInputIndex == 0, "master");
        this.live = this.live + 1;
        emit Deposit(this.nextIndex, commitment);
        this.nextIndex = this.nextIndex + 1;
    }

    function withdraw(address recipient, bytes32 nullifierHash) public {
        require(tx.inputs[tx.inputs.length - 1].lockingBytecode == verifierLock, "verifier");
        this.live = this.live - 1;
        emit Withdraw(nullifierHash);
        this.transfer(recipient, 10 ** exponent);
        this.payMinerFee(WITHDRAW_FEE);
    }
}

/// BchPoolDeployer's shape, storing the category it publishes.
contract BchRegistry {
    bytes32 lastPool;
    event PoolCreated(bytes32 indexed category, uint8 exponent);

    function create(uint8 exponent, bytes verifierLock, bytes workerLock) public {
        NotePool pool = new NotePool{args: (exponent, verifierLock, workerLock)}();
        lastPool = pool.category;
        emit PoolCreated(pool.category, exponent);
    }
}`;

/** TokenPool's shape: deposits and withdrawals of `asset` through the single token container. */
const TOKEN = `
pragma solidcash ^0.50.0;
pragma satoshicontainer single;
pragma tokencontainer single;
contract TokenNotePool(uint8 exponent, bytes32 asset, bytes verifierLock, bytes workerLock) {
    int constant WITHDRAW_FEE = 43000;
    int constant SEED_TOKENS = 1;
    uint8 constant MOST_EXPONENT = 12;
    ${POOL_COMMON}

    constructor() {
        require(asset != this.category, "asset-is-master");
        require(within(exponent, 0, MOST_EXPONENT + 1), "exponent");
        ${POOL_CONSTRUCTOR_TAIL}
    }

    function deposit(bytes32 commitment) public payable {
        int denomination = 10 ** exponent;
        require(msg.value == WITHDRAW_FEE + FINISH_FEE, "value");
        int reserveBefore = this.tokens[asset].tokenAmount;
        int reserveAfter = this.outState.tokens[asset].tokenAmount;
        require(reserveAfter == reserveBefore + denomination, "value");
        uint32 notes = this.live + 1;
        this.live = notes;
        require(reserveAfter >= SEED_TOKENS + notes * denomination, "reserve");
        emit Deposit(this.nextIndex, commitment);
        this.nextIndex = this.nextIndex + 1;
    }

    function withdraw(address recipient, bytes32 nullifierHash) public {
        require(tx.inputs[tx.inputs.length - 1].lockingBytecode == verifierLock, "verifier");
        this.live = this.live - 1;
        emit Withdraw(nullifierHash);
        this.tokens[asset].transfer(recipient, 10 ** exponent);
        this.payMinerFee(WITHDRAW_FEE);
    }
}

/// TokenPoolDeployer's shape, storing the category it publishes.
contract TokenRegistry {
    bytes32 lastPool;
    event PoolCreated(bytes32 indexed category, bytes32 indexed asset, uint8 exponent);

    function create(uint8 exponent, bytes32 asset, bytes verifierLock, bytes workerLock) public {
        TokenNotePool pool = new TokenNotePool{args: (exponent, asset, verifierLock, workerLock)}();
        lastPool = pool.category;
        emit PoolCreated(pool.category, asset, exponent);
    }
}`;

const VERIFIER_LOCK = hexToBin('aa20'.padEnd(68, '1') + '87');
const WORKER_LOCK = hexToBin('aa20'.padEnd(68, '2') + '87');

/** The nullifier tree's start: 64 levels of sha256(0x03 ‖ z ‖ z) over 32 zero bytes. */
const nullifierStart = (): string => {
  let z = new Uint8Array(32);
  for (let level = 0; level < 64; level += 1) z = sha256.hash(Uint8Array.from([0x03, ...z, ...z]));
  return binToHex(z);
};

interface Creation {
  provider: MockNetworkProvider;
  artifacts: Record<string, Artifact>;
  registryCategory: string;
  result: Awaited<ReturnType<typeof StatefulContract.deployFrom>>;
  creation: Spend;
}

/** Deploys `registry` from `source`, then calls its `create` with `args` through `deployFrom`. */
async function createPool(
  source: string, registry: string, pool: string, args: unknown[],
  extra: (provider: MockNetworkProvider) => Promise<Record<string, unknown>> = async () => ({}),
): Promise<Creation> {
  clearGenesisReservations();
  const provider = new MockNetworkProvider({ profile: 'production' });
  const captured: Spend[] = [];
  const send = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string) => {
    const transaction = decodeTransaction(hexToBin(hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('a spent coin is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    const txid = await send(hex);
    captured.push({ transaction, sourceOutputs });
    return txid;
  };
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const artifacts = compileStringMulti(source, { allowUnsafeOperations: true, primaryContractName: registry } as never);
  const funding: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 200_000n };
  await provider.seedUtxo(binToHex(aliceLock), funding);
  // The registry keeps its satoshi container single, as the user's does: its deployment opens it with RESERVE.
  const deployed = await StatefulContract.deploy(artifacts[registry]!, [], {
    provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { lastPool: new Uint8Array(32) },
    initialBalance: 1200n, changeAddress: change.address, senderLockingBytecode: aliceLock,
  } as never);
  const prep: Utxo = { txid: 'e2'.repeat(32), vout: 0, satoshis: 400_000n };
  await provider.seedUtxo(binToHex(aliceLock), prep);
  const result = await StatefulContract.deployFrom({
    provider, factory: deployed.contract, deployFunctionName: 'create', deployFunctionArgs: args as never,
    childArtifact: artifacts[pool]!, fundingUtxo: prep, funder: alice.unlockP2PKH(), changeAddress: change.address,
    ...await extra(provider),
  });
  return { provider, artifacts, registryCategory: deployed.categoryId, result, creation: captured[captured.length - 1]! };
}

/** The creation with output `index` changed, the wallet's inputs signed again over it. */
function withOutput(spend: Spend, index: number, change: (output: any) => void): Spend {
  const copy: Spend = structuredClone(spend);
  change(copy.transaction.outputs[index]);
  copy.transaction.inputs.forEach((_input: unknown, inputIndex: number) => {
    if (binToHex(copy.sourceOutputs[inputIndex].lockingBytecode) !== binToHex(aliceLock)) return;
    copy.transaction.inputs[inputIndex].unlockingBytecode = alice.unlockP2PKH().generateUnlockingBytecode({
      transaction: copy.transaction, sourceOutputs: copy.sourceOutputs, inputIndex,
    });
  });
  return copy;
}

const passes = (spend: Spend, inputIndex: number): boolean => vm.stateSuccess(
  vm.evaluate({ ...structuredClone(spend), inputIndex } as never),
) === true;

const outputAt = (spend: Spend, address: string): number => spend.transaction.outputs.findIndex(
  (output: any) => binToHex(output.lockingBytecode) === binToHex(addressToLockScript(address)),
);

/**
 * The registry's state and its event both name the pool's category in display order: the stored field, and the event
 * NFT, an immutable NFT of the registry's own category whose commitment is `PoolCreated(category, …rest)`.
 */
async function expectPublished(created: Creation, registry: string, rest: unknown[]): Promise<void> {
  const { result, creation } = created;
  const category = result.childCategoryId;
  expect(binToHex(((await result.factory.getState()) as { lastPool: Uint8Array }).lastPool)).toBe(category);
  const event = created.artifacts[registry]!.events!.find((entry) => entry.name === 'PoolCreated')!;
  const expected = encodeEventCommitment(event.parameters as never, [hexToBin(category), ...rest] as never);
  const nfts = creation.transaction.outputs.filter((output: any) => output.token?.nft?.capability === 'none'
    && binToHex(output.token.category) === created.registryCategory);
  expect(nfts.map((output: any) => binToHex(output.token.nft.commitment))).toEqual([binToHex(expected)]);
}

describe('Part C: registries of the user\'s shape, one per pool kind (A18 (e))', () => {
  it('a BCH registry creates a NotePool-shaped pool, stores and emits its category; without its satoshi coin the creation fails', async () => {
    const created = await createPool(BCH, 'BchRegistry', 'NotePool', [7n, VERIFIER_LOCK, WORKER_LOCK]);
    const { result, creation, artifacts } = created;
    expect(vm.verify(creation as never)).toBe(true);
    await expectPublished(created, 'BchRegistry', [7n]);
    const state = (await result.child.getState()) as { nullifierState: Uint8Array };
    expect(binToHex(state.nullifierState)).toBe(nullifierStart());

    // The pool's single satoshi coin, at its container lock, holding RESERVE.
    const satoshiCoin = outputAt(creation, getSatoshiContainerAddress(
      (result.child as any).inner ?? result.child, result.childCategoryId,
    ));
    expect(satoshiCoin).toBeGreaterThan(0);
    expect(creation.transaction.outputs[satoshiCoin].valueSatoshis).toBe(1200n);
    const deployerInput = creation.sourceOutputs.findIndex((output: any) => binToHex(output.lockingBytecode)
      === artifacts.BchRegistry!.childDeployers!.NotePool!.lockingBytecode);
    expect(deployerInput).toBeGreaterThan(0);

    // The same creation with that output paid to the wallet instead: the pool has no satoshi coin, and its deployer
    // input refuses the creation.
    const withoutCoin = withOutput(creation, satoshiCoin, (output) => { output.lockingBytecode = aliceLock; });
    expect(passes(withoutCoin, deployerInput)).toBe(false);
    expect(vm.verify(withoutCoin as never)).not.toBe(true);
  }, 600_000);

  it('a token registry creates a TokenNotePool-shaped pool with its token coin from childContainers; a 546-satoshi token coin fails', async () => {
    const asset = 'c3'.repeat(32);
    const created = await createPool(
      TOKEN, 'TokenRegistry', 'TokenNotePool', [2n, hexToBin(asset), VERIFIER_LOCK, WORKER_LOCK],
      async (provider) => {
        await provider.seedUtxo(binToHex(aliceLock), {
          txid: 'e3'.repeat(32), vout: 0, satoshis: 2000n, token: { category: asset, amount: 5n },
        });
        return { childContainers: [{ deployment: 0, tokens: [{ categoryId: asset, amount: 1n }] }] };
      },
    );
    const { result, creation, artifacts } = created;
    expect(vm.verify(creation as never)).toBe(true);
    await expectPublished(created, 'TokenRegistry', [hexToBin(asset), 2n]);
    expect(binToHex(((await result.child.getState()) as { nullifierState: Uint8Array }).nullifierState))
      .toBe(nullifierStart());

    // The pool's two coins: its satoshi coin, and its token coin with one unit and RESERVE satoshis.
    const child = (result.child as any).inner ?? result.child;
    const satoshiCoin = outputAt(creation, getSatoshiContainerAddress(child, result.childCategoryId));
    const tokenCoin = outputAt(creation, getTokenContainerAddress(child, result.childCategoryId, asset));
    expect(creation.transaction.outputs[satoshiCoin].valueSatoshis).toBe(1200n);
    expect(creation.transaction.outputs[tokenCoin].valueSatoshis).toBe(1200n);
    expect(creation.transaction.outputs[tokenCoin].token.amount).toBe(1n);
    expect(binToHex(creation.transaction.outputs[tokenCoin].token.category)).toBe(asset);
    const deployerInput = creation.sourceOutputs.findIndex((output: any) => binToHex(output.lockingBytecode)
      === artifacts.TokenRegistry!.childDeployers!.TokenNotePool!.lockingBytecode);

    // A token coin of 546 satoshis, the rest to the change: the pool's deployer input refuses it.
    const changeIndex = creation.transaction.outputs.length - 1;
    const thin = withOutput(creation, tokenCoin, (output) => { output.valueSatoshis = 546n; });
    thin.transaction.outputs[changeIndex].valueSatoshis += 1200n - 546n;
    const resigned = withOutput(thin, changeIndex, () => undefined);
    expect(passes(resigned, deployerInput)).toBe(false);
    expect(vm.verify(resigned as never)).not.toBe(true);
    // And without its satoshi coin.
    const withoutCoin = withOutput(creation, satoshiCoin, (output) => { output.lockingBytecode = aliceLock; });
    expect(passes(withoutCoin, deployerInput)).toBe(false);
  }, 600_000);
});
