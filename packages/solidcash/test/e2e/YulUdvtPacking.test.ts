import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Yul assembly operating on UDVT-typed operands: a UDVT is a raw word inside assembly, so it is unwrapped to
// its underlying type when read and the assembled word is narrowed + re-wrapped when written (the optimism
// LibClock pattern packs a Duration + Timestamp into a Clock via shl/or, and unpacks via shr). VM-verifies the
// bit-packing round-trips: wrap(d,t) then duration()/timestamp() return d and t.
const SOURCE = `
type Duration is uint64;
type Timestamp is uint64;
type Clock is uint128;
library LibClock {
    function wrap(Duration _duration, Timestamp _timestamp) internal pure returns (Clock clock_) {
        assembly { clock_ := or(shl(0x40, _duration), _timestamp) }
    }
    function duration(Clock _clock) internal pure returns (Duration duration_) {
        assembly { duration_ := shr(0x40, _clock) }
    }
    function timestamp(Clock _clock) internal pure returns (Timestamp timestamp_) {
        assembly { timestamp_ := shr(0xC0, shl(0xC0, _clock)) }
    }
}
contract UdvtClock {
    function verify(uint64 d, uint64 t, uint64 expectedD, uint64 expectedT) {
        Clock c = LibClock.wrap(Duration.wrap(d), Timestamp.wrap(t));
        require(Duration.unwrap(LibClock.duration(c)) == expectedD);
        require(Timestamp.unwrap(LibClock.timestamp(c)) == expectedT);
    }
}
`;

describe('Yul assembly bit-packing over UDVT operands (LibClock)', () => {
  const artifact = compileString(SOURCE, { forceStateful: true });

  it('wrap then unpack round-trips duration + timestamp (7, 999)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.verify(7n, 999n, 7n, 999n)).resolves.toBeDefined();
  });

  it('a wrong expected duration fails (the shl/or/shr packing actually ran)', async () => {
    const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(sc.verify(7n, 999n, 8n, 999n)).rejects.toThrow();
  });
});
