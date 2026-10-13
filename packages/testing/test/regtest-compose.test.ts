import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const composePath = join(dirname(fileURLToPath(import.meta.url)), '../../../docker-compose.regtest.yml');

describe('regtest compose', () => {
  it('TOOLS-2 regtest RPC, Electrum, and Fulcrum stay on loopback with a pinned image', () => {
    const text = readFileSync(composePath, 'utf8');
    expect(text).not.toContain('rpcallowip=0.0.0.0/0');
    expect(text).not.toContain('rpcbind=127.0.0.1');
    expect(text).not.toContain('fulcrum:latest');
    expect(text).not.toContain('BTCEXP_RPC_ALLOWALL');
    expect(text).not.toContain('BTCEXP_UI_SHOW_RPC');
    expect(text).toContain(
      'cculianu/fulcrum:v2.1.3@sha256:a69813b71a36dc112343d3158a2a651362e17663c8251868931b8537b4b5a980',
    );
    expect(text).toContain('"127.0.0.1:18443:18443"');
    expect(text).toContain('"127.0.0.1:50001:50001"');
    expect(text).toContain('"127.0.0.1:50003:50003"');
    expect(text).toContain('rpcbind=0.0.0.0');
    expect(text).toContain('-t 0.0.0.0:50001');
    expect(text).toContain('-w 0.0.0.0:50003');
    expect(text).toContain('rpcallowip=10.0.0.0/8');
    expect(text).toContain('rpcallowip=172.16.0.0/12');
    expect(text).toContain('rpcallowip=192.168.0.0/16');
  });
});
