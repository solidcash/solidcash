/**
 * Building the proxy artifact a framed deployment runs behind: the source the proxy is built from, and the checks
 * that its record agrees with the implementation's.
 *
 * The proxy keeps the implementation's record: a call through the proxy is a `DELEGATE` frame of the
 * implementation's own code, so the record it reads and writes is the proxy's, and the commitment every write
 * rebuilds is built from the fields the *implementation's* source declares. A proxy that declares different
 * fields therefore loses whatever only it knows about the record on the first write, so instead of asking a caller
 * to write a proxy that agrees with the implementation, the proxy is generated from the implementation's own
 * published state layout: the same fields, in the same coordinates, and the struct definitions those fields name.
 *
 * The generated contract is the shape the convention compiles - a single `fallback` that forwards the call data it
 * received to the address it holds in its `implementation` field - and nothing else. This module holds everything
 * that does not compile: the source generator and the layout agreement check. `compileProxyArtifact` takes the
 * compiler as a parameter, because compiling is a Node-side concern: a browser bundle resolves
 * `generate.browser.js` (the package's `browser` field) and refuses instead.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  hasDataNftIndexTags, parseType, type Artifact, type ArtifactMap, type StateLayout, type StateVariableInfo,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import { FramedProxyDeployError } from './errors.js';

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

/**
 * True when some entry a caller can reach through the proxy records a return value.
 *
 * A constructor runs at the genesis and is never reached through the fallback, so it does not count; every other
 * entry with a declared output does, because the proxy's fallback is the one body that forwards all of them.
 */
function carriesDelegateReturn(implementationArtifact: Artifact): boolean {
  return implementationArtifact.abi.some((entry) =>
    entry.name !== '__construct' && (entry.outputs ?? []).length > 0);
}

/**
 * True when some entry a caller can reach through the proxy is payable.
 *
 * A delegate frame carries its caller's value (spec V5), so value reaches a payable entry only through a fallback
 * that takes it, as an EVM proxy's payable fallback forwards it; the entry's own body still refuses value it does
 * not take. A proxy with no payable entry behind it keeps a fallback that takes none, and its head no value checks.
 */
