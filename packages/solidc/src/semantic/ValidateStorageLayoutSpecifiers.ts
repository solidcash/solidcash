import { computeErc7201SlotNumber } from '@solidcash/utils';
import { stringLiteralBytes } from '../ast/stringLiteralBytes.js';
import { Location, Point } from '../ast/Location.js';
import { StorageLayoutSpecifierError } from '../Errors.js';

// Solidity's storage-layout specifier (`contract C layout at <expr>`) offsets EVM storage. NFT-commitment state has
// no slot space, so parseCode blanks the clause before parsing and keeps only the evaluated base, which shifts the
// EVM-visible slot numbers (`.slot`, sload/sstore addresses). This pass first applies solc's checks to the
// source text: ContractLevelChecker (abstract contract 7587, inheriting a custom layout 8894) and
// PostTypeContractLevelChecker (purity 1139, integer type 1763, constant evaluation 1505, uint256 range 6753,
// signedness 1481). Only the parsed file is visible: a name it cannot resolve (an import, a base declared elsewhere)
// leaves the specifier accepted.

interface Tok { t: 'id' | 'num' | 'str' | 'op'; v: string; pos: number; s?: string }
interface Rat { n: bigint; d: bigint }

type IntTy = { k: 'int'; signed: boolean; bits: number };
type Ty =
  | IntTy
  | { k: 'rat'; v: Rat }
  | { k: 'addr' } | { k: 'bool' } | { k: 'str' } | { k: 'other' } | { k: 'unknown' }
  | { k: 'fbytes'; n: number }
  | { k: 'arr'; elem?: Ty }
  | { k: 'udvt'; name: string; under: Ty };
interface Val { ty: Ty; v: Rat | string }

type Expr =
  | { k: 'num'; v?: Rat; address: boolean }
  | { k: 'str'; s: string }
  | { k: 'bool' }
  | { k: 'id'; name: string }
  | { k: 'member'; obj: Expr; name: string }
  | { k: 'call'; fn: Expr; args: Expr[] }
  | { k: 'index'; obj: Expr; parts: Expr[]; range: boolean }
  | { k: 'unary'; op: string; arg: Expr }
  | { k: 'binary'; op: string; l: Expr; r: Expr }
  | { k: 'cond'; c: Expr; a: Expr; b: Expr }
  | { k: 'tuple'; items: Array<Expr | undefined> }
  | { k: 'array'; items: Expr[] }
  | { k: 'new'; type: Expr };

interface Contract {
  name: string; abstract: boolean; layout?: Tok[]; layoutPos: number;
  bases: Array<{ name: string; pos: number }>; members: Map<string, Decl>;
}
interface VarDecl { name: string; constant: boolean; type: Tok[]; init?: Tok[]; owner?: Contract }
type Decl =
  | { k: 'var'; d: VarDecl }
  | { k: 'fn' | 'event' | 'struct' | 'enum' | 'modifier' }
  | { k: 'udvt'; name: string; under: Tok[]; owner?: Contract }
  | { k: 'contract'; c: Contract };

// What an expression names, beyond its value type.
type Den =
  | { k: 'const'; d: VarDecl }
  | { k: 'type'; ty: Ty; of?: 'enum' | 'struct' }
  | { k: 'contract'; c: Contract }
  | { k: 'fn'; event?: boolean }
  | { k: 'builtin'; name: string; ret?: Ty; impure?: boolean }
  | { k: 'meta'; of?: Info }
  | { k: 'magic'; name: string }
  | { k: 'new'; creation: boolean };
// `pure` is solc's isPure annotation; undefined when an unresolved name hides it.
interface Info { pure: boolean | undefined; ty: Ty; den?: Den }

const ADDR: Ty = { k: 'addr' };
const BOOL: Ty = { k: 'bool' };
const OTHER: Ty = { k: 'other' };
const UNKNOWN: Ty = { k: 'unknown' };
const STRING: Ty = { k: 'arr', elem: OTHER };
const BYTES: Ty = { k: 'arr', elem: { k: 'fbytes', n: 1 } };
const UINT256: IntTy = { k: 'int', signed: false, bits: 256 };
const INT256: IntTy = { k: 'int', signed: true, bits: 256 };
const UNKNOWN_INFO: Info = { pure: undefined, ty: UNKNOWN };
const MAX_U256 = (1n << 256n) - 1n;

const PURE_BUILTINS = new Map<string, Ty>([
  ['keccak256', { k: 'fbytes', n: 32 }], ['sha256', { k: 'fbytes', n: 32 }], ['ripemd160', { k: 'fbytes', n: 20 }],
  ['ecrecover', ADDR], ['addmod', UINT256], ['mulmod', UINT256], ['erc7201', UINT256],
]);
const IMPURE_BUILTINS = new Set(['blockhash', 'blobhash', 'gasleft', 'selfdestruct', 'assert', 'require', 'revert']);
const MAGIC = new Set(['this', 'super', 'msg', 'tx', 'block', 'abi']);
const ABI_FUNCTIONS = new Set([
  'encode', 'encodePacked', 'encodeWithSelector', 'encodeWithSignature', 'encodeCall', 'decode',
]);
const UNITS = new Map<string, bigint>([
  ['wei', 1n], ['gwei', 10n ** 9n], ['ether', 10n ** 18n],
  ['seconds', 1n], ['minutes', 60n], ['hours', 3600n], ['days', 86400n], ['weeks', 604800n],
]);
const META_MEMBERS = new Map<string, Ty>([
  ['interfaceId', { k: 'fbytes', n: 4 }], ['name', STRING], ['creationCode', BYTES], ['runtimeCode', BYTES],
]);
const CONTRACT_KINDS = new Set(['contract', 'interface', 'library']);
const SKIPPED_ITEMS = new Set(['constructor', 'fallback', 'receive', 'using', 'pragma', 'import']);
const VARIABLE_MODIFIERS = new Set([
  'public', 'private', 'internal', 'external', 'constant', 'immutable', 'override', 'transient', 'virtual',
]);
const COMPARISONS = new Set(['==', '!=', '<', '>', '<=', '>=']);
const SHIFTS = new Set(['<<', '>>']);
const BITWISE = new Set(['&', '|', '^']);
const ARITHMETIC = new Set(['+', '-', '*', '/', '%']);
const UNARY_OPERATORS = new Set(['-', '~', '!', '++', '--']);
const BINARY_PRECEDENCE = new Map<string, number>([
  ['||', 1], ['&&', 2], ['==', 3], ['!=', 3], ['<', 4], ['>', 4], ['<=', 4], ['>=', 4], ['|', 5], ['^', 6],
  ['&', 7], ['<<', 8], ['>>', 8], ['+', 9], ['-', 9], ['*', 10], ['/', 10], ['%', 10], ['**', 11],
]);

