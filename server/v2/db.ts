import { storage } from "../storage";

export function getDb() {
  if (storage && typeof (storage as any).getDb === "function") {
    return (storage as any).getDb();
  }
  throw new Error("Database not available. Storage must be DatabaseStorage.");
}
