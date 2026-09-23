import { Request, Response } from "express";
import { z } from "zod";
import {
  collections,
  collectionSchemas,
  isCollectionName,
  isReadonlyCollectionRecord,
  isSingletonSection,
  singletonSchemas,
  type CollectionName,
} from "./adapters";
import { crewProfileService } from "../../crew-pool/services";
import {
  CrewDocumentsRepository,
  CrewVisasRepository,
  CrewEducationRepository,
  CrewLicensesRepository,
  CrewTrainingRepository,
  CrewSeaServiceRepository,
  CrewMedicalRepository,
  CrewBriefingRepository,
} from "../../crew-pool/repositories";
import { MastersRepository } from "../../masters/repositories/mastersRepository";
import { pendingChangesRepository } from "./pendingChangesRepository";
import { stageChange } from "./pendingChangesService";
import type { AppCrewPendingChange } from "../../../../shared/v2/crew-app/types";

const mastersRepository = new MastersRepository();

// Used by getInformation() below, to fetch each collection directly instead
// of through its service's getAll()/getLicenses()/etc. — those each
// redundantly re-verify the crew exists (crewMembersService.getByUuid) before
// their real query. getFullProfile() already does that check once, as one of
// the same Promise.all below, so 10 more identical existence-check queries
// firing alongside it is pure waste on this app's most-loaded endpoint.
// infoLicensesRepository/infoTrainingRepository are also reused by
// attachmentsByCollection below (DELETE's per-record attachment lookup).
const infoDocumentsRepository = new CrewDocumentsRepository();
const infoVisasRepository = new CrewVisasRepository();
const infoEducationRepository = new CrewEducationRepository();
const infoLicensesRepository = new CrewLicensesRepository();
const infoTrainingRepository = new CrewTrainingRepository();
const infoSeaServiceRepository = new CrewSeaServiceRepository();
const infoMedicalRepository = new CrewMedicalRepository();
const infoBriefingRepository = new CrewBriefingRepository();

/** Remove fields which can disclose server identity, storage, or audit internals. */
export function sanitize(value: any): any {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value instanceof Date) return value.toISOString();
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (normalized === "id" || normalized === "crewuuid" ||
        normalized === "filepath" || normalized === "filedata" ||
        normalized === "attachmentref" || normalized === "attachments" ||
        normalized === "createdbyuuid" || normalized === "updatedbyuuid" ||
        normalized === "createdat" || normalized === "updatedat" ||
        normalized === "archivedat" ||
        normalized === "uploadedphoto" || normalized === "isdeleted" ||
        normalized === "issync") continue;
    out[key] = sanitize(val);
  }
  return out;
}

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw Object.assign(new Error("Invalid request body"), {
      status: 400,
      details: result.error.flatten(),
    });
  }
  return result.data;
}

function sendError(res: Response, error: any): void {
  const status = error?.status ??
    (String(error?.message).toLowerCase().includes("not found") ? 404 : 400);
  res.status(status).json({
    error: status === 404 ? "not_found" : "invalid_request",
    message: error?.message || "Request failed",
    ...(error?.details ? { details: error.details } : {}),
  });
}

function readonlyRecord(row: any, readOnly: boolean, hardReadOnly = false): any {
  // `readOnly` blocks the whole record (field edits) — true for the
  // pre-existing hard-readonly cases (archived license, company sea-service)
  // AND whenever a submission is awaiting/pending office review.
  // `hardReadOnly` is the narrower, pre-existing case only — attachments stay
  // live-writable on an already-published record even while a *field* edit
  // on it is pending review (see attachmentController.ts: attachment
  // add/remove on an existing canonical record is intentionally not gated).
  return { ...sanitize(row), readOnly, hardReadOnly };
}

/** Collection-row response helper: derives both readOnly flags from one place instead of repeating the isReadonlyCollectionRecord(...) || reviewStatus expression per collection. */
function collectionRow(name: CollectionName, row: any): any {
  const hard = isReadonlyCollectionRecord(name, row);
  return readonlyRecord(row, hard || Boolean(row.reviewStatus), hard);
}

/**
 * Overlays a crew member's own open (pending) submissions onto a canonical
 * collection listing — a pending 'create' becomes a synthetic row keyed by
 * its pendingUuid (so the mobile app's existing idOf()/attachment flow keeps
 * working unchanged), a pending 'update'/'delete' flags the matching
 * canonical row as awaiting review. Nothing here touches the canonical rows
 * themselves — only what this crew member's own request sees.
 */
function overlayPending(name: CollectionName, canonicalRows: any[], pending: AppCrewPendingChange[]): any[] {
  const primaryKey = collections[name].primaryKey;
  const overlaid = canonicalRows.map(row => ({ ...row }));
  const byTarget = new Map(overlaid.map(row => [row[primaryKey], row]));
  const extra: any[] = [];

  for (const change of pending) {
    if (change.section !== name) continue;
    if (change.action === "create") {
      extra.push({
        ...JSON.parse(change.payload || "{}"),
        [primaryKey]: change.pendingUuid,
        uuid: change.pendingUuid,
        reviewStatus: "pending",
        pendingUuid: change.pendingUuid,
      });
      continue;
    }
    const target = change.targetUuid ? byTarget.get(change.targetUuid) : undefined;
    if (!target) continue;
    target.reviewStatus = change.action === "delete" ? "pending_delete" : "pending";
    target.pendingUuid = change.pendingUuid;
  }
  return [...overlaid, ...extra];
}

