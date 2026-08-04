import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  FunctionCallStatementNode,
  FunctionCallNode,
  VariableDefinitionNode,
  IdentifierNode,
  FieldAccessNode,
  AbiEncodeCallNode,
  MethodCallNode,
  CastNode,
  TupleAssignmentNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  UncheckedNode,
} from '../ast/AST.js';
import { collectAmbiguousInlineKeys, inlineKey } from './inlineOverloadGuard.js';
import { AmbiguousInlineOverloadError } from '../Errors.js';
import { AddressType, Type } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * Inlines internal calls to VOID helper functions that make external calls. An external call is a co-spend
 * verified in-script at a transaction position the entry point fixes; it can't be carried across an OP_INVOKE
 * subroutine boundary (the caller would have to supply the callee's synthetic external-call params and the SDK
 * would not discover the co-spend). Inlining the helper into the caller reduces it to the already-supported
 * "external call in the entry-point body" case, with no change to the audited external-call machinery.
 *
 * ```
 * function swap() public { _safeTransferFrom(token1, a, b, amt); }
 * function _safeTransferFrom(IERC20 t, address s, address r, uint256 v) private { require(t.transferFrom(s,r,v)); }
 * ->
 * function swap() public {
 *   IERC20 __inl0_t = token1; address __inl0_s = a; address __inl0_r = b; uint256 __inl0_v = amt;
 *   require(__inl0_t.transferFrom(__inl0_s, __inl0_r, __inl0_v));
 * }
 * ```
 *
 * The common Solidity SafeERC20 wrapper pattern (`_safeTransfer`, `_safeTransferFrom`, ...). Runs before
 * semantic analysis so the inlined external calls collect normally; the original helper is left in place
 * (a now-unreferenced private subroutine is harmless). Callee params and locals are alpha-renamed per call
 * site so repeated inlines do not collide.
 */
const PREFIX = '__inl';

export default class InlineExternalCallHelpers extends AstTraversal {
  private funcByName: Map<string, FunctionDefinitionNode> = new Map();
  private ambiguousInlineKeys: Set<string> = new Set(); // H8: <name>/<arity> shared by >1 overload.
  private stateVarTypes: Map<string, Type> = new Map();
  private voidExternalCallHelpers: Set<string> = new Set();
  private freeFns: FunctionDefinitionNode[] = [];
  private fileUsingForDirectives: { libraryName?: string, targetTypeName?: string }[] = [];
  private constNames: Set<string> = new Set(); // qualified names of file-level (library) constants (L.SIG)
  private counter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    this.freeFns = node.freeFunctions ?? [];
    this.fileUsingForDirectives = node.usingForDirectives ?? [];
    this.constNames = new Set((node.constantDefinitions ?? []).map((c) => c.name));
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const all = [...node.functions, ...this.freeFns];
    this.ambiguousInlineKeys = collectAmbiguousInlineKeys(all);
    this.funcByName = new Map();
    for (const fn of all) this.funcByName.set(fn.name, fn);
    this.stateVarTypes = new Map();
    for (const sv of node.stateVariables) this.stateVarTypes.set(sv.name, sv.type);
    this.qualifySiblingCalls();
    this.qualifySiblingConstants();
    this.desugarUsingForAddressCalls(node);

    this.voidExternalCallHelpers = new Set();
    for (const fn of all) {
      // Graph handlers intentionally execute behind OP_INVOKE: their hidden callManifest/caller/result
      // frame is what makes each reached edge authoritative. Flattening one into __message_bus1 erases that
      // context and turns its external calls into inert ordinary-call nodes.
      if (!fn.graphEmissionHandler && fn.body && fn.returnTypes.length === 0
        && this.makesExternalCall(fn)) {
        this.voidExternalCallHelpers.add(fn.name);
      }
    }
    if (this.voidExternalCallHelpers.size === 0) return node;

