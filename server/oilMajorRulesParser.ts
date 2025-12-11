import fs from 'fs';
import path from 'path';
import type { OilMajorRulesConfig, RankPairRule, DateJoinedRule, LanguageRule } from '@shared/schema';

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
  languageValue: string;
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

function parseLanguageRules(languageStr: string): LanguageRule[] {
  if (!languageStr || languageStr.trim() === '') return [];
  
  const rules: LanguageRule[] = [];
  const lines = languageStr.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const match = line.match(/^([^=]+)=?\s*(Good|Fair|Excellent|Native|Poor)?/i);
    if (match) {
      const rank = match[1].replace(/[=:]/g, '').trim();
      const level = match[2] || 'Good';
      if (rank) {
        rules.push({ rank, requiredLevel: level });
      }
    }
  }
  
  return rules;
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

export function parseCSVContent(csvContent: string): Map<string, OilMajorRulesConfig> {
  const lines = csvContent.split('\n');
  const oilMajorRules = new Map<string, OilMajorRulesConfig>();
  let skippedRows = 0;
  
  // Skip header rows (first 2 rows)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    
    const columns = parseCSVLine(line);
    if (columns.length < 2) continue;
    
    const oilMajor = columns[0]?.trim();
    if (!oilMajor || oilMajor === '') continue;
    
    // Primary validation: Check if this is a known oil major
    const isKnownMajor = KNOWN_OIL_MAJORS.has(oilMajor);
    
    // Secondary validation: Check if name passes heuristic validation
    const passesHeuristic = isValidOilMajorName(oilMajor);
    
    // Structural validation: Check if row has valid rank data in expected columns
    const hasValidStructure = isValidDataRow(columns);
    
    // Accept row if: (known OR passes heuristic) AND has valid structure
    if (!((isKnownMajor || passesHeuristic) && hasValidStructure)) {
      skippedRows++;
      console.log(`[CSV Parser] Skipped row ${i + 1}: "${oilMajor.substring(0, 40)}..." (known: ${isKnownMajor}, heuristic: ${passesHeuristic}, structure: ${hasValidStructure})`);
      continue;
    }
    
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
        languageRules: []
      };
      oilMajorRules.set(oilMajor, config);
    }
    
    // Parse Years with Operator (columns 1, 2, 3)
    const ywOperatorRule = createRankPairRule(columns[1] || '', columns[2] || '', columns[3] || '');
    if (ywOperatorRule) {
      config.experienceRules.yearsWithOperator = config.experienceRules.yearsWithOperator || [];
      config.experienceRules.yearsWithOperator.push(ywOperatorRule);
    }
    
    // Parse Years in Rank (columns 4, 5, 6)
    const yrRule = createRankPairRule(columns[4] || '', columns[5] || '', columns[6] || '');
    if (yrRule) {
      config.experienceRules.yearsInRank = config.experienceRules.yearsInRank || [];
      config.experienceRules.yearsInRank.push(yrRule);
    }
    
    // Parse Years on This Type of Tanker (columns 7, 8, 9)
    const ytRule = createRankPairRule(columns[7] || '', columns[8] || '', columns[9] || '');
    if (ytRule) {
      config.experienceRules.yearsOnTankerType = config.experienceRules.yearsOnTankerType || [];
      config.experienceRules.yearsOnTankerType.push(ytRule);
    }
    
    // Parse Years on All Types of Tankers (columns 10, 11, 12)
    const yaRule = createRankPairRule(columns[10] || '', columns[11] || '', columns[12] || '');
    if (yaRule) {
      config.experienceRules.yearsOnAllTankers = config.experienceRules.yearsOnAllTankers || [];
      config.experienceRules.yearsOnAllTankers.push(yaRule);
    }
    
    // Parse Years as Watch Officer/Engineer (columns 13, 14, 15)
    const oowRule = createRankPairRule(columns[13] || '', columns[14] || '', columns[15] || '');
    if (oowRule) {
      config.experienceRules.yearsAsOOW = config.experienceRules.yearsAsOOW || [];
      config.experienceRules.yearsAsOOW.push(oowRule);
    }
    
    // Parse Date Joined (columns 16, 17, 18)
    const djRule = createDateJoinedRule(columns[16] || '', columns[17] || '', columns[18] || '');
    if (djRule) {
      config.dateJoinedRules = config.dateJoinedRules || [];
      config.dateJoinedRules.push(djRule);
    }
    
    // Parse Language (column 19)
    const langRules = parseLanguageRules(columns[19] || '');
    if (langRules.length > 0) {
      config.languageRules = config.languageRules || [];
      config.languageRules.push(...langRules);
    }
  }
  
  return oilMajorRules;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
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
