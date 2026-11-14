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
const P = 'pragma solidcash ^0.50.0;';
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
  const deploy = async (artifact: any, initArgs: any[] = [], extra: any = {}) => {
    const fundingUtxo: Utxo = { txid: `${Math.floor(Math.random() * 1e9).toString(16).padStart(64, '0')}`, vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    return StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
      ...(initArgs.length === 0 ? {} : { initArgs }), ...extra,
    });
  };
  const tArtifact = compileString(source, { deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'T' } as never);
  const tResult = await deploy(tArtifact);
  const cArtifact = compileString(source, { deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C' } as never);
  const cResult = await deploy(cArtifact, [addressToLockScript(tResult.contract.address)], {
    constructorCallees: [{ contract: tResult.contract, args: [] }],
  });
  const last = ((await tResult.contract.getState()) as { last?: Uint8Array }).last;
  expect(last).toBeDefined();
  expect(binToHex(last as Uint8Array)).toBe(binToHex(addressToLockScript(cResult.contract.address)));
});
});
