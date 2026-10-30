// APD-51: appraisal_results_v2.crew_member_id names the crew by crew_uuid, or by
// emp_no in older rows. Both are the same on every server; the serial crew id
// and the serial appraisal id are not, so neither is used here.

type CrewAppraisalRow = {
    crewMemberId?: string | null;
    updatedAt?: string | Date | null;
    createdAt?: string | Date | null;
};

type CrewKeys = {
    crewUuid?: string | null;
    crewEmpNo?: string | null;
};

const rowTime = (row: CrewAppraisalRow) => new Date(row.updatedAt || row.createdAt || 0).getTime();

export function findLatestCrewAppraisal<T extends CrewAppraisalRow>(appraisals: T[], crew: CrewKeys): T | null {
    // A blank key matches nothing: the planning mapper sends crewEmpNo as '' when it is missing.
    const keys = new Set(
        [crew.crewUuid, crew.crewEmpNo]
            .map((key) => (key ?? '').trim())
            .filter((key) => key !== ''),
    );
    if (keys.size === 0) return null;

    let latest: T | null = null;
    for (const row of appraisals) {
        const crewMemberId = (row.crewMemberId ?? '').trim();
        if (!keys.has(crewMemberId)) continue;
        if (latest === null || rowTime(row) > rowTime(latest)) latest = row;
    }
    return latest;
}
