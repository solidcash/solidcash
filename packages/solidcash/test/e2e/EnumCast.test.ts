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

const artifact = compileString(SOURCE, { forceStateful: true });

describe('Enum <-> int casts', () => {
  it('round-trips a valid enum value (Color(2) -> int 2)', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.roundtrip(2n)).resolves.toBeDefined();
  });
  it('range-checks int -> enum (Color(99) is out of range and fails)', async () => {
    const sc = await deployStateful(artifact);
    await expect(sc.roundtrip(99n)).rejects.toThrow();
  });
});
