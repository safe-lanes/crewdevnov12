import { eq, or } from "drizzle-orm";
import { getDb } from "../../db";
import {
  masterNationalities,
  masterVesselTypes,
  masterVessels,
  masterCountries,
} from "../../../../shared/schema";

type MasterTableType = 'nationality' | 'vesselType' | 'country' | 'vessel';

// Standard UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID v4 format
 */
function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Resolve master data value/name to UUID
 * Handles both:
 * - UUID input: "550e8400-e29b-41d4-a716-446655440000" → passthrough
 * - Name input: "Indian" → lookup UUID from master table
 * - Code input: "IN" → lookup UUID from master table
 */
export async function resolveMasterDataUuid(
  value: string | null | undefined,
  masterTable: MasterTableType
): Promise<string | null> {
  if (!value || value.trim() === '') {
    return null;
  }

  const db = getDb();

  // If already a valid UUID format, return as-is
  if (isValidUuid(value)) {
    return value;
  }

  // Otherwise, lookup UUID by name or code
  try {
    switch (masterTable) {
      case 'nationality': {
        const result = await db
          .select({ uuid: masterNationalities.natUuid })
          .from(masterNationalities)
          .where(
            or(
              eq(masterNationalities.nationality, value),
              eq(masterNationalities.countryCode, value)
            )
          )
          .limit(1);
        return result[0]?.uuid || null;
      }

      case 'vesselType': {
        const result = await db
          .select({ uuid: masterVesselTypes.vtUuid })
          .from(masterVesselTypes)
          .where(eq(masterVesselTypes.vesselType, value))
          .limit(1);
        return result[0]?.uuid || null;
      }

      case 'country': {
        const result = await db
          .select({ uuid: masterCountries.countryUuid })
          .from(masterCountries)
          .where(eq(masterCountries.countryName, value))
          .limit(1);
        return result[0]?.uuid || null;
      }

      case 'vessel': {
        const result = await db
          .select({ uuid: masterVessels.vesselUuid })
          .from(masterVessels)
          .where(
            or(
              eq(masterVessels.vessel, value),
              eq(masterVessels.imoNumber, value)
            )
          )
          .limit(1);
        return result[0]?.uuid || null;
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`Error resolving ${masterTable} UUID for value "${value}":`, error);
    return null;
  }
}

/**
 * Resolve country value/name to UUID
 * Accepts country name (e.g., "India") or UUID (e.g., "country-uuid-123")
 */
export async function resolveCountryUuid(
  value: string | null | undefined
): Promise<string | null> {
  return resolveMasterDataUuid(value, 'country');
}

/**
 * Resolve nationality value/name to UUID
 * Accepts nationality name (e.g., "Indian"), country code (e.g., "IN"), or UUID
 */
export async function resolveNationalityUuid(
  value: string | null | undefined
): Promise<string | null> {
  return resolveMasterDataUuid(value, 'nationality');
}

/**
 * Resolve vessel type value/name to UUID
 * Accepts vessel type name (e.g., "Container") or UUID
 */
export async function resolveVesselTypeUuid(
  value: string | null | undefined
): Promise<string | null> {
  return resolveMasterDataUuid(value, 'vesselType');
}

/**
 * Resolve vessel value/name to UUID
 * Accepts vessel name, IMO number, or UUID
 */
export async function resolveVesselUuid(
  value: string | null | undefined
): Promise<string | null> {
  return resolveMasterDataUuid(value, 'vessel');
}
