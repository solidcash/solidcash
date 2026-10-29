// Stack register-machine for straight-line secp256k1 field arithmetic in BCH Script.
// TWO-PASS + LIVENESS-OPTIMIZED: records ops, computes last-use, then emits with consume-on-last-use
// (ROLL the operand instead of PICK-copying it when it is dead after this op) and INLINES modmul/modadd/
// modsub (no OP_INVOKE overhead). This drives point-op cost toward the pure-mul floor.
// LAZY REDUCTION (ECRECOVER_LAZY=1; off, the emitter produces the shipped covenants' bytes): only a product is
// reduced (OP_MOD). A sum is left unreduced and a difference adds the multiple of p that bounds its subtrahend, so
// neither branches; each value's bound (in units of p) is tracked, a value past MAX_LAZY_BOUND is reduced, and every
// value a block keeps leaves it reduced, so callers see canonical values. A block whose kept values feed straight
// back into blocks that declare their bounds (`inputBounds`) may keep them unreduced (`keep(order, { reduce: false })`);
// `outputBounds` then names the bounds they leave with. A depth-1 or depth-2 move takes its one-opcode form.
import { num, binToHex } from './harness.mjs';

export const P = 2n ** 256n - 2n ** 32n - 977n;
const pP = num(P);
export const LAZY = process.env.ECRECOVER_LAZY === '1';
const FIELD = {
  mul: `OP_MUL ${pP} OP_MOD`,
  add: `OP_ADD OP_DUP ${pP} OP_GREATERTHANOREQUAL OP_IF ${pP} OP_SUB OP_ENDIF`,
  sub: `OP_SUB OP_DUP OP_0 OP_LESSTHAN OP_IF ${pP} OP_ADD OP_ENDIF`,
};
// The largest bound a lazy value may reach before it is reduced: below 2^262, so an operand stays 33 bytes.
const MAX_LAZY_BOUND = 64n;

export class E {
  constructor() { this.ops = []; this._init = []; }
  set stk(v) { this._init = [...v]; }               // callers set the assumed initial stack
  set inputBounds(bounds) { this._inputBounds = bounds; } // inputs that may arrive unreduced, by name, in units of p
  get stk() { return this._model ?? this._init; }
  pushNum(v, name) { this.ops.push({ op: 'push', v, name }); return this; }
  pushConstBytes(hex, name) { this.ops.push({ op: 'pushb', hex, name }); return this; }
  copy(a, res) { this.ops.push({ op: 'copy', a, res }); return this; }
  relabel(a, res) { this.ops.push({ op: 'relabel', a, res }); return this; }
  mul(a, b, res) { this.ops.push({ op: 'mul', a, b, res }); return this; }
  add(a, b, res) { this.ops.push({ op: 'add', a, b, res }); return this; }
  sub(a, b, res) { this.ops.push({ op: 'sub', a, b, res }); return this; }
  sqr(a, res) { this.ops.push({ op: 'sqr', a, res }); return this; }
  keep(order, options = {}) { this.ops.push({ op: 'keep', order, reduce: options.reduce ?? true }); return this; }

  asm() {
    const readsOf = (o) => o.op === 'mul' || o.op === 'add' || o.op === 'sub' ? [o.a, o.b]
      : o.op === 'sqr' || o.op === 'copy' || o.op === 'relabel' ? [o.a]
        : o.op === 'keep' ? o.order : [];
    const lastUse = {};
    this.ops.forEach((o, i) => { for (const r of readsOf(o)) lastUse[r] = i; });

    const out = []; let stk = [...this._init]; let tmp = 0;
    // Each value's bound in units of p: a value is in [0, bound * p). The block's inputs arrive reduced.
    const bound = new Map(this._init.map((n) => [n, BigInt(this._inputBounds?.[n] ?? 1n)]));
    const boundOf = (n) => bound.get(n) ?? 1n;
    const idx = (n) => { const i = stk.lastIndexOf(n); if (i < 0) throw new Error(`compile: no ${n} in [${stk}]`); return stk.length - 1 - i; };
    // The shallow moves have one-opcode forms, which save the depth push.
    const roll = (n) => { const i = idx(n); if (i > 0) { out.push(LAZY && i === 1 ? 'OP_SWAP' : LAZY && i === 2 ? 'OP_ROT' : `${num(BigInt(i))} OP_ROLL`); stk.splice(stk.lastIndexOf(n), 1); stk.push(n); } };
    const pick = (n) => { const i = idx(n); out.push(i === 0 ? 'OP_DUP' : LAZY && i === 1 ? 'OP_OVER' : `${num(BigInt(i))} OP_PICK`); const t = '@' + (tmp++); stk.push(t); return t; };
    const bring = (n, consume) => (consume ? roll(n) : pick(n));

    this.ops.forEach((o, i) => {
      switch (o.op) {
        case 'push': out.push(num(o.v)); stk.push(o.name); break;
        case 'pushb': out.push(`<0x${o.hex}>`); stk.push(o.name); break;
        case 'copy': pick(o.a); stk[stk.length - 1] = o.res; bound.set(o.res, boundOf(o.a)); break;
        case 'relabel': { const j = stk.lastIndexOf(o.a); if (j < 0) throw new Error(`relabel no ${o.a}`); stk[j] = o.res; bound.set(o.res, boundOf(o.a)); break; }
        case 'sqr': bring(o.a, false); bring(o.a, lastUse[o.a] === i); out.push(FIELD.mul); stk.pop(); stk.pop(); stk.push(o.res); bound.set(o.res, 1n); break;
        case 'mul': case 'add': case 'sub': {
          const [ba, bb] = [boundOf(o.a), boundOf(o.b)];
          bring(o.a, lastUse[o.a] === i && o.a !== o.b);
          bring(o.b, lastUse[o.b] === i);
          if (o.op === 'mul' || !LAZY) {
            out.push(FIELD[o.op]);
            bound.set(o.res, 1n);
          } else {
            // a - b + k*p with k*p past every value b can hold stays non-negative.
            out.push(o.op === 'add' ? 'OP_ADD' : `OP_SUB ${num(bb * P)} OP_ADD`);
            let reached = ba + bb;
            if (reached > MAX_LAZY_BOUND) { out.push(`${pP} OP_MOD`); reached = 1n; }
            bound.set(o.res, reached);
          }
          stk.pop(); stk.pop(); stk.push(o.res); break;
        }
        case 'keep':
          for (const n of [...stk]) if (!o.order.includes(n)) { roll(n); out.push('OP_DROP'); stk.pop(); }
          for (const n of o.order) {
            roll(n);
            // A kept value leaves the block reduced, unless the block keeps its values unreduced.
            if (o.reduce && boundOf(n) > 1n) {
              if (idx(n) !== 0) throw new Error(`keep: ${n} is not on top`);
              out.push(`${pP} OP_MOD`);
              bound.set(n, 1n);
            }
          }
          this.outputBounds = Object.fromEntries(o.order.map((n) => [n, boundOf(n)]));
          break;
      }
    });
    this._model = stk;
    return out.join(' ');
  }
}

export { binToHex };
