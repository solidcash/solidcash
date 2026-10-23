/**
 * The compiler version. Its own module because internal consumers (`artifact/Artifact.ts`,
 * `ast/AstBuilder.ts`) need it without loading the package barrel, whose Node-only entries (`compileFile`,
 * `compiler`) would otherwise join every bundle that reaches them.
 */
export const version = '0.14.0-beta.1';
