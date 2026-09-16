import { installOfflineNetwork, type OfflineService } from '../src/offline-network.js';

const jsonService = (name: string, origin: string): OfflineService => ({
  name,
  matches: (url) => url.origin === origin,
  handle: async () => Response.json({ ok: true, service: name }),
});

describe('installOfflineNetwork', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('routes matching requests to the registered service', async () => {
    const handle = installOfflineNetwork({ services: [jsonService('shop', 'http://localhost:9000')] });
    const response = await fetch('http://localhost:9000/anything', { method: 'POST', body: '{}' });

    expect(await response.json()).toEqual({ ok: true, service: 'shop' });
    expect(handle.handled).toHaveLength(1);
    expect(handle.handled[0]).toMatchObject({ method: 'POST', service: 'shop', handled: true, escaped: false });
    expect(handle.violations).toHaveLength(0);
    handle.restore();
  });

  it('fails an unclaimed request instead of letting it reach the real network', async () => {
    const handle = installOfflineNetwork({ services: [] });
    await expect(fetch('https://api.example.com/v1/price')).rejects.toThrow(
      '[solidhat-offline] blocked real network request GET https://api.example.com/v1/price',
    );
    expect(handle.violations).toHaveLength(1);
    expect(handle.violations[0].url).toBe('https://api.example.com/v1/price');
    handle.restore();
  });

  it('records violations instead of throwing in record mode', async () => {
    const handle = installOfflineNetwork({ services: [], onUnexpected: 'record' });
    const response = await fetch('http://127.0.0.1:1/nothing');
    expect(response.status).toBe(599);
    expect(handle.violations).toHaveLength(1);
    handle.restore();
  });

  it('passes allow-listed requests through to the previous fetch', async () => {
    let forwarded: string | undefined;
    const passthrough = (async (input: RequestInfo | URL) => {
      forwarded = String(input);
      return new Response('real', { status: 200 });
    }) as typeof globalThis.fetch;
    globalThis.fetch = passthrough;

    const handle = installOfflineNetwork({
      // A string rule allows the exact URL and anything it prefixes; a regex is tested as-is.
      services: [],
      allow: ['https://allowed.example.com/', /^https:\/\/regex\.example\.com\//],
    });
    expect(await (await fetch('https://allowed.example.com/data')).text()).toBe('real');
    expect(await (await fetch('https://regex.example.com/data')).text()).toBe('real');
    expect(forwarded).toBe('https://regex.example.com/data');
    expect(handle.violations).toHaveLength(0);
    expect(handle.calls).toHaveLength(2);
    handle.restore();
    expect(globalThis.fetch).toBe(passthrough);
  });

  it('dispatches on a Request object and preserves the method', async () => {
    const seen: string[] = [];
    const service: OfflineService = {
      name: 'echo',
      matches: () => true,
      handle: async (request) => {
        seen.push(request.method);
        return new Response('ok');
      },
    };
    const handle = installOfflineNetwork({ services: [service] });
    await fetch(new Request('http://localhost:8000/', { method: 'PUT' }));
    expect(seen).toEqual(['PUT']);
    handle.restore();
  });

  it('stops intercepting once restored', async () => {
    const handle = installOfflineNetwork({ services: [] });
    handle.restore();
    expect(globalThis.fetch).toBe(realFetch);
  });
});
