import { Router } from "express";
import {
  getAllCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  getVesselTypesApplied,
  addVesselTypeApplied,
  removeVesselTypeApplied,
  getPersonalDetails,
  upsertPersonalDetails,
  getAddress,
  upsertAddress,
  getFamilyInfo,
  upsertFamilyInfo,
  getChildren,
  createChild,
  updateChild,
  deleteChild,
  getNextOfKin,
  createNextOfKin,
  updateNextOfKin,
  deleteNextOfKin,
} from "../../v2/recruitment/controllers";

const router = Router();

// ============================================================================
// CANDIDATE ROUTES
// ============================================================================

router.get("/candidates", getAllCandidates);
router.post("/candidates", createCandidate);
router.get("/candidates/:id", getCandidateById);
router.put("/candidates/:id", updateCandidate);
router.delete("/candidates/:id", deleteCandidate);

// ============================================================================
// VESSEL TYPES APPLIED ROUTES
// ============================================================================

router.get("/candidates/:id/vessel-types-applied", getVesselTypesApplied);
router.post("/candidates/:id/vessel-types-applied", addVesselTypeApplied);
router.delete("/candidates/:id/vessel-types-applied/:vtaId", removeVesselTypeApplied);

// ============================================================================
// PERSONAL DETAILS ROUTES (One-to-One)
// ============================================================================

router.get("/candidates/:id/personal-details", getPersonalDetails);
router.put("/candidates/:id/personal-details", upsertPersonalDetails);

// ============================================================================
// ADDRESS ROUTES (One-to-One)
// ============================================================================

router.get("/candidates/:id/addresses", getAddress);
router.put("/candidates/:id/addresses", upsertAddress);

// ============================================================================
// FAMILY INFO ROUTES (One-to-One)
// ============================================================================

router.get("/candidates/:id/family-info", getFamilyInfo);
router.put("/candidates/:id/family-info", upsertFamilyInfo);

// ============================================================================
// CHILDREN ROUTES (One-to-Many)
// ============================================================================

router.get("/candidates/:id/children", getChildren);
router.post("/candidates/:id/children", createChild);
router.put("/candidates/:id/children/:childId", updateChild);
router.delete("/candidates/:id/children/:childId", deleteChild);

// ============================================================================
// NEXT OF KIN ROUTES (One-to-Many)
// ============================================================================

router.get("/candidates/:id/next-of-kin", getNextOfKin);
router.post("/candidates/:id/next-of-kin", createNextOfKin);
router.put("/candidates/:id/next-of-kin/:nokId", updateNextOfKin);
router.delete("/candidates/:id/next-of-kin/:nokId", deleteNextOfKin);

export default router;
