import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// Pins the canonical front-region order of the stateful block layout before the unified auxiliary-band
// refactor: master + dataNft first, then every auxiliary co-spend family (external read, blockhash oracle,
// block-info oracle, keccak side-car, ecrecover side-car) in one contiguous band. External-call reservations
// advance the offset without producing a slot, so they must not appear in `slots`; the entries/transfer/event
// tail must contain no auxiliary kind.

const SOURCE = `
pragma solidcash ^0.51.0;

interface ICounter {
    public int counter;
    function getAndIncrement() returns (int);
}

contract AuxBand(bytes counterAddr) {
    int last;

    function run(bytes32 x, bytes32 h, bytes32 r, bytes32 s, int n, bytes32 expect) {
        require(blockhash(n) == expect);
        require(block.timestamp >= 0);
        bytes32 kh = keccak256(x);
        address recovered = ecrecover(h, 1, r, s);
        int val = ICounter(counterAddr).counter;
        int result = ICounter(counterAddr).getAndIncrement();
        this.last = val + result;
        require(recovered != address(0) && kh != bytes32(0));
    }
}
`;

const AUX_KINDS = [
  'lowLevelCall',
  'readOnlyDataNft',
  'blockhashOracle',
  'blockInfoOracle',
  'keccakSideCar',
  'ecrecoverSideCar',
] as const;

describe('block layout: unified auxiliary front band', () => {
  it('places every auxiliary family in one contiguous front band after master + dataNft', () => {
    const artifact = compileString(SOURCE, { ecrecover: 'p2pkh' });
    const fn = artifact.abi.find((entry) => entry.name === 'run');
    expect(fn?.blockLayout).toBeDefined();
    const slots = fn!.blockLayout!.slots;

    // Master stays at offset 0.
    expect(slots[0]).toMatchObject({ kind: 'master', offset: 0 });

    // One packed int state variable -> one data NFT immediately after master.
    const dataNftCount = slots.filter((slot) => slot.kind === 'dataNft').length;
    expect(dataNftCount).toBe(1);
    expect(slots[1]).toMatchObject({ kind: 'dataNft', offset: 1 });

    const bandBase = 1 + dataNftCount;
    expect(bandBase).toBe(2);

    // The auxiliary band is contiguous: canonical order, consecutive offsets, then a tail with no aux kind.
    const auxEnd = slots.findIndex((slot, index) => index >= bandBase && !AUX_KINDS.includes(slot.kind as any));
    const band = slots.slice(bandBase, auxEnd === -1 ? undefined : auxEnd);
    expect(band.map((slot) => slot.kind)).toEqual([
      'readOnlyDataNft',
      'blockhashOracle',
      'blockInfoOracle',
      'keccakSideCar',
      'ecrecoverSideCar',
      'ecrecoverSideCar',
      'ecrecoverSideCar',
    ]);
    expect(band.map((slot) => slot.offset)).toEqual([2, 3, 4, 5, 6, 7, 8]);

    // No auxiliary kind appears before the band (after master/dataNft) or elsewhere in the tail.
    const tail = auxEnd === -1 ? [] : slots.slice(auxEnd);
    for (const slot of [...slots.slice(1, bandBase), ...tail]) {
      expect(AUX_KINDS.includes(slot.kind as any), `auxiliary slot ${slot.kind} leaked outside the band`).toBe(false);
    }

    // The external read is index 0; keccak is slot 0; ecrecover is one A/M/B triple.
    expect(band[0]).toMatchObject({ kind: 'readOnlyDataNft', slotIndex: 0 });
    expect(band[3]).toMatchObject({ kind: 'keccakSideCar', slotIndex: 0 });
    expect(band.slice(4).map((slot) => slot.slotIndex)).toEqual([0, 1, 2]);
  });
});

