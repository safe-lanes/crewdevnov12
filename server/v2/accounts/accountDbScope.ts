import { AsyncLocalStorage } from "node:async_hooks";

export type AccountLockMode = "shared" | "exclusive";
export interface AccountDbScope {
  baseDb: any;
  db: any;
  mode: AccountLockMode;
  lifecycle: { active: boolean };
}
export const accountDbScope = new AsyncLocalStorage<AccountDbScope>();

export function scopedAccountDb(baseDb: any) {
  const scope = accountDbScope.getStore();
  if (!scope) return baseDb;
  if (!scope.lifecycle.active) throw new Error("Accounts database scope has ended");
  if (scope.baseDb !== baseDb) throw new Error("Tenant database changed during Accounts operation");
  return scope.db;
}

export async function withAccountDb<T>(db: any, work: () => Promise<T>): Promise<T> {
  const parent = accountDbScope.getStore();
  if (!parent || !parent.lifecycle.active) throw new Error("Accounts database scope is required");
  return accountDbScope.run({ ...parent, db }, work);
}
