import { DatabaseStorage } from "./server/database";
import fs from 'fs';

// Import all helpers from migration script
const extractFromTuple = (item: any) => Array.isArray(item) && item.length === 2 ? item[1] : item;

const convertTimestamps = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  const fields = ['createdAt', 'updatedAt', 'signOnDate', 'signOffDate', 'joiningDate', 'reliefDue'];
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      try { result[field] = new Date(result[field]); } catch (e) {}
    }
  }
  return result;
};

// Full crew field mapping
const CREW_FIELD_MAP: Record<string, string> = {
  id: 'id', firstName: 'first_name', middleName: 'middle_name', lastName: 'last_name',
  familyName: 'family_name', rank: 'rank', nationality: 'nationality', vessel: 'vessel',
  vesselType: 'vessel_type', signOnDate: 'sign_on_date', signOffDate: 'sign_off_date',
  createdAt: 'created_at', updatedAt: 'updated_at', empNo: 'emp_no',
  dateOfBirth: 'date_of_birth', age: 'age', presentRank: 'present_rank',
  rankAppliedFor: 'rank_applied_for', employeeId: 'employee_id', presentVessel: 'present_vessel',
  lastVessel: 'last_vessel', status: 'status', joiningDate: 'joining_date',
  contractPeriod: 'contract_period', reliefDue: 'relief_due', reason: 'reason',
  availability: 'availability', email: 'email', mobile: 'mobile',
  contactLandline: 'contact_landline', countryOfResidence: 'country_of_residence',
  nearestAirport: 'nearest_airport', residentialAddressLine1: 'residential_address_line1',
  residentialAddressLine2: 'residential_address_line2', placeOfBirthCity: 'place_of_birth_city',
  placeOfBirthCountry: 'place_of_birth_country', heightCm: 'height_cm',
  weightKg: 'weight_kg', bmi: 'bmi', nativeLanguage: 'native_language',
  foreignLanguages: 'foreign_languages', englishProficiency: 'english_proficiency',
  maritalStatus: 'marital_status', numberOfDependentChildren: 'number_of_dependent_children',
  fatherName: 'father_name', motherName: 'mother_name', spouseFirstName: 'spouse_first_name',
  spouseMiddleName: 'spouse_middle_name', spouseFamilyName: 'spouse_family_name',
  spouseDateOfBirth: 'spouse_date_of_birth', nokFirstName: 'nok_first_name',
  nokMiddleName: 'nok_middle_name', nokFamilyName: 'nok_family_name',
  nokTelephone: 'nok_telephone', nokEmail: 'nok_email', nokAddress: 'nok_address',
  nokRelationship: 'nok_relationship', manningAgent: 'manning_agent',
  vesselTypes: 'vessel_types', documents: 'documents', visas: 'visas',
  education: 'education', licenses: 'licenses', trainingCourses: 'training_courses',
  currentCompanySeaService: 'current_company_sea_service', externalSeaService: 'external_sea_service',
  preJoiningMedicals: 'pre_joining_medicals', doctorVisits: 'doctor_visits', children: 'children'
};

const mapCrewFields = (crew: any) => {
  const result: any = {};
  for (const [jsonKey, dbKey] of Object.entries(CREW_FIELD_MAP)) {
    if (crew.hasOwnProperty(jsonKey)) result[dbKey] = crew[jsonKey];
  }
  if (!result.present_vessel) result.present_vessel = result.vessel || '';
  return result;
};

async function test() {
  const db = new DatabaseStorage();
  const json = JSON.parse(fs.readFileSync('./test-data.json', 'utf-8'));
  
  console.log('Testing 1 crew member migration...\n');
  const crewData = extractFromTuple(json.crewMembers[0]);
  const withTimestamps = convertTimestamps(crewData);
  const mapped = mapCrewFields(withTimestamps);
  
  console.log('Mapped fields (first 10 DB columns):');
  console.log(Object.keys(mapped).slice(0, 10).join(', '));
  console.log(`\nTotal mapped fields: ${Object.keys(mapped).length}`);
  console.log(`ID: ${mapped.id}, Name: ${mapped.first_name} ${mapped.last_name}`);
  
  try {
    const result = await db.createCrewMember(mapped);
    console.log(`\n✅ SUCCESS! Migrated crew member: ${result.id}`);
  } catch (error: any) {
    console.log(`\n❌ FAILED: ${error.message}`);
    console.log(`Error details: ${JSON.stringify(error, null, 2)}`);
  }
  
  await db.close();
}

test().catch(console.error);