function takesDelegatedValue(implementationArtifact: Artifact): boolean {
  return implementationArtifact.abi.some((entry) =>
    entry.name !== '__construct' && (entry.modifiers ?? []).includes('payable'));
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
  throw new FramedProxyDeployError(
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
export function generateProxySource(implementationArtifact: Artifact, hopGuard?: Uint8Array): string {
  const layout = implementationArtifact.stateLayout;
  if (layout === undefined) {
    throw new FramedProxyDeployError(
      `cannot generate a proxy for "${implementationArtifact.contractName}": it is not a stateful contract, so it `
      + 'has no record a proxy could keep',
    );
  }

  // A frame's write rebuilds the record from the fields its own declaration names, and the delegate frame that
  // runs through the proxy is the implementation's, so the proxy has to declare the implementation's fields
  // exactly. The address the fallback forwards to is either one of them — an implementation that names its own
  // proxy — or a record of the proxy's own, past the implementation's, which no implementation frame rewrites.
  const declared = layout.variables.find((variable) => variable.name === IMPLEMENTATION_FIELD);
  if (declared !== undefined && declared.type !== 'address') {
    throw new FramedProxyDeployError(
      `cannot generate a proxy for "${implementationArtifact.contractName}": its "${IMPLEMENTATION_FIELD}" field `
      + `has type "${declared.type}", but a fallback forwards to an address`,
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
  if (declared === undefined) {
    // The implementation declares nothing about its proxy, so the address lives in a record the proxy keeps of its
    // own, past the implementation's: `external` is what registers a data NFT of its own, and no implementation
    // frame writes past its own declaration.
    lines.push(`  address external ${IMPLEMENTATION_FIELD};`);
  }
  // A fallback that publishes a return records the bytes its delegate frame recorded, so both the call record its
  // own frame keeps and the frame's `retval` carry what a caller naming the proxy reads. Declaring the return is
  // also what gives the proxy master a `returnEvent` block slot, and that slot is what puts the fallback body under
  // the compiler's own-category immutable-NFT pin. The pin admits the event outputs a *declared* event of the
  // fallback's own layout names; a delegated event output sits at the implementation entry's own block offset,
  // which the proxy cannot mirror, so once the pin is emitted the delegated event is refused and the hop cannot
  // settle. A proxy therefore publishes a return only when the implementation has a return to carry: for an
  // implementation whose entries all record nothing the fallback records nothing either, keeps no return slot, and
  // the pin is never emitted. The void form still binds the delegated result — the frame keeps a call record for it
  // — and consumes the binding with a size test so nothing is left unused.
  const takesValue = takesDelegatedValue(implementationArtifact) ? ' payable' : '';
  // A hop publishes the proxy's genesis uninitialized and runs `initialize` as a separate root call, so until that
  // hop confirms only the deployer's own lock may enter the proxy (audit SDKFRAMED-2). The implementation's
  // `initialized` field is the flag both the hop and the default genesis leave set, so the guard is emitted only
  // when that field exists and a hop guard lock was supplied.
  const hopGuardLine = hopGuard !== undefined
    && layout.variables.some((variable) => variable.name === 'initialized')
    ? `if (this.initialized == 0) require(msg.sender == address(hex"${binToHex(hopGuard)}"));`
    : '';
  lines.push(carriesDelegateReturn(implementationArtifact)
    ? `  fallback(bytes input) external${takesValue} returns (bytes) { ${hopGuardLine} (bool ok, bytes returned) = `
      + `this.${IMPLEMENTATION_FIELD}.delegatecall(input); require(ok); return returned; }`
    : `  fallback(bytes input) external${takesValue} { ${hopGuardLine} (bool ok, bytes returned) = `
      + `this.${IMPLEMENTATION_FIELD}.delegatecall(input); require(ok); require(returned.length >= 0); }`);
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
 * The agreement between an implementation's declaration and a proxy's, read field by field.
 *
 * A frame's write rebuilds a record from the fields its own declaration names, and the delegate frames that run
 * through a proxy are the implementation's, so the implementation's fields have to appear in the proxy at the same
 * coordinates. Past them a proxy may declare one record of its own: the address its fallback forwards to, alone in
 * a data NFT after the implementation's, which no implementation frame rewrites.
 */
export type LayoutAgreement =
  | { readonly ok: true; readonly ownAddressRecord: number | undefined }
  | { readonly ok: false; readonly reason: string };

/** The fields of a layout in coordinate order, which is the order a record is written in. */
function fieldsInCoordinateOrder(layout: StateLayout): readonly StateVariableInfo[] {
  return [...(layout.variables ?? [])]
    .sort((left, right) => left.nftIndex - right.nftIndex || left.fieldIndex - right.fieldIndex);
}

/** Reads the agreement between an implementation's declaration and a proxy's, or why they disagree. */
export function readLayoutAgreement(implementationArtifact: Artifact, proxyArtifact: Artifact): LayoutAgreement {
  const implementation = implementationArtifact.stateLayout;
  const proxy = proxyArtifact.stateLayout;
  if (implementation === undefined || proxy === undefined) {
    return { ok: false, reason: 'both the implementation and the proxy must be stateful contracts' };
  }
  const implementationFields = fieldsInCoordinateOrder(implementation).map(coordinate);
  const proxyFields = fieldsInCoordinateOrder(proxy);
  const mirrored = implementationFields.every((line, index) => proxyFields[index] !== undefined
    && coordinate(proxyFields[index]!) === line);
  if (!mirrored) {
    return {
      ok: false,
      reason: `the implementation "${implementationArtifact.contractName}" and the proxy `
        + `"${proxyArtifact.contractName}" must declare the same record fields, because the implementation's write `
        + 'rebuilds the record from its own declaration: the implementation declares '
        + `[${implementationFields.join(', ')}] and the proxy declares [${proxyFields.map(coordinate).join(', ')}]`,
    };
  }
  const own = proxyFields.slice(implementationFields.length);
  // Multi-record layouts and explicitly tagged singleton layouts lead commitments with their record index.
  // The writer is the implementation's own frame, and the reader is whoever holds the proxy's layout, so
  // the two have to agree on that leading field or the write lands on a commitment the proxy cannot place.
  if (hasDataNftIndexTags(implementation) !== hasDataNftIndexTags(proxy)) {
    return {
      ok: false,
      reason: `the implementation "${implementationArtifact.contractName}" declares `
        + `${implementation.dataNftCount} data NFT(s) and the proxy "${proxyArtifact.contractName}" declares `
        + `${proxy.dataNftCount}, so only one of them leads a commitment with the index it belongs to; a delegate `
        + 'frame writes the record through the implementation\'s own declaration, so both must use the same one',
    };
  }
  if (own.length === 0) {
    if (implementation.dataNftCount === proxy.dataNftCount) return { ok: true, ownAddressRecord: undefined };
    return {
      ok: false,
      reason: `the implementation "${implementationArtifact.contractName}" declares `
        + `${implementation.dataNftCount} data NFT(s) and the proxy "${proxyArtifact.contractName}" declares `
        + `${proxy.dataNftCount}; a delegate frame's write rebuilds the record from its own fields, so the two must `
        + 'declare the same records',
    };
  }
  const ownRecord = own[0]!;
  if (own.length > 1 || ownRecord.name !== IMPLEMENTATION_FIELD || ownRecord.type !== 'address'
    || ownRecord.nftIndex !== implementation.dataNftCount || ownRecord.fieldIndex !== 0
    || proxy.dataNftCount !== implementation.dataNftCount + 1) {
    return {
      ok: false,
      reason: `the proxy "${proxyArtifact.contractName}" may keep one record of its own beside the `
        + `implementation's — an "address ${IMPLEMENTATION_FIELD}" alone in the data NFT after them — and it `
        + `declares [${proxyFields.map(coordinate).join(', ')}]`,
    };
  }
  return { ok: true, ownAddressRecord: ownRecord.nftIndex };
}

/**
 * Checks the compiled proxy against the implementation's declaration field by field.
 *
 * The generated source is produced from the implementation's layout, so this normally holds by construction; the
 * check is a refusal, not a hope, so an option-dependent difference in how the compiler groups fields into records
 * surfaces as the field it concerns rather than as a deployment that cannot be called after its first write.
 */
function requireMirroredLayout(implementation: Artifact, generated: Artifact): void {
  if (generated.stateLayout === undefined) {
    throw new FramedProxyDeployError(
      `the generated proxy for "${implementation.contractName}" compiled to a non-stateful contract`,
    );
  }
  const agreement = readLayoutAgreement(implementation, generated);
  if (!agreement.ok) {
    throw new FramedProxyDeployError(
      `cannot generate a proxy for "${implementation.contractName}": ${agreement.reason}`,
    );
  }
}
/**
 * The compiler `compileProxyArtifact` needs: source text in, the artifacts it declares out. The Node build passes
 * `compileStringMulti`; a browser build passes nothing and refuses before reaching here.
 */
export type ProxySourceCompiler = (
  source: string,
  options: { composition: 'framed'; commitmentLimit: number; tagSingletonDataNfts?: boolean },
) => ArtifactMap;

/**
 * Compiles the proxy generated from an implementation's declaration and returns its artifact.
 *
 * The caller deploys this artifact in place of a hand-written proxy; it declares the implementation's record
 * fields, so `requireSharedLayout` holds by construction.
 */
export function compileProxyArtifact(
  implementationArtifact: Artifact, compile: ProxySourceCompiler, hopGuard?: Uint8Array,
): Artifact {
  const source = generateProxySource(implementationArtifact, hopGuard);
  const layout = implementationArtifact.stateLayout!;
  const artifacts = compile(source, {
    composition: 'framed',
    // The record geometry the implementation was compiled with, so the same fields land in the same data NFTs.
    commitmentLimit: layout.commitmentLimit,
    ...((layout.taggedDataNfts === true || implementationArtifact.compiler.options?.tagSingletonDataNfts === true)
      && { tagSingletonDataNfts: true }),
  });
  const generated = artifacts[proxyName(implementationArtifact)];
  if (generated === undefined) {
    throw new FramedProxyDeployError(
      `the generated proxy for "${implementationArtifact.contractName}" did not compile to a contract`,
    );
  }
  requireMirroredLayout(implementationArtifact, generated);
  return generated;
}
