import { Op, Script } from './script.js';
export declare function computeBytecodePattern(bytecode: Uint8Array): Uint8Array;
export declare function computeBytecodeFingerprint(bytecode: Uint8Array): string;
export declare function computeBytecodeFingerprintWithConstructorArgs(bytecodeScript: Script, constructorArgsCount: number): string;
export declare function isPushOpcode(opcode: Op): boolean;
