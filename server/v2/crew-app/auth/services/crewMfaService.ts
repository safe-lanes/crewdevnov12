import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";
import * as OTPAuth from "otpauth";
import type { AppCrewCredential } from "../../../../../shared/v2/crew-app/types";
import { CrewCredentialsRepository } from "../repositories";

const credentials = new CrewCredentialsRepository();

function encryptionKey(): Buffer {
  const raw = process.env.CREW_APP_MFA_ENCRYPTION_KEY;
  if (!raw) throw new Error("MFA configuration unavailable");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("MFA configuration unavailable");
  return key;
}

function encrypt(secret: string): { ciphertext: string; nonce: string } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64"), nonce: nonce.toString("base64") };
}

function decrypt(ciphertext: string, nonce: string): string {
  const payload = Buffer.from(ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(nonce, "base64"));
  decipher.setAuthTag(payload.subarray(payload.length - 16));
  return Buffer.concat([decipher.update(payload.subarray(0, -16)), decipher.final()]).toString("utf8");
}

function hashRecoveryCode(code: string): string {
  return createHmac("sha256", encryptionKey()).update(code.replace(/\s|-/g, "").toUpperCase()).digest("hex");
}

function totp(secret: string, account: string, issuer = "SAIL Crew") {
  return new OTPAuth.TOTP({ issuer, label: account, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
}

export const crewMfaService = {
  async begin(credential: AppCrewCredential) {
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const sealed = encrypt(secret);
    await credentials.stageMfaSecret(credential.id, sealed.ciphertext, sealed.nonce);
    const account = credential.email || credential.empNo || credential.crewUuid;
    return { secret, uri: totp(secret, account).toString() };
  },

  async confirm(credential: AppCrewCredential, code: string) {
    if (!credential.mfaSecretCiphertext || !credential.mfaSecretNonce) throw new Error("MFA enrollment not started");
    const secret = decrypt(credential.mfaSecretCiphertext, credential.mfaSecretNonce);
    if (totp(secret, credential.email || credential.empNo || credential.crewUuid).validate({ token: code, window: 1 }) === null) {
      throw new Error("Invalid MFA code");
    }
    const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(6).toString("hex").toUpperCase());
    await credentials.enableMfa(credential.id, recoveryCodes.map(hashRecoveryCode));
    return recoveryCodes;
  },

  async verify(credential: AppCrewCredential, code: string): Promise<boolean> {
    if (!credential.mfaSecretCiphertext || !credential.mfaSecretNonce) return false;
    const secret = decrypt(credential.mfaSecretCiphertext, credential.mfaSecretNonce);
    if (totp(secret, credential.email || credential.empNo || credential.crewUuid).validate({ token: code.replace(/\s/g, ""), window: 1 }) !== null) return true;
    const currentJson = credential.mfaRecoveryCodeHashes || "[]";
    let hashes: string[] = [];
    try { hashes = JSON.parse(currentJson); } catch { return false; }
    const candidate = Buffer.from(hashRecoveryCode(code), "hex");
    const index = hashes.findIndex((hash) => {
      const stored = Buffer.from(hash, "hex");
      return stored.length === candidate.length && timingSafeEqual(stored, candidate);
    });
    if (index < 0) return false;
    return credentials.consumeRecoveryCode(credential.id, currentJson, hashes.filter((_, i) => i !== index));
  },
};
