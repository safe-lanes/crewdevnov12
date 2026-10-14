import type { CompanyFormSubjectAdapter } from "./contracts";
import { UnsupportedCompanyFormSubjectError } from "./errors";

/**
 * The registry is deliberately ignorant of concrete subject storage. Each
 * adapter owns its subject lookup and persisted stage source.
 */
export class CompanyFormSubjectRegistry {
  private readonly subjects = new Map<string, CompanyFormSubjectAdapter<any>>();

  constructor(adapters: readonly CompanyFormSubjectAdapter<any>[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: CompanyFormSubjectAdapter<any>): void {
    if (!adapter.subjectType.trim()) {
      throw new Error("Company Form subject type must be a non-empty stable identifier.");
    }
    if (this.subjects.has(adapter.subjectType)) {
      throw new Error(`Company Form subject type "${adapter.subjectType}" is already registered.`);
    }
    this.subjects.set(adapter.subjectType, adapter);
  }

  get(subjectType: string): CompanyFormSubjectAdapter<any> {
    const adapter = this.subjects.get(subjectType);
    if (!adapter) throw new UnsupportedCompanyFormSubjectError(subjectType);
    return adapter;
  }

  list(): readonly CompanyFormSubjectAdapter<any>[] {
    return [...this.subjects.values()];
  }
}