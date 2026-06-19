import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { alertPoliciesV2, alertEventsV2, alertDeliveriesV2 } from "../../../../shared/v2/alerts/schema";
import type { AlertPolicyV2, InsertAlertPolicyV2, AlertEventV2, InsertAlertEventV2 } from "../../../../shared/v2/alerts/schema";

export class AlertsRepository {
  async getAlertPolicies(): Promise<AlertPolicyV2[]> {
    const db = getDb();
    return db.select().from(alertPoliciesV2).where(eq(alertPoliciesV2.isDeleted, false));
  }

  async getAlertPolicy(apuuid: string): Promise<AlertPolicyV2 | undefined> {
    const db = getDb();
    const result = await db.select().from(alertPoliciesV2)
      .where(and(eq(alertPoliciesV2.apuuid, apuuid), eq(alertPoliciesV2.isDeleted, false)));
    return result[0];
  }

  async getAlertEvents(filters?: { alertType?: string; acknowledged?: boolean }): Promise<AlertEventV2[]> {
    const db = getDb();
    const conditions = [eq(alertEventsV2.isDeleted, false)];
    if (filters?.alertType) {
      conditions.push(eq(alertEventsV2.alertType, filters.alertType));
    }
    if (filters?.acknowledged !== undefined) {
      if (filters.acknowledged) {
        conditions.push(sql`${alertEventsV2.ackBy} IS NOT NULL`);
      } else {
        conditions.push(sql`${alertEventsV2.ackBy} IS NULL`);
      }
    }
    return db.select().from(alertEventsV2)
      .where(and(...conditions))
      .orderBy(desc(alertEventsV2.createdAt));
  }

  async getAlertEvent(aeuuid: string): Promise<AlertEventV2 | undefined> {
    const db = getDb();
    const result = await db.select().from(alertEventsV2)
      .where(and(eq(alertEventsV2.aeuuid, aeuuid), eq(alertEventsV2.isDeleted, false)));
    return result[0];
  }

  async createAlertEvent(event: InsertAlertEventV2): Promise<AlertEventV2> {
    const db = getDb();
    const [created] = await db.insert(alertEventsV2).values({
      ...event,
      aeuuid: event.aeuuid || sql`gen_random_uuid()::text`,
    }).returning();
    return created;
  }

  async acknowledgeAlertEvent(aeuuid: string, userId: string): Promise<AlertEventV2> {
    const db = getDb();
    const [updated] = await db.update(alertEventsV2)
      .set({ ackBy: userId, ackAt: new Date(), updatedAt: new Date() })
      .where(eq(alertEventsV2.aeuuid, aeuuid))
      .returning();
    if (!updated) throw new Error(`Alert event ${aeuuid} not found`);
    return updated;
  }

  async getUnacknowledgedAlertEventsForRole(userType: string, roleName: string | null): Promise<AlertEventV2[]> {
    const db = getDb();
    const conditions: any[] = [
      sql`${alertEventsV2.ackBy} IS NULL`,
      eq(alertEventsV2.isDeleted, false)
    ];

    const normUserType = userType.toLowerCase();
    const normRoleName = roleName ? roleName.toLowerCase() : "";

    // Admin userType or role sees all alerts
        // Admin role sees all alerts
    if (
      normRoleName === 'admin' ||
      normRoleName === 'sail admin' ||
      normRoleName === 'super admin'
    ) {
      return db.select().from(alertEventsV2)
        .where(and(...conditions))
        .orderBy(desc(alertEventsV2.createdAt));
    }

    // Get all enabled policies
    const policies = await db.select().from(alertPoliciesV2)
      .where(and(eq(alertPoliciesV2.enabled, true), eq(alertPoliciesV2.isDeleted, false)));

    const allowedPolicyUuids: string[] = [];
    for (const policy of policies) {
      try {
        const recipients = JSON.parse(policy.recipients || '{}');
        const roles: string[] = (recipients.roles || []).map((r: string) => r.toLowerCase());
        
        if (roles.includes(normUserType) || (normRoleName && roles.includes(normRoleName))) {
          allowedPolicyUuids.push(policy.apuuid);
        }
      } catch {
        // Skip invalid JSON policies
      }
    }

    if (allowedPolicyUuids.length === 0) {
      return [];
    }

    conditions.push(
      sql`${alertEventsV2.policyUuid} IN (${sql.join(allowedPolicyUuids.map(u => sql`${u}`), sql`, `)})`
    );

    return db.select().from(alertEventsV2)
      .where(and(...conditions))
      .orderBy(desc(alertEventsV2.createdAt));
  }
}
