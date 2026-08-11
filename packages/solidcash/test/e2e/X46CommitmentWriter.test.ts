import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import {
  alicePub, alicePriv, alicePkh, bobPriv, bobPub, bobPkh, bobAddress,
} from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X46 - the settlement evidence for the compiler diagnostic in `ContractDeployment.test.ts`.
 *
 * SEC-17 credits a key parameter as committed when an unconditional `require(hash160(pk) == <x>)` binds it to
 * something the caller cannot choose. It read the BINDING of `<x>` and stopped: `this.pkh` is a state variable,
 * therefore not caller-chosen, therefore the commitment counts. Scalar state is read AFTER write, so a body that
 * assigns `this.pkh` from one of its own parameters and then commits against it compares the key to bytes the
 * caller supplied one line earlier - the commitment is vacuous and the function is open to everyone.
 *
 * Both contracts below are identical except for that one assignment, and both are deployed with `pkh = alicePkh`
 * and a 50,000-satoshi balance. Bob - who is not alice - then calls `kill` with HIS key and HIS destination:
 *
 *   with the assignment    the transaction SETTLES and bob takes the whole freed balance
 *   without it             the covenant rejects at input 0
 *
 * The diagnostic was silent on the settling one, which is why this file exists rather than a compile-only pin.
 */
const SRC = (write: string): string => `pragma solidcash >=0.8.0;
contract C() {
  bytes20 pkh;
  function kill(bytes20 newPkh, pubkey pk, sig s, bytes20 to) {
    ${write}
    require(hash160(pk) == this.pkh);
    require(checkSig(s, pk));
    selfdestruct(new LockingBytecodeP2PKH(to));
  }
}`;

describe('X46: a commitment against state the same call overwrote authorizes nobody', () => {
  const provider = createTestProvider();
  let nonce = 0x46a0;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  const bobDrains = async (
    write: string,
  ): Promise<{ ok: boolean; to?: string; amount?: bigint; error?: string }> => {
    const artifact = compileString(SRC(write), { allowUnsafeOperations: true });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo: Utxo = { txid: uid(), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const { contract } = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { pkh: alicePkh },
      changeAddress: p2pkh.address,
      initialBalance: 50000n,
    });
    try {
      const result = await StatefulContract.selfdestructTo({
        provider,
        contract,
        destroyFunctionName: 'kill',
        destroyFunctionArgs: [bobPkh, bobPub, new SignatureTemplate(bobPriv), bobPkh],
        recipient: bobAddress,
      });
      const outputs = getTxOutputs(result.txs[result.txs.length - 1]);
      return { ok: true, to: outputs[0].to, amount: outputs[0].amount };
    } catch (error) {
      return { ok: false, error: String((error as Error).message) };
    }
  };

  it('HOSTILE: writing this.pkh from a parameter first lets bob take an alice-owned balance', async () => {
    const hostile = await bobDrains('this.pkh = newPkh;');
    expect(hostile.ok).toBe(true);
    expect(hostile.to).toBe(bobAddress);
    expect(hostile.amount).toBeGreaterThanOrEqual(50000n);
  }, 180_000);

  it('HONEST CONTROL: the same call without that write is refused by the covenant at input 0', async () => {
    const honest = await bobDrains('');
    expect(honest.ok).toBe(false);
    // BCHN's short form names no input, only what tripped, so require the script-verify refusal itself
    // and the input index only where the backend reports one.
    expect(honest.error).toMatch(/input index 0|mandatory-script-verify-flag-failed/);
  }, 180_000);
});
