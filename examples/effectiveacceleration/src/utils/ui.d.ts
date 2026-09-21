import { Job, JobEvent, JobEventWithDiffs } from "../interfaces";
export declare const computeJobStateDiffs: (jobEvents: JobEvent[], jobId: string, job?: Job) => JobEventWithDiffs[];
export declare const fetchEventContents: (events: JobEventWithDiffs[], sessionKeys: Record<string, string>) => Promise<JobEventWithDiffs[]>;
