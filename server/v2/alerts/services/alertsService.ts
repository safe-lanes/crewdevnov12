import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { AlertsRepository } from "../repositories/alertsRepository";
import { type AlertPolicyV2, type AlertEventV2 } from "../../../../shared/v2/alerts/schema";
import { crewMembersV2, crewVisas, crewDocuments } from "../../../../shared/v2/crew-pool/schema";
import { vesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { masterVessels } from "../../../../shared/schema";
import { differenceInDays } from "date-fns";

const alertsRepository = new AlertsRepository();

export class AlertsService {
  async getUnacknowledgedAlertEventsForRole(userType: string, roleName: string | null): Promise<AlertEventV2[]> {
    return await alertsRepository.getUnacknowledgedAlertEventsForRole(userType, roleName);
  }

  async acknowledgeAlertEvent(aeuuid: string, userId: string): Promise<AlertEventV2> {
    return await alertsRepository.acknowledgeAlertEvent(aeuuid, userId);
  }

  async runScan(): Promise<{
    visaAlerts: number;
    docAlerts: number;
    reliefAlerts: number;
    totalCreated: number;
  }> {
    if (tenantConnectionManager.isMultiTenantEnabled) {
      const activeTenantIds = await tenantConnectionManager.getActiveTenants();
      console.log(`[AlertsService] Running multi-tenant alert scan for ${activeTenantIds.length} tenants...`);
      const totalResults = { visaAlerts: 0, docAlerts: 0, reliefAlerts: 0, totalCreated: 0 };

      for (const tenantId of activeTenantIds) {
        try {
          await tenantConnectionManager.runInTenantContext(tenantId, async () => {
            const tenantRes = await this.runScanForCurrentTenant();
            totalResults.visaAlerts += tenantRes.visaAlerts;
            totalResults.docAlerts += tenantRes.docAlerts;
            totalResults.reliefAlerts += tenantRes.reliefAlerts;
            totalResults.totalCreated += tenantRes.totalCreated;
          });
        } catch (err) {
          console.error(`[AlertsService] Alert scan failed for tenant ${tenantId}:`, err);
        }
      }
      return totalResults;
    } else {
      return await this.runScanForCurrentTenant();
    }
  }

  private async runScanForCurrentTenant(): Promise<{
    visaAlerts: number;
    docAlerts: number;
    reliefAlerts: number;
    totalCreated: number;
  }> {
    const results = {
      visaAlerts: 0,
      docAlerts: 0,
      reliefAlerts: 0,
      totalCreated: 0,
    };

    const db = getDb();

    // 1. Get enabled policies
    const policies = await alertsRepository.getAlertPolicies();
    const enabledPolicies = policies.filter((p: AlertPolicyV2) => p.enabled);

    const policyMap = new Map<string, AlertPolicyV2>();
    for (const p of enabledPolicies) {
      policyMap.set(p.alertType, p);
    }

    // 2. Fetch all alert events to build deduplication sets
    const existingEvents = await alertsRepository.getAlertEvents();
    const existingDedupeKeys = new Set(existingEvents.map(e => e.dedupeKey));

    // 3. Fetch active crew members from crewMembersV2
    const crewMembers = await db.select()
      .from(crewMembersV2)
      .where(and(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.archivedAt)));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 4. Evaluate Visas
    const visaPolicy = policyMap.get('visa_expiration');
    if (visaPolicy) {
      const visaDaysThreshold = JSON.parse(visaPolicy.thresholds || '{}').daysBefore ?? 30;
      // Fetch visas
      const visas = await db.select()
        .from(crewVisas)
        .where(eq(crewVisas.isDeleted, false));

      // Build map of crewUuid -> list of visas
      const visaMapByCrew = new Map<string, typeof visas>();
      for (const visa of visas) {
        if (visa.crewUuid) {
          const list = visaMapByCrew.get(visa.crewUuid) || [];
          list.push(visa);
          visaMapByCrew.set(visa.crewUuid, list);
        }
      }

      for (const crew of crewMembers) {
        const crewVisas = visaMapByCrew.get(crew.crewUuid) || [];
        const crewName = `${crew.firstName || ''} ${crew.familyName || ''}`.trim();

        for (const visa of crewVisas) {
          if (visa.expiry) {
            const expiryDate = new Date(visa.expiry);
            if (!isNaN(expiryDate.getTime())) {
              const daysLeft = differenceInDays(expiryDate, today);
              if (daysLeft <= visaDaysThreshold && daysLeft >= -90) {
                const dedupeKey = `visa-${crew.crewUuid}-${visa.visaType}-${visa.expiry}`;
                if (!existingDedupeKeys.has(dedupeKey)) {
                  const alertState = daysLeft < 0 ? 'expired' : 'expiring';
                  const message = daysLeft < 0
                    ? `Visa (${visa.visaType}) for crew member ${crewName} has expired on ${visa.expiry}.`
                    : `Visa (${visa.visaType}) for crew member ${crewName} is expiring in ${daysLeft} days (on ${visa.expiry}).`;

                  await alertsRepository.createAlertEvent({
                    policyUuid: visaPolicy.apuuid,
                    alertType: 'visa_expiration',
                    priority: visaPolicy.priority,
                    objectType: 'crew_member',
                    objectId: crew.crewUuid,
                    dedupeKey,
                    state: alertState,
                    payload: JSON.stringify({
                      alertMessage: message,
                      crewName,
                      crewId: crew.crewUuid,
                      visaType: visa.visaType,
                      expiryDate: visa.expiry,
                      link: `/crew-pool`
                    }),
                    createdByUuid: 'system',
                    isDeleted: false,
                    isSync: false,
                  });
                  existingDedupeKeys.add(dedupeKey);
                  results.visaAlerts++;
                }
              }
            }
          }
        }
      }
    }

    // 5. Evaluate Documents
    const docPolicy = policyMap.get('document_expiration');
    if (docPolicy) {
      const docDaysThreshold = JSON.parse(docPolicy.thresholds || '{}').daysBefore ?? 30;
      // Fetch documents
      const docs = await db.select()
        .from(crewDocuments)
        .where(eq(crewDocuments.isDeleted, false));

      const docMapByCrew = new Map<string, typeof docs>();
      for (const doc of docs) {
        if (doc.crewUuid) {
          const list = docMapByCrew.get(doc.crewUuid) || [];
          list.push(doc);
          docMapByCrew.set(doc.crewUuid, list);
        }
      }

      for (const crew of crewMembers) {
        const crewDocs = docMapByCrew.get(crew.crewUuid) || [];
        const crewName = `${crew.firstName || ''} ${crew.familyName || ''}`.trim();

        for (const doc of crewDocs) {
          if (doc.expiry) {
            const expiryDate = new Date(doc.expiry);
            if (!isNaN(expiryDate.getTime())) {
              const daysLeft = differenceInDays(expiryDate, today);
              if (daysLeft <= docDaysThreshold && daysLeft >= -90) {
                const dedupeKey = `doc-${crew.crewUuid}-${doc.docUuid}-${doc.expiry}`;
                if (!existingDedupeKeys.has(dedupeKey)) {
                  try {
                    const alertState = daysLeft < 0 ? 'expired' : 'expiring';
                    const message = daysLeft < 0
                      ? `Document (${doc.documentName}) for crew member ${crewName} has expired on ${doc.expiry}.`
                      : `Document (${doc.documentName}) for crew member ${crewName} is expiring in ${daysLeft} days (on ${doc.expiry}).`;

                    await alertsRepository.createAlertEvent({
                      policyUuid: docPolicy.apuuid,
                      alertType: 'document_expiration',
                      priority: docPolicy.priority,
                      objectType: 'crew_member',
                      objectId: crew.crewUuid,
                      dedupeKey,
                      state: alertState,
                      payload: JSON.stringify({
                        alertMessage: message,
                        crewName,
                        crewId: crew.crewUuid,
                        documentName: doc.documentName,
                        expiryDate: doc.expiry,
                        link: `/crew-pool`
                      }),
                      createdByUuid: 'system',
                      isDeleted: false,
                      isSync: false,
                    });
                    existingDedupeKeys.add(dedupeKey);
                    results.docAlerts++;
                  } catch (err) {
                    console.error(`[AlertsService] Failed to create document_expiration alert for crew ${crew.crewUuid}, doc ${doc.docUuid}:`, err);
                  }
                }
              }
            }
          }
        }
      }
    }

    // 6. Evaluate Relief Due (Vessel Planning)
    const reliefPolicy = policyMap.get('relief_due');
    if (reliefPolicy) {
      const reliefDaysThreshold = JSON.parse(reliefPolicy.thresholds || '{}').daysBefore ?? 14;

      // Join vesselPlanningV2 with masterVessels to resolve vessel names
      const allPlannings = await db.select({
        id: vesselPlanningV2.id,
        vesselUuid: vesselPlanningV2.vesselUuid,
        crewUuid: vesselPlanningV2.crewUuid,
        reliefDue: vesselPlanningV2.reliefDue,
        vesselName: masterVessels.vessel,
      })
      .from(vesselPlanningV2)
      .leftJoin(masterVessels, eq(vesselPlanningV2.vesselUuid, masterVessels.vesselUuid))
      .where(and(eq(vesselPlanningV2.isDeleted, false), eq(vesselPlanningV2.isArchived, false)));

      // Build map of crewUuid -> crew for lookup
      const crewMapByUuid = new Map(crewMembers.map(c => [c.crewUuid, c]));

      for (const planning of allPlannings) {
        if (planning.reliefDue && planning.crewUuid) {
          const reliefDate = new Date(planning.reliefDue);
          if (!isNaN(reliefDate.getTime())) {
            const daysLeft = differenceInDays(reliefDate, today);
            if (daysLeft <= reliefDaysThreshold && daysLeft >= -90) {
              const crew = crewMapByUuid.get(planning.crewUuid);
              const crewName = crew ? `${crew.firstName || ''} ${crew.familyName || ''}`.trim() : 'Unknown';
              const dedupeKey = `relief-${planning.id}-${planning.crewUuid}-${planning.reliefDue}`;

              if (!existingDedupeKeys.has(dedupeKey)) {
                const alertState = daysLeft < 0 ? 'overdue' : 'due';
                const vesselDisplayName = planning.vesselName || planning.vesselUuid;
                const message = daysLeft < 0
                  ? `Relief for crew member ${crewName} on vessel ${vesselDisplayName} was due on ${planning.reliefDue}.`
                  : `Relief for crew member ${crewName} on vessel ${vesselDisplayName} is due in ${daysLeft} days (on ${planning.reliefDue}).`;

                await alertsRepository.createAlertEvent({
                  policyUuid: reliefPolicy.apuuid,
                  alertType: 'relief_due',
                  priority: reliefPolicy.priority,
                  objectType: 'vessel_planning',
                  objectId: String(planning.id),
                  dedupeKey,
                  state: alertState,
                  payload: JSON.stringify({
                    alertMessage: message,
                    crewName,
                    crewId: planning.crewUuid,
                    vesselId: planning.vesselUuid,
                    vesselName: planning.vesselName,
                    reliefDue: planning.reliefDue,
                    link: `/vessel`
                  }),
                  createdByUuid: 'system',
                  isDeleted: false,
                  isSync: false,
                });
                existingDedupeKeys.add(dedupeKey);
                results.reliefAlerts++;
              }
            }
          }
        }
      }
    }

    results.totalCreated = results.visaAlerts + results.docAlerts + results.reliefAlerts;
    return results;
  }
}
