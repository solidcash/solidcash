import type { ResolvedConfig } from './config.js';
export interface DoctorFinding {
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    path?: string;
}
/** Read-only project health and migration diagnostics, suitable for editors and CI. */
export declare function diagnoseProject(config: ResolvedConfig, projectDir?: string): DoctorFinding[];
