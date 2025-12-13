import type { OilMajorRulesConfig, RankPairRule, DateJoinedRule, EnglishProficiencyRule, ConditionalRule, ComplianceRuleResult } from '@shared/schema';

interface CrewMemberExperience {
  rank: string;
  yearsWithOperator: number;  // Company column
  yearsInRank: number;        // Rank column
  yearsOnTankerType: number;  // Tanker Type column
  yearsOnAllTankers: number;  // All Types column
  yearsAsOOW: number;         // OOW column
  timeOnboardMonths: number;  // Time o/b (months)
  signOnDate: string;         // For date joined calculation
  languageProficiency: string; // English column
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

const RANK_ALIASES: Record<string, string[]> = {
  'Master': ['Master', 'Captain', 'Capt'],
  'Chief Officer': ['Chief Officer', 'C/O', 'Chief Mate', 'First Officer', '1/O'],
  'Second Officer': ['Second Officer', '2/O', '2nd Officer', '2nd Off'],
  'Third Officer': ['Third Officer', '3/O', '3rd Officer', '3rd Off'],
  'Chief Engineer': ['Chief Engineer', 'C/E', 'Chief Eng'],
  'Second Engineer': ['Second Engineer', '2/E', '2nd Engineer', '2nd Eng'],
  'Third Engineer': ['Third Engineer', '3/E', '3rd Engineer', '3rd Eng'],
  'Fourth Engineer': ['Fourth Engineer', '4/E', '4th Engineer', '4th Eng'],
  'Gas Engineer': ['Gas Engineer', 'Cargo Engineer', 'LNG Engineer'],
  'Electrical Officer': ['Electrical Officer', 'E/O', 'ETO', 'Electro-Technical Officer'],
};

const RANK_GROUPS: Record<string, string[]> = {
  'All Deck Officers': ['Master', 'Chief Officer', 'Second Officer', 'Third Officer'],
  'All Engineer Officers': ['Chief Engineer', 'Second Engineer', 'Third Engineer', 'Fourth Engineer'],
  'All Engineering Officers': ['Chief Engineer', 'Second Engineer', 'Third Engineer', 'Fourth Engineer'],
  'All Officers': ['Master', 'Chief Officer', 'Second Officer', 'Third Officer', 'Chief Engineer', 'Second Engineer', 'Third Engineer', 'Fourth Engineer', 'Electrical Officer'],
  'All Senior Officers': ['Master', 'Chief Officer', 'Chief Engineer', 'Second Engineer'],
  'All Junior Officers': ['Second Officer', 'Third Officer', 'Third Engineer', 'Fourth Engineer'],
  'Junior Deck Officer': ['Second Officer', 'Third Officer'],
  'Junior Deck Officers': ['Second Officer', 'Third Officer'],
  'Junior Engineer Officer': ['Third Engineer', 'Fourth Engineer'],
  'Junior Eng Officer': ['Third Engineer', 'Fourth Engineer'],
  'Junior Eng Officers': ['Third Engineer', 'Fourth Engineer'],
  'Junior Engineer Officers': ['Third Engineer', 'Fourth Engineer'],
};

function expandRankGroups(rankStr: string): string[] {
  const trimmed = rankStr.trim();
  for (const [groupName, ranks] of Object.entries(RANK_GROUPS)) {
    if (trimmed.toLowerCase() === groupName.toLowerCase()) {
      return ranks;
    }
  }
  return [trimmed];
}

function normalizeRankName(rank: string): string {
  if (!rank) return '';
  let normalized = rank.trim();
  
  // Strip role suffixes like "_1", "_2" that indicate multiple crew in same rank
  // e.g., "3rd Officer_1" -> "3rd Officer", "3rd Officer_2" -> "3rd Officer"
  normalized = normalized.replace(/_\d+$/, '');
  
  for (const [standardName, aliases] of Object.entries(RANK_ALIASES)) {
    if (aliases.some(alias => alias.toLowerCase() === normalized.toLowerCase())) {
      return standardName;
    }
  }
  
  return normalized;
}

function parseRankPair(rankPairStr: string): string[] {
  if (!rankPairStr) return [];
  
  const parts = rankPairStr.split('+').map(r => r.trim()).filter(r => r.length > 0);
  const expandedRanks: string[] = [];
  
  for (const part of parts) {
    const expanded = expandRankGroups(part);
    for (const rank of expanded) {
      const normalized = normalizeRankName(rank);
      if (normalized && !expandedRanks.includes(normalized)) {
        expandedRanks.push(normalized);
      }
    }
  }
  
  return expandedRanks;
}

function findCrewByRank(crew: CrewMemberExperience[], targetRank: string): CrewMemberExperience[] {
  const normalizedTarget = normalizeRankName(targetRank);
  return crew.filter(c => normalizeRankName(c.rank) === normalizedTarget);
}

function getExperienceValue(crew: CrewMemberExperience, category: string): number {
  switch (category) {
    case 'yearsWithOperator':
      return crew.yearsWithOperator;
    case 'yearsInRank':
      return crew.yearsInRank;
    case 'yearsOnTankerType':
      return crew.yearsOnTankerType;
    case 'yearsOnAllTankers':
      return crew.yearsOnAllTankers;
    case 'yearsAsOOW':
      return crew.yearsAsOOW;
    default:
      return 0;
  }
}

function evaluateExperienceRule(
  rule: RankPairRule,
  crew: CrewMemberExperience[],
  category: string,
  categoryLabel: string
): ComplianceRuleResult {
  const ranks = parseRankPair(rule.rankPair);
  
  if (ranks.length === 0) {
    return {
      category: categoryLabel,
      label: rule.label,
      rankPair: rule.rankPair,
      requiredValue: rule.requiredValue,
      actualValue: 0,
      unit: 'years',
      status: 'fail'
    };
  }
  
  let totalExperience = 0;
  
  if (ranks.length === 1) {
    // Individual rank rule
    const matchingCrew = findCrewByRank(crew, ranks[0]);
    if (matchingCrew.length === 0) {
      totalExperience = 0;
    } else {
      // Use minimum value if multiple crew in same rank
      totalExperience = Math.min(...matchingCrew.map(c => getExperienceValue(c, category)));
    }
  } else {
    // Combined rank rule - sum the lowest value per rank
    for (const rank of ranks) {
      const matchingCrew = findCrewByRank(crew, rank);
      if (matchingCrew.length > 0) {
        // Use minimum value for this rank if multiple crew
        const minValue = Math.min(...matchingCrew.map(c => getExperienceValue(c, category)));
        totalExperience += minValue;
      }
    }
  }
  
  const passed = totalExperience >= rule.requiredValue;
  
  return {
    category: categoryLabel,
    label: rule.label,
    rankPair: rule.rankPair,
    requiredValue: rule.requiredValue,
    actualValue: Math.round(totalExperience * 10) / 10,
    unit: 'years',
    status: passed ? 'pass' : 'fail'
  };
}

function evaluateDateJoinedRule(
  rule: DateJoinedRule,
  crew: CrewMemberExperience[]
): ComplianceRuleResult {
  // Parse the rank pair for date comparison (e.g., "Master Joining Date - Chief Officer Joining Date")
  const rankPairMatch = rule.rankPair.match(/^(.+?)\s+Joining\s+Date\s*-\s*(.+?)\s+Joining\s+Date$/i);
  
  if (!rankPairMatch) {
    return {
      category: 'Date Joined',
      label: rule.label,
      rankPair: rule.rankPair,
      requiredValue: rule.requiredDays,
      actualValue: 0,
      unit: 'days',
      status: 'pass' // Default to pass if we can't parse
    };
  }
  
  const [, rank1Name, rank2Name] = rankPairMatch;
  const crew1 = findCrewByRank(crew, rank1Name.trim());
  const crew2 = findCrewByRank(crew, rank2Name.trim());
  
  if (crew1.length === 0 || crew2.length === 0) {
    return {
      category: 'Date Joined',
      label: rule.label,
      rankPair: rule.rankPair,
      requiredValue: rule.requiredDays,
      actualValue: 0,
      unit: 'days',
      status: 'pass' // Pass if one rank is not on board
    };
  }
  
  // Calculate days difference between the most recent sign-on dates
  const date1 = new Date(crew1[0].signOnDate);
  const date2 = new Date(crew2[0].signOnDate);
  const daysDiff = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
  
  const passed = daysDiff >= rule.requiredDays;
  
  return {
    category: 'Date Joined',
    label: rule.label,
    rankPair: rule.rankPair,
    requiredValue: rule.requiredDays,
    actualValue: Math.round(daysDiff),
    unit: 'days',
    status: passed ? 'pass' : 'fail'
  };
}

// Evaluates English proficiency rules for all officers in the rule
function evaluateEnglishProficiencyRuleAll(
  rule: EnglishProficiencyRule,
  crew: CrewMemberExperience[]
): ComplianceRuleResult[] {
  const PROFICIENCY_ORDER = ['Poor', 'Fair', 'Good', 'Excellent', 'Native'];
  
  // Parse ranks from the rule.rankPair - split on comma, ampersand, or plus sign
  // and expand any rank group terms (e.g., "All Deck Officers" -> individual ranks)
  const rawParts = rule.rankPair.split(/[,&+]/).map(r => r.trim()).filter(r => r.length > 0);
  
  // Expand rank groups and normalize all ranks
  const targetRanks: string[] = [];
  for (const part of rawParts) {
    const expanded = expandRankGroups(part);
    for (const rank of expanded) {
      const normalized = normalizeRankName(rank);
      if (normalized && !targetRanks.includes(normalized)) {
        targetRanks.push(normalized);
      }
    }
  }
  
  const results: ComplianceRuleResult[] = [];
  
  for (const targetRank of targetRanks) {
    const matchingCrew = findCrewByRank(crew, targetRank);
    const requiredIndex = PROFICIENCY_ORDER.findIndex(l => l.toLowerCase() === rule.requiredLevel.toLowerCase());
    
    if (matchingCrew.length === 0) {
      // No crew assigned - still show the rule but mark as N/A (use -2 for "No crew")
      results.push({
        category: 'English Proficiency',
        label: rule.label || `${targetRank} requires ${rule.requiredLevel} English`,
        rankPair: targetRank,
        requiredValue: requiredIndex,
        actualValue: -2, // -2 indicates "No crew assigned"
        unit: 'proficiency',
        status: 'fail' // Fail because requirement cannot be verified
      });
      continue;
    }
    
    const crewMember = matchingCrew[0];
    const crewLevel = crewMember.languageProficiency || 'Unknown';
    
    const crewIndex = PROFICIENCY_ORDER.findIndex(l => l.toLowerCase() === crewLevel.toLowerCase());
    
    // If crew proficiency is unknown (crewIndex = -1), fail the check
    // Required must be known (requiredIndex >= 0) for a valid check
    const passed = crewIndex >= 0 && requiredIndex >= 0 && crewIndex >= requiredIndex;
    
    results.push({
      category: 'English Proficiency',
      label: rule.label || `${targetRank} requires ${rule.requiredLevel} English`,
      rankPair: targetRank,
      // Use -1 for unknown levels, -2 for no crew assigned
      requiredValue: requiredIndex,
      actualValue: crewIndex,
      unit: 'proficiency',
      status: passed ? 'pass' : 'fail'
    });
  }
  
  return results;
}

// Evaluates conditional rules with "If X then Y" logic
function evaluateConditionalRule(
  rule: ConditionalRule,
  crew: CrewMemberExperience[]
): ComplianceRuleResult {
  // Find matching crew members for target ranks
  const matchingCrew: CrewMemberExperience[] = [];
  for (const targetRank of rule.targetRanks) {
    const crewForRank = findCrewByRank(crew, targetRank);
    matchingCrew.push(...crewForRank);
  }
  
  // Get experience values for matching crew (convert to months if needed)
  const getExperienceInMonths = (crewMember: CrewMemberExperience): number => {
    const category = rule.experienceCategory;
    let value = 0;
    switch (category) {
      case 'yearsWithOperator':
        value = crewMember.yearsWithOperator;
        break;
      case 'yearsInRank':
        value = crewMember.yearsInRank;
        break;
      case 'yearsOnTankerType':
        value = crewMember.yearsOnTankerType;
        break;
      case 'yearsOnAllTankers':
        value = crewMember.yearsOnAllTankers;
        break;
      case 'yearsAsOOW':
        value = crewMember.yearsAsOOW;
        break;
      default:
        value = 0;
    }
    // Convert to months (experience is typically stored in years)
    return value * 12;
  };
  
  const experienceValues = matchingCrew.map(c => getExperienceInMonths(c));
  const officerCount = matchingCrew.length;
  
  // Normalize requiredValue to months for comparison
  const requiredValueInMonths = rule.unit === 'years' ? rule.requiredValue * 12 : rule.requiredValue;
  const thresholdInMonths = rule.thresholdValue 
    ? (rule.unit === 'years' ? rule.thresholdValue * 12 : rule.thresholdValue)
    : 6; // Default 6 months threshold
  
  // Check if condition applies (e.g., "If 3 junior deck officers onboard")
  const conditionCount = rule.conditionCount || officerCount;
  const conditionApplies = officerCount >= conditionCount;
  
  // If condition doesn't apply, rule passes (not applicable)
  if (!conditionApplies) {
    return {
      category: 'Conditional Rule',
      label: rule.label,
      rankPair: rule.targetRanks.join(' + '),
      requiredValue: rule.requiredValue,
      actualValue: officerCount,
      unit: 'conditional',
      status: 'not_applicable'
    };
  }
  
  let passed = false;
  let actualValue = 0;
  
  let displayUnit: 'years' | 'months' | 'officers' = rule.unit === 'years' ? 'years' : 'months';
  
  switch (rule.conditionType) {
    case 'officer_count_aggregate':
      // Sum all experience and check against required (in months internally)
      actualValue = experienceValues.reduce((sum, val) => sum + val, 0);
      passed = actualValue >= requiredValueInMonths;
      // Convert actualValue back to original unit for display
      if (rule.unit === 'years') {
        actualValue = actualValue / 12;
      }
      break;
      
    case 'officer_below_threshold':
      // If one officer is below threshold, another must meet requirement (all in months internally)
      const belowThreshold = experienceValues.filter(v => v < thresholdInMonths);
      const aboveThreshold = experienceValues.filter(v => v >= thresholdInMonths);
      
      if (belowThreshold.length > 0) {
        // Someone is below threshold - check if others meet requirement
        const othersAboveReq = aboveThreshold.filter(v => v >= requiredValueInMonths);
        passed = othersAboveReq.length > 0;
        actualValue = Math.max(...aboveThreshold, 0);
      } else {
        // No one below threshold - rule passes
        passed = true;
        actualValue = Math.min(...experienceValues);
      }
      // Convert actualValue back to original unit for display
      if (rule.unit === 'years') {
        actualValue = actualValue / 12;
      }
      break;
      
    case 'officer_count_minimum':
      // X officers must have at least Y experience (in months internally)
      const minOfficers = rule.minimumOfficersMeetingReq || 2;
      const meetingReq = experienceValues.filter(v => v >= requiredValueInMonths);
      passed = meetingReq.length >= minOfficers;
      actualValue = meetingReq.length;
      displayUnit = 'officers'; // This is a count, not time
      break;
  }
  
  return {
    category: 'Conditional Rule',
    label: rule.label,
    rankPair: rule.targetRanks.join(' + '),
    requiredValue: rule.requiredValue,
    actualValue: Math.round(actualValue * 10) / 10,
    unit: displayUnit,
    status: passed ? 'pass' : 'fail'
  };
}

export function evaluateCompliance(
  oilMajorName: string,
  rulesConfig: OilMajorRulesConfig,
  crew: CrewMemberExperience[]
): ComplianceCheckResult {
  const results: ComplianceRuleResult[] = [];
  
  // Evaluate Years with Operator rules
  if (rulesConfig.experienceRules.yearsWithOperator) {
    for (const rule of rulesConfig.experienceRules.yearsWithOperator) {
      results.push(evaluateExperienceRule(rule, crew, 'yearsWithOperator', 'Years with Operator'));
    }
  }
  
  // Evaluate Years in Rank rules
  if (rulesConfig.experienceRules.yearsInRank) {
    for (const rule of rulesConfig.experienceRules.yearsInRank) {
      results.push(evaluateExperienceRule(rule, crew, 'yearsInRank', 'Years in Rank'));
    }
  }
  
  // Evaluate Years on This Type of Tanker rules
  if (rulesConfig.experienceRules.yearsOnTankerType) {
    for (const rule of rulesConfig.experienceRules.yearsOnTankerType) {
      results.push(evaluateExperienceRule(rule, crew, 'yearsOnTankerType', 'Years on This Type of Tanker'));
    }
  }
  
  // Evaluate Years on All Types of Tankers rules
  if (rulesConfig.experienceRules.yearsOnAllTankers) {
    for (const rule of rulesConfig.experienceRules.yearsOnAllTankers) {
      results.push(evaluateExperienceRule(rule, crew, 'yearsOnAllTankers', 'Years on All Types of Tankers'));
    }
  }
  
  // Evaluate Years as Watch Officer/Engineer rules
  if (rulesConfig.experienceRules.yearsAsOOW) {
    for (const rule of rulesConfig.experienceRules.yearsAsOOW) {
      results.push(evaluateExperienceRule(rule, crew, 'yearsAsOOW', 'Years as Watch Officer/Engineer'));
    }
  }
  
  // Evaluate Date Joined rules
  if (rulesConfig.dateJoinedRules) {
    for (const rule of rulesConfig.dateJoinedRules) {
      results.push(evaluateDateJoinedRule(rule, crew));
    }
  }
  
  // Evaluate English Proficiency rules
  if (rulesConfig.englishProficiencyRules) {
    for (const rule of rulesConfig.englishProficiencyRules) {
      const profResults = evaluateEnglishProficiencyRuleAll(rule, crew);
      results.push(...profResults);
    }
  }
  
  // Evaluate Conditional rules
  if (rulesConfig.conditionalRules) {
    for (const rule of rulesConfig.conditionalRules) {
      results.push(evaluateConditionalRule(rule, crew));
    }
  }
  
  // Calculate summary
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const total = results.length;
  
  // Determine overall status
  let overallStatus: 'green' | 'yellow' | 'red';
  if (failed === 0) {
    overallStatus = 'green';
  } else if (failed <= total * 0.3) {
    overallStatus = 'yellow';
  } else {
    overallStatus = 'red';
  }
  
  return {
    oilMajorName,
    overallStatus,
    results,
    summary: { passed, failed, total }
  };
}

export function convertCrewToExperience(crewMembers: any[]): CrewMemberExperience[] {
  return crewMembers.map(crew => {
    // Parse experience data - could be in different formats depending on source
    const parseYears = (val: any): number => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const num = parseFloat(val.replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };
    
    return {
      rank: crew.rank || crew.presentRank || '',
      yearsWithOperator: parseYears(crew.companyExperience || crew.yearsWithOperator || 0),
      yearsInRank: parseYears(crew.rankExperience || crew.yearsInRank || 0),
      yearsOnTankerType: parseYears(crew.tankerTypeExperience || crew.yearsOnTankerType || 0),
      yearsOnAllTankers: parseYears(crew.allTankersExperience || crew.yearsOnAllTankers || 0),
      yearsAsOOW: parseYears(crew.oowExperience || crew.yearsAsOOW || 0),
      timeOnboardMonths: parseYears(crew.timeOnboard || crew.timeOnboardMonths || 0),
      signOnDate: crew.signOnDate || crew.joinDate || new Date().toISOString(),
      languageProficiency: crew.englishProficiency || crew.languageProficiency || ''
    };
  });
}

export type { CrewMemberExperience, ComplianceCheckResult };
