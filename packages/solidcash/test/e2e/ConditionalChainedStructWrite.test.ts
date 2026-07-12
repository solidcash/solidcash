import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider, RegtestNetworkProvider,
  StatefulContract, SignatureTemplate,
  getDataNftAddress, getEntryNftAddress,
  type ConnectedStatefulContract,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  buildEntryCommitment,
  parseEntryCommitment,
  type StateLayout,
} from '@solidcash/utils';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';

type TestProvider = MockNetworkProvider | RegtestNetworkProvider;

interface EntrySpec { collection: string; commitment: string; }

async function setupWithEntries(
  provider: TestProvider, contract: Contract, stateLayout: StateLayout,
  initialState: Record<string, any>, entries: EntrySpec[],
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
      ...entries.map((e) => ({
        address: getEntryNftAddress(salted, cat, e.collection), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: e.commitment } },
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
}
`;

describe('Conditional chained struct-entry write (chainInPlace)', () => {
  const artifact = compileString(SOURCE);
  const stateLayout = artifact.stateLayout!;
  const structs = stateLayout.structs!;
  const sig = new SignatureTemplate(alicePriv);

  const initial = { balance: 100n, count: 5n };
  const existingEntryCommitment = (): string => buildEntryCommitment(
    alicePkh, 'bytes20', initial, 'Acc', structs,
  );

  const runAdjust = async (bump: boolean): Promise<{ balance: bigint; count: bigint }> => {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupWithEntries(
      provider, contract, stateLayout, {},
      [{ collection: 'accounts', commitment: existingEntryCommitment() }],
    );
    const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);

    const tx = await sc.adjust(alicePkh, 777n, bump, 9n, alicePub, sig).send();
    expect(tx.txid).toBeDefined();

    const entryOutput = [...getTxOutputs(tx)].reverse().find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId,
    );
    expect(entryOutput).toBeDefined();
    const parsed = parseEntryCommitment(
      entryOutput!.token!.nft!.commitment, 'bytes20', 'Acc', structs,
    );
    expect(parsed.key).toEqual(alicePkh);
    const val = parsed.value as Record<string, bigint>;
    return { balance: val.balance, count: val.count };
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
  function f(bytes20 key, bigint delta, bool c, bigint bonus, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.accounts[key].balance = this.accounts[key].balance + delta;
    ${inBranch ? 'if (c) { this.accounts[key].balance = this.accounts[key].balance + bonus; }'
    : 'this.accounts[key].balance = this.accounts[key].balance + bonus;'}
  } }`;
  const run = async (inBranch: boolean): Promise<bigint> => {
    const artifact = compileString(mk(inBranch));
    const sl = artifact.stateLayout!; const st = sl.structs!;
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupWithEntries(provider, contract, sl, {},
      [{ collection: 'accounts', commitment: buildEntryCommitment(alicePkh, 'bytes20', { balance: 100n, count: 5n }, 'Acc', st) }]);
    const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.f(alicePkh, 10n, true, 3n, alicePub, new SignatureTemplate(alicePriv)).send();
    const out = [...getTxOutputs(tx)].reverse().find((o) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId);
    return (parseEntryCommitment(out!.token!.nft!.commitment, 'bytes20', 'Acc', st).value as Record<string, bigint>).balance;
  };
  it('the branch path matches the flat path (no divergence introduced by the fix)', async () => {
    const flat = await run(false);
    const branch = await run(true);
    expect(branch).toBe(flat);
  });
});
