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
  MethodCallNode,
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
  private counter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.ambiguousInlineKeys = collectAmbiguousInlineKeys(node.functions);
    this.funcByName = new Map();
    for (const fn of node.functions) this.funcByName.set(fn.name, fn);
    this.stateVarTypes = new Map();
    for (const sv of node.stateVariables) this.stateVarTypes.set(sv.name, sv.type);

    this.voidExternalCallHelpers = new Set();
    for (const fn of node.functions) {
      if (fn.body && fn.returnTypes.length === 0 && this.makesExternalCall(fn)) {
        this.voidExternalCallHelpers.add(fn.name);
      }
    }
    if (this.voidExternalCallHelpers.size === 0) return node;

    for (const fn of node.functions) {
      if (fn.body) fn.body.statements = this.inlineStatements(fn.body.statements ?? [], [fn.name]);
    }
    return node;
  }

  // True if fn calls a method on an interface-typed param/local/state var (an external call).
  private makesExternalCall(fn: FunctionDefinitionNode): boolean {
    const env = new Map<string, Type>(this.stateVarTypes);
    for (const p of fn.parameters) env.set(p.name, p.type);
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if (n instanceof VariableDefinitionNode) env.set(n.name, n.type);
      if (n instanceof FunctionCallNode) {
        const dot = n.identifier.name.indexOf('.');
        if (dot > 0 && this.isInterfaceTyped(env.get(n.identifier.name.slice(0, dot)))) found = true;
      }
      if (n instanceof MethodCallNode && n.object instanceof IdentifierNode
        && this.isInterfaceTyped(env.get(n.object.name))) found = true;
    });
    return found;
  }

  private isInterfaceTyped(t: Type | undefined): boolean {
    return t instanceof AddressType && t.interfaceName !== undefined;
  }

  // Rewrite a statement list, replacing eligible helper-call statements with the inlined helper body.
  private inlineStatements(stmts: StatementNode[], stack: string[]): StatementNode[] {
    const out: StatementNode[] = [];
    for (const stmt of stmts) {
      this.recurseNestedBlocks(stmt, stack);
      if (stmt instanceof FunctionCallStatementNode) {
        const name = stmt.call.identifier.name;
        const helper = this.funcByName.get(name);
        if (!name.includes('.') && helper && this.voidExternalCallHelpers.has(name) && !stack.includes(name)
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
    this.walk(root, (n) => {
      if (n instanceof IdentifierNode) {
        const dot = n.name.indexOf('.');
        if (dot > 0) {
          const head = n.name.slice(0, dot);
          if (map.has(head)) n.name = map.get(head)! + n.name.slice(dot);
        } else if (map.has(n.name)) {
          n.name = map.get(n.name)!;
        }
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
      if (v instanceof Node) this.walk(v, visit);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.walk(it, visit);
    }
  }
}
