/** Classify a directly compiled contract missing from the bus artifact map. */
export function classifyMissingBusArtifact(bus, contractName) {
  if (bus.method !== 'primary' || typeof bus.siblingError !== 'string' || bus.siblingError.length === 0) {
    throw new Error(`corpus-classification refusal: '${contractName}' compiled directly but is absent from the `
      + 'bus artifact map without a primary-fallback sibling error; refusing to publish an unattributed row');
  }
  return {
    bus: 'FAIL',
    busAbsentFromMap: true,
    busError: bus.siblingError,
    busSiblingError: bus.siblingError,
  };
}
