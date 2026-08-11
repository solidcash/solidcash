import { fixtures } from '../fixture/libauth-template/multi-contract-fixtures.js';
import { normalizeTemplate } from './normalize-template.js';

describe('Libauth Template generation tests (multi-contract)', () => {
  it.each(fixtures)('should generate a valid libauth template for $name', async (fixture) => {
    const builder = await fixture.transaction;
    const generatedTemplate = builder.getLibauthTemplate();
    // console.warn(JSON.stringify(generatedTemplate, null, 2));
    // console.warn(builder.bitauthUri());
    expect(normalizeTemplate(generatedTemplate)).toEqual(normalizeTemplate(fixture.template));
  });
});
