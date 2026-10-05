import { describe, expect, it } from 'vitest';
import { parseCode } from '../src/compiler.js';
import {
  AssignNode, BranchNode, IdentifierNode, Node, StateAssignNode, VariableDefinitionNode,
} from '../src/ast/AST.js';
import LowerCollectionJournalHelpers from '../src/semantic/LowerCollectionJournalHelpers.js';

const descendants = (root: Node): Node[] => [root, ...Object.entries(root).flatMap(([key, value]) => {
  if (['location', 'type', 'symbolTable'].includes(key)) return [];
  if (value instanceof Node) return descendants(value);
  return Array.isArray(value) ? value.flatMap((child) => child instanceof Node ? descendants(child) : []) : [];
})];

const lower = (includeWriter: boolean): Node => {
  const ast = parseCode(`contract Cache() {
    address[] members;
    mapping(int => int) values;
    function writer(int key, address value) internal {
      this.members.push(value); this.values[key] = 1; require(true);
    }
    function reader(int key) internal {
      require(this.members.length >= 0); require(this.values[key] >= 0);
    }
    function route(bool selected, int key, address value) public {
      reader(key);
      ${includeWriter ? 'if (selected) { writer(key, value); }' : ''}
      require(true);
    }
  }`);
  ast.contract.stateVariables[0].isDynamic = true;
  for (const fn of ast.contract.functions) {
    if (fn.name !== 'route') fn.forceCollectionJournalPool = true;
  }
  ast.accept(new LowerCollectionJournalHelpers(true));
  return ast.contract.functions.find((fn) => fn.name === 'route')!.body;
};

describe('pooled dynamic cache write-back', () => {
  it('guards a sibling write-back with a dirty bit set only inside its selected call', () => {
    const body = lower(true);
    const nodes = descendants(body);
    const dirty = '__dcj_cache_dirty_mask_0';
    expect(nodes.filter((node) => node instanceof VariableDefinitionNode && node.name === dirty)).toHaveLength(1);
    const branches = nodes.filter((node): node is BranchNode => node instanceof BranchNode);
    const selected = branches.find((branch) => branch.condition instanceof IdentifierNode
      && branch.condition.name === 'selected')!;
    const marks = (node: Node): Node[] => descendants(node).filter((child) => child instanceof AssignNode
      && child.identifier.name === dirty);
    expect(marks(body)).toHaveLength(1);
    expect(marks(selected.ifBlock)).toHaveLength(1);
    const flushes = branches.filter((branch) => (branch.ifBlock.statements ?? [])
      .some((statement) => statement instanceof StateAssignNode && statement.name === 'members'));
    expect(flushes).toHaveLength(1);
    expect(descendants(flushes[0].condition).some((node) => node instanceof IdentifierNode && node.name === dirty))
      .toBe(true);
  });

  it('does not create a write-back or dirty flag for read-only dynamic helpers', () => {
    const nodes = descendants(lower(false));
    expect(nodes.some((node) => node instanceof StateAssignNode && node.name === 'members')).toBe(false);
    expect(nodes.some((node) => node instanceof VariableDefinitionNode
      && node.name.startsWith('__dcj_cache_dirty_mask'))).toBe(false);
  });
});
