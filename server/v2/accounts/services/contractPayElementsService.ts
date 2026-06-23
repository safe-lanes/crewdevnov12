import {
  ContractPayElementsRepository,
  ContractsRepository,
} from "../repositories";
import type {
  AccContractPayElementV2,
  InsertAccContractPayElementV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const contractPayElementsRepository = new ContractPayElementsRepository();
const contractsRepository = new ContractsRepository();

export const contractPayElementsService = {
  async getByUuid(
    contractPayElementUuid: string,
  ): Promise<AccContractPayElementV2> {
    const record = await contractPayElementsRepository.findByUuid(
      contractPayElementUuid,
    );
    if (!record) {
      throw new Error(
        `Contract pay element not found: ${contractPayElementUuid}`,
      );
    }
    return record;
  },

  async getByContract(
    contractUuid: string,
  ): Promise<AccContractPayElementV2[]> {
    return contractPayElementsRepository.findByContract(contractUuid);
  },

  async create(
    data: Omit<InsertAccContractPayElementV2, "contractPayElementUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccContractPayElementV2> {
    if (!data.contractUuid) throw new Error("contractUuid is required");
    if (!data.payElementCode) throw new Error("payElementCode is required");
    if (!data.payElementName) throw new Error("payElementName is required");
    if (!data.type) throw new Error("type is required");

    const contract = await contractsRepository.findByUuid(data.contractUuid);
    if (!contract) {
      throw new Error(`Contract not found: ${data.contractUuid}`);
    }

    return contractPayElementsRepository.create(applyAuditUser(data, true));
  },

  async update(
    contractPayElementUuid: string,
    data: Partial<InsertAccContractPayElementV2> & { auditUserUuid?: string },
  ): Promise<AccContractPayElementV2> {
    await this.getByUuid(contractPayElementUuid);
    const updated = await contractPayElementsRepository.update(
      contractPayElementUuid,
      applyAuditUser(data, false),
    );
    if (!updated) {
      throw new Error(
        `Failed to update contract pay element: ${contractPayElementUuid}`,
      );
    }
    return updated;
  },

  async delete(contractPayElementUuid: string): Promise<void> {
    await this.getByUuid(contractPayElementUuid);
    const success = await contractPayElementsRepository.softDelete(
      contractPayElementUuid,
    );
    if (!success) {
      throw new Error(
        `Failed to delete contract pay element: ${contractPayElementUuid}`,
      );
    }
  },
};
