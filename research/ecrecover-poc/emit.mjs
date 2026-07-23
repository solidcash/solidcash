// Stack register-machine for straight-line secp256k1 field arithmetic in BCH Script.
// TWO-PASS + LIVENESS-OPTIMIZED: records ops, computes last-use, then emits with consume-on-last-use
// (ROLL the operand instead of PICK-copying it when it is dead after this op) and INLINES modmul/modadd/
// modsub (no OP_INVOKE overhead). This drives point-op cost toward the pure-mul floor.
import { num, binToHex } from './harness.mjs';

export const P = 2n ** 256n - 2n ** 32n - 977n;
const pP = num(P);
const FIELD = {
  mul: `OP_MUL ${pP} OP_MOD`,
  add: `OP_ADD OP_DUP ${pP} OP_GREATERTHANOREQUAL OP_IF ${pP} OP_SUB OP_ENDIF`,
  sub: `OP_SUB OP_DUP OP_0 OP_LESSTHAN OP_IF ${pP} OP_ADD OP_ENDIF`,
};

export class E {
  constructor() { this.ops = []; this._init = []; }
  set stk(v) { this._init = [...v]; }               // callers set the assumed initial stack
  get stk() { return this._model ?? this._init; }
  pushNum(v, name) { this.ops.push({ op: 'push', v, name }); return this; }
  pushConstBytes(hex, name) { this.ops.push({ op: 'pushb', hex, name }); return this; }
  copy(a, res) { this.ops.push({ op: 'copy', a, res }); return this; }
  relabel(a, res) { this.ops.push({ op: 'relabel', a, res }); return this; }
  mul(a, b, res) { this.ops.push({ op: 'mul', a, b, res }); return this; }
  add(a, b, res) { this.ops.push({ op: 'add', a, b, res }); return this; }
  sub(a, b, res) { this.ops.push({ op: 'sub', a, b, res }); return this; }
  sqr(a, res) { this.ops.push({ op: 'sqr', a, res }); return this; }
  keep(order) { this.ops.push({ op: 'keep', order }); return this; }

  asm() {
    const readsOf = (o) => o.op === 'mul' || o.op === 'add' || o.op === 'sub' ? [o.a, o.b]
      : o.op === 'sqr' || o.op === 'copy' || o.op === 'relabel' ? [o.a]
        : o.op === 'keep' ? o.order : [];
    const lastUse = {};
    this.ops.forEach((o, i) => { for (const r of readsOf(o)) lastUse[r] = i; });

    const out = []; let stk = [...this._init]; let tmp = 0;
    const idx = (n) => { const i = stk.lastIndexOf(n); if (i < 0) throw new Error(`compile: no ${n} in [${stk}]`); return stk.length - 1 - i; };
    const roll = (n) => { const i = idx(n); if (i > 0) { out.push(`${num(BigInt(i))} OP_ROLL`); stk.splice(stk.lastIndexOf(n), 1); stk.push(n); } };
    const pick = (n) => { const i = idx(n); out.push(i === 0 ? 'OP_DUP' : `${num(BigInt(i))} OP_PICK`); const t = '@' + (tmp++); stk.push(t); return t; };
    const bring = (n, consume) => (consume ? roll(n) : pick(n));

    this.ops.forEach((o, i) => {
      switch (o.op) {
        case 'push': out.push(num(o.v)); stk.push(o.name); break;
        case 'pushb': out.push(`<0x${o.hex}>`); stk.push(o.name); break;
        case 'copy': pick(o.a); stk[stk.length - 1] = o.res; break;
        case 'relabel': { const j = stk.lastIndexOf(o.a); if (j < 0) throw new Error(`relabel no ${o.a}`); stk[j] = o.res; break; }
        case 'sqr': bring(o.a, false); bring(o.a, lastUse[o.a] === i); out.push(FIELD.mul); stk.pop(); stk.pop(); stk.push(o.res); break;
        case 'mul': case 'add': case 'sub':
          bring(o.a, lastUse[o.a] === i && o.a !== o.b);
          bring(o.b, lastUse[o.b] === i);
          out.push(FIELD[o.op]); stk.pop(); stk.pop(); stk.push(o.res); break;
        case 'keep':
          for (const n of [...stk]) if (!o.order.includes(n)) { roll(n); out.push('OP_DROP'); stk.pop(); }
          for (const n of o.order) roll(n);
          break;
      }
    });
    this._model = stk;
    return out.join(' ');
  }
}

export { binToHex };