/**
 * Throws StorageLayoutSpecifierError for a `layout at` specifier (or an inheritance of one) that solc rejects.
 * Returns the evaluated base slot per contract name; a base it cannot evaluate (an unresolved name) is absent.
 */
export function validateStorageLayoutSpecifiers(code: string): Map<string, bigint> {
  return new LayoutSpecifierCheck(code).run();
}

class LayoutSpecifierCheck {
  private readonly toks: Tok[];
  private readonly file = new Map<string, Decl>();
  private readonly contracts: Contract[] = [];
  private readonly constants = new Map<VarDecl, Val | null | undefined>();
  private readonly bases = new Map<string, bigint>();
  private scope?: Contract;
  private pos = 0;

  constructor(private readonly code: string) {
    this.toks = tokenize(code);
  }

  run(): Map<string, bigint> {
    for (const item of splitItems(this.toks, 0, this.toks.length)) {
      const contract = this.contractOf(item);
      if (!contract) this.declare(this.file, item);
      else {
        this.contracts.push(contract);
        if (!this.file.has(contract.name)) this.file.set(contract.name, { k: 'contract', c: contract });
      }
    }
    for (const contract of this.contracts) {
      if (contract.layout && contract.abstract) {
        throw this.error(contract.layoutPos, 'TypeError 7587', 'Storage layout cannot be specified for abstract contracts.');
      }
      for (const base of contract.bases) {
        const decl = this.file.get(base.name);
        if (decl?.k === 'contract' && decl.c.layout) {
          throw this.error(base.pos, 'TypeError 8894', 'Cannot inherit from a contract with a custom storage layout.');
        }
      }
    }
    for (const contract of this.contracts) {
      if (contract.layout?.length) this.checkBaseSlot(contract, contract.layout);
    }
    return this.bases;
  }

  private checkBaseSlot(contract: Contract, toks: Tok[]): void {
    const expr = parseExpression(toks);
    if (!expr) return;
    this.scope = contract;
    this.pos = toks[0].pos;
    const info = this.analyze(expr);
    if (info.pure === false) {
      throw this.fail('TypeError 1139', 'The base slot of the storage layout must be a compile-time constant expression.');
    }
    const { ty } = info;
    if (info.pure === undefined || ty.k === 'unknown') return;
    const integerRule = 'The base slot of the storage layout must evaluate to an integer';
    if (ty.k !== 'int' && ty.k !== 'rat') {
      const named = typeLabel(ty);
      throw this.fail('TypeError 1763', `${integerRule}${named ? ` (the type is '${named}' instead)` : ''}.`);
    }
    let slot: Rat;
    if (ty.k === 'int') {
      const value = this.evaluate(expr);
      if (value === undefined) return;
      if (value === null || typeof value.v === 'string') {
        throw this.fail('TypeError 1505', 'The base slot expression contains elements that are not yet supported by '
          + 'the internal constant evaluator and therefore cannot be evaluated at compilation time.');
      }
      slot = value.v;
    } else {
      if (ty.v.d !== 1n) throw this.fail('TypeError 1763', `${integerRule}.`);
      slot = ty.v;
    }
    if (slot.n < 0n || slot.n > MAX_U256) {
      throw this.fail('TypeError 6753', `The base slot of the storage layout evaluates to ${readable(slot.n)}, which is `
        + 'outside the range of type uint256.');
    }
    if (ty.k === 'int' && ty.signed) {
      throw this.fail('TypeError 1481', `Base slot expression of type 'int${ty.bits}' is not convertible to uint256.`);
    }
    if (slot.d === 1n) this.bases.set(contract.name, slot.n);
  }

  // ---- declarations ----

  private contractOf(item: Item): Contract | undefined {
    const { head } = item;
    const at = head.findIndex((t, j) => t.t === 'id' && CONTRACT_KINDS.has(t.v) && head[j + 1]?.t === 'id');
    if (at < 0 || !item.body) return undefined;
    const contract: Contract = {
      name: head[at + 1].v,
      abstract: head[at - 1]?.v === 'abstract',
      layoutPos: head[at].pos,
      bases: [],
      members: new Map(),
    };
    this.header(contract, head.slice(at + 2));
    for (const member of splitItems(this.toks, item.body[0], item.body[1])) {
      this.declare(contract.members, member, contract);
    }
    return contract;
  }

  // `[layout at <expr>] [is <bases>] [layout at <expr>]` between the contract name and its body.
  private header(contract: Contract, hdr: Tok[]): void {
    const word = (j: number, w: string): boolean => hdr[j]?.t === 'id' && hdr[j].v === w;
    let i = 0;
    while (i < hdr.length) {
      let j = i + 1;
      if (word(i, 'layout') && word(i + 1, 'at')) {
        j = i + 2;
        for (let depth = 0; j < hdr.length && !(depth === 0 && word(j, 'is')); j += 1) depth += nesting(hdr[j]);
        contract.layout = hdr.slice(i + 2, j);
        contract.layoutPos = hdr[i].pos;
      } else if (word(i, 'is')) {
        let start = j;
        for (let depth = 0; j < hdr.length && !(depth === 0 && word(j, 'layout') && word(j + 1, 'at')); j += 1) {
          if (depth === 0 && hdr[j].t === 'op' && hdr[j].v === ',') {
            this.base(contract, hdr, start);
            start = j + 1;
          }
          depth += nesting(hdr[j]);
        }
        this.base(contract, hdr, start);
      }
      i = j;
    }
  }

  private base(contract: Contract, hdr: Tok[], at: number): void {
    const first = hdr[at];
    if (first?.t !== 'id') return;
    let name = first.v;
    for (let j = at + 1; hdr[j]?.v === '.' && hdr[j + 1]?.t === 'id'; j += 2) name += `.${hdr[j + 1].v}`;
    contract.bases.push({ name, pos: first.pos });
  }

