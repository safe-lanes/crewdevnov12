// Fake provider responses for testing WITHOUT any real/paid API.
// Trigger rules (based on candidate family name, case-insensitive):
//   contains "SANCTION" -> both checks = POSSIBLE_MATCH
//   contains "FAIL"     -> both checks = UNABLE_TO_CHECK (simulated API outage)
//   anything else       -> both checks = PASSED

export const MOCK_OFAC_MATCH = {
    matchedName: "John Smith",
    listName: "SDN (Specially Designated Nationals) List",
    program: "RUSSIA-EO14024",
    referenceId: "12345678",
};

export const MOCK_SANCTIONS_MATCH = {
    matchedName: "John Smith",
    dateOfBirth: "15-Mar-1992",
    nationality: "Philippines",
    passportNumber: "P1234567B",
    listSource: "UN Consolidated List",
    program: "ISIL (Da'esh) and Al-Qaida",
};