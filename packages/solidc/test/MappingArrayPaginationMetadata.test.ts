import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const source = (copyExpression = 'events[key][i + index]'): string => `
pragma solidcash >=0.8.0;

contract Pagination() {
  struct Event { int value; }
  mapping(int => Event[]) events;

  function page(int key, int index, int limit) public view returns (Event[] memory) {
    int eventsLength = events[key].length;
    require(index < eventsLength, "index out of bounds");
    int length = eventsLength - index;
    if (limit == 0) { limit = length; }
    length = length > limit ? limit : length;
    Event[] memory result = new Event[](length);
    for (int i = 0; i < length; i++) {
      result[i] = ${copyExpression};
    }
    return result;
  }
}
`;

describe('mapping-array pagination ABI metadata', () => {
  it('publishes only the compiler-proven dense slice shape', () => {
    const canonical = compileString(source()).abi.find((fn) => fn.name === 'page');
    expect(canonical?.mappingArrayPagination).toEqual({
      collection: 'events',
      keyParams: ['key'],
      indexParam: 'index',
      limitParam: 'limit',
    });

    const reordered = compileString(source('events[key][index + length - i - 1]'))
      .abi.find((fn) => fn.name === 'page');
    expect(reordered?.mappingArrayPagination).toBeUndefined();

    const shifted = compileString(source('events[key][i + index + 1]'))
      .abi.find((fn) => fn.name === 'page');
    expect(shifted?.mappingArrayPagination).toBeUndefined();
  });
});
