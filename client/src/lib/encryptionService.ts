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
