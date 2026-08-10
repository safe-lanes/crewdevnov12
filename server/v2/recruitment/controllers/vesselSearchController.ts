import { Request, Response } from "express";
import { getDb } from "../../db";
import { masterVesselsApi, vesselSearchMisses } from "@shared/v2/recruitment/schema";
import { eq, and, ilike, gt, sql, isNull, or, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// IMO Check-Digit Validation
// ============================================================================

/**
 * Validates an IMO number using the standard 7-digit check-digit algorithm.
 * Weights 7,6,5,4,3,2 applied to digits 1–6, sum mod 10 compared against digit 7.
 */
function isValidImo(imo: string): boolean {
  const cleaned = imo.replace(/^IMO\s*/i, "").trim();
  if (!/^\d{7}$/.test(cleaned)) return false;

  const digits = cleaned.split("").map(Number);
  const weights = [7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    sum += digits[i] * weights[i];
  }
  return (sum % 10) === digits[6];
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_FRESHNESS_DAYS = 90;
const NEGATIVE_CACHE_TTL_MINUTES = 15;
const REFRESH_LOCK_TIMEOUT_MINUTES = 2;

// ============================================================================
// Helper: Map external API response to our cache schema
// ============================================================================

function mapApiResponseToCache(vessel: any) {
  return {
    imo: vessel.imo != null ? String(vessel.imo).trim() : null,
    mmsi: vessel.mmsi != null ? String(vessel.mmsi).trim() : null,
    callSign: vessel.call_sign || vessel.callSign || null,
    name: (vessel.name || vessel.shipname || "").trim(),
    nameAis: vessel.name_ais || vessel.ais_name || null,
    vesselType: vessel.vessel_type || vessel.type || null,
    country: vessel.country || vessel.flag || null,
    countryCode: vessel.country_code || vessel.flag_code || null,
    yearBuilt: vessel.year_built != null ? String(vessel.year_built) : null,
    operatingStatus: vessel.operating_status || vessel.status || null,
    length: vessel.length != null ? String(vessel.length) : null,
    lengthUnit: vessel.length_unit || "m",
    breadth: vessel.breadth != null ? String(vessel.breadth) : null,
    breadthUnit: vessel.breadth_unit || "m",
    grossTonnage: vessel.gross_tonnage != null ? String(vessel.gross_tonnage) : null,
    deadweightTonnage: vessel.deadweight_tonnage != null ? String(vessel.deadweight_tonnage) : null,
    speedCalculatedAvg: vessel.speed_calculated_avg != null ? String(vessel.speed_calculated_avg) : null,
    speedObservedMax: vessel.speed_observed_max != null ? String(vessel.speed_observed_max) : null,
    draughtCalculatedAvg: vessel.draught_calculated_avg != null ? String(vessel.draught_calculated_avg) : null,
    draughtObservedMax: vessel.draught_observed_max != null ? String(vessel.draught_observed_max) : null,
    classSociety: vessel.class_society || null,
    ownerName: vessel.owner_name || vessel.owner || null,
    managerName: vessel.manager_name || vessel.manager || null,
    engineTypePower: vessel.engine_type_power || vessel.engine || null,
    apiVerifiedAt: new Date(),
    updatedAt: new Date(),
  };
}

function mapCacheToResponse(cached: any) {
  return {
    id: cached.id,
    imo: cached.imo,
    mmsi: cached.mmsi,
    callSign: cached.callSign,
    name: cached.name,
    nameAis: cached.nameAis,
    vesselType: cached.vesselType,
    country: cached.country,
    countryCode: cached.countryCode,
    yearBuilt: cached.yearBuilt,
    operatingStatus: cached.operatingStatus,
    length: cached.length,
    lengthUnit: cached.lengthUnit,
    breadth: cached.breadth,
    breadthUnit: cached.breadthUnit,
    grossTonnage: cached.grossTonnage,
    deadweightTonnage: cached.deadweightTonnage,
    speedCalculatedAvg: cached.speedCalculatedAvg,
    speedObservedMax: cached.speedObservedMax,
    draughtCalculatedAvg: cached.draughtCalculatedAvg,
    draughtObservedMax: cached.draughtObservedMax,
    classSociety: cached.classSociety,
    ownerName: cached.ownerName,
    managerName: cached.managerName,
    engineTypePower: cached.engineTypePower,
    apiVerifiedAt: cached.apiVerifiedAt ? cached.apiVerifiedAt.toISOString() : null,
  };
}

// ============================================================================
// Background Refresh (with lock)
// ============================================================================

async function backgroundRefresh(db: any, cachedRow: any) {
  const lockCutoff = new Date(Date.now() - REFRESH_LOCK_TIMEOUT_MINUTES * 60 * 1000);

  try {
    // Acquire lock: only proceed if refresh_locked_at is NULL or older than 2 minutes
    const lockResult = await db
      .update(masterVesselsApi)
      .set({ refreshLockedAt: new Date() })
      .where(
        and(
          eq(masterVesselsApi.id, cachedRow.id),
          or(
            isNull(masterVesselsApi.refreshLockedAt),
            lt(masterVesselsApi.refreshLockedAt, lockCutoff)
          )
        )
      )
      .returning();

    if (!lockResult || lockResult.length === 0) {
      // Another request already holds the lock — skip
      return;
    }

    // Call external API
    const apiKey = process.env.VESSEL_API;
    if (!apiKey) {
      console.error("[VesselSearch] VESSEL_API env var not set, skipping background refresh");
      return;
    }

    const baseUrl = process.env.VESSEL_API_URL || "https://api.vesselapi.com/v1/search/vessels";
    let url: string;
    if (cachedRow.imo) {
      url = `${baseUrl}?filter.imo=${encodeURIComponent(cachedRow.imo)}`;
    } else {
      url = `${baseUrl}?q=${encodeURIComponent(cachedRow.name)}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      const vessels = data.data || data.results || data.vessels || (Array.isArray(data) ? data : []);
      if (vessels.length > 0) {
        const mapped = mapApiResponseToCache(vessels[0]);
        await db
          .update(masterVesselsApi)
          .set(mapped)
          .where(eq(masterVesselsApi.id, cachedRow.id));
      }
    }
  } catch (err) {
    console.error("[VesselSearch] Background refresh error:", err);
  } finally {
    // Release the lock
    try {
      await db
        .update(masterVesselsApi)
        .set({ refreshLockedAt: null })
        .where(eq(masterVesselsApi.id, cachedRow.id));
    } catch {
      // Swallow lock-release errors
    }
  }
}

// ============================================================================
// Negative Cache Helper
// ============================================================================

async function recordNegativeCache(
  db: any,
  searchKey: string,
  searchBy: string,
  reason: string
) {
  const expiresAt = new Date(Date.now() + NEGATIVE_CACHE_TTL_MINUTES * 60 * 1000);
  await db.insert(vesselSearchMisses).values({
    missUuid: uuidv4(),
    searchKey,
    searchBy,
    reason,
    expiresAt,
  });
}

// ============================================================================
// Upsert into cache
// ============================================================================

async function upsertVesselCache(db: any, mapped: any): Promise<number | undefined> {
  if (mapped.imo) {
    const existing = await db
      .select()
      .from(masterVesselsApi)
      .where(eq(masterVesselsApi.imo, mapped.imo))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(masterVesselsApi)
        .set(mapped)
        .where(eq(masterVesselsApi.id, existing[0].id));
      return existing[0].id;
    } else {
      const inserted = await db
        .insert(masterVesselsApi)
        .values({ vesselApiUuid: uuidv4(), ...mapped, createdAt: new Date() })
        .returning();
      return inserted[0]?.id;
    }
  } else {
    const existing = await db
      .select()
      .from(masterVesselsApi)
      .where(and(eq(masterVesselsApi.name, mapped.name), isNull(masterVesselsApi.imo)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(masterVesselsApi)
        .set(mapped)
        .where(eq(masterVesselsApi.id, existing[0].id));
      return existing[0].id;
    } else {
      const inserted = await db
        .insert(masterVesselsApi)
        .values({ vesselApiUuid: uuidv4(), ...mapped, createdAt: new Date() })
        .returning();
      return inserted[0]?.id;
    }
  }
}

// ============================================================================
// Main Controller
// ============================================================================

export async function searchVessels(req: Request, res: Response) {
  try {
    const db = getDb();
    const { query, searchBy, forceRefresh } = req.query as {
      query?: string;
      searchBy?: string;
      forceRefresh?: string;
    };

    if (!query || !searchBy) {
      return res.status(400).json({ error: "query and searchBy are required" });
    }

    const searchKey = query.trim();
    const isForceRefresh = forceRefresh === "true";

    if (!["imo", "name"].includes(searchBy)) {
      return res.status(400).json({ error: "searchBy must be 'imo' or 'name'" });
    }

    // Step 1: IMO check-digit validation
    if (searchBy === "imo") {
      if (!isValidImo(searchKey)) {
        return res.status(400).json({
          error: "Invalid IMO number. IMO numbers must be 7 digits with a valid check digit.",
          errorType: "invalid_imo",
        });
      }
    }

    // Step 2: Negative cache check (skip if forceRefresh)
    if (!isForceRefresh) {
      const now = new Date();
      const missEntries = await db
        .select()
        .from(vesselSearchMisses)
        .where(
          and(
            eq(vesselSearchMisses.searchKey, searchKey.toLowerCase()),
            eq(vesselSearchMisses.searchBy, searchBy),
            gt(vesselSearchMisses.expiresAt, now)
          )
        )
        .limit(1);

      if (missEntries.length > 0) {
        const miss = missEntries[0];
        if (miss.reason === "rate_limited") {
          return res.status(429).json({
            error: "External vessel API rate limit reached. Please try again later.",
            errorType: "rate_limited",
          });
        }
        if (miss.reason === "provider_error") {
          return res.status(502).json({
            error: "External vessel data provider is temporarily unavailable.",
            errorType: "provider_error",
          });
        }
        // not_found
        return res.status(404).json({
          error: "No vessel found matching this search.",
          errorType: "not_found",
        });
      }
    }

    // Step 3: Cache lookup
    let cachedResults: any[] = [];
    if (searchBy === "imo") {
      const cleaned = searchKey.replace(/^IMO\s*/i, "").trim();
      cachedResults = await db
        .select()
        .from(masterVesselsApi)
        .where(eq(masterVesselsApi.imo, cleaned));
    } else {
      cachedResults = await db
        .select()
        .from(masterVesselsApi)
        .where(ilike(masterVesselsApi.name, `%${searchKey}%`))
        .limit(20);
    }

    // Step 4: Cache hit, not forcing refresh
    if (cachedResults.length > 0 && !isForceRefresh) {
      const freshnessDate = new Date(Date.now() - CACHE_FRESHNESS_DAYS * 24 * 60 * 60 * 1000);

      // Check if any results are stale
      const allFresh = cachedResults.every(
        (r) => r.apiVerifiedAt && r.apiVerifiedAt > freshnessDate
      );

      if (allFresh) {
        return res.json({
          vessels: cachedResults.map(mapCacheToResponse),
          verificationStatus: "database_cached",
          source: "cache",
        });
      } else {
        // Stale: return immediately, trigger background refresh for stale rows
        for (const row of cachedResults) {
          if (!row.apiVerifiedAt || row.apiVerifiedAt <= freshnessDate) {
            // Fire and forget — don't block the response
            backgroundRefresh(db, row).catch((err) =>
              console.error("[VesselSearch] Background refresh failed:", err)
            );
          }
        }
        return res.json({
          vessels: cachedResults.map(mapCacheToResponse),
          verificationStatus: "database_cached_refreshing",
          source: "cache",
        });
      }
    }

    // Step 5: Cache miss or forceRefresh — call external API synchronously
    const apiKey = process.env.VESSEL_API;
    if (!apiKey) {
      // If no API key configured, return cached results if any exist (stale)
      if (cachedResults.length > 0) {
        return res.json({
          vessels: cachedResults.map(mapCacheToResponse),
          verificationStatus: "database_cached",
          source: "cache",
          warning: "External vessel API key not configured. Returning cached data.",
        });
      }
      return res.status(502).json({
        error: "Vessel search service not configured. Please contact administrator.",
        errorType: "provider_error",
      });
    }

    const baseUrl = process.env.VESSEL_API_URL || "https://api.vesselapi.com/v1/search/vessels";
    let url: string;
    if (searchBy === "imo") {
      const cleaned = searchKey.replace(/^IMO\s*/i, "").trim();
      url = `${baseUrl}?filter.imo=${encodeURIComponent(cleaned)}`;
    } else {
      url = `${baseUrl}?q=${encodeURIComponent(searchKey)}`;
    }

    let apiResponse: globalThis.Response;
    try {
      apiResponse = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });
    } catch (fetchErr) {
      console.error("[VesselSearch] External API call failed:", fetchErr);
      // Fall back to stale cache if available
      if (cachedResults.length > 0) {
        return res.json({
          vessels: cachedResults.map(mapCacheToResponse),
          verificationStatus: "database_cached",
          source: "cache",
          warning: "External vessel data provider unreachable. Returning cached data.",
        });
      }
      await recordNegativeCache(db, searchKey.toLowerCase(), searchBy, "provider_error");
      return res.status(502).json({
        error: "External vessel data provider is temporarily unavailable.",
        errorType: "provider_error",
      });
    }

    // Handle rate limiting
    if (apiResponse.status === 429) {
      await recordNegativeCache(db, searchKey.toLowerCase(), searchBy, "rate_limited");
      if (cachedResults.length > 0) {
        return res.json({
          vessels: cachedResults.map(mapCacheToResponse),
          verificationStatus: "database_cached",
          source: "cache",
          warning: "External API rate limit reached. Returning cached data.",
        });
      }
      return res.status(429).json({
        error: "External vessel API rate limit reached. Please try again later.",
        errorType: "rate_limited",
      });
    }

    // Handle non-OK responses
    if (!apiResponse.ok) {
      console.error(`[VesselSearch] External API returned ${apiResponse.status}`);
      if (cachedResults.length > 0) {
        return res.json({
          vessels: cachedResults.map(mapCacheToResponse),
          verificationStatus: "database_cached",
          source: "cache",
          warning: `External API error (${apiResponse.status}). Returning cached data.`,
        });
      }
      await recordNegativeCache(db, searchKey.toLowerCase(), searchBy, "provider_error");
      return res.status(502).json({
        error: "External vessel data provider returned an error.",
        errorType: "provider_error",
      });
    }

    const data = await apiResponse.json();
    const vessels = data.data || data.results || data.vessels || (Array.isArray(data) ? data : []);

    // No results from API
    if (!vessels || vessels.length === 0) {
      await recordNegativeCache(db, searchKey.toLowerCase(), searchBy, "not_found");
      return res.status(404).json({
        error: "No vessel found matching this search.",
        errorType: "not_found",
      });
    }

    // Clear any negative cache entry for this query now that we have valid results
    try {
      await db
        .delete(vesselSearchMisses)
        .where(
          and(
            eq(vesselSearchMisses.searchKey, searchKey.toLowerCase()),
            eq(vesselSearchMisses.searchBy, searchBy)
          )
        );
    } catch {
      // Ignore negative cache cleanup errors
    }

    // Upsert results into cache
    const upsertedResults: any[] = [];
    for (const vessel of vessels) {
      const mapped = mapApiResponseToCache(vessel);
      if (!mapped.name) continue;

      try {
        const id = await upsertVesselCache(db, mapped);
        if (id) {
          const fetched = await db
            .select()
            .from(masterVesselsApi)
            .where(eq(masterVesselsApi.id, id))
            .limit(1);
          if (fetched.length > 0) {
            upsertedResults.push(fetched[0]);
          } else {
            upsertedResults.push({ ...mapped, id });
          }
        } else {
          upsertedResults.push({ ...mapped, id: Math.floor(Math.random() * 100000) });
        }
      } catch (upsertErr) {
        console.error("[VesselSearch] Upsert error:", upsertErr);
        upsertedResults.push({ ...mapped, id: Math.floor(Math.random() * 100000) });
      }
    }

    return res.json({
      vessels: upsertedResults.map(mapCacheToResponse),
      verificationStatus: "api_verified",
      source: "api",
    });
  } catch (err) {
    console.error("[VesselSearch] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
