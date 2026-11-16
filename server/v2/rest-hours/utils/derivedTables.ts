// RH-03: which Rest Hours summary tables are computed, so the sync engine owner
// knows not to copy them as data. Plain data only; this is not sync config.
//
// rh_crew_records_v2   - fully derived by postSaveSyncTx (never sync).
// rh_vessel_records_v2 - counters derived by updateVesselRecordSync; only the
//                        fields below are real data and may be logged for sync.
// After applying daily, task, NC or dateline rows, call
// dailyRecordsService.resyncVesselMonth(vesselId, monthYear).

export const RH_FULLY_DERIVED_TABLES = ["rh_crew_records_v2"] as const;

// Property names on rhVesselRecordsV2 (shared/v2/rest-hours/schema.ts).
export const RH_VESSEL_RECORD_DATA_FIELDS = [
  "isLocked",
  "vesselReviewStatus",
  "vesselReviewSubmittedDate",
  "officeReviewStatus",
  "officeReviewSubmittedDate",
] as const;

// Computed counters and detail text. Disjoint from the data fields. The three
// *Details columns besides crewWithActivityConflictsDetails are not written by
// the recompute today, but they are summary text, not user data.
export const RH_VESSEL_RECORD_DERIVED_FIELDS = [
  "totalCrew",
  "recordingStatusPercent",
  "activityConflicting",
  "crewWithActivityConflicts",
  "crewWithActivityConflictsDetails",
  "totalViolations",
  "crewWithViolations",
  "crewWithViolationsDetails",
  "crewWithNCsDetails",
  "crewWithPredictedViolationsDetails",
  "crewWithPredictedNCsDetails",
  "totalNCs",
  "crewWithNCs",
  "predictedViolations",
  "crewWithPredictedViolations",
  "predictedNCs",
  "crewWithPredictedNCs",
] as const;
