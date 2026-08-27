import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { createTestProvider, setupStatefulUtxos, getTxOutputs } from '../test-util.js';

const SOURCE = `
pragma solidcash >=0.8.0;
contract MultiPin() {
  bytes100 a;
  bytes100 b;
  bytes100 c;
  function setCross(bytes100 x, bytes100 y, bytes100 z) {
    this.a = z;
    this.b = x;
    this.c = y;
  }
  function setByName(bytes100 newB, bytes100 newA, bytes100 newC) {
    this.a = newA;
    this.b = newB;
    this.c = newC;
  }
  function setPrefixed(bytes100 setB, bytes100 setA, bytes100 setC) {
    this.a = setA;
    this.b = setB;
    this.c = setC;
  }
  function fromPrefixed(bytes100 fromB, bytes100 fromA, bytes100 fromC) {
    this.a = fromA;
    this.b = fromB;
    this.c = fromC;
  }
  function oldPrefixed(bytes100 oldB, bytes100 oldA, bytes100 oldC) {
    this.a = oldA;
    this.b = oldB;
    this.c = oldC;
  }
  function prevPrefixed(bytes100 prevB, bytes100 prevA, bytes100 prevC) {
    this.a = prevA;
    this.b = prevB;
    this.c = prevC;
  }
  function destPrefixed(bytes100 destB, bytes100 destA, bytes100 destC) {
    this.a = destA;
    this.b = destB;
    this.c = destC;
  }
  function thePrefixed(bytes100 theB, bytes100 theA, bytes100 theC) {
    this.a = theA;
    this.b = theB;
    this.c = theC;
  }
  function initPrefixed(bytes100 initB, bytes100 initA, bytes100 initC) {
    this.a = initA;
    this.b = initB;
    this.c = initC;
  }
  function srcPrefixed(bytes100 srcB, bytes100 srcA, bytes100 srcC) {
    this.a = srcA;
    this.b = srcB;
    this.c = srcC;
  }
  function tmpPrefixed(bytes100 tmpB, bytes100 tmpA, bytes100 tmpC) {
    this.a = tmpA;
    this.b = tmpB;
    this.c = tmpC;
  }
  function valPrefixed(bytes100 valB, bytes100 valA, bytes100 valC) {
    this.a = valA;
    this.b = valB;
    this.c = valC;
  }
}
`;

describe('optimistic multi-pin derivation', () => {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE);
  const inner = new Contract(artifact, [], { provider });
  const layout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    const zeros = new Uint8Array(100);
    ({ categoryId } = await setupStatefulUtxos(
      provider, inner, layout, { a: zeros, b: zeros, c: zeros }, { saltContract: true },
    ));
  });

  it('derives crossed multi-NFT assignments without one-pin-per-probe', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const x = new Uint8Array(100).fill(0x11);
    const y = new Uint8Array(100).fill(0x22);
    const z = new Uint8Array(100).fill(0x33);
    const tx = await sc.setCross(x, y, z).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    const a = parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0);
    const b = parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1);
    const c = parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2);
    expect(a.a).toEqual(z);
    expect(b.b).toEqual(x);
    expect(c.c).toEqual(y);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('matches ABI argument names onto state fields before probing', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0xaa);
    const b = new Uint8Array(100).fill(0xbb);
    const c = new Uint8Array(100).fill(0xcc);
    const tx = await sc.setByName(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips a set prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0xa1);
    const b = new Uint8Array(100).fill(0xb2);
    const c = new Uint8Array(100).fill(0xc3);
    const tx = await sc.setPrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips a from prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0xd1);
    const b = new Uint8Array(100).fill(0xd2);
    const c = new Uint8Array(100).fill(0xd3);
    const tx = await sc.fromPrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips an old prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0xe1);
    const b = new Uint8Array(100).fill(0xe2);
    const c = new Uint8Array(100).fill(0xe3);
    const tx = await sc.oldPrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips a val prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0x51);
    const b = new Uint8Array(100).fill(0x52);
    const c = new Uint8Array(100).fill(0x53);
    const tx = await sc.valPrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips a tmp prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0x41);
    const b = new Uint8Array(100).fill(0x42);
    const c = new Uint8Array(100).fill(0x43);
    const tx = await sc.tmpPrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips a src prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0x31);
    const b = new Uint8Array(100).fill(0x32);
    const c = new Uint8Array(100).fill(0x33);
    const tx = await sc.srcPrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips an init prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0x21);
    const b = new Uint8Array(100).fill(0x22);
    const c = new Uint8Array(100).fill(0x23);
    const tx = await sc.initPrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips a the prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0x11);
    const b = new Uint8Array(100).fill(0x12);
    const c = new Uint8Array(100).fill(0x13);
    const tx = await sc.thePrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips a dest prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0x01);
    const b = new Uint8Array(100).fill(0x02);
    const c = new Uint8Array(100).fill(0x03);
    const tx = await sc.destPrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });

  it('strips a prev prefix when matching ABI argument names', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const a = new Uint8Array(100).fill(0xf1);
    const b = new Uint8Array(100).fill(0xf2);
    const c = new Uint8Array(100).fill(0xf3);
    const tx = await sc.prevPrefixed(b, a, c).send();
    expect(tx.txid).toBeDefined();
    const outputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(outputs[1].token!.nft!.commitment, layout, 0).a).toEqual(a);
    expect(parsePushdataCommitment(outputs[2].token!.nft!.commitment, layout, 1).b).toEqual(b);
    expect(parsePushdataCommitment(outputs[3].token!.nft!.commitment, layout, 2).c).toEqual(c);
    expect(sc.lastDerivationIterations).toBe(1);
  });
});

