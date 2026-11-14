/**
 * A7 with `genesisCalls` on by default: a callee compiled with no option answers a constructor's call, and so does
 * one compiled with the multi-call entry, whose called entry also runs as a frame; a constructor's call is answered
 * by a standalone run. A returning creating entry takes the genesis call too, and `deployFrom` leaves it empty.
 */
import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.50.0;';
const SOURCE = `${P} interface I { function f(int x) external returns (bool); }
  contract T { int calls; function f(int x) external returns (bool) { calls = calls + x; return true; }
    function total() external returns (int) { return calls; } }
  contract C { bool ok; constructor(I i) { ok = i.f(5); } function read() { require(ok); } }`;

describe('a constructor calls a callee compiled with the default options', () => {
  it.each([
    ['without the multi-call entry', {}],
    ['with the multi-call entry, its entry a frame too', { callBatch: true }],
  ] as const)('%s', async (_name, calleeOptions) => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    let serial = 0;
    const deploy = async (artifact: any, initArgs: any[] = [], extra: any = {}) => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0x7a + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock,
        ...(initArgs.length === 0 ? {} : { initArgs }), ...extra,
      });
    };
    const tArtifact = compileString(SOURCE, {
      deployer: true, messageBus: false, primaryContractName: 'T', ...calleeOptions,
    } as never);
    expect(tArtifact.recordSound).toBe(true);
    expect(tArtifact.genesisCalls).toBe(true);
    const f = tArtifact.abi.find((entry) => entry.name === 'f')!;
    expect(f.inputs.some((input) => input.name === '__internal__genesisCall')).toBe(true);
    expect(f.callBatchRow === true).toBe('callBatch' in calleeOptions);
    const tResult = await deploy(tArtifact);
    const cArtifact = compileString(SOURCE, { deployer: true, messageBus: false, primaryContractName: 'C' } as never);
    const cResult = await deploy(cArtifact, [addressToLockScript(tResult.contract.address)], {
      constructorCallees: [{ contract: tResult.contract, args: [5n] }],
    });
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0x90 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    await (cResult.contract.connect(signer) as any).call.read().send();
    expect((await (tResult.contract as any).getState()).calls).toBe(5n);
  }, 300_000);
});

describe('a returning creating entry', () => {
  it('takes the genesis call, which deployFrom leaves empty', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child { int n; constructor() { n = 7; } }
      contract StateFactory { int childCount;
        function make() public returns (int) { new Child(); childCount = childCount + 1; return childCount; }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const factoryArtifact = artifacts.StateFactory!;
    expect(factoryArtifact.recordSound).toBe(true);
    expect(factoryArtifact.abi.find((entry) => entry.name === 'make')!.inputs.map((input) => input.name))
      .toEqual(['__internal__genesisCall', '__internal__returnOutputIdx']);

    const deploymentFunding: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    } as Parameters<typeof StatefulContract.deploy>[2]);
    const prepFunding: Utxo = { txid: 'e2'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'make',
      deployFunctionArgs: [], childArtifact: artifacts.Child!, childConstructorArgs: [],
      fundingUtxo: prepFunding, funder, changeAddress: change.address,
    });
    expect(((await result.child.getState()) as { n?: bigint }).n).toBe(7n);
    expect(((await result.factory.getState()) as { childCount?: bigint }).childCount).toBe(1n);
  }, 300_000);
});
