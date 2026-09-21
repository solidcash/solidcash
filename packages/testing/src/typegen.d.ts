export type TypegenTarget = 'ethers5' | 'ethers6';
export interface TypegenTargetConfig {
    target: TypegenTarget;
    layout?: 'typechain';
    outDir: string;
    sourceDir?: string;
}
export interface GenerateTypechainOptions {
    artifactsDir: string;
    contractsDir: string;
    cacheDir: string;
    targets: readonly TypegenTargetConfig[];
}
export interface TypegenResult {
    target: TypegenTarget;
    outDir: string;
    files: number;
    skipped: boolean;
}
export interface TypegenWatcher {
    close(): void;
}
export declare function generateTypechainTargets(options: GenerateTypechainOptions): TypegenResult[];
/** Regenerate bindings after artifact/source changes, debounced for multi-file compiler writes. */
export declare function watchTypechainTargets(options: GenerateTypechainOptions, onGenerate?: (results: TypegenResult[]) => void): TypegenWatcher;