  private declare(map: Map<string, Decl>, item: Item, owner?: Contract): void {
    const [w0, w1] = item.head;
    const keyword = w0?.t === 'id' ? w0.v : '';
    const name = w1?.t === 'id' ? w1.v : '';
    const decl = name ? declarationOf(keyword, name, item, owner) : undefined;
    if (decl) {
      if (!map.has(name)) map.set(name, decl);
    } else if (!item.body && !SKIPPED_ITEMS.has(keyword)) this.declareVariable(map, item.head, owner);
  }

  private declareVariable(map: Map<string, Decl>, head: Tok[], owner?: Contract): void {
    const eq = head.findIndex((t) => t.t === 'op' && t.v === '=');
    const lhs = eq < 0 ? head : head.slice(0, eq);
    const name = lhs[lhs.length - 1];
    if (lhs.length < 2 || name.t !== 'id' || map.has(name.v)) return;
    const modifier = lhs.findIndex((t, j) => j < lhs.length - 1 && t.t === 'id' && VARIABLE_MODIFIERS.has(t.v));
    map.set(name.v, {
      k: 'var',
      d: {
        name: name.v,
        constant: lhs.some((t) => t.t === 'id' && t.v === 'constant'),
        type: lhs.slice(0, modifier < 0 ? lhs.length - 1 : modifier),
        init: eq < 0 ? undefined : head.slice(eq + 1),
        owner,
      },
    });
  }

  private member(contract: Contract, name: string, seen = new Set<Contract>()): Decl | undefined {
    if (seen.has(contract)) return undefined;
    seen.add(contract);
    const own = contract.members.get(name);
    if (own) return own;
    for (const base of contract.bases) {
      const decl = this.file.get(base.name);
      const found = decl?.k === 'contract' ? this.member(decl.c, name, seen) : undefined;
      if (found) return found;
    }
    return undefined;
  }

  private lookup(name: string, scope?: Contract): Decl | undefined {
    return (scope && this.member(scope, name)) || this.file.get(name);
  }

  private typeOf(toks: Tok[], owner?: Contract): Ty {
    const words = toks.map((t) => t.v);
    if (words.includes('[') || words[0] === 'mapping' || words[0] === 'function') return OTHER;
    if (words.length === 2 && words[0] === 'address' && words[1] === 'payable') return ADDR;
    let decl: Decl | undefined;
    if (toks.length === 1 && toks[0].t === 'id') {
      const elementaryType = elementary(words[0]);
      if (elementaryType) return elementaryType;
      decl = this.lookup(words[0], owner);
    } else if (toks.length === 3 && toks[0].t === 'id' && words[1] === '.' && toks[2].t === 'id') {
      const outer = this.lookup(words[0], owner);
      decl = outer?.k === 'contract' ? this.member(outer.c, words[2]) : undefined;
    }
    if (decl?.k === 'udvt') return this.udvtType(decl);
    return decl?.k === 'contract' || decl?.k === 'enum' || decl?.k === 'struct' ? OTHER : UNKNOWN;
  }

  private udvtType(decl: Extract<Decl, { k: 'udvt' }>): Ty {
    const name = decl.owner ? `${decl.owner.name}.${decl.name}` : decl.name;
    // The underlying type of a user-defined value type is elementary.
    const under = decl.under.length === 1 ? elementary(decl.under[0].v) : undefined;
    return { k: 'udvt', name, under: under ?? UNKNOWN };
  }

  private declInfo(decl: Decl): Info {
    switch (decl.k) {
      case 'var': {
        const ty = this.typeOf(decl.d.type, decl.d.owner);
        return decl.d.constant ? { pure: true, ty, den: { k: 'const', d: decl.d } } : { pure: false, ty };
      }
      case 'contract': return { pure: true, ty: OTHER, den: { k: 'contract', c: decl.c } };
      case 'udvt': return { pure: true, ty: OTHER, den: { k: 'type', ty: this.udvtType(decl) } };
      case 'enum': case 'struct': return { pure: true, ty: OTHER, den: { k: 'type', ty: OTHER, of: decl.k } };
      case 'fn': return { pure: false, ty: OTHER, den: { k: 'fn' } };
      case 'event': return { pure: false, ty: OTHER, den: { k: 'fn', event: true } };
      default: return { pure: false, ty: OTHER };
    }
  }

  private resolve(name: string): Info {
    const decl = this.lookup(name, this.scope);
    if (decl) return this.declInfo(decl);
    const elementaryType = name === 'payable' ? ADDR : elementary(name);
    if (elementaryType) return { pure: true, ty: OTHER, den: { k: 'type', ty: elementaryType } };
    if (name === 'type') return { pure: true, ty: OTHER, den: { k: 'meta' } };
    const ret = PURE_BUILTINS.get(name);
    if (ret) return { pure: true, ty: OTHER, den: { k: 'builtin', name, ret } };
    if (IMPURE_BUILTINS.has(name)) return { pure: true, ty: OTHER, den: { k: 'builtin', name, impure: true } };
    if (MAGIC.has(name)) return { pure: false, ty: OTHER, den: { k: 'magic', name } };
    return UNKNOWN_INFO;
  }

  // ---- solc's type and purity annotations ----

  private analyze(e: Expr): Info {
    switch (e.k) {
      case 'num': return e.v ? { pure: true, ty: e.address ? ADDR : { k: 'rat', v: e.v } } : UNKNOWN_INFO;
      case 'str': return { pure: true, ty: { k: 'str' } };
      case 'bool': return { pure: true, ty: BOOL };
      case 'id': return this.resolve(e.name);
      case 'tuple': {
        const [only] = e.items;
        if (e.items.length === 1 && only) return this.analyze(only);
        return { pure: allPure(e.items.map((x) => (x ? this.analyze(x).pure : true))), ty: OTHER };
      }
      case 'array': {
        const items = e.items.map((x) => this.analyze(x));
        return { pure: allPure(items.map((x) => x.pure)), ty: { k: 'arr', elem: arrayElement(items.map((x) => x.ty)) } };
      }
      case 'new': {
        const target = this.analyze(e.type).den;
        if (target?.k === 'contract') return { pure: false, ty: OTHER, den: { k: 'new', creation: true } };
        return target?.k === 'type' ? { pure: true, ty: OTHER, den: { k: 'new', creation: false } } : UNKNOWN_INFO;
      }
      case 'unary': {
        const arg = this.analyze(e.arg);
        // Increments and `delete` modify; an operator on a user-defined value type calls a (non-pure) function.
        if (['++', '--', 'delete'].includes(e.op) || arg.ty.k === 'udvt') return { pure: false, ty: UNKNOWN };
        return { pure: arg.pure, ty: this.unaryType(e.op, arg.ty) };
      }
      case 'binary': {
        const l = this.analyze(e.l);
        const r = this.analyze(e.r);
        if (l.ty.k === 'udvt' || r.ty.k === 'udvt') return { pure: false, ty: UNKNOWN };
        return { pure: allPure([l.pure, r.pure]), ty: this.binaryType(e.op, l.ty, r.ty) };
      }
      case 'cond': {
        const parts = [this.analyze(e.c), this.analyze(e.a), this.analyze(e.b)];
        return { pure: allPure(parts.map((x) => x.pure)), ty: conditionalType(parts[1].ty, parts[2].ty) };
      }
      case 'member': return this.memberAccess(e);
      case 'call': return this.call(e);
      case 'index': return this.index(e);
      default: return UNKNOWN_INFO;
    }
  }

