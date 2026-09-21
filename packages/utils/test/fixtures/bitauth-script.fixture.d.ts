import { LineToAsmMap, LineToOpcodesMap } from '@solidcash/utils';
export interface Fixture {
    name: string;
    sourceCode: string;
    asmBytecode: string;
    sourceMap: string;
    expectedLineToOpcodeMap: LineToOpcodesMap;
    expectedLineToAsmMap: LineToAsmMap;
    expectedBitAuthScript: string;
}
export declare const fixtures: Fixture[];
