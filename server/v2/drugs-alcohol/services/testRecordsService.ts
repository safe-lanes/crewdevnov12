import {
  TestRecordsRepository,
  EquipmentRepository,
  PersonnelTestedRepository,
  SignaturesRepository,
  AttachmentsRepository,
} from "../repositories";
import type { TestRecordWithChildren } from "../repositories/testRecordsRepository";
import type {
  DaTestRecordV2,
  InsertDaTestRecordV2,
} from "../../../../shared/v2/drugs-alcohol/schema";
import { fileStorageService } from "../../shared/fileStorageService.js";
import { decodeStoredFile } from "../../shared/serveAttachmentHelper.js";

const testRecordsRepository = new TestRecordsRepository();
const equipmentRepository = new EquipmentRepository();
const personnelTestedRepository = new PersonnelTestedRepository();
const signaturesRepository = new SignaturesRepository();
const attachmentsRepository = new AttachmentsRepository();

/**
 * Delete the on-disk file backing an attachment, if any. Legacy rows may carry
 * a base64 data URL in file_path (no disk file) — those are skipped.
 */
async function deleteAttachmentFile(filePath?: string | null): Promise<void> {
  if (!filePath || filePath.startsWith("data:")) return;
  await fileStorageService.deleteAttachment(filePath);
}

/**
 * Persist a new attachment value to disk when it is base64; otherwise keep the
 * provided relative path. Never returns base64 for storage so new uploads only
 * ever land on disk while already-stored relative paths are preserved on round
 * trips.
 */
async function persistAttachmentItem(
  fileName: string,
  data?: string | null,
  filePath?: string | null,
  fileType?: string | null,
): Promise<{ filePath: string | null; fileData: null }> {
  const raw = data || filePath || "";
  const decoded = decodeStoredFile(raw, fileType ?? null);
  if (decoded) {
    const storedPath = await fileStorageService.writeAttachment(
      "drugs-alcohol",
      fileName,
      decoded.buffer,
    );
    return { filePath: storedPath, fileData: null };
  }
  return { filePath: filePath || null, fileData: null };
}

function applyAuditUser<T extends object>(
  data: T,
  isCreate = false
): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;

  if (isCreate) {
    result.createdByUuid = auditUserUuid;
  }
  result.updatedByUuid = auditUserUuid;

  return result;
}

