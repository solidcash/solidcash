export var JobState;
(function (JobState) {
    JobState[JobState["Open"] = 0] = "Open";
    JobState[JobState["Taken"] = 1] = "Taken";
    JobState[JobState["Closed"] = 2] = "Closed";
})(JobState || (JobState = {}));
export var JobEventType;
(function (JobEventType) {
    JobEventType[JobEventType["Created"] = 0] = "Created";
    JobEventType[JobEventType["Taken"] = 1] = "Taken";
    JobEventType[JobEventType["Paid"] = 2] = "Paid";
    JobEventType[JobEventType["Updated"] = 3] = "Updated";
    JobEventType[JobEventType["Signed"] = 4] = "Signed";
    JobEventType[JobEventType["Completed"] = 5] = "Completed";
    JobEventType[JobEventType["Delivered"] = 6] = "Delivered";
    JobEventType[JobEventType["Closed"] = 7] = "Closed";
    JobEventType[JobEventType["Reopened"] = 8] = "Reopened";
    JobEventType[JobEventType["Rated"] = 9] = "Rated";
    JobEventType[JobEventType["Refunded"] = 10] = "Refunded";
    JobEventType[JobEventType["Disputed"] = 11] = "Disputed";
    JobEventType[JobEventType["Arbitrated"] = 12] = "Arbitrated";
    JobEventType[JobEventType["ArbitrationRefused"] = 13] = "ArbitrationRefused";
    JobEventType[JobEventType["WhitelistedWorkerAdded"] = 14] = "WhitelistedWorkerAdded";
    JobEventType[JobEventType["WhitelistedWorkerRemoved"] = 15] = "WhitelistedWorkerRemoved";
    JobEventType[JobEventType["CollateralWithdrawn"] = 16] = "CollateralWithdrawn";
    JobEventType[JobEventType["WorkerMessage"] = 17] = "WorkerMessage";
    JobEventType[JobEventType["OwnerMessage"] = 18] = "OwnerMessage";
})(JobEventType || (JobEventType = {}));
export const jobEventTypeToString = (eventType) => [
    'Created',
    'Taken',
    'Paid',
    'Updated',
    'Signed',
    'Completed',
    'Delivered',
    'Closed',
    'Reopened',
    'Rated',
    'Refunded',
    'Disputed',
    'Arbitrated',
    'ArbitrationRefused',
    'WhitelistedWorkerAdded',
    'WhitelistedWorkerRemoved',
    'CollateralWithdrawn',
    'WorkerMessage',
    'OwnerMessage',
][eventType];
//# sourceMappingURL=interfaces.js.map