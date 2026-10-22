import {
  BlockNode, ExpressionNode, FunctionDefinitionNode, IdentifierNode, ModifierDefinitionNode, Node, SourceFileNode,
  StatementNode, VariableDefinitionNode, type LvalueKeyTag,
} from '../ast/AST.js';
import { hasSideEffects, stateChangingFunctionNames } from './sideEffects.js';

// Fields linking to other parts of the graph rather than holding a child.
const LINKS = new Set([
  'location', 'type', 'definition', 'symbolTable', 'resolvedFunction', 'functionReference', 'referencedContract',
  'errorDefinition', 'namedOverloadCandidates',
]);

type Holder = Record<string | number, unknown>;
interface KeyBuild { holder: Holder; slot: string | number; node: ExpressionNode }

/**
 * The parser builds a read-modify-write's key once per use (`m[k] += v` reads and writes `m[k]`, a field rebuild
 * reads every other field) and tags the builds of a key that might have a side effect (AstBuilder.buildLvalueAssign).
 * When a key built more than once has one, by the sideEffects.ts rule, the write's non-literal keys are bound to
 * temps, in order, before its first statement, so each evaluates once. Otherwise the tags are dropped and the
 * statements stay as they are. A storage-pointer declaration (`S storage p = m[k]`) drops out and every use of `p`
 * rebuilds its keys; the parser keeps it in place holding them (AstBuilder.markAliasKeys). When one has a side
 * effect, its keys bind at the declaration for the rest of its statement list, used or not; the declaration goes.
 * Needs every declaration: runs on an import-free source once parsed, else on the program once its imports merge.
 */
export default function bindLvalueKeyEffects(ast: SourceFileNode): void {
  new LvalueKeyBinder(stateChangingFunctionNames(ast)).walk(ast);
}

class LvalueKeyBinder {
  private readonly seen = new WeakSet<Node>();
  private callable?: FunctionDefinitionNode | ModifierDefinitionNode;
  private callableNames?: Set<string>;
  private temps = 0;

  constructor(private readonly writers: Set<string>) {}

  walk(node: Node): void {
    if (node instanceof ExpressionNode || this.seen.has(node)) return;
    this.seen.add(node);
    const outer = this.callable;
    if (node instanceof FunctionDefinitionNode || node instanceof ModifierDefinitionNode) {
      this.callable = node;
      this.callableNames = undefined;
    }
    const fields = node as unknown as Holder;
    for (const [key, value] of Object.entries(node)) {
      if (LINKS.has(key)) continue;
      if (Array.isArray(value)) {
        if (value.some((item) => item instanceof StatementNode)) this.bindList(value as StatementNode[]);
        for (const item of value) if (item instanceof Node) this.walk(item);
      } else if (value instanceof StatementNode && value.lvalueKeyUnit !== undefined) {
        if (value.lvalueKeyAlias) {
          // A storage-pointer declaration outside a statement list has no later statement to bind for.
          this.unmark(value);
        } else {
          const temps = this.bind([value]);
          if (temps.length > 0) fields[key] = this.at(new BlockNode([...temps, value]), value);
        }
        this.walk(fields[key] as Node);
      } else if (value instanceof Node) {
        this.walk(value);
      }
    }
    if (this.callable !== outer) {
      this.callable = outer;
      this.callableNames = undefined;
    }
  }

  // Binds each run of consecutive statements of one write, in place. A storage-pointer declaration binds over the
  // rest of the list, its alias's scope, and gives way to its temps.
  private bindList(list: Array<StatementNode | undefined>): void {
    for (let i = 0; i < list.length; i += 1) {
      const statement = list[i];
      const unit = statement?.lvalueKeyUnit;
      if (statement === undefined || unit === undefined) continue;
      if (statement.lvalueKeyAlias) {
        const temps = this.bind(list.slice(i) as StatementNode[]);
        list.splice(i, 1, ...temps);
        i += temps.length - 1;
        continue;
      }
      let end = i + 1;
      while (end < list.length && list[end]?.lvalueKeyUnit === unit) end += 1;
      const temps = this.bind(list.slice(i, end) as StatementNode[]);
      list.splice(i, 0, ...temps);
      i = end + temps.length - 1;
    }
  }