export async function getInformation(req: Request, res: Response): Promise<void> {
  try {
    const crewUuid = req.crewUser!.crewUuid;
    const domain = req.crewUser!.domain;
    const [
      profile, documents, visas, education, licenses, training, seaService,
      medicals, doctorVisits, briefings, debriefings, openPending, recentSubmissions,
    ] = await Promise.all([
      crewProfileService.getFullProfile(crewUuid),
      infoDocumentsRepository.findByCrewUuidWithAttachments(crewUuid),
      infoVisasRepository.findByCrewUuidWithAttachments(crewUuid),
      infoEducationRepository.findByCrewUuidWithAttachments(crewUuid),
      infoLicensesRepository.findByCrewUuidWithAttachments(crewUuid),
      infoTrainingRepository.findByCrewUuidWithAttachments(crewUuid),
      infoSeaServiceRepository.findByCrewUuidWithAttachments(crewUuid),
      infoMedicalRepository.findMedicalsByCrewUuidWithAttachments(crewUuid),
      infoMedicalRepository.findVisitsByCrewUuidWithAttachments(crewUuid),
      infoBriefingRepository.findBriefingsByCrewUuidWithAttachments(crewUuid),
      infoBriefingRepository.findDebriefingsByCrewUuidWithAttachments(crewUuid),
      // Open (pending) rows only — used below to overlay status onto the
      // live sections. Kept separate from recentSubmissions (which also
      // includes approved/rejected rows) so a stale rejected row can never
      // shadow a fresh pending edit on the same record — see overlayPending.
      pendingChangesRepository.listOpenForCrew(crewUuid, domain),
      pendingChangesRepository.listRecentForCrew(crewUuid, domain),
    ]);

    const pendingSingleton = (section: string) => openPending.find(p => p.section === section);
    const singletonOverlay = (row: any, section: string) => {
      const change = pendingSingleton(section);
      return change ? { ...row, reviewStatus: "pending", pendingUuid: change.pendingUuid, pendingValues: sanitize(JSON.parse(change.payload || "{}")) } : row;
    };
    // "family" and "next-of-kin" are independently staged sections (each
    // with its own dedup/apply), but the mobile app nests both under one
    // `sections.family` object (`.info` / `.nextOfKin`) — so each is
    // overlaid onto its own nested key rather than the shared parent.
    const familyRow: any = sanitize(profile.family) ?? {};
    const familyPending = pendingSingleton("family");
    const nextOfKinPending = pendingSingleton("next-of-kin");
    const familySection = {
      ...familyRow,
      ...(familyPending ? { info: singletonOverlay(familyRow.info, "family") } : {}),
      ...(nextOfKinPending ? { nextOfKin: singletonOverlay(familyRow.nextOfKin, "next-of-kin") } : {}),
    };

    res.json({
      sections: {
        particulars: singletonOverlay(sanitize(profile.crew), "particulars"),
        assignment: profile.currentAssignment
          ? readonlyRecord(profile.currentAssignment, true)
          : null,
        personal: singletonOverlay(sanitize(profile.personalDetails) ?? null, "personal"),
        contact: singletonOverlay(sanitize(profile.address) ?? null, "contact"),
        family: familySection,
        vesselTypes: sanitize(profile.vesselTypes),
        travelDocuments: overlayPending("documents", documents, openPending).map(row => collectionRow("documents", row)),
        visas: overlayPending("visas", visas, openPending).map(row => collectionRow("visas", row)),
        education: overlayPending("education", education, openPending).map(row => collectionRow("education", row)),
        licenses: overlayPending("licenses", licenses, openPending).map(row => collectionRow("licenses", row)),
        training: overlayPending("training", training, openPending).map(row => collectionRow("training", row)),
        seaService: overlayPending("sea-service", seaService, openPending).map(row => collectionRow("sea-service", row)),
        medicals: medicals.map(row => readonlyRecord(row, true)),
        doctorVisits: doctorVisits.map(row => readonlyRecord(row, true)),
        briefings: briefings.map(row => readonlyRecord(row, true)),
        debriefings: debriefings.map(row => readonlyRecord(row, true)),
      },
      // Requirement 1, crew-facing side: every submission this crew member
      // has made recently, whatever its outcome — including *why* one was
      // rejected. Deliberately separate from the `sections` overlay above
      // (which only reflects currently-open pending edits) so a rejection
      // can be shown here without risking it shadowing a fresh resubmission
      // in the live record lists.
      recentSubmissions: recentSubmissions.map(change => ({
        pendingUuid: change.pendingUuid,
        section: change.section,
        action: change.action,
        status: change.status,
        rejectionReason: change.rejectionReason,
        submittedAt: change.createdAt,
        reviewedAt: change.reviewedAt,
      })),
      permissions: {
        writableSingletons: ["particulars", "personal", "contact", "family", "next-of-kin", "vessel-types"],
        writableCollections: ["children", "documents", "visas", "education", "licenses", "training", "sea-service"],
        attachments: true,
        attachmentRules: {
          readableCollections: ["documents", "visas", "education", "licenses", "training", "sea-service", "medicals", "doctor-visits", "briefings", "debriefings"],
          writableCollections: ["documents", "visas", "education", "licenses", "training", "sea-service"],
          allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
          maxBytes: 5 * 1024 * 1024,
        },
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getCrewInformationMasters(_req: Request, res: Response): Promise<void> {
  try {
    const definitions = [
      ["nationalities", "natUuid", ["nationality", "countryName"]],
      ["countries", "countryUuid", ["countryName"]],
      ["languages", "langUuid", ["languageName", "nativeName"]],
      ["vesselTypes", "vtUuid", ["vesselType"]],
      ["vessels", "vesselUuid", ["vessel"]],
    ] as const;
    const rows = await Promise.all(definitions.map(([type]) => mastersRepository.getMasterData(type)));
    const masters = Object.fromEntries(definitions.map(([type, valueKey, labelKeys], index) => [
      type,
      rows[index]
        .filter((row: any) => !row.isDeleted && row.isActive !== false)
        .map((row: any) => ({
          value: String(row[valueKey] ?? ""),
          label: String(labelKeys.map((key) => row[key]).find(Boolean) ?? ""),
        }))
        .filter((option) => option.value && option.label),
    ]));
    res.json(masters);
  } catch (error) {
    sendError(res, error);
  }
}

/** Requirement 1: every crew-submitted profile edit is staged for office verification (unless this tenant has the gate switched off) rather than written straight into the canonical crew record. */
export async function updateSection(req: Request, res: Response): Promise<void> {
  try {
    const crewUuid = req.crewUser!.crewUuid;
    const domain = req.crewUser!.domain;
    const section = req.params.section;
    if (!isSingletonSection(section)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const body = parse(singletonSchemas[section], req.body);
    const { autoApplied, appliedResult, pendingChange } = await stageChange({
      domain, crewUuid, section, action: "update", payload: body,
    });
    res.json(autoApplied
      ? sanitize(appliedResult)
      : { ...sanitize(body), reviewStatus: "pending", pendingUuid: pendingChange.pendingUuid });
  } catch (error) {
    sendError(res, error);
  }
}

export async function collectionHandler(req: Request, res: Response): Promise<void> {
  try {
    const name = req.params.collection;
    if (!isCollectionName(name)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const adapter = collections[name];
    const crewUuid = req.crewUser!.crewUuid;
    const domain = req.crewUser!.domain;

    if (req.method === "GET") {
      const [rows, openPending] = await Promise.all([
        adapter.list(crewUuid),
        pendingChangesRepository.listOpenForCrew(crewUuid, domain),
      ]);
      const overlaid = overlayPending(name, rows, openPending);
      res.json(overlaid.map(row => collectionRow(name, row)));
      return;
    }
    if (req.method === "POST") {
      const body = parse(collectionSchemas[name], req.body);
      const { autoApplied, appliedResult, pendingChange } = await stageChange({
        domain, crewUuid, section: name, action: "create", payload: body,
      });
      res.status(201).json(autoApplied
        ? readonlyRecord(appliedResult, false)
        : readonlyRecord({ ...body, [adapter.primaryKey]: pendingChange.pendingUuid, uuid: pendingChange.pendingUuid, reviewStatus: "pending", pendingUuid: pendingChange.pendingUuid }, true));
      return;
    }

    let target: any;
    try {
      target = await adapter.get(req.params.uuid, crewUuid);
    } catch {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!target || target.crewUuid !== crewUuid) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (isReadonlyCollectionRecord(name, target)) {
      res.status(409).json({ error: "readonly_record" });
      return;
    }

    if (req.method === "DELETE") {
      const { autoApplied, pendingChange } = await stageChange({
        domain, crewUuid, section: name, action: "delete", targetUuid: req.params.uuid, payload: {},
      });
      if (autoApplied) {
        res.status(204).send();
      } else {
        res.status(202).json({ status: "pending_delete", pendingUuid: pendingChange.pendingUuid });
      }
      return;
    }

    const body = parse(collectionSchemas[name].partial().strict(), req.body);
    const { autoApplied, appliedResult, pendingChange } = await stageChange({
      domain, crewUuid, section: name, action: "update", targetUuid: req.params.uuid, payload: body,
    });
    res.json(autoApplied
      ? readonlyRecord(appliedResult, false)
      : readonlyRecord({ ...target, ...body, reviewStatus: "pending", pendingUuid: pendingChange.pendingUuid }, true));
  } catch (error) {
    sendError(res, error);
  }
}
