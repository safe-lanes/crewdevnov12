import { Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { crewSeaService, crewPersonalDetails, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { storage } from "../../../storage";

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
  englishProficiency: number;
  timeOnboardMonths: number;
  crewName: string;
  signOnDate: string | null;
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

function calculateYearsFromSeaService(
  seaServices: any[],
  filterType: 'company' | 'all' | 'rank' | 'vesselType',
  currentRank?: string,
  vesselTypeCode?: string
): number {
  let totalMonths = 0;
  
  for (const service of seaServices) {
    let include = true;
    
    if (filterType === 'company') {
      include = service.serviceType === 'company' || service.serviceType === 'internal';
    } else if (filterType === 'rank' && currentRank) {
      const serviceRank = normalizeRankName(service.rank || '');
      const targetRank = normalizeRankName(currentRank);
      include = serviceRank.toLowerCase() === targetRank.toLowerCase();
    } else if (filterType === 'vesselType' && vesselTypeCode) {
      include = service.vesselTypeUuid === vesselTypeCode;
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

async function getCrewExperienceForMember(
  crewUuid: string,
  rank: string,
  signOnDate: string | null
): Promise<CrewExperience | null> {
  const db = getDb();
  
  const crew = await db
    .select()
    .from(crewMembersV2)
    .where(eq(crewMembersV2.crewUuid, crewUuid))
    .limit(1);
  
  if (!crew.length) return null;
  const crewMember = crew[0];
  
  const seaServices = await db
    .select()
    .from(crewSeaService)
    .where(eq(crewSeaService.crewUuid, crewUuid));
  
  const personalDetails = await db
    .select()
    .from(crewPersonalDetails)
    .where(eq(crewPersonalDetails.crewUuid, crewUuid))
    .limit(1);
  
  const currentRank = normalizeRankName(rank) || crewMember.presentRank || '';
  
  const yearsWithOperator = calculateYearsFromSeaService(seaServices, 'company');
  const yearsInRank = calculateYearsFromSeaService(seaServices, 'rank', currentRank);
  const yearsOnTankerType = calculateYearsFromSeaService(seaServices, 'all');
  
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
    englishProficiency,
    timeOnboardMonths,
    crewName: `${crewMember.firstName || ''} ${crewMember.familyName || ''}`.trim(),
    signOnDate: signOnDate || null,
  };
}

async function getCrewExperienceFromV2(vesselUuid: string): Promise<CrewExperience[]> {
  const db = getDb();
  const experiences: CrewExperience[] = [];
  
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
    const exp = await getCrewExperienceForMember(record.crewUuid, record.rank, record.signOnDate);
    if (exp) experiences.push(exp);
  }
  
  return experiences;
}

async function getSimulatedCrewExperience(
  vesselUuid: string,
  simulatedCrew: Array<{ rank: string; crewMemberId: string; crewName?: string; joiningDate?: string }>
): Promise<CrewExperience[]> {
  const db = getDb();
  
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
      const exp = await getCrewExperienceForMember(
        simEntry.crewMemberId,
        record.rank,
        simEntry.joiningDate || null
      );
      if (exp) experiences.push(exp);
      processedRanks.add(normalizedRank);
    } else {
      const exp = await getCrewExperienceForMember(record.crewUuid, record.rank, record.signOnDate);
      if (exp) experiences.push(exp);
    }
  }
  
  for (const sim of simulatedCrew) {
    const normalizedRank = normalizeRankName(sim.rank).toLowerCase();
    if (!processedRanks.has(normalizedRank)) {
      const exp = await getCrewExperienceForMember(
        sim.crewMemberId,
        sim.rank,
        sim.joiningDate || null
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
  const normalized = rankName.toLowerCase().replace(/\//g, ' ').trim();
  
  const rankMappings: Record<string, string[]> = {
    'master': ['master'],
    'chief officer': ['chief officer', 'c/o'],
    'second officer': ['2nd officer', '2/o', 'second officer', '2nd off'],
    'third officer': ['3rd officer', '3/o', 'third officer', '3rd off'],
    'chief engineer': ['chief engineer', 'c/e'],
    'second engineer': ['2nd engineer', '2/e', 'second engineer', '2nd eng'],
    'third engineer': ['3rd engineer', '3/e', 'third engineer', '3rd eng'],
    'fourth engineer': ['4th engineer', '4/e', 'fourth engineer', '4th eng'],
  };
  
  for (const crew of crewExperiences) {
    const crewRankNormalized = normalizeRankName(crew.rank).toLowerCase();
    
    if (crewRankNormalized === normalized) return crew;
    
    for (const [key, aliases] of Object.entries(rankMappings)) {
      const ruleMatchesKey = aliases.some(a => normalized === a || normalized.startsWith(a + ' '));
      const crewMatchesKey = crewRankNormalized === key || aliases.some(a => crewRankNormalized === a);
      
      if (ruleMatchesKey && crewMatchesKey) {
        return crew;
      }
    }
  }
  
  return undefined;
}

function evaluateExperienceRules(
  ruleArray: any[],
  crewExperiences: CrewExperience[],
  category: string,
  getExperienceValue: (crew: CrewExperience) => number
): ComplianceRuleResult[] {
  const results: ComplianceRuleResult[] = [];
  
  for (const rule of ruleArray) {
    const rankPairStr = rule.rankPair || '';
    const requiredValue = rule.requiredValue || 0;
    const label = rule.label || '';
    
    const ranks = parseRankPairString(rankPairStr);
    let totalYears = 0;
    const foundRanks: string[] = [];
    
    for (const rankName of ranks) {
      const crew = matchRankToCrewExperience(rankName, crewExperiences);
      if (crew) {
        totalYears += getExperienceValue(crew);
        foundRanks.push(normalizeRankName(crew.rank));
      }
    }
    
    if (foundRanks.length > 0) {
      results.push({
        category,
        label: label || `Combined aggregate for ${foundRanks.join(' and ')} shall not be less than ${requiredValue} years.`,
        rankPair: foundRanks.join(' + '),
        requiredValue,
        actualValue: Math.round(totalYears * 10) / 10,
        unit: 'years',
        status: totalYears >= requiredValue ? 'pass' : 'fail'
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
  crewExperiences: CrewExperience[]
): ComplianceRuleResult[] {
  const results: ComplianceRuleResult[] = [];
  
  for (const rule of ruleArray) {
    const rankPairStr = rule.rankPair || '';
    const requiredLevel = rule.requiredLevel || 'Good';
    const label = rule.label || '';
    
    const requiredLevelNum = PROFICIENCY_MAP[requiredLevel] ?? 2;
    const ranks = parseRankPairString(rankPairStr);
    
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
          status: 'not_applicable'
        });
      }
    }
  }
  
  return results;
}

function parseDateJoinedRankPair(rankPairStr: string): string[] {
  const parts = rankPairStr.split(/\s*-\s*/);
  const ranks: string[] = [];
  for (const part of parts) {
    const cleaned = part.replace(/\s*joining\s*date\s*/i, '').trim();
    if (cleaned.length > 0) {
      ranks.push(cleaned);
    }
  }
  return ranks;
}

function evaluateDateJoinedRules(
  ruleArray: any[],
  crewExperiences: CrewExperience[]
): ComplianceRuleResult[] {
  const results: ComplianceRuleResult[] = [];
  
  for (const rule of ruleArray) {
    const rankPairStr = rule.rankPair || '';
    const requiredDays = rule.requiredDays || 0;
    const label = rule.label || '';
    
    const ranks = parseDateJoinedRankPair(rankPairStr);
    
    if (ranks.length < 2) {
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
        status: 'not_applicable'
      });
      continue;
    }
    
    if (!crew1.signOnDate || !crew2.signOnDate) {
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
    
    const date1 = new Date(crew1.signOnDate);
    const date2 = new Date(crew2.signOnDate);
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
  crewExperiences: CrewExperience[]
): ComplianceCheckResult {
  const allResults: ComplianceRuleResult[] = [];
  
  const experienceRules = rules?.experienceRules || {};
  
  if (experienceRules.yearsWithOperator?.length) {
    allResults.push(...evaluateExperienceRules(
      experienceRules.yearsWithOperator,
      crewExperiences,
      'Years with Operator',
      (crew) => crew.yearsWithOperator
    ));
  }
  
  if (experienceRules.yearsInRank?.length) {
    allResults.push(...evaluateExperienceRules(
      experienceRules.yearsInRank,
      crewExperiences,
      'Years in Rank',
      (crew) => crew.yearsInRank
    ));
  }
  
  if (experienceRules.yearsOnTankerType?.length) {
    allResults.push(...evaluateExperienceRules(
      experienceRules.yearsOnTankerType,
      crewExperiences,
      'Years on This Type of Tanker',
      (crew) => crew.yearsOnTankerType
    ));
  }
  
  if (experienceRules.yearsOnAllTankers?.length) {
    allResults.push(...evaluateExperienceRules(
      experienceRules.yearsOnAllTankers,
      crewExperiences,
      'Years on All Tankers',
      (crew) => crew.yearsOnTankerType
    ));
  }
  
  if (rules?.englishProficiencyRules?.length) {
    allResults.push(...evaluateEnglishProficiencyRules(
      rules.englishProficiencyRules,
      crewExperiences
    ));
  }
  
  if (rules?.dateJoinedRules?.length) {
    allResults.push(...evaluateDateJoinedRules(
      rules.dateJoinedRules,
      crewExperiences
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
      
      const allRules = await storage.getOilMajorRules();
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
      
      const allRules = await storage.getOilMajorRules();
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