function transformToV1Response(record: TestRecordWithChildren): any {
  const equipmentJson = record.equipment.map((e) => ({
    id: e.eqUuid,
    equipmentId: e.equipmentId,
    makeModel: e.makeModel,
    serialNo: e.serialNo,
    lastCalibrated: e.lastCalibrated,
  }));

  const personnelJson = record.personnel.map((p) => ({
    id: p.ptUuid,
    crewId: p.crewId,
    rank: p.rank,
    name: p.name,
    alcoholTest: {
      checked: p.alcoholTestChecked,
      date: p.alcoholTestDate,
      time: p.alcoholTestTime,
    },
    alcoholResults: p.alcoholResults,
    alcoholViolation: p.alcoholViolation,
    drugTest: {
      checked: p.drugTestChecked,
      date: p.drugTestDate,
      time: p.drugTestTime,
    },
    drugResults: p.drugResults,
    drugViolation: p.drugViolation,
    witness: p.witness,
  }));

  const signatureChild = record.signatures[0];
  const signatureJson = signatureChild
    ? { sigUuid: signatureChild.sigUuid, confirmed: signatureChild.confirmed, name: signatureChild.name, date: signatureChild.date }
    : null;

  const attachmentsJson = record.attachments.map((a) => ({
    id: a.attUuid,
    attUuid: a.attUuid,
    name: a.fileName,
    type: a.fileType,
    size: a.fileSize,
    data: a.fileData,
    filePath: a.filePath,
    viewUrl: `/api/v2/drugs-alcohol/attachments/${a.attUuid}/raw`,
    uploadedAt: a.uploadDate,
  }));

  return {
    id: record.id,
    daUuid: record.daUuid,
    vesselId: record.vesselId,
    testType: record.testType,
    alcoholDrugType: record.alcoholDrugType,
    placeLocation: record.placeLocation,
    dateTimeTestCompleted: record.dateTimeTestCompleted,
    externalTestResultsDate: record.externalTestResultsDate,
    incidentId: record.incidentId,
    equipmentNotApplicable: record.equipmentNotApplicable,
    testHistory: record.testHistory,
    frequencyMonths: record.frequencyMonths,
    plannedPort: record.plannedPort,
    plannedDate: record.plannedDate,
    plannedComments: record.plannedComments,
    incidentTitle: record.incidentTitle,
    incidentDateTime: record.incidentDateTime,
    alcoholTestDateTime: record.alcoholTestDateTime,
    drugTestDateTime: record.drugTestDateTime,
    violations: record.violations,
    testDateTime: record.testDateTime,
    otherTestType: record.otherTestType,
    reasonForTesting: record.reasonForTesting,
    description: record.description,
    initiatedBy: record.initiatedBy,
    comments: record.comments,
    status: record.status,
    sortOrder: record.sortOrder,
    testingEquipment: JSON.stringify(equipmentJson),
    personnelTested: JSON.stringify(personnelJson),
    masterDeputySignature: JSON.stringify(signatureJson),
    attachmentFile: JSON.stringify(attachmentsJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdByUuid: record.createdByUuid,
    updatedByUuid: record.updatedByUuid,
  };
}

function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parseDateLeniently(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthName = dmyMatch[2].toLowerCase().slice(0, 3);
    const months: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };
    const month = months[monthName];
    if (!month) return null;
    const year = parseInt(dmyMatch[3], 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

export function pickRelevantDate(
  testType: string | null | undefined,
  dates: {
    dateTimeTestCompleted: string | null | undefined;
    incidentDateTime: string | null | undefined;
    testDateTime: string | null | undefined;
  }
): string | null {
  const normalized = (testType || "").toLowerCase().trim();
  if (normalized === "post-incident") {
    return (
      parseDateLeniently(dates.incidentDateTime) ??
      parseDateLeniently(dates.dateTimeTestCompleted)
    );
  }
  return (
    parseDateLeniently(dates.dateTimeTestCompleted) ??
    parseDateLeniently(dates.testDateTime)
  );
}

function extractDateFromTestCompleted(dateTimeTestCompleted: string): string | null {
  if (!dateTimeTestCompleted) return null;
  const match = dateTimeTestCompleted.match(/^(\d{1,2}\s+\w+\s+\d{4})/);
  return match ? match[1] : null;
}

export const testRecordsService = {
  async getAll(filters?: {
    vesselId?: string;
    testType?: string;
  }): Promise<any[]> {
    const records = await testRecordsRepository.findAllWithChildren(filters);
    return records.map(transformToV1Response);
  },

  async getByUuid(daUuid: string): Promise<any> {
    const record = await testRecordsRepository.findByUuidWithChildren(daUuid);
    if (!record) {
      throw new Error(`Test record not found: ${daUuid}`);
    }
    return transformToV1Response(record);
  },

  async getByVessel(vesselId: string, testType?: string): Promise<any[]> {
    const records = await testRecordsRepository.findAllWithChildren({
      vesselId,
      testType,
    });
    return records.map(transformToV1Response);
  },

  async create(data: any): Promise<any> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.testType) {
      throw new Error("Test type is required");
    }

    if (data.dateTimeTestCompleted) {
      const dateStr = extractDateFromTestCompleted(data.dateTimeTestCompleted);
      if (dateStr) {
        const duplicate = await testRecordsRepository.findDuplicate(data.vesselId, dateStr);
        if (duplicate) {
          const err: any = new Error("A test record already exists for this vessel on this date.");
          err.statusCode = 409;
          err.existingRecordId = duplicate.id;
          throw err;
        }
      }
    }

    const {
      testingEquipment,
      personnelTested,
      masterDeputySignature,
      attachmentFile,
      auditUserUuid,
      ...parentFields
    } = data;

    const parentData = applyAuditUser({ ...parentFields, auditUserUuid }, true);
    delete parentData.auditUserUuid;

    const record = await testRecordsRepository.create(parentData);

    await this._createChildren(record.daUuid, testingEquipment, personnelTested, masterDeputySignature, attachmentFile, auditUserUuid);

    return this.getByUuid(record.daUuid);
  },

  async updatePlannedFields(daUuid: string, data: Record<string, any>): Promise<any> {
    const existing = await testRecordsRepository.findByUuid(daUuid);
    if (!existing) {
      throw new Error(`Test record not found: ${daUuid}`);
    }

    const allowedFields = ['plannedPort', 'plannedDate', 'plannedComments'];
    const updateData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in data) {
        updateData[key] = data[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.getByUuid(daUuid);
    }

    await testRecordsRepository.update(daUuid, updateData);
    return this.getByUuid(daUuid);
  },

  async update(daUuid: string, data: any): Promise<any> {
    const existing = await testRecordsRepository.findByUuid(daUuid);
    if (!existing) {
      throw new Error(`Test record not found: ${daUuid}`);
    }

    if (data.dateTimeTestCompleted) {
      const dateStr = extractDateFromTestCompleted(data.dateTimeTestCompleted);
      if (dateStr) {
        const duplicate = await testRecordsRepository.findDuplicate(
          data.vesselId || existing.vesselId,
          dateStr,
          daUuid
        );
        if (duplicate) {
          const err: any = new Error("A test record already exists for this vessel on this date.");
          err.statusCode = 409;
          err.existingRecordId = duplicate.id;
          throw err;
        }
      }
    }

    const {
      testingEquipment,
      personnelTested,
      masterDeputySignature,
      attachmentFile,
      auditUserUuid,
      ...parentFields
    } = data;

    const parentData = applyAuditUser({ ...parentFields, auditUserUuid }, false);
    delete parentData.auditUserUuid;
    delete parentData.id;
    delete parentData.daUuid;

    await testRecordsRepository.update(daUuid, parentData);

    await this._upsertChildren(daUuid, testingEquipment, personnelTested, masterDeputySignature, attachmentFile, auditUserUuid);

    return this.getByUuid(daUuid);
  },

  async getViolationCounts(params: {
    periodFrom: string;
    periodTo: string;
    vesselNames?: string[];
    rankNames?: string[];
    poolNames?: string[];
    agentNames?: string[];
    nationalityIds?: string[];
  }): Promise<{ alcoholViolations: number; drugViolations: number }> {
    const filtered = await this._getFilteredViolatingPersonnel(params);
    let alcoholViolations = 0;
    let drugViolations = 0;
    for (const row of filtered) {
      if (row.alcoholViolation) alcoholViolations++;
      if (row.drugViolation) drugViolations++;
    }
    return { alcoholViolations, drugViolations };
  },

  async getViolationFormSummaries(params: {
    periodFrom: string;
    periodTo: string;
    type: "alcohol" | "drug";
    vesselNames?: string[];
    rankNames?: string[];
    poolNames?: string[];
    agentNames?: string[];
    nationalityIds?: string[];
  }): Promise<
    Array<{
      daUuid: string;
      testType: string | null;
      otherTestType: string | null;
      testDate: string;
      vesselId: string | null;
      vesselName: string | null;
      alcoholViolations: number;
      drugViolations: number;
    }>
  > {
    const filtered = await this._getFilteredViolatingPersonnel(params);
    const byForm = new Map<
      string,
      {
        daUuid: string;
        testType: string | null;
        otherTestType: string | null;
        testDate: string;
        vesselId: string | null;
        vesselName: string | null;
        alcoholViolations: number;
        drugViolations: number;
      }
    >();
    for (const row of filtered) {
      const existing = byForm.get(row.daUuid);
      if (existing) {
        if (row.alcoholViolation) existing.alcoholViolations++;
        if (row.drugViolation) existing.drugViolations++;
      } else {
        byForm.set(row.daUuid, {
          daUuid: row.daUuid,
          testType: row.testType,
          otherTestType: row.otherTestType,
          testDate: row.testDate,
          vesselId: row.vesselId,
          vesselName: row.vesselName,
          alcoholViolations: row.alcoholViolation ? 1 : 0,
          drugViolations: row.drugViolation ? 1 : 0,
        });
      }
    }
    const list = Array.from(byForm.values()).filter((f) =>
      params.type === "alcohol" ? f.alcoholViolations > 0 : f.drugViolations > 0
    );
    list.sort((a, b) => (a.testDate < b.testDate ? 1 : a.testDate > b.testDate ? -1 : 0));
    return list;
  },

  async _getFilteredViolatingPersonnel(params: {
    periodFrom: string;
    periodTo: string;
    vesselNames?: string[];
    rankNames?: string[];
    poolNames?: string[];
    agentNames?: string[];
    nationalityIds?: string[];
  }): Promise<
    Array<{
      daUuid: string;
      vesselId: string | null;
      vesselName: string | null;
      testType: string | null;
      otherTestType: string | null;
      testDate: string;
      rank: string | null;
      crewPool: string | null;
      manningAgent: string | null;
      alcoholViolation: boolean | null;
      drugViolation: boolean | null;
    }>
  > {
    const {
      periodFrom,
      periodTo,
      vesselNames,
      rankNames,
      poolNames,
      agentNames,
      nationalityIds,
    } = params;
    if (!isValidDateString(periodFrom) || !isValidDateString(periodTo)) {
      throw new Error("Invalid period: periodFrom and periodTo must be YYYY-MM-DD");
    }
    if (periodFrom > periodTo) {
      throw new Error("Invalid period: periodFrom must be on or before periodTo");
    }
    const rows = await testRecordsRepository.findFinalizedViolatingPersonnelDetailed();
    const vesselSet = vesselNames && vesselNames.length > 0 ? new Set(vesselNames) : null;
    const rankSet = rankNames && rankNames.length > 0 ? new Set(rankNames) : null;
    const poolSet = poolNames && poolNames.length > 0 ? new Set(poolNames) : null;
    const agentSet = agentNames && agentNames.length > 0 ? new Set(agentNames) : null;
    const natSet =
      nationalityIds && nationalityIds.length > 0
        ? new Set(nationalityIds)
        : null;

    const out: Array<{
      daUuid: string;
      vesselId: string | null;
      vesselName: string | null;
      testType: string | null;
      otherTestType: string | null;
      testDate: string;
      rank: string | null;
      crewPool: string | null;
      manningAgent: string | null;
      alcoholViolation: boolean | null;
      drugViolation: boolean | null;
    }> = [];
    // De-duplicate fan-out from leftJoin on crew_personal_details (in case
    // multiple non-deleted detail rows exist for a single crewUuid). Each
    // (daUuid, crewId-or-row-index) personnel entry should only be counted once.
    const seen = new Set<string>();
    let idx = 0;
    for (const row of rows) {
      idx++;
      const dedupKey = `${row.daUuid}::${row.crewId ?? `__row_${idx}`}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const dateStr = pickRelevantDate(row.testType, {
        dateTimeTestCompleted: row.dateTimeTestCompleted,
        incidentDateTime: row.incidentDateTime,
        testDateTime: row.testDateTime,
      });
      if (!dateStr) continue;
      if (dateStr < periodFrom || dateStr > periodTo) continue;
      if (vesselSet && !(row.vesselName && vesselSet.has(row.vesselName))) continue;
      if (rankSet && !(row.rank && rankSet.has(row.rank))) continue;
      if (poolSet && !(row.crewPool && poolSet.has(row.crewPool))) continue;
      if (agentSet && !(row.manningAgent && agentSet.has(row.manningAgent))) continue;
      if (natSet && !(row.nationalityUuid && natSet.has(row.nationalityUuid))) continue;
      out.push({
        daUuid: row.daUuid,
        vesselId: row.vesselId,
        vesselName: row.vesselName,
        testType: row.testType,
        otherTestType: row.otherTestType,
        testDate: dateStr,
        rank: row.rank,
        crewPool: row.crewPool,
        manningAgent: row.manningAgent,
        alcoholViolation: row.alcoholViolation,
        drugViolation: row.drugViolation,
      });
    }
    return out;
  },

  async delete(daUuid: string): Promise<void> {
    const existing = await testRecordsRepository.findByUuid(daUuid);
    if (!existing) {
      throw new Error(`Test record not found: ${daUuid}`);
    }

    // Capture attachment disk paths before soft-deleting so the backing files
    // can be removed from disk afterwards.
    const attachments = await attachmentsRepository.findByTestRecordUuid(daUuid);

    await Promise.all([
      testRecordsRepository.softDelete(daUuid),
      equipmentRepository.softDeleteByTestRecordUuid(daUuid),
      personnelTestedRepository.softDeleteByTestRecordUuid(daUuid),
      signaturesRepository.softDeleteByTestRecordUuid(daUuid),
      attachmentsRepository.softDeleteByTestRecordUuid(daUuid),
    ]);

    await Promise.all(
      attachments.map((a) => deleteAttachmentFile(a.filePath))
    );
  },

  async _createChildren(
    testRecordUuid: string,
    testingEquipment?: string,
    personnelTested?: string,
    masterDeputySignature?: string,
    attachmentFile?: string,
    auditUserUuid?: string
  ): Promise<void> {
    const promises: Promise<any>[] = [];

    if (testingEquipment) {
      try {
        const items = JSON.parse(testingEquipment);
        if (Array.isArray(items)) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            promises.push(
              equipmentRepository.create({
                testRecordUuid,
                equipmentId: item.equipmentId || null,
                makeModel: item.makeModel || null,
                serialNo: item.serialNo || null,
                lastCalibrated: item.lastCalibrated || null,
                sortOrder: i,
                createdByUuid: auditUserUuid || null,
                updatedByUuid: auditUserUuid || null,
              })
            );
          }
        }
      } catch (e) {}
    }

    if (personnelTested) {
      try {
        const items = JSON.parse(personnelTested);
        if (Array.isArray(items)) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            promises.push(
              personnelTestedRepository.create({
                testRecordUuid,
                crewId: item.crewId || null,
                rank: item.rank || null,
                name: item.name || null,
                alcoholTestChecked: item.alcoholTest?.checked ?? false,
                alcoholTestDate: item.alcoholTest?.date || null,
                alcoholTestTime: item.alcoholTest?.time || null,
                alcoholResults: item.alcoholResults || null,
                alcoholViolation: item.alcoholViolation ?? false,
                drugTestChecked: item.drugTest?.checked ?? false,
                drugTestDate: item.drugTest?.date || null,
                drugTestTime: item.drugTest?.time || null,
                drugResults: item.drugResults || null,
                drugViolation: item.drugViolation ?? false,
                witness: item.witness || null,
                sortOrder: i,
                createdByUuid: auditUserUuid || null,
                updatedByUuid: auditUserUuid || null,
              })
            );
          }
        }
      } catch (e) {}
    }

    if (masterDeputySignature) {
      try {
        const sig = JSON.parse(masterDeputySignature);
        if (sig && typeof sig === "object") {
          promises.push(
            signaturesRepository.create({
              testRecordUuid,
              confirmed: sig.confirmed ?? false,
              name: sig.name || null,
              date: sig.date || null,
              createdByUuid: auditUserUuid || null,
              updatedByUuid: auditUserUuid || null,
            })
          );
        }
      } catch (e) {}
    }

    if (attachmentFile) {
      try {
        const items = JSON.parse(attachmentFile);
        if (Array.isArray(items)) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const stored = await persistAttachmentItem(
              item.name || "attachment",
              item.data,
              item.filePath,
              item.type,
            );
            promises.push(
              attachmentsRepository.create({
                testRecordUuid,
                fileName: item.name || null,
                fileType: item.type || null,
                fileSize: item.size?.toString() || null,
                fileData: stored.fileData,
                uploadDate: item.uploadedAt || null,
                uploadedBy: auditUserUuid || null,
                filePath: stored.filePath,
                sortOrder: i,
                createdByUuid: auditUserUuid || null,
                updatedByUuid: auditUserUuid || null,
              })
            );
          }
        }
      } catch (e) {}
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  },

  async _upsertChildren(
    testRecordUuid: string,
    testingEquipment?: string,
    personnelTested?: string,
    masterDeputySignature?: string,
    attachmentFile?: string,
    auditUserUuid?: string
  ): Promise<void> {
    const promises: Promise<any>[] = [];

    if (testingEquipment) {
      try {
        const items = JSON.parse(testingEquipment);
        if (Array.isArray(items)) {
          const keepUuids: string[] = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemId = item.id;
            if (itemId) {
              const existing = await equipmentRepository.findByUuid(itemId);
              if (existing) {
                keepUuids.push(itemId);
                promises.push(
                  equipmentRepository.updateByUuid(itemId, {
                    equipmentId: item.equipmentId || null,
                    makeModel: item.makeModel || null,
                    serialNo: item.serialNo || null,
                    lastCalibrated: item.lastCalibrated || null,
                    sortOrder: i,
                    updatedByUuid: auditUserUuid || null,
                  })
                );
                continue;
              }
            }
            const created = await equipmentRepository.create({
              testRecordUuid,
              equipmentId: item.equipmentId || null,
              makeModel: item.makeModel || null,
              serialNo: item.serialNo || null,
              lastCalibrated: item.lastCalibrated || null,
              sortOrder: i,
              createdByUuid: auditUserUuid || null,
              updatedByUuid: auditUserUuid || null,
            });
            keepUuids.push(created.eqUuid);
          }
          promises.push(equipmentRepository.softDeleteExcluding(testRecordUuid, keepUuids));
        }
      } catch (e) {}
    } else {
      promises.push(equipmentRepository.softDeleteByTestRecordUuid(testRecordUuid));
    }

    if (personnelTested) {
      try {
        const items = JSON.parse(personnelTested);
        if (Array.isArray(items)) {
          const keepUuids: string[] = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemId = item.id;
            if (itemId) {
              const existing = await personnelTestedRepository.findByUuid(itemId);
              if (existing) {
                keepUuids.push(itemId);
                promises.push(
                  personnelTestedRepository.updateByUuid(itemId, {
                    crewId: item.crewId || null,
                    rank: item.rank || null,
                    name: item.name || null,
                    alcoholTestChecked: item.alcoholTest?.checked ?? false,
                    alcoholTestDate: item.alcoholTest?.date || null,
                    alcoholTestTime: item.alcoholTest?.time || null,
                    alcoholResults: item.alcoholResults || null,
                    alcoholViolation: item.alcoholViolation ?? false,
                    drugTestChecked: item.drugTest?.checked ?? false,
                    drugTestDate: item.drugTest?.date || null,
                    drugTestTime: item.drugTest?.time || null,
                    drugResults: item.drugResults || null,
                    drugViolation: item.drugViolation ?? false,
                    witness: item.witness || null,
                    sortOrder: i,
                    updatedByUuid: auditUserUuid || null,
                  })
                );
                continue;
              }
            }
            const created = await personnelTestedRepository.create({
              testRecordUuid,
              crewId: item.crewId || null,
              rank: item.rank || null,
              name: item.name || null,
              alcoholTestChecked: item.alcoholTest?.checked ?? false,
              alcoholTestDate: item.alcoholTest?.date || null,
              alcoholTestTime: item.alcoholTest?.time || null,
              alcoholResults: item.alcoholResults || null,
              alcoholViolation: item.alcoholViolation ?? false,
              drugTestChecked: item.drugTest?.checked ?? false,
              drugTestDate: item.drugTest?.date || null,
              drugTestTime: item.drugTest?.time || null,
              drugResults: item.drugResults || null,
              drugViolation: item.drugViolation ?? false,
              witness: item.witness || null,
              sortOrder: i,
              createdByUuid: auditUserUuid || null,
              updatedByUuid: auditUserUuid || null,
            });
            keepUuids.push(created.ptUuid);
          }
          promises.push(personnelTestedRepository.softDeleteExcluding(testRecordUuid, keepUuids));
        }
      } catch (e) {}
    } else {
      promises.push(personnelTestedRepository.softDeleteByTestRecordUuid(testRecordUuid));
    }

    if (masterDeputySignature) {
      try {
        const sig = JSON.parse(masterDeputySignature);
        if (sig && typeof sig === "object") {
          const keepSigUuids: string[] = [];
          if (sig.sigUuid) {
            const existing = await signaturesRepository.findByUuid(sig.sigUuid);
            if (existing) {
              keepSigUuids.push(sig.sigUuid);
              promises.push(
                signaturesRepository.updateByUuid(sig.sigUuid, {
                  confirmed: sig.confirmed ?? false,
                  name: sig.name || null,
                  date: sig.date || null,
                  updatedByUuid: auditUserUuid || null,
                })
              );
            } else {
              const created = await signaturesRepository.create({
                testRecordUuid,
                confirmed: sig.confirmed ?? false,
                name: sig.name || null,
                date: sig.date || null,
                createdByUuid: auditUserUuid || null,
                updatedByUuid: auditUserUuid || null,
              });
              keepSigUuids.push(created.sigUuid);
            }
          } else {
            const created = await signaturesRepository.create({
              testRecordUuid,
              confirmed: sig.confirmed ?? false,
              name: sig.name || null,
              date: sig.date || null,
              createdByUuid: auditUserUuid || null,
              updatedByUuid: auditUserUuid || null,
            });
            keepSigUuids.push(created.sigUuid);
          }
          promises.push(signaturesRepository.softDeleteExcluding(testRecordUuid, keepSigUuids));
        }
      } catch (e) {}
    } else {
      promises.push(signaturesRepository.softDeleteByTestRecordUuid(testRecordUuid));
    }

    if (attachmentFile) {
      try {
        const items = JSON.parse(attachmentFile);
        if (Array.isArray(items)) {
          const keepUuids: string[] = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const attUuid = item.id || item.attUuid;
            if (attUuid) {
              const existing = await attachmentsRepository.findByUuid(attUuid);
              if (existing) {
                keepUuids.push(attUuid);
                const stored = await persistAttachmentItem(
                  item.name || "attachment",
                  item.data,
                  item.filePath ?? existing.filePath,
                  item.type,
                );
                promises.push(
                  attachmentsRepository.updateByUuid(attUuid, {
                    fileName: item.name || null,
                    fileType: item.type || null,
                    fileSize: item.size?.toString() || null,
                    fileData: stored.fileData,
                    uploadDate: item.uploadedAt || null,
                    uploadedBy: auditUserUuid || null,
                    filePath: stored.filePath,
                    sortOrder: i,
                    updatedByUuid: auditUserUuid || null,
                  })
                );
                continue;
              }
            }
            const stored = await persistAttachmentItem(
              item.name || "attachment",
              item.data,
              item.filePath,
              item.type,
            );
            const created = await attachmentsRepository.create({
              testRecordUuid,
              fileName: item.name || null,
              fileType: item.type || null,
              fileSize: item.size?.toString() || null,
              fileData: stored.fileData,
              uploadDate: item.uploadedAt || null,
              uploadedBy: auditUserUuid || null,
              filePath: stored.filePath,
              sortOrder: i,
              createdByUuid: auditUserUuid || null,
              updatedByUuid: auditUserUuid || null,
            });
            keepUuids.push(created.attUuid);
          }
          promises.push(attachmentsRepository.softDeleteExcluding(testRecordUuid, keepUuids));
        }
      } catch (e) {}
    } else {
      promises.push(attachmentsRepository.softDeleteByTestRecordUuid(testRecordUuid));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  },
};
