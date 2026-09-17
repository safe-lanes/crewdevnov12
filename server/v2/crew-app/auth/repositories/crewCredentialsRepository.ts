import { eq, and, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../../db";
import { appCrewCredentials } from "../../../../../shared/v2/crew-app/schema";
import type {
  AppCrewCredential,
  InsertAppCrewCredential,
} from "../../../../../shared/v2/crew-app/types";

export class CrewCredentialsRepository {
  async findByIdentifierAndDomain(
    identifier: string,
    domain: string,
  ): Promise<AppCrewCredential | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(appCrewCredentials)
      .where(
        and(
          eq(appCrewCredentials.domain, domain),
          eq(appCrewCredentials.isDeleted, false),
          or(
            eq(appCrewCredentials.empNo, identifier),
            eq(appCrewCredentials.mobile, identifier),
            eq(appCrewCredentials.email, identifier),
          ),
        ),
      )
      .limit(1);
    return results[0];
  }

  async findById(id: number): Promise<AppCrewCredential | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(appCrewCredentials)
      .where(and(eq(appCrewCredentials.id, id), eq(appCrewCredentials.isDeleted, false)))
      .limit(1);
    return results[0];
  }

  async findByCrewUuidAndDomain(
    crewUuid: string,
    domain: string,
  ): Promise<AppCrewCredential | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(appCrewCredentials)
      .where(and(eq(appCrewCredentials.crewUuid, crewUuid), eq(appCrewCredentials.domain, domain)))
      .limit(1);
    return results[0];
  }

  async create(
    data: Omit<InsertAppCrewCredential, "credentialUuid">,
  ): Promise<AppCrewCredential> {
    const db = getDb();
    const results = await db
      .insert(appCrewCredentials)
      .values({ ...data, credentialUuid: uuidv4() })
      .returning();
    return results[0];
  }

  /** Atomic increment; returns the new count so the service can decide on lockout. */
  async incrementFailedAttempts(id: number): Promise<number> {
    const db = getDb();
    const results = await db
      .update(appCrewCredentials)
      .set({ failedLoginAttempts: sql`${appCrewCredentials.failedLoginAttempts} + 1` })
      .where(eq(appCrewCredentials.id, id))
      .returning({ failedLoginAttempts: appCrewCredentials.failedLoginAttempts });
    return results[0]?.failedLoginAttempts ?? 0;
  }

  async lockAccount(id: number, lockedUntil: Date): Promise<void> {
    const db = getDb();
    await db
      .update(appCrewCredentials)
      .set({ lockedUntil, failedLoginAttempts: 0 })
      .where(eq(appCrewCredentials.id, id));
  }

  async clearLockout(id: number): Promise<void> {
    const db = getDb();
    await db
      .update(appCrewCredentials)
      .set({ lockedUntil: null, failedLoginAttempts: 0 })
      .where(eq(appCrewCredentials.id, id));
  }

  async updateLastLogin(id: number): Promise<void> {
    const db = getDb();
    await db
      .update(appCrewCredentials)
      .set({ lastLoginAt: new Date() })
      .where(eq(appCrewCredentials.id, id));
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    const db = getDb();
    await db
      .update(appCrewCredentials)
      .set({ passwordHash, mustResetPassword: false, temporaryPasswordConsumedAt: null })
      .where(eq(appCrewCredentials.id, id));
  }

  async consumeTemporaryPassword(id: number): Promise<boolean> {
    const db = getDb();
    const rows = await db.update(appCrewCredentials)
      .set({ temporaryPasswordConsumedAt: new Date() })
      .where(and(
        eq(appCrewCredentials.id, id),
        eq(appCrewCredentials.mustResetPassword, true),
        sql`${appCrewCredentials.temporaryPasswordConsumedAt} IS NULL`,
      ))
      .returning({ id: appCrewCredentials.id });
    return rows.length > 0;
  }

  async updateProvisioning(id: number, data: {
    provisioningStatus: string;
    lastSentAt?: Date | null;
    lastError?: string | null;
    passwordHash?: string;
    mustResetPassword?: boolean;
    email?: string | null;
    mobile?: string | null;
    empNo?: string | null;
    temporaryPasswordConsumedAt?: Date | null;
    provisioningOperationUuid?: string | null;
  }): Promise<void> {
    const db = getDb();
    await db.update(appCrewCredentials).set(data).where(eq(appCrewCredentials.id, id));
  }

  async startProvisioningOperation(data: {
    id: number;
    operationUuid: string;
    passwordHash: string;
    email: string;
    mobile?: string | null;
    empNo: string;
  }): Promise<boolean> {
    const db = getDb();
    const rows = await db.update(appCrewCredentials).set({
      passwordHash: data.passwordHash,
      email: data.email,
      mobile: data.mobile ?? null,
      empNo: data.empNo,
      mustResetPassword: true,
      temporaryPasswordConsumedAt: null,
      provisioningStatus: "pending",
      provisioningOperationUuid: data.operationUuid,
      lastError: null,
    }).where(and(
      eq(appCrewCredentials.id, data.id),
      sql`(
        ${appCrewCredentials.provisioningStatus} <> 'pending'
        OR ${appCrewCredentials.updatedAt} < NOW() - INTERVAL '10 minutes'
      )`,
    )).returning({ id: appCrewCredentials.id });
    return rows.length > 0;
  }

  async markProvisioning(
    id: number,
    operationUuid: string,
    provisioningStatus: string,
    data: { lastSentAt?: Date | null; lastError?: string | null } = {},
  ): Promise<boolean> {
    const db = getDb();
    const rows = await db.update(appCrewCredentials).set({
      provisioningStatus, ...data,
    }).where(and(
      eq(appCrewCredentials.id, id),
      eq(appCrewCredentials.provisioningOperationUuid, operationUuid),
    )).returning({ id: appCrewCredentials.id });
    return rows.length > 0;
  }

  /** All active credentials in the current tenant, regardless of domain — used by the
   * notification scanner since crew records themselves aren't partitioned by domain. */
  async listAllActive(): Promise<AppCrewCredential[]> {
    const db = getDb();
    return db
      .select()
      .from(appCrewCredentials)
      .where(and(eq(appCrewCredentials.isActive, true), eq(appCrewCredentials.isDeleted, false)));
  }

  async listActiveByDomain(domain: string): Promise<AppCrewCredential[]> {
    const db = getDb();
    return db
      .select()
      .from(appCrewCredentials)
      .where(
        and(
          eq(appCrewCredentials.domain, domain),
          eq(appCrewCredentials.isActive, true),
          eq(appCrewCredentials.isDeleted, false),
        ),
      );
  }

  async setUserType(id: number, userType: string): Promise<void> {
    const db = getDb();
    await db.update(appCrewCredentials).set({ userType }).where(eq(appCrewCredentials.id, id));
  }
}
