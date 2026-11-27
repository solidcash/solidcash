/**
 * B6.6/B6.7: a constructor's call resolves `msg.sender` to the child it created.
 *
 * The fixture takes a genuine SDK call to a contract whose entry reads `msg.sender`, then rewrites it into the
 * creation transaction A7 describes: the callee's genesis parameter becomes a 46-byte tag, an output carries the
 * child's X‖02 master, and an input spends the deployer coin at (X, 0). The fee input is re-signed after the
 * rewrite, because a signature covers the transaction it authorizes.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransaction, encodeAuthenticationInstructions,
  hash256, hexToBin,
} from '@bitauth/libauth';
import type { Output, Transaction } from '@bitauth/libauth';
import { clearCompileCache, compileString } from '../src/index.js';
import { Contract, SignatureTemplate } from '../../solidcash/src/index.js';
import { StatefulContract } from '../../solidcash/src/stateful/index.js';
import { HDSigner } from '../../solidcash/src/HDSigner.js';
import { lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { addressToLockScript } from '../../solidcash/src/utils.js';
import { solidCashOutputToLibauthOutput } from '../../solidcash/src/utils.js';
import { createVirtualMachineBch2026, disassembleBytecodeBCH } from '@bitauth/libauth';
import { alicePub, alicePriv, alicePkh } from '../../solidcash/test/fixture/vars.js';
import { createTestProvider } from '../../solidcash/test/test-util.js';
import p2pkhArtifact from '../../solidcash/test/fixture/p2pkh.artifact.js';

const SOURCE = `pragma solidcash ^0.52.0;
contract T {
    int n;
    function who(address expected) { require(msg.sender == expected); n = n + 1; }
    function whoElse(address expected) { require(msg.sender == expected); n = n + 2; }
}`;

const DE_RE = hexToBin('af341413');
const PREFIX = Uint8Array.of(0xaa, 0x20);
const SUFFIX = Uint8Array.of(0x87);

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >> 8) & 0xff);
}

/** The direct master lock of a child whose redeem is `21 X 02 c0 ce 88 ‖ S`. */
function childLock(X: Uint8Array, S: Uint8Array): Uint8Array {
  return concat(PREFIX, hash256(concat(Uint8Array.of(0x21), X, hexToBin('02c0ce88'), S)), SUFFIX);
}

interface Fixture {
  attempt: () => Promise<string>;
  sawMutation: () => boolean;
  provider: ReturnType<typeof createTestProvider>;
  X: Uint8Array;
  D: Uint8Array;
  L: Uint8Array;
  signer: HDSigner;
}

