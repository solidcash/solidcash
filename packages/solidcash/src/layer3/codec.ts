// Layer-3 transcript codec (production). Encodes the transcript's positional participant args into the SCB1
// hidden-batch blob that the compiler route unlocker expects. For the unrolled per-shape covenant
// (./covenant.ts) the participant layout is `input_i = i, output_i = i` over the canonically-ordered
// participants; the invocation/resource specifics are baked into the covenant at generation time.
import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';

/** Maximum participants/invocations/resources a single generated covenant is built for (blob stays < 76 bytes). */
export const MAX_PARTICIPANTS = 8;

const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);

/** Positional participant args for `n` canonically-ordered participants: input_i = i, output_i = i. */
export function participantArgs(n: number): bigint[] {
  if (!Number.isInteger(n) || n < 2 || n > MAX_PARTICIPANTS) {
    throw new Error(`layer3: participant count ${n} out of range [2, ${MAX_PARTICIPANTS}]`);
  }
  const args: bigint[] = [];
  for (let i = 0; i < n; i += 1) args.push(BigInt(i), BigInt(i));
  return args;
}

/** Controller-bound args: the participant pairs followed by the controller input index. */
export function controllerParticipantArgs(n: number, controllerIdx: number): bigint[] {
  return [...participantArgs(n), BigInt(controllerIdx)];
}

/**
 * Wrap positional args in the SCB1 hidden-batch envelope for a handler selector, producing the exact bytes
 * the compiler route unlocker expects as its positional blob.
 */
export function encodeTranscriptBlob(handlerSelector: string, args: bigint[]): Uint8Array {
  const argsBlob = scriptToBytecode(args.map((v) => bigIntToVmNumber(v)));
  const row = concatBytes(hexToBin(handlerSelector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  // magic "SCB1" + [version=1, flags=0, invocationCount=1] + the single transcript row.
  return concatBytes(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);
}
