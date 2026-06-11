import { Script, scriptToBitAuthAsm } from './script.js';
import { sourceMapToLocationData } from './source-map.js';
import { PositionHint } from './types.js';

export type LineToOpcodesMap = Record<string, Script>;
export type LineToAsmMap = Record<string, string>;

export function buildLineToOpcodesMap(bytecode: Script, sourceMap: string): LineToOpcodesMap {
  const locationData = sourceMapToLocationData(sourceMap);

  // Track the maximum line assigned so far to preserve bytecode order.
  // Source maps for constructs like `for` loops can map later bytecode positions
  // to earlier source lines (e.g. the update expression `i = i + 1` maps to
  // the for-header line, but appears after the loop body in the bytecode).
  // Without this guard, grouping by line reorders opcodes and produces
  // incorrect CashAssembly in the debug template.
  let maxLine = 0;

  return locationData.reduce<LineToOpcodesMap>((lineToOpcodeMap, { location, positionHint }, index) => {
    if (index >= bytecode.length) return lineToOpcodeMap;
    const opcode = bytecode[index];
    let line = positionHint === PositionHint.END ? location?.end.line : location?.start.line;

    if (line !== undefined && line < maxLine) line = maxLine;
    if (line !== undefined) maxLine = Math.max(maxLine, line);

    return {
      ...lineToOpcodeMap,
      [line]: [...(lineToOpcodeMap[line] || []), opcode],
    };
  }, {});
}

export function buildLineToAsmMap(bytecode: Script, sourceMap: string): LineToAsmMap {
  const lineToOpcodesMap = buildLineToOpcodesMap(bytecode, sourceMap);

  return Object.fromEntries(
    Object.entries(lineToOpcodesMap).map(([lineNumber, opcodeList]) => [lineNumber, scriptToBitAuthAsm(opcodeList)]),
  );
}

export function formatBitAuthScript(bytecode: Script, sourceMap: string, sourceCode: string): string {
  const lineToAsmMap = buildLineToAsmMap(bytecode, sourceMap);

  const escapedSourceCode = sourceCode.replaceAll('/*', '\\/*').replaceAll('*/', '*\\/');
  const sourceCodeLines = escapedSourceCode.split('\n');

  const sourceCodeLineLengths = sourceCodeLines.map((line) => line.length);
  const bytecodeLineLengths = Object.values(lineToAsmMap).map((line) => line.length);

  const maxSourceCodeLength = Math.max(...sourceCodeLineLengths);
  const maxBytecodeLength = Math.max(...bytecodeLineLengths);

  const annotatedAsmLines = sourceCodeLines.map((line, index) => {
    const lineAsm = lineToAsmMap[index + 1];
    return `${(lineAsm || '').padEnd(maxBytecodeLength)} /* ${line.padEnd(maxSourceCodeLength)} */`;
  });

  return annotatedAsmLines.join('\n');
}
