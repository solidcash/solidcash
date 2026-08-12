import { extractNetworkOption } from '../src/cli-options.js';

describe('SolidHat task network selection', () => {
  it('accepts Hardhat-style network selection before or after the task', () => {
    expect(extractNetworkOption(['--network', 'regtest', 'deploy']))
      .toEqual({ network: 'regtest', rest: ['deploy'] });
    expect(extractNetworkOption(['run', 'scripts/deploy.ts', '--network=chipnet']))
      .toEqual({ network: 'chipnet', rest: ['run', 'scripts/deploy.ts'] });
  });

  it('refuses an empty network option', () => {
    expect(() => extractNetworkOption(['deploy', '--network'])).toThrow('--network requires');
    expect(() => extractNetworkOption(['deploy', '--network='])).toThrow('--network requires');
  });
});
