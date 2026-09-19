import { scriptToBitAuthAsm } from './script.js';
import { sourceMapToLocationData } from './source-map.js';
import { PositionHint } from './types.js';
export function buildLineToOpcodesMap(bytecode, sourceMap) {
    const locationData = sourceMapToLocationData(sourceMap);
    // Track the maximum line assigned so far to preserve bytecode order.
    // Source maps for constructs like `for` loops can map later bytecode positions
    // to earlier source lines (e.g. the update expression `i = i + 1` maps to
    // the for-header line, but appears after the loop body in the bytecode).
    // Without this guard, grouping by line reorders opcodes and produces
    // incorrect CashAssembly in the debug template.
    let maxLine = 0;
    const lineToOpcodeMap = {};
    locationData.forEach(({ location, positionHint }, index) => {
        if (index >= bytecode.length)
            return;
        const opcode = bytecode[index];
        let line = positionHint === PositionHint.END ? location?.end.line : location?.start.line;
        if (line !== undefined && line < maxLine)
            line = maxLine;
        if (line !== undefined)
            maxLine = Math.max(maxLine, line);
        const bucket = lineToOpcodeMap[line] ?? (lineToOpcodeMap[line] = []);
        bucket.push(opcode);
    });
    return lineToOpcodeMap;
}
export function buildLineToAsmMap(bytecode, sourceMap, instructionReplacements = new Map()) {
    if (instructionReplacements.size === 0) {
        const lineToOpcodesMap = buildLineToOpcodesMap(bytecode, sourceMap);
        return Object.fromEntries(Object.entries(lineToOpcodesMap).map(([lineNumber, opcodeList]) => [lineNumber, scriptToBitAuthAsm(opcodeList)]));
    }
    const locationData = sourceMapToLocationData(sourceMap);
    let maxLine = 0;
    const lineToAsmMap = {};
    locationData.forEach(({ location, positionHint }, index) => {
        if (index >= bytecode.length)
            return;
        let line = positionHint === PositionHint.END ? location?.end.line : location?.start.line;
        if (line !== undefined && line < maxLine)
            line = maxLine;
        if (line !== undefined)
            maxLine = Math.max(maxLine, line);
        const asm = instructionReplacements.get(index) ?? scriptToBitAuthAsm([bytecode[index]]);
        lineToAsmMap[line] = [...(lineToAsmMap[line]?.split(' ') ?? []), asm].filter(Boolean).join(' ');
    });
    return lineToAsmMap;
}
export function formatBitAuthScript(bytecode, sourceMap, sourceCode, instructionReplacements = new Map()) {
    if (!sourceMap)
        return scriptToBitAuthAsm(bytecode);
    const lineToAsmMap = buildLineToAsmMap(bytecode, sourceMap, instructionReplacements);
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
//# sourceMappingURL=bitauth-script.js.map