import { describe, expect, it } from 'vitest';
import { binToHex, sha256, utf8ToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, Signer, SignatureTemplate } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub, alicePkh, bobPriv, bobPub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// An allowance spend that keeps an infinite sentinel applies its delta in one arm only. The compiler publishes no
// `entry - value` recipe for it, so the builder derives the new allowance from the arm the call takes.
const SOURCE = `contract Allowance() {
  mapping(address => mapping(address => int)) allowances;
  mapping(address => int) spent;
  function approve(address spender, int value, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.allowances[msg.sender][spender] = value;
  }
  function spendFrom(address owner, int value, pubkey pk, sig s) {
    require(checkSig(s, pk));
    int current = this.allowances[owner][msg.sender];
    if (current != 1000000) {
      require(current >= value);
      current = current - value;
    }
    this.allowances[owner][msg.sender] = current;
    this.spent[msg.sender] = this.spent[msg.sender] + value;
  }
}`;
const INFINITE = 1000000n;

describe('allowance delta applied in one arm', () => {
  it('settles both arms from the arm taken and refuses the value an unconditional recipe states', async () => {
    const artifact = compileString(SOURCE, { forceStateful: true });
    const spendFrom = artifact.abi.find((fn) => fn.name === 'spendFrom');
    expect(spendFrom?.entryAccesses?.find((access) => access.collection === 'allowances')?.valueSource)
      .toBeUndefined();

    const provider = createTestProvider();
    const alice = new Signer(alicePriv, provider);
    const bob = new Signer(bobPriv, provider);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let nonce = 0;
    const txid = (): string => binToHex(sha256.hash(utf8ToBin(`allowance-arm-${nonce++}`)));
    const fund = async (signer: Signer): Promise<void> => {
      await provider.addUtxo(signer.getAddress(), { txid: txid(), vout: 0, satoshis: 200_000n });
    };
    const owner = addressToLockScript(alice.getAddress());
    const spender = addressToLockScript(bob.getAddress());
    const deploy = async (deployed: Artifact): Promise<any> => {
      const fundingUtxo = { txid: txid(), vout: 0, satoshis: 400_000n };
      await provider.addUtxo(p2pkh.address, fundingUtxo);
      const { contract } = await StatefulContract.deploy(deployed, [], {
        provider, fundingUtxo, funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: {}, changeAddress: p2pkh.address,
      });
      return contract;
    };
    const approve = async (contract: any, value: bigint): Promise<void> => {
      await fund(alice);
      await contract.connect(alice).approve(spender, value, alicePub, new SignatureTemplate(alicePriv)).send();
    };
    const spend = async (contract: any, value: bigint): Promise<unknown> => {
      await fund(bob);
      return contract.connect(bob).spendFrom(owner, value, bobPub, new SignatureTemplate(bobPriv)).send();
    };

    const contract = await deploy(artifact);
    // The arm taken: a finite allowance is decremented.
    await approve(contract, 3n);
    await spend(contract, 2n);
    expect(await contract.state.allowances(owner, spender)).toBe(1n);
    // The arm not taken: the infinite sentinel is left as it is.
    await approve(contract, INFINITE);
    await spend(contract, 2n);
    expect(await contract.state.allowances(owner, spender)).toBe(INFINITE);
    expect(await contract.state.spent(spender)).toBe(4n);

    // An artifact that states the unconditional recipe makes the builder write INFINITE - 2, which the covenant
    // refuses: the value is the one the arm computes, not one a builder chooses.
    const stated = structuredClone(artifact);
    for (const access of stated.abi.find((fn) => fn.name === 'spendFrom')?.entryAccesses ?? []) {
      if (access.collection === 'allowances') {
        (access as { valueSource?: string }).valueSource = 'binop:-(entry,id:value)';
      }
    }
    const forged = await deploy(stated);
    await approve(forged, INFINITE);
    await expect(spend(forged, 2n)).rejects.toThrow(/input 0: Program failed an OP_VERIFY operation/);
    expect(await forged.state.allowances(owner, spender)).toBe(INFINITE);
  }, 600_000);
});
