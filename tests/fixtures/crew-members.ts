// Test fixtures for crew member data

export const mockCrewMember = {
  id: 1,
  firstName: 'John',
  lastName: 'Smith',
  rank: 'Master',
  vesselId: 1,
  email: 'john.smith@example.com',
  nationality: 'British',
  dateOfBirth: '1985-06-15',
  employmentDate: '2020-01-01',
  status: 'active',
};

export const mockCrewMembers = [
  mockCrewMember,
  {
    id: 2,
    firstName: 'Jane',
    lastName: 'Doe',
    rank: 'Chief Officer',
    vesselId: 1,
    email: 'jane.doe@example.com',
    nationality: 'American',
    dateOfBirth: '1990-03-22',
    employmentDate: '2021-06-15',
    status: 'active',
  },
  {
    id: 3,
    firstName: 'Carlos',
    lastName: 'Garcia',
    rank: 'Second Officer',
    vesselId: 2,
    email: 'carlos.garcia@example.com',
    nationality: 'Spanish',
    dateOfBirth: '1988-11-08',
    employmentDate: '2019-09-01',
    status: 'active',
  },
];

export const mockCrewMemberInsert = {
  firstName: 'New',
  lastName: 'Crew',
  rank: 'Third Officer',
  vesselId: 1,
  email: 'new.crew@example.com',
  nationality: 'Norwegian',
  dateOfBirth: '1995-02-28',
  employmentDate: '2024-01-01',
  status: 'active',
};
