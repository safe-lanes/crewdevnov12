export interface VisaCountryTemplate {
  id: string;
  name: string;
  isPriority: boolean;
}

export const PRIORITY_COUNTRIES = [
  'United States',
  'Schengen',
  'United Kingdom',
  'China',
  'Australia',
  'India',
];

export function sortCountriesWithPriority(countries: VisaCountryTemplate[]): VisaCountryTemplate[] {
  const priorityOrder = new Map(PRIORITY_COUNTRIES.map((name, index) => [name.toLowerCase(), index]));
  
  return [...countries].sort((a, b) => {
    const aPriority = priorityOrder.get(a.name.toLowerCase());
    const bPriority = priorityOrder.get(b.name.toLowerCase());
    
    if (aPriority !== undefined && bPriority !== undefined) {
      return aPriority - bPriority;
    }
    if (aPriority !== undefined) return -1;
    if (bPriority !== undefined) return 1;
    
    return a.name.localeCompare(b.name);
  });
}

export function normalizeNationalityToCountry(nationality: string): string {
  const nationalityToCountry: Record<string, string> = {
    'indian': 'India',
    'american': 'United States',
    'british': 'United Kingdom',
    'chinese': 'China',
    'australian': 'Australia',
    'philippine': 'Philippines',
    'filipino': 'Philippines',
    'ukrainian': 'Ukraine',
    'canadian': 'Canada',
    'japanese': 'Japan',
    'singaporean': 'Singapore',
    'emirati': 'United Arab Emirates',
    'saudi': 'Saudi Arabia',
    'qatari': 'Qatar',
    'kuwaiti': 'Kuwait',
    'bahraini': 'Bahrain',
    'omani': 'Oman',
    'malaysian': 'Malaysia',
    'thai': 'Thailand',
    'indonesian': 'Indonesia',
    'vietnamese': 'Vietnam',
    'korean': 'South Korea',
    'brazilian': 'Brazil',
    'mexican': 'Mexico',
    'argentinian': 'Argentina',
    'south african': 'South Africa',
    'nigerian': 'Nigeria',
    'egyptian': 'Egypt',
    'turkish': 'Turkey',
    'russian': 'Russia',
    'german': 'Germany',
    'french': 'France',
    'italian': 'Italy',
    'spanish': 'Spain',
    'dutch': 'Netherlands',
    'polish': 'Poland',
    'greek': 'Greece',
    'portuguese': 'Portugal',
    'swedish': 'Sweden',
    'norwegian': 'Norway',
    'danish': 'Denmark',
    'finnish': 'Finland',
    'belgian': 'Belgium',
    'austrian': 'Austria',
    'swiss': 'Switzerland',
    'irish': 'Ireland',
    'new zealander': 'New Zealand',
    'panamanian': 'Panama',
    'liberian': 'Liberia',
    'maltese': 'Malta',
    'cypriot': 'Cyprus',
  };
  
  const lower = nationality.toLowerCase().trim();
  return nationalityToCountry[lower] || nationality;
}

export function mapApiResponseToVisaCountries(
  apiResponse: Array<{ id?: number; nuid?: string; name: string; countryName?: string; nationality?: string }>
): VisaCountryTemplate[] {
  const countries = apiResponse.map(item => {
    let name = item.countryName || item.name || '';
    if (item.nationality && !item.countryName) {
      name = normalizeNationalityToCountry(item.nationality);
    } else if (name) {
      name = normalizeNationalityToCountry(name);
    }
    return {
      id: item.nuid || `COUNTRY-${item.id}` || '',
      name,
      isPriority: PRIORITY_COUNTRIES.some(p => p.toLowerCase() === name.toLowerCase()),
    };
  });
  
  return sortCountriesWithPriority(countries);
}

export function mergeWithDefaultCountries(
  apiCountries: VisaCountryTemplate[]
): VisaCountryTemplate[] {
  const existingNames = new Set(apiCountries.map(c => c.name.toLowerCase()));
  
  const allCountries = [...apiCountries];
  
  for (const defaultCountry of DEFAULT_VISA_COUNTRIES) {
    if (!existingNames.has(defaultCountry.name.toLowerCase())) {
      allCountries.push(defaultCountry);
      existingNames.add(defaultCountry.name.toLowerCase());
    }
  }
  
  return sortCountriesWithPriority(allCountries);
}

export const DEFAULT_VISA_COUNTRIES: VisaCountryTemplate[] = [
  { id: 'USA', name: 'United States', isPriority: true },
  { id: 'SCHENGEN', name: 'Schengen', isPriority: true },
  { id: 'GBR', name: 'United Kingdom', isPriority: true },
  { id: 'CHN', name: 'China', isPriority: true },
  { id: 'AUS', name: 'Australia', isPriority: true },
  { id: 'IND', name: 'India', isPriority: true },
  { id: 'CAN', name: 'Canada', isPriority: false },
  { id: 'JPN', name: 'Japan', isPriority: false },
  { id: 'SGP', name: 'Singapore', isPriority: false },
  { id: 'ARE', name: 'United Arab Emirates', isPriority: false },
  { id: 'SAU', name: 'Saudi Arabia', isPriority: false },
  { id: 'QAT', name: 'Qatar', isPriority: false },
  { id: 'KWT', name: 'Kuwait', isPriority: false },
  { id: 'BHR', name: 'Bahrain', isPriority: false },
  { id: 'OMN', name: 'Oman', isPriority: false },
  { id: 'MYS', name: 'Malaysia', isPriority: false },
  { id: 'THA', name: 'Thailand', isPriority: false },
  { id: 'IDN', name: 'Indonesia', isPriority: false },
  { id: 'PHL', name: 'Philippines', isPriority: false },
  { id: 'VNM', name: 'Vietnam', isPriority: false },
  { id: 'KOR', name: 'South Korea', isPriority: false },
  { id: 'BRA', name: 'Brazil', isPriority: false },
  { id: 'MEX', name: 'Mexico', isPriority: false },
  { id: 'ARG', name: 'Argentina', isPriority: false },
  { id: 'ZAF', name: 'South Africa', isPriority: false },
  { id: 'NGA', name: 'Nigeria', isPriority: false },
  { id: 'EGY', name: 'Egypt', isPriority: false },
  { id: 'TUR', name: 'Turkey', isPriority: false },
  { id: 'RUS', name: 'Russia', isPriority: false },
  { id: 'NZL', name: 'New Zealand', isPriority: false },
  { id: 'PAN', name: 'Panama', isPriority: false },
  { id: 'LBR', name: 'Liberia', isPriority: false },
  { id: 'MHL', name: 'Marshall Islands', isPriority: false },
  { id: 'BHS', name: 'Bahamas', isPriority: false },
  { id: 'MLT', name: 'Malta', isPriority: false },
  { id: 'CYP', name: 'Cyprus', isPriority: false },
  { id: 'HKG', name: 'Hong Kong', isPriority: false },
  { id: 'TWN', name: 'Taiwan', isPriority: false },
  { id: 'NOR', name: 'Norway', isPriority: false },
  { id: 'SWE', name: 'Sweden', isPriority: false },
];
