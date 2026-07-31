import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// An enum mapping key (`mapping(Status => uint256)`) is int-backed - stored as the enum member's integer. The
// key is passed as its integer index (Status.Active == 1), exactly like an enum function parameter.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  enum Status { Pending, Active, Closed }
  mapping(Status => uint256) counts;
  function set(Status k, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); counts[k] = v; }
  function get(Status k, uint256 e) { require(counts[k] == e); }
}`;

describe('enum mapping key (int-backed)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('exposes the enum key name in the ABI', () => {
    const art = compileString(SRC, { solidityImportCompat: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setFn = art.abi.find((f: any) => f.name === 'set') as any;
    expect(setFn.inputs[0].type).toBe('Status');
  });

  it('write with Status.Active(1) then read back', async () => {
    const art = compileString(SRC, { solidityImportCompat: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.set(1n, 42n, alicePub, sig()).send(); // counts[Status.Active] = 42
    await sc.get(1n, 42n).send();                   // reads 42 back
    await expect(sc.get(1n, 7n).send()).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
    await sc.get(0n, 0n).send();                     // a distinct key (Pending) is still the default 0
  });
});
