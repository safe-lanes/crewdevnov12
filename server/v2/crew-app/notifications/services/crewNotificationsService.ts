import { eq } from "drizzle-orm";
import { differenceInDays } from "date-fns";
import { getDb } from "../../../db";
import { tenantConnectionManager } from "../../../../utils/tenantConnectionManager";
import { CrewNotificationsRepository } from "../repositories";
import type { NewNotification } from "../repositories";
import { CrewCredentialsRepository } from "../../auth/repositories";
import { crewVisas, crewDocuments } from "../../../../../shared/v2/crew-pool/schema";
import { paginate, type PageParams } from "../../pagination";
import { notFound } from "../../errors";

const crewNotificationsRepository = new CrewNotificationsRepository();
const crewCredentialsRepository = new CrewCredentialsRepository();

const EXPIRY_WARNING_DAYS = parseInt(process.env.CREW_APP_NOTIFICATION_EXPIRY_DAYS || "30", 10);

export const crewNotificationsService = {
  /** Runs inside the tenant context established by crewAuthMiddleware. */
  async list(crewUuid: string, domain: string, page: PageParams) {
    return paginate(page, (limit, offset) => crewNotificationsRepository.listForCrew(crewUuid, domain, limit, offset));
  },

  async unreadCount(crewUuid: string, domain: string) {
    return crewNotificationsRepository.unreadCountForCrew(crewUuid, domain);
  },

  async markRead(notificationUuid: string, crewUuid: string) {
    const updated = await crewNotificationsRepository.markRead(notificationUuid, crewUuid);
    if (!updated) {
      throw notFound("Notification not found");
    }
  },

  async markAllRead(crewUuid: string, domain: string) {
    await crewNotificationsRepository.markAllRead(crewUuid, domain);
  },

  /** Entry point for the background scanner — handles single- and multi-tenant. */
  async runScan(): Promise<{ tenantsScanned: number; notificationsCreated: number }> {
    if (tenantConnectionManager.isMultiTenantEnabled) {
      const activeTenantIds = await tenantConnectionManager.getActiveTenants();
      let notificationsCreated = 0;
      for (const tuid of activeTenantIds) {
        try {
          notificationsCreated += await tenantConnectionManager.runInTenantContext(tuid, () =>
            crewNotificationsService.runScanForCurrentTenant(),
          );
        } catch (err) {
          console.error(`[crewNotificationsService] Scan failed for tenant '${tuid}':`, err);
        }
      }
      return { tenantsScanned: activeTenantIds.length, notificationsCreated };
    }

    const notificationsCreated = await crewNotificationsService.runScanForCurrentTenant();
    return { tenantsScanned: 1, notificationsCreated };
  },

  async runScanForCurrentTenant(): Promise<number> {
    const db = getDb();
    // Only crew who actually have an app account are worth notifying.
    const activeCredentials = await crewCredentialsRepository.listAllActive();
    if (activeCredentials.length === 0) return 0;
    const credentialByCrewUuid = new Map(activeCredentials.map((c) => [c.crewUuid, c]));

    const [visas, documents] = await Promise.all([
      db.select().from(crewVisas).where(eq(crewVisas.isDeleted, false)),
      db.select().from(crewDocuments).where(eq(crewDocuments.isDeleted, false)),
    ]);

    const today = new Date();
    const rows: NewNotification[] = [];

    for (const visa of visas) {
      const credential = credentialByCrewUuid.get(visa.crewUuid);
      if (!credential || !visa.expiry) continue;
      const expiryDate = new Date(visa.expiry);
      if (isNaN(expiryDate.getTime())) continue;
      const daysLeft = differenceInDays(expiryDate, today);
      if (daysLeft > EXPIRY_WARNING_DAYS) continue;

      rows.push({
        domain: credential.domain,
        crewUuid: visa.crewUuid,
        notificationType: "visa_expiry",
        title: daysLeft < 0 ? `Visa (${visa.visaType ?? ""}) has expired` : `Visa (${visa.visaType ?? ""}) expiring soon`,
        body:
          daysLeft < 0
            ? `Your visa expired on ${visa.expiry}.`
            : `Your visa is expiring in ${daysLeft} day(s), on ${visa.expiry}.`,
        sourceRefUuid: visa.visaUuid,
        dedupeKey: `visa-${visa.crewUuid}-${visa.visaUuid}-${visa.expiry}`,
      });
    }

    for (const doc of documents) {
      const credential = credentialByCrewUuid.get(doc.crewUuid);
      if (!credential || !doc.expiry) continue;
      const expiryDate = new Date(doc.expiry);
      if (isNaN(expiryDate.getTime())) continue;
      const daysLeft = differenceInDays(expiryDate, today);
      if (daysLeft > EXPIRY_WARNING_DAYS) continue;

      rows.push({
        domain: credential.domain,
        crewUuid: doc.crewUuid,
        notificationType: "document_expiry",
        title:
          daysLeft < 0 ? `Document (${doc.documentName ?? ""}) has expired` : `Document (${doc.documentName ?? ""}) expiring soon`,
        body:
          daysLeft < 0
            ? `Your document expired on ${doc.expiry}.`
            : `Your document is expiring in ${daysLeft} day(s), on ${doc.expiry}.`,
        sourceRefUuid: doc.docUuid,
        dedupeKey: `doc-${doc.crewUuid}-${doc.docUuid}-${doc.expiry}`,
      });
    }

    return crewNotificationsRepository.insertManyIfNotExists(rows);
  },
};
