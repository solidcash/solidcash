/**
 * Building the proxy artifact a per-call deployment runs behind.
 *
 * The proxy keeps the implementation's record: a call through the proxy is a `DELEGATE` frame of the
 * implementation's own code, so the record it reads and writes is the proxy's, and the commitment every write
 * rebuilds is built from the fields the *implementation's* source declares. A proxy that declares different
 * fields therefore loses whatever only it knows about the record on the first write, so instead of asking a caller
 * to write a proxy that agrees with the implementation, the proxy is generated from the implementation's own
 * published state layout: the same fields, in the same coordinates, and the struct definitions those fields name.
 *
 * The generated contract is the shape the convention compiles — a single `fallback` that forwards the call data it
 * received to the address it holds in its `implementation` field — and nothing else. It is compiled with the
 * shipped per-call compiler at the implementation's record geometry, and the generated layout is checked against
 * the implementation's rather than assumed.
 */

import { compileStringMulti } from 'solidc';
import { parseType, type Artifact, type StateVariableInfo, type StructDefinitionInfo } from '@solidcash/utils';
import { PerCallProxyDeployError } from './errors.js';

/** The field the fallback forwards to; both the implementation and the generated proxy must declare it. */
const IMPLEMENTATION_FIELD = 'implementation';

/** The name a generated proxy is compiled under, derived from the implementation it forwards to. */
function proxyName(implementationArtifact: Artifact): string {
  return `${implementationArtifact.contractName}Proxy`;
}

/** The pragma of a generated source, pinned to the compiler's major/minor so any patch release accepts it. */
function pragmaFor(artifact: Artifact): string {
  const [major, minor] = artifact.compiler.version.split('.');
  return `pragma solidcash ^${major}.${minor}.0;`;
}

/** The base identifier of a possibly-array type: `Outer[2]` and `Outer` both name `Outer`. */
function baseTypeName(type: string): string {
  const bracket = type.indexOf('[');
  return (bracket === -1 ? type : type.slice(0, bracket)).trim();
}

/** A field's physical coordinate, the identity the record layout is compared on. */
function coordinate(field: StateVariableInfo): string {
  return `${field.name}: ${field.type} (data NFT ${field.nftIndex}, field ${field.fieldIndex})`;
}

/**
 * Refuses a field whose type the generated source cannot name.
 *
 * A field is expressible when its base is a primitive the language parses or a struct the layout publishes. The
 * refusal names the field so a caller learns which declaration cannot be mirrored rather than getting a proxy that
 * compiles into a different record.
 */
function requireExpressible(
  where: string, owner: string, type: string, structNames: ReadonlySet<string>,
): void {
  const base = baseTypeName(type);
  if (structNames.has(base) || parseType(base) !== undefined) return;
  throw new PerCallProxyDeployError(
    `cannot generate a proxy for "${owner}": ${where} has type "${type}", whose base "${base}" is neither a `
    + 'primitive type nor a struct the state layout publishes',
  );
}

/** The struct definitions a set of field types reaches, dependencies first, each field's type checked. */
function reachableStructs(
  variables: readonly StateVariableInfo[],
  layoutStructs: readonly StructDefinitionInfo[],
  implementationName: string,
): readonly StructDefinitionInfo[] {
  const byName = new Map(layoutStructs.map((definition) => [definition.name, definition]));
  const structNames = new Set(byName.keys());
  const ordered: StructDefinitionInfo[] = [];
  const seen = new Set<string>();

  const visit = (type: string, where: string): void => {
    requireExpressible(where, implementationName, type, structNames);
    const name = baseTypeName(type);
    const definition = byName.get(name);
    if (definition === undefined || seen.has(name)) return;
    seen.add(name);
    for (const field of definition.fields) visit(field.type, `struct "${name}" field "${field.name}"`);
    ordered.push(definition);
  };
  for (const variable of variables) visit(variable.type, `field "${variable.name}"`);
  return ordered;
}

/**
 * The generated proxy source: the implementation's fields in coordinate order, the struct definitions they
 * reference, and the fallback that forwards to the address the `implementation` field holds.
 */
