import type { ExternalCallExpression } from '@solidcash/utils';

export class ExternalExpressionPathError extends Error {
  constructor(message: string) {
    super(`External expression path: ${message}`);
    this.name = 'ExternalExpressionPathError';
  }
}

export class ExternalExpressionUnresolvedConditionError extends ExternalExpressionPathError {}

/**
 * Visit one expression in runtime evaluation order. Conditional expressions and short-circuit operators visit
 * only the selected branch, after their condition has been resolved. This prevents an inactive producer-result
 * arm from becoming a speculative graph dependency.
 */
export async function visitExternalExpressionEvaluationPath(
  expression: ExternalCallExpression,
  visitNode: (node: ExternalCallExpression) => Promise<void>,
  evaluate: (node: ExternalCallExpression) => unknown,
): Promise<void> {
  const visit = async (candidate: ExternalCallExpression | undefined): Promise<void> => {
    if (!candidate) return;
    if (candidate.kind === 'ternary') {
      if (!candidate.condition || !candidate.ifTrue || !candidate.ifFalse) {
        throw new ExternalExpressionPathError('ternary expression omits a condition or result arm.');
      }
      await visit(candidate.condition);
      const condition = evaluate(candidate.condition);
      if (condition === undefined) {
        throw new ExternalExpressionUnresolvedConditionError('ternary condition cannot be resolved before selecting an arm.');
      }
      await visit(Boolean(condition) ? candidate.ifTrue : candidate.ifFalse);
      await visitNode(candidate);
      return;
    }
    if (candidate.kind === 'binary' && (candidate.operator === '&&' || candidate.operator === '||')) {
      if (!candidate.left || !candidate.right) {
        throw new ExternalExpressionPathError(`'${candidate.operator}' expression omits an operand.`);
      }
      await visit(candidate.left);
      const left = evaluate(candidate.left);
      if (left === undefined) {
        throw new ExternalExpressionUnresolvedConditionError(
          `'${candidate.operator}' left operand cannot be resolved before short-circuit selection.`,
        );
      }
      if ((candidate.operator === '&&' && Boolean(left))
        || (candidate.operator === '||' && !Boolean(left))) await visit(candidate.right);
      await visitNode(candidate);
      return;
    }
    for (const child of [candidate.target, candidate.expression, candidate.left, candidate.right,
      candidate.condition, candidate.ifTrue, candidate.ifFalse]) await visit(child);
    for (const child of candidate.args ?? []) await visit(child);
    await visitNode(candidate);
  };
  await visit(expression);
}
