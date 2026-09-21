import { FullLocationData } from './types.js';
export declare function generateSourceMap(locationData: FullLocationData, enabled?: boolean): string;
/** Apply the same location defaults as an encode/decode source-map round trip, without serializing. */
export declare function normaliseSourceMapLocationData(locationData: FullLocationData): FullLocationData;
export declare const sourceMapToLocationData: (sourceMap: string) => FullLocationData;