  private unaryType(op: string, ty: Ty): Ty {
    if (ty.k === 'rat' || ty.k === 'int') {
      const result = unaryResult(op, ty);
      if (!result) throw this.fail('TypeError 4907', `Built-in unary operator ${op} cannot be applied to the operand.`);
      return result;
    }
    if (ty.k === 'unknown') return UNKNOWN;
    return (op === '!' && ty.k === 'bool') || (op === '~' && ty.k === 'fbytes') ? ty : OTHER;
  }

  private binaryType(op: string, a: Ty, b: Ty): Ty {
    if (a.k === 'unknown' || b.k === 'unknown') return UNKNOWN;
    if (COMPARISONS.has(op) || op === '&&' || op === '||') return BOOL;
    if (a.k === 'rat' && b.k === 'rat') {
      const v = ratBinary(op, a.v, b.v);
      if (!v || bitLength(v.n) > 4096 || bitLength(v.d) > 4096) {
        throw this.fail('TypeError 2271', `Built-in binary operator ${op} cannot be applied to the operand values.`);
      }
      return { k: 'rat', v };
    }
    if ((a.k === 'rat' || a.k === 'int') && (b.k === 'rat' || b.k === 'int')) return numericResult(op, a, b) ?? UNKNOWN;
    return a.k === 'fbytes' && (BITWISE.has(op) || SHIFTS.has(op)) ? a : OTHER;
  }

  private memberAccess(e: Extract<Expr, { k: 'member' }>): Info {
    const obj = this.analyze(e.obj);
    const { den } = obj;
    const { name } = e;
    switch (den?.k) {
      case 'magic':
        if (den.name === 'abi') {
          if (!ABI_FUNCTIONS.has(name)) return UNKNOWN_INFO;
          return { pure: true, ty: OTHER, den: { k: 'builtin', name: `abi.${name}` } };
        }
        return { pure: false, ty: OTHER, den: den.name === 'this' || den.name === 'super' ? { k: 'fn' } : undefined };
      case 'contract': {
        const decl = this.member(den.c, name);
        if (!decl) return UNKNOWN_INFO;
        // Through a contract type only functions and constants are compile-time constants.
        if (decl.k === 'fn') return { pure: obj.pure, ty: OTHER, den: { k: 'fn' } };
        const info = this.declInfo(decl);
        return decl.k === 'var' && decl.d.constant ? { ...info, den: undefined } : { ...info, pure: false };
      }
      case 'type':
        if (den.of === 'enum') return { pure: true, ty: OTHER };
        if (den.ty.k === 'udvt' && (name === 'wrap' || name === 'unwrap')) {
          return { pure: true, ty: OTHER, den: { k: 'builtin', name, ret: name === 'wrap' ? den.ty : den.ty.under } };
        }
        if (den.ty.k === 'arr' && !den.of && name === 'concat') {
          return { pure: true, ty: OTHER, den: { k: 'builtin', name, ret: den.ty } };
        }
        return UNKNOWN_INFO;
      case 'meta': {
        const target = den.of?.den;
        if ((name === 'min' || name === 'max') && target?.k === 'type' && target.ty.k === 'int') {
          return { pure: true, ty: target.ty };
        }
        const ty = META_MEMBERS.get(name);
        return ty && den.of ? { pure: true, ty } : UNKNOWN_INFO;
      }
      case 'fn':
        if (name !== 'selector') return { pure: false, ty: name === 'address' ? ADDR : OTHER };
        return { pure: den.event || this.selectorPurity(e.obj), ty: { k: 'fbytes', n: 4 } };
      case 'const': case undefined:
        // Members of a value (`length`, `balance`, a `using for` function) are not compile-time constants.
        return obj.ty.k === 'unknown' ? UNKNOWN_INFO : { pure: false, ty: OTHER };
      default: return UNKNOWN_INFO;
    }
  }

  // `this.f.selector`, `super.f.selector` and `C.f.selector` are compile-time constants; a bare `f.selector` is not.
  private selectorPurity(fn: Expr): boolean | undefined {
    if (fn.k !== 'member') return false;
    if (fn.obj.k === 'id' && (fn.obj.name === 'this' || fn.obj.name === 'super')) return true;
    return this.analyze(fn.obj).pure;
  }

  private call(e: Extract<Expr, { k: 'call' }>): Info {
    const args = e.args.map((x) => this.analyze(x));
    const argsPure = allPure(args.map((x) => x.pure));
    const callee = this.analyze(e.fn);
    const { den } = callee;
    switch (den?.k) {
      case 'meta': return den.of ? UNKNOWN_INFO : { pure: argsPure, ty: OTHER, den: { k: 'meta', of: args[0] } };
      case 'type': return { pure: argsPure, ty: den.of ? OTHER : den.ty };
      case 'contract': return { pure: argsPure, ty: OTHER };
      case 'builtin':
        if (den.impure) return { pure: false, ty: OTHER };
        return {
          pure: allPure([argsPure, callee.pure]),
          ty: den.name === 'abi.decode' ? decodedType(args[1]) : den.ret ?? BYTES,
        };
      case 'fn': return { pure: false, ty: UNKNOWN };
      case 'new': return den.creation ? { pure: false, ty: OTHER } : { pure: argsPure, ty: { k: 'arr' } };
      default: return isUnknown(callee) ? UNKNOWN_INFO : { pure: false, ty: UNKNOWN };
    }
  }

