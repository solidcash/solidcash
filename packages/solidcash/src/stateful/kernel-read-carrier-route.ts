/**
 * phase-boundary extract: kernel read-carrier route authentication + capability selection
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex, binsAreEqual } from '@bitauth/libauth/build/lib/format/hex.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import {
  sha256 as sha256Sync,
  type AbiFunction,
  type Artifact,
} from '@solidcash/utils';
import { encodeMessageBusArguments } from '../message-bus/message-bus.js';
import { encodeFunctionArgument } from '../Argument.js';
import {
  kernelEntryJournalReadCarrierCapabilityFromArtifact,
  kernelJournalDispositionsFromArtifact,
  type KernelEntryJournalReadCarrierCapability,
} from './KernelEntryJournal.js';
import {
  visibleHandlerInputs,
  type RouteExpressionKeyRow,
} from './route-expression-key.js';

// Object-identity authority for a local message-bus route built from a canonically parsed batch blob. Artifact ABI
// metadata is public and cloneable, so neither a boolean field nor `messageBusRowArguments` can grant this role.
// The exact effective route object survives `_createBuilder`; spreads and caller substitutions intentionally do not.
interface AuthenticatedKernelReadCarrierRouteSnapshot {
  artifact: Artifact;
  blob: Uint8Array;
  selectors: readonly string[];
  encodedArguments: readonly Uint8Array[];
  journalAuthorityFingerprint: string;
}

const authenticatedKernelReadCarrierRoutes = new WeakMap<object, AuthenticatedKernelReadCarrierRouteSnapshot>();
// Runtime-selected dynamic metadata is overlaid on an artifact ABI handler. Keep its source identity out of
// caller-editable route metadata so authentication can distinguish that SDK-created overlay from a forged row.
const kernelCarrierHandlerSources = new WeakMap<AbiFunction, AbiFunction>();

export function bindKernelCarrierHandlerOverlay(overlay: AbiFunction, source: AbiFunction): void {
  if (overlay !== source) kernelCarrierHandlerSources.set(overlay, source);
}

/**
 * Bind physical journal ownership metadata to the authenticated route snapshot. Artifact JSON is not an
 * independent trust root: capability publication remains compiler-owned, and this fingerprint only prevents
 * substitution or in-place mutation after canonical route lineage has been established.
 */
export function kernelJournalAuthorityFingerprint(artifact: Artifact): string {
  const capability = kernelEntryJournalReadCarrierCapabilityFromArtifact(artifact);
  const dispositions = capability ? kernelJournalDispositionsFromArtifact(artifact) : undefined;
  return binToHex(sha256Sync(utf8ToBin(JSON.stringify({
    capability: capability ?? null,
    kernelJournalDispositions: dispositions ?? null,
  }))));
}

export function canonicalKernelCarrierEnvelopeRows(
  artifact: Artifact,
  blob: Uint8Array,
  rows: readonly RouteExpressionKeyRow[],
): { selectors: string[]; encodedArguments: Uint8Array[] } {
  const capability = artifact.messageBus;
  if (!capability || blob.length < 7 || binToHex(blob.slice(0, 4)) !== '53434231') {
    throw new Error('Compiler internal-read-carrier authority requires a canonical message-bus envelope.');
  }
  const modeVersion = blob[4];
  const valueFlag = blob[5];
  const rowCount = blob[6];
  const valueMode = capability.handlers.some((handler) => handler.eligible && handler.usesMsgValue);
  if ((modeVersion !== 1 && modeVersion !== 2) || valueFlag !== (valueMode ? 1 : 0)
    || rowCount !== rows.length || rowCount < (capability.minimumRows ?? 1)
    || rowCount > capability.maximumRows || blob.length > capability.maximumBlobBytes) {
    throw new Error('Compiler internal-read-carrier authority requires canonical batch framing.');
  }
  const selectors: string[] = [];
  const encodedArguments: Uint8Array[] = [];
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  let cursor = 7;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const headerLength = 12 + (modeVersion === 2 ? 1 : 0) + (valueMode ? 9 : 0);
    if (cursor + headerLength > blob.length) {
      throw new Error('Compiler internal-read-carrier envelope ends inside a row header.');
    }
    const selector = binToHex(blob.slice(cursor, cursor + 4));
    const encodedRowIndex = blob[cursor + 4]
      | (blob[cursor + 5] << 8)
      | (blob[cursor + 6] << 16)
      | (blob[cursor + 7] << 24);
    if (encodedRowIndex !== rowIndex || blob[cursor + 8] !== 0 || blob[cursor + 9] !== 0
      || (modeVersion === 2 && blob[cursor + 12] !== 0 && blob[cursor + 12] !== 1)) {
      throw new Error('Compiler internal-read-carrier envelope has non-canonical row framing.');
    }
    const argsLength = blob[cursor + 10] | (blob[cursor + 11] << 8);
    const argsStart = cursor + headerLength;
    const argsEnd = argsStart + argsLength;
    if (argsEnd > blob.length) {
      throw new Error('Compiler internal-read-carrier envelope ends inside an argument vector.');
    }
    const handler = artifact.abi.find((candidate) => candidate.selector?.toLowerCase() === selector);
    const published = capability.handlers.find((candidate) => candidate.selector.toLowerCase() === selector);
    const row = rows[rowIndex];
    if (!handler || !published?.eligible
      || (row.handler !== handler && kernelCarrierHandlerSources.get(row.handler) !== handler)
      || row.handler.selector?.toLowerCase() !== selector) {
      throw new Error('Compiler internal-read-carrier envelope has no exact compiler-authored row metadata.');
    }
    const inputs = visibleHandlerInputs(handler.inputs);
    if (row.args.length !== inputs.length) {
      throw new Error('Compiler internal-read-carrier row arguments do not match the canonical handler ABI.');
    }
    const encoded = row.args.map((argument, index) =>
      encodeFunctionArgument(argument, inputs[index].type, structs));
    if (encoded.some((argument) => !(argument instanceof Uint8Array))) {
      throw new Error('Compiler internal-read-carrier row contains a non-canonical signature argument.');
    }
    const canonicalArguments = encodeMessageBusArguments(
      encoded as Uint8Array[], inputs.map((input) => input.type), structs,
    );
    if (!binsAreEqual(canonicalArguments, blob.slice(argsStart, argsEnd))) {
      throw new Error('Compiler internal-read-carrier row arguments disagree with the authenticated envelope.');
    }
    selectors.push(selector);
    encodedArguments.push(Uint8Array.from(canonicalArguments));
    cursor = argsEnd;
  }
  if (cursor !== blob.length) {
    throw new Error('Compiler internal-read-carrier envelope has an unauthenticated trailing suffix.');
  }
  return { selectors, encodedArguments };
}

