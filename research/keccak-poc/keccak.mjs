// JS keccak reference (BigInt lanes, flat index i = x + 5*y) - the oracle for the script generator.
export const MASK = (1n << 64n) - 1n;
export const RC = [
  0x0000000000000001n,0x0000000000008082n,0x800000000000808an,0x8000000080008000n,
  0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,
  0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,
  0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,
  0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,
  0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n,
];
// rotation offsets r[x][y]
export const R = [[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
export const rotl = (x, n) => (n === 0 ? x : (((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK));

export function keccakF(A, rounds = 24) {
  for (let round = 0; round < rounds; round++) {
    const C = [0n,0n,0n,0n,0n];
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x+5] ^ A[x+10] ^ A[x+15] ^ A[x+20];
    const D = [0n,0n,0n,0n,0n];
    for (let x = 0; x < 5; x++) D[x] = C[(x+4)%5] ^ rotl(C[(x+1)%5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x+5*y] ^= D[x];
    const B = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5*((2*x+3*y)%5)] = rotl(A[x+5*y], R[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      A[x+5*y] = (B[x+5*y] ^ ((~B[((x+1)%5)+5*y] & B[((x+2)%5)+5*y]) & MASK)) & MASK;
    }
    A[0] ^= RC[round];
  }
  return A;
}

// keccak256 sponge: rate 136 bytes, Ethereum pad (0x01 ... 0x80).
export function keccak256(msg) {
  const rate = 136;
  const A = new Array(25).fill(0n);
  const padded = [...msg];
  padded.push(0x01);
  while (padded.length % rate !== 0) padded.push(0x00);
  padded[padded.length - 1] |= 0x80;
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let b = 0; b < 8; b++) lane |= BigInt(padded[off + i*8 + b]) << BigInt(8*b); // little-endian
      A[i] ^= lane;
    }
    keccakF(A);
  }
  const out = [];
  for (let i = 0; i < 4; i++) for (let b = 0; b < 8; b++) out.push(Number((A[i] >> BigInt(8*b)) & 0xffn));
  return Buffer.from(out).toString('hex');
}
