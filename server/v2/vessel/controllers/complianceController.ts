import { Request, Response } from "express";
import { eq, and, or, isNull, sql, asc, inArray } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import { getDb } from "../../db";
import { crewSeaService, crewPersonalDetails, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { masterVessels, masterVesselTypes, oilMajorRules as oilMajorRulesTable } from "../../../../shared/schema";
import { getVesselTankerCategory, seaServiceMatchesTankerCategory, seaServiceIsAnyTanker, type TankerCategory } from "../services/vesselPlanningService";

interface ComplianceRuleResult {
  category: string;
  label: string;
  rankPair: string;
  requiredValue: number;
  actualValue: number;
  unit: string;
  status: 'pass' | 'fail' | 'not_applicable';
}

interface ComplianceCheckResult {
  oilMajorName: string;
  overallStatus: 'green' | 'yellow' | 'red' | 'gray';
  results: ComplianceRuleResult[];
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
}

interface CrewExperience {
  rank: string;
  yearsWithOperator: number;
  yearsInRank: number;
  yearsOnTankerType: number;
  yearsOnAllTankers: number;
  englishProficiency: number;
  timeOnboardMonths: number;
  crewName: string;
  signOnDate: string | null;
  // Raw sea-service rows for this crew member, used by the rule evaluator
  // to recompute rank-strict aggregates (e.g. Years with Operator combined
  // for Master + C/O) using the rule's rank rather than the assigned rank.
  seaServices?: any[];
}

const PROFICIENCY_MAP: Record<string, number> = {
  'None': 0,
  'Basic': 1,
  'Intermediate': 2,
  'Fluent': 3,
  'Native': 4,
  'Poor': 0,
  'Fair': 1,
  'Good': 2,
  'Excellent': 3,
};

function normalizeRankName(rank: string): string {
  return rank?.replace(/_\d+$/, '').trim() || '';
}

function isOfficerRank(rank: string): boolean {
  const normalized = normalizeRankName(rank).toLowerCase();
  const officerRanks = ['master', 'chief officer', '2nd officer', '3rd officer', 
    'chief engineer', '2nd engineer', '3rd engineer', '4th engineer',
    'electrical officer', 'eto'];
  return officerRanks.some(r => normalized.includes(r));
}

function isDeckOfficer(rank: string): boolean {
  const normalized = normalizeRankName(rank).toLowerCase();
  return ['master', 'chief officer', '2nd officer', '3rd officer'].some(r => normalized.includes(r));
}

function isEngineerOfficer(rank: string): boolean {
  const normalized = normalizeRankName(rank).toLowerCase();
  return ['chief engineer', '2nd engineer', '3rd engineer', '4th engineer'].some(r => normalized.includes(r));
}

function calculateMonthsFromDates(fromDate: string | null, toDate: string | null): number {
  if (!fromDate) return 0;
  
  const from = new Date(fromDate);
  const to = toDate ? new Date(toDate) : new Date();
  
  if (isNaN(from.getTime())) return 0;
  if (isNaN(to.getTime())) return 0;
  
  const months = (to.getFullYear() - from.getFullYear()) * 12 + 
                 (to.getMonth() - from.getMonth()) +
                 (to.getDate() - from.getDate()) / 30;
  
  return Math.max(0, months);
}

// Canonical rank aliases used to compare two rank strings (e.g. a rule
// rank against a sea-service row's rank, or against a crew member's
// assigned rank). Keep in sync with the rankMappings table inside
// matchRankToCrewExperience.
const RANK_ALIASES: Record<string, string[]> = {
  'master': ['master'],
  'chief officer': ['chief officer', 'c/o'],
  'second officer': ['2nd officer', '2/o', 'second officer', '2nd off'],
  'third officer': ['3rd officer', '3/o', 'third officer', '3rd off'],
  'chief engineer': ['chief engineer', 'c/e'],
  'second engineer': ['2nd engineer', '2/e', 'second engineer', '2nd eng'],
  'third engineer': ['3rd engineer', '3/e', 'third engineer', '3rd eng'],
  'fourth engineer': ['4th engineer', '4/e', 'fourth engineer', '4th eng'],
};

function canonicalRank(rank: string): string {
  const normalized = normalizeRankName(rank).toLowerCase().replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  for (const [canon, aliases] of Object.entries(RANK_ALIASES)) {
    if (normalized === canon) return canon;
    if (aliases.some((a) => normalized === a.toLowerCase().replace(/\//g, ' ').replace(/\s+/g, ' ').trim())) {
      return canon;
    }
  }
  return normalized;
}

function ranksMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = canonicalRank(a || '');
  const cb = canonicalRank(b || '');
  return ca.length > 0 && ca === cb;
}

function calculateYearsFromSeaService(
  seaServices: any[],
  filterType: 'company' | 'all' | 'rank' | 'vesselType' | 'companyAndRank' | 'tanker',
  currentRank?: string,
  vesselTypeCode?: string,
  tankerCategory?: TankerCategory
): number {
  let totalMonths = 0;
  
  for (const service of seaServices) {
    let include = false;
    
    if (filterType === 'companyAndRank') {
      const isCompany = service.serviceType === 'company' || service.serviceType === 'internal';
      include = isCompany && ranksMatch(service.rank, currentRank);
    } else if (filterType === 'company') {
      include = service.serviceType === 'company' || service.serviceType === 'internal';
    } else if (filterType === 'rank' && currentRank) {
      include = ranksMatch(service.rank, currentRank);
    } else if (filterType === 'vesselType') {
      // "Years on This Type of Tanker" — match by tanker category, not strict UUID
      include = !!tankerCategory && seaServiceMatchesTankerCategory(service, tankerCategory);
    } else if (filterType === 'tanker') {
      include = seaServiceIsAnyTanker(service);
    } else if (filterType === 'all') {
      include = true;
    }
    
    if (include) {
      let months = parseFloat(service.periodMonths) || 0;
      
      if (months === 0 && service.fromDate) {
        months = calculateMonthsFromDates(service.fromDate, service.toDate);
      }
      
      totalMonths += months;
    }
  }
  
  return totalMonths / 12;
}

async function getSeaServiceWithVesselTypes(crewUuid: string) {
  const db = getDb();
  const mvtByUuid = masterVesselTypes;
  const mvtByName = aliasedTable(masterVesselTypes, "mvt_by_name");

  return db
    .select({
      seaUuid: crewSeaService.seaUuid,
      serviceType: crewSeaService.serviceType,
      vesselName: crewSeaService.vesselName,
      vesselUuid: crewSeaService.vesselUuid,
      vesselTypeUuid: crewSeaService.vesselTypeUuid,
      vesselTypeName: sql<string>`COALESCE(${mvtByUuid.vesselType}, ${mvtByName.vesselType})`,
      isTanker: sql<boolean>`COALESCE(${mvtByUuid.tanker}, ${mvtByName.tanker})`,
      isOilTanker: sql<boolean>`COALESCE(${mvtByUuid.oilTanker}, ${mvtByName.oilTanker})`,
      isGasTanker: sql<boolean>`COALESCE(${mvtByUuid.gasTanker}, ${mvtByName.gasTanker})`,
      isChemicalTanker: sql<boolean>`COALESCE(${mvtByUuid.chemicalTanker}, ${mvtByName.chemicalTanker})`,
      rank: crewSeaService.rank,
      fromDate: crewSeaService.fromDate,
      toDate: crewSeaService.toDate,
      periodMonths: crewSeaService.periodMonths,
    })
    .from(crewSeaService)
    .leftJoin(
      mvtByUuid,
      and(
        eq(crewSeaService.vesselTypeUuid, mvtByUuid.vtUuid),
        eq(mvtByUuid.isDeleted, false),
        eq(mvtByUuid.isActive, true)
      )
    )
    .leftJoin(
      mvtByName,
      and(
        isNull(mvtByUuid.vtUuid),
        eq(crewSeaService.vesselTypeUuid, mvtByName.vesselType),
        eq(mvtByName.isDeleted, false),
        eq(mvtByName.isActive, true)
      )
    )
    .where(
      and(
        eq(crewSeaService.crewUuid, crewUuid),
        eq(crewSeaService.isDeleted, false)
      )
    );
}

async function getCrewExperienceForMember(
  crewUuid: string,
  rank: string,
  signOnDate: string | null,
  vesselTypeUuid?: string,
  tankerCategory?: TankerCategory
): Promise<CrewExperience | null> {
  const db = getDb();
  
  const crew = await db
    .select()
    .from(crewMembersV2)
    .where(eq(crewMembersV2.crewUuid, crewUuid))
    .limit(1);
  
  if (!crew.length) return null;
  const crewMember = crew[0];
  
  const seaServices = await getSeaServiceWithVesselTypes(crewUuid);
  
  const personalDetails = await db
    .select()
    .from(crewPersonalDetails)
    .where(eq(crewPersonalDetails.crewUuid, crewUuid))
    .limit(1);
  
  const currentRank = normalizeRankName(rank) || crewMember.presentRank || '';
  
  const yearsWithOperator = calculateYearsFromSeaService(seaServices, 'companyAndRank', currentRank);
  const yearsInRank = calculateYearsFromSeaService(seaServices, 'rank', currentRank);
  const yearsOnTankerType = tankerCategory
    ? calculateYearsFromSeaService(seaServices, 'vesselType', undefined, vesselTypeUuid, tankerCategory)
    : 0;
  const yearsOnAllTankers = calculateYearsFromSeaService(seaServices, 'tanker');
  
  let englishProficiency = -1;
  if (personalDetails.length && personalDetails[0].englishProficiency) {
    englishProficiency = PROFICIENCY_MAP[personalDetails[0].englishProficiency] ?? -1;
  }
  
  let timeOnboardMonths = 0;
  if (signOnDate) {
    const signOn = new Date(signOnDate);
    const now = new Date();
    timeOnboardMonths = (now.getFullYear() - signOn.getFullYear()) * 12 + 
                        (now.getMonth() - signOn.getMonth());
  }
  
  return {
    rank: currentRank,
    yearsWithOperator,
    yearsInRank,
    yearsOnTankerType,
    yearsOnAllTankers,
    englishProficiency,
    timeOnboardMonths,
    crewName: `${crewMember.firstName || ''} ${crewMember.familyName || ''}`.trim(),
    signOnDate: signOnDate || null,
    seaServices,
  };
}

async function getVesselTypeUuid(vesselUuid: string): Promise<string | undefined> {
  const db = getDb();
  const [vessel] = await db
    .select({ vesselType: masterVessels.vesselType })
    .from(masterVessels)
    .where(eq(masterVessels.vesselUuid, vesselUuid))
    .limit(1);
  
  if (!vessel?.vesselType) return undefined;
  
  const [vt] = await db
    .select({ vtUuid: masterVesselTypes.vtUuid })
    .from(masterVesselTypes)
    .where(
      and(
        eq(masterVesselTypes.vesselType, vessel.vesselType),
        eq(masterVesselTypes.isDeleted, false),
        eq(masterVesselTypes.isActive, true)
      )
    )
    .limit(1);
  
  return vt?.vtUuid || undefined;
}

async function getCrewExperienceFromV2(vesselUuid: string): Promise<CrewExperience[]> {
  const db = getDb();
  const experiences: CrewExperience[] = [];
  
  const vesselTypeUuid = await getVesselTypeUuid(vesselUuid);
  const tankerCategory = await getVesselTankerCategory(vesselUuid);
  
  const planningRecords = await db
    .select()
    .from(vesselPlanningV2)
    .where(
      and(
        eq(vesselPlanningV2.vesselUuid, vesselUuid),
        eq(vesselPlanningV2.isDeleted, false),
        eq(vesselPlanningV2.isArchived, false)
      )
    );
  
  const activeRecords = planningRecords.filter((r: any) => r.crewUuid);
  
  for (const record of activeRecords) {
    if (!record.crewUuid) continue;
    const exp = await getCrewExperienceForMember(record.crewUuid, record.rank, record.signOnDate, vesselTypeUuid, tankerCategory);
    if (exp) experiences.push(exp);
  }
  
  return experiences;
}

async function getSimulatedCrewExperience(
  vesselUuid: string,
  simulatedCrew: Array<{ rank: string; crewMemberId: string; crewName?: string; joiningDate?: string }>
): Promise<CrewExperience[]> {
  const db = getDb();
  
  const vesselTypeUuid = await getVesselTypeUuid(vesselUuid);
  const tankerCategory = await getVesselTankerCategory(vesselUuid);
  
  const planningRecords = await db
    .select()
    .from(vesselPlanningV2)
    .where(
      and(
        eq(vesselPlanningV2.vesselUuid, vesselUuid),
        eq(vesselPlanningV2.isDeleted, false),
        eq(vesselPlanningV2.isArchived, false)
      )
    );
  
  const activeRecords = planningRecords.filter((r: any) => r.crewUuid);
  
  const simRankMap = new Map<string, { crewMemberId: string; joiningDate?: string }>();
  for (const sim of simulatedCrew) {
    const normalizedRank = normalizeRankName(sim.rank).toLowerCase();
    simRankMap.set(normalizedRank, { crewMemberId: sim.crewMemberId, joiningDate: sim.joiningDate });
  }
  
  const experiences: CrewExperience[] = [];
  const processedRanks = new Set<string>();
  
  for (const record of activeRecords) {
    if (!record.crewUuid) continue;
    const normalizedRank = normalizeRankName(record.rank).toLowerCase();
    
    const simEntry = simRankMap.get(normalizedRank);
    if (simEntry) {
      // Effective replacement date precedence:
      //   1. simulated joining date (when explicitly provided in the simulation)
      //   2. existing planning sign-on date for this slot (so a one-sided
      //      simulation that swaps the crew member but keeps the existing
      //      join date still yields a real comparison instead of N/A).
      const effectiveDate = simEntry.joiningDate || record.signOnDate || null;
      const exp = await getCrewExperienceForMember(
        simEntry.crewMemberId,
        record.rank,
        effectiveDate,
        vesselTypeUuid,
        tankerCategory
      );
      if (exp) experiences.push(exp);
      processedRanks.add(normalizedRank);
    } else {
      const exp = await getCrewExperienceForMember(record.crewUuid, record.rank, record.signOnDate, vesselTypeUuid, tankerCategory);
      if (exp) experiences.push(exp);
    }
  }
  
  for (const sim of simulatedCrew) {
    const normalizedRank = normalizeRankName(sim.rank).toLowerCase();
    if (!processedRanks.has(normalizedRank)) {
      const exp = await getCrewExperienceForMember(
        sim.crewMemberId,
        sim.rank,
        sim.joiningDate || null,
        vesselTypeUuid,
        tankerCategory
      );
      if (exp) experiences.push(exp);
    }
  }
  
  return experiences;
}

function parseRankPairString(rankPairStr: string): string[] {
  return rankPairStr
    .split(/[+,]/)
    .map(r => r.trim())
    .filter(r => r.length > 0);
}

function matchRankToCrewExperience(rankName: string, crewExperiences: CrewExperience[]): CrewExperience | undefined {
  // Use the same canonical rank mapping as ranksMatch so that rule-to-crew
  // matching and rule-to-sea-service matching share a single source of truth.
  for (const crew of crewExperiences) {
    if (ranksMatch(crew.rank, rankName)) {
      return crew;
    }
  }
  return undefined;
}

function evaluateExperienceRules(
  ruleArray: any[],
  crewExperiences: CrewExperience[],
  category: string,
  getExperienceValue: (crew: CrewExperience) => number,
  getExperienceForRank?: (crew: CrewExperience, ruleRank: string) => number,
  targetRankCanonical?: string
): ComplianceRuleResult[] {
  const results: ComplianceRuleResult[] = [];
  
  for (const rule of ruleArray) {
    const rankPairStr = rule.rankPair || '';
    const requiredValue = rule.requiredValue || 0;
    const label = rule.label || '';
    
    const ranks = parseRankPairString(rankPairStr);
    const ruleMentionsTargetRank = targetRankCanonical
      ? ranks.some((r) => canonicalRank(r) === targetRankCanonical)
      : false;
    let totalYears = 0;
    const foundRanks: string[] = [];
    
    for (const rankName of ranks) {
      const crew = matchRankToCrewExperience(rankName, crewExperiences);
      if (crew) {
        totalYears += getExperienceForRank
          ? getExperienceForRank(crew, rankName)
          : getExperienceValue(crew);
        foundRanks.push(normalizeRankName(crew.rank));
      }
    }
    
    // Strict-fail: if the rule mentions the candidate's target rank but at
    // least one required partner rank is missing from the roster, the
    // aggregate cannot be confirmed — fail outright (do not let a candidate
    // pass by virtue of their own contribution alone).
    const partnerMissingForRelevantRule =
      ruleMentionsTargetRank && foundRanks.length < ranks.length;

    if (foundRanks.length > 0 && !partnerMissingForRelevantRule) {
      results.push({
        category,
        label: label || `Combined aggregate for ${foundRanks.join(' and ')} shall not be less than ${requiredValue} years.`,
        rankPair: foundRanks.join(' + '),
        requiredValue,
        actualValue: Math.round(totalYears * 10) / 10,
        unit: 'years',
        status: totalYears >= requiredValue ? 'pass' : 'fail'
      });
    } else if (partnerMissingForRelevantRule) {
      results.push({
        category,
        label: label || `Combined aggregate for ${rankPairStr} shall not be less than ${requiredValue} years.`,
        rankPair: rankPairStr,
        requiredValue,
        actualValue: Math.round(totalYears * 10) / 10,
        unit: 'years',
        status: 'fail'
      });
    } else {
      results.push({
        category,
        label: label || `Combined aggregate for ${rankPairStr} shall not be less than ${requiredValue} years.`,
        rankPair: rankPairStr,
        requiredValue,
        actualValue: 0,
        unit: 'years',
        status: 'not_applicable'
      });
    }
  }
  
  return results;
}

function evaluateEnglishProficiencyRules(
  ruleArray: any[],
  crewExperiences: CrewExperience[],
  targetRankCanonical?: string
): ComplianceRuleResult[] {
  const results: ComplianceRuleResult[] = [];
  
  for (const rule of ruleArray) {
    const rankPairStr = rule.rankPair || '';
    const requiredLevel = rule.requiredLevel || 'Good';
    const label = rule.label || '';
    
    const requiredLevelNum = PROFICIENCY_MAP[requiredLevel] ?? 2;
    const ranks = parseRankPairString(rankPairStr);
    const ruleMentionsTargetRank = targetRankCanonical
      ? ranks.some((r) => canonicalRank(r) === targetRankCanonical)
      : false;
    
    for (const rankName of ranks) {
      const crew = matchRankToCrewExperience(rankName, crewExperiences);
      if (crew) {
        const status = crew.englishProficiency >= requiredLevelNum ? 'pass' : 
                       (crew.englishProficiency === -1 ? 'not_applicable' : 'fail');
        results.push({
          category: 'English Proficiency',
          label: label || `English proficiency for ${normalizeRankName(crew.rank)} must be ${requiredLevel}`,
          rankPair: normalizeRankName(crew.rank),
          requiredValue: requiredLevelNum,
          actualValue: crew.englishProficiency,
          unit: 'level',
          status
        });
      } else {
        results.push({
          category: 'English Proficiency',
          label: label || `English proficiency for ${rankName} must be ${requiredLevel}`,
          rankPair: rankName,
          requiredValue: requiredLevelNum,
          actualValue: 0,
          unit: 'level',
          status: ruleMentionsTargetRank ? 'fail' : 'not_applicable'
        });
      }
    }
  }
  
  return results;
}

export function parseDateJoinedRankPair(rankPairStr: string): string[] {
  if (!rankPairStr || typeof rankPairStr !== 'string') return [];
  const parts = rankPairStr.split(/\s*[-+,]\s*/);
  const ranks: string[] = [];
  for (const part of parts) {
    const cleaned = part.replace(/\s*joining\s*date\s*/gi, '').trim();
    if (cleaned.length > 0) {
      ranks.push(cleaned);
    }
  }
  return ranks;
}

/**
 * Returns the effective replacement date for a crew slot used by Date Joined
 * rules. Precedence (highest first):
 *   1. The crew experience's `signOnDate` — already populated by
 *      getCrewExperienceForMember from either the simulated joining date or
 *      the existing planning sign-on date (see getSimulatedCrewExperience).
 *   2. (no further fallback — there is no separate joining_date column on
 *      crew_members_v2; null here results in a not_applicable rule outcome.)
 */
export function getEffectiveReplacementDate(crew: { signOnDate: string | null } | null | undefined): Date | null {
  if (!crew || !crew.signOnDate) return null;
  const d = new Date(crew.signOnDate);
  return isNaN(d.getTime()) ? null : d;
}

export function evaluateDateJoinedRules(
  ruleArray: any[],
  crewExperiences: CrewExperience[],
  targetRankCanonical?: string
): ComplianceRuleResult[] {
  const results: ComplianceRuleResult[] = [];
  
  for (const rule of ruleArray) {
    const rankPairStr = rule.rankPair || '';
    const requiredDays = rule.requiredDays || 0;
    const label = rule.label || '';
    
    const ranks = parseDateJoinedRankPair(rankPairStr);
    const ruleMentionsTargetRank = targetRankCanonical
      ? ranks.some((r) => canonicalRank(r) === targetRankCanonical)
      : false;
    
    if (ranks.length < 2) {
      // Malformed rule (unusable definition, not a roster gap) — skip silently
      // in both strict and legacy modes.
      results.push({
        category: 'Date Joined',
        label,
        rankPair: rankPairStr,
        requiredValue: requiredDays,
        actualValue: 0,
        unit: 'days',
        status: 'not_applicable'
      });
      continue;
    }
    
    const crew1 = matchRankToCrewExperience(ranks[0], crewExperiences);
    const crew2 = matchRankToCrewExperience(ranks[1], crewExperiences);
    
    if (!crew1 || !crew2) {
      results.push({
        category: 'Date Joined',
        label: label || `A minimum of ${requiredDays} days shall lapse between replacement of ${ranks.join(' and ')}`,
        rankPair: ranks.join(' + '),
        requiredValue: requiredDays,
        actualValue: 0,
        unit: 'days',
        status: ruleMentionsTargetRank ? 'fail' : 'not_applicable'
      });
      continue;
    }
    
    const date1 = getEffectiveReplacementDate(crew1);
    const date2 = getEffectiveReplacementDate(crew2);
    if (!date1 || !date2) {
      // Pure data-quality skip: both crew rows exist on the roster but
      // one of them is missing/has-invalid sign-on date. Strict-fail does
      // NOT apply here — that case is for missing partner ranks, not
      // missing data on present partners. Keep `not_applicable`.
      results.push({
        category: 'Date Joined',
        label: label || `A minimum of ${requiredDays} days shall lapse between replacement of ${ranks.join(' and ')}`,
        rankPair: `${normalizeRankName(crew1.rank)} + ${normalizeRankName(crew2.rank)}`,
        requiredValue: requiredDays,
        actualValue: 0,
        unit: 'days',
        status: 'not_applicable'
      });
      continue;
    }
    const daysDiff = Math.abs(Math.round((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24)));
    
    results.push({
      category: 'Date Joined',
      label: label || `A minimum of ${requiredDays} days shall lapse between replacement of ${ranks.join(' and ')}`,
      rankPair: `${normalizeRankName(crew1.rank)} + ${normalizeRankName(crew2.rank)}`,
      requiredValue: requiredDays,
      actualValue: daysDiff,
      unit: 'days',
      status: daysDiff >= requiredDays ? 'pass' : 'fail'
    });
  }
  
  return results;
}

function checkComplianceForOilMajor(
  oilMajorName: string,
  rules: any,
  crewExperiences: CrewExperience[],
  targetRankCanonical?: string
): ComplianceCheckResult {
  const allResults: ComplianceRuleResult[] = [];
  
  const experienceRules = rules?.experienceRules || {};
  
  if (experienceRules.yearsWithOperator?.length) {
    allResults.push(...evaluateExperienceRules(
      experienceRules.yearsWithOperator,
      crewExperiences,
      'Years with Operator',
      (crew) => crew.yearsWithOperator,
      // Rank-strict: each rank in a combined-aggregate rule contributes
      // only its own same-rank, same-operator months from the matched
      // crew member's sea-service history. This guarantees the aggregate
      // is the simple sum of per-rank operator months and never includes
      // months from any other rank (e.g. C/O months in the Master total).
      (crew, ruleRank) =>
        crew.seaServices
          ? calculateYearsFromSeaService(crew.seaServices, 'companyAndRank', ruleRank)
          : crew.yearsWithOperator,
      targetRankCanonical
    ));
  }
  
  if (experienceRules.yearsInRank?.length) {
    allResults.push(...evaluateExperienceRules(
      experienceRules.yearsInRank,
      crewExperiences,
      'Years in Rank',
      (crew) => crew.yearsInRank,
      undefined,
      targetRankCanonical
    ));
  }
  
  if (experienceRules.yearsOnTankerType?.length) {
    allResults.push(...evaluateExperienceRules(
      experienceRules.yearsOnTankerType,
      crewExperiences,
      'Years on This Type of Tanker',
      (crew) => crew.yearsOnTankerType,
      undefined,
      targetRankCanonical
    ));
  }
  
  if (experienceRules.yearsOnAllTankers?.length) {
    allResults.push(...evaluateExperienceRules(
      experienceRules.yearsOnAllTankers,
      crewExperiences,
      'Years on All Tankers',
      (crew) => crew.yearsOnAllTankers,
      undefined,
      targetRankCanonical
    ));
  }
  
  if (rules?.englishProficiencyRules?.length) {
    allResults.push(...evaluateEnglishProficiencyRules(
      rules.englishProficiencyRules,
      crewExperiences,
      targetRankCanonical
    ));
  }
  
  if (rules?.dateJoinedRules?.length) {
    allResults.push(...evaluateDateJoinedRules(
      rules.dateJoinedRules,
      crewExperiences,
      targetRankCanonical
    ));
  }
  
  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const notApplicable = allResults.filter(r => r.status === 'not_applicable').length;
  const total = allResults.length;
  
  let overallStatus: 'green' | 'yellow' | 'red' | 'gray' = 'green';
  if (total === 0) {
    overallStatus = 'green';
  } else if (failed > 0) {
    overallStatus = 'red';
  } else if (notApplicable === total) {
    overallStatus = 'gray';
  }
  
  return {
    oilMajorName,
    overallStatus,
    results: allResults,
    summary: { passed, failed, total }
  };
}

export const complianceController = {
  async getComplianceMatrix(req: Request, res: Response) {
    try {
      const vesselUuid = req.params.vesselUuid;
      
      const db = getDb();
      const allRules = await db.select().from(oilMajorRulesTable).orderBy(asc(oilMajorRulesTable.oilMajorName));
      if (!allRules || allRules.length === 0) {
        return res.json({
          vesselId: vesselUuid,
          results: [],
          message: "No oil major rules configured."
        });
      }
      
      const crewExperiences = await getCrewExperienceFromV2(vesselUuid);
      
      const results: ComplianceCheckResult[] = [];
      
      for (const rule of allRules) {
        if (!rule.isActive) continue;
        
        let parsedRules: any = rule.rules;
        if (typeof parsedRules === 'string') {
          try {
            parsedRules = JSON.parse(parsedRules);
          } catch (e) {
            parsedRules = {} as any;
          }
        }
        
        const result = checkComplianceForOilMajor(
          rule.oilMajorName,
          parsedRules,
          crewExperiences
        );
        results.push(result);
      }
      
      res.json({
        vesselId: vesselUuid,
        results
      });
    } catch (error) {
      console.error('V2 Compliance Matrix error:', error);
      res.status(500).json({ error: 'Failed to check compliance' });
    }
  },

  async getSimulatedComplianceMatrix(req: Request, res: Response) {
    try {
      const vesselUuid = req.params.vesselUuid;
      const { simulatedCrew } = req.body;
      
      const db = getDb();
      const allRules = await db.select().from(oilMajorRulesTable).orderBy(asc(oilMajorRulesTable.oilMajorName));
      if (!allRules || allRules.length === 0) {
        return res.json({
          vesselId: vesselUuid,
          results: [],
          simulated: true,
          message: "No oil major rules configured."
        });
      }
      
      const crewExperiences = simulatedCrew && simulatedCrew.length > 0
        ? await getSimulatedCrewExperience(vesselUuid, simulatedCrew)
        : await getCrewExperienceFromV2(vesselUuid);
      
      const results: ComplianceCheckResult[] = [];
      
      for (const rule of allRules) {
        if (!rule.isActive) continue;
        
        let parsedRules: any = rule.rules;
        if (typeof parsedRules === 'string') {
          try {
            parsedRules = JSON.parse(parsedRules);
          } catch (e) {
            parsedRules = {} as any;
          }
        }
        
        const result = checkComplianceForOilMajor(
          rule.oilMajorName,
          parsedRules,
          crewExperiences
        );
        results.push(result);
      }
      
      res.json({
        vesselId: vesselUuid,
        results,
        simulated: true
      });
    } catch (error) {
      console.error('V2 Simulated Compliance Matrix error:', error);
      res.status(500).json({ error: 'Failed to check simulated compliance' });
    }
  }
};

// =============================================================================
// Batch compliance evaluator (Rotation Planning rank Filter)
// -----------------------------------------------------------------------------
// Returns the subset of candidates who pass every selected rule on every
// selected vessel (strict AND). Reuses the same evaluators as the matrix.
//
// Strict-fail: rules that mention the candidate's target rank are always
// evaluated; missing partner ranks on the roster produce `fail`. Rules that
// do NOT mention the target rank with missing partners are skipped. Rules
// that legitimately resolve to `not_applicable` (English N/A, malformed
// rank pair, missing sign-on date on a present partner) are treated as pass.
// =============================================================================

export interface BatchComplianceRequest {
  rank: string;
  vesselUuids: string[];
  ruleNames: string[];
  candidateUuids: string[];
}

export interface BatchComplianceResponse {
  compliantCrewUuids: string[];
}

interface CandidateBaseData {
  seaServices: any[];
  englishProficiency: number;
  crewName: string;
}

interface VesselBatchContext {
  vesselUuid: string;
  vesselTypeUuid: string | undefined;
  tankerCategory: TankerCategory;
  onBoardExps: CrewExperience[];
  targetSlotSignOnDate: string | null;
  rosterCanonicalRanks: Set<string>;
}

// Shape of a single rule entry inside oil_major_rules.rules. The wider rule
// payload is intentionally `any` to stay consistent with the existing helpers
// in this file (the JSON shape is owned by the rule editor); we only need
// `rankPair` here for partner-existence pruning.
interface RuleEntry {
  rankPair?: string;
}

interface ParsedRuleSet {
  experienceRules?: {
    yearsWithOperator?: RuleEntry[];
    yearsInRank?: RuleEntry[];
    yearsOnTankerType?: RuleEntry[];
    yearsOnAllTankers?: RuleEntry[];
  };
  englishProficiencyRules?: RuleEntry[];
  dateJoinedRules?: RuleEntry[];
}

function partnersExist(
  rankPair: string,
  parser: typeof parseRankPairString | typeof parseDateJoinedRankPair,
  rosterCanonicalRanks: Set<string>
): boolean {
  const ranks = parser(rankPair || '');
  if (ranks.length === 0) return false;
  return ranks.every((r) => rosterCanonicalRanks.has(canonicalRank(r)));
}

// Strict mode (targetRankCanonical set): keep ONLY rules whose rankPair
// mentions the candidate's target rank — irrelevant rules cannot affect the
// candidate's eligibility regardless of partner presence. Relevant rules
// with missing partners are kept so evaluators can fail them.
// Legacy mode (no target rank): keep any rule whose partner ranks are all
// present in the roster.
function pruneRulesForRoster(
  rulesObj: ParsedRuleSet | null | undefined,
  rosterCanonicalRanks: Set<string>,
  targetRankCanonical?: string
): ParsedRuleSet {
  if (!rulesObj || typeof rulesObj !== 'object') return {};

  const keepRule = (
    rankPair: string,
    parser: typeof parseRankPairString | typeof parseDateJoinedRankPair,
  ): boolean => {
    if (targetRankCanonical) {
      const ranks = parser(rankPair || '');
      return ranks.some((r) => canonicalRank(r) === targetRankCanonical);
    }
    return partnersExist(rankPair, parser, rosterCanonicalRanks);
  };

  const out: ParsedRuleSet = {};
  if (rulesObj.experienceRules) {
    const er: NonNullable<ParsedRuleSet['experienceRules']> = {};
    const keys: Array<keyof NonNullable<ParsedRuleSet['experienceRules']>> = [
      'yearsWithOperator',
      'yearsInRank',
      'yearsOnTankerType',
      'yearsOnAllTankers',
    ];
    for (const k of keys) {
      const arr = rulesObj.experienceRules[k];
      if (Array.isArray(arr)) {
        er[k] = arr.filter((r) => keepRule(r.rankPair || '', parseRankPairString));
      }
    }
    out.experienceRules = er;
  }
  if (Array.isArray(rulesObj.englishProficiencyRules)) {
    out.englishProficiencyRules = rulesObj.englishProficiencyRules.filter((r) =>
      keepRule(r.rankPair || '', parseRankPairString)
    );
  }
  if (Array.isArray(rulesObj.dateJoinedRules)) {
    out.dateJoinedRules = rulesObj.dateJoinedRules.filter((r) =>
      keepRule(r.rankPair || '', parseDateJoinedRankPair)
    );
  }
  return out;
}

async function loadCandidateBase(
  crewUuid: string,
  cache: Map<string, CandidateBaseData>
): Promise<CandidateBaseData | null> {
  const existing = cache.get(crewUuid);
  if (existing) return existing;
  const db = getDb();
  const [crew] = await db.select().from(crewMembersV2).where(eq(crewMembersV2.crewUuid, crewUuid)).limit(1);
  if (!crew) return null;
  const seaServices = await getSeaServiceWithVesselTypes(crewUuid);
  const personalDetails = await db
    .select()
    .from(crewPersonalDetails)
    .where(eq(crewPersonalDetails.crewUuid, crewUuid))
    .limit(1);
  const englishProficiency =
    personalDetails.length && personalDetails[0].englishProficiency
      ? PROFICIENCY_MAP[personalDetails[0].englishProficiency] ?? -1
      : -1;
  const crewName = `${crew.firstName || ''} ${crew.familyName || ''}`.trim();
  const data: CandidateBaseData = { seaServices, englishProficiency, crewName };
  cache.set(crewUuid, data);
  return data;
}

function buildExperienceFromBase(
  rank: string,
  signOnDate: string | null,
  vesselTypeUuid: string | undefined,
  tankerCategory: TankerCategory,
  base: CandidateBaseData
): CrewExperience {
  const currentRank = normalizeRankName(rank);
  return {
    rank: currentRank,
    yearsWithOperator: calculateYearsFromSeaService(base.seaServices, 'companyAndRank', currentRank),
    yearsInRank: calculateYearsFromSeaService(base.seaServices, 'rank', currentRank),
    yearsOnTankerType: tankerCategory
      ? calculateYearsFromSeaService(base.seaServices, 'vesselType', undefined, vesselTypeUuid, tankerCategory)
      : 0,
    yearsOnAllTankers: calculateYearsFromSeaService(base.seaServices, 'tanker'),
    englishProficiency: base.englishProficiency,
    timeOnboardMonths: 0,
    crewName: base.crewName,
    signOnDate: signOnDate || null,
    seaServices: base.seaServices,
  };
}

export async function evaluateBatchCompliance(
  request: BatchComplianceRequest
): Promise<BatchComplianceResponse> {
  const { rank, vesselUuids, ruleNames, candidateUuids } = request;

  if (!rank || !vesselUuids?.length || !ruleNames?.length || !candidateUuids?.length) {
    return { compliantCrewUuids: candidateUuids ?? [] };
  }

  const db = getDb();

  // 1. Load selected oil major / company rules by name.
  const ruleRows = await db
    .select()
    .from(oilMajorRulesTable)
    .where(
      and(
        eq(oilMajorRulesTable.isActive, true),
        inArray(oilMajorRulesTable.oilMajorName, ruleNames)
      )
    );

  // No active rules match the requested names → nothing to filter against.
  if (!ruleRows.length) return { compliantCrewUuids: candidateUuids };

  const parsedRules = ruleRows.map((r: any) => {
    let rules: any = r.rules;
    if (typeof rules === 'string') {
      try {
        rules = JSON.parse(rules);
      } catch {
        rules = {};
      }
    }
    return { oilMajorName: r.oilMajorName, rules };
  });

  // 2. Build per-vessel context once: vessel type, tanker category, on-board
  //    crew experiences (with the target rank slot stripped out), and per-rule
  //    pruned rule sets (combined-rank rules with missing partners removed).
  const targetRankCanonical = canonicalRank(rank);
  const candidateCache = new Map<string, CandidateBaseData>();

  const vesselContexts: Array<VesselBatchContext & {
    prunedByOilMajor: Map<string, any>;
  }> = [];

  for (const vesselUuid of vesselUuids) {
    const vesselTypeUuid = await getVesselTypeUuid(vesselUuid);
    const tankerCategory = await getVesselTankerCategory(vesselUuid);

    const planning = await db
      .select()
      .from(vesselPlanningV2)
      .where(
        and(
          eq(vesselPlanningV2.vesselUuid, vesselUuid),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false)
        )
      );

    const onBoardExps: CrewExperience[] = [];
    let targetSlotSignOnDate: string | null = null;

    for (const rec of planning) {
      if (!rec.crewUuid) continue;
      const recCanon = canonicalRank(rec.rank);
      if (recCanon === targetRankCanonical) {
        // Capture the existing slot's sign-on date so a candidate evaluated as
        // a same-day swap inherits the same effective replacement date.
        if (!targetSlotSignOnDate) targetSlotSignOnDate = rec.signOnDate;
        continue;
      }
      const base = await loadCandidateBase(rec.crewUuid, candidateCache);
      if (!base) continue;
      onBoardExps.push(
        buildExperienceFromBase(rec.rank, rec.signOnDate, vesselTypeUuid, tankerCategory, base)
      );
    }

    const rosterCanonicalRanks = new Set<string>([
      targetRankCanonical,
      ...onBoardExps.map((e) => canonicalRank(e.rank)),
    ]);

    const prunedByOilMajor = new Map<string, any>();
    for (const { oilMajorName, rules } of parsedRules) {
      prunedByOilMajor.set(
        oilMajorName,
        pruneRulesForRoster(rules, rosterCanonicalRanks, targetRankCanonical)
      );
    }

    vesselContexts.push({
      vesselUuid,
      vesselTypeUuid,
      tankerCategory,
      onBoardExps,
      targetSlotSignOnDate,
      rosterCanonicalRanks,
      prunedByOilMajor,
    });
  }

  // 3. For each candidate × vessel: build the simulated roster and walk every
  //    selected oil-major rule set. AND across vessels and rules; a single
  //    `fail` excludes the candidate. Rules pruned by step 2 (missing partners)
  //    are absent from the pruned ruleset, so they neither pass nor fail —
  //    effectively skipped per the spec.
  const compliantCrewUuids: string[] = [];

  for (const candidateUuid of candidateUuids) {
    const base = await loadCandidateBase(candidateUuid, candidateCache);
    if (!base) continue;

    let allPass = true;

    for (const ctx of vesselContexts) {
      if (!allPass) break;

      const candidateExp = buildExperienceFromBase(
        rank,
        ctx.targetSlotSignOnDate,
        ctx.vesselTypeUuid,
        ctx.tankerCategory,
        base
      );

      const roster: CrewExperience[] = [candidateExp, ...ctx.onBoardExps];

      for (const { oilMajorName } of parsedRules) {
        const prunedRules = ctx.prunedByOilMajor.get(oilMajorName);
        const result = checkComplianceForOilMajor(
          oilMajorName,
          prunedRules,
          roster,
          targetRankCanonical
        );
        if (result.results.some((r) => r.status === 'fail')) {
          allPass = false;
          break;
        }
      }
    }

    if (allPass) compliantCrewUuids.push(candidateUuid);
  }

  return { compliantCrewUuids };
}
