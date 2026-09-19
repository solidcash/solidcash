interface DecodedSequence {
    blocks?: number;
    seconds?: number;
}
export declare function decodeBip68(sequence: number): DecodedSequence;
export declare function encodeBip68({ blocks, seconds }: DecodedSequence): number;
export {};
