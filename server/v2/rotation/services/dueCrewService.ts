import { eq, and, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterVessels } from "../../../../shared/schema";

interface DueCrewFilters {
  filterType?: string;
  vessels?: string[];
  fleet?: string;
  addGroup?: string;
  dueIn?: string;
  rank?: string;
}

function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
}

export const dueCrewService = {
  async getDueCrew(filters: DueCrewFilters) {
    const db = getDb();

    const vesselRows = await db.select().from(masterVessels);
    const vesselUuidToName = new Map<string, string>();
    for (const v of vesselRows) {
      if (v.vesselUuid && v.vessel) {
        vesselUuidToName.set(v.vesselUuid, v.vessel);
      }
    }

    const rows = await db
      .select({
        planUuid: vesselPlanningV2.planUuid,
        vesselUuid: vesselPlanningV2.vesselUuid,
        rank: vesselPlanningV2.rank,
        crewUuid: vesselPlanningV2.crewUuid,
        signOnDate: vesselPlanningV2.signOnDate,
        reliefDue: vesselPlanningV2.reliefDue,
        contractPeriodMonths: vesselPlanningV2.contractPeriodMonths,
        contractEndRangeStartMonths: vesselPlanningV2.contractEndRangeStartMonths,
        contractEndRangeEndMonths: vesselPlanningV2.contractEndRangeEndMonths,
        crewFirstName: crewMembersV2.firstName,
        crewMiddleName: crewMembersV2.middleName,
        crewFamilyName: crewMembersV2.familyName,
        crewNationalityUuid: crewMembersV2.nationalityUuid,
      })
      .from(vesselPlanningV2)
      .innerJoin(
        crewMembersV2,
        eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid)
      )
      .where(
        and(
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false),
          isNotNull(vesselPlanningV2.crewUuid),
          isNotNull(vesselPlanningV2.reliefDue),
          eq(crewMembersV2.isDeleted, false),
          sql`${crewMembersV2.archivedAt} IS NULL`
        )
      );

    let processedCrew = rows
      .map((row) => {
        const rawJoiningDate = row.signOnDate || "";
        const rawReliefDue = row.reliefDue || "";

        const joiningDate = parseFlexibleDate(rawJoiningDate);
        const reliefDue = parseFlexibleDate(rawReliefDue);

        let contractEndDateStr: string | null = null;
        let rangeEndDateStr: string | null = null;

        if (joiningDate) {
          if (row.contractEndRangeStartMonths) {
            const contractEnd = new Date(joiningDate);
            contractEnd.setMonth(contractEnd.getMonth() + row.contractEndRangeStartMonths);
            contractEndDateStr = contractEnd.toISOString().split("T")[0];
          } else if (row.contractPeriodMonths) {
            const contractEnd = new Date(joiningDate);
            contractEnd.setMonth(contractEnd.getMonth() + row.contractPeriodMonths);
            contractEndDateStr = contractEnd.toISOString().split("T")[0];
          } else if (rawReliefDue) {
            contractEndDateStr = rawReliefDue;
          }

          if (row.contractEndRangeEndMonths) {
            const rangeEnd = new Date(joiningDate);
            rangeEnd.setMonth(rangeEnd.getMonth() + row.contractEndRangeEndMonths);
            rangeEndDateStr = rangeEnd.toISOString().split("T")[0];
          } else if (contractEndDateStr) {
            rangeEndDateStr = contractEndDateStr;
          }
        } else if (rawReliefDue) {
          contractEndDateStr = rawReliefDue;
          rangeEndDateStr = rawReliefDue;
        }

        if (!contractEndDateStr) return null;

        const name = [row.crewFirstName, row.crewMiddleName, row.crewFamilyName]
          .filter(Boolean)
          .join(" ")
          .trim() || "Unknown";

        return {
          id: row.planUuid,
          vesselId: row.vesselUuid,
          vessel: vesselUuidToName.get(row.vesselUuid) || row.vesselUuid,
          rank: row.rank,
          name,
          reliefDue: rawReliefDue,
          contractStartDate: rawJoiningDate,
          contractEndDate: contractEndDateStr,
          rangeStartDate: rawReliefDue || contractEndDateStr,
          rangeEndDate: rangeEndDateStr || contractEndDateStr,
          nationality: row.crewNationalityUuid || "",
          _reliefDueDate: reliefDue,
          _rangeEndDate: new Date(rangeEndDateStr || contractEndDateStr),
        };
      })
      .filter((crew): crew is NonNullable<typeof crew> => crew !== null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filters.filterType === "vessel" && filters.vessels && filters.vessels.length > 0) {
      processedCrew = processedCrew.filter((crew) =>
        filters.vessels!.includes(crew.vesselId)
      );
    } else if (filters.filterType === "fleet" && filters.fleet) {
      // Fleet filtering - would require fleet master data lookup
    } else if (filters.filterType === "addGroup" && filters.addGroup) {
      // Additional group filtering - would require group master data lookup
    }

    if (filters.rank) {
      const rankList = Array.isArray(filters.rank)
        ? filters.rank.filter((r: string) => typeof r === "string" && r.trim())
        : typeof filters.rank === "string"
          ? [filters.rank]
          : [];
      if (rankList.length > 0) {
        const baseRanksFromVariants = new Set<string>();
        rankList.forEach((r: string) => {
          if (typeof r === "string" && r.includes("_")) {
            const baseRank = r.substring(0, r.lastIndexOf("_"));
            baseRanksFromVariants.add(baseRank);
          }
        });

        processedCrew = processedCrew.filter((crew) => {
          if (rankList.includes(crew.rank)) return true;
          if (baseRanksFromVariants.has(crew.rank)) return true;
          for (const selectedRank of rankList) {
            if (crew.rank.startsWith(selectedRank + "_")) {
              return true;
            }
          }
          return false;
        });
      }
    }

    if (filters.dueIn) {
      const monthsMap: Record<string, number> = {
        "3m": 3,
        "2m": 2,
        "1m": 1,
      };

      if (filters.dueIn === "overdue") {
        processedCrew = processedCrew.filter((crew) => crew._rangeEndDate < today);
      } else if (filters.dueIn === "overdue1m") {
        const oneMonthFromNow = new Date(today);
        oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
        processedCrew = processedCrew.filter(
          (crew) => crew._rangeEndDate >= today && crew._rangeEndDate <= oneMonthFromNow
        );
      } else if (monthsMap[filters.dueIn]) {
        const months = monthsMap[filters.dueIn];
        const targetDate = new Date(today);
        targetDate.setMonth(targetDate.getMonth() + months);
        processedCrew = processedCrew.filter((crew) => {
          const isOverdue = crew._rangeEndDate < today;
          const isDueWithinWindow =
            crew._reliefDueDate &&
            crew._reliefDueDate >= today &&
            crew._reliefDueDate <= targetDate;
          return isOverdue || isDueWithinWindow;
        });
      }
    }

    return processedCrew.map(({ _reliefDueDate, _rangeEndDate, ...cleanCrew }) => cleanCrew);
  },
};
