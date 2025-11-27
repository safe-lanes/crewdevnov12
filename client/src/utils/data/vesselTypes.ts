export interface VesselType {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId: string | null;
  code: string;
}

export const VESSEL_TYPE_HIERARCHY: VesselType[] = [
  { id: 'tanker-vessels', name: 'Tanker Vessels', level: 1, parentId: null, code: 'TANKER' },
  { id: 'oil-tanker', name: 'Oil Tanker', level: 2, parentId: 'tanker-vessels', code: 'OIL_TANKER' },
  { id: 'product-oil-tanker', name: 'Product Oil Tanker', level: 3, parentId: 'oil-tanker', code: 'PRODUCT_OIL_TANKER' },
  { id: 'crude-oil-tanker', name: 'Crude Oil Tanker', level: 3, parentId: 'oil-tanker', code: 'CRUDE_OIL_TANKER' },
  { id: 'chemical-tanker', name: 'Chemical Tanker', level: 2, parentId: 'tanker-vessels', code: 'CHEMICAL_TANKER' },
  { id: 'gas-tanker', name: 'Gas Tanker', level: 2, parentId: 'tanker-vessels', code: 'GAS_TANKER' },
  { id: 'lng-tanker', name: 'LNG Tanker', level: 3, parentId: 'gas-tanker', code: 'LNG_TANKER' },
  { id: 'lpg-tanker', name: 'LPG Tanker', level: 3, parentId: 'gas-tanker', code: 'LPG_TANKER' },
  { id: 'bitumen-asphalt-carriers', name: 'Bitumen/Asphalt Carriers', level: 2, parentId: 'tanker-vessels', code: 'BITUMEN_ASPHALT' },

  { id: 'dry-vessels', name: 'Dry Vessels', level: 1, parentId: null, code: 'DRY' },
  { id: 'bulk-carrier', name: 'Bulk Carrier', level: 2, parentId: 'dry-vessels', code: 'BULK_CARRIER' },
  { id: 'general-cargo', name: 'General Cargo', level: 2, parentId: 'dry-vessels', code: 'GENERAL_CARGO' },
  { id: 'container', name: 'Container', level: 2, parentId: 'dry-vessels', code: 'CONTAINER' },
  { id: 'roro', name: 'RoRo', level: 2, parentId: 'dry-vessels', code: 'RORO' },

  { id: 'other-vessels', name: 'Other Vessels', level: 1, parentId: null, code: 'OTHER' },
  { id: 'barges', name: 'Barges', level: 2, parentId: 'other-vessels', code: 'BARGES' },
  { id: 'offshore-support-vessels', name: 'Offshore Support Vessels', level: 2, parentId: 'other-vessels', code: 'OFFSHORE_SUPPORT' },
  { id: 'shuttle-tankers', name: 'Shuttle Tankers', level: 2, parentId: 'other-vessels', code: 'SHUTTLE_TANKERS' },
];

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

export const DEFAULT_DROPDOWN_VESSEL_TYPES = getVesselTypesForDropdown([2, 3]);

export const LEVEL_2_VESSEL_TYPES = getVesselTypesForDropdown([2]);

export const LEVEL_3_VESSEL_TYPES = getVesselTypesForDropdown([3]);

export const ALL_VESSEL_TYPES = getVesselTypesForDropdown();
