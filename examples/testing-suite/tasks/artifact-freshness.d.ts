/** Ignore only the intentionally volatile generation timestamp. */
export declare function normalizeGeneratedArtifact(contents: string): string;
/** Preserve identical generated content while refreshing its filesystem freshness. */
export declare function writeArtifactIfChanged(outputPath: string, generated: string): boolean;
