import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex, parsePushdataCommitment, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, sendFramedValue } from '../../../src/framed/call/index.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * S0 conformance, spec section 23 row 10: `address(this).balance` compared with 0 in `functionCallWithValue`.
 *
 * OpenZeppelin's `Address.functionCall` delegates to `functionCallWithValue(target, data, 0, msg)`, whose body
 * guards `require(address(this).balance >= value, ...)` - with value 0, a comparison of the context contract's own
 * balance with zero - before it makes the value-carrying call. The row is driven through the shipped path: the
 * shipped compiler under the framed convention, the shipped deployment, the shipped `callFramedEntry`, and the
 * shipped decoder for what the entry returns and writes.
 *
 * Two facts are pinned. The value-0 balance guard is a no-op the framed path serves: an entry that compares its
 * own balance with zero, records the branch it took, and answers the balance runs, with both the answer and the
 * branch read back through the shipped decoders. The full `functionCallWithValue` shape - that guard around a
 * value-carrying call to another contract - is refused by name: the call path plans the callee frame, and the
 * target the row names is no deployment's.
 */

/** A contract deployed through the shipped deployment, with a caller coin funded at the caller's own lock. */
interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

let nonce = 0;

function freshCoin(): { txid: string; vout: number; satoshis: bigint } {
  nonce += 1;
  return { txid: `${nonce.toString(16).padStart(2, '0')}`.repeat(32), vout: 0, satoshis: 300_000n };
}

async function deployedFor(artifact: Artifact): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = freshCoin();
  await provider.addUtxo(funder.address, { ...fundingUtxo, satoshis: 500_000n });
  await fundShippedFacets(provider);
  const deployment = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo: { ...fundingUtxo, satoshis: 500_000n },
    funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
  });
  return {
    provider, categoryId: deployment.categoryId, callerLock: encodeLockingBytecodeP2pkh(alicePkh),
    funder: signature.unlockP2PKH(),
  };
}

const SEEDED = 7_000n;

