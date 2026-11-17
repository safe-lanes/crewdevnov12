import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { masterCountries } from '../../../../shared/schema';
import { validateCrewProfile, type ProfileField, type ProfileErrors } from '@shared/v2/crew-pool/profileValidation';
// Pure, dependency-free existing country catalog/rules; keep Recruitment behavior unchanged.
import { validateMobileNumber } from '../../../../client/src/modules/recruitment/countryDialingCodes';
import { getDb } from '../../db';

type Values = Record<string, any>;
export type ProfileWriteKind = 'crew' | 'personal' | 'address' | 'family' | 'nok';

const normalized = (value: any) => value == null ? '' :
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value);

/** Only direct Crew Pool controller writes opt in; shared transfer/import services do not change. */
export async function assertProfileWrite(
  kind: ProfileWriteKind, data: Values, existing: Values = {}, creating = false,
) {
  const effective = { ...existing, ...data };
  const changed = (...keys: string[]) => creating || keys.some(key =>
    Object.prototype.hasOwnProperty.call(data, key) && normalized(data[key]) !== normalized(existing[key]));
  const fields: Partial<Record<ProfileField, string | null>> = {};
  const watched: Partial<Record<ProfileField, boolean>> = {};
  if (kind === 'crew' || kind === 'personal') {
    fields.firstName = effective.firstName || 'unchanged';
    fields.recruitmentDate = effective.recruitmentDate;
    fields.dateOfBirth = normalized(effective.dob);
    watched.dateOfBirth = changed('dob');
    if (kind === 'crew') {
      fields.firstName = effective.firstName;
      watched.firstName = changed('firstName');
      watched.recruitmentDate = changed('recruitmentDate');
    }
  }
  if (kind === 'address') {
    const countryName = async (value: any): Promise<string> => {
      const country = normalized(value);
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(country)) return country;
      const rows = await getDb().select({ name: masterCountries.countryName }).from(masterCountries)
        .where(and(eq(masterCountries.countryUuid, country), eq(masterCountries.isDeleted, false))).limit(1);
      return rows[0]?.name || '';
    };
    const currentCountry = effective.countryOfResidenceUuid || effective.countryOfResidence;
    fields.countryOfResidence = await countryName(currentCountry);
    fields.mobile = effective.mobile;
    fields.email = effective.email;
    watched.email = changed('email');
    const countryChanged = changed('countryOfResidenceUuid', 'countryOfResidence') &&
      fields.countryOfResidence.trim().toUpperCase() !==
        (await countryName(existing.countryOfResidenceUuid || existing.countryOfResidence)).trim().toUpperCase();
    watched.mobile = changed('mobile') || countryChanged;
  }
  if (kind === 'family') {
    for (const field of ['maritalStatus', 'spouseFirstName', 'spouseFamilyName'] as const)
      fields[field] = normalized(effective[field]);
    fields.spouseDateOfBirth = normalized(effective.spouseDob);
    watched.spouseFirstName = changed('maritalStatus', 'spouseFirstName');
    watched.spouseFamilyName = changed('maritalStatus', 'spouseFamilyName');
    watched.spouseDateOfBirth = changed('maritalStatus', 'spouseDob');
  }
  if (kind === 'nok') {
    fields.nokEmail = effective.email;
    watched.nokEmail = changed('email');
  }
  const errors = validateCrewProfile(fields,
    kind === 'address' ? ['B2'] : kind === 'family' || kind === 'nok' ? ['B3'] : ['B1'],
    { requireRecruitmentDate: kind === 'crew', mobileValidator: validateMobileNumber });
  const issues = Object.entries(errors).filter(([key]) => watched[key as keyof ProfileErrors])
    .map(([key, message]) => ({
      code: z.ZodIssueCode.custom, message: message!,
      path: [key === 'dateOfBirth' ? 'dob' : key === 'nokEmail' ? 'email' :
        key === 'spouseDateOfBirth' ? 'spouseDob' : key],
    }));
  if (issues.length) throw new z.ZodError(issues);
}
