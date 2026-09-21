import fs from 'fs';
/** Ignore only the intentionally volatile generation timestamp. */
export function normalizeGeneratedArtifact(contents) {
    return contents
        .replace(/^(  "updatedAt"\s*:\s*)"[^"]*"/gm, '$1"<generated>"')
        .replace(/^(  updatedAt\s*:\s*)'[^']*'/gm, "$1'<generated>'")
        .replace(/\r?\n$/, '');
}
/** Preserve identical generated content while refreshing its filesystem freshness. */
export function writeArtifactIfChanged(outputPath, generated) {
    if (fs.existsSync(outputPath)) {
        const existing = fs.readFileSync(outputPath, 'utf8');
        if (normalizeGeneratedArtifact(existing) === normalizeGeneratedArtifact(generated)) {
            const now = new Date();
            fs.utimesSync(outputPath, now, now);
            return false;
        }
    }
    fs.writeFileSync(outputPath, generated);
    return true;
}
//# sourceMappingURL=artifact-freshness.js.map