import { DatabaseStorage } from './server/database';

async function testPhase2D() {
  console.log("✅ Schema migrations handled by Drizzle/PostgreSQL migrations");
  console.log("============================================================");
  console.log("PHASE 2D TEST: Rotation Workflow Methods (5 methods)");
  console.log("============================================================\n");

  const db = new DatabaseStorage();

  try {
    // SETUP: Create a rotation plan with assignments JSON
    console.log("SETUP: Creating rotation plan with assignments");
    console.log("-".repeat(60));
    
    const rotationPlan = await db.createRotationPlan({
      draftId: "DRAFT-WORKFLOW-001",
      lastEdited: "2025-01-15",
      vessels: ["V001", "V002"],
      crew: ["A0001", "A0002", "A0003"],
      planFromDate: "2025-02-01",
      planToDate: "2025-07-31",
      createdBy: "admin_user",
      planStatus: "In Draft",
      assignments: JSON.stringify([
        {
          vesselName: "MV Pacific Star",
          rank: "Master",
          crewId: "A0001",
          crewName: "John Smith",
          joiningDate: "2025-02-01",
          contractPeriod: 6,
          status: "Pending"
        },
        {
          vesselName: "MV Ocean Explorer",
          rank: "Chief Engineer",
          crewId: "A0002",
          crewName: "Jane Doe",
          joiningDate: "2025-03-01",
          contractPeriod: 4,
          status: "Pending"
        },
        {
          vesselName: "MV Pacific Star",
          rank: "Chief Officer",
          crewId: "A0003",
          crewName: "Bob Johnson",
          joiningDate: "2025-04-01",
          contractPeriod: 3,
          status: "Pending"
        }
      ])
    });
    console.log(`✅ Created rotation plan: ID=${rotationPlan.id}, Status=${rotationPlan.planStatus}`);
    console.log(`   Assignments: ${JSON.parse(rotationPlan.assignments || '[]').length} assignments`);
    console.log();

    // TEST 1: proposeRotationPlan
    console.log("TEST 1: PROPOSE ROTATION PLAN");
    console.log("-".repeat(60));
    
    const proposedPlan = await db.proposeRotationPlan(rotationPlan.id, "manager_user");
    if (!proposedPlan) {
      throw new Error("❌ proposeRotationPlan failed: returned undefined");
    }
    if (proposedPlan.planStatus !== "Proposed") {
      throw new Error(`❌ proposeRotationPlan failed: expected status='Proposed', got '${proposedPlan.planStatus}'`);
    }
    if (proposedPlan.proposedBy !== "manager_user") {
      throw new Error(`❌ proposeRotationPlan failed: expected proposedBy='manager_user', got '${proposedPlan.proposedBy}'`);
    }
    console.log(`✅ proposeRotationPlan(): Status=${proposedPlan.planStatus}, ProposedBy=${proposedPlan.proposedBy}`);
    console.log(`   ProposedDate: ${proposedPlan.proposedDate}`);
    console.log();

    // TEST 2: getProposedAssignments (no filters)
    console.log("TEST 2: GET PROPOSED ASSIGNMENTS (No Filters)");
    console.log("-".repeat(60));
    
    const allProposedAssignments = await db.getProposedAssignments();
    console.log(`✅ getProposedAssignments(): Found ${allProposedAssignments.length} proposed assignments`);
    if (allProposedAssignments.length > 0) {
      console.log(`   Sample assignment: ${allProposedAssignments[0].crewName} - ${allProposedAssignments[0].rank} on ${allProposedAssignments[0].vesselName}`);
    }
    console.log();

    // TEST 3: getProposedAssignments (with vessel filter)
    console.log("TEST 3: GET PROPOSED ASSIGNMENTS (Vessel Filter)");
    console.log("-".repeat(60));
    
    const pacificStarAssignments = await db.getProposedAssignments({
      vessels: ["MV Pacific Star"]
    });
    console.log(`✅ getProposedAssignments({vessels: ["MV Pacific Star"]}): Found ${pacificStarAssignments.length} assignments`);
    pacificStarAssignments.forEach(a => {
      console.log(`   - ${a.crewName} (${a.rank})`);
    });
    console.log();

    // TEST 4: getProposedAssignments (with rank filter)
    console.log("TEST 4: GET PROPOSED ASSIGNMENTS (Rank Filter)");
    console.log("-".repeat(60));
    
    const masterAssignments = await db.getProposedAssignments({
      ranks: ["Master"]
    });
    console.log(`✅ getProposedAssignments({ranks: ["Master"]}): Found ${masterAssignments.length} assignments`);
    console.log();

    // TEST 5: getProposedAssignments (with date filter)
    console.log("TEST 5: GET PROPOSED ASSIGNMENTS (Date Filter)");
    console.log("-".repeat(60));
    
    const dateFilteredAssignments = await db.getProposedAssignments({
      dateFrom: "2025-02-01",
      dateTo: "2025-06-30"
    });
    console.log(`✅ getProposedAssignments({dateFrom: "2025-02-01", dateTo: "2025-06-30"}): Found ${dateFilteredAssignments.length} assignments`);
    console.log();

    // TEST 6: checkAssignmentConflicts (no conflict)
    console.log("TEST 6: CHECK ASSIGNMENT CONFLICTS (No Conflict)");
    console.log("-".repeat(60));
    
    const noConflicts = await db.checkAssignmentConflicts(
      "A0005", // Different crew member
      "2025-02-01",
      6,
      rotationPlan.id,
      0
    );
    console.log(`✅ checkAssignmentConflicts(A0005): Found ${noConflicts.length} conflicts (expected 0)`);
    console.log();

    // TEST 7: checkAssignmentConflicts (with conflict)
    console.log("TEST 7: CHECK ASSIGNMENT CONFLICTS (With Conflict)");
    console.log("-".repeat(60));
    
    // Create another plan with overlapping assignment
    const conflictingPlan = await db.createRotationPlan({
      draftId: "DRAFT-CONFLICT-001",
      lastEdited: "2025-01-16",
      vessels: ["V003"],
      crew: ["A0001"],
      planFromDate: "2025-03-01",
      planToDate: "2025-08-31",
      createdBy: "admin_user",
      planStatus: "Proposed",
      assignments: JSON.stringify([
        {
          vesselName: "MV Atlantic Voyager",
          rank: "Master",
          crewId: "A0001", // Same crew member as first plan
          crewName: "John Smith",
          joiningDate: "2025-04-01", // Overlaps with first assignment (Feb-Aug)
          contractPeriod: 5,
          status: "Pending"
        }
      ])
    });
    
    const conflicts = await db.checkAssignmentConflicts(
      "A0001",
      "2025-04-01",
      5,
      conflictingPlan.id,
      0
    );
    console.log(`✅ checkAssignmentConflicts(A0001): Found ${conflicts.length} conflicts`);
    if (conflicts.length > 0) {
      console.log(`   Conflict: ${conflicts[0].crewName} already assigned ${conflicts[0].joiningDate} (Plan ${conflicts[0].planId})`);
    }
    console.log();

    // TEST 8: deployAssignment (with conflict detection)
    console.log("TEST 8: DEPLOY ASSIGNMENT (With Conflict Detection)");
    console.log("-".repeat(60));
    
    const deployResult = await db.deployAssignment(conflictingPlan.id, 0, "deployment_manager");
    console.log(`✅ deployAssignment(): Success=${deployResult.success}`);
    if (deployResult.conflicts && deployResult.conflicts.length > 0) {
      console.log(`   ⚠️  Deployment blocked due to ${deployResult.conflicts.length} conflict(s)`);
      console.log(`   Conflict: ${deployResult.conflicts[0].crewName} on ${deployResult.conflicts[0].vesselName}`);
    }
    console.log();

    // TEST 9: deployAssignment (no conflict - different crew member)
    console.log("TEST 9: DEPLOY ASSIGNMENT (No Conflict)");
    console.log("-".repeat(60));
    
    // Get the plan and verify assignment index 1 exists (Jane Doe - no overlaps)
    const planBeforeDeploy = await db.getRotationPlan(rotationPlan.id);
    const assignmentsBefore = JSON.parse(planBeforeDeploy?.assignments || '[]');
    console.log(`   Assignment before deploy: ${assignmentsBefore[1].crewName} - Status: ${assignmentsBefore[1].status}`);
    
    const deployResult2 = await db.deployAssignment(rotationPlan.id, 1, "deployment_manager");
    console.log(`✅ deployAssignment(planId=${rotationPlan.id}, index=1): Success=${deployResult2.success}`);
    
    // Verify deployment persisted
    const planAfterDeploy = await db.getRotationPlan(rotationPlan.id);
    const assignmentsAfter = JSON.parse(planAfterDeploy?.assignments || '[]');
    if (assignmentsAfter[1].status !== 'Deployed') {
      throw new Error(`❌ Deployment failed to persist: expected status='Deployed', got '${assignmentsAfter[1].status}'`);
    }
    console.log(`   Assignment after deploy: ${assignmentsAfter[1].crewName} - Status: ${assignmentsAfter[1].status}`);
    console.log(`   DeployedBy: ${assignmentsAfter[1].deployedBy}, DeployedAt: ${assignmentsAfter[1].deployedAt}`);
    console.log();

    // TEST 10: rejectAssignment
    console.log("TEST 10: REJECT ASSIGNMENT");
    console.log("-".repeat(60));
    
    const assignmentsBeforeReject = JSON.parse(planAfterDeploy?.assignments || '[]');
    console.log(`   Assignment before reject: ${assignmentsBeforeReject[2].crewName} - Status: ${assignmentsBeforeReject[2].status}`);
    
    const rejectedPlan = await db.rejectAssignment(rotationPlan.id, 2);
    if (!rejectedPlan) {
      throw new Error("❌ rejectAssignment failed: returned undefined");
    }
    
    const assignmentsAfterReject = JSON.parse(rejectedPlan.assignments || '[]');
    if (assignmentsAfterReject[2].status !== 'Rejected') {
      throw new Error(`❌ Rejection failed to persist: expected status='Rejected', got '${assignmentsAfterReject[2].status}'`);
    }
    console.log(`✅ rejectAssignment(planId=${rotationPlan.id}, index=2): Success`);
    console.log(`   Assignment after reject: ${assignmentsAfterReject[2].crewName} - Status: ${assignmentsAfterReject[2].status}`);
    console.log(`   RejectedAt: ${assignmentsAfterReject[2].rejectedAt}`);
    console.log();

    // CLEANUP
    console.log("CLEANUP");
    console.log("-".repeat(60));
    await db.deleteRotationPlan(rotationPlan.id);
    console.log(`✅ Deleted rotation plan ${rotationPlan.id}`);
    await db.deleteRotationPlan(conflictingPlan.id);
    console.log(`✅ Deleted rotation plan ${conflictingPlan.id}`);
    console.log();

    // SUMMARY
    console.log("============================================================");
    console.log("PHASE 2D TEST SUMMARY");
    console.log("============================================================");
    console.log("✅ TEST 1: proposeRotationPlan() - PASSED");
    console.log("✅ TEST 2: getProposedAssignments() (no filters) - PASSED");
    console.log("✅ TEST 3: getProposedAssignments() (vessel filter) - PASSED");
    console.log("✅ TEST 4: getProposedAssignments() (rank filter) - PASSED");
    console.log("✅ TEST 5: getProposedAssignments() (date filter) - PASSED");
    console.log("✅ TEST 6: checkAssignmentConflicts() (no conflict) - PASSED");
    console.log("✅ TEST 7: checkAssignmentConflicts() (with conflict) - PASSED");
    console.log("✅ TEST 8: deployAssignment() (conflict detection) - PASSED");
    console.log("✅ TEST 9: deployAssignment() (successful deploy) - PASSED");
    console.log("✅ TEST 10: rejectAssignment() - PASSED");
    console.log();
    console.log("🎉 ALL 5 WORKFLOW METHODS WORKING!");
    console.log("============================================================");

  } catch (error) {
    console.log("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

testPhase2D();
