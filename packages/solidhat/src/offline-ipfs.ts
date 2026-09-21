/**
 * In-memory stand-in for an IPFS upload service and its gateway.
 *
 * Applications that publish payloads to IPFS go through two HTTP endpoints: an upload service that answers with a
 * content identifier, and a gateway that serves the payload back. Both are external dependencies, so a suite that
 * needs them running passes only where the daemon happens to be up and returns whatever that daemon decides. This
 * module answers the same wire contract in process - `POST` a JSON `{ dataB64 }` body and receive `{ hash, cid }`,
 * then `GET <gateway>/ipfs/<id>` and receive the payload - so application code is exercised unmodified instead of
 * being patched with a local fallback.
 *
 * Content addressing is reproduced rather than stubbed: `hash` is the keccak-256 digest of the payload bytes and
 * `cid` is the CIDv0-style `0x12 0x20 || hash` base58 encoding. A payload keeps the identity the application
 * expects, and publish/read round trips work without a network.
 *
 * When `secret` is configured the service enforces it the way a production uploader does and answers `401 Invalid
 * upload secret`, which keeps the application's error path under test instead of masking it.
 */
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { OfflineService } from './offline-network.js';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Base58 (Bitcoin alphabet) encoding, the form CIDv0 identifiers use. */
export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits: number[] = [0];
  for (let index = zeros; index < bytes.length; index += 1) {
    let carry = bytes[index];
    for (let digit = 0; digit < digits.length; digit += 1) {
      carry += digits[digit] << 8;
      digits[digit] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let encoded = '1'.repeat(zeros);
  for (let index = digits.length - 1; index >= 0; index -= 1) encoded += BASE58_ALPHABET[digits[index]];
  return encoded;
}

/** CIDv0-shaped identifier for a 32-byte digest: `base58(0x12 0x20 || digest)`. */
export function cidFromHash(hash: string): string {
  const digest = hexToBytes(hash.startsWith('0x') ? hash.slice(2) : hash);
  if (digest.length !== 32) throw new Error(`cidFromHash expects a 32-byte hash, received ${digest.length} bytes`);
  return base58Encode(Uint8Array.from([0x12, 0x20, ...digest]));
}

/** `hash`/`cid` pair the upload service returns, plus the payload size for assertions. */
export interface InMemoryIpfsUpload {
  dataB64: string;
  hash: string;
  cid: string;
  bytes: number;
  /** Value of the `IPFS_UPLOAD_SERVICE_SECRET` header, or `''` when absent. */
  secret: string;
}

export interface InMemoryIpfsOptions {
  /** Upload endpoint (defaults to `$IPFS_UPLOAD_SERVICE_URL` or `http://localhost:8000`). */
  uploadUrl?: string;
  /** Gateway origin (defaults to `$IPFS_GATEWAY_URL` or `http://localhost:8080`). */
  gatewayUrl?: string;
  /** Required upload secret. When omitted, any secret (including none) is accepted. */
  secret?: string;
  /** Service name used in offline call records (default `ipfs`). */
  name?: string;
}

export interface InMemoryIpfs extends OfflineService {
  readonly uploadUrl: string;
  readonly gatewayUrl: string;
  /** Payloads keyed by both `hash` and `cid`, so a read works with either identifier. */
  readonly entries: Map<string, string>;
  readonly uploads: readonly InMemoryIpfsUpload[];
  readonly downloads: readonly string[];
  /** Number of distinct payloads held (each stored under two keys). */
  readonly payloadCount: number;
  reset(): void;
}

const decodeBase64 = (value: string): Uint8Array => Uint8Array.from(Buffer.from(value, 'base64'));

/**
 * Create the in-memory IPFS service. Pass it to `installOfflineNetwork` so the guard and the service agree on which
 * requests are legitimate.
 */
export function createInMemoryIpfs(options: InMemoryIpfsOptions = {}): InMemoryIpfs {
  const uploadUrl = options.uploadUrl ?? process.env.IPFS_UPLOAD_SERVICE_URL ?? 'http://localhost:8000';
  const gatewayUrl = options.gatewayUrl ?? process.env.IPFS_GATEWAY_URL ?? 'http://localhost:8080';
  const uploadTarget = new URL(uploadUrl);
  const gatewayTarget = new URL(gatewayUrl);
  const requiredSecret = options.secret ?? process.env.SOLIDCASH_MOCK_IPFS_SECRET;
  const entries = new Map<string, string>();
  const uploads: InMemoryIpfsUpload[] = [];
  const downloads: string[] = [];

  const isUpload = (url: URL, method: string): boolean => method === 'POST'
    && url.origin === uploadTarget.origin && url.pathname === uploadTarget.pathname;

  const gatewayKey = (url: URL): string | undefined => {
    if (url.origin !== gatewayTarget.origin) return undefined;
    const match = /^\/ipfs\/(.+)$/.exec(url.pathname);
    return match?.[1];
  };

  const handleUpload = async (request: Request): Promise<Response> => {
    const secret = request.headers.get('IPFS_UPLOAD_SERVICE_SECRET') ?? '';
    if (requiredSecret !== undefined && secret !== requiredSecret) {
      return new Response('Invalid upload secret', { status: 401 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }
    const dataB64 = (body as { dataB64?: unknown } | null)?.dataB64;
    if (typeof dataB64 !== 'string' || dataB64.length === 0) {
      return new Response('Missing dataB64', { status: 400 });
    }
    const bytes = decodeBase64(dataB64);
    // Prefix the digest: the application compares hashes against 0x-prefixed decoder output and feeds them to
    // `getBytes` on read-back, so a bare hex string would break the publish/read round trip.
    const hash = `0x${bytesToHex(keccak_256(bytes))}`;
    const cid = cidFromHash(hash);
    entries.set(hash, dataB64);
    entries.set(cid, dataB64);
    uploads.push({ dataB64, hash, cid, bytes: bytes.length, secret });
    return Response.json({ hash, cid });
  };

  const handleDownload = (key: string): Response => {
    const content = entries.get(key);
    if (content === undefined) return new Response(`not found: ${key}`, { status: 404 });
    downloads.push(key);
    return new Response(content, { status: 200 });
  };

  return {
    name: options.name ?? 'ipfs',
    uploadUrl,
    gatewayUrl,
    entries,
    uploads,
    downloads,
    get payloadCount(): number {
      return entries.size / 2;
    },
    matches: (url: URL, method: string): boolean => isUpload(url, method) || gatewayKey(url) !== undefined,
    handle: async (request: Request, url: URL): Promise<Response> => {
      if (isUpload(url, request.method)) return handleUpload(request);
      const key = gatewayKey(url);
      if (key !== undefined) return handleDownload(key);
      return new Response(`unsupported IPFS request: ${request.method} ${url.href}`, { status: 400 });
    },
    reset: (): void => {
      entries.clear();
      uploads.length = 0;
      downloads.length = 0;
    },
  };
}
