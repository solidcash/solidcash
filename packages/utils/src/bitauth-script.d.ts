import { Script } from './script.js';
export type LineToOpcodesMap = Record<string, Script>;
export type LineToAsmMap = Record<string, string>;
export declare function buildLineToOpcodesMap(bytecode: Script, sourceMap: string): LineToOpcodesMap;
export declare function buildLineToAsmMap(bytecode: Script, sourceMap: string, instructionReplacements?: ReadonlyMap<number, string>): LineToAsmMap;
export declare function formatBitAuthScript(bytecode: Script, sourceMap: string, sourceCode: string, instructionReplacements?: ReadonlyMap<number, string>): string;
