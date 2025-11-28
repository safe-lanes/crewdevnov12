export interface VesselType {
  id: string;          // Maps to entryId in database (e.g., 'VT001')
  name: string;
  level: 1 | 2 | 3;
  parentId: string | null;
  code: string;
  tanker?: boolean;
  oilTanker?: boolean;
  gasTanker?: boolean;
  chemicalTanker?: boolean;
  bulk?: boolean;
}

// Static fallback data that mirrors Master 004 in database
// This is used when API is not available or for immediate local lookups
export const VESSEL_TYPE_HIERARCHY: VesselType[] = [
  // Level 1 - Categories
  { id: 'VT001', name: 'Tanker Vessels', level: 1, parentId: null, code: 'TANKER' },
  { id: 'VT002', name: 'Dry Vessels', level: 1, parentId: null, code: 'DRY' },
  { id: 'VT003', name: 'Other Vessels', level: 1, parentId: null, code: 'OTHER' },
  
  // Level 2 - Tanker Types
  { id: 'VT004', name: 'Oil Tanker', level: 2, parentId: 'VT001', code: 'OIL_TANKER', tanker: true, oilTanker: true },
  { id: 'VT005', name: 'Chemical Tanker', level: 2, parentId: 'VT001', code: 'CHEMICAL_TANKER', tanker: true, chemicalTanker: true },
  { id: 'VT019', name: 'Oil Chemical Tanker', level: 2, parentId: 'VT001', code: 'OIL_CHEMICAL_TANKER', tanker: true, oilTanker: true, chemicalTanker: true },
  { id: 'VT006', name: 'Gas Tanker', level: 2, parentId: 'VT001', code: 'GAS_TANKER', tanker: true, gasTanker: true },
  { id: 'VT007', name: 'Bitumen/Asphalt Carriers', level: 2, parentId: 'VT001', code: 'BITUMEN_ASPHALT', tanker: true },
  
  // Level 3 - Oil Tanker Subtypes
  { id: 'VT008', name: 'Product Oil Tanker', level: 3, parentId: 'VT004', code: 'PRODUCT_OIL_TANKER', tanker: true, oilTanker: true },
  { id: 'VT009', name: 'Crude Oil Tanker', level: 3, parentId: 'VT004', code: 'CRUDE_OIL_TANKER', tanker: true, oilTanker: true },
  
  // Level 3 - Gas Tanker Subtypes
  { id: 'VT010', name: 'LNG Tanker', level: 3, parentId: 'VT006', code: 'LNG_TANKER', tanker: true, gasTanker: true },
  { id: 'VT011', name: 'LPG Tanker', level: 3, parentId: 'VT006', code: 'LPG_TANKER', tanker: true, gasTanker: true },
  
  // Level 2 - Dry Vessel Types
  { id: 'VT012', name: 'Bulk Carrier', level: 2, parentId: 'VT002', code: 'BULK_CARRIER', bulk: true },
  { id: 'VT013', name: 'General Cargo', level: 2, parentId: 'VT002', code: 'GENERAL_CARGO' },
  { id: 'VT014', name: 'Container', level: 2, parentId: 'VT002', code: 'CONTAINER' },
  { id: 'VT015', name: 'RoRo', level: 2, parentId: 'VT002', code: 'RORO' },
  
  // Level 2 - Other Vessel Types
  { id: 'VT016', name: 'Barges', level: 2, parentId: 'VT003', code: 'BARGES' },
  { id: 'VT017', name: 'Offshore Support Vessels', level: 2, parentId: 'VT003', code: 'OFFSHORE_SUPPORT' },
  { id: 'VT018', name: 'Shuttle Tankers', level: 2, parentId: 'VT003', code: 'SHUTTLE_TANKERS', tanker: true },
];

// Master ID for vessel types in the database
export const VESSEL_TYPE_MASTER_ID = '004';

export function getAllVesselTypes(): VesselType[] {
  return VESSEL_TYPE_HIERARCHY;
}

export function getVesselTypesByLevel(levels: (1 | 2 | 3)[]): VesselType[] {
  return VESSEL_TYPE_HIERARCHY.filter(vt => levels.includes(vt.level));
}

export function getVesselTypesForDropdown(levels?: (1 | 2 | 3)[]): string[] {
  const types = levels ? getVesselTypesByLevel(levels) : VESSEL_TYPE_HIERARCHY;
  return types.map(vt => vt.name);
}

export function getVesselTypeById(id: string): VesselType | undefined {
  return VESSEL_TYPE_HIERARCHY.find(vt => vt.id === id);
}

