export type ProfileSection = 'B1' | 'B2' | 'B3';
export type ProfileField = 'firstName' | 'recruitmentDate' | 'dateOfBirth' |
  'countryOfResidence' | 'mobile' | 'email' | 'nokEmail' | 'maritalStatus' |
  'spouseFirstName' | 'spouseFamilyName' | 'spouseDateOfBirth';
export type ProfileValues = Partial<Record<ProfileField, string | null>>;
export type ProfileErrors = Partial<Record<ProfileField, string>>;
export type MobileValidator = (country: string, mobile: string) => string | null;

export function calendarToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateCrewDob(value: string, today = calendarToday()): string {
  if (!value) return '';
  if (!validCalendarDate(value)) return 'Please enter a valid date of birth.';
  if (value > today) return 'Date of birth cannot be a future date.';
  const age = Number(today.slice(0, 4)) - Number(value.slice(0, 4)) -
    (today.slice(5) < value.slice(5) ? 1 : 0);
  return age < 18 ? 'Crew member must be at least 18 years old.' : '';
}

export function validateRecruitmentDate(value: string, today = calendarToday()): string {
  if (!value.trim()) return '';
  if (!validCalendarDate(value) || value.startsWith('0000-')) return 'Please enter a valid Date of Recruitment.';
  return value > today ? 'Date of Recruitment cannot be a future date.' : '';
}

export function validateProfileEmail(value: string): string {
  if (!value) return '';
  if (/\s/.test(value)) return 'Email must not contain spaces.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' :
    'Please enter a valid email address (e.g., user@domain.com).';
}

/** Existing Crew Pool rules only. Children currently have no additional business validator. */
export function validateCrewProfile(
  values: ProfileValues,
  sections: readonly ProfileSection[],
  options: { requireRecruitmentDate?: boolean; today?: string; mobileValidator?: MobileValidator } = {},
): ProfileErrors {
  const errors: ProfileErrors = {};
  const text = (field: ProfileField) => values[field] || '';
  const today = options.today || calendarToday();
  if (sections.includes('B1')) {
    if (!text('firstName').trim()) errors.firstName = 'First name is required.';
    if (options.requireRecruitmentDate && !text('recruitmentDate').trim())
      errors.recruitmentDate = 'Date of Recruitment is required.';
    const recruitmentDate = validateRecruitmentDate(text('recruitmentDate'), today);
    if (recruitmentDate) errors.recruitmentDate = recruitmentDate;
    const dob = validateCrewDob(text('dateOfBirth'), today);
    if (dob) errors.dateOfBirth = dob;
  }
  if (sections.includes('B2')) {
    const email = validateProfileEmail(text('email').trim());
    if (email) errors.email = email;
    const mobile = options.mobileValidator?.(text('countryOfResidence'), text('mobile').trim());
    if (mobile) errors.mobile = mobile;
  }
  if (sections.includes('B3')) {
    const email = validateProfileEmail(text('nokEmail').trim());
    if (email) errors.nokEmail = email;
    if (text('maritalStatus') === 'Married') {
      if (!text('spouseFirstName').trim()) errors.spouseFirstName = 'Spouse first name is required.';
      if (!text('spouseFamilyName').trim()) errors.spouseFamilyName = 'Spouse family name is required.';
      const dob = text('spouseDateOfBirth');
      if (dob && (!validCalendarDate(dob) || dob > today))
        errors.spouseDateOfBirth = 'Spouse date of birth cannot be a future date.';
    }
  }
  return errors;
}
