import { base58Encode, cidFromHash, createInMemoryIpfs } from '../src/offline-ipfs.js';

const postUpload = (ipfs: ReturnType<typeof createInMemoryIpfs>, body: unknown, secret?: string): Promise<Response> =>
  ipfs.handle(new Request(ipfs.uploadUrl, {
    method: 'POST',
    headers: secret === undefined ? {} : { IPFS_UPLOAD_SERVICE_SECRET: secret },
    body: JSON.stringify(body),
  }), new URL(ipfs.uploadUrl));

describe('base58 / CID helpers', () => {
  it('matches the application CIDv0 encoding for a known digest', () => {
    // Vector for the CIDv0 encoding of a 32-byte digest: version 0x12, sha2-256 codec 0x20, base58 payload.
    expect(cidFromHash('0x31479ede5414b18e9205f0ab03b8cfac02f4c449ae9a993fc91c9b88c84efbcc'))
      .toBe('QmRf22bZar3WKmojipms22PkXH1MZGmvsqzQtuSvQE3uhm');
  });

  it('preserves leading zero bytes as leading "1" characters', () => {
    expect(base58Encode(Uint8Array.from([0, 0, 1]))).toBe('112');
  });

  it('rejects digests that are not 32 bytes', () => {
    expect(() => cidFromHash('0x1234')).toThrow('32-byte hash');
  });
});

describe('createInMemoryIpfs', () => {
  it('answers the upload contract with a content-addressed hash and cid', async () => {
    const ipfs = createInMemoryIpfs();
    const payload = Buffer.from('published payload').toString('base64');
    const response = await postUpload(ipfs, { dataB64: payload });

    expect(response.status).toBe(200);
    const body = await response.json() as { hash: string; cid: string };
    // 0x-prefixed: the application compares this against decoder output and feeds it to `getBytes` on read-back.
    expect(body.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(body.cid).toMatch(/^Qm/);
    expect(body.cid).toBe(cidFromHash(body.hash));
    expect(ipfs.payloadCount).toBe(1);
  });

  it('is deterministic: the same payload always maps to the same identifiers', async () => {
    const first = createInMemoryIpfs();
    const second = createInMemoryIpfs();
    const payload = Buffer.from('same bytes').toString('base64');
    const a = await (await postUpload(first, { dataB64: payload })).json() as { hash: string; cid: string };
    const b = await (await postUpload(second, { dataB64: payload })).json() as { hash: string; cid: string };
    expect(a).toEqual(b);
  });

  it('round-trips through the gateway by cid and by hash', async () => {
    const ipfs = createInMemoryIpfs();
    const payload = Buffer.from('round trip').toString('base64');
    const { hash, cid } = await (await postUpload(ipfs, { dataB64: payload })).json() as { hash: string; cid: string };

    for (const key of [cid, hash]) {
      const response = await ipfs.handle(
        new Request(`${ipfs.gatewayUrl}/ipfs/${key}`),
        new URL(`${ipfs.gatewayUrl}/ipfs/${key}`),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(payload);
    }
    expect(ipfs.downloads).toEqual([cid, hash]);
  });

  it('returns 404 for unknown content', async () => {
    const ipfs = createInMemoryIpfs();
    const url = new URL(`${ipfs.gatewayUrl}/ipfs/QmUnknown`);
    expect((await ipfs.handle(new Request(url), url)).status).toBe(404);
  });

  it('accepts any secret when none is configured', async () => {
    const ipfs = createInMemoryIpfs();
    const response = await postUpload(ipfs, { dataB64: Buffer.from('x').toString('base64') }, '');
    expect(response.status).toBe(200);
    expect(ipfs.uploads[0].secret).toBe('');
  });

  it('enforces a configured secret with the production error body', async () => {
    const ipfs = createInMemoryIpfs({ secret: 'expected' });
    const body = { dataB64: Buffer.from('x').toString('base64') };

    const rejected = await postUpload(ipfs, body, '');
    expect(rejected.status).toBe(401);
    expect(await rejected.text()).toBe('Invalid upload secret');
    expect(ipfs.payloadCount).toBe(0);

    expect((await postUpload(ipfs, body, 'expected')).status).toBe(200);
  });

  it('rejects malformed bodies without storing anything', async () => {
    const ipfs = createInMemoryIpfs();
    expect((await postUpload(ipfs, { dataB64: '' })).status).toBe(400);
    expect((await ipfs.handle(new Request(ipfs.uploadUrl, { method: 'POST', body: 'not json' }), new URL(ipfs.uploadUrl))).status)
      .toBe(400);
    expect(ipfs.payloadCount).toBe(0);
  });

  it('only claims its own endpoints', () => {
    const ipfs = createInMemoryIpfs();
    expect(ipfs.matches(new URL(ipfs.uploadUrl), 'POST')).toBe(true);
    expect(ipfs.matches(new URL(ipfs.uploadUrl), 'GET')).toBe(false);
    expect(ipfs.matches(new URL(`${ipfs.gatewayUrl}/ipfs/QmX`), 'GET')).toBe(true);
    expect(ipfs.matches(new URL('https://example.com/ipfs/QmX'), 'GET')).toBe(false);
  });

  it('resets its store between suites', async () => {
    const ipfs = createInMemoryIpfs();
    await postUpload(ipfs, { dataB64: Buffer.from('x').toString('base64') });
    ipfs.reset();
    expect(ipfs.payloadCount).toBe(0);
    expect(ipfs.uploads).toHaveLength(0);
    expect(ipfs.downloads).toHaveLength(0);
  });
});
