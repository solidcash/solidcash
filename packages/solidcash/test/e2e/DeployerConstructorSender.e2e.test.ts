/**
 * A7: a constructor's call to a function that reads `msg.sender`. The callee resolves its sender by the genesis step,
 * from the creation's own unlocking, and stores the child's master lock: C's address.
 */
import { describe, it, expect } from 'vitest';
import { encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress, binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
const P = 'pragma solidcash ^0.53.0;';
type Deployed = ReturnType<typeof StatefulContract.deploy>;
describe('A7: the genesis sender through the SDK', () => {
  it.each([
    ['directly', 'constructor(I i) { ok = i.reg(); }'],
    ['through a helper the compiler inlines', 'function callReg(I i) internal returns (bool) { return i.reg(); } constructor(I i) { ok = callReg(i); }'],
  ])('gives the callee the child as msg.sender when the constructor calls it %s', async (_label, ctor) => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P} interface I { function reg() external returns (bool); }
    contract T { address last; function reg() external returns (bool) { last = msg.sender; return true; } }
    contract C { bool ok; ${ctor} function read() { require(ok); } }`;
    const deploy = async (artifact: any, initArgs: any[] = [], extra: any = {}): Deployed => {
      const fundingUtxo: Utxo = { txid: `${Math.floor(Math.random() * 1e9).toString(16).padStart(64, '0')}`, vout: 0, satoshis: 2_000_000n };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock,
        ...(initArgs.length === 0 ? {} : { initArgs }), ...extra,
      });
    };
    const tArtifact = compileString(source, { deployer: true, genesisCalls: true, primaryContractName: 'T' } as never);
    const tResult = await deploy(tArtifact);
    const cArtifact = compileString(source, { deployer: true, genesisCalls: true, primaryContractName: 'C' } as never);
    const cResult = await deploy(cArtifact, [addressToLockScript(tResult.contract.address)], {
      constructorCallees: [{ contract: tResult.contract, args: [] }],
    });
    const last = ((await tResult.contract.getState()) as { last?: Uint8Array }).last;
    expect(last).toBeDefined();
    expect(binToHex(last as Uint8Array)).toBe(binToHex(addressToLockScript(cResult.contract.address)));
  });

  // A callee whose block a run sizes takes it from the ordinary build of its call, which runs for the child as its sender:
  // every copy it stores, and what the copy's 35 bytes size, is the child's.
  it('stores the child wherever a sized callee writes msg.sender, past a chunk edge and the inline limit', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P} interface I { function reg(bytes note) external returns (bool); }
    contract T { struct Rec { address who; bytes note; } address[] members; mapping(int => Rec) recs; address last;
      function add(address a) public { members.push(a); }
      function reg(bytes note) external returns (bool) {
        members.push(msg.sender); recs[1] = Rec(msg.sender, note); last = msg.sender; return true; } }
    contract C { bool ok; constructor(I i, bytes note) { ok = i.reg(note); } function read() { require(ok); } }`;
    let serial = 0x5e0;
    const coin = async (satoshis: bigint): Promise<Utxo> => {
      const utxo: Utxo = { txid: (serial++).toString(16).padStart(64, '0'), vout: 0, satoshis };
      await provider.seedUtxo(binToHex(authorLock), utxo);
      return utxo;
    };
    const deploy = async (artifact: any, extra: any = {}): Deployed => StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await coin(2_000_000n), funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
    });
    const tResult = await deploy(compileString(source, { deployer: true, genesisCalls: true, primaryContractName: 'T' } as never));
    const { Signer } = await import('../../src/index.js');
    const wallet = new Signer(alicePriv, provider);
    for (let index = 0; index < 6; index += 1) await coin(200_000n);
    // 1 + 26 + 26 + 36 bytes of members: a P2PKH sender's push fits the first chunk, the child's does not.
    const p2sh32 = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x5a), 0x87);
    for (const member of [authorLock, encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(3)), p2sh32]) {
      await (tResult.contract.connect(wallet) as any).call.add(member).send();
    }
    // 36 + 31 bytes of the record for the child, past the 60-byte inline limit; 26 + 31 for a P2PKH sender, inline.
    const note = new Uint8Array(30).fill(9);
    const cResult = await deploy(compileString(source, { deployer: true, genesisCalls: true, primaryContractName: 'C' } as never), {
      initArgs: [addressToLockScript(tResult.contract.address), note], constructorCallees: [{ contract: tResult.contract }],
    });
    const child = binToHex(addressToLockScript(cResult.contract.address));
    const state = await tResult.contract.getState() as { members?: Uint8Array[]; last?: Uint8Array };
    expect(state.members?.map((member) => binToHex(member))[3]).toBe(child);
    expect(binToHex(state.last!)).toBe(child);
    const rec = await (tResult.contract as any).recs(1n) as { who: Uint8Array; note: Uint8Array };
    expect(binToHex(rec.who)).toBe(child);
    expect(binToHex(rec.note)).toBe(binToHex(note));
  });
});
