// Test fixtures for vessel data

export const mockVessel = {
  id: 1,
  name: 'MV Atlantic Spirit',
  imo: '9876543',
  type: 'Container Ship',
  flag: 'Panama',
  grossTonnage: 45000,
  status: 'active',
};

export const mockVessels = [
  mockVessel,
  {
    id: 2,
    name: 'MV Pacific Explorer',
    imo: '9876544',
    type: 'Bulk Carrier',
    flag: 'Liberia',
    grossTonnage: 52000,
    status: 'active',
  },
  {
    id: 3,
    name: 'MV Indian Voyager',
    imo: '9876545',
    type: 'Tanker',
    flag: 'Marshall Islands',
    grossTonnage: 38000,
    status: 'maintenance',
  },
];

export const mockVesselInsert = {
  name: 'MV New Vessel',
  imo: '9876546',
  type: 'General Cargo',
  flag: 'Singapore',
  grossTonnage: 28000,
  status: 'active',
};
