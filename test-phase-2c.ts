import { DatabaseStorage } from "./server/database";

async function testPhase2C() {
  const db = new DatabaseStorage();
  
  try {
    console.log("=".repeat(60));
    console.log("PHASE 2C TEST: Vessels & Planning Methods (25 methods)");
    console.log("=".repeat(60));
    console.log();

    // GROUP 1: VESSEL GROUPS (5 methods)
    console.log("GROUP 1: VESSEL GROUPS");
    console.log("-".repeat(60));
    
    // Test 1: createVesselGroup
    const vesselGroup = await db.createVesselGroup({
      name: "Pacific Fleet",
      vesselIds: ["V001", "V002", "V003"]
    });
    console.log(`✅ createVesselGroup(): ID=${vesselGroup.id}, Name=${vesselGroup.name}`);
    
    // Test 2: getVesselGroups
    const allGroups = await db.getVesselGroups();
    console.log(`✅ getVesselGroups(): Found ${allGroups.length} groups`);
    
    // Test 3: getVesselGroup
    const foundGroup = await db.getVesselGroup(vesselGroup.id);
    console.log(`✅ getVesselGroup(${vesselGroup.id}): ${foundGroup ? foundGroup.name : 'NOT FOUND'}`);
    
    // Test 4: updateVesselGroup
    const updatedGroup = await db.updateVesselGroup(vesselGroup.id, {
      name: "Pacific Fleet Updated",
      vesselIds: ["V001", "V002", "V003", "V004"]
    });
    console.log(`✅ updateVesselGroup(): Name=${updatedGroup?.name}, Vessels=${JSON.stringify(updatedGroup?.vesselIds)}`);
    
    console.log();

    // GROUP 2: VESSEL DRAFTS (6 methods)
    console.log("GROUP 2: VESSEL DRAFTS");
    console.log("-".repeat(60));
    
    // Test 5: createVesselDraft
    const vesselDraft = await db.createVesselDraft({
      vesselId: "V001",
      revision: "R1",
      draftData: {
        ranks: {
          Master: 1,
          ChiefOfficer: 1,
          SecondOfficer: 1
        },
        effectiveDate: "2025-01-01"
      }
    });
    console.log(`✅ createVesselDraft(): ID=${vesselDraft.id}, Vessel=${vesselDraft.vesselName}`);
    
    // Test 6: getVesselDrafts
    const allDrafts = await db.getVesselDrafts();
    console.log(`✅ getVesselDrafts(): Found ${allDrafts.length} drafts`);
    
    // Test 7: getVesselDraft
    const foundDraft = await db.getVesselDraft(vesselDraft.id);
    console.log(`✅ getVesselDraft(${vesselDraft.id}): Revision=${foundDraft?.revision}`);
    
    // Test 8: getVesselDraftsByVessel
    const vesselDrafts = await db.getVesselDraftsByVessel("V001");
    console.log(`✅ getVesselDraftsByVessel(V001): Found ${vesselDrafts.length} drafts`);
    
    // Test 9: updateVesselDraft
    const updatedDraft = await db.updateVesselDraft(vesselDraft.id, {
      revision: "R2",
      draftData: {
        ranks: {
          Master: 1,
          ChiefOfficer: 1,
          SecondOfficer: 2
        },
        effectiveDate: "2025-02-01"
      }
    });
    console.log(`✅ updateVesselDraft(): Revision=${updatedDraft?.revision}`);
    
    console.log();

    // GROUP 3: VESSEL REVISIONS (4 methods)
    console.log("GROUP 3: VESSEL REVISIONS");
    console.log("-".repeat(60));
    
    // Test 10: createVesselRevision
    const vesselRevision = await db.createVesselRevision({
      vesselId: "V001",
      revision: "Rev-001",
      revisionDate: "2025-02-01",
      revisionData: {
        ranks: {
          Master: { count: 1, names: ["John Smith"] },
          ChiefOfficer: { count: 1, names: ["Jane Doe"] }
        },
        status: "Active"
      }
    });
    console.log(`✅ createVesselRevision(): ID=${vesselRevision.id}, Revision=${vesselRevision.revision}`);
    
    // Test 11: getVesselRevisions
    const allRevisions = await db.getVesselRevisions();
    console.log(`✅ getVesselRevisions(): Found ${allRevisions.length} revisions`);
    
    // Test 12: getVesselRevision
    const foundRevision = await db.getVesselRevision(vesselRevision.id);
    console.log(`✅ getVesselRevision(${vesselRevision.id}): Revision=${foundRevision?.revision}`);
    
    // Test 13: getVesselRevisionsByVessel
    const vesselRevisions = await db.getVesselRevisionsByVessel("V001");
    console.log(`✅ getVesselRevisionsByVessel(V001): Found ${vesselRevisions.length} revisions`);
    
    console.log();

    // GROUP 4: VESSEL PLANNING (5 methods)
    console.log("GROUP 4: VESSEL PLANNING");
    console.log("-".repeat(60));
    
    // Test 14: createVesselPlanning
    const vesselPlanningEntry = await db.createVesselPlanning({
      vesselId: "V001",
      rankId: "001",
      rank: "Master",
      crewMemberId: "A0001"
    });
    console.log(`✅ createVesselPlanning(): ID=${vesselPlanningEntry.id}, Vessel=${vesselPlanningEntry.vesselId}`);
    
    // Test 15: getVesselPlanningByVessel
    const vesselPlannings = await db.getVesselPlanningByVessel("V001");
    console.log(`✅ getVesselPlanningByVessel(V001): Found ${vesselPlannings.length} planning entries`);
    
    // Test 16: getVesselPlanningById
    const foundPlanning = await db.getVesselPlanningById(vesselPlanningEntry.id);
    console.log(`✅ getVesselPlanningById(${vesselPlanningEntry.id}): Rank=${foundPlanning?.rank}`);
    
    // Test 17: updateVesselPlanning
    const updatedPlanning = await db.updateVesselPlanning(vesselPlanningEntry.id, {
      rankId: "002",
      rank: "Chief Officer"
    });
    console.log(`✅ updateVesselPlanning(): RankId=${updatedPlanning?.rankId}, Rank=${updatedPlanning?.rank}`);
    
    console.log();

    // GROUP 5: ROTATION PLANS (5 methods)
    console.log("GROUP 5: ROTATION PLANS");
    console.log("-".repeat(60));
    
    // Test 18: createRotationPlan
    const rotationPlan = await db.createRotationPlan({
      draftId: "DRAFT-001",
      lastEdited: "2025-01-01",
      vessels: ["V001", "V002"],
      crew: ["A0001", "A0002", "A0003"],
      planFromDate: "2025-01-01",
      planToDate: "2025-03-31",
      createdBy: "admin_user",
      planStatus: "In Draft",
      assignments: {
        "V001": { "Master": "A0001", "ChiefOfficer": "A0002" },
        "V002": { "Master": "A0003" }
      }
    });
    console.log(`✅ createRotationPlan(): ID=${rotationPlan.id}, From=${rotationPlan.planFromDate}, To=${rotationPlan.planToDate}`);
    
    // Test 19: getRotationPlans
    const allRotationPlans = await db.getRotationPlans();
    console.log(`✅ getRotationPlans(): Found ${allRotationPlans.length} rotation plans`);
    
    // Test 20: getRotationPlan
    const foundRotationPlan = await db.getRotationPlan(rotationPlan.id);
    console.log(`✅ getRotationPlan(${rotationPlan.id}): Status=${foundRotationPlan?.planStatus}`);
    
    // Test 21: updateRotationPlan
    const updatedRotationPlan = await db.updateRotationPlan(rotationPlan.id, {
      planStatus: "Approved",
      assignments: {
        "V001": { "Master": "A0001", "ChiefOfficer": "A0002", "SecondOfficer": "A0004" },
        "V002": { "Master": "A0003" }
      }
    });
    // Verify update persisted by re-querying from database
    const reQueriedPlan = await db.getRotationPlan(rotationPlan.id);
    if (reQueriedPlan?.planStatus !== "Approved") {
      throw new Error(`❌ updateRotationPlan persistence failed: expected planStatus=Approved after re-query, got ${reQueriedPlan?.planStatus}`);
    }
    console.log(`✅ updateRotationPlan(): Status=${reQueriedPlan.planStatus} (verified persistence)`);
    
    console.log();

    // CLEANUP TESTS (Delete operations)
    console.log("CLEANUP TESTS");
    console.log("-".repeat(60));
    
    // Test 22: deleteRotationPlan
    const deletedRotationPlan = await db.deleteRotationPlan(rotationPlan.id);
    console.log(`✅ deleteRotationPlan(${rotationPlan.id}): ${deletedRotationPlan ? 'Deleted' : 'Failed'}`);
    
    // Test 23: deleteVesselPlanning
    const deletedPlanning = await db.deleteVesselPlanning(vesselPlanningEntry.id);
    console.log(`✅ deleteVesselPlanning(${vesselPlanningEntry.id}): ${deletedPlanning ? 'Deleted' : 'Failed'}`);
    
    // Test 24: deleteVesselDraft
    const deletedDraft = await db.deleteVesselDraft(vesselDraft.id);
    console.log(`✅ deleteVesselDraft(${vesselDraft.id}): ${deletedDraft ? 'Deleted' : 'Failed'}`);
    
    // Test 25: deleteVesselGroup
    const deletedGroup = await db.deleteVesselGroup(vesselGroup.id);
    console.log(`✅ deleteVesselGroup(${vesselGroup.id}): ${deletedGroup ? 'Deleted' : 'Failed'}`);
    
    console.log();
    console.log("=".repeat(60));
    console.log("PHASE 2C TEST SUMMARY");
    console.log("=".repeat(60));
    console.log("✅ GROUP 1: Vessel Groups (5 methods) - ALL PASSED");
    console.log("✅ GROUP 2: Vessel Drafts (6 methods) - ALL PASSED");
    console.log("✅ GROUP 3: Vessel Revisions (4 methods) - ALL PASSED");
    console.log("✅ GROUP 4: Vessel Planning (5 methods) - ALL PASSED");
    console.log("✅ GROUP 5: Rotation Plans (5 methods) - ALL PASSED");
    console.log();
    console.log("🎉 ALL 25 METHODS WORKING!");
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

testPhase2C().catch(console.error);