  private index(e: Extract<Expr, { k: 'index' }>): Info {
    const obj = this.analyze(e.obj);
    if (obj.den?.k === 'type' || obj.den?.k === 'contract') {
      return { pure: true, ty: OTHER, den: { k: 'type', ty: { k: 'arr' } } };
    }
    const pure = allPure([obj.pure, ...e.parts.map((x) => this.analyze(x).pure)]);
    if (e.range) return { pure, ty: OTHER };
    if (obj.ty.k === 'fbytes') return { pure, ty: { k: 'fbytes', n: 1 } };
    if (obj.ty.k === 'arr') return { pure, ty: obj.ty.elem ?? UNKNOWN };
    return { pure, ty: obj.ty.k === 'unknown' ? UNKNOWN : OTHER };
  }

  // ---- solc's ConstantEvaluator: null = no value (1505), undefined = cannot tell ----

  private evaluate(e: Expr): Val | null | undefined {
    switch (e.k) {
      case 'num':
        if (e.address) return null;
        return e.v ? { ty: { k: 'rat', v: e.v }, v: e.v } : undefined;
      case 'str': return { ty: { k: 'str' }, v: e.s };
      case 'id': {
        const info = this.resolve(e.name);
        if (info.den?.k === 'const') return this.constant(info.den.d);
        return isUnknown(info) ? undefined : null;
      }
      case 'tuple': return e.items.length === 1 && e.items[0] ? this.evaluate(e.items[0]) : null;
      case 'unary': {
        const value = this.evaluate(e.arg);
        if (!value) return value;
        const operandTy = value.ty;
        const ty = operandTy.k === 'rat' || operandTy.k === 'int' ? unaryResult(e.op, operandTy) : undefined;
        const operand = ty && convert(value, ty);
        const result = operand && typeof operand.v !== 'string' ? ratUnary(e.op, operand.v) : undefined;
        if (!ty || !result) return null;
        return convert({ ty, v: result }, ty) ?? this.arithmeticError('TypeError 3667');
      }
      case 'binary': {
        const l = this.evaluate(e.l);
        const r = this.evaluate(e.r);
        if (l === null || r === null) return null;
        if (!l || !r) return undefined;
        if (COMPARISONS.has(e.op)) return null;
        const ty = this.binaryType(e.op, l.ty, r.ty);
        if (ty.k !== 'rat' && ty.k !== 'int') return ty.k === 'unknown' ? undefined : null;
        const lc = convert(l, ty);
        const rc = convert(r, ty);
        if (!lc || !rc || typeof lc.v === 'string' || typeof rc.v === 'string') return null;
        const result = ratBinary(e.op, lc.v, rc.v);
        if (!result) return null;
        return convert({ ty, v: result }, ty) ?? this.arithmeticError('TypeError 2643');
      }
      case 'call': {
        const callee = this.analyze(e.fn);
        if (callee.den?.k !== 'builtin' || callee.den.name !== 'erc7201') return isUnknown(callee) ? undefined : null;
        const arg = e.args.length === 1 ? this.evaluate(e.args[0]) : null;
        if (!arg) return arg;
        if (typeof arg.v !== 'string') return null;
        return { ty: UINT256, v: rat(computeErc7201SlotNumber(Uint8Array.from(arg.v, (c) => c.charCodeAt(0)))) };
      }
      default: return null;
    }
  }

  private constant(decl: VarDecl): Val | null | undefined {
    if (this.constants.has(decl)) return this.constants.get(decl);
    this.constants.set(decl, undefined); // a cyclic definition stays undetermined
    const { scope } = this;
    this.scope = decl.owner;
    let value: Val | null | undefined;
    try {
      const ty = this.typeOf(decl.type, decl.owner);
      const init = decl.init ? parseExpression(decl.init) : undefined;
      if (!decl.init) value = null;
      else if (init && ty.k !== 'unknown') {
        const raw = this.evaluate(init);
        value = raw ? convert(raw, ty) ?? null : raw;
      }
    } finally {
      this.scope = scope;
    }
    this.constants.set(decl, value);
    return value;
  }

  private arithmeticError(rule: string): never {
    throw this.fail(rule, 'Arithmetic error when computing constant value.');
  }

  private fail(rule: string, message: string): StorageLayoutSpecifierError {
    return this.error(this.pos, rule, message);
  }

  private error(pos: number, rule: string, message: string): StorageLayoutSpecifierError {
    let line = 1;
    for (let i = this.code.indexOf('\n'); i >= 0 && i < pos; i = this.code.indexOf('\n', i + 1)) line += 1;
    const point = new Point(line, pos - (this.code.lastIndexOf('\n', pos - 1) + 1));
    return new StorageLayoutSpecifierError(rule, message, new Location(point, point));
  }
}

// ---- declarations and types ----

function declarationOf(keyword: string, name: string, item: Item, owner?: Contract): Decl | undefined {
  const third = item.head[2]?.v;
  if (keyword === 'function') return { k: 'fn' };
  if (keyword === 'modifier') return { k: 'modifier' };
  if ((keyword === 'event' || keyword === 'error') && third === '(') return { k: 'event' };
  if ((keyword === 'struct' || keyword === 'enum') && item.body) return { k: keyword };
  return keyword === 'type' && third === 'is' ? { k: 'udvt', name, under: item.head.slice(3), owner } : undefined;
}

function typeLabel(ty: Ty): string {
  if (ty.k === 'addr') return 'address';
  if (ty.k === 'fbytes') return `bytes${ty.n}`;
  return ty.k === 'udvt' ? ty.name : '';
}

function elementary(word: string): Ty | undefined {
  if (word === 'address') return ADDR;
  if (word === 'bool') return BOOL;
  if (word === 'string') return STRING;
  if (word === 'bytes') return BYTES;
  const int = /^(u?)int(\d*)$/.exec(word);
  if (int) {
    const bits = int[2] ? Number(int[2]) : 256;
    return bits >= 8 && bits <= 256 && bits % 8 === 0 ? { k: 'int', signed: int[1] === '', bits } : undefined;
  }
  const fixed = /^bytes(\d+)$/.exec(word);
  if (fixed) return Number(fixed[1]) >= 1 && Number(fixed[1]) <= 32 ? { k: 'fbytes', n: Number(fixed[1]) } : undefined;
  return /^u?fixed(\d+x\d+)?$/.test(word) ? OTHER : undefined;
}