export function authenticateKernelReadCarrierRoute(
  route: object,
  artifact: Artifact,
  blob: Uint8Array,
  rows: readonly RouteExpressionKeyRow[],
): void {
  const canonical = canonicalKernelCarrierEnvelopeRows(artifact, blob, rows);
  authenticatedKernelReadCarrierRoutes.set(route, Object.freeze({
    artifact,
    blob: Uint8Array.from(blob),
    selectors: Object.freeze([...canonical.selectors]),
    encodedArguments: Object.freeze(canonical.encodedArguments.map((value) => Uint8Array.from(value))),
    journalAuthorityFingerprint: kernelJournalAuthorityFingerprint(artifact),
  }));
}

export function kernelReadCarrierRouteIsCurrent(
  route: object,
  artifact: Artifact,
  blob: Uint8Array | undefined,
  rows: readonly RouteExpressionKeyRow[],
): boolean {
  const snapshot = authenticatedKernelReadCarrierRoutes.get(route);
  if (!snapshot) return false;
  if (snapshot.artifact !== artifact || !blob || !binsAreEqual(snapshot.blob, blob)) {
    throw new Error('Compiler internal-read-carrier route no longer matches its authenticated blob snapshot.');
  }
  if (kernelJournalAuthorityFingerprint(artifact) !== snapshot.journalAuthorityFingerprint) {
    throw new Error('Compiler internal-read-carrier authority changed after route authentication.');
  }
  const current = canonicalKernelCarrierEnvelopeRows(artifact, blob, rows);
  if (current.selectors.length !== snapshot.selectors.length
    || current.selectors.some((selector, index) => selector !== snapshot.selectors[index])
    || current.encodedArguments.some((argument, index) =>
      !binsAreEqual(argument, snapshot.encodedArguments[index]))) {
    throw new Error('Compiler internal-read-carrier route no longer matches its authenticated row snapshot.');
  }
  return true;
}

export function kernelReadCarrierCapabilityForSelectedRoute(
  capability: KernelEntryJournalReadCarrierCapability | undefined,
  compilerRoute: object | undefined,
  selectedRows: readonly RouteExpressionKeyRow[],
  localRoute?: object,
  artifact?: Artifact,
  blob?: Uint8Array,
): KernelEntryJournalReadCarrierCapability | undefined {
  if (!artifact || !blob) return undefined;
  const publishedCapability = kernelEntryJournalReadCarrierCapabilityFromArtifact(artifact);
  if (JSON.stringify(capability ?? null) !== JSON.stringify(publishedCapability ?? null)) {
    throw new Error('Compiler internal-read-carrier capability differs from the authenticated artifact.');
  }
  const authenticatedRoute = compilerRoute !== undefined
    ? kernelReadCarrierRouteIsCurrent(compilerRoute, artifact, blob, selectedRows)
    : localRoute !== undefined
      && kernelReadCarrierRouteIsCurrent(localRoute, artifact, blob, selectedRows);
  return authenticatedRoute && selectedRows.length > 0 ? capability : undefined;
}
