import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';

/**
 * Fail-closed edge (a), container-spend sibling: a dynamic keccak loop in the same function that also spends a
 * satoshi or token container. The container/transfer occupy fixed block slots before the trailing band, so the
 * keccak-loop probe pads those slots and the side-car recreations land at blockSize.
 */
const SATOSHI_SOURCE = `
contract C {
    bytes32 acc;
    function run(bytes32 seed, int rounds, bytes20 recipient, int amount) public {
        bytes32 h = seed;
        for (int i = 0; i < rounds; i++) { h = keccak256(h); }
        this.acc = h;
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
    }
    function check(bytes32 expected) public view {
        require(this.acc == expected);
    }
}`;

const TOKEN_SOURCE = `
contract C {
    bytes32 acc;
    function run(bytes32 seed, int rounds, bytes32 tokenCategory, bytes20 recipient, int amount) public {
        bytes32 h = seed;
        for (int i = 0; i < rounds; i++) { h = keccak256(h); }
        this.acc = h;
        this.tokens[tokenCategory].transfer(recipient, amount);
    }
    function check(bytes32 expected) public view {
        require(this.acc == expected);
    }
}`;

const seed = hexToBin('56'.repeat(32));
const rounds = 3;
const target = (() => { let h = seed; for (let i = 0; i < rounds; i++) h = keccak_256(h); return h; })();

async function deployKeccakSidecars(provider: ReturnType<typeof createTestProvider>, categoryId: string): Promise<void> {
  const lock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
  for (let i = 0; i < 5; i++) {
    await provider.addUtxo(lock, {
      txid: (0xd0 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: 'dd'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
}

describe('keccak loop beside a container spend (fail-closed edge a)', () => {
  it('settles a keccak loop beside a satoshi-container transfer with the correct digest', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SATOSHI_SOURCE, { forceStateful: true, suppressWarnings: true });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo: Utxo = { txid: 'c1cd'.repeat(16), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { acc: seed },
      changeAddress: p2pkh.address,
      initialBalance: 50_000n,
    });
    const sc = deployed.contract;
    await deployKeccakSidecars(provider, deployed.categoryId);
    await sc.run(seed, BigInt(rounds), new Uint8Array(20).fill(0x33), 1000n).send();
    await expect(sc.check(target).send()).resolves.toBeDefined();
  }, 300_000);

  it('settles a keccak loop beside a token-container transfer with the correct digest', async () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_SOURCE, { forceStateful: true, suppressWarnings: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, { acc: seed }, {
      saltContract: true,
    });
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tokenCategory = 'bb'.repeat(32);
    const containerUtxo: Utxo = {
      txid: 'ddcd'.repeat(16), vout: 0, satoshis: 1200n,
      token: { category: tokenCategory, amount: 1000n },
    };
    await provider.addUtxo(sc.getTokenContainerAddress(tokenCategory), containerUtxo);
    await deployKeccakSidecars(provider, categoryId);
    await sc.run(seed, BigInt(rounds), hexToBin(tokenCategory), new Uint8Array(20).fill(0x44), 250n).send();
    await expect(sc.check(target).send()).resolves.toBeDefined();
  }, 300_000);
});
