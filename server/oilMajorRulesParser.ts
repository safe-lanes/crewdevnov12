import fs from 'fs';
import path from 'path';
import type { OilMajorRulesConfig, RankPairRule, DateJoinedRule, EnglishProficiencyRule, ConditionalRule } from '@shared/schema';

interface ParsedCSVRow {
  oilMajor: string;
  yearsWithOperatorLabel: string;
  yearsWithOperatorRankPair: string;
  yearsWithOperatorValue: string;
  yearsInRankLabel: string;
  yearsInRankRankPair: string;
  yearsInRankValue: string;
  yearsOnTankerTypeLabel: string;
  yearsOnTankerTypeRankPair: string;
  yearsOnTankerTypeValue: string;
  yearsOnAllTankersLabel: string;
  yearsOnAllTankersRankPair: string;
  yearsOnAllTankersValue: string;
  yearsAsOOWLabel: string;
  yearsAsOOWRankPair: string;
  yearsAsOOWValue: string;
  dateJoinedLabel: string;
  dateJoinedRankPair: string;
  dateJoinedValue: string;
  englishProficiencyLabel: string;
  englishProficiencyOfficer: string;
  englishProficiencyValue: string;
}

function parseValue(valueStr: string): number {
  if (!valueStr || valueStr.trim() === '') return 0;
  const cleaned = valueStr.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDaysValue(valueStr: string): number {
  if (!valueStr || valueStr.trim() === '') return 0;
  const cleaned = valueStr.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeRankPair(rankPairStr: string): string {
  if (!rankPairStr) return '';
  return rankPairStr
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\*/, '')
    .trim();
}

function createEnglishProficiencyRule(label: string, officer: string, value: string): EnglishProficiencyRule | null {
  // Need at least officer and value for a valid rule
  const normalizedOfficer = officer?.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() || '';
  const normalizedValue = value?.trim() || '';
  const normalizedLabel = label?.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() || '';
  
  if (!normalizedOfficer || !normalizedValue) return null;
  
  return {
    label: normalizedLabel,
    rankPair: normalizedOfficer,
    requiredLevel: normalizedValue
  };
}

function createRankPairRule(label: string, rankPair: string, value: string): RankPairRule | null {
  if (!rankPair || rankPair.trim() === '') return null;
  const numValue = parseValue(value);
  if (numValue === 0 && !label.trim()) return null;
  
  return {
    label: label.trim(),
    rankPair: normalizeRankPair(rankPair),
    requiredValue: numValue,
    unit: 'years'
  };
}

function createDateJoinedRule(label: string, rankPair: string, value: string): DateJoinedRule | null {
  if (!rankPair || rankPair.trim() === '') return null;
  const numValue = parseDaysValue(value);
  if (numValue === 0 && !label.trim()) return null;
  
  return {
    label: label.trim(),
    rankPair: normalizeRankPair(rankPair),
    requiredDays: numValue
  };
}

// Junior deck officers are Second Officer and Third Officer
const JUNIOR_DECK_OFFICERS = ['Second Officer', 'Third Officer'];
// Junior engineer officers are Third Engineer and Fourth Engineer  
const JUNIOR_ENGINEER_OFFICERS = ['Third Engineer', 'Fourth Engineer'];
// All deck officers (for reference)
const ALL_DECK_OFFICERS = ['Master', 'Chief Officer', 'Second Officer', 'Third Officer'];
// All engineer officers (for reference)
const ALL_ENGINEER_OFFICERS = ['Chief Engineer', 'Second Engineer', 'Third Engineer', 'Fourth Engineer'];

function isConditionalRule(label: string, rankPair: string): boolean {
  const combinedText = `${label} ${rankPair}`.toLowerCase();
  return combinedText.includes('if ') && (
    combinedText.includes('onboard') ||
    combinedText.includes('officers') ||
    combinedText.includes('below') ||
    combinedText.includes('less than')
  );
}

function parseConditionalRule(label: string, rankPair: string, value: string): ConditionalRule | null {
  const combinedText = `${label} ${rankPair}`.toLowerCase();
  const fullLabel = `${label} ${rankPair}`.replace(/\s+/g, ' ').trim();
  
  if (!isConditionalRule(label, rankPair)) return null;
  
  // Parse the numeric value (could be months or years)
  const numValue = parseValue(value);
  
  // Determine target ranks
  let targetRanks: string[] = [];
  if (combinedText.includes('junior deck') || combinedText.includes('2/o') || combinedText.includes('3/o')) {
    targetRanks = [...JUNIOR_DECK_OFFICERS];
  } else if (combinedText.includes('junior eng') || combinedText.includes('3/e') || combinedText.includes('4/e')) {
    targetRanks = [...JUNIOR_ENGINEER_OFFICERS];
  } else if (combinedText.includes('deck officer')) {
    targetRanks = [...ALL_DECK_OFFICERS];
  } else if (combinedText.includes('eng officer') || combinedText.includes('engineer officer')) {
    targetRanks = [...ALL_ENGINEER_OFFICERS];
  }
  
  // Determine experience category
  let experienceCategory = 'yearsAsOOW'; // Default
  if (combinedText.includes('as oow') || combinedText.includes('as eoow')) {
    experienceCategory = 'yearsAsOOW';
  } else if (combinedText.includes('in rank')) {
    experienceCategory = 'yearsInRank';
  } else if (combinedText.includes('with company') || combinedText.includes('with operator')) {
    experienceCategory = 'yearsWithOperator';
  } else if (combinedText.includes('tanker type') || combinedText.includes('this type')) {
    experienceCategory = 'yearsOnTankerType';
  } else if (combinedText.includes('all tanker') || combinedText.includes('all type')) {
    experienceCategory = 'yearsOnAllTankers';
  }
  
  // Determine unit (months vs years)
  let unit: 'months' | 'years' = 'months';
  if (combinedText.includes('year')) {
    unit = 'years';
  }
  
  // Extract officer count from patterns like "If 3 junior deck officers" or "If 2 junior"
  let conditionCount: number | undefined;
  const countMatch = combinedText.match(/if\s+(\d+)\s+(junior|deck|eng)/i);
  if (countMatch) {
    conditionCount = parseInt(countMatch[1], 10);
  }
  
  // Determine condition type based on patterns
  let conditionType: 'officer_count_aggregate' | 'officer_below_threshold' | 'officer_count_minimum' = 'officer_count_aggregate';
  let thresholdValue: number | undefined;
  let minimumOfficersMeetingReq: number | undefined;
  
  // Pattern: "If one of the X officers is below Y months"
  if (combinedText.includes('one of') && (combinedText.includes('below') || combinedText.includes('less than'))) {
    conditionType = 'officer_below_threshold';
    const thresholdMatch = combinedText.match(/below\s+(\d+)\s*month/i) || combinedText.match(/less than\s+(\d+)\s*month/i);
    if (thresholdMatch) {
      thresholdValue = parseInt(thresholdMatch[1], 10);
    }
  }
  // Pattern: "X of the officers must have at least Y months"
  else if (combinedText.includes('must have at least') || combinedText.includes('should have')) {
    conditionType = 'officer_count_minimum';
    const minOfficersMatch = combinedText.match(/(\d+)\s+of\s+(the\s+)?officers/i);
    if (minOfficersMatch) {
      minimumOfficersMeetingReq = parseInt(minOfficersMatch[1], 10);
    }
  }
  // Pattern: "aggregated experience" or "combined" 
  else if (combinedText.includes('aggregat') || combinedText.includes('combin') || combinedText.includes('total')) {
    conditionType = 'officer_count_aggregate';
  }
  
  // Only create rule if we have enough information
  if (targetRanks.length === 0 && !conditionCount) {
    return null;
  }
  
  return {
    label: fullLabel,
    conditionType,
    targetRanks,
    conditionCount,
    experienceCategory,
    requiredValue: numValue,
    unit,
    thresholdValue,
    minimumOfficersMeetingReq
  };
}

/**
 * Validates that a string is a valid oil major company name, not requirement text.
 * Uses multiple heuristics to detect requirement sentences masquerading as company names.
 */
function isValidOilMajorName(name: string): boolean {
  if (!name || name.trim() === '') return false;
  
  const lowerName = name.toLowerCase();
  
  // Reject if name is too long (company names are typically short)
  if (name.length > 50) return false;
  
  // Reject if contains common requirement phrase patterns (specific to avoid false positives)
  const requirementPhrases = [
    'experience as', 'months as', 'officer has', 'officer must', 'must have at least',
    'should not be', 'less than', 'at least', 'years as', 'years in', 'years on',
    'below', 'onboard', 'junior officer', 'junior deck', 'junior eng',
    'deck officer', 'eng officer', 'as oow', 'as eoow', 'required to', 'minimum of'
  ];
  if (requirementPhrases.some(phrase => lowerName.includes(phrase))) return false;
  
  // Reject if contains numeric values with context words (e.g., "6 months", "2 years")
  if (/\d+\s*(months?|years?|days?)/.test(lowerName)) return false;
  
  // Reject if it looks like a sentence (has multiple spaces and common verbs)
  const sentencePatterns = ['has ', 'have ', 'is ', 'are ', 'to be', 'not be', 'should', 'if '];
  if (sentencePatterns.some(pattern => lowerName.includes(pattern))) return false;
  
  // Reject if it contains commas followed by "if" (common in conditional requirements)
  if (/,\s*if\s/i.test(name)) return false;
  
  // Accept if it matches typical company name patterns
  // (alphanumeric, spaces, common punctuation like parentheses, ampersands, periods)
  const validCompanyNamePattern = /^[A-Za-z0-9\s\-&'.()/<>]+$/;
  return validCompanyNamePattern.test(name);
}

// Known valid oil major names (built dynamically from successful imports)
const KNOWN_OIL_MAJORS = new Set([
  'Adnoc', 'Ampol', 'ATCQAG', 'BASF', 'BHP Billiton Petroleum', 'BP', 'Borealis Polymers',
  'Cepsa', 'Cheniere', 'Chevron', 'Citgo', 'ConocoPhillips', 'ENEL', 'ENI', 'Equinor',
  'ExxonMobil (Spot)', 'ExxonMobil (T/C)', 'ExxonMobil (Spot - 3 Engr)', 'ExxonMobil (T/C - 3 Engr)',
  'Gazprom', 'Hoegh LNG', 'Idemitsu', 'Ineos', 'KPI', 'Koch', 'LUKOIL',
  'Lyondellbasell (<20k dwt)', 'Lyondellbasell (>20k dwt)', 'MISC Maritime Services', 'Marathon',
  'NCSP Group', 'Neste', 'Nustar', 'OMV', 'OTEKO Terminal', 'PETROBRAS', 'PMI', 'PTT Marine',
  'Petroplus', 'Phillips 66', 'Preem', 'Primorsk Oil Terminal', 'Qatar Gas', 'Qatar Petroleum',
  'Reliance', 'Repsol (Spot/COA)', 'Repsol (T/C)', 'Rightship', 'SABIC', 'SARAS', 'SHELL',
  'SHIPVET Services Ltd', 'SIGGTO LPG', 'SIGTTO LNG and LPG', 'Sonangol', 'TOTAL (Spot)', 'TOTAL (T/C)',
  'Tesoro', 'The Company (Internal)', 'Tonengeneral Sekiyu K.K', 'Turpas', 'YPF', 'Yara'
]);

/**
 * Validates a row structurally - checks that the pattern matches expected CSV format:
 * Column 0: Company name, Columns 1-18: Rule data (labels, rank pairs, values)
 */
function isValidDataRow(columns: string[]): boolean {
  if (columns.length < 4) return false;
  
  // A valid data row should have at least one rank pair in columns 2, 5, 8, 11, 14, or 17
  // These columns contain rank designations like "Master", "Chief Officer", "Master + Chief Officer"
  const rankColumns = [2, 5, 8, 11, 14, 17];
  const rankPatterns = /^(master|chief|second|third|fourth|officer|engineer|2\/o|3\/o|c\/o|c\/e|2\/e|3\/e|4\/e|e\/o|eto|\+)/i;
  
  for (const idx of rankColumns) {
    const col = columns[idx]?.trim() || '';
    if (col && rankPatterns.test(col)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Parse CSV content handling multi-line quoted fields properly.
 * This splits on newlines but merges lines that are inside quoted fields.
 */
function parseCSVRows(csvContent: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentCell += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // End of row (not inside quotes)
      currentRow.push(currentCell);
      if (currentRow.some(cell => cell.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      if (char === '\r') i++; // Skip \n after \r
    } else if (char === '\r' && !inQuotes) {
      // Standalone \r as line break
      currentRow.push(currentCell);
      if (currentRow.some(cell => cell.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  
  // Handle last row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some(cell => cell.trim() !== '')) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

export function parseCSVContent(csvContent: string): Map<string, OilMajorRulesConfig> {
  const rows = parseCSVRows(csvContent);
  const oilMajorRules = new Map<string, OilMajorRulesConfig>();
  let skippedRows = 0;
  let acceptedRows = 0;
  
  // Skip header rows (first 2 rows)
  for (let i = 2; i < rows.length; i++) {
    const columns = rows[i];
    if (!columns || columns.length < 2) continue;
    
    // Normalize oil major name: replace embedded newlines/carriage returns with space
    const oilMajor = columns[0]?.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!oilMajor || oilMajor === '') continue;
    
    // Primary validation: Check if this is a known oil major
    const isKnownMajor = KNOWN_OIL_MAJORS.has(oilMajor);
    
    // Secondary validation: Check if name passes heuristic validation  
    const passesHeuristic = isValidOilMajorName(oilMajor);
    
    // Accept row if: known OR passes heuristic (removed overly strict structural validation)
    if (!(isKnownMajor || passesHeuristic)) {
      skippedRows++;
      console.log(`[CSV Parser] Skipped row ${i + 1}: "${oilMajor.substring(0, 40)}..." (known: ${isKnownMajor}, heuristic: ${passesHeuristic})`);
      continue;
    }
    
    acceptedRows++;
    
    // Get or create the config for this oil major
    let config = oilMajorRules.get(oilMajor);
    if (!config) {
      config = {
        experienceRules: {
          yearsWithOperator: [],
          yearsInRank: [],
          yearsOnTankerType: [],
          yearsOnAllTankers: [],
          yearsAsOOW: []
        },
        dateJoinedRules: [],
        englishProficiencyRules: [],
        conditionalRules: []
      };
      oilMajorRules.set(oilMajor, config);
    }
    
    // Helper function to check if a rule is conditional and parse accordingly
    const tryParseConditional = (label: string, rankPair: string, value: string): boolean => {
      if (isConditionalRule(label, rankPair)) {
        const conditionalRule = parseConditionalRule(label, rankPair, value);
        if (conditionalRule) {
          config!.conditionalRules = config!.conditionalRules || [];
          config!.conditionalRules.push(conditionalRule);
          return true;
        }
      }
      return false;
    };
    
    // Parse Years with Operator (columns 1, 2, 3)
    if (!tryParseConditional(columns[1] || '', columns[2] || '', columns[3] || '')) {
      const ywOperatorRule = createRankPairRule(columns[1] || '', columns[2] || '', columns[3] || '');
      if (ywOperatorRule) {
        config.experienceRules.yearsWithOperator = config.experienceRules.yearsWithOperator || [];
        config.experienceRules.yearsWithOperator.push(ywOperatorRule);
      }
    }
    
    // Parse Years in Rank (columns 4, 5, 6)
    if (!tryParseConditional(columns[4] || '', columns[5] || '', columns[6] || '')) {
      const yrRule = createRankPairRule(columns[4] || '', columns[5] || '', columns[6] || '');
      if (yrRule) {
        config.experienceRules.yearsInRank = config.experienceRules.yearsInRank || [];
        config.experienceRules.yearsInRank.push(yrRule);
      }
    }
    
    // Parse Years on This Type of Tanker (columns 7, 8, 9)
    if (!tryParseConditional(columns[7] || '', columns[8] || '', columns[9] || '')) {
      const ytRule = createRankPairRule(columns[7] || '', columns[8] || '', columns[9] || '');
      if (ytRule) {
        config.experienceRules.yearsOnTankerType = config.experienceRules.yearsOnTankerType || [];
        config.experienceRules.yearsOnTankerType.push(ytRule);
      }
    }
    
    // Parse Years on All Types of Tankers (columns 10, 11, 12)
    if (!tryParseConditional(columns[10] || '', columns[11] || '', columns[12] || '')) {
      const yaRule = createRankPairRule(columns[10] || '', columns[11] || '', columns[12] || '');
      if (yaRule) {
        config.experienceRules.yearsOnAllTankers = config.experienceRules.yearsOnAllTankers || [];
        config.experienceRules.yearsOnAllTankers.push(yaRule);
      }
    }
    
    // Parse Years as Watch Officer/Engineer (columns 13, 14, 15)
    if (!tryParseConditional(columns[13] || '', columns[14] || '', columns[15] || '')) {
      const oowRule = createRankPairRule(columns[13] || '', columns[14] || '', columns[15] || '');
      if (oowRule) {
        config.experienceRules.yearsAsOOW = config.experienceRules.yearsAsOOW || [];
        config.experienceRules.yearsAsOOW.push(oowRule);
      }
    }
    
    // Parse Date Joined (columns 16, 17, 18)
    if (!tryParseConditional(columns[16] || '', columns[17] || '', columns[18] || '')) {
      const djRule = createDateJoinedRule(columns[16] || '', columns[17] || '', columns[18] || '');
      if (djRule) {
        config.dateJoinedRules = config.dateJoinedRules || [];
        config.dateJoinedRules.push(djRule);
      }
    }
    
    // Parse English Proficiency (columns 19, 20, 21)
    if (!tryParseConditional(columns[19] || '', columns[20] || '', columns[21] || '')) {
      const epRule = createEnglishProficiencyRule(columns[19] || '', columns[20] || '', columns[21] || '');
      if (epRule) {
        config.englishProficiencyRules = config.englishProficiencyRules || [];
        config.englishProficiencyRules.push(epRule);
      }
    }
  }
  
  console.log(`[CSV Parser] Completed: ${acceptedRows} rows accepted, ${skippedRows} rows skipped, ${oilMajorRules.size} oil majors found`);
  return oilMajorRules;
}

export function parseCSVFile(filePath: string): Map<string, OilMajorRulesConfig> {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseCSVContent(content);
}

export function convertToStorageFormat(oilMajorRules: Map<string, OilMajorRulesConfig>): Array<{ oilMajorName: string; rules: string; isActive: boolean }> {
  const result: Array<{ oilMajorName: string; rules: string; isActive: boolean }> = [];
  
  oilMajorRules.forEach((config, name) => {
    result.push({
      oilMajorName: name,
      rules: JSON.stringify(config),
      isActive: true
    });
  });
  
  return result;
}

export async function parseAndImportCSV(csvFilePath: string, storage: any): Promise<number> {
  const parsedRules = parseCSVFile(csvFilePath);
  const storageFormat = convertToStorageFormat(parsedRules);
  
  let imported = 0;
  for (const rule of storageFormat) {
    await storage.createOilMajorRule(rule);
    imported++;
  }
  
  return imported;
}
