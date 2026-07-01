import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// int -> enum (Color(i), range-checked) and enum -> int (int(c)) explicit casts.
const SOURCE = `
contract EnumCast() {
    enum Color { Red, Green, Blue }
    function roundtrip(int i) {
        Color c = Color(i);   // int -> enum, range-checked (0..2)
        int back = int(c);    // enum -> int
        require(back == i);
    }
}
`;

async function spend(arg: bigint): Promise<unknown> {
  const sc = await deployStateful(compileString(SOURCE, { forceStateful: true }));
  return sc.call.roundtrip(arg); // thenable: the caller awaits, which sends
}

describe('Enum <-> int casts', () => {
  it('round-trips a valid enum value (Color(2) -> int 2)', async () => {
    await expect(spend(2n)).resolves.toBeDefined();
  });
  it('range-checks int -> enum (Color(99) is out of range and fails)', async () => {
    await expect(spend(99n)).rejects.toThrow();
  });
});
