/**
 * A compiler-published call guard written back as source-like text, for a refusal that names the guard. Only for
 * reading: a part the text cannot name is written `…`, and nothing is evaluated.
 */

import type { AbiFunction, ArgSource, ExternalCallExpression } from '@solidcash/utils';

/** The registers a builder states beside a contract's state, under the names the source reads them by. */
const REGISTER_NAMES: Readonly<Record<string, string>> = {
  __block_number: 'block.number',
  __block_timestamp: 'block.timestamp',
  __msg_value: 'msg.value',
};

export function callGuardText(
  guard: ExternalCallExpression,
  fn: Pick<AbiFunction, 'inputs' | 'externalCalls'>,
): string {
  const visible = fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const source = (argument: ArgSource | undefined): string => {
    switch (argument?.kind) {
      case 'forward': return visible[argument.paramIndex ?? -1]?.name ?? '…';
      case 'arrayElement': return `${visible[argument.paramIndex ?? -1]?.name ?? '…'}[${argument.indexValue ?? '…'}]`;
      case 'constructorArg': return argument.paramName ?? '…';
      case 'literal': return argument.value ?? '…';
      case 'msgSender': return argument.senderOp === 'tx.origin' ? 'tx.origin' : 'msg.sender';
      case 'selfAddress': return 'address(this)';
      case 'loopIndex': return argument.counterName ?? '…';
      case 'expression': return text(argument.expression, 0);
      default: return '…';
    }
  };
  const text = (node: ExternalCallExpression | undefined, depth: number): string => {
    if (node === undefined || depth > 24) return '…';
    const part = (child: ExternalCallExpression | undefined): string => text(child, depth + 1);
    const operand = (child: ExternalCallExpression | undefined): string => (
      child?.kind === 'binary' || child?.kind === 'ternary' ? `(${part(child)})` : part(child));
    switch (node.kind) {
      case 'literal':
        return typeof node.value === 'string' && node.type?.startsWith('bytes') ? `0x${node.value}` : String(node.value);
      case 'state': return REGISTER_NAMES[node.name ?? ''] ?? node.name ?? '…';
      case 'stateAccess': return `${node.name ?? '…'}${(node.args ?? []).map((key) => `[${part(key)}]`).join('')}`;
      case 'source': return source(node.source);
      case 'identifier': return node.name ?? '…';
      case 'cast': return `${node.type ?? '…'}(${part(node.expression)})`;
      case 'field': return `${operand(node.expression)}.${node.name ?? '…'}`;
      case 'binary': return `${operand(node.left)} ${node.operator ?? '…'} ${operand(node.right)}`;
      case 'ternary': return `${operand(node.condition)} ? ${operand(node.ifTrue)} : ${operand(node.ifFalse)}`;
      case 'unary': {
        const operator = node.operator ?? '…';
        if (operator.startsWith('.')) return `${operand(node.expression)}${operator}`;
        if (operator.includes('[i]')) return operator.replace('[i]', `[${part(node.expression)}]`);
        return `${operator}${operand(node.expression)}`;
      }
      case 'producerResult': {
        const call = fn.externalCalls?.find((candidate) => candidate.callsiteId === node.callsiteId);
        return call === undefined ? 'an earlier call\'s result' : `${call.interfaceName}.${call.functionName}(…)`
          + ((call.returnTypes?.length ?? 1) > 1 ? `[${node.resultIndex ?? '…'}]` : '');
      }
      case 'externalCall': return `${node.name ?? '…'}(${(node.args ?? []).map(part).join(', ')})`;
      default: return '…';
    }
  };
  return text(guard, 0);
}
