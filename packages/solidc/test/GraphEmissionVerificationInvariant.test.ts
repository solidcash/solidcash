import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const traversalPath = resolve(dirname(fileURLToPath(import.meta.url)),
  '../src/generation/GenerateTargetTraversal.ts');
const traversalSource = readFileSync(traversalPath, 'utf8');
const compilerPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/compiler.ts');
const compilerSource = readFileSync(compilerPath, 'utf8');

type Disposition = 'verify-exact-vector' | 'consume-vector-prefix' | 'defer-whole-vector';

interface AuditResult {
  dispositions: Disposition[];
  errors: string[];
}

interface CursorAuditResult {
  errors: string[];
  reads: number;
  writes: number;
}

function methodText(sourceText: string, name: string): string {
  const source = ts.createSourceFile('source.ts', sourceText, ts.ScriptTarget.Latest, true);
  let body = '';
  const find = (node: ts.Node): void => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === name) {
      body = node.getText(source);
      return;
    }
    if (body === '') ts.forEachChild(node, find);
  };
  find(source);
  return body;
}

/** Source-level mutation auditor for the four graph emission producer classes. */
function audit(sourceText: string): AuditResult {
  const source = ts.createSourceFile('GenerateTargetTraversal.ts', sourceText, ts.ScriptTarget.Latest, true);
  const dispositions: Disposition[] = [];
  const errors: string[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'verifyGraphEmissionRow') {
      const verification = node.arguments[4];
      if (node.arguments.some((argument) => argument.kind === ts.SyntaxKind.FalseKeyword)) {
        errors.push(`line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: `
          + 'boolean emission verification convention reintroduced');
      }
      if (!verification || !ts.isObjectLiteralExpression(verification)) {
        errors.push(`line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: `
          + 'emission producer has no explicit verification policy');
      } else {
        const property = verification.properties.find((candidate): candidate is ts.PropertyAssignment =>
          ts.isPropertyAssignment(candidate) && candidate.name.getText(source) === 'disposition');
        if (!property || !ts.isStringLiteral(property.initializer)) {
          errors.push(`line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: `
            + 'emission producer has no literal disposition');
        } else {
          dispositions.push(property.initializer.text as Disposition);
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  if (dispositions.includes('defer-whole-vector')
    && !sourceText.includes('this.verifyDeferredGraphEmissionVector(loc);')) {
    errors.push('deferred emission rows have no whole-vector verifier');
  }
  return { dispositions, errors };
}

function removeOccurrence(sourceText: string, policy: string, occurrence: number): string {
  let seen = 0;
  return sourceText.replaceAll(policy, (match) => {
    seen += 1;
    return seen === occurrence ? 'parametersAreCallArguments: true' : match;
  });
}

/**
 * Source-level audit for the authenticated graph-emission cursor.
 *
 * The route-band implementation has one mutable cursor, so a consumer must not recover the named stack slot
 * directly: the paired accessors are the sole authority for choosing either the stable route-band coordinate or
 * the explicitly threaded non-route slot. Debug-only non-consuming row comparisons remain outside this audit.
 */
function auditCursorAccess(sourceText: string): CursorAuditResult {
  const source = ts.createSourceFile('GenerateTargetTraversal.ts', sourceText, ts.ScriptTarget.Latest, true);
  const errors: string[] = [];
  let reads = 0;
  let writes = 0;
  let currentMethod = '';

  const graphSlotAliases = new Map<string, Set<string>>();
  const collectAliases = (node: ts.Node, method = ''): void => {
    const enclosingMethod = ts.isMethodDeclaration(node) ? node.name.getText(source) : method;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
      && node.initializer !== undefined && ts.isStringLiteral(node.initializer)
      && node.initializer.text === '__internal__graphEmissions') {
      const aliases = graphSlotAliases.get(enclosingMethod) ?? new Set<string>();
      aliases.add(node.name.text);
      graphSlotAliases.set(enclosingMethod, aliases);
    }
    ts.forEachChild(node, (child) => collectAliases(child, enclosingMethod));
  };
  collectAliases(source);

  const referencesCursorCoordinate = (node: ts.Node | undefined, method: string): boolean => {
    if (node === undefined) return false;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(source) === 'this') {
      if (node.expression.name.text === 'graphEmissionStreamSlot') return true;
      if (node.expression.name.text === 'getStackIndex') {
        const argument = node.arguments[0];
        if (argument === undefined) return false;
        if (ts.isStringLiteral(argument) && argument.text === '__internal__graphEmissions') return true;
        if (ts.isIdentifier(argument) && graphSlotAliases.get(method)?.has(argument.text)) return true;
      }
    }
    return node.getChildren(source).some((child) => referencesCursorCoordinate(child, method));
  };

  const line = (node: ts.Node): number => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const walk = (node: ts.Node): void => {
    const previousMethod = currentMethod;
    if (ts.isMethodDeclaration(node)) currentMethod = node.name.getText(source);

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression.getText(source);
      const name = node.expression.name.text;
      const firstArgument = node.arguments[0]?.getText(source) ?? '';

      if (receiver === 'this' && name === 'emitGraphEmissionStreamRead') reads += 1;
      if (receiver === 'this' && name === 'emitReplaceGraphEmissionStream') writes += 1;

      if (receiver === 'this' && name === 'emitReplace'
        && currentMethod !== 'emitReplaceGraphEmissionStream'
        && referencesCursorCoordinate(node.arguments[0], currentMethod)) {
        errors.push(`line ${line(node)}: graph-emission cursor write bypasses its paired writer`);
      }

      if (receiver === 'this' && name === 'emit'
        && currentMethod !== 'emitGraphEmissionStreamRead'
        && referencesCursorCoordinate(node.arguments[0], currentMethod)) {
        errors.push(`line ${line(node)}: graph-emission cursor read bypasses its paired reader`);
      }

      if (receiver === 'this' && name === 'graphEmissionStreamSlot'
        && !['emitGraphEmissionStreamRead', 'emitReplaceGraphEmissionStream']
          .includes(currentMethod)) {
        errors.push(`line ${line(node)}: graph-emission cursor coordinate escaped its paired accessors`);
      }

      if (receiver === 'this' && name === 'declaredBandOrdinal'
        && firstArgument.includes('__internal__graphEmissions')
        && !['bandEmissionOrdinal', 'emitRowAgainstStreamAssert']
          .includes(currentMethod)) {
        errors.push(`line ${line(node)}: graph-emission route-band coordinate bypasses its paired accessors`);
      }
    }

    ts.forEachChild(node, walk);
    currentMethod = previousMethod;
  };
  walk(source);

  const methodBody = (name: string): string => {
    let body = '';
    const find = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node) && node.name.getText(source) === name) body = node.getText(source);
      if (body === '') ts.forEachChild(node, find);
    };
    find(source);
    return body;
  };
  const reader = methodBody('emitGraphEmissionStreamRead');
  const writer = methodBody('emitReplaceGraphEmissionStream');
  for (const [label, body] of [['reader', reader], ['writer', writer]] as const) {
    if (!body.includes('this.graphEmissionStreamSlot()')) {
      errors.push(`graph-emission cursor ${label} does not use the tracked frame coordinate`);
    }
  }

  return { errors, reads, writes };
}

