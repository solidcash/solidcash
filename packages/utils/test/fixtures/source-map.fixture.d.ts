import { FullLocationData } from '../../src/types.js';
export interface Fixture {
    name: string;
    locationData: FullLocationData;
    sourceMap: string;
}
export declare const fixtures: Fixture[];
