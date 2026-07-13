import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, StatefulContract, SignatureTemplate, randomUtxo, TransactionBuilder,
} from '../../src/index.js';
import { createTestProvider, gatherUtxos, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// Postfix used as a sub-expression is lowered by hoisting the increment BEFORE the statement and reconstructing
// the pre-value as `base -/+ 1` (leftmost only). These VM-run each form with a `require` encoding the EXACT
// Solidity value; the covenant only validates if SolidCash matches Solidity (a=5 unless noted).
async function runsLocal(body: string): Promise<boolean> {
  const provider = createTestProvider();
  const contract = new Contract(compileString(`contract C(){ function f() external { ${body} } }`), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n, fee: 20000n });
  try {
    await new TransactionBuilder({ provider })
      .addInputs(utxos, contract.unlock.f())
      .addOutput({ to: contract.address, amount: 1000n })
      .addOutput({ to: contract.address, amount: changeAmount })
      .send();
    return true;
  } catch { return false; }
}

describe('postfix sub-expression reconstruction (VM values)', () => {
  it('a++ + a == 2a+1 (old + new)', async () => {
    expect(await runsLocal('int a = 5; require(a++ + a == 11); require(a == 6);')).toBe(true);
  });
  it('NOT the old 2a miscompile', async () => {
    expect(await runsLocal('int a = 5; require(a++ + a == 10);')).toBe(false); // 10 would be the old bug
  });
  it('a-- - a == 1 (old - new)', async () => {
    expect(await runsLocal('int a = 5; require(a-- - a == 1); require(a == 4);')).toBe(true);
  });
  it('leftmost with a later read: a++ * a == old*new', async () => {
    expect(await runsLocal('int a = 5; require(a++ * a == 30); require(a == 6);')).toBe(true); // 5*6
  });
  it('uint8 a++ + a == 11 (bounded type - no UnequalType)', async () => {
    expect(await runsLocal('uint8 a = 5; require(a++ + a == 11);')).toBe(true);
  });
  it('prefix ++a + a == 2(a+1) (unchanged)', async () => {
    expect(await runsLocal('int a = 5; require(++a + a == 12); require(a == 6);')).toBe(true);
  });
  it('single-use x = a++ still yields the pre-value (unchanged)', async () => {
    expect(await runsLocal('int a = 5; int x = a++; require(x == 5); require(a == 6);')).toBe(true);
  });
});

// State var + mapping lvalues exercise the complex-lvalue reconstruction (base = this.s / m[k]).
describe('postfix reconstruction on state / mapping lvalues (VM)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  async function deploy(src: string, init: Record<string, any>): Promise<StatefulContract> {
    const artifact = compileString(src, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, init, { saltContract: true });
    return StatefulContract.withCategory(contract, categoryId);
  }

  it('this.s++ + this.s == old + new on-chain', async () => {
    const sc = await deploy(
      'pragma solidcash >=0.8.0; contract C() { uint256 s; '
      + 'function check(pubkey pk, sig sg) { require(checkSig(sg, pk)); require(this.s++ + this.s == 11); } }',
      { s: 5n },
    );
    await expect(sc.check(alicePub, sig()).send()).resolves.toBeDefined();
  });
});
