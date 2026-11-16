/**
 * A14 item 3: a top-level creation derives C's outputs by running `create` itself (A4.3), not C's `__construct` arm.
 *
 * Genesis mode differs from a call (A5): `msg.value` is the deploy value, `this.balance` reads the satoshi journal,
 * and a send pins a transfer output. A derivation through `__construct` could not see any of these and oscillated on
 * a send; each case here deploys and reads back what `create` computed.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.51.0;';

async function deploy(
  source: string, args: unknown[], initialBalance: bigint, seed: string,
): Promise<{ result: Awaited<ReturnType<typeof StatefulContract.deploy>>; provider: MockNetworkProvider }> {
  clearGenesisReservations();
  const provider = new MockNetworkProvider({ profile: 'production' });
  const artifact = compileString(source, { deployer: true, messageBus: false });
  expect(artifact.deployerUnsupported).toBeUndefined();
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const fundingUtxo: Utxo = { txid: seed.repeat(32), vout: 0, satoshis: 500_000n };
  await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const result = await StatefulContract.deploy(artifact, args as never, {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: change.address, senderLockingBytecode: authorLock, initialBalance,
  } as never);
  return { result, provider };
}

describe('a top-level creation runs create to derive its outputs (A14 item 3)', () => {
  // A modifier invoked with parentheses in a constructor's header is a modifier, not a base constructor call: it
  // runs in the order the header writes it, as the bare form does.
  it.each([
    ['with parentheses', 'constructor() setx() { y = x; }'],
    ['bare', 'constructor() setx { y = x; }'],
    ['with parentheses, after a bare one', 'constructor() addy setx() { y = y + x; }'],
  ])('applies a constructor modifier written %s', async (_label, header) => {
    const { result } = await deploy(`${P} contract C { int x; int y;
      modifier setx() { x = 5; _; } modifier addy { y = 1; _; } ${header} function f() public { x = x + 1; } }`,
    [], 0n, _label === 'bare' ? 'd2' : _label === 'with parentheses' ? 'd1' : 'd3');
    const state = (await result.contract.getState()) as { x?: bigint; y?: bigint };
    expect(state.x).toBe(5n);
    expect(state.y).toBe(_label === 'with parentheses, after a bare one' ? 6n : 5n);
  }, 600_000);

  it('pins a constructor send as a transfer output, which a __construct probe could not derive', async () => {
    const to = encodeLockingBytecodeP2pkh(bobPkh);
    const { result } = await deploy(`${P} contract C(address payable to) { int n;
      constructor() payable { payable(to).send(1200); n = 1; }
      function f() public payable { n = n + 1; } }`, [to], 5000n, 'a1');
    const tx = (result as any).tx;
    expect(tx.outputs.filter((output: any) => binToHex(output.lockingBytecode) === binToHex(to))
      .map((output: any) => output.valueSatoshis)).toEqual([1200n]);
    expect(((await result.contract.getState()) as { n?: bigint }).n).toBe(1n);
  }, 600_000);

  it('records msg.value as the deploy value when C keeps its satoshi container single', async () => {
    const { result } = await deploy(`${P} pragma satoshicontainer single; contract C { int n;
      constructor() payable { n = msg.value; }
      function f() public payable { n = n + 1; } }`, [], 5000n, 'a2');
    expect(((await result.contract.getState()) as { n?: bigint }).n).toBe(5000n);
  }, 600_000);

  it('reads this.balance at birth as the journal: the start plus the value', async () => {
    const optional = await deploy(`${P} contract C { int n;
      constructor() payable { n = this.balance; }
      function f() public payable { n = n + 1; } }`, [], 5000n, 'a3');
    expect(((await optional.result.contract.getState()) as { n?: bigint }).n).toBe(5000n);
    const single = await deploy(`${P} pragma satoshicontainer single; contract C { int n;
      constructor() payable { n = this.balance; }
      function f() public payable { n = n + 1; } }`, [], 5000n, 'a4');
    expect(((await single.result.contract.getState()) as { n?: bigint }).n).toBe(6200n);
  }, 600_000);
});
