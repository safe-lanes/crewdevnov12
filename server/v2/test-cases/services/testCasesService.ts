import { TestCasesRepository } from "../repositories/testCasesRepository";
import type {
  TestCaseV2,
  InsertTestCaseV2,
} from "../../../../shared/v2/test-cases/schema";

const testCasesRepository = new TestCasesRepository();

export const testCasesService = {
  async getAll(filters?: { module?: string }): Promise<TestCaseV2[]> {
    return testCasesRepository.findAll(filters);
  },

  async getByUuid(tcUuid: string): Promise<TestCaseV2> {
    const record = await testCasesRepository.findByUuid(tcUuid);
    if (!record) {
      throw new Error(`Test case not found: ${tcUuid}`);
    }
    return record;
  },

  async create(data: InsertTestCaseV2): Promise<TestCaseV2> {
    return testCasesRepository.create(data);
  },

  async update(
    tcUuid: string,
    data: Partial<InsertTestCaseV2>,
  ): Promise<TestCaseV2> {
    const existing = await testCasesRepository.findByUuid(tcUuid);
    if (!existing) {
      throw new Error(`Test case not found: ${tcUuid}`);
    }
    const updated = await testCasesRepository.update(tcUuid, data);
    return updated as TestCaseV2;
  },

  async delete(tcUuid: string): Promise<void> {
    const existing = await testCasesRepository.findByUuid(tcUuid);
    if (!existing) {
      throw new Error(`Test case not found: ${tcUuid}`);
    }
    await testCasesRepository.softDelete(tcUuid);
  },
};