describe('X206 graph emission verification ownership', () => {
  it('assigns every producer class an explicit verifier and discharges the sole deferred class', () => {
    const result = audit(traversalSource);
    expect(result.errors).toEqual([]);
    expect(result.dispositions.sort()).toEqual([
      'consume-vector-prefix',
      'consume-vector-prefix',
      'consume-vector-prefix',
      'defer-whole-vector',
      'verify-exact-vector',
    ]);
  });

  it.each([
    ['single returning exact-vector producer', "disposition: 'verify-exact-vector'", 1],
    ['single void prefix producer', "disposition: 'consume-vector-prefix'", 1],
    ['multi-row prefix producer', "disposition: 'consume-vector-prefix'", 2],
    ['runtime occurrence prefix producer', "disposition: 'consume-vector-prefix'", 3],
    ['straight runtime deferred producer', "disposition: 'defer-whole-vector'", 1],
  ])('rejects a mutation that removes the %s policy', (_label, policy, occurrence) => {
    const mutated = removeOccurrence(traversalSource, policy, occurrence);
    expect(mutated).not.toBe(traversalSource);
    expect(audit(mutated).errors).toContainEqual(expect.stringContaining('no literal disposition'));
  });

  it('rejects a mutation that drops the whole-vector comparison for deferred rows', () => {
    const mutated = traversalSource.replace('this.verifyDeferredGraphEmissionVector(loc);',
      '/* mutation: verifier omitted */');
    expect(mutated).not.toBe(traversalSource);
    expect(audit(mutated).errors).toContain('deferred emission rows have no whole-vector verifier');
  });
});

