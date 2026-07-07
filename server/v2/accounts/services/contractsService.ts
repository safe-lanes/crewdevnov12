import {
  ContractsRepository,
  ContractPayElementsRepository,
  PayElementsRepository,
} from "../repositories";
import type {
  AccContractV2,
  AccContractPayElementV2,
  InsertAccContractV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const contractsRepository = new ContractsRepository();
const contractPayElementsRepository = new ContractPayElementsRepository();
const payElementsRepository = new PayElementsRepository();

function payElementAppliesToGroup(
  vesselGroups: string | null | undefined,
  vesselGroup: string,
): boolean {
  if (!vesselGroups || vesselGroup === "all-vessels") return true;
  try {
    const parsed = JSON.parse(vesselGroups);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return true;
      return parsed.includes(vesselGroup) || parsed.includes("all-vessels");
    }
  } catch {
    // Non-JSON value: treat as a single group token.
    return vesselGroups === vesselGroup || vesselGroups === "all-vessels";
  }
  return true;
}

export const contractsService = {
  async getAll(filters?: {
    crewUuid?: string;
    vesselGroup?: string;
    status?: string;
  }): Promise<AccContractV2[]> {
    return contractsRepository.findAll(filters);
  },

  async getByUuid(contractUuid: string): Promise<AccContractV2> {
    const record = await contractsRepository.findByUuid(contractUuid);
    if (!record) {
      throw new Error(`Contract not found: ${contractUuid}`);
    }
    return record;
  },

  /**
   * Returns the contract for a crew member + vessel group, creating a draft
   * contract on first access and inheriting any master pay elements flagged
   * `reflectInContract`. Mirrors the V1 contract-data behavior.
   */
  async getContractWithElements(
    crewUuid: string,
    vesselGroup = "all-vessels",
    auditUserUuid?: string,
  ): Promise<{
    contractData: AccContractV2;
    earnings: AccContractPayElementV2[];
    deductions: AccContractPayElementV2[];
  }> {
    if (!crewUuid) throw new Error("crewUuid is required");

    let contract = await contractsRepository.findByCrewAndGroup(
      crewUuid,
      vesselGroup,
    );

    if (!contract) {
      contract = await contractsRepository.create(
        applyAuditUser(
          {
            crewUuid,
            vesselGroup,
            status: "draft",
            currency: "USD",
            modifiedBy: auditUserUuid ?? null,
            auditUserUuid,
          },
          true,
        ),
      );
      // A concurrent request may have won the unique (crew_uuid, vessel_group)
      // guard; re-read the canonical row in that case.
      if (!contract) {
        contract = await contractsRepository.findByCrewAndGroup(
          crewUuid,
          vesselGroup,
        );
      }
      if (!contract) {
        throw new Error(
          `Failed to create or resolve contract for crew: ${crewUuid}`,
        );
      }
    }

    await this.syncInheritedElements(contract, vesselGroup, auditUserUuid);

    const elements = await contractPayElementsRepository.findByContract(
      contract.contractUuid,
    );

    return {
      contractData: contract,
      earnings: elements
        .filter((e) => e.type === "earning")
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      deductions: elements
        .filter((e) => e.type === "deduction")
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    };
  },

  /**
   * Inserts contract pay elements for any active master pay element flagged
   * `reflectInContract` that is not yet present on the contract.
   */
  async syncInheritedElements(
    contract: AccContractV2,
    vesselGroup: string,
    auditUserUuid?: string,
  ): Promise<void> {
    const masterElements = await payElementsRepository.findAll({
      status: "active",
    });
    const existing = await contractPayElementsRepository.findByContract(
      contract.contractUuid,
    );
    const existingMasterUuids = new Set(
      existing.map((e) => e.payElementUuid).filter(Boolean) as string[],
    );

    let sortOrder = existing.length;
    for (const master of masterElements) {
      if (master.reflectInContract === false) continue;
      if (existingMasterUuids.has(master.payElementUuid)) continue;
      if (!payElementAppliesToGroup(master.vesselGroups, vesselGroup)) continue;

      await contractPayElementsRepository.createInheritedIfAbsent(
        applyAuditUser(
          {
            contractUuid: contract.contractUuid,
            payElementUuid: master.payElementUuid,
            payElementCode: master.code,
            payElementName: master.name,
            category: master.category,
            type: master.type,
            applicable: false,
            formula: master.formula,
            value: null,
            isCustom: false,
            isInherited: true,
            sortOrder: sortOrder++,
            auditUserUuid,
          },
          true,
        ),
      );
    }
  },

  async updateStatus(
    contractUuid: string,
    status: string,
    auditUserUuid?: string,
  ): Promise<AccContractV2> {
    await this.getByUuid(contractUuid);
    const updated = await contractsRepository.update(
      contractUuid,
      applyAuditUser({ status, auditUserUuid }, false),
    );
    if (!updated) {
      throw new Error(`Failed to update contract status: ${contractUuid}`);
    }
    return updated;
  },

  async updateEffectiveDate(
    contractUuid: string,
    effectiveDate: string,
    auditUserUuid?: string,
  ): Promise<AccContractV2> {
    await this.getByUuid(contractUuid);
    const updated = await contractsRepository.update(
      contractUuid,
      applyAuditUser({ applicableFrom: effectiveDate, auditUserUuid }, false),
    );
    if (!updated) {
      throw new Error(
        `Failed to update contract effective date: ${contractUuid}`,
      );
    }
    return updated;
  },

  async update(
    contractUuid: string,
    data: Partial<InsertAccContractV2> & { auditUserUuid?: string },
  ): Promise<AccContractV2> {
    await this.getByUuid(contractUuid);
    const updated = await contractsRepository.update(
      contractUuid,
      applyAuditUser(data, false),
    );
    if (!updated) {
      throw new Error(`Failed to update contract: ${contractUuid}`);
    }
    return updated;
  },
};
