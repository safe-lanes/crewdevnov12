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

export function parseCSVContent(csvContent: string): Map<string, OilMajorRulesConfig> {
  const lines = csvContent.split('\n');
  const oilMajorRules = new Map<string, OilMajorRulesConfig>();
  
  // Skip header rows (first 2 rows)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    
    const columns = parseCSVLine(line);
    if (columns.length < 2) continue;
    
    const oilMajor = columns[0]?.trim();
    if (!oilMajor || oilMajor === '') continue;
    
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
  
  for (const [name, config] of oilMajorRules.entries()) {
    result.push({
      oilMajorName: name,
      rules: JSON.stringify(config),
      isActive: true
    });
  }
  
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