describe('graph emission cursor ownership', () => {
  it('uses the finalized route band for dynamic and fixed-state emission cursors', () => {
    const selector = methodText(traversalSource, 'bandEmissionOrdinal');
    expect(selector).toContain(
      "return this.declaredBandOrdinal('__internal__graphEmissions');",
    );
    expect(selector).not.toContain('__internal__dynamicChunkInputBase');
    expect(compilerSource).toContain(
      'candidate.messageBusCallerBandNames = finalizedBandNames;',
    );
  });

  it('routes every cursor read and write through accessors with the same coordinate policy', () => {
    const result = auditCursorAccess(traversalSource);
    expect(result.errors).toEqual([]);
    expect(result.reads).toBeGreaterThan(1);
    expect(result.writes).toBeGreaterThan(1);
  });

  it('addresses a DEFINE handler cursor relative to the tracked frame top', () => {
    const reader = methodText(traversalSource, 'emitGraphEmissionStreamRead');
    const writer = methodText(traversalSource, 'emitReplaceGraphEmissionStream');
    expect(reader).toContain('this.graphEmissionStreamSlot()');
    expect(reader).not.toContain('this.emit(Op.OP_DEPTH, locationData)');
    expect(writer).toContain('this.emitReplace(this.graphEmissionStreamSlot(), node)');
    expect(writer).not.toContain('this.emitReplaceAtBottomOrdinal');
  });

  it('rejects a direct named-slot read at a graph emission consumer', () => {
    const mutated = traversalSource.replace(
      'this.emitGraphEmissionStreamRead(locationData);\n      this.pushToStack(\'(__graph_expected_emissions)\');',
      'this.emit(encodeInt(BigInt(this.getStackIndex(\'__internal__graphEmissions\'))), locationData);\n'
        + '      this.pushToStack(\'(__graph_expected_emissions)\');',
    );
    expect(mutated).not.toBe(traversalSource);
    expect(auditCursorAccess(mutated).errors).toContainEqual(
      expect.stringContaining('cursor read bypasses its paired reader'),
    );
  });

  it('rejects a direct named-slot write at a graph emission consumer', () => {
    const mutated = traversalSource.replace(
      'this.emitReplaceGraphEmissionStream(node);',
      "this.emitReplace(this.getStackIndex('__internal__graphEmissions'), node);",
    );
    expect(mutated).not.toBe(traversalSource);
    expect(auditCursorAccess(mutated).errors).toContainEqual(
      expect.stringContaining('cursor write bypasses its paired writer'),
    );
  });

  it.each([
    ['reader', 'private emitGraphEmissionStreamRead(locationData: SingleLocationData): void {'],
    ['writer', 'private emitReplaceGraphEmissionStream(node: Node): void {'],
  ])('rejects a $accessor that stops using the tracked frame coordinate', (accessor, signature) => {
    const method = methodText(traversalSource, signature.slice('private '.length, signature.indexOf('(')));
    const mutatedMethod = method.replace('this.graphEmissionStreamSlot()', '0');
    expect(mutatedMethod).not.toBe(method);
    const mutated = traversalSource.replace(method, mutatedMethod);
    expect(auditCursorAccess(mutated).errors).toContain(
      `graph-emission cursor ${accessor} does not use the tracked frame coordinate`,
    );
  });

  it('checks final exhaustion through the authoritative cursor while generated source only retains liveness', () => {
    const source = ts.createSourceFile(
      'GenerateTargetTraversal.ts', traversalSource, ts.ScriptTarget.Latest, true,
    );
    let visitFunctionDefinition = '';
    const find = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'visitFunctionDefinition') {
        visitFunctionDefinition = node.getText(source);
        return;
      }
      ts.forEachChild(node, find);
    };
    find(source);

    expect(visitFunctionDefinition).toContain("this.stack.includes('__internal__graphEmissions')");
    expect(visitFunctionDefinition).toContain('this.emitGraphEmissionStreamRead(loc);');
    expect(visitFunctionDefinition).toContain('this.emit(Op.OP_SIZE, loc);');
    expect(visitFunctionDefinition).toContain('this.emit(Op.OP_EQUALVERIFY, loc);');
    expect(compilerSource).toContain(
      'require(__internal__graphEmissions == __internal__graphEmissions);',
    );
    expect(compilerSource).not.toContain(
      'require(__internal__graphEmissions.length == 0);',
    );
  });
});
