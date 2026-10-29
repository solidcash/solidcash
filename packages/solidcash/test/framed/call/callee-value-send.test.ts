import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readSatoshiContainers } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A callee frame that sends value to a contract: the call into the contract's `receive()` its body makes there.
 *
 * `Router.cashOut` withdraws from `Bank`, whose `withdraw` sends the amount to its caller, the router, a contract:
 * the bank's frame calls the router's `receive()`, a further frame of the router's own contract, which takes the
 * amount in, and the router then pays the user from it in the same transaction. The bank pays from its containers
 * and keeps the change, and the router keeps nothing: its send follows the drained run's marker.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Bank { mapping(address => uint256) public balanceOf;'
  + '   function deposit() external payable { balanceOf[msg.sender] += msg.value; }'
  + '   function withdraw(uint256 wad) external {'
  + '     require(balanceOf[msg.sender] >= wad, "Bank: short");'
  + '     balanceOf[msg.sender] -= wad;'
  + '     (bool ok, ) = payable(msg.sender).call{value: wad}("");'
  + '     require(ok, "Bank: send"); } }'
  + ' contract Router { Bank public bank;'
  + '   constructor(Bank b) { bank = b; }'
  + '   receive() external payable { assert(msg.sender == address(bank)); }'
  + '   function fund() external payable { bank.deposit{value: msg.value}(); }'
  + '   function cashOut(uint256 wad, address to) external {'
  + '     bank.withdraw(wad);'
  + '     (bool ok, ) = payable(to).call{value: wad}("");'
  + '     require(ok, "Router: send"); } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** Bank and Router, the router holding the bank; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Bank: compiled.Bank!, Router: compiled.Router! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['Bank', []], ['Router', ['Bank']]] as const).entries()) {
      const fundingUtxo = { txid: `${'7d'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name]!, args.map((arg) => locks.get(arg)!), {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      categories.set(name, deployment.categoryId);
      locks.set(name, validatorAddress(hexToBin(deployment.categoryId), validatorProgram));
    }
    return { provider, artifacts, categories, snapshot: await provider.takeSnapshot() };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

let coins = 0;

/** Enters one of the router's entries with a fresh coin of the user's. */
async function enter(
  chain: Deployed, functionName: string, args: readonly (bigint | Uint8Array)[], value = 0n,
): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'7e'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Router!, categoryId: chain.categories.get('Router')!,
    functionName, args, callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
    ...(value === 0n ? {} : { value }),
  });
}

/** The satoshis a contract's containers hold. */
async function held(chain: Deployed, name: string): Promise<bigint> {
  const containers = await readSatoshiContainers(chain.provider, chain.categories.get(name)!);
  return containers.reduce((sum, utxo) => sum + utxo.satoshis, 0n);
}

describe('a callee frame that sends value to a contract', () => {
  it('runs the router\'s receive() from the bank\'s send and pays the user from what it brought in', async () => {
    const chain = await deployed();
    const funded = await enter(chain, 'fund', [], 50_000n);
    expect(funded.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(await held(chain, 'Bank')).toBe(50_000n);

    const payee = encodeLockingBytecodeP2pkh(bobPkh);
    const result = await enter(chain, 'cashOut', [20_000n, payee]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName)).toContain('Router.__receive()');
    const paid = (result.broadcast?.outputs ?? [])
      .filter((output) => binToHex(output.lockingBytecode) === binToHex(payee))
      .reduce((sum, output) => sum + output.valueSatoshis, 0n);
    expect(paid).toBe(20_000n);
    expect(await held(chain, 'Bank')).toBe(30_000n);
    expect(await held(chain, 'Router')).toBe(0n);
  });
});