// A stateful entry whose every recovery runs in its loop reserves no recovery slot: iteration k reads its triple at
// master + blockSize + 3k, after the block. A recovery outside the loop keeps the fixed band, and the shapes that
// would read the same region twice are refused.
describe('block layout: a recovery loop reads its triples after the block', () => {
  const P = 'pragma solidcash ^0.51.0;';
  const compileT = (body: string, params = 'pubkey owner'): ReturnType<typeof compileString> => compileString(
    `${P} contract T(${params}) { int n; mapping(int => int) m; ${body} }`,
    { messageBus: false, primaryContractName: 'T' } as never,
  );
  const loopArgs = 'bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k';
  const recover = (projection = 'ecrecoverPubKey', compare = '== owner'): string => (
    `require(${projection}(h[i], v[i], r[i], s[i]) ${compare});`);
  const layoutOf = (artifact: ReturnType<typeof compileString>): { kinds: string[]; trailing?: boolean } => {
    const fn = artifact.abi.find((entry) => entry.name === 'f')!;
    return { kinds: fn.blockLayout!.slots.map((slot) => slot.kind), trailing: fn.ecrecoverTrailingLoop };
  };

  it('reserves no recovery slot, nor a keccak slot for an ecrecoverEvm projection, for a loop', () => {
    const pubkey = compileT(`function f(${loopArgs}) external returns (bool) {
      for (int i = 0; i < k; i++) { ${recover()} } n = n + 1; return true; }`);
    expect(layoutOf(pubkey)).toEqual({ kinds: ['master', 'dataNft', 'returnEvent'], trailing: true });
    const evm = compileT(`function f(${loopArgs}) external returns (bool) {
      for (int i = 0; i < k; i++) { ${recover('ecrecoverEvm')} } n = n + 1; return true; }`, 'bytes20 owner');
    expect(layoutOf(evm)).toEqual({ kinds: ['master', 'dataNft', 'returnEvent'], trailing: true });
    // A digest hashed before the loop keeps its fixed keccak slot.
    const digest = compileT(`function f(bytes32 x, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
      bytes32 d = keccak256(x);
      for (int i = 0; i < k; i++) { require(ecrecoverPubKey(d, v[i], r[i], s[i]) == owner); } n = n + 1; return true; }`);
    expect(layoutOf(digest)).toEqual({ kinds: ['master', 'dataNft', 'keccakSideCar', 'returnEvent'], trailing: true });
    // A recovery outside any loop keeps its triple in the block.
    const straight = compileT(`function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
      require(ecrecoverPubKey(h, v, r, s) == owner); n = n + 1; return true; }`);
    expect(layoutOf(straight)).toEqual({
      kinds: ['master', 'dataNft', 'ecrecoverSideCar', 'ecrecoverSideCar', 'ecrecoverSideCar', 'returnEvent'],
      trailing: undefined,
    });
  });

  it('refuses a loop beside a recovery outside it, a second loop, or another user of the region', () => {
    const refusal = (body: string): string => {
      try {
        compileT(body);
      } catch (error) {
        return (error as Error).message;
      }
      return 'compiled';
    };
    expect(refusal(`function f(${loopArgs}) external returns (bool) {
      require(ecrecoverPubKey(h[0], v[0], r[0], s[0]) == owner);
      for (int i = 0; i < k; i++) { ${recover()} } return true; }`))
      .toMatch(/^recovery-loop-and-fixed-recovery-mix-not-enabled: /);
    expect(refusal(`function f(${loopArgs}) external returns (bool) {
      for (int i = 0; i < k; i++) { ${recover()} } for (int i = 0; i < k; i++) { ${recover()} } return true; }`))
      .toMatch(/^recovery-loop-twice-not-enabled: /);
    expect(refusal(`function f(${loopArgs}, bytes b) external returns (bool) {
      for (int i = 0; i < k; i++) { require(keccak256(b) != 0x); ${recover()} } return true; }`))
      .toMatch(/^recovery-loop-shares-trailing-band: /);
    expect(refusal(`function f(${loopArgs}, int[] keys) external returns (bool) {
      for (int i = 0; i < k; i++) { ${recover()} } for (int j = 0; j < k; j++) { m[keys[j]] = 1; } return true; }`))
      .toMatch(/^recovery-loop-shares-trailing-band: .*\(here: mapping entries written in a loop\)/);
  });

  it('gives a recovery a helper makes in a loop the loop\'s triples, inlined into the entry', () => {
    const helper = (body: string, params = 'pubkey owner'): ReturnType<typeof layoutOf> => layoutOf(compileT(body, params));
    // A returning helper called in the loop, a void helper that calls one, and a helper holding the loop itself.
    expect(helper(`function rec(bytes32 h, int v, bytes32 r, bytes32 s) private returns (pubkey) {
        return ecrecoverPubKey(h, v, r, s); }
      function f(${loopArgs}) external returns (bool) {
        for (int i = 0; i < k; i++) { require(rec(h[i], v[i], r[i], s[i]) == owner); } n = n + 1; return true; }`))
      .toEqual({ kinds: ['master', 'dataNft', 'returnEvent'], trailing: true });
    expect(helper(`function signer(bytes32 h, int v, bytes32 r, bytes32 s) private pure returns (bytes20) {
        return ecrecoverEvm(h, v, r, s); }
      function check(bytes32 h, int v, bytes32 r, bytes32 s) private { require(signer(h, v, r, s) == owner); }
      function f(${loopArgs}) external returns (bool) {
        for (int i = 0; i < k; i++) { check(h[i], v[i], r[i], s[i]); } n = n + 1; return true; }`, 'bytes20 owner'))
      .toEqual({ kinds: ['master', 'dataNft', 'returnEvent'], trailing: true });
    expect(helper(`function all(bytes32[] h, int[] v, bytes32[] r, bytes32[] s, int k) private returns (bool) {
        for (int i = 0; i < k; i++) { require(ecrecoverPubKey(h[i], v[i], r[i], s[i]) == owner); } return true; }
      function f(${loopArgs}) external returns (bool) { require(all(h, v, r, s, k)); n = n + 1; return true; }`))
      .toEqual({ kinds: ['master', 'dataNft', 'returnEvent'], trailing: true });
    // Behind `||`, reduced in place with element reads for arguments; and a helper with an early return.
    expect(helper(`function rec(bytes32 h, int v, bytes32 r, bytes32 s) private returns (pubkey) {
        return ecrecoverPubKey(h, v, r, s); }
      function f(${loopArgs}, bool skip) external returns (bool) {
        for (int i = 0; i < k; i++) { require(skip || rec(h[i], v[i], r[i], s[i]) == owner); } n = n + 1; return true; }`))
      .toEqual({ kinds: ['master', 'dataNft', 'returnEvent'], trailing: true });
    expect(helper(`function signer(bytes32 h, int v, bytes32 r, bytes32 s) private pure returns (bytes20) {
        if (v != 27 && v != 28) { return bytes20(0); } return ecrecoverEvm(h, v, r, s); }
      function f(${loopArgs}) external returns (bool) {
        for (int i = 0; i < k; i++) { require(signer(h[i], v[i], r[i], s[i]) == owner); } n = n + 1; return true; }`,
    'bytes20 owner')).toEqual({ kinds: ['master', 'dataNft', 'returnEvent'], trailing: true });
    // A helper called outside any loop keeps its triple in the block.
    expect(helper(`function rec(bytes32 h, int v, bytes32 r, bytes32 s) private returns (pubkey) {
        return ecrecoverPubKey(h, v, r, s); }
      function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
        require(rec(h, v, r, s) == owner); n = n + 1; return true; }`))
      .toEqual({
        kinds: ['master', 'dataNft', 'ecrecoverSideCar', 'ecrecoverSideCar', 'ecrecoverSideCar', 'returnEvent'],
        trailing: undefined,
      });
    // A helper returning from both arms of a branch is not inlined: the loop reads its fixed triples, so a callee of a
    // constructor's call with it is refused (DeployerCalleeShapes).
    const kept = compileT(`function rec(bytes32 h, int v, bytes32 r, bytes32 s) private returns (pubkey) {
        if (v == 27) { return ecrecoverPubKey(h, 27, r, s); } else { return ecrecoverPubKey(h, 28, r, s); } }
      function f(${loopArgs}) external returns (bool) {
        for (int i = 0; i < k; i++) { require(rec(h[i], v[i], r[i], s[i]) == owner); } n = n + 1; return true; }`);
    expect(layoutOf(kept).trailing).toBeUndefined();
    expect(kept.abi.find((entry) => entry.name === 'f')!.ecrecoverLoopReads).toBe(true);
    // The same helper in the loop and outside it is the refused mix once inlined.
    expect(() => compileT(`function rec(bytes32 h, int v, bytes32 r, bytes32 s) private returns (pubkey) {
        return ecrecoverPubKey(h, v, r, s); }
      function f(${loopArgs}) external returns (bool) {
        require(rec(h[0], v[0], r[0], s[0]) == owner);
        for (int i = 0; i < k; i++) { require(rec(h[i], v[i], r[i], s[i]) == owner); } n = n + 1; return true; }`))
      .toThrow(/^recovery-loop-and-fixed-recovery-mix-not-enabled: /);
  });

  it('lays a recovery loop\'s triples after the chained side-cars of an unbounded keccak256, in either order', () => {
    const before = compileT(`function f(bytes payload, int[] v, bytes32[] r, bytes32[] s, int k) external returns (bool) {
      bytes32 d = keccak256(payload);
      for (int i = 0; i < k; i++) { require(ecrecoverPubKey(d, v[i], r[i], s[i]) == owner); } n = n + 1; return true; }`);
    expect(layoutOf(before)).toEqual({ kinds: ['master', 'dataNft', 'returnEvent'], trailing: true });
    expect(before.abi.find((entry) => entry.name === 'f')!.keccakChainReads).toBe(true);
    const after = compileT(`function f(bytes payload, bytes32 d, ${loopArgs}) external returns (bool) {
      for (int i = 0; i < k; i++) { ${recover()} } require(keccak256(payload) == d); n = n + 1; return true; }`);
    expect(layoutOf(after)).toEqual({ kinds: ['master', 'dataNft', 'returnEvent'], trailing: true });
    expect(after.abi.find((entry) => entry.name === 'f')!.keccakChainReads).toBe(true);
    // A parameter the function writes could have another length where the loop counts its chain.
    expect(() => compileT(`function f(bytes payload, bytes32 d, ${loopArgs}) external returns (bool) {
      require(keccak256(payload) == d); payload = 0x01;
      for (int i = 0; i < k; i++) { ${recover()} } n = n + 1; return true; }`))
      .toThrow(/^recovery-loop-shares-trailing-band: .*\(here: a chained keccak256 of a value whose length the loop/);
  });
});
