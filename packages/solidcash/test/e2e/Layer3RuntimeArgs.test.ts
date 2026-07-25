import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin, sha256 } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// HONEST SCOPE (corrected per layer3-required-path-audit.md P4): this is a BESPOKE covenant that hand-writes
// its own preimage formula - it is NOT the module protocol. `ExecutionInvocation`/`executionRoot`/
// `executionMemberBody` still carry no argument/result rows, so this proves only that ONE custom amount/result
// formula can be covenanted and authenticated (callee checks result == amount * rate from its state; a wrong
// result is rejected). Folding runtime args/results into the framed module encoder is unimplemented.
const SELECTOR = 'aabbccdd';
const raw = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const cat = (provider: any, category: string, commitment: string): any => randomUtxo({
  satoshis: 4000n, token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
});

// caller (input 0) + callee (input 1) + controller (input 2). Both bake the controller identity + selector;
// amount/result arrive as runtime unlock args. The callee reads V from its own state commitment (input 1).
function edgeRootChecks(ctrlCatInternal: string, ctrlLbc: string, selfPos: number): string {
  return `
    bytes lbc0 = tx.inputs[0].lockingBytecode;
    bytes lbc1 = tx.inputs[1].lockingBytecode;
    bytes edge = bytes.concat(bytes.concat(bytes.concat(lbc0, lbc1), hex"${SELECTOR}"), bytes.concat(bytes8(amount), bytes8(result)));
    bytes execRoot = sha256(bytes.concat(bytes.concat(hex"${layer3.EXEC_DOMAIN}", bytes.concat(lbc0, lbc1)), edge));
    require(tx.inputs[2].tokenCategory.slice(0, 32) == hex"${ctrlCatInternal}");
    require(tx.inputs[2].lockingBytecode == hex"${ctrlLbc}");
    require(tx.inputs[2].nftCommitment == execRoot);
    require(tx.outputs[2].nftCommitment == tx.inputs[2].nftCommitment);
    require(tx.outputs[2].value == tx.inputs[2].value);
    require(this.activeInputIndex == ${selfPos});`;
}

async function setup(): Promise<any> {
  const provider = createTestProvider();
  const controller = new Contract(compileString(layer3.generateControllerCovenant()), [alicePkh], { provider });
  const ctrlLbc = controller.lockingBytecode;
  const genesis = await (provider as any).addTokenUtxosDynamic((_c: string) => [
    { address: controller.tokenAddress, satoshis: 5000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  ]);
  const ctrlCat: string = genesis.categoryId;
  const ctrlCatInternal = (ctrlCat.match(/../g) as string[]).reverse().join('');
  const callerSrc = `pragma solidcash >=0.8.0;
contract Caller() {
  function invoke(int amount, int result) {${edgeRootChecks(ctrlCatInternal, ctrlLbc, 0)}
  }
}`;
  const calleeSrc = `pragma solidcash >=0.8.0;
contract Callee() {
  function serve(int amount, int result) {
    bigint rate = int(tx.inputs[1].nftCommitment.slice(0, 8));
    require(result == amount * rate);${edgeRootChecks(ctrlCatInternal, ctrlLbc, 1)}
  }
}`;
  const caller = new Contract(compileString(callerSrc), [], { provider });
  const callee = new Contract(compileString(calleeSrc), [], { provider });
  return { provider, controller, ctrlCat, ctrlCatInternal, ctrlLbc, caller, callee, genesis };
}

async function run(s: any, amount: bigint, result: bigint, rate: bigint): Promise<string> {
  const callerLbc = s.caller.lockingBytecode; const calleeLbc = s.callee.lockingBytecode;
  // execution root over the runtime edge (deployer precomputes for the deterministic transcript).
  const parts = [hexToBin(layer3.EXEC_DOMAIN), hexToBin(callerLbc), hexToBin(calleeLbc),
    hexToBin(callerLbc), hexToBin(calleeLbc), hexToBin(SELECTOR), num8(amount), num8(result)];
  const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let c = 0; for (const p of parts) { buf.set(p, c); c += p.length; }
  const root = binToHex(sha256.hash(buf));
  const p2c = new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider });
  // setRoot on the controller.
  const setB = new TransactionBuilder({ provider: s.provider });
  setB.addInput(s.genesis.utxos[0], s.controller.unlock.setRoot(hexToBin(root), alicePub, sig()));
  const setFee = randomUtxo({ satoshis: 20000n }); await s.provider.addUtxo(p2c.address, setFee);
  setB.addInput(setFee, p2c.unlock.spend(alicePub, sig()));
  setB.addOutput({
    to: s.controller.tokenAddress, amount: s.genesis.utxos[0].satoshis,
    token: { category: s.ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  setB.addOutput({ to: p2c.address, amount: 15000n });
  await s.provider.sendRawTransaction(raw(setB));
  const ctrlUtxos = await s.provider.getUtxos(s.controller.tokenAddress);
  const ctrlUtxo = ctrlUtxos.find((u: any) => u.token?.nft?.commitment === root);
  // transcript: caller (0), callee-with-state (1), controller (2), fee (3).
  const stateCat = 'dd'.repeat(32); // the callee's OWN state category (distinct from the controller)
  const callerUtxo = randomUtxo({ satoshis: 3000n }); await s.provider.addUtxo(s.caller.address, callerUtxo);
  const calleeUtxo = cat(s.provider, stateCat, binToHex(num8(rate))); await s.provider.addUtxo(s.callee.address, calleeUtxo);
  const fee = randomUtxo({ satoshis: 50000n }); await s.provider.addUtxo(p2c.address, fee);
  const b = new TransactionBuilder({ provider: s.provider });
  b.addInput(callerUtxo, s.caller.unlock.invoke(amount, result));
  b.addInput(calleeUtxo, s.callee.unlock.serve(amount, result));
  b.addInput(ctrlUtxo, s.controller.unlock.attest());
  b.addInput(fee, p2c.unlock.spend(alicePub, sig()));
  b.addOutput({ to: p2c.address, amount: 1000n });
  b.addOutput({ // recreate the callee's state NFT (preserve it - no implicit burn)
    to: s.callee.tokenAddress, amount: calleeUtxo.satoshis,
    token: { category: stateCat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num8(rate)) } },
  });
  b.addOutput({
    to: s.controller.tokenAddress, amount: ctrlUtxo.satoshis,
    token: { category: s.ctrlCat, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  b.addOutput({ to: p2c.address, amount: 12000n });
  return raw(b);
}

describe('R5: runtime argument/result binding + callee-authenticated result', () => {
  it('POSITIVE: amount=5, rate=3 => result=15 is bound in the transcript and authenticated by the callee', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(await run(s, 5n, 15n, 3n))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a wrong result (14 != 5*3) is rejected (callee computation + root both fail)', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(await run(s, 5n, 14n, 3n))).rejects.toThrow();
  });
});
