export const STATUS_MAPPING = {
  "in-progress": [
    "draft",
    "Draft",
    "in-progress",
    "in_progress",
    "In Progress",
    "applied",
    "Applied",
    "screening",
    "Screening",
    "for_approval",
    "For Approval",
    "submitted",
    "Submitted",
  ],
  recruited: ["recruited", "Recruited", "RECRUITED"],
  waitlist: [
    "waitlist",
    "Waitlist",
    "waitlisted",
    "Waitlisted",
    "WAITLIST",
    "WAITLISTED",
  ],
  rejected: ["rejected", "Rejected", "REJECTED"],
};

export const RECRUITED_STATUSES = new Set(STATUS_MAPPING.recruited);
