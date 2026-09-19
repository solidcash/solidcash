import IConfig_ from "../../scripts/config.json";
export type IConfig = typeof IConfig_;
export declare const Config: (networkName: string) => IConfig;
