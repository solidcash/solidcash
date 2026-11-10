import { binToHex, hexToBin } from '@bitauth/libauth';
import { sha256 } from '@noble/hashes/sha2.js';
import { asmToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, SignatureTemplate } from '../../src/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { compileStringMulti } from '../direct-compile.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';

// `new C{code: c}` deploys a child that runs the bytes `c`, which the factory requires to hash to a template: C's
// compiled code, or a template chosen at run time. Each refusal below has a control that differs in that one value.

const SOURCE = `pragma solidcash ^0.14.0;
contract Child(int limit) {
    int counter;
    function bump(int n) public { require(n < limit, "limit"); this.counter = this.counter + n; }
}
contract OtherChild(int limit) {
    int counter;
    function bump(int n) public { require(n < limit, "other"); this.counter = this.counter + n * 2; }
}
contract Factory() {
    int created;
    function create(int limit, bytes code) public {
        new Child{code: code}(limit);
        this.created += 1;
    }
}
contract Registry() {
    int created;
    event Created(bytes32 template, int limit);
    function create(bytes32 template, int limit, bytes code) public {
        new Child{code: code, template: template}(limit);
        emit Created(template, limit);
        this.created += 1;
    }
}
contract Pinned(bytes32 template) {
    int created;
    function create(int limit, bytes code) public {
        new Child{code: code, template: template}(limit);
        this.created += 1;
    }
}
contract LoopFactory() {
    int created;
    function makeN(int n, int limit, bytes code) public {
        for (int i = 0; i < n; i = i + 1) {
            new Child{code: code}(limit);
        }
        this.created = this.created + n;
    }
}`;

const artifacts = compileStringMulti(SOURCE, { allowUnsafeOperations: true });
const childCode = asmToBytecode(artifacts.Child.bytecode);
const otherCode = asmToBytecode(artifacts.OtherChild.bytecode);
const templateOf = (code: Uint8Array): Uint8Array => sha256(code);

const suite = (label: string, makeProvider: () => any) => describe(`new C{code: c} deploys a child that runs c, checked against a template (${label})`, () => {
  const provider = makeProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const funder = () => p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  let nonce = 0;
  const coin = async (satoshis: bigint): Promise<Utxo> => {
    nonce += 1;
    const utxo: Utxo = { txid: nonce.toString(16).padStart(4, '0').repeat(16), vout: 0, satoshis };
    await provider.seedUtxo(p2pkh.address, utxo);
    return utxo;
  };
  const deployFactory = async (name: 'Factory' | 'Registry' | 'Pinned' | 'LoopFactory', args: unknown[] = []) => (
    await StatefulContract.deploy(artifacts[name], args as any, {
      provider, fundingUtxo: await coin(200_000n), funder: funder(), initialState: { created: 0n },
      changeAddress: p2pkh.address,
    })
  ).contract;
  const deployChild = async (factory: any, args: unknown[], childArtifact = artifacts.Child) => {
    const fundingUtxo = await coin(100_000n);
    const result = await StatefulContract.deployFrom({
      provider, factory, deployFunctionName: 'create', deployFunctionArgs: args as any,
      childArtifact, fundingUtxo, funder: funder(), changeAddress: p2pkh.address,
    });
    return { result, category: fundingUtxo.txid };
  };
  // The child's master: the minting NFT of its new category, at the lock its code and arguments make.
  const masterLock = (result: any): string => {
    const index = getTxOutputs(result.tx).findIndex((output) => output.token?.category === result.childCategoryId
      && output.token?.nft?.capability === 'minting');
    expect(index).toBeGreaterThanOrEqual(0);
    return binToHex(result.tx.outputs[index].lockingBytecode);
  };
  const addressOf = (artifact: any, limit: bigint, category: string): string => {
    const { lockingBytecode } = new Contract(artifact, [limit], { provider, category: hexToBin(category) }) as any;
    return typeof lockingBytecode === 'string' ? lockingBytecode : binToHex(lockingBytecode);
  };

  it('a compiled template: the factory deploys C with its own code', async () => {
    const factory = await deployFactory('Factory');
    const { result, category } = await deployChild(factory, [7n, childCode]);
    expect(masterLock(result)).toBe(addressOf(artifacts.Child, 7n, category));
  });

  it('a compiled template: other code is refused', async () => {
    const factory = await deployFactory('Factory');
    await expect(deployChild(factory, [7n, otherCode], artifacts.OtherChild)).rejects.toThrow(/template/);
  });

  it('a run-time template: the registry deploys whichever code hashes to the template it is given', async () => {
    const registry = await deployFactory('Registry');
    const { result, category } = await deployChild(
      registry, [templateOf(otherCode), 5n, otherCode], artifacts.OtherChild,
    );
    expect(masterLock(result)).toBe(addressOf(artifacts.OtherChild, 5n, category));
    const control = await deployChild(registry, [templateOf(childCode), 5n, childCode]);
    expect(masterLock(control.result)).toBe(addressOf(artifacts.Child, 5n, control.category));
  });

  it('a run-time template: code that does not hash to it is refused', async () => {
    const registry = await deployFactory('Registry');
    await expect(deployChild(registry, [templateOf(childCode), 5n, otherCode], artifacts.OtherChild))
      .rejects.toThrow(/template/);
  });

  it('the covenant itself refuses code that does not hash to the template', async () => {
    // The template is a constructor argument, which the SDK does not check, so only the covenant stands in the way.
    const pinned = await deployFactory('Pinned', [templateOf(childCode)]);
    const control = await deployChild(pinned, [3n, childCode]);
    expect(masterLock(control.result)).toBe(addressOf(artifacts.Child, 3n, control.category));
    await expect(deployChild(pinned, [3n, otherCode], artifacts.OtherChild)).rejects.toThrow();
  });

  it('a loop deploys each child with the same checked code', async () => {
    const factory = await deployFactory('LoopFactory');
    const fundingUtxos = [await coin(100_000n), await coin(100_000n)];
    const result = await StatefulContract.deployFrom({
      provider, factory, deployFunctionName: 'makeN', deployFunctionArgs: [2n, 9n, childCode] as any,
      childArtifact: artifacts.Child, fundingUtxos, funder: funder(), changeAddress: p2pkh.address,
    });
    const outputs = getTxOutputs(result.tx);
    for (const funding of fundingUtxos) {
      const index = outputs.findIndex((output) => output.token?.category === funding.txid
        && output.token?.nft?.capability === 'minting');
      expect(index).toBeGreaterThanOrEqual(0);
      expect(binToHex(result.tx.outputs[index].lockingBytecode)).toBe(addressOf(artifacts.Child, 9n, funding.txid));
    }
  });

  it('publishes the template for the SDK', () => {
    const target = artifacts.Registry.abi.find((entry: any) => entry.name === 'create')!.deployTargets![0];
    expect(target.template).toEqual({ kind: 'parameter', name: 'template', index: 0 });
    expect(target.code).toEqual({ kind: 'parameter', name: 'code', index: 2 });
    const compiled = artifacts.Factory.abi.find((entry: any) => entry.name === 'create')!.deployTargets![0];
    expect(compiled.template).toEqual({ kind: 'compiled', hash: binToHex(templateOf(childCode)) });
  });
});

suite('relaxed test limits', createTestProvider);
// The limits a real node applies: 10,000-byte inputs and stack items, standard transaction size, the real op budget.
suite('production limits', () => new MockNetworkProvider({ profile: 'production' }));
