/**
 * A call in the right operand of `&&` inside a branch, on the direct convention (R calls T only when `x` holds and
 * `a` holds). The call runs under both, so the guard the compiler publishes for it names both: a guard naming `a` alone
 * read the call as made whenever `a` held, and T, co-spent while `x` was false, ran without being called. Each sent
 * transaction is checked by the VM.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import type { DeployResult } from '../../src/stateful/stateful-lifecycle-types.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const SOURCE = `pragma solidcash ^0.52.0;
  interface IT { function ping() external returns (bool); }
  contract T { int pings; function ping() external returns (bool) { pings = pings + 1; return true; } }
  contract R { int runs;
    function guarded(IT t, bool x, bool a) external {
      if (x) {
        if (a && t.ping()) { runs = runs + 10; }
      }
      runs = runs + 1;
    } }`;

const compileOptions = (primary: string): never => ({
  deployer: true, genesisCalls: true, messageBus: false, primaryContractName: primary,
}) as never;

let serial = 0x7200;
const nextTxid = (): string => (serial++).toString(16).padStart(64, '0');

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: any[] };

describe('a call in the right operand of && inside a branch (R calls T when x and a hold)', () => {
  it('publishes the branch with the operand: T unspent when x is false although a holds, called when both hold',
    async () => {
      const provider = new MockNetworkProvider({ profile: 'production' });
      const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
      const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
      if (typeof change === 'string') throw new Error(change);
      const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
      const sent: Sent[] = [];
      const original = provider.sendRawTransaction.bind(provider);
      (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
        const transaction = decodeTransactionUnsafe(hexToBin(hex));
        const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
          const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
          if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
          return solidCashOutputToLibauthOutput({
            to: spent.lockingBytecode, amount: spent.satoshis,
            ...(spent.token === undefined ? {} : { token: spent.token }),
          });
        }));
        sent.push({ transaction, sourceOutputs });
        return original(hex);
      };
      const deploy = async (primary: string): Promise<DeployResult<Artifact>> => {
        const fundingUtxo: Utxo = { txid: nextTxid(), vout: 0, satoshis: 2_000_000n };
        await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
        return StatefulContract.deploy(compileString(SOURCE, compileOptions(primary)), [] as never, {
          provider, fundingUtxo, funder, changeAddress: change.address, senderLockingBytecode: authorLock,
        } as never);
      };
      const t = await deploy('T');
      const r = await deploy('R');
      const rArtifact = r.contract.inner.artifact as Artifact;
      const wallet = new Signer(alicePriv, provider);
      for (let coin = 0; coin < 8; coin += 1) {
        await provider.seedUtxo(wallet.getAddress(), { txid: nextTxid(), vout: 0, satoshis: 200_000n });
      }
      (r.contract as unknown as { _registerResolvedExternal(name: string, contract: unknown): void })
        ._registerResolvedExternal('IT', t.contract);
      const tLock = addressToLockScript(t.contract.address);
      const pings = async (): Promise<bigint> => ((await t.contract.getState()) as { pings?: bigint }).pings ?? 0n;
      const runs = async (): Promise<bigint> => ((await r.contract.getState()) as { runs?: bigint }).runs ?? 0n;
      const send = async (x: boolean, a: boolean): Promise<string> => {
        await (r.contract.connect(wallet) as any).call.guarded(tLock, x, a).send();
        const last = sent[sent.length - 1]!;
        expect(createVirtualMachineBch2026ForProvider(provider).verify(last as never)).toBe(true);
        const spent = last.sourceOutputs.some((output) => binToHex(output.lockingBytecode) === binToHex(tLock));
        return `T ${spent ? '' : 'not '}spent; T pings ${await pings()}; R runs ${await runs()}`;
      };

      // x false: R never reaches the call, whatever a holds.
      expect(await send(false, true)).toBe('T not spent; T pings 0; R runs 1');
      // Both hold: R calls T.
      expect(await send(true, true)).toBe('T spent; T pings 1; R runs 12');

      // The published guard names x and a: `x && a` on the direct convention.
      const call = rArtifact.abi.find((fn) => fn.name === 'guarded')!.externalCalls![0]!;
      expect(call.condition).toMatchObject({
        kind: 'binary', operator: '&&',
        left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        right: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
      });
    });
});
