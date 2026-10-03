import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getRandomBytesAsync } from "expo-crypto";
import { bytesToHex, hexToBytes } from "@noble/ciphers/utils";
import { deviceSecretStore } from "../auth/secureStore";
import type { OutboxOperation } from "./types";
import { openRecord, sealRecord, SealedRecord } from "./crypto";

type Envelope = { version: 1; records: SealedRecord[] };
const FILE = `${FileSystem.documentDirectory || ""}crew-outbox-v1.json`;
const TEMP = `${FILE}.tmp`;
const BACKUP = `${FILE}.bak`;
const memoryWeb: Envelope = { version: 1, records: [] };

async function key(): Promise<Uint8Array> {
  const existing = await deviceSecretStore.getOutboxKey();
  if (existing) return hexToBytes(existing);
  const created = await getRandomBytesAsync(32);
  await deviceSecretStore.setOutboxKey(bytesToHex(created));
  return created;
}

async function readEnvelope(): Promise<Envelope> {
  if (Platform.OS === "web") return memoryWeb;
  const info = await FileSystem.getInfoAsync(FILE);
  const backup = info.exists ? null : await FileSystem.getInfoAsync(BACKUP);
  if (!info.exists && !backup?.exists) return { version: 1, records: [] };
  const parsed = JSON.parse(await FileSystem.readAsStringAsync(info.exists ? FILE : BACKUP));
  if (parsed?.version !== 1 || !Array.isArray(parsed.records)) throw new Error("The secure outbox is unreadable.");
  return parsed;
}

async function writeEnvelope(value: Envelope): Promise<void> {
  if (Platform.OS === "web") { memoryWeb.records = value.records; return; }
  await FileSystem.writeAsStringAsync(TEMP, JSON.stringify(value));
  const old = await FileSystem.getInfoAsync(FILE);
  if (old.exists) {
    await FileSystem.deleteAsync(BACKUP, { idempotent: true });
    await FileSystem.moveAsync({ from: FILE, to: BACKUP });
  }
  await FileSystem.moveAsync({ from: TEMP, to: FILE });
  await FileSystem.deleteAsync(BACKUP, { idempotent: true });
}

export const encryptedOutboxStore = {
  async load(): Promise<OutboxOperation[]> {
    const [envelope, secret] = await Promise.all([readEnvelope(), key()]);
    return envelope.records.map((record) => {
      try {
        return openRecord<OutboxOperation>(secret, record);
      } catch {
        throw new Error("The secure outbox failed authentication and will not be processed.");
      }
    });
  },
  async save(items: OutboxOperation[]): Promise<void> {
    const secret = await key();
    const records = await Promise.all(items.map(async (item) => {
      const nonce = await getRandomBytesAsync(12);
      return sealRecord(secret, nonce, item.localId, item);
    }));
    await writeEnvelope({ version: 1, records });
  },
};
