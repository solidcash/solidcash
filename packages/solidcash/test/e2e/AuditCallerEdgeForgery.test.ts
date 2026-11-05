import { binToHex, decodeTransactionUnsafe, encodeTransaction, hash256, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * CALLER-EDGE-1 (docs/security/security-audit-2026-10-16.md). A callee reading a contract's msg.sender requires that
 * contract's edge record, an own-category immutable NFT, and only the own-category census refuses a forged one. Since
 * edges became witnessed outputs (e01859f89) that census is keyed on a `callEdge` slot nothing generates, so an entry
 * of a contract with no events takes none: a spend of any entry can carry an edge for a call it never made.
 * `it.fails` pins the open hole. When the census fires, this turns red: drop `.fails`.
 */
const SOURCE = `pragma solidcash >=0.8.0;
interface IVault { function pay(); function other(); }
contract Vault(address trusted) {
  bigint paid;
  function pay() { require(msg.sender == trusted); this.paid = this.paid + 1; }
  function other() { this.paid = this.paid + 2; }
}
contract Caller() {
  bigint calls;
  function go(address vault) { IVault(vault).pay(); this.calls = this.calls + 1; }
  function poke() { this.calls = this.calls + 1; }
}`;

describe('a caller edge forged by an entry that makes no call', () => {
  it.fails('is refused, so a spender cannot act as the contract toward its callee', async () => {
    const provider = createTestProvider();
    const artifacts = compileStringMulti(SOURCE, {});
    const caller = new Contract(artifacts.Caller, [], { provider });
    const { categoryId: callerCategory } = await setupStatefulUtxos(
      provider, caller, artifacts.Caller.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const trusted = hexToBin(caller.withCategory(hexToBin(callerCategory)).lockingBytecode);
    const vault = new Contract(artifacts.Vault, [trusted], { provider });
    const { categoryId: vaultCategory } = await setupStatefulUtxos(
      provider, vault, artifacts.Vault.stateLayout!, { paid: 0n }, { saltContract: true },
    );
    const callerSc = StatefulContract.withCategory(caller, callerCategory) as any;
    const vaultSc = StatefulContract.withCategory(vault, vaultCategory) as any;

    // The honest spend's shape, captured unbroadcast: Caller.go paying the vault, its edge at an appended output.
    const send = provider.sendRawTransaction.bind(provider);
    let honest = '';
    provider.sendRawTransaction = async (raw: string): Promise<string> => {
      honest = raw;
      return binToHex(hash256(hexToBin(raw)).reverse());
    };
    await callerSc.go(hexToBin(vault.withCategory(hexToBin(vaultCategory)).lockingBytecode))
      .withExternalCall(vaultSc, 'pay', []).send();
    provider.sendRawTransaction = send;

    // The same transaction with the caller running poke, which makes no call and so pins no edge.
    const forged = decodeTransactionUnsafe(hexToBin(honest));
    forged.inputs[0].unlockingBytecode = (await callerSc.poke().build())
      .buildLibauthTransaction().inputs[0].unlockingBytecode;
    await expect(send(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    expect((await vaultSc.getState()).paid).toBe(0n);
  }, 120_000);
});