export function generateProxySource(implementationArtifact: Artifact): string {
  const layout = implementationArtifact.stateLayout;
  if (layout === undefined) {
    throw new PerCallProxyDeployError(
      `cannot generate a proxy for "${implementationArtifact.contractName}": it is not a stateful contract, so it `
      + 'has no record a proxy could keep',
    );
  }

  // A frame's write rebuilds the record from the fields its own declaration names, and the delegate frame that
  // runs through the proxy is the implementation's, so the proxy has to declare the implementation's fields
  // exactly. The address the fallback forwards to must be one of them: a field the implementation did not declare
  // would be dropped by the implementation's own write.
  const field = layout.variables.find((variable) => variable.name === IMPLEMENTATION_FIELD);
  if (field === undefined) {
    throw new PerCallProxyDeployError(
      `cannot generate a proxy for "${implementationArtifact.contractName}": it declares no field named `
      + `"${IMPLEMENTATION_FIELD}", so there is no address in its record for a fallback to forward to and no field `
      + 'the proxy could declare without disagreeing with the implementation',
    );
  }
  if (field.type !== 'address') {
    throw new PerCallProxyDeployError(
      `cannot generate a proxy for "${implementationArtifact.contractName}": its "${IMPLEMENTATION_FIELD}" field `
      + `has type "${field.type}", but a fallback forwards to an address`,
    );
  }

  const variables = [...layout.variables]
    .sort((left, right) => left.nftIndex - right.nftIndex || left.fieldIndex - right.fieldIndex);
  const structs = reachableStructs(variables, layout.structs ?? [], implementationArtifact.contractName);

  const lines = [pragmaFor(implementationArtifact)];
  if (structs.length > 0) {
    lines.push('');
    for (const definition of structs) {
      const fields = definition.fields.map((structField) => `${structField.type} ${structField.name};`).join(' ');
      lines.push(`struct ${definition.name} { ${fields} }`);
    }
  }
  lines.push('');
  lines.push(`contract ${proxyName(implementationArtifact)} {`);
  const aloneInItsRecord = aloneFieldsOf(variables);
  for (const variable of variables) {
    // The record keeps the field's coordinates whatever its visibility. A field the implementation keeps alone in
    // a data NFT of its own is re-declared `external`, which is what gives it that record: a field packed beside
    // others is declared `public` so the same packing runs again. Without the distinction a field the compiler
    // registered as its own record — one it synthesizes, for instance — would be packed into the previous record
    // and the two layouts would disagree on every coordinate after it.
    const visibility = aloneInItsRecord.has(variable) ? 'external' : 'public';
    const modifiers = [variable.immutable === true ? 'immutable' : '', variable.packed === true ? 'packed' : '']
      .filter((modifier) => modifier !== '').join(' ');
    lines.push(`  ${variable.type} ${visibility} ${modifiers === '' ? '' : `${modifiers} `}${variable.name};`);
  }
  lines.push(
    `  fallback(bytes input) external { this.${IMPLEMENTATION_FIELD}.delegatecall(input); require(true); }`,
  );
  lines.push('}');
  return lines.join('\n');
}

/**
 * The fields that are alone in their data NFT, in the coordinate-ordered list.
 *
 * A published layout names each field's data NFT but not whether the compiler isolated it or merely started a new
 * record there, so the distinction is read from the coordinates: a record with one field is one the source has to
 * isolate again to reproduce.
 */
function aloneFieldsOf(variables: readonly StateVariableInfo[]): ReadonlySet<StateVariableInfo> {
  const counts = new Map<number, number>();
  for (const variable of variables) counts.set(variable.nftIndex, (counts.get(variable.nftIndex) ?? 0) + 1);
  return new Set(variables.filter((variable) => counts.get(variable.nftIndex) === 1));
}

/**
 * Checks the compiled proxy against the implementation's declaration field by field.
 *
 * The generated source is produced from the implementation's layout, so this normally holds by construction; the
 * check is a refusal, not a hope, so an option-dependent difference in how the compiler groups fields into records
 * surfaces as the field it concerns rather than as a deployment that cannot be called after its first write.
 */
function requireMirroredLayout(implementation: Artifact, generated: Artifact): void {
  const implementationLayout = implementation.stateLayout!;
  const generatedLayout = generated.stateLayout;
  if (generatedLayout === undefined) {
    throw new PerCallProxyDeployError(
      `the generated proxy for "${implementation.contractName}" compiled to a non-stateful contract`,
    );
  }
  if (implementationLayout.dataNftCount !== generatedLayout.dataNftCount) {
    throw new PerCallProxyDeployError(
      `cannot generate a proxy for "${implementation.contractName}": the generated proxy declares `
      + `${generatedLayout.dataNftCount} data NFT(s), not the implementation's `
      + `${implementationLayout.dataNftCount}`,
    );
  }
  const generatedFields = new Map(generatedLayout.variables.map((variable) => [variable.name, variable]));
  for (const variable of implementationLayout.variables) {
    const mirror = generatedFields.get(variable.name);
    if (mirror === undefined) {
      throw new PerCallProxyDeployError(
        `cannot generate a proxy for "${implementation.contractName}": the generated proxy does not declare field `
        + `"${variable.name}"`,
      );
    }
    if (mirror.type !== variable.type || mirror.nftIndex !== variable.nftIndex
      || mirror.fieldIndex !== variable.fieldIndex) {
      throw new PerCallProxyDeployError(
        `cannot generate a proxy for "${implementation.contractName}": field "${variable.name}" is `
        + `${coordinate(variable)} in the implementation and ${coordinate(mirror)} in the generated proxy`,
      );
    }
  }
}

/**
 * Compiles the proxy generated from an implementation's declaration and returns its artifact.
 *
 * The caller deploys this artifact in place of a hand-written proxy; it declares the implementation's record
 * fields, so `requireSharedLayout` holds by construction.
 */
export function buildProxyArtifact(implementationArtifact: Artifact): Artifact {
  const source = generateProxySource(implementationArtifact);
  const layout = implementationArtifact.stateLayout!;
  const artifacts = compileStringMulti(source, {
    composition: 'per-call',
    // The record geometry the implementation was compiled with, so the same fields land in the same data NFTs.
    commitmentLimit: layout.commitmentLimit,
  });
  const generated = artifacts[proxyName(implementationArtifact)];
  if (generated === undefined) {
    throw new PerCallProxyDeployError(
      `the generated proxy for "${implementationArtifact.contractName}" did not compile to a contract`,
    );
  }
  requireMirroredLayout(implementationArtifact, generated);
  return generated;
}
