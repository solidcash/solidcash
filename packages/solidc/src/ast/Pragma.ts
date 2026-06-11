import type { VersionOperatorContext } from '../grammar/SolidCashParser.js';

export enum PragmaName {
  SOLIDCASH = 'solidcash',
}

export enum VersionOp {
  CARET = '^',
  TILDE = '~',
  GE = '>=',
  GT = '>',
  LT = '<',
  LE = '<=',
  EQ = '=',
}

export function getPragmaName(name: string): PragmaName {
  return PragmaName[name.toUpperCase() as keyof typeof PragmaName];
}

export function getVersionOpFromCtx(ctx?: VersionOperatorContext): VersionOp {
  return <VersionOp>(ctx ? ctx.getText() : '=');
}