export function getVesselTypeByName(name: string): VesselType | undefined {
  return VESSEL_TYPE_HIERARCHY.find(vt => vt.name.toLowerCase() === name.toLowerCase());
}

export function getVesselTypeByCode(code: string): VesselType | undefined {
  return VESSEL_TYPE_HIERARCHY.find(vt => vt.code === code);
}

export function getParentTypes(vesselTypeNameOrId: string): VesselType[] {
  const parents: VesselType[] = [];
  let current = getVesselTypeByName(vesselTypeNameOrId) || getVesselTypeById(vesselTypeNameOrId);
  
  while (current && current.parentId) {
    const parent = getVesselTypeById(current.parentId);
    if (parent) {
      parents.push(parent);
      current = parent;
    } else {
      break;
    }
  }
  
  return parents;
}

export function getParentTypeNames(vesselTypeName: string): string[] {
  return getParentTypes(vesselTypeName).map(vt => vt.name);
}

export function getChildTypes(vesselTypeNameOrId: string): VesselType[] {
  const target = getVesselTypeByName(vesselTypeNameOrId) || getVesselTypeById(vesselTypeNameOrId);
  if (!target) return [];
  
  const children: VesselType[] = [];
  const queue = [target.id];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const directChildren = VESSEL_TYPE_HIERARCHY.filter(vt => vt.parentId === currentId);
    children.push(...directChildren);
    queue.push(...directChildren.map(c => c.id));
  }
  
  return children;
}

export function getChildTypeNames(vesselTypeName: string): string[] {
  return getChildTypes(vesselTypeName).map(vt => vt.name);
}

export function getAllRelatedTypes(vesselTypeName: string): string[] {
  const current = getVesselTypeByName(vesselTypeName);
  if (!current) return [vesselTypeName];
  
  const parents = getParentTypeNames(vesselTypeName);
  const children = getChildTypeNames(vesselTypeName);
  
  return [vesselTypeName, ...parents, ...children];
}

/**
 * Get all experience types for a vessel type (the type itself + all parent types)
 * Example: LPG Tanker -> ['LPG Tanker', 'Gas Tanker', 'Tanker Vessels']
 */
export function getExperienceTypes(vesselTypeName: string): string[] {
  const current = getVesselTypeByName(vesselTypeName);
  if (!current) return [vesselTypeName];
  
  return [vesselTypeName, ...getParentTypeNames(vesselTypeName)];
}

export function isChildOf(childName: string, parentName: string): boolean {
  const childParents = getParentTypeNames(childName);
  return childParents.includes(parentName);
}

export function isParentOf(parentName: string, childName: string): boolean {
  const parentChildren = getChildTypeNames(parentName);
  return parentChildren.includes(childName);
}

/**
 * Check if a vessel type is a tanker (any tanker type in the hierarchy)
 */
export function isTankerType(vesselTypeName: string): boolean {
  const type = getVesselTypeByName(vesselTypeName);
  if (!type) return false;
  return type.tanker === true || getParentTypes(vesselTypeName).some(p => p.tanker === true);
}

/**
 * Check if a vessel type is a bulk carrier type
 */
export function isBulkType(vesselTypeName: string): boolean {
  const type = getVesselTypeByName(vesselTypeName);
  if (!type) return false;
  return type.bulk === true || getParentTypes(vesselTypeName).some(p => p.bulk === true);
}

/**
 * Convert API response to VesselType array
 * Use this when fetching from /api/masters/004/data
 */
export function mapApiResponseToVesselTypes(apiData: Array<{
  entryId: string;
  name: string;
  level?: number;
  parentId?: string | null;
  code?: string;
  tanker?: boolean;
  oilTanker?: boolean;
  gasTanker?: boolean;
  chemicalTanker?: boolean;
  bulk?: boolean;
}>): VesselType[] {
  return apiData.map(entry => ({
    id: entry.entryId,
    name: entry.name,
    level: (entry.level || 2) as 1 | 2 | 3,
    parentId: entry.parentId || null,
    code: entry.code || entry.entryId,
    tanker: entry.tanker,
    oilTanker: entry.oilTanker,
    gasTanker: entry.gasTanker,
    chemicalTanker: entry.chemicalTanker,
    bulk: entry.bulk,
  }));
}

// Pre-exported dropdown options
export const DEFAULT_DROPDOWN_VESSEL_TYPES = getVesselTypesForDropdown([2, 3]);

export const LEVEL_2_VESSEL_TYPES = getVesselTypesForDropdown([2]);

export const LEVEL_3_VESSEL_TYPES = getVesselTypesForDropdown([3]);

export const ALL_VESSEL_TYPES = getVesselTypesForDropdown();
