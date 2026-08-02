import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { bigIntToVmNumber, binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// ADVERSARIAL SELF-AUDIT. Each test builds an ATTACK transaction and runs it on the real BCH-2026 VM.
// A test named "FINDING" asserts the attack SUCCEEDS (a real hole in the spike covenants). A test named
// "SAFE" asserts it is rejected (a defense holds). These run against the compact binding covenant, which
// is the shared base of every later spike, so a hole here propagates.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);

function makeCompact(n: number): string {
  const params: string[] = [];
  const body: string[] = [];
  for (let i = 0; i < n; i += 1) {
    params.push(`bigint input${i}, bigint output${i}`);
    body.push(`bytes u${i} = tx.inputs[input${i}].unlockingBytecode;`);
    body.push(`require(u${i}.slice(0, 5) == hex"0453434231");`);
    body.push(`bytes lbc${i} = tx.inputs[input${i}].lockingBytecode;`);
    body.push(`require(tx.inputs[input${i}].tokenCategory.slice(32, 33) == hex"02");`);
    body.push(`require(tx.outputs[output${i}].lockingBytecode == lbc${i});`);
    body.push(`require(tx.outputs[output${i}].tokenCategory == tx.inputs[input${i}].tokenCategory);`);
    body.push(`bigint hi${i} = int(bytes.concat(lbc${i}.slice(2, 18).reverse(), hex"01"));`);
    body.push(`bigint lo${i} = int(bytes.concat(lbc${i}.slice(18, 34).reverse(), hex"01"));`);
  }
  for (let i = 0; i + 1 < n; i += 1) {
    body.push(`require(hi${i} < hi${i + 1} || (hi${i} == hi${i + 1} && lo${i} < lo${i + 1}));`);
  }
  body.push('bigint l0 = int(bytes.concat(u0.slice(5, 6), hex"00"));');
  body.push('bigint a = 6 + l0;');
  body.push('bigint l1 = int(bytes.concat(u0.slice(a, a + 1), hex"00"));');
  body.push('bigint rp = a + 1 + l1;');
  body.push('require(u0.slice(rp, rp + 1) == hex"4d");');
  for (let i = 0; i < n; i += 1) body.push(`require(u${i}.slice(rp + 3, rp + 13) == hex"${PREFIX10}");`);
  const members = Array.from({ length: n }, (_u, i) => `this.activeInputIndex == input${i}`);
  body.push(`require(${members.join(' || ')});`);
  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${params.join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

async function setup(n: number, branded = true): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(makeCompact(n), {
    forceStateful: true, hiddenBatch: true, __testLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!;
  const opts = branded ? { provider, salt: brand } : { provider };
  const parts: { setup: any; contract: Contract }[] = [];
  for (let i = 0; i < n; i += 1) {
    const inner = new Contract(artifact, [], opts);
    const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    parts.push({ setup: s, contract: inner.withCategory(hexToBin(s.categoryId)) });
  }
  parts.sort((x, y) => (BigInt(`0x${x.contract.lockingBytecode}`) < BigInt(`0x${y.contract.lockingBytecode}`) ? -1 : 1));
  return { provider, route, sel, handler, parts, n };
}

function blobFor(s: any, indices: [number, number][]): Uint8Array {
  const argParts: Uint8Array[] = [];
  for (const [inp, out] of indices) argParts.push(bigIntToVmNumber(BigInt(inp)), bigIntToVmNumber(BigInt(out)));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  return concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));
const send = (s: any, b: TransactionBuilder): Promise<string> => s.provider.sendRawTransaction(rawOf(b));

describe('layer-3 adversarial self-audit (compact binding)', () => {
  it('BASELINE: the honest 2-participant transcript is accepted', async () => {
    const s = await setup(2);
    const blob = blobFor(s, [[0, 0], [1, 1]]);
    const b = new TransactionBuilder({ provider: s.provider });
    b.addInput(s.parts[0].setup.masterUtxo, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
    b.addInput(s.parts[1].setup.masterUtxo, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
    const fee = await createFeeFunder(s.provider, 30000n);
    b.addInput(fee.utxo, fee.unlocker);
    for (let i = 0; i < 2; i += 1) {
      b.addOutput({
        to: s.parts[i].contract.tokenAddress, amount: s.parts[i].setup.masterUtxo.satoshis,
        token: { category: s.parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    }
    b.addOutput({ to: s.parts[0].contract.address, amount: 2000n });
    await expect(send(s, b)).resolves.toBeTypeOf('string');
  });

  // ATTACK 1: recreate a participant master at a LOWER satoshi value; pocket the difference. The binding
  // checks lockingBytecode + tokenCategory but NOT tx.outputs[i].value.
  it('value drain: recreate participant at dust value, keep the rest', async () => {
    const s = await setup(2);
    const blob = blobFor(s, [[0, 0], [1, 1]]);
    const b = new TransactionBuilder({ provider: s.provider, allowImplicitNftBurn: true });
    b.addInput(s.parts[0].setup.masterUtxo, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
    b.addInput(s.parts[1].setup.masterUtxo, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
    const fee = await createFeeFunder(s.provider, 20000n); // covers the ~7 KB tx fee
    b.addInput(fee.utxo, fee.unlocker);
    // participant 0 recreated with only 1000 sats (was 10000); the drained 9000 goes to the attacker output.
    b.addOutput({
      to: s.parts[0].contract.tokenAddress, amount: 1000n,
      token: { category: s.parts[0].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    b.addOutput({
      to: s.parts[1].contract.tokenAddress, amount: s.parts[1].setup.masterUtxo.satoshis,
      token: { category: s.parts[1].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    b.addOutput({ to: s.parts[0].contract.address, amount: 21000n }); // attacker output (includes drained 9000)
    const result = await send(s, b).then(() => 'ACCEPTED').catch((e) => `REJECTED: ${String(e).slice(0, 60)}`);
    // SAFE - but note the defense is the STATEFUL covenant's built-in protected-satoshis invariant, NOT the
    // binding (which checks lockingBytecode + category only). The binding relies on forceStateful for value.
    expect(result).toContain('REJECTED');
  });

  // ATTACK 2: co-spend a THIRD participant-covenant input not named in the 2-row blob.
  it('extra unnamed participant input', async () => {
    const s = await setup(2);
    const extra = new Contract((s.parts[0].contract as any).artifact, [], { provider: s.provider, salt: brand });
    const extraSetup = await setupStatefulUtxos(s.provider, extra, (s.parts[0].contract as any).artifact.stateLayout!, {});
    const extraC = extra.withCategory(hexToBin(extraSetup.categoryId));
    const blob = blobFor(s, [[0, 0], [1, 1]]);
    const b = new TransactionBuilder({ provider: s.provider, allowImplicitNftBurn: true });
    b.addInput(s.parts[0].setup.masterUtxo, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
    b.addInput(s.parts[1].setup.masterUtxo, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
    b.addInput(extraSetup.masterUtxo, extraC.createCompilerRouteUnlocker(s.route, s.sel)(blob)); // input 2, unnamed
    const fee = await createFeeFunder(s.provider, 30000n);
    b.addInput(fee.utxo, fee.unlocker);
    for (let i = 0; i < 2; i += 1) {
      b.addOutput({
        to: s.parts[i].contract.tokenAddress, amount: s.parts[i].setup.masterUtxo.satoshis,
        token: { category: s.parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    }
    b.addOutput({ to: s.parts[0].contract.address, amount: 2000n });
    const result = await send(s, b).then(() => 'ACCEPTED').catch((e) => `REJECTED: ${String(e).slice(0, 50)}`);
    // SAFE - the extra input runs __layer3_bind, its membership check (activeInputIndex in {input0,input1})
    // fails for index 2, so its own covenant rejects and the tx fails.
    expect(result).toContain('REJECTED');
  });

  // ATTACK 3: alias input0 == input1 (same participant counted twice).
  it('input aliasing (input0 == input1)', async () => {
    const s = await setup(2);
    const blob = blobFor(s, [[0, 0], [0, 0]]); // both rows point at input 0 / output 0
    const b = new TransactionBuilder({ provider: s.provider, allowImplicitNftBurn: true });
    b.addInput(s.parts[0].setup.masterUtxo, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
    b.addInput(s.parts[1].setup.masterUtxo, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
    const fee = await createFeeFunder(s.provider, 30000n);
    b.addInput(fee.utxo, fee.unlocker);
    for (let i = 0; i < 2; i += 1) {
      b.addOutput({
        to: s.parts[i].contract.tokenAddress, amount: s.parts[i].setup.masterUtxo.satoshis,
        token: { category: s.parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    }
    b.addOutput({ to: s.parts[0].contract.address, amount: 2000n });
    const result = await send(s, b).then(() => 'ACCEPTED').catch((e) => `REJECTED: ${String(e).slice(0, 50)}`);
    // SAFE - canonical order requires hi0 < hi1 (strict); input0==input1 gives hi0==hi1 && lo0==lo1, so
    // neither branch holds and distinctness is enforced.
    expect(result).toContain('REJECTED');
  });
});
