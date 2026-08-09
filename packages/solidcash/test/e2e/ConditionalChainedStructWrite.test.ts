import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider, RegtestNetworkProvider,
  StatefulContract, SignatureTemplate,
  getDataNftAddress, getEntryNftAddress, headSentinelCommitment,
  type ConnectedStatefulContract,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  type StateLayout,
} from '@solidcash/utils';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

type TestProvider = MockNetworkProvider | RegtestNetworkProvider;

async function setupVMap(
  provider: TestProvider, contract: Contract, stateLayout: StateLayout,
  initialState: Record<string, any>,
): Promise<{ categoryId: string }> {
  const commitments = buildInitialStateCommitments(stateLayout, initialState);
  const { categoryId } = await provider.addTokenUtxosDynamic((cat) => {
    const salted = contract.withCategory(hexToBin(cat));
    return [
      { address: salted.tokenAddress, satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
      ...commitments.map((commitment) => ({
        address: getDataNftAddress(salted, cat), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment } },
      })),
      ...(stateLayout.collections ?? []).map((collection) => ({
        address: getEntryNftAddress(salted, cat, collection.name), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable' as const,
          commitment: binToHex(headSentinelCommitment()) } },
      })),
    ];
  });
  return { categoryId };
}

// A struct-entry field written OUTSIDE an `if`, then a DIFFERENT field of the SAME entry written INSIDE a
// conditional `if`. This exercises the `chainInPlace` codegen path (visitMappingFieldAssign): the in-branch
// write must chain from (preserve) the outside write's blob and update the entry value in place via
// emitReplace so the covenant key/value survive the branch's removeScopedVariables and the branch stays
// balanced. The two branch outcomes must produce different, correct, covenant-valid state.
const SOURCE = `
pragma solidcash >=0.8.0;

contract ConditionalChainedStructWrite() {
    struct Acc { bigint balance; bigint count; }
    mapping(bytes20 => Acc) accounts;

    function adjust(bytes20 key, bigint newBalance, bool bump, bigint newCount, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.accounts[key].balance = newBalance;
        if (bump) {
            this.accounts[key].count = newCount;
        }
    }
    function seed(bytes20 key, pubkey pk, sig s) {
        require(checkSig(s, pk)); this.accounts[key] = Acc(100, 5);
    }
    function check(bytes20 key, bigint balance, bigint count, pubkey pk, sig s) {
        require(checkSig(s, pk)); require(this.accounts[key].balance == balance && this.accounts[key].count == count);
    }
}
`;

describe('Conditional chained struct-entry write (chainInPlace)', () => {
  const artifact = compileString(SOURCE);
  const stateLayout = artifact.stateLayout!;
  const sig = new SignatureTemplate(alicePriv);

  const runAdjust = async (bump: boolean): Promise<{ balance: bigint; count: bigint }> => {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupVMap(
      provider, contract, stateLayout, {},
    );
    const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);

    await sc.seed(alicePkh, alicePub, sig).send();
    const tx = await sc.adjust(alicePkh, 777n, bump, 9n, alicePub, sig).send();
    expect(tx.txid).toBeDefined();
    const expectedCount = bump ? 9n : 5n;
    await sc.check(alicePkh, 777n, expectedCount, alicePub, sig).send();
    return { balance: 777n, count: expectedCount };
  };

  it('branch taken: chains the in-branch write onto the outside write (balance preserved, count updated)', async () => {
    // outside: balance = 777 (blob {777, 5}); in-branch: count = 9 -> {777, 9}
    const { balance, count } = await runAdjust(true);
    expect(balance).toBe(777n);
    expect(count).toBe(9n);
  });

  it('branch not taken: only the outside write applies (balance updated, count unchanged)', async () => {
    // outside: balance = 777 (blob {777, 5}); in-branch skipped -> {777, 5}
    const { balance, count } = await runAdjust(false);
    expect(balance).toBe(777n);
    expect(count).toBe(5n);
  });
});

// Consistency guard: a read-after-write of the same entry within a function reads the PENDING (just-written)
// value, Solidity-correct and matching the scalar-entry read-after-write. The flat (scopeDepth 0) and branch
// (scopeDepth>0) chaining paths must yield the SAME result - both now update the chained field in place so the
// value read sees the pending write (previously the flat path consumed it early and read the stale input).
describe('read-after-write same-entry consistency (flat vs branch)', () => {
  const mk = (inBranch: boolean): string => `
pragma solidcash >=0.8.0;
contract C() { struct Acc { bigint balance; bigint count; } mapping(bytes20 => Acc) accounts;
  function seed(bytes20 key, pubkey pk, sig s) { require(checkSig(s, pk)); accounts[key] = Acc(100, 5); }
  function f(bytes20 key, bigint delta, bool c, bigint bonus, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.accounts[key].balance = this.accounts[key].balance + delta;
    ${inBranch ? 'if (c) { this.accounts[key].balance = this.accounts[key].balance + bonus; }'
    : 'this.accounts[key].balance = this.accounts[key].balance + bonus;'}
  }
  function chk(bytes20 key, bigint expected, pubkey pk, sig s) {
    require(checkSig(s, pk)); require(accounts[key].balance == expected);
  } }`;
  const run = async (inBranch: boolean): Promise<bigint> => {
    const artifact = compileString(mk(inBranch));
    const sl = artifact.stateLayout!;
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupVMap(provider, contract, sl, {});
    const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);
    const callSig = new SignatureTemplate(alicePriv);
    await sc.seed(alicePkh, alicePub, callSig).send();
    await sc.f(alicePkh, 10n, true, 3n, alicePub, callSig).send();
    await sc.chk(alicePkh, 113n, alicePub, callSig).send();
    return 113n;
  };
  it('the branch path matches the flat path (no divergence introduced by the fix)', async () => {
    const flat = await run(false);
    const branch = await run(true);
    expect(branch).toBe(flat);
  });
});
