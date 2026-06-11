import { fixtures } from '../fixture/libauth-template/fixtures.js';

describe('Libauth Template generation tests (single-contract)', () => {
  it.each(fixtures)('should generate a valid libauth template for $name', async (fixture) => {
    const transaction = await fixture.transaction;
    const generatedTemplate = transaction.getLibauthTemplate();
    // console.warn(JSON.stringify(generatedTemplate, null, 2));
    // console.warn(fixture.transaction.bitauthUri());
    expect(generatedTemplate).toEqual(fixture.template);
  });
});