function isUnknown(info: Info): boolean {
  return info.pure === undefined && info.ty.k === 'unknown' && !info.den;
}

function allPure(parts: Array<boolean | undefined>): boolean | undefined {
  if (parts.includes(false)) return false;
  return parts.includes(undefined) ? undefined : true;
}

function arrayElement(tys: Ty[]): Ty {
  if (tys.some((t) => t.k === 'unknown')) return UNKNOWN;
  if (!tys.length || !tys.every((t) => t.k === 'int' || (t.k === 'rat' && t.v.d === 1n))) return OTHER;
  return tys.some((t) => (t.k === 'int' ? t.signed : t.k === 'rat' && t.v.n < 0n)) ? INT256 : UINT256;
}

function decodedType(arg?: Info): Ty {
  if (arg?.den?.k === 'type') return arg.den.of ? OTHER : arg.den.ty;
  return !arg || isUnknown(arg) ? UNKNOWN : OTHER;
}

function intRange(t: IntTy): [bigint, bigint] {
  const bits = BigInt(t.bits);
  return t.signed ? [-(1n << (bits - 1n)), (1n << (bits - 1n)) - 1n] : [0n, (1n << bits) - 1n];
}

// RationalNumberType::integerType: the smallest integer type holding the value.
function mobileInt(n: bigint): IntTy | undefined {
  const magnitude = n < 0n ? (-n - 1n) << 1n : n;
  if (magnitude > MAX_U256) return undefined;
  return { k: 'int', signed: n < 0n, bits: Math.max(1, Math.ceil(bitLength(magnitude) / 8)) * 8 };
}

function mobile(t: Ty): IntTy | undefined {
  if (t.k === 'int') return t;
  return t.k === 'rat' && t.v.d === 1n ? mobileInt(t.v.n) : undefined;
}

function convertible(x: Ty, t: IntTy): boolean {
  if (x.k === 'rat') {
    const [lo, hi] = intRange(t);
    return x.v.d === 1n && x.v.n >= lo && x.v.n <= hi;
  }
  if (x.k !== 'int' || t.bits < x.bits) return false;
  return x.signed === t.signed || (!x.signed && t.signed && x.bits < t.bits);
}

// Type::commonType for integer and rational operands.
function commonType(a: Ty, b: Ty): IntTy | undefined {
  const ma = mobile(a);
  if (ma && convertible(b, ma)) return ma;
  const mb = mobile(b);
  return mb && convertible(a, mb) ? mb : undefined;
}

function validShiftAmount(t: Ty): boolean {
  if (t.k === 'int') return !t.signed;
  return t.k === 'rat' && t.v.d === 1n && t.v.n >= 0n && mobileInt(t.v.n) !== undefined;
}

// IntegerType / RationalNumberType::binaryOperatorResult with at least one integer operand.
function numericResult(op: string, a: Ty, b: Ty): Ty | undefined {
  if (a.k === 'rat') {
    if (a.v.d !== 1n || !mobileInt(a.v.n)) return undefined;
    if (SHIFTS.has(op) || op === '**') {
      if (SHIFTS.has(op) ? !validShiftAmount(b) : b.k === 'int' && b.signed) return undefined;
      return a.v.n < 0n ? INT256 : UINT256;
    }
    const common = commonType(a, b);
    return common && numericResult(op, common, b);
  }
  if (SHIFTS.has(op)) return validShiftAmount(b) ? a : undefined;
  if (op === '**') {
    if (b.k === 'int') return b.signed ? undefined : a;
    return b.k === 'rat' && b.v.d === 1n && b.v.n >= 0n && mobileInt(b.v.n) ? a : undefined;
  }
  return ARITHMETIC.has(op) || BITWISE.has(op) ? commonType(a, b) : undefined;
}

function conditionalType(a: Ty, b: Ty): Ty {
  if (a.k === 'unknown' || b.k === 'unknown') return UNKNOWN;
  const ma = mobile(a);
  const mb = mobile(b);
  if (ma && mb) return commonType(ma, mb) ?? UNKNOWN;
  return a.k === b.k && a.k !== 'rat' && a.k !== 'int' ? a : OTHER;
}

function unaryResult(op: string, ty: IntTy | { k: 'rat'; v: Rat }): Ty | undefined {
  if (ty.k === 'rat') {
    const v = ratUnary(op, ty.v);
    return v && { k: 'rat', v };
  }
  return op === '~' || (op === '-' && ty.signed) ? ty : undefined;
}

// ConstantEvaluator's convertType.
function convert(value: Val, ty: Ty): Val | undefined {
  if (typeof value.v === 'string') return ty.k === 'str' || ty.k === 'arr' ? { ty, v: value.v } : undefined;
  if (ty.k === 'rat') return { ty: { k: 'rat', v: value.v }, v: value.v };
  if (ty.k !== 'int') return undefined;
  const { n, d } = value.v;
  const [lo, hi] = intRange(ty);
  return n > hi * d || n < lo * d ? undefined : { ty, v: rat(n / d) };
}

// ---- rationals (ConstantEvaluator::evaluateBinaryOperator / evaluateUnaryOperator) ----

function bitLength(n: bigint): number {
  return n === 0n ? 0 : (n < 0n ? -n : n).toString(2).length;
}

function rat(n: bigint, d = 1n): Rat {
  if (d < 0n) return rat(-n, -d);
  let [a, b] = [n < 0n ? -n : n, d];
  while (b) [a, b] = [b, a % b];
  return a > 1n ? { n: n / a, d: d / a } : { n, d };
}

function fitsExponent(base: bigint, exp: bigint): boolean {
  const msb = bitLength(base) - 1;
  if (msb <= 0) return true;
  return msb <= 4096 && exp * BigInt(msb + 1) <= 4096n;
}

function ratUnary(op: string, a: Rat): Rat | undefined {
  if (op === '-') return rat(-a.n, a.d);
  return op === '~' && a.d === 1n ? rat(~a.n) : undefined;
}

