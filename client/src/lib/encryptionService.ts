import CryptoJS from 'crypto-js';

const secretKey: string = import.meta.env.VITE_CLIENT_ENCRYPTION_KEY || '';

function isObservationEncrypted(data: string): boolean {
  try {
    const parsed = CryptoJS.enc.Base64.parse(data);
    return parsed.sigBytes > 0;
  } catch {
    return false;
  }
}

export function decryptData(encryptedData: string | null, isParse = false): any {
  try {
    if (!encryptedData || !secretKey) return null;

    if (!isObservationEncrypted(encryptedData)) {
      return null;
    }

    const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
    const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedString) return null;

    const decryptedData = JSON.parse(decryptedString);

    if (isParse) {
      return decryptedData;
    } else {
      return JSON.stringify(decryptedData);
    }
  } catch (error: any) {
    console.error('Decryption error:', error?.message);

    if (error?.message?.includes('Malformed UTF-8 data')) {
      console.warn('Malformed UTF-8 data encountered for encrypted value');
      return null;
    }

    if (error?.message?.includes('Unexpected end of JSON input') || error?.message?.includes('Unterminated string')) {
      try {
        return CryptoJS.AES.decrypt(encryptedData!, secretKey).toString(
          CryptoJS.enc.Utf8
        );
      } catch {
        return null;
      }
    }

    return null;
  }
}

export function encryptData(data: any): string | null {
  try {
    if (!secretKey) return null;
    const stringified = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(stringified, secretKey).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

export function secretKeyAvailable(): boolean {
  return !!secretKey;
}

export function getDecryptedRawString(key: string): string | null {
  try {
    const encrypted = localStorage.getItem(key);
    if (!encrypted || !secretKey) return null;
    const decryptedBytes = CryptoJS.AES.decrypt(encrypted, secretKey);
    let result: string | null = null;
    try {
      result = decryptedBytes.toString(CryptoJS.enc.Utf8);
    } catch {
      try {
        result = decryptedBytes.toString(CryptoJS.enc.Latin1);
      } catch { /* both failed */ }
    }
    return result || null;
  } catch {
    return null;
  }
}

export interface ExtractedUserProfile {
  role?: string;
  roleId?: string;
  userId?: string;
  myVessels?: Array<{ vessel: string; vesselId: string; imoNumber: string }>;
}

function tryRepairAndParse(jsonStr: string): any {
  const openBraces = (jsonStr.match(/{/g) || []).length;
  const closeBraces = (jsonStr.match(/}/g) || []).length;
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/\]/g) || []).length;

  let repaired = jsonStr.trimEnd();

  if (repaired.endsWith(',')) repaired = repaired.slice(0, -1);

  const lastChar = repaired[repaired.length - 1];
  if (lastChar !== '"' && lastChar !== '}' && lastChar !== ']' && lastChar !== 'l' && lastChar !== 'e' && lastChar !== '0' && lastChar !== '1' && lastChar !== '2' && lastChar !== '3' && lastChar !== '4' && lastChar !== '5' && lastChar !== '6' && lastChar !== '7' && lastChar !== '8' && lastChar !== '9') {
    const lastQuote = repaired.lastIndexOf('"');
    if (lastQuote > 0) {
      repaired = repaired.substring(0, lastQuote + 1);
    }
  }

  if (repaired.endsWith(',')) repaired = repaired.slice(0, -1);

  const missingBrackets = openBrackets - closeBrackets;
  const missingBraces = openBraces - closeBraces;

  for (let i = 0; i < missingBrackets; i++) repaired += ']';
  for (let i = 0; i < missingBraces; i++) repaired += '}';

  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

function extractStringField(jsonStr: string, fieldName: string): string | undefined {
  const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'i');
  const match = jsonStr.match(regex);
  return match ? match[1].replace(/\\"/g, '"') : undefined;
}

function extractVesselsFromString(jsonStr: string): Array<{ vessel: string; vesselId: string; imoNumber: string }> {
  const vessels: Array<{ vessel: string; vesselId: string; imoNumber: string }> = [];
  const vesselStart = jsonStr.indexOf('"myVessels"');
  if (vesselStart === -1) return vessels;

  const arrayStr = jsonStr.substring(vesselStart);
  const objectRegex = /\{[^{}]*"vesselId"\s*:\s*"[^"]*"[^{}]*\}/g;
  let match;
  while ((match = objectRegex.exec(arrayStr)) !== null) {
    const obj = match[0];
    const vesselName = obj.match(/"vessel"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    const vesselId = obj.match(/"vesselId"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    const imoNumber = obj.match(/"imoNumber"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (vesselId) {
      vessels.push({
        vessel: vesselName ? vesselName[1] : '',
        vesselId: vesselId[1],
        imoNumber: imoNumber ? imoNumber[1] : '',
      });
    }
  }

  return vessels;
}

export function safeExtractFields(rawValue: any): ExtractedUserProfile | null {
  if (!rawValue) return null;

  const resolved = deepParseJson(rawValue);
  if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
    const result: ExtractedUserProfile = {};
    if (resolved.role) result.role = String(resolved.role);
    if (resolved.roleName && !result.role) result.role = String(resolved.roleName);
    if (resolved.roleId) result.roleId = String(resolved.roleId);
    if (resolved.userId) result.userId = String(resolved.userId);
    if (Array.isArray(resolved.myVessels)) result.myVessels = resolved.myVessels;
    if (result.role || result.roleId) return result;
  }

  const str = typeof rawValue === 'string' ? rawValue : String(rawValue);

  const repaired = tryRepairAndParse(str);
  if (repaired && typeof repaired === 'object') {
    const result: ExtractedUserProfile = {};
    if (repaired.role) result.role = String(repaired.role);
    if (repaired.roleName && !result.role) result.role = String(repaired.roleName);
    if (repaired.roleId) result.roleId = String(repaired.roleId);
    if (repaired.userId) result.userId = String(repaired.userId);
    if (Array.isArray(repaired.myVessels)) result.myVessels = repaired.myVessels;
    if (result.role || result.roleId || result.userId || (result.myVessels && result.myVessels.length > 0)) return result;
  }

  const result: ExtractedUserProfile = {};
  result.role = extractStringField(str, 'role') || extractStringField(str, 'roleName');
  result.roleId = extractStringField(str, 'roleId');
  result.userId = extractStringField(str, 'userId');
  result.myVessels = extractVesselsFromString(str);

  if (result.role || result.roleId || result.userId || (result.myVessels && result.myVessels.length > 0)) return result;
  return null;
}

export function deepParseJson(value: any, maxDepth = 3): any {
  if (maxDepth <= 0 || value === null || value === undefined) return value;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return deepParseJson(parsed, maxDepth - 1);
    } catch {
      return value;
    }
  }
  return value;
}

export function getDecryptedLocalStorageItem(key: string, isParse = false): any {
  const encrypted = localStorage.getItem(key);
  if (!encrypted) return null;
  return decryptData(encrypted, isParse);
}

export function getDecryptedSessionStorageItem(key: string, isParse = false): any {
  const encrypted = sessionStorage.getItem(key);
  if (!encrypted) return null;
  return decryptData(encrypted, isParse);
}