describe('B6.6/B6.7: the genesis sender', () => {
  async function fixture(options: {
    /** Bytes appended to the deployer coin's script as its redeem. */
    redeem?: Uint8Array;
    /** The child code S carries at its tail, before mutation. */
    childTail?: (D: Uint8Array) => Uint8Array;
    /** The callee list the deployer's unlocking carries (default names input 0). */
    listBytes?: number[];
    /** The tag fields a negative case rewrites. */
    tagX?: Uint8Array;
    slot?: number;
    gIn?: number;
    gOut?: number;
    tagSize?: number;
    /** A surplus push placed before the redeem, testing the exact-stack check. */
    extraPush?: boolean;
    /** The lock output g_out carries, given the child's L. */
    gOutLock?: (L: Uint8Array) => Uint8Array;
  } = {}): Promise<Fixture> {
    const provider = createTestProvider();
    const signer = HDSigner.fromPhrase(
      'test test test test test test test test test test test junk', provider,
    );
    for (let i = 0; i < 8; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (0xa0 + i).toString(16).repeat(32), vout: 0, satoshis: 100_000n,
      });
    }
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    clearCompileCache();
    const artifact = compileString(SOURCE, { genesisCalls: true });
    const funding = { txid: 'de'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { n: 0n }, changeAddress: p2pkh.address,
    });

    // The deployer coin X:0, its redeem and its birth trailer's D.
    const X = hash256(new TextEncoder().encode('deployer-coins:genesis-sender'));
    const Xvm = X.slice().reverse();
    const redeem = options.redeem ?? Uint8Array.of(0x6d);
    const D = hash256(redeem);
    const deployerLock = concat(PREFIX, D, SUFFIX);
    const childCode = options.childTail === undefined
      ? concat(Uint8Array.of(0x20), D, Uint8Array.of(0x75))
      : options.childTail(D);
    const S = childCode;
    const L = childLock(Xvm, S);
    const expected = lockingBytecodeToCashAddress({ bytecode: L, prefix: 'bchtest', tokenSupport: true });
    if (typeof expected === 'string') throw new Error(expected);
    const deployerCoin = {
      txid: binToHex(X), vout: 0, satoshis: 5_000n,
      token: { category: binToHex(X), amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
    };
    await provider.addUtxo(binToHex(deployerLock), deployerCoin);

    const connected = deployed.contract.connect(signer);
    const send = provider.sendRawTransaction.bind(provider);
    let sawMutation = false;
    (provider as unknown as { sendRawTransaction: (raw: string) => Promise<string> }).sendRawTransaction =
      async (raw: string): Promise<string> => {
        const decoded = decodeTransaction(hexToBin(raw));
        if (typeof decoded === 'string') throw new Error(decoded);
        const tx: Transaction = decoded;
        const calleeIndex = tx.inputs.findIndex((input) => {
          const instructions = decodeAuthenticationInstructions(input.unlockingBytecode);
          return typeof instructions !== 'string' && instructions.some((instruction) => (
            instruction.data !== undefined && binToHex(instruction.data).includes('02c0ce88')
          ));
        });
        if (calleeIndex < 0) return send(raw);
        const gIn = tx.inputs.length;
        const gOut = tx.outputs.length;
        const unlocking = decodeAuthenticationInstructions(tx.inputs[calleeIndex]!.unlockingBytecode);
        if (typeof unlocking === 'string') throw new Error(unlocking);
        // The witnesses are found by content, not by position: a call-batch prefix or a dispatcher prefix may
        // add a push, and the tag has to replace the empty genesis push wherever it lies.
        const honestLock = addressToLockScript(signer.getAddress());
        const genesisAt = unlocking.findIndex((instruction) => instruction.data?.length === 0);
        const expectedAt = unlocking.findIndex((instruction) => instruction.data !== undefined
          && instruction.data.length === honestLock.length && binToHex(instruction.data) === binToHex(honestLock));
        if (genesisAt < 0 || expectedAt < 0) throw new Error('fixture: witness not found');
        const listBytes = Uint8Array.from(options.listBytes ?? [0x00, 0x00]);
        const aOff = 6 + listBytes.length + 0;  // 6 + 2s + |Q|, Q empty in this fixture
        const codeOff = aOff + 1;               // + |A| + h, A empty, h = 1
        const tag = concat(options.tagX ?? Xvm, u16(options.slot ?? 0), u16(options.gIn ?? gIn),
          u16(options.gOut ?? gOut), u16(aOff), u16(0), u16(codeOff), u16(S.length));
        const carriedTag = options.tagSize === undefined ? tag
          : options.tagSize <= tag.length ? tag.slice(0, options.tagSize)
            : concat(tag, new Uint8Array(options.tagSize - tag.length));
        unlocking[genesisAt] = { opcode: carriedTag.length, data: carriedTag };
        unlocking[expectedAt] = { opcode: L.length, data: L };
        if (options.extraPush === true) {
          unlocking.splice(unlocking.length - 1, 0, { opcode: 1, data: Uint8Array.of(0x01) });
        }
        tx.inputs[calleeIndex]!.unlockingBytecode = encodeAuthenticationInstructions(unlocking);

        tx.outputs.push({
          lockingBytecode: options.gOutLock?.(L) ?? L,
          valueSatoshis: 1_000n,
          token: { category: X, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array() } },
        });
        const U = encodeAuthenticationInstructions([
          { opcode: 4, data: DE_RE },
          { opcode: listBytes.length, data: listBytes },
          { opcode: S.length, data: S },
          { opcode: redeem.length, data: redeem },
        ]);
        tx.inputs.push({
          outpointTransactionHash: X,
          outpointIndex: 0,
          sequenceNumber: 0xffffffff,
          unlockingBytecode: U,
        });

        const sourceOutputs: Output[] = [];
        for (const input of tx.inputs) {
          const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
          if (spent === undefined) throw new Error('fixture: unknown outpoint');
          sourceOutputs.push(solidCashOutputToLibauthOutput({
            to: spent.lockingBytecode,
            amount: spent.satoshis,
            ...(spent.token === undefined ? {} : { token: spent.token }),
          }));
        }
        tx.inputs[gIn - 1]!.unlockingBytecode = signer.unlockP2PKH().generateUnlockingBytecode({
          transaction: tx, sourceOutputs, inputIndex: gIn - 1,
        });
        sawMutation = true;
        const verdict = createVirtualMachineBch2026().verify({ transaction: tx, sourceOutputs });
        if (verdict !== true) throw new Error(`fixture refused: ${verdict}`);
        return binToHex(hash256(hexToBin(raw)).reverse());
      };

    const honestExpected = signer.getAddress();
    const attempt = async (): Promise<string> => {
      try {
        const sent = await (await connected.functions.who(honestExpected)).send();
        return `ACCEPTED ${sent.txid}`;
      } catch (error) {
        return `REFUSED ${(error as Error).stack?.slice(0, 1600)}`;
      }
    };
    return { attempt, sawMutation: () => sawMutation, provider, X, D, L, signer };
  }

  it('emits one shared resolution and invokes it', () => {
    clearCompileCache();
    const artifact = compileString(SOURCE, { genesisCalls: true });
    const asm = disassembleBytecodeBCH(hexToBin(artifact.bytecode)).split(' ');
    // Check 3 of the genesis step: hash256(21 ‖ X ‖ 02 c0 ce 88 ‖ S).
    const signature = ['OP_PUSHBYTES_4', '0x02c0ce88', 'OP_CAT', 'OP_SWAP', 'OP_CAT', 'OP_HASH256'];
    let occurrences = 0;
    for (let i = 0; i + signature.length <= asm.length; i++) {
      if (signature.every((word, j) => asm[i + j] === word)) occurrences += 1;
    }
    expect(occurrences).toBe(1);
  });

  it('resolves a genuine genesis call to the child', async () => {
    const f = await fixture();
    const outcome = await f.attempt();
    expect(f.sawMutation()).toBe(true);
    expect(outcome).toContain('ACCEPTED');
  }, 120_000);

  it('refuses a tag whose X is not the coin at (X, 0)', async () => {
    const f = await fixture({ tagX: new Uint8Array(32).fill(0x42) });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);

  // Known gap: check 5's `2 × slot + 2 ≤ len` bound and the entry's tag size checks are emitted only by
  // `emitGenesisCallChecks`, which stays disabled until the SDK carries the parameter everywhere (B10). Without
  // it, a slot past the list reads the following push instead of the list. Kept as a documented skip.
  it('refuses a slot the list does not name', async () => {
    const f = await fixture({ slot: 1 });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);

  // Check 5 reads the entry at 6 + 2 × slot, so slot 1 answers to the list's second entry, not its first.
  it('resolves slot 1 from the second list entry', async () => {
    const f = await fixture({ slot: 1, listBytes: [0x05, 0x00, 0x00, 0x00] });
    expect(await f.attempt()).toContain('ACCEPTED');
  }, 120_000);

  it('refuses slot 1 when only the first list entry names the callee', async () => {
    const f = await fixture({ slot: 1, listBytes: [0x00, 0x00, 0x05, 0x00] });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);

  // Check 3: the sender is the lock of output g_out, which must be the child's L.
  it('refuses a g_out whose lock is not the child the ranges hash to', async () => {
    const f = await fixture({ gOutLock: (L) => Uint8Array.from(L.map((byte, i) => (i === 10 ? byte ^ 1 : byte))) });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);

  it('refuses a list entry that is not the callee input index', async () => {
    const f = await fixture({ listBytes: [0x01, 0x80] });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);

  it('refuses a g_in that does not spend (X, 0)', async () => {
    const f = await fixture({ gIn: 2 });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);

  it('refuses a g_out without X‖02', async () => {
    const f = await fixture({ gOut: 0 });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);

  it('refuses a parameter of 36, 45 or 47 bytes', async () => {
    for (const tagSize of [36, 45, 47]) {
      const f = await fixture({ tagSize });
      const o = await f.attempt();
      console.error('TAGSIZE', tagSize, o.slice(0, 200));
      expect(o).toContain('REFUSED');
    }
  }, 120_000);

  // A7 check 4: a child whose code has no birth trailer is never a genesis sender, however it was born.
  it('refuses a child whose code has no birth trailer', async () => {
    const f = await fixture({ childTail: () => Uint8Array.of(0x51) });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);

  it('refuses one surplus push at the entry', async () => {
    const f = await fixture({ extraPush: true });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);

  it('refuses a trailer that names another lock', async () => {
    const f = await fixture({
      childTail: (D) => concat(Uint8Array.of(0x20), D.map((byte) => byte ^ 0xff), Uint8Array.of(0x75)),
    });
    expect(await f.attempt()).toContain('REFUSED');
  }, 120_000);
});