function ratBinary(op: string, a: Rat, b: Rat): Rat | undefined {
  const fractional = a.d !== 1n || b.d !== 1n;
  switch (op) {
    case '|': return fractional ? undefined : rat(a.n | b.n);
    case '^': return fractional ? undefined : rat(a.n ^ b.n);
    case '&': return fractional ? undefined : rat(a.n & b.n);
    case '+': return rat(a.n * b.d + b.n * a.d, a.d * b.d);
    case '-': return rat(a.n * b.d - b.n * a.d, a.d * b.d);
    case '*': return rat(a.n * b.n, a.d * b.d);
    case '/': return b.n === 0n ? undefined : rat(a.n * b.d, a.d * b.n);
    case '%': {
      if (b.n === 0n) return undefined;
      if (!fractional) return rat(a.n % b.n);
      const quotient = rat(a.n * b.d, a.d * b.n);
      return ratBinary('-', a, rat((quotient.n / quotient.d) * b.n, b.d));
    }
    case '**': {
      if (b.d !== 1n) return undefined;
      const exp = b.n < 0n ? -b.n : b.n;
      if (b.n === 0n) return rat(1n);
      if (a.d === 1n && (a.n === 0n || a.n === 1n)) return a;
      if (a.d === 1n && a.n === -1n) return rat(exp % 2n === 1n ? -1n : 1n);
      if (exp > 0xffffffffn || !fitsExponent(a.n < 0n ? -a.n : a.n, exp) || !fitsExponent(a.d, exp)) return undefined;
      return b.n > 0n ? rat(a.n ** exp, a.d ** exp) : rat(a.d ** exp, a.n ** exp);
    }
    case '<<':
      if (fractional || b.n < 0n || b.n > 0xffffffffn) return undefined;
      if (a.n === 0n) return rat(0n);
      return bitLength(a.n) + Number(b.n) > 4096 ? undefined : rat(a.n << b.n);
    case '>>':
      if (fractional || b.n < 0n || b.n > 0xffffffffn) return undefined;
      if (a.n === 0n) return rat(0n);
      if (b.n > BigInt(bitLength(a.n) - 1)) return rat(a.n < 0n ? -1n : 0n);
      return rat(a.n < 0n ? (a.n + 1n) / (1n << b.n) - 1n : a.n / (1n << b.n));
    default: return undefined;
  }
}

// solc's formatNumberReadable.
function readable(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const magnitude = value < 0n ? -value : value;
  if (magnitude <= 0x1000000n) return sign + magnitude.toString();
  const powerOfTwo = (x: bigint): string | undefined => ((x & (x - 1n)) === 0n ? `2**${bitLength(x) - 1}` : undefined);
  const exact = powerOfTwo(magnitude);
  if (exact) return sign + exact;
  const below = powerOfTwo(magnitude + 1n);
  if (below) return `${sign}${below}${sign ? ' + 1' : ' - 1'}`;
  return `${sign}0x${magnitude.toString(16)}`;
}

// ---- tokens and items ----

const IDENTIFIER = /[A-Za-z_$][\w$]*/y;
const NUMBER = /0[xX][\da-fA-F_]+|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[eE]-?\d[\d_]*)?/y;
const OPERATORS = ['<<=', '>>=', '**', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '++', '--', '=>', ':=', '+=', '-=',
  '*=', '/=', '%=', '|=', '&=', '^=', '->'];

function tokenize(code: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '/' && (code[i + 1] === '/' || code[i + 1] === '*')) {
      const line = code[i + 1] === '/';
      const end = line ? code.indexOf('\n', i) : code.indexOf('*/', i + 2);
      i = end < 0 ? code.length : end + (line ? 0 : 2);
    } else if (/\s/.test(c)) {
      i += 1;
    } else if (c === '"' || c === "'") {
      i = readString(code, i, false, toks, i);
    } else {
      IDENTIFIER.lastIndex = i;
      NUMBER.lastIndex = i;
      const word = IDENTIFIER.exec(code)?.[0];
      const text = word ?? NUMBER.exec(code)?.[0];
      const quote = code[i + (word?.length ?? 0)];
      if ((word === 'hex' || word === 'unicode') && (quote === '"' || quote === "'")) {
        i = readString(code, i + word.length, word === 'hex', toks, i);
      } else if (text) {
        toks.push({ t: word ? 'id' : 'num', v: text, pos: i });
        i += text.length;
      } else {
        const op = operatorAt(code, i);
        toks.push({ t: 'op', v: op, pos: i });
        i += op.length;
      }
    }
  }
  return toks;
}

function operatorAt(code: string, i: number): string {
  return OPERATORS.find((o) => code.startsWith(o, i)) ?? code[i];
}

function readString(code: string, quoteAt: number, hex: boolean, toks: Tok[], start: number): number {
  const quote = code[quoteAt];
  let i = quoteAt + 1;
  let raw = '';
  while (i < code.length && code[i] !== quote && code[i] !== '\n') {
    let step = 1;
    if (code[i] === '\\') step = code[i + 1] === '\r' && code[i + 2] === '\n' ? 3 : 2;
    raw += code.slice(i, i + step);
    i += step;
  }
  // One char per byte: hex digits pair up, any other string takes the bytes solc gives it (a malformed escape, which
  // the parser rejects, reads as empty).
  const bytes = hex ? (raw.replace(/_/g, '').match(/../g) ?? []).map((h) => parseInt(h, 16)) : stringLiteralBytes(raw);
  const s = Array.from(bytes ?? [], (b) => String.fromCharCode(b)).join('');
  toks.push({ t: 'str', v: raw, pos: start, s });
  return i + 1;
}

function nesting(t: Tok): number {
  if (t.t !== 'op') return 0;
  if (t.v === '(' || t.v === '[') return 1;
  return t.v === ')' || t.v === ']' ? -1 : 0;
}

// A declaration: its tokens up to `;`, or its header plus the token range of its `{ ... }` body.
interface Item { head: Tok[]; body?: [number, number] }

function splitItems(toks: Tok[], from: number, to: number): Item[] {
  const items: Item[] = [];
  let head: Tok[] = [];
  let depth = 0;
  for (let i = from; i < to; i += 1) {
    const t = toks[i];
    if (depth === 0 && t.t === 'op' && (t.v === ';' || t.v === '{')) {
      if (t.v === '{') {
        let close = i + 1;
        for (let braces = 1; close < to; close += 1) {
          const v = toks[close].t === 'op' ? toks[close].v : '';
          if (v === '{') braces += 1;
          else if (v === '}') braces -= 1;
          if (braces === 0) break;
        }
        items.push({ head, body: [i + 1, close] });
        i = close;
      } else items.push({ head });
      head = [];
    } else {
      depth = Math.max(0, depth + nesting(t));
      head.push(t);
    }
  }
  if (head.length) items.push({ head });
  return items;
}