describe('optimistic boolean toggle derivation', () => {
  const provider = createTestProvider();
  const artifact = compileString(`
pragma solidcash >=0.8.0;
contract Flag() {
  bool flag;
  function toggle() { this.flag = !this.flag; }
}
`);
  const inner = new Contract(artifact, [], { provider });
  const layout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    ({ categoryId } = await setupStatefulUtxos(
      provider, inner, layout, { flag: false }, { saltContract: true },
    ));
  });

  it('flips an unassigned leftover boolean on the first probe', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const tx = await sc.toggle().send();
    expect(tx.txid).toBeDefined();
    const parsed = parsePushdataCommitment(getTxOutputs(tx)[1].token!.nft!.commitment, layout, 0);
    expect(parsed.flag).toBe(true);
    expect(sc.lastDerivationIterations).toBe(1);
  });
});

describe('optimistic integer decrement derivation', () => {
  const provider = createTestProvider();
  const artifact = compileString(`
pragma solidcash >=0.8.0;
contract Lives() {
  int lives;
  function decrement() { this.lives = this.lives - 1; }
}
`);
  const inner = new Contract(artifact, [], { provider });
  const layout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    ({ categoryId } = await setupStatefulUtxos(
      provider, inner, layout, { lives: 3n }, { saltContract: true },
    ));
  });

  it('decrements leftover integers when the function name says so', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const tx = await sc.decrement().send();
    expect(tx.txid).toBeDefined();
    const parsed = parsePushdataCommitment(getTxOutputs(tx)[1].token!.nft!.commitment, layout, 0);
    expect(parsed.lives).toBe(2n);
    expect(sc.lastDerivationIterations).toBe(1);
  });
});

describe('optimistic integer reset derivation', () => {
  const provider = createTestProvider();
  const artifact = compileString(`
pragma solidcash >=0.8.0;
contract Score() {
  int score;
  function reset() { this.score = 0; }
}
`);
  const inner = new Contract(artifact, [], { provider });
  const layout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    ({ categoryId } = await setupStatefulUtxos(
      provider, inner, layout, { score: 9n }, { saltContract: true },
    ));
  });

  it('zeros leftover integers when the function name is reset', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const tx = await sc.reset().send();
    expect(tx.txid).toBeDefined();
    const parsed = parsePushdataCommitment(getTxOutputs(tx)[1].token!.nft!.commitment, layout, 0);
    expect(parsed.score).toBe(0n);
    expect(sc.lastDerivationIterations).toBe(1);
  });
});

describe('optimistic boolean reset derivation', () => {
  const provider = createTestProvider();
  const artifact = compileString(`
pragma solidcash >=0.8.0;
contract Armed() {
  bool armed;
  function reset() { this.armed = false; }
}
`);
  const inner = new Contract(artifact, [], { provider });
  const layout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    ({ categoryId } = await setupStatefulUtxos(
      provider, inner, layout, { armed: true }, { saltContract: true },
    ));
  });

  it('clears leftover booleans when the function name is reset', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const tx = await sc.reset().send();
    expect(tx.txid).toBeDefined();
    const parsed = parsePushdataCommitment(getTxOutputs(tx)[1].token!.nft!.commitment, layout, 0);
    expect(parsed.armed).toBe(false);
    expect(sc.lastDerivationIterations).toBe(1);
  });
});

describe('optimistic boolean enable derivation', () => {
  const provider = createTestProvider();
  const artifact = compileString(`
pragma solidcash >=0.8.0;
contract Gate() {
  bool armed;
  function enable() { this.armed = true; }
}
`);
  const inner = new Contract(artifact, [], { provider });
  const layout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    ({ categoryId } = await setupStatefulUtxos(
      provider, inner, layout, { armed: true }, { saltContract: true },
    ));
  });

  it('sets leftover booleans true when the function name is enable', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const tx = await sc.enable().send();
    expect(tx.txid).toBeDefined();
    const parsed = parsePushdataCommitment(getTxOutputs(tx)[1].token!.nft!.commitment, layout, 0);
    expect(parsed.armed).toBe(true);
    expect(sc.lastDerivationIterations).toBe(1);
  });
});

describe('optimistic boolean disable derivation', () => {
  const provider = createTestProvider();
  const artifact = compileString(`
pragma solidcash >=0.8.0;
contract GateOff() {
  bool armed;
  function disable() { this.armed = false; }
}
`);
  const inner = new Contract(artifact, [], { provider });
  const layout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    ({ categoryId } = await setupStatefulUtxos(
      provider, inner, layout, { armed: false }, { saltContract: true },
    ));
  });

  it('clears leftover booleans when the function name is disable', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const tx = await sc.disable().send();
    expect(tx.txid).toBeDefined();
    const parsed = parsePushdataCommitment(getTxOutputs(tx)[1].token!.nft!.commitment, layout, 0);
    expect(parsed.armed).toBe(false);
    expect(sc.lastDerivationIterations).toBe(1);
  });
});

describe('optimistic integer double derivation', () => {
  const provider = createTestProvider();
  const artifact = compileString(`
pragma solidcash >=0.8.0;
contract Stake() {
  int stake;
  function double() { this.stake = this.stake * 2; }
}
`);
  const inner = new Contract(artifact, [], { provider });
  const layout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    ({ categoryId } = await setupStatefulUtxos(
      provider, inner, layout, { stake: 3n }, { saltContract: true },
    ));
  });

  it('doubles leftover integers when the function name is double', async () => {
    const sc = StatefulContract.withCategory(inner, categoryId);
    const tx = await sc.double().send();
    expect(tx.txid).toBeDefined();
    const parsed = parsePushdataCommitment(getTxOutputs(tx)[1].token!.nft!.commitment, layout, 0);
    expect(parsed.stake).toBe(6n);
    expect(sc.lastDerivationIterations).toBe(1);
  });
});
