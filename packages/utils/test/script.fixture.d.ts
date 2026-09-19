import { Script } from '../src/index.js';
export interface Fixture {
    name: string;
    script: Script;
    asm: string;
    bytecode: Uint8Array;
    bytesize: number;
    opcount: number;
}
export declare const fixtures: Fixture[];
