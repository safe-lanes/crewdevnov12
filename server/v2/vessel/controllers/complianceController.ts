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
  overallStatus: 'green' | 'yellow' | 'red';
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
}

const PROFICIENCY_MAP: Record<string, number> = {
  'Poor': 0,
  'Fair': 1,
  'Good': 2,
  'Excellent': 3,
  'Native': 4,
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
    
    const crew = await db
      .select()
      .from(crewMembersV2)
      .where(eq(crewMembersV2.crewUuid, record.crewUuid))
      .limit(1);
    
    if (!crew.length) continue;
    const crewMember = crew[0];
    
    const seaServices = await db
      .select()
      .from(crewSeaService)
      .where(eq(crewSeaService.crewUuid, record.crewUuid));
    
    const personalDetails = await db
      .select()
      .from(crewPersonalDetails)
      .where(eq(crewPersonalDetails.crewUuid, record.crewUuid))
      .limit(1);
    
    const currentRank = normalizeRankName(record.rank) || crewMember.presentRank || '';
    
    const yearsWithOperator = calculateYearsFromSeaService(seaServices, 'company');
    const yearsInRank = calculateYearsFromSeaService(seaServices, 'rank', currentRank);
    const yearsOnTankerType = calculateYearsFromSeaService(seaServices, 'all');
    
    let englishProficiency = -1;
    if (personalDetails.length && personalDetails[0].englishProficiency) {
      englishProficiency = PROFICIENCY_MAP[personalDetails[0].englishProficiency] ?? -1;
    }
    
    let timeOnboardMonths = 0;
    const signOnDate = record.signOnDate;
    if (signOnDate) {
      const signOn = new Date(signOnDate);
      const now = new Date();
      timeOnboardMonths = (now.getFullYear() - signOn.getFullYear()) * 12 + 
                          (now.getMonth() - signOn.getMonth());
    }
    
    experiences.push({
      rank: currentRank,
      yearsWithOperator,
      yearsInRank,
      yearsOnTankerType,
      englishProficiency,
      timeOnboardMonths,
      crewName: `${crewMember.firstName || ''} ${crewMember.familyName || ''}`.trim()
    });
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
      }
    }
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
  
  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const total = allResults.length;
  
  let overallStatus: 'green' | 'yellow' | 'red' = 'green';
  if (total === 0) {
    overallStatus = 'green';
  } else if (failed > 0) {
    overallStatus = 'red';
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
      
      if (crewExperiences.length === 0) {
        return res.json({
          vesselId: vesselUuid,
          results: allRules.map((rule: any) => ({
            oilMajorName: rule.oilMajorName,
            overallStatus: 'gray',
            results: [],
            summary: { passed: 0, failed: 0, total: 0 }
          })),
          message: "No crew assigned to this vessel in V2."
        });
      }
      
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
      
      let crewExperiences = await getCrewExperienceFromV2(vesselUuid);
      
      res.json({
        vesselId: vesselUuid,
        results: allRules.map((rule: any) => ({
          oilMajorName: rule.oilMajorName,
          overallStatus: 'gray',
          results: [],
          summary: { passed: 0, failed: 0, total: 0 }
        })),
        simulated: true,
        message: "Simulated compliance check in V2"
      });
    } catch (error) {
      console.error('V2 Simulated Compliance Matrix error:', error);
      res.status(500).json({ error: 'Failed to check simulated compliance' });
    }
  }
};
