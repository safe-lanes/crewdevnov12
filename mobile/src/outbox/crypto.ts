import { gcm } from "@noble/ciphers/aes";
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from "@noble/ciphers/utils";

export type SealedRecord = { id: string; nonce: string; ciphertext: string };

export function sealRecord(key: Uint8Array, nonce: Uint8Array, id: string, value: unknown): SealedRecord {
  return {
    id,
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(gcm(key, nonce, utf8ToBytes(id)).encrypt(utf8ToBytes(JSON.stringify(value)))),
  };
}

export function openRecord<T>(key: Uint8Array, record: SealedRecord): T {
  return JSON.parse(bytesToUtf8(gcm(key, hexToBytes(record.nonce), utf8ToBytes(record.id)).decrypt(hexToBytes(record.ciphertext))));
}
