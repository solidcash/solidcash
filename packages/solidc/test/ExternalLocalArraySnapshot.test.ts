import { ArrayType, PrimitiveType } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  ArrayAssignNode, ArrayPushNode, BlockNode, BoolLiteralNode, BreakNode, ExternalCallExpression, IdentifierNode,
  IntLiteralNode, NewArrayNode, VariableDefinitionNode, WhileNode,
} from '../src/ast/AST.js';
import { serializeLocalArraySnapshot } from '../src/semantic/external-call-local-array.js';

const declaration = (): VariableDefinitionNode => new VariableDefinitionNode(
  new ArrayType(PrimitiveType.INT), [], 'values', new NewArrayNode(PrimitiveType.INT, new IntLiteralNode(1n)),
);
const target = new IdentifierNode('values');
const serialize = (): ExternalCallExpression => ({ kind: 'literal', type: 'bigint', value: '0' });

describe('local array snapshot admission', () => {
  it('rejects ambiguous shadowed bindings instead of matching writes by spelling', () => {
    expect(serializeLocalArraySnapshot(target, [declaration(), new BlockNode([declaration()])], serialize))
      .toBeUndefined();
  });

  it('rejects an unsupported mutation instead of retaining the old allocation', () => {
    expect(serializeLocalArraySnapshot(target, [declaration(), new ArrayPushNode('values', new IntLiteralNode(2n))], serialize))
      .toBeUndefined();
  });

  it('does not discard an early exit before a relevant write', () => {
    const loop = new WhileNode(new BoolLiteralNode(true), new BlockNode([
      new BreakNode(), new ArrayAssignNode('values', new IntLiteralNode(0n), new IntLiteralNode(2n)),
    ]));
    expect(serializeLocalArraySnapshot(target, [declaration(), loop], serialize)).toBeUndefined();
  });

  it('serializes each value with only its preceding statements in scope', () => {
    const initial = declaration();
    const first = new ArrayAssignNode('values', new IntLiteralNode(0n), new IntLiteralNode(2n));
    const second = new ArrayAssignNode('values', new IntLiteralNode(0n), new IntLiteralNode(3n));
    const seen: unknown[][] = [];
    expect(serializeLocalArraySnapshot(target, [initial, first, second], (_value, _locals, before) => {
      seen.push([...before]);
      return serialize();
    })).toBeDefined();
    expect(seen).toEqual([[], [initial], [initial], [initial, first], [initial, first]]);
  });
});
