import {
  CrewLicensesRepository,
  CrewTrainingRepository,
  type CrewLicenseWithAttachments,
  type CrewTrainingCourseWithAttachments,
} from "../repositories";
import { crewMembersService } from "./crewMembersService";
import type {
  InsertCrewLicense,
  CrewLicense,
  InsertCrewLicenseAttachment,
  CrewLicenseAttachment,
  InsertCrewTrainingCourse,
  CrewTrainingCourse,
  InsertCrewTrainingAttachment,
  CrewTrainingAttachment,
} from "../../../../shared/v2/crew-pool/types";

const crewLicensesRepository = new CrewLicensesRepository();
const crewTrainingRepository = new CrewTrainingRepository();

export const crewCertificatesService = {
  // ============ Licenses ============
  async getLicenses(crewUuid: string): Promise<CrewLicenseWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewLicensesRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getActiveLicenses(crewUuid: string): Promise<CrewLicense[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewLicensesRepository.findActiveByCrewUuid(crewUuid);
  },

  async getLicenseByUuid(licUuid: string): Promise<CrewLicense> {
    const license = await crewLicensesRepository.findByUuid(licUuid);
    if (!license) {
      throw new Error(`License not found: ${licUuid}`);
    }
    return license;
  },

  async createLicense(
    crewUuid: string,
    data: Omit<InsertCrewLicense, "licUuid" | "crewUuid">
  ): Promise<CrewLicense> {
    await crewMembersService.getByUuid(crewUuid);

    if (!data.certificateDocument && !data.licenseId) {
      throw new Error("Certificate document or license ID is required");
    }

    return crewLicensesRepository.create({ ...data, crewUuid });
  },

  async updateLicense(
    licUuid: string,
    data: Partial<InsertCrewLicense>
  ): Promise<CrewLicense> {
    await this.getLicenseByUuid(licUuid);

    const updated = await crewLicensesRepository.update(licUuid, data);
    if (!updated) {
      throw new Error(`Failed to update license: ${licUuid}`);
    }
    return updated;
  },

  async deleteLicense(licUuid: string): Promise<void> {
    await this.getLicenseByUuid(licUuid);
    const success = await crewLicensesRepository.softDelete(licUuid);
    if (!success) {
      throw new Error(`Failed to delete license: ${licUuid}`);
    }
  },

  async archiveLicense(licUuid: string): Promise<boolean> {
    await this.getLicenseByUuid(licUuid);
    return crewLicensesRepository.archive(licUuid);
  },

  async unarchiveLicense(licUuid: string): Promise<boolean> {
    await this.getLicenseByUuid(licUuid);
    return crewLicensesRepository.unarchive(licUuid);
  },

  async addLicenseAttachment(
    licUuid: string,
    file: Omit<InsertCrewLicenseAttachment, "attUuid" | "licUuid">
  ): Promise<CrewLicenseAttachment> {
    await this.getLicenseByUuid(licUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewLicensesRepository.addAttachment({ ...file, licUuid });
  },

  async removeLicenseAttachment(attUuid: string): Promise<void> {
    const success = await crewLicensesRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
  },

  // ============ Training ============
  async getTraining(
    crewUuid: string
  ): Promise<CrewTrainingCourseWithAttachments[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewTrainingRepository.findByCrewUuidWithAttachments(crewUuid);
  },

  async getTrainingByUuid(trainUuid: string): Promise<CrewTrainingCourse> {
    const training = await crewTrainingRepository.findByUuid(trainUuid);
    if (!training) {
      throw new Error(`Training record not found: ${trainUuid}`);
    }
    return training;
  },

  async createTraining(
    crewUuid: string,
    data: Omit<InsertCrewTrainingCourse, "trainUuid" | "crewUuid">
  ): Promise<CrewTrainingCourse> {
    await crewMembersService.getByUuid(crewUuid);

    if (!data.trainingCourse && !data.courseId) {
      throw new Error("Training course or course ID is required");
    }

    return crewTrainingRepository.create({ ...data, crewUuid });
  },

  async updateTraining(
    trainUuid: string,
    data: Partial<InsertCrewTrainingCourse>
  ): Promise<CrewTrainingCourse> {
    await this.getTrainingByUuid(trainUuid);

    const updated = await crewTrainingRepository.update(trainUuid, data);
    if (!updated) {
      throw new Error(`Failed to update training: ${trainUuid}`);
    }
    return updated;
  },

  async deleteTraining(trainUuid: string): Promise<void> {
    await this.getTrainingByUuid(trainUuid);
    const success = await crewTrainingRepository.softDelete(trainUuid);
    if (!success) {
      throw new Error(`Failed to delete training: ${trainUuid}`);
    }
  },

  async addTrainingAttachment(
    trainUuid: string,
    file: Omit<InsertCrewTrainingAttachment, "attUuid" | "trainUuid">
  ): Promise<CrewTrainingAttachment> {
    await this.getTrainingByUuid(trainUuid);

    if (!file.fileName || !file.filePath) {
      throw new Error("File name and path are required");
    }

    return crewTrainingRepository.addAttachment({ ...file, trainUuid });
  },

  async removeTrainingAttachment(attUuid: string): Promise<void> {
    const success = await crewTrainingRepository.softDeleteAttachment(attUuid);
    if (!success) {
      throw new Error(`Failed to remove attachment: ${attUuid}`);
    }
  },

  // ============ Expiry Checks ============
  async checkExpiringCertificates(crewUuid: string, withinDays: number = 30) {
    const [licenses, training] = await Promise.all([
      this.getLicenses(crewUuid),
      this.getTraining(crewUuid),
    ]);

    const now = new Date();
    const futureDate = new Date(
      now.getTime() + withinDays * 24 * 60 * 60 * 1000
    );

    const expiringLicenses = licenses.filter((lic) => {
      if (!lic.expiry) return false;
      const expiryDate = new Date(lic.expiry);
      return expiryDate <= futureDate && expiryDate >= now;
    });

    const expiringTraining = training.filter((t) => {
      if (!t.expiry) return false;
      const expiryDate = new Date(t.expiry);
      return expiryDate <= futureDate && expiryDate >= now;
    });

    return {
      expiringLicenses,
      expiringTraining,
      totalExpiring: expiringLicenses.length + expiringTraining.length,
    };
  },
};