  // The temps binding one write's keys, none when no key built twice has a side effect (a storage-pointer
  // declaration's: none when no key has one). Clears the tags; each build of a bound key becomes a read of its temp.
  private bind(statements: StatementNode[]): StatementNode[] {
    const unit = statements[0].lvalueKeyUnit!;
    const declaration = statements[0].lvalueKeyAlias !== undefined;
    const keys = new Map<number, { tag: LvalueKeyTag; builds: KeyBuild[] }>();
    const visited = new Set<Node>();
    const collect = (holder: Holder, slot: string | number): void => {
      const value = holder[slot];
      if (!(value instanceof Node)) return;
      const tag = value instanceof ExpressionNode ? value.lvalueKey : undefined;
      if (tag?.unit === unit) {
        const key = keys.get(tag.index) ?? { tag, builds: [] };
        key.builds.push({ holder, slot, node: value as ExpressionNode });
        keys.set(tag.index, key);
        return;
      }
      if (visited.has(value)) return;
      visited.add(value);
      if (value instanceof StatementNode && value.lvalueKeyUnit === unit) delete value.lvalueKeyUnit;
      for (const [field, child] of Object.entries(value)) {
        if (LINKS.has(field)) continue;
        if (Array.isArray(child)) child.forEach((_item, i) => collect(child as unknown as Holder, i));
        else collect(value as unknown as Holder, field);
      }
    };
    statements.forEach((_statement, i) => collect(statements as unknown as Holder, i));
    const changesState = (name: string): boolean => this.writers.has(name) || this.declared().has(name);
    const bound = [...keys.values()].some(({ builds }) => (declaration || builds.length > 1)
      && hasSideEffects(builds[0].node, changesState));
    for (const { builds } of keys.values()) for (const { node } of builds) delete node.lvalueKey;
    if (!bound) return [];
    return [...keys.entries()].sort(([a], [b]) => a - b).map(([, { tag, builds }]) => {
      const name = `__lk_tmp_${this.temps++}`;
      const first = builds[0].node;
      for (const { holder, slot, node } of builds) holder[slot] = this.at(new IdentifierNode(name), node);
      const temp = this.at(new VariableDefinitionNode(tag.type, [], name, first), first);
      // The declaration's own build is its only one when the alias is never used.
      if (declaration && builds.length === 1) temp.allowUnused = true;
      return temp;
    });
  }

  // Leaves an unbound storage-pointer declaration the empty statement it stands for.
  private unmark(statement: StatementNode): void {
    for (const key of statement.lvalueKeyAlias ?? []) delete key.lvalueKey;
    delete statement.lvalueKeyUnit;
    delete statement.lvalueKeyAlias;
    if (statement instanceof BlockNode) delete statement.scoped;
  }

  // Parameters and locals of the enclosing callable: calling one goes through a function pointer.
  private declared(): Set<string> {
    if (this.callableNames !== undefined) return this.callableNames;
    const names = new Set<string>();
    const callable = this.callable;
    if (callable !== undefined) {
      for (const parameter of callable.parameters) names.add(parameter.name);
      const visited = new Set<Node>();
      const visit = (node: Node): void => {
        if (node instanceof ExpressionNode || visited.has(node)) return;
        visited.add(node);
        if (node instanceof VariableDefinitionNode) names.add(node.name);
        for (const [field, child] of Object.entries(node)) {
          if (LINKS.has(field)) continue;
          if (child instanceof Node) visit(child);
          else if (Array.isArray(child)) for (const item of child) if (item instanceof Node) visit(item);
        }
      };
      const body: Node[] = callable instanceof FunctionDefinitionNode ? [callable.body] : callable.statements;
      for (const statement of body) if (statement instanceof Node) visit(statement);
    }
    this.callableNames = names;
    return names;
  }

  private at<T extends Node>(node: T, source: Node): T {
    node.location = source.location;
    return node;
  }
}
