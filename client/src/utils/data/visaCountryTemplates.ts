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

export function mapApiResponseToVisaCountries(
  apiResponse: Array<{ id?: number; nuid?: string; name: string; countryName?: string }>
): VisaCountryTemplate[] {
  const countries = apiResponse.map(item => {
    const name = item.countryName || item.name || '';
    return {
      id: item.nuid || `COUNTRY-${item.id}` || '',
      name,
      isPriority: PRIORITY_COUNTRIES.some(p => p.toLowerCase() === name.toLowerCase()),
    };
  });
  
  return sortCountriesWithPriority(countries);
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
