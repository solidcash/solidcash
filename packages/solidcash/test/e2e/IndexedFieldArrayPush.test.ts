import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const provider = createTestProvider();

async function mk(src: string): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true });
  const c = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, c, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(c, categoryId);
}

// push/pop onto an array field reached through an INDEX key (`data[i].d`, `s1.arr[i]`, `m[k].d`): the receiver
// mixes an index and a struct field, lowered as read-modify-write over the whole inner array.
describe('indexed struct-field array push/pop (runtime)', () => {
  it('data[i].d.push(v): element-of-struct-array inner-array push', async () => {
    const sc = await mk(`contract C {
      struct S { uint[] d; }
      S[] data;
      function w() public { data.push(); data.push(); data[0].d.push(7); data[0].d.push(9); data[1].d.push(5); }
      function chk() public view {
        require(data[0].d.length == 2 && data[0].d[0] == 7 && data[0].d[1] == 9);
        require(data[1].d.length == 1 && data[1].d[0] == 5);
      }
    }`);
    await sc.w().send();
    await expect(sc.chk().send()).resolves.toBeDefined();
  });

  it('s1.arr[i].push(v): struct field-of-arrays inner-array push', async () => {
    const sc = await mk(`contract C {
      struct S { uint[][] arr; }
      S s1;
      function w() public { s1.arr.push(); s1.arr.push(); s1.arr[0].push(3); s1.arr[0].push(4); s1.arr[1].push(8); }
      function chk() public view {
        require(s1.arr[0].length == 2 && s1.arr[0][0] == 3 && s1.arr[0][1] == 4);
        require(s1.arr[1].length == 1 && s1.arr[1][0] == 8);
      }
    }`);
    await sc.w().send();
    await expect(sc.chk().send()).resolves.toBeDefined();
  });

  it('m[k].d.push(v): mapping-of-struct inner-array push', async () => {
    const sc = await mk(`contract C {
      struct S { uint[] d; }
      mapping(uint => S) m;
      function w() public { m[1].d.push(11); m[1].d.push(22); m[2].d.push(33); }
      function chk() public view {
        require(m[1].d.length == 2 && m[1].d[0] == 11 && m[1].d[1] == 22);
        require(m[2].d.length == 1 && m[2].d[0] == 33);
      }
    }`);
    await sc.w().send();
    await expect(sc.chk().send()).resolves.toBeDefined();
  });

  it('data[i].d.pop() removes the last element', async () => {
    const sc = await mk(`contract C {
      struct S { uint[] d; }
      S[] data;
      function w() public { data.push(); data[0].d.push(7); data[0].d.push(9); data[0].d.pop(); }
      function chk() public view { require(data[0].d.length == 1 && data[0].d[0] == 7); }
    }`);
    await sc.w().send();
    await expect(sc.chk().send()).resolves.toBeDefined();
  });
});
