import type { RequestHandler } from "express";
import { getActor } from "../controllers/_auth";
import { assertVesselScope } from "../services/vesselScope";
import { allotmentsService } from "../services/allotmentsService";
import { advancesService } from "../services/advancesService";
import { EngagementsRepository } from "../repositories";

const engagements = new EngagementsRepository();

const DATE_MESSAGE =
  "The Date that you entered lies inside the locked period, please select a different date";

type Kind = "allotment" | "advance";

type Action =
  | "create"
  | "update"
  | "suspend"
  | "reactivate"
  | "end"
  | "cancel"
  | "close"
  | "delete";

type CashRecord = Record<string, any>;

function validPeriod(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    Number(value.slice(0, 4)) > 0
  );
}

function isCanonicalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match =
    /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1) return false;

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function failure(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code });
}

async function assertOpen(vesselUuid: string, period: string) {
  const locked = await engagements.findLockedPeriods(vesselUuid, [period]);

  if (locked.has(period)) {
    throw failure(409, "PERIOD_LOCKED", "Period locked — read only");
  }
}

/**
 * Match the existing listing's vessel resolution.
 * Do not trust a vessel supplied in the mutation body.
 */
async function resolveVessel(
  kind: Kind,
  record: CashRecord,
): Promise<string | null> {
  if (kind === "advance") {
    if (typeof record.engagementUuid !== "string") return null;

    const rows = await engagements.findByUuids([record.engagementUuid]);
    return rows[0]?.vesselUuid ?? null;
  }

  if (typeof record.crewUuid !== "string") return null;

  const rows = await engagements.findByCrewUuids([record.crewUuid]);
  const explicit = record.engagementUuid
    ? rows.find((row) => row.engagementUuid === record.engagementUuid)
    : undefined;

  if (explicit) return explicit.vesselUuid ?? null;

  let fallback: (typeof rows)[number] | undefined;

  for (const row of rows) {
    if (row.status === "cancelled") continue;

    if (
      !fallback ||
      (row.status === "active" && fallback.status !== "active") ||
      (row.status === fallback.status &&
        (row.startDate ?? "") > (fallback.startDate ?? ""))
    ) {
      fallback = row;
    }
  }

  return fallback?.vesselUuid ?? null;
}

async function existingRecord(
  kind: Kind,
  uuid: string,
): Promise<CashRecord> {
  if (kind === "allotment") {
    const record = await allotmentsService.getByUuid(uuid);
    const rows = await allotmentsService.getAll({
      crewUuid: record.crewUuid,
    });
    const enriched = rows.find((row) => row.allotmentUuid === uuid);

    if (enriched) return enriched;
  } else {
    const record = await advancesService.getByUuid(uuid);
    const rows = await advancesService.getAll({
      crewUuid: record.crewUuid,
    });
    const enriched = rows.find((row) => row.advanceUuid === uuid);

    if (enriched) return enriched;
  }

  throw failure(404, "NOT_FOUND", "Record not found");
}

/**
 * Optional read mode on the existing Portage GET route.
 * Normal Portage requests continue to their existing controller.
 */
export const cashLockedPeriods: RequestHandler = async (req, res, next) => {
  if (req.query.lockedPeriodsOnly !== "true") {
    next();
    return;
  }

  try {
    const vesselUuid = req.query.vesselUuid;

    if (typeof vesselUuid !== "string" || !vesselUuid) {
      throw failure(400, "VALIDATION", "vesselUuid is required");
    }

    assertVesselScope(getActor(req), vesselUuid);

    const periods = await engagements.findLockedPeriods(vesselUuid);
    res.json([...periods].sort());
  } catch (error: any) {
    const status =
      error.status ?? (error.code === "FORBIDDEN" ? 403 : 500);

    if (status === 500) console.error("Failed to load locked periods:", error);

    res.status(status).json({
      error: status === 500 ? "Failed to load locked periods" : error.message,
      code: error.code,
    });
  }
};

export function cashPeriodLock(
  kind: Kind,
  action: Action,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const vesselUuid = req.query.vesselUuid;
      const period = req.query.period;

      if (
        typeof vesselUuid !== "string" ||
        !vesselUuid ||
        !validPeriod(period)
      ) {
        throw failure(
          400,
          "VALIDATION",
          "A selected vessel and valid period are required",
        );
      }

      assertVesselScope(getActor(req), vesselUuid);

      const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? req.body
          : {};

      const existing =
        action === "create"
          ? undefined
          : await existingRecord(kind, req.params.uuid);

      if (existing) {
        if (existing.vesselUuid !== vesselUuid) {
          throw failure(
            400,
            "VALIDATION",
            "The record does not belong to the selected vessel",
          );
        }

        // Match the existing listing's period boundaries.
        if (
          (existing.validFrom &&
            existing.validFrom.slice(0, 7) > period) ||
          (existing.validTo &&
            existing.validTo.slice(0, 7) < period)
        ) {
          throw failure(
            400,
            "VALIDATION",
            "The record is not available in the selected period",
          );
        }
      }

      await assertOpen(vesselUuid, period);

      if (kind === "advance") {
        const actionPeriod =
          action === "create"
            ? body.period
            : action === "cancel"
              ? body.cancelledPeriod
              : action === "close"
                ? body.writeOffPeriod
                : undefined;

        if (
          (action === "create" ||
            action === "cancel" ||
            action === "close") &&
          actionPeriod !== period
        ) {
          throw failure(
            400,
            "VALIDATION",
            "The action period must match the selected period",
          );
        }
      }

      if (action === "create" || action === "update") {
        const candidate = { ...existing, ...body };
        const targetVessel = await resolveVessel(kind, candidate);

        if (!targetVessel) {
          throw failure(
            400,
            "VALIDATION",
            "The record's vessel could not be determined",
          );
        }

        if (action === "create" && targetVessel !== vesselUuid) {
          throw failure(
            400,
            "VALIDATION",
            "The record does not belong to the selected vessel",
          );
        }

        if (targetVessel !== vesselUuid) {
          assertVesselScope(getActor(req), targetVessel);
          await assertOpen(targetVessel, period);
        }

        const field = kind === "allotment" ? "validFrom" : "requestDate";
        const value = candidate[field];

        // Preserve omitted/empty values and unchanged historical dates.
        // Existing required-field rules still run in the existing services.
        if (
          value !== undefined &&
          value !== null &&
          value !== "" &&
          value !== existing?.[field]
        ) {
          if (!isCanonicalDate(value)) {
            throw failure(
              400,
              "VALIDATION",
              "Enter a valid date in YYYY-MM-DD format.",
            );
          }

          const datePeriod = value.slice(0, 7);
          const locked = await engagements.findLockedPeriods(
            targetVessel,
            [datePeriod],
          );

          if (locked.has(datePeriod)) {
            throw failure(400, "LOCKED_DATE", DATE_MESSAGE);
          }
        }

        // Protect a changed recovery month on the existing Advance API.
        if (
          kind === "advance" &&
          action === "update" &&
          body.period !== existing?.period &&
          validPeriod(body.period)
        ) {
          await assertOpen(targetVessel, body.period);
        }
      }

      next();
    } catch (error: any) {
      const status =
        error.status ??
        (error.code === "FORBIDDEN"
          ? 403
          : error.message?.includes("not found")
            ? 404
            : 500);

      if (status === 500) {
        console.error("Failed to check cash period lock:", error);
      }

      res.status(status).json({
        error:
          status === 500
            ? "Unable to verify the period lock"
            : error.message,
        code: error.code,
      });
    }
  };
}