    // Normalize the retained library/free-function definitions too. A transitive wrapper such as
    // `L.g(i) { L.f(i); }`, where L.f performs the external call, is inlined at contract call sites below, but
    // L.g's own retained definition must not keep calling L.f after semantic analysis injects L.f's compiler-only
    // covenant parameters. Inlining the same helper body here leaves L.g with the direct external call and its own
    // correctly discovered witness parameters.
    for (const fn of this.freeFns) {
      if (fn.body) fn.body.statements = this.inlineStatements(fn.body.statements ?? [], [fn.name]);
    }
    for (const fn of node.functions) {
      if (fn.body) fn.body.statements = this.inlineStatements(fn.body.statements ?? [], [fn.name]);
    }
    return node;
  }

  private static isLowLevel(m: string): boolean {
    return m === 'call' || m === 'staticcall' || m === 'delegatecall';
  }

  // A same-library sibling call is written unqualified (`_callOptionalReturn` inside `SafeERC20.safeTransfer`) but
  // the function is registered qualified. Rewrite to the qualified name so detection + inlining resolve the target.
  private qualifySiblingCalls(): void {
    for (const fn of this.freeFns) {
      const dot = fn.name.lastIndexOf('.');
      if (dot < 0 || !fn.body) continue;
      const prefix = fn.name.slice(0, dot + 1);
      this.walk(fn.body, (n) => {
        if (n instanceof FunctionCallNode && !n.identifier.name.includes('.')
          && this.funcByName.has(prefix + n.identifier.name)) {
          n.identifier.name = prefix + n.identifier.name;
        }
      });
    }
  }

  // A same-library sibling CONSTANT is written unqualified (`SIG_TRANSFER_FROM` inside `BoringERC20.safeTransferFrom`)
  // but is registered qualified (`BoringERC20.SIG_TRANSFER_FROM`). When the helper is inlined into a consumer the
  // library `currentFunction` context is lost, so the later qualifyLibrarySiblingConstant cannot resolve it. Qualify
  // the reference here (before inlining), skipping any name a param/local shadows. Mirrors qualifySiblingCalls.
  private qualifySiblingConstants(): void {
    for (const fn of this.freeFns) {
      const dot = fn.name.lastIndexOf('.');
      if (dot < 0 || !fn.body) continue;
      const prefix = fn.name.slice(0, dot + 1);
      const shadowed = new Set<string>(fn.parameters.map((p) => p.name));
      this.walk(fn.body, (n) => { if (n instanceof VariableDefinitionNode) shadowed.add(n.name); });
      this.walk(fn.body, (n) => {
        if (n instanceof IdentifierNode && !n.name.includes('.')
          && !shadowed.has(n.name) && this.constNames.has(prefix + n.name)) {
          n.name = prefix + n.name;
        }
      });
    }
  }

  // True if fn makes an external call: a method on an interface-typed var, a low-level `.call`/`.staticcall`/
  // `.delegatecall`, OR (transitively) a call to a known helper that does. The transitive case covers the OZ
  // SafeERC20 void wrappers (safeTransfer -> _callOptionalReturn -> Address.functionCall -> target.call), which
  // must inline into the entry point so the low-level call's covenant param is supplied there.
  private makesExternalCall(fn: FunctionDefinitionNode, seen: Set<string> = new Set()): boolean {
    if (seen.has(fn.name)) return false;
    seen.add(fn.name);
    const env = new Map<string, Type>(this.stateVarTypes);
    for (const p of fn.parameters) env.set(p.name, p.type);
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if (n instanceof VariableDefinitionNode) env.set(n.name, n.type);
      if (n instanceof FunctionCallNode) {
        const name = n.identifier.name;
        const dot = name.indexOf('.');
        if (dot > 0 && this.isInterfaceTyped(env.get(name.slice(0, dot)))) { found = true; return; }
        if (dot > 0 && InlineExternalCallHelpers.isLowLevel(name.slice(dot + 1))) { found = true; return; }
        const callee = this.funcByName.get(name);
        if (callee && callee !== fn && this.makesExternalCall(callee, seen)) { found = true; return; }
      }
      if (n instanceof MethodCallNode) {
        if (n.object instanceof IdentifierNode && this.isInterfaceTyped(env.get(n.object.name))) { found = true; return; }
        if (InlineExternalCallHelpers.isLowLevel(n.methodName)) found = true;
      }
    });
    return found;
  }

  private isInterfaceTyped(t: Type | undefined): boolean {
    return t instanceof AddressType && t.interfaceName !== undefined;
  }

  // Rewrite `address(x).method(args)` -> `L.method(address(x), args)` for `using L for address` where L.method is
  // an external-call helper (OZ SafeERC20's `address(token).functionCall(data)`). Runs on ALL bodies (free +
  // contract) before detection so a void wrapper holding this using-for call is recognised and inlined. Overloads
  // collapse to `L.method`; the returning-helper inliner resolves the arity later.
  private desugarUsingForAddressCalls(node: ContractNode): void {
    const bound = new Map<string, string>();
    // `using L for address` inside a library body (OZ SafeERC20's `using Address for address`) lands on the file,
    // not the consuming contract, so combine both directive sources.
    for (const d of [...(node.usingForDirectives ?? []), ...this.fileUsingForDirectives]) {
      if (!d.libraryName || d.targetTypeName !== 'address') continue;
      const prefix = `${d.libraryName}.`;
      for (const fn of this.freeFns) {
        if (fn.name.startsWith(prefix) && fn.body && this.makesExternalCall(fn)) {
          bound.set(fn.name.slice(prefix.length), fn.name);
        }
      }
    }
    if (bound.size === 0) return;
    const convert = (n: Node): Node => {
      if (n instanceof MethodCallNode && !n.callOptions && !n.fieldNames
        && n.object instanceof CastNode && n.object.type instanceof AddressType && bound.has(n.methodName)) {
        const call = new FunctionCallNode(new IdentifierNode(bound.get(n.methodName)!), [n.object, ...n.parameters]);
        call.location = n.location;
        return call;
      }
      return n;
    };
    const bodies = [...node.functions, ...this.freeFns, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) if (fn?.body) this.transformNodes(fn.body, convert);
  }

  // In-place child-replacing walk: apply `xform` to each child Node, substituting the returned node when changed.
  private transformNodes(node: Node, xform: (n: Node) => Node): void {
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) {
        const rep = xform(v);
        (node as unknown as Record<string, unknown>)[key] = rep;
        this.transformNodes(rep, xform);
      } else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i += 1) {
          if (v[i] instanceof Node) {
            const rep = xform(v[i]);
            v[i] = rep;
            this.transformNodes(rep, xform);
          }
        }
      }
    }
  }

  // Rewrite a statement list, replacing eligible helper-call statements with the inlined helper body.
  private inlineStatements(stmts: StatementNode[], stack: string[]): StatementNode[] {
    const out: StatementNode[] = [];
    for (const stmt of stmts) {
      this.recurseNestedBlocks(stmt, stack);
      if (stmt instanceof FunctionCallStatementNode) {
        const name = stmt.call.identifier.name;
        const helper = this.funcByName.get(name);
        // A qualified library call (`SafeERC20.safeTransfer`) is eligible too - the name is the registered helper.
        if (helper && this.voidExternalCallHelpers.has(name) && !stack.includes(name)
          && stmt.call.parameters.length === helper.parameters.length) {
          if (this.ambiguousInlineKeys.has(inlineKey(name, stmt.call.parameters.length))) {
            throw new AmbiguousInlineOverloadError(stmt.call, name, stmt.call.parameters.length);
          }
          out.push(...this.inlineCall(helper, stmt.call.parameters, stack));
          continue;
        }
      }
      out.push(stmt);
    }
    return out;
  }

  private recurseNestedBlocks(stmt: StatementNode, stack: string[]): void {
    const inline = (b: BlockNode | undefined): void => {
      if (b) b.statements = this.inlineStatements(b.statements ?? [], stack);
    };
    if (stmt instanceof BranchNode) {
      inline(stmt.ifBlock);
      inline(stmt.elseBlock);
    } else if (stmt instanceof WhileNode || stmt instanceof DoWhileNode) {
      inline(stmt.block);
    } else if (stmt instanceof UncheckedNode) {
      inline(stmt.block);
    } else if (stmt instanceof BlockNode) {
      inline(stmt);
    }
  }

  // Produce [param-binding decls..., alpha-renamed helper body...] for one inlined call site.
  private inlineCall(helper: FunctionDefinitionNode, args: Node[], stack: string[]): StatementNode[] {
    const n = this.counter++;
    const map = new Map<string, string>();
    for (const p of helper.parameters) map.set(p.name, `${PREFIX}${n}_${p.name}`);
    const body = cloneNode(helper.body);
    this.walk(body, (node) => {
      if (node instanceof VariableDefinitionNode && !map.has(node.name)) {
        map.set(node.name, `${PREFIX}${n}_${node.name}`);
      }
      // Tuple-destructured declarations `(bool ok, bytes ret) = ...` hold names as plain strings in `elements`;
      // collect the freshly-declared ones so repeated inlines do not collide ("Redefinition of variable ok").
      if (node instanceof TupleAssignmentNode) {
        for (const el of node.elements) {
          if (el.name && !el.existing && !el.skip && !map.has(el.name)) map.set(el.name, `${PREFIX}${n}_${el.name}`);
        }
      }
    });
    this.applyRename(body, map);

    const bindings = helper.parameters.map((p, i) => {
      const def = new VariableDefinitionNode(p.type, [], map.get(p.name)!, cloneNode(args[i]) as never);
      def.location = args[i].location ?? helper.location;
      return def;
    });
    const inlined = this.inlineStatements(body.statements ?? [], [...stack, helper.name]);
    return [...bindings, ...inlined];
  }

  private applyRename(root: Node, map: Map<string, string>): void {
    const rn = (name: string): string => {
      const dot = name.indexOf('.');
      if (dot > 0 && map.has(name.slice(0, dot))) return map.get(name.slice(0, dot))! + name.slice(dot);
      return map.get(name) ?? name;
    };
    this.walk(root, (n) => {
      if (n instanceof IdentifierNode) {
        n.name = rn(n.name);
      } else if (n instanceof FieldAccessNode) {
        // n.name is a STRUCT FIELD MEMBER, not a variable - never rename it (the base is still walked as a
        // child). A local sharing a struct field's name would otherwise corrupt `obj.field` -> `obj.__rhN_field`.
      } else if (n instanceof TupleAssignmentNode) {
        // New element objects: cloneNode shares the plain-object `elements` across clones, so in-place mutation
        // would stomp another inline frame's rename (dangling `__rhN_<slot>`).
        n.elements = n.elements.map((el) => (el.name ? { ...el, name: rn(el.name) } : el));
      } else if (n instanceof AbiEncodeCallNode) {
        // interfaceName is a VARIABLE ref (`abi.encodeCall(token.approve, ..)` - `token` is an inlined param
        // renamed to `__rhN_token`); rename it so the selector resolves. functionName is a fixed interface method.
        // OZ SafeERC20.forceApprove (a VOID low-level-call helper inlined here) is the trigger.
        n.interfaceName = rn(n.interfaceName);
      } else {
        const nm = (n as unknown as { name?: unknown }).name;
        if (typeof nm === 'string' && map.has(nm)) (n as unknown as { name: string }).name = map.get(nm)!;
      }
    });
  }

  // Pre-order walk over child Nodes (and Node arrays); skips Type/symbol-table fields.
  private walk(node: Node | undefined, visit: (n: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) {
        this.walk(v, visit);
      } else if (Array.isArray(v)) {
        for (const it of v) if (it instanceof Node) this.walk(it, visit);
      } else if (key === 'callOptions' && v && typeof v === 'object') {
        // Descend into {value, gas, salt} so a param in `x.call{value: v}(d)` is alpha-renamed on inline.
        for (const opt of Object.values(v as unknown as Record<string, unknown>)) {
          if (opt instanceof Node) this.walk(opt, visit);
        }
      }
    }
  }
}
