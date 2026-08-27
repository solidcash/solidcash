import { generateSourceMap, sourceMapToLocationData } from '../src/index.js';
import { fixtures } from './fixtures/source-map.fixture.js';

describe('Source map generation', () => {
  it('skips encoding when disabled', () => {
    expect(generateSourceMap(fixtures[0].locationData, false)).toBe('');
  });

  it('skips decoding an empty source map', () => {
    expect(sourceMapToLocationData('')).toEqual([]);
  });

  fixtures.forEach((fixture) => {
    describe(fixture.name, () => {
      it('should map from location data to source map', () => {
        const sourceMap = generateSourceMap(fixture.locationData);
        expect(sourceMap).toBe(fixture.sourceMap);
      });

      it('should map from source map to location data', () => {
        const locationData = sourceMapToLocationData(fixture.sourceMap);
        expect(locationData).toEqual(fixture.locationData);
      });
    });
  });
});
