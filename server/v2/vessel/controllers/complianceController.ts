import { Request, Response } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { crewAssignments, crewSeaService, crewPersonalDetails, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
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
      const months = parseFloat(service.periodMonths) || 0;
      totalMonths += months;
    }
  }
  
  return totalMonths / 12;
}

async function getCrewExperienceFromV2(vesselUuid: string): Promise<CrewExperience[]> {
  const db = getDb();
  const experiences: CrewExperience[] = [];
  
  const assignments = await db
    .select()
    .from(crewAssignments)
    .where(
      and(
        eq(crewAssignments.vesselUuid, vesselUuid),
        eq(crewAssignments.isCurrent, true),
        eq(crewAssignments.isDeleted, false),
        isNull(crewAssignments.signOffDate)
      )
    );
  
  for (const assignment of assignments) {
    if (!assignment.crewUuid) continue;
    
    const crew = await db
      .select()
      .from(crewMembersV2)
      .where(eq(crewMembersV2.crewUuid, assignment.crewUuid))
      .limit(1);
    
    if (!crew.length) continue;
    const crewMember = crew[0];
    
    const seaServices = await db
      .select()
      .from(crewSeaService)
      .where(eq(crewSeaService.crewUuid, assignment.crewUuid));
    
    const personalDetails = await db
      .select()
      .from(crewPersonalDetails)
      .where(eq(crewPersonalDetails.crewUuid, assignment.crewUuid))
      .limit(1);
    
    const currentRank = assignment.rank || crewMember.presentRank || '';
    
    const yearsWithOperator = calculateYearsFromSeaService(seaServices, 'company');
    const yearsInRank = calculateYearsFromSeaService(seaServices, 'rank', currentRank);
    const yearsOnTankerType = calculateYearsFromSeaService(seaServices, 'all');
    
    let englishProficiency = -1;
    if (personalDetails.length && personalDetails[0].englishProficiency) {
      englishProficiency = PROFICIENCY_MAP[personalDetails[0].englishProficiency] ?? -1;
    }
    
    let timeOnboardMonths = 0;
    const signOnDate = assignment.signOnDate;
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
      crewName: `${crewMember.firstName || ''} ${crewMember.lastName || ''}`.trim()
    });
  }
  
  return experiences;
}

function evaluateRuleAgainstCrew(
  rule: any,
  crewExperiences: CrewExperience[],
  category: string
): ComplianceRuleResult[] {
  const results: ComplianceRuleResult[] = [];
  
  if (category === 'Years with Operator') {
    const rankPairs = rule.rankPairs || [];
    for (const pair of rankPairs) {
      const ranks = pair.ranks || [];
      let totalYears = 0;
      const rankLabels: string[] = [];
      
      for (const rankName of ranks) {
        const crew = crewExperiences.find(c => 
          normalizeRankName(c.rank).toLowerCase() === normalizeRankName(rankName).toLowerCase()
        );
        if (crew) {
          totalYears += crew.yearsWithOperator;
          rankLabels.push(normalizeRankName(rankName));
        }
      }
      
      const requiredYears = pair.requiredYears || 0;
      results.push({
        category,
        label: `Combined aggregate for ${rankLabels.join(' and ')} shall not be less than ${requiredYears} years.`,
        rankPair: rankLabels.join(' + '),
        requiredValue: requiredYears,
        actualValue: Math.round(totalYears * 10) / 10,
        unit: 'years',
        status: totalYears >= requiredYears ? 'pass' : 'fail'
      });
    }
  } else if (category === 'Years in Rank') {
    const rankPairs = rule.rankPairs || [];
    for (const pair of rankPairs) {
      const ranks = pair.ranks || [];
      let totalYears = 0;
      const rankLabels: string[] = [];
      
      for (const rankName of ranks) {
        const crew = crewExperiences.find(c => 
          normalizeRankName(c.rank).toLowerCase() === normalizeRankName(rankName).toLowerCase()
        );
        if (crew) {
          totalYears += crew.yearsInRank;
          rankLabels.push(normalizeRankName(rankName));
        }
      }
      
      const requiredYears = pair.requiredYears || 0;
      results.push({
        category,
        label: `Combined aggregate for ${rankLabels.join(' and ')} shall not be less than ${requiredYears} years.`,
        rankPair: rankLabels.join(' + '),
        requiredValue: requiredYears,
        actualValue: Math.round(totalYears * 10) / 10,
        unit: 'years',
        status: totalYears >= requiredYears ? 'pass' : 'fail'
      });
    }
  } else if (category === 'Years on This Type of Tanker') {
    const rankPairs = rule.rankPairs || [];
    for (const pair of rankPairs) {
      const ranks = pair.ranks || [];
      let totalYears = 0;
      const rankLabels: string[] = [];
      
      for (const rankName of ranks) {
        const crew = crewExperiences.find(c => 
          normalizeRankName(c.rank).toLowerCase() === normalizeRankName(rankName).toLowerCase()
        );
        if (crew) {
          totalYears += crew.yearsOnTankerType;
          rankLabels.push(normalizeRankName(rankName));
        }
      }
      
      const requiredYears = pair.requiredYears || 0;
      results.push({
        category,
        label: `Combined aggregate for ${rankLabels.join(' and ')} shall not be less than ${requiredYears} years.`,
        rankPair: rankLabels.join(' + '),
        requiredValue: requiredYears,
        actualValue: Math.round(totalYears * 10) / 10,
        unit: 'years',
        status: totalYears >= requiredYears ? 'pass' : 'fail'
      });
    }
  } else if (category === 'English Proficiency') {
    const minLevel = rule.minLevel || 2;
    const targetRanks = rule.targetRanks || 'allOfficers';
    
    let targetCrew: CrewExperience[] = [];
    if (targetRanks === 'allOfficers') {
      targetCrew = crewExperiences.filter(c => isOfficerRank(c.rank));
    } else if (targetRanks === 'deckOfficers') {
      targetCrew = crewExperiences.filter(c => isDeckOfficer(c.rank));
    } else if (targetRanks === 'engineOfficers') {
      targetCrew = crewExperiences.filter(c => isEngineerOfficer(c.rank));
    }
    
    for (const crew of targetCrew) {
      const status = crew.englishProficiency >= minLevel ? 'pass' : 
                     (crew.englishProficiency === -1 ? 'not_applicable' : 'fail');
      results.push({
        category,
        label: `English proficiency for ${normalizeRankName(crew.rank)}`,
        rankPair: normalizeRankName(crew.rank),
        requiredValue: minLevel,
        actualValue: crew.englishProficiency,
        unit: 'level',
        status
      });
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
  
  const categories = [
    'Years with Operator',
    'Years in Rank', 
    'Years on This Type of Tanker',
    'English Proficiency'
  ];
  
  for (const category of categories) {
    const categoryKey = category.toLowerCase().replace(/ /g, '_');
    const rule = rules?.[categoryKey] || rules?.[category];
    if (rule) {
      const categoryResults = evaluateRuleAgainstCrew(rule, crewExperiences, category);
      allResults.push(...categoryResults);
    }
  }
  
  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const total = allResults.length;
  
  let overallStatus: 'green' | 'yellow' | 'red' = 'green';
  if (failed > 0) {
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
