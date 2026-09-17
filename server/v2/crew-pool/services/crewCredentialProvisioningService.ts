import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { crewAddresses, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { CrewCredentialsRepository } from "../../crew-app/auth/repositories/crewCredentialsRepository";
import { CrewRefreshTokensRepository } from "../../crew-app/auth/repositories/crewRefreshTokensRepository";
import { sendEmailAwaitable } from "../../shared/emailService";
import { buildCrewCredentialEmail } from "../templates/crewCredentialEmailTemplate";

const credentials = new CrewCredentialsRepository();
const refreshTokens = new CrewRefreshTokensRepository();
const rounds = 12;

function temporaryPassword(): string {
  return randomBytes(24).toString("base64url");
}

function result(row: any, registeredEmail?: string | null) {
  return {
    status: row ? (row.provisioningStatus || "pending") : "not_provisioned",
    credentialExists: !!row,
    ...((registeredEmail || row?.email) ? { email: registeredEmail || row.email } : {}),
    ...(row?.lastSentAt ? { lastSentAt: row.lastSentAt } : {}),
    ...(row?.lastError ? { lastError: row.lastError } : {}),
  };
}

export const crewCredentialProvisioningService = {
  async status(crewUuid: string, domain: string) {
    const db = getDb();
    const [crew] = await db.select({ id: crewMembersV2.id }).from(crewMembersV2).where(and(
      eq(crewMembersV2.crewUuid, crewUuid), eq(crewMembersV2.isDeleted, false),
      eq(crewMembersV2.isActive, true),
    )).limit(1);
    if (!crew) throw new Error("Crew member not found");
    const [address] = await db.select({ email: crewAddresses.email }).from(crewAddresses).where(and(
      eq(crewAddresses.crewUuid, crewUuid), eq(crewAddresses.isDeleted, false),
    )).limit(1);
    const row = await credentials.findByCrewUuidAndDomain(crewUuid, domain);
    return result(row, address?.email?.trim().toLowerCase());
  },

  async provision(crewUuid: string, domain: string, loginLink: string, resend: boolean, revoke: boolean) {
    const db = getDb();
    const [crew] = await db.select().from(crewMembersV2).where(and(
      eq(crewMembersV2.crewUuid, crewUuid), eq(crewMembersV2.isDeleted, false),
      eq(crewMembersV2.isActive, true),
    )).limit(1);
    if (!crew) throw new Error("Active crew member not found");
    if (!crew.empNo?.trim() || !crew.firstName?.trim() || !crew.familyName?.trim()) {
      throw new Error("Employee number, first name, and family name are required");
    }
    const [address] = await db.select().from(crewAddresses).where(and(
      eq(crewAddresses.crewUuid, crewUuid), eq(crewAddresses.isDeleted, false),
    )).limit(1);
    const email = address?.email?.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("A valid registered email is required");

    let credential = await credentials.findByCrewUuidAndDomain(crewUuid, domain);
    if (credential && !resend) return result(credential);
    const password = temporaryPassword();
    const hash = await bcrypt.hash(password, rounds);
    const operationUuid = uuidv4();
    if (!credential) {
      try {
        credential = await credentials.create({
          crewUuid, domain, empNo: crew.empNo, email,
          mobile: address?.mobile ?? null, passwordHash: hash,
          userType: "Crew", isActive: true, mustResetPassword: true,
          provisioningStatus: "pending", lastSentAt: null, lastError: null,
          provisioningOperationUuid: operationUuid, temporaryPasswordConsumedAt: null,
          isDeleted: false, isSync: false, createdByUuid: null, updatedByUuid: null,
        } as any);
      } catch (error: any) {
        // A concurrent submit may have won the unique (crew, domain) insert.
        const isExpectedUniqueConflict =
          error?.code === "23505" &&
          (String(error?.constraint ?? "").includes("crew_uuid_domain") ||
            String(error?.detail ?? "").includes("(crew_uuid, domain)"));
        if (!isExpectedUniqueConflict) throw error;
        credential = await credentials.findByCrewUuidAndDomain(crewUuid, domain);
        if (!credential) throw new Error("Unable to create crew credential");
        // Another worker owns the operation; never send a second temporary password.
        return result(credential);
      }
    } else {
      const started = await credentials.startProvisioningOperation({
        id: credential.id, operationUuid, passwordHash: hash, email,
        mobile: address?.mobile ?? null, empNo: crew.empNo,
      });
      if (!started) return result(await credentials.findById(credential.id));
      await refreshTokens.revokeAllForCredential(credential.id);
      credential = await credentials.findById(credential.id);
    }
    const emailContent = buildCrewCredentialEmail({
      firstName: crew.firstName, domain, empNo: crew.empNo, temporaryPassword: password, loginLink,
    });
    try {
      await sendEmailAwaitable([email], emailContent.subject, emailContent.html);
      await credentials.markProvisioning(credential!.id, operationUuid, "sent", { lastSentAt: new Date(), lastError: null });
    } catch (error: any) {
      await credentials.markProvisioning(credential!.id, operationUuid, "failed", { lastError: error?.message || "Email delivery failed" });
    }
    return result(await credentials.findById(credential!.id));
  },
};