// ---- expressions ----

const PARSE_FAILURE = new Error('unsupported layout expression');

function parseExpression(toks: Tok[]): Expr | undefined {
  const parser = new ExpressionParser(toks);
  try {
    const expr = parser.expression();
    return parser.done() ? expr : undefined;
  } catch (error) {
    if (error === PARSE_FAILURE) return undefined;
    throw error;
  }
}

function parseNumber(text: string): Rat | undefined {
  const s = text.replace(/_/g, '');
  if (/^0[xX][\da-fA-F]+$/.test(s)) return rat(BigInt(s));
  const m = /^(\d*)(?:\.(\d*))?(?:[eE](-?\d+))?$/.exec(s);
  const exp = m?.[3] ? Number(m[3]) : 0;
  if (!m || Math.abs(exp) > 4096) return undefined;
  const fraction = m[2] ?? '';
  const n = BigInt(`${m[1] || '0'}${fraction}`) * (exp > 0 ? 10n ** BigInt(exp) : 1n);
  return rat(n, 10n ** BigInt(fraction.length) * (exp < 0 ? 10n ** BigInt(-exp) : 1n));
}

class ExpressionParser {
  private i = 0;

  constructor(private readonly toks: Tok[]) {}

  done(): boolean {
    return this.i === this.toks.length;
  }

  expression(): Expr {
    const c = this.binary(1);
    if (!this.at('?')) return c;
    this.i += 1;
    const a = this.expression();
    this.expect(':');
    return { k: 'cond', c, a, b: this.expression() };
  }

  private at(v: string, ahead = 0): boolean {
    const t = this.toks[this.i + ahead];
    return t?.t === 'op' && t.v === v;
  }

  private next(): Tok {
    const t = this.toks[this.i];
    if (!t) throw PARSE_FAILURE;
    this.i += 1;
    return t;
  }

  private expect(v: string): void {
    if (!this.at(v)) throw PARSE_FAILURE;
    this.i += 1;
  }

  private binary(min: number): Expr {
    let left = this.unary();
    for (;;) {
      const t = this.toks[this.i];
      const precedence = t?.t === 'op' ? BINARY_PRECEDENCE.get(t.v) : undefined;
      if (precedence === undefined || precedence < min) return left;
      this.i += 1;
      // `**` is right-associative; prefix operators bind tighter (`-2**2` is `(-2)**2`).
      left = { k: 'binary', op: t.v, l: left, r: this.binary(t.v === '**' ? precedence : precedence + 1) };
    }
  }

  private unary(): Expr {
    const t = this.toks[this.i];
    if (t && ((t.t === 'op' && UNARY_OPERATORS.has(t.v)) || (t.t === 'id' && t.v === 'delete'))) {
      this.i += 1;
      return { k: 'unary', op: t.v, arg: this.unary() };
    }
    return this.postfix();
  }

  private postfix(): Expr {
    let e = this.primary();
    for (;;) {
      if (this.at('.')) {
        this.i += 1;
        const name = this.next();
        if (name.t !== 'id') throw PARSE_FAILURE;
        e = { k: 'member', obj: e, name: name.v };
      } else if (this.at('(')) {
        this.i += 1;
        e = { k: 'call', fn: e, args: this.list(')') };
      } else if (this.at('[')) {
        this.i += 1;
        const parts: Expr[] = [];
        if (!this.at(']') && !this.at(':')) parts.push(this.expression());
        const range = this.at(':');
        if (range) {
          this.i += 1;
          if (!this.at(']')) parts.push(this.expression());
        }
        this.expect(']');
        e = { k: 'index', obj: e, parts, range };
      } else if (this.at('++') || this.at('--')) {
        e = { k: 'unary', op: this.next().v, arg: e };
      } else return e;
    }
  }

  private list(close: string): Expr[] {
    const items: Expr[] = [];
    if (this.at(close)) {
      this.i += 1;
      return items;
    }
    for (;;) {
      items.push(this.expression());
      if (this.at(close)) {
        this.i += 1;
        return items;
      }
      this.expect(',');
    }
  }

  private primary(): Expr {
    const t = this.next();
    if (t.t === 'num') {
      const value = parseNumber(t.v);
      const unit = this.toks[this.i];
      const scale = unit?.t === 'id' ? UNITS.get(unit.v) : undefined;
      const digits = t.v.replace(/_/g, '');
      // solc reads a 39-41 digit hex literal as an address (a checksum error when it is not one).
      const address = digits.startsWith('0x') && Math.abs(digits.length - 42) <= 1;
      if (scale === undefined) return { k: 'num', v: value, address };
      this.i += 1;
      return { k: 'num', v: value && rat(value.n * scale, value.d), address: false };
    }
    if (t.t === 'str') {
      let s = t.s ?? '';
      while (this.toks[this.i]?.t === 'str') s += this.next().s ?? '';
      return { k: 'str', s };
    }
    if (t.t === 'id') {
      if (t.v === 'true' || t.v === 'false') return { k: 'bool' };
      return t.v === 'new' ? { k: 'new', type: this.typeName() } : { k: 'id', name: t.v };
    }
    if (t.v === '[') return { k: 'array', items: this.list(']') };
    if (t.v !== '(') throw PARSE_FAILURE;
    const items: Array<Expr | undefined> = [];
    for (;;) {
      items.push(this.at(',') || this.at(')') ? undefined : this.expression());
      if (this.at(')')) break;
      this.expect(',');
    }
    this.i += 1;
    return { k: 'tuple', items: items.length === 1 && !items[0] ? [] : items };
  }

  private typeName(): Expr {
    const first = this.next();
    if (first.t !== 'id') throw PARSE_FAILURE;
    let e: Expr = { k: 'id', name: first.v };
    while (this.at('.') && this.toks[this.i + 1]?.t === 'id') {
      e = { k: 'member', obj: e, name: this.toks[this.i + 1].v };
      this.i += 2;
    }
    while (this.at('[')) {
      this.i += 1;
      const parts = this.at(']') ? [] : [this.expression()];
      this.expect(']');
      e = { k: 'index', obj: e, parts, range: false };
    }
    return e;
  }
}