const VAULT_SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Vault {'
  + '   uint256 public branch;'
  + '   receive() external payable { require(true); }'
  + '   function guarded() public returns (uint256) {'
  + '     if (address(this).balance >= 0) { branch = 1; } else { branch = 2; }'
  + '     return address(this).balance;'
  + '   }'
  + '   function note() public { branch = branch + 1; }'
  + ' }';

const FORWARD_SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface ITarget { function ping() external; }'
  + ' contract Target { uint256 public hits; function ping() external { hits = hits + 1; } }'
  + ' contract Forwarder {'
  + '   uint256 public branch;'
  + '   function forwarded(address target) public returns (uint256) {'
  + '     require(address(this).balance >= 0, "insufficient balance for call");'
  + '     branch = 1;'
  + '     (bool ok, bytes memory data) = target.call{value: 0}(abi.encodeCall(ITarget.ping, ()));'
  + '     require(ok, "low-level call failed");'
  + '     require(data.length >= 0);'
  + '     return address(this).balance;'
  + '   }'
  + '   function note() public { branch = branch + 1; }'
  + ' }';

describe('spec section 23 row 10: address(this).balance compared with 0', () => {
  it('serves the value-0 guard: the entry answers its balance and records the branch it took', async () => {
    const vault = compileStringMulti(VAULT_SOURCE, { composition: 'framed', evmCompat: true }).Vault!;
    expect(vault.composition?.balanceReaders)
      .toStrictEqual(['Vault.guarded()']);
    const deployed = await deployedFor(vault);
    // The seed pays the contract's container through its receive(), which is the balance the guard reads.
    const seedCoin = freshCoin();
    await deployed.provider.addUtxo(binToHex(deployed.callerLock), seedCoin);
    const seeded = await sendFramedValue({
      provider: deployed.provider, artifact: vault, categoryId: deployed.categoryId, callerUtxo: seedCoin,
      callerLockingBytecode: deployed.callerLock, funder: deployed.funder, vm: compositionMachine(), value: SEEDED,
    });
    expect(seeded.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);

    const callCoin = freshCoin();
    await deployed.provider.addUtxo(binToHex(deployed.callerLock), callCoin);
    const result = await callFramedEntry({
      provider: deployed.provider, artifact: vault, categoryId: deployed.categoryId, functionName: 'guarded', args: [],
      callerUtxo: callCoin, callerLockingBytecode: deployed.callerLock, funder: deployed.funder,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    // The balance the guard read and answered, through the shipped result decoder.
    expect(result.value).toBe(SEEDED);
    // Which branch ran, decoded from the record the entry wrote.
    expect(parsePushdataCommitment(bytesToHex(result.writtenCommitments[0]!), vault.stateLayout!, 0))
      .toStrictEqual({ branch: 1n });
  }, 120_000);

  it('refuses the functionCallWithValue shape by name: its target is no deployment\'s', async () => {
    const forwarder = compileStringMulti(FORWARD_SOURCE, { composition: 'framed', evmCompat: true })
      .Forwarder!;
    // The body itself compiles: the value-0 call lowers, so the refusal is the call path's, not the compiler's.
    expect(forwarder.composition?.refusedEntries).toBeUndefined();
    const deployed = await deployedFor(forwarder);
    const coin = freshCoin();
    await deployed.provider.addUtxo(binToHex(deployed.callerLock), coin);
    await expect(callFramedEntry({
      provider: deployed.provider, artifact: forwarder, categoryId: deployed.categoryId, functionName: 'forwarded',
      args: [new Uint8Array(35).fill(0x11)] as never, callerUtxo: coin, callerLockingBytecode: deployed.callerLock,
      funder: deployed.funder, vm: compositionMachine(),
    })).rejects.toThrow(
      new RegExp('entry "forwarded" makes 1 external call\\(s\\): the call to "ITarget\\.ping" targets (11){35}, '
        + 'and none of the deployment\'s contracts sits at that address'),
    );
  }, 120_000);
});

/**
 * A kept subroutine that reads its contract's balance (spec 4b). It has no frame to read the balance from, so the
 * compiler refuses the entry and the constructor that run it by name, and the call path and the deployment answer
 * with the published reason rather than with a failed compile or an opcode.
 */
const KEPT_ENTRY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Till {'
  + '   int public seen;'
  + '   function f(int expected) { require(mine() == expected); this.seen = 1; }'
  + '   function note() { this.seen = this.seen + 1; require(true); }'
  + '   function mine() internal view returns (int) { return address(this).balance; }'
  + ' }';

const KEPT_CONSTRUCTOR_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Opening {'
  + '   int public seen;'
  + '   constructor() { this.seen = mine(); }'
  + '   function note() { this.seen = this.seen + 1; require(true); }'
  + '   function mine() internal view returns (int) { return address(this).balance; }'
  + ' }';

describe('a kept subroutine that reads its contract\'s balance', () => {
  it('refuses by name the call of an entry that runs it, and spends nothing', async () => {
    const till = compileStringMulti(KEPT_ENTRY_SOURCE, { composition: 'framed' }).Till!;
    const deployed = await deployedFor(till);
    const coin = freshCoin();
    await deployed.provider.addUtxo(binToHex(deployed.callerLock), coin);
    await expect(callFramedEntry({
      provider: deployed.provider, artifact: till, categoryId: deployed.categoryId, functionName: 'f', args: [0n],
      callerUtxo: coin, callerLockingBytecode: deployed.callerLock, funder: deployed.funder, vm: compositionMachine(),
    })).rejects.toThrow('FRAMED_HOST_ENTRY_REFUSED: Till.f() is refused by the compiler: it runs \'mine\', which '
      + 'the master cannot serve: the body reads its contract\'s balance and is invoked as its own subroutine');
    expect((await deployed.provider.getUtxosForLockingBytecode(deployed.callerLock))
      .some((utxo) => utxo.txid === coin.txid)).toBe(true);
  }, 120_000);

  it('refuses by name the deployment of a constructor that runs it', async () => {
    const opening = compileStringMulti(KEPT_CONSTRUCTOR_SOURCE, { composition: 'framed' }).Opening!;
    await expect(deployedFor(opening)).rejects.toThrow('the constructor of "Opening" is refused by the compiler '
      + '(Opening.__construct()): the constructor reads its contract\'s balance, which no genesis shows');
  }, 120_000);
});
