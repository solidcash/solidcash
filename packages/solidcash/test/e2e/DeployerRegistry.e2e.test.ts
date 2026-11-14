/**
 * A18: a registry whose `create` runs `new` of a pool-shaped child and publishes the child's category.
 */
import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { DeployerPrepError } from '../../src/stateful/deployer.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const SOURCE = `
pragma satoshicontainer single;
contract NotePool(uint8 exponent) {
    int note;
    constructor() { note = int(exponent); }
    function read() { require(note == int(exponent)); }
}
contract Registry {
    bytes32 last;
    int count;
    event PoolCreated(bytes32 indexed category, uint8 exponent);
    function create(uint8 exponent) {
        NotePool pool = new NotePool(exponent);
        last = pool.category;
        count = count + 1;
        emit PoolCreated(pool.category, exponent);
    }
}
`;

describe('A18: a registry creates a pool through its deployer', () => {
  it("stores and emits the created pool's category", async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(SOURCE, { allowUnsafeOperations: true, __deployerNew: true } as never);
    expect(artifacts.Registry.childDeployers?.NotePool).toBeDefined();

    const deploymentFunding: Utxo = { txid: 'c1'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.Registry, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { last: new Uint8Array(32), count: 0n },
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });

    const prep: Utxo = { txid: 'c2'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prep);
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'create',
      deployFunctionArgs: [6n], childArtifact: artifacts.NotePool,
      childConstructorArgs: [6n], childInitialState: { note: 6n },
      childContainers: [{ deployment: 0, satoshis: 1200n }],
      fundingUtxo: prep, funder, changeAddress: change.address,
    });
    const state = await deployed.contract.getState() as { last?: Uint8Array; count?: bigint };
    expect(state.count).toBe(1n);
    expect(Buffer.from(state.last ?? []).toString('hex')).toBe(result.childCategoryId);
  });

  it("stores and emits a token pool's category and keeps its token coin", async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const asset = 'a1'.repeat(32);
    const artifacts = compileStringMulti(`
      pragma satoshicontainer single;
      pragma tokencontainer single;
      contract TokenNotePool(bytes32 asset, uint8 exponent) {
          int note;
          constructor() { note = int(exponent); }
          function check() { require(this.tokens[asset].tokenAmount >= 0); }
      }
      contract TokenRegistry {
          bytes32 last;
          int count;
          event PoolCreated(bytes32 indexed category, uint8 exponent);
          function create(bytes32 asset, uint8 exponent) {
              TokenNotePool pool = new TokenNotePool(asset, exponent);
              last = pool.category;
              count = count + 1;
              emit PoolCreated(pool.category, exponent);
          }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const deploymentFunding: Utxo = { txid: 'c3'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.TokenRegistry, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { last: new Uint8Array(32), count: 0n },
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prep: Utxo = { txid: 'c4'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prep);
    const tokenCoin: Utxo = {
      txid: 'c5'.repeat(32), vout: 0, satoshis: 1200n, token: { category: asset, amount: 5n },
    };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), tokenCoin);
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'create',
      deployFunctionArgs: [hexToBin(asset), 6n], childArtifact: artifacts.TokenNotePool,
      childConstructorArgs: [hexToBin(asset), 6n], childInitialState: { note: 6n },
      childContainers: [{ deployment: 0, satoshis: 1200n, tokens: [{ categoryId: asset, amount: 5n }] }],
      fundingUtxo: prep, funder, changeAddress: change.address,
    });
    expect((await deployed.contract.getState() as { count?: bigint }).count).toBe(1n);
    expect((await deployed.contract.getState() as { last?: Uint8Array }).last).toBeDefined();
    expect(result.childCategoryId).toBeTruthy();
  });

  it('refuses a token coin of 546 satoshis for a single token container', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const asset = 'a2'.repeat(32);
    const artifacts = compileStringMulti(`
      pragma satoshicontainer single;
      pragma tokencontainer single;
      contract TokenNotePool(bytes32 asset, uint8 exponent) {
          int note;
          constructor() { note = int(exponent); }
          function check() { require(this.tokens[asset].tokenAmount >= 0); }
      }
      contract TokenRegistry {
          bytes32 last;
          int count;
          event PoolCreated(bytes32 indexed category, uint8 exponent);
          function create(bytes32 asset, uint8 exponent) {
              TokenNotePool pool = new TokenNotePool(asset, exponent);
              last = pool.category;
              count = count + 1;
              emit PoolCreated(pool.category, exponent);
          }
      }`, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const deploymentFunding: Utxo = { txid: 'c6'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.TokenRegistry, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { last: new Uint8Array(32), count: 0n },
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prep: Utxo = { txid: 'c7'.repeat(32), vout: 0, satoshis: 200000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prep);
    const tokenCoin: Utxo = {
      txid: 'c8'.repeat(32), vout: 0, satoshis: 546n, token: { category: asset, amount: 5n },
    };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), tokenCoin);
    await expect(StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'create',
      deployFunctionArgs: [hexToBin(asset), 6n], childArtifact: artifacts.TokenNotePool,
      childConstructorArgs: [hexToBin(asset), 6n], childInitialState: { note: 6n },
      childContainers: [{ deployment: 0, satoshis: 1200n, tokens: [{ categoryId: asset, amount: 5n }] }],
      fundingUtxo: prep, funder, changeAddress: change.address,
    })).rejects.toThrow(DeployerPrepError);
  });

});